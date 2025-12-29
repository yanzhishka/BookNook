
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User, Activity } from '../types';
import { ChevronLeft, ChevronRight, Bookmark, MessageSquarePlus, Trash2, Share2, Check, Loader2 } from 'lucide-react';
import { db } from '../services/db';

const CHARS_PER_PAGE = 2500;

const ANNOTATION_COLORS = [
    { name: 'amber', bg: 'bg-amber-200/50', text: 'text-amber-900', border: 'border-amber-400', sideBg: 'bg-amber-50 dark:bg-amber-900/20' },
    { name: 'rose', bg: 'bg-rose-200/50', text: 'text-rose-900', border: 'border-rose-400', sideBg: 'bg-rose-50 dark:bg-rose-900/20' },
    { name: 'emerald', bg: 'bg-emerald-200/50', text: 'text-emerald-900', border: 'border-emerald-400', sideBg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { name: 'indigo', bg: 'bg-indigo-200/50', text: 'text-indigo-900', border: 'border-indigo-400', sideBg: 'bg-indigo-50 dark:bg-indigo-900/20' },
];

interface ReaderProps {
  book: Book;
  user: User;
  onClose: () => void;
  onUpdateBook: (book: Book) => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, user, onClose, onUpdateBook }) => {
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect | null } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [sharingNoteId, setSharingNoteId] = useState<string | null>(null);
  const [sharedNotes, setSharedNotes] = useState<Set<string>>(new Set());
  const textRef = useRef<HTMLDivElement>(null);

  // Time tracking state
  const sessionStartTime = useRef<number>(Date.now());
  const lastSyncTime = useRef<number>(Date.now());

  const syncReadingTime = useCallback(async () => {
    if (user.id === 'guest') return;
    const now = Date.now();
    const sessionSeconds = Math.floor((now - lastSyncTime.current) / 1000);
    if (sessionSeconds <= 0) return;

    const updatedUser = {
      ...user,
      totalReadingTime: (user.totalReadingTime || 0) + sessionSeconds
    };
    
    lastSyncTime.current = now;
    await db.updateUserProfile(updatedUser);
  }, [user]);

  // Track time
  useEffect(() => {
    const timer = setInterval(() => {
        syncReadingTime();
    }, 30000); // Синхронизация каждые 30 секунд

    return () => {
        clearInterval(timer);
        syncReadingTime(); // Последняя синхронизация перед закрытием
    };
  }, [syncReadingTime]);

  // Auto-save progress
  useEffect(() => {
    const totalPages = book.totalPages || 1;
    const progress = Math.round((currentPage / totalPages) * 100);
    if (book.currentPage === currentPage && book.progress === progress) return;
    onUpdateBook({ ...book, currentPage, progress });
  }, [currentPage]);

  const nextPage = () => {
    if (currentPage < (book.totalPages || 1)) {
        setCurrentPage(prev => prev + 1);
        textRef.current?.scrollTo(0, 0);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
        setCurrentPage(prev => prev - 1);
        textRef.current?.scrollTo(0, 0);
    }
  };

  const handleTextSelection = () => {
    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 0) {
      const range = windowSelection.getRangeAt(0);
      setSelection({
        text: windowSelection.toString(),
        rect: range.getBoundingClientRect()
      });
    } else {
        setSelection(null);
    }
  };

  const saveAnnotation = () => {
    if (!selection || !noteText.trim()) return;
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      quote: selection.text,
      comment: noteText,
      color: selectedColor.name,
      timestamp: Date.now()
    };
    onUpdateBook({
      ...book,
      annotations: [newAnnotation, ...(book.annotations || [])]
    });
    setNoteText('');
    setIsAddingNote(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const deleteAnnotation = (id: string) => {
      onUpdateBook({
          ...book,
          annotations: (book.annotations || []).filter(a => a.id !== id)
      });
  };

  const handleShareNote = async (ann: Annotation) => {
    if (user.id === 'guest') return;
    setSharingNoteId(ann.id);
    
    const activityContent = `Цитата: "${ann.quote}"\n\nМоя мысль: ${ann.comment}`;
    
    const activity: Activity = {
        id: '',
        user: user,
        book: book,
        type: 'note',
        content: activityContent,
        timestamp: '',
        likes: 0,
        likedBy: [],
        comments: []
    };

    try {
        await db.createActivity(activity);
        setSharedNotes(prev => new Set(prev).add(ann.id));
    } catch (e) {
        console.error("Failed to share note", e);
    } finally {
        setSharingNoteId(null);
    }
  };

  const renderContentWithHighlights = () => {
    if (!book.content) return "Текст книги отсутствует.";
    
    const start = (currentPage - 1) * CHARS_PER_PAGE;
    const end = start + CHARS_PER_PAGE;
    const pageText = book.content.slice(start, end);

    const pageAnnotations = (book.annotations || []).filter(ann => pageText.includes(ann.quote));

    if (pageAnnotations.length === 0) return pageText;

    let segments: { text: string; annotation?: Annotation }[] = [{ text: pageText }];

    pageAnnotations.forEach(ann => {
        const nextSegments: { text: string; annotation?: Annotation }[] = [];
        segments.forEach(seg => {
            if (seg.annotation) {
                nextSegments.push(seg);
            } else {
                const parts = seg.text.split(ann.quote);
                parts.forEach((part, i) => {
                    if (part) nextSegments.push({ text: part });
                    if (i < parts.length - 1) nextSegments.push({ text: ann.quote, annotation: ann });
                });
            }
        });
        segments = nextSegments;
    });

    return segments.map((seg, i) => {
        if (seg.annotation) {
            const colorTheme = ANNOTATION_COLORS.find(c => c.name === seg.annotation?.color) || ANNOTATION_COLORS[0];
            const isHovered = hoveredNoteId === seg.annotation.id;
            
            return (
                <mark 
                    key={i}
                    onMouseEnter={() => setHoveredNoteId(seg.annotation!.id)}
                    onMouseLeave={() => setHoveredNoteId(null)}
                    className={`cursor-help transition-all duration-300 rounded-sm px-0.5 ${colorTheme.bg} ${colorTheme.text} ${isHovered ? 'ring-2 ring-offset-2 ring-stone-400 dark:ring-offset-stone-900 scale-105' : ''}`}
                >
                    {seg.text}
                </mark>
            );
        }
        return <span key={i}>{seg.text}</span>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FDFCFB] dark:bg-[#0C0A09] flex flex-col animate-scale-in overflow-hidden">
      <header className="h-16 px-6 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between z-10 bg-inherit transition-colors duration-300">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-stone-600 dark:text-stone-400" />
          </button>
          <div>
            <h2 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-lg leading-tight truncate max-w-[200px] sm:max-w-md">{book.title}</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{book.author}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-stretch" ref={textRef}>
          <div 
            className="py-12 flex-1 relative max-w-3xl mx-auto px-8 sm:px-12" 
            onMouseUp={handleTextSelection}
          >
             <div className="whitespace-pre-line leading-[2.2] text-xl text-stone-800 dark:text-stone-200 font-serif selection:bg-stone-200 dark:selection:bg-stone-700">
                {renderContentWithHighlights()}
             </div>
          </div>
          
          <div className="w-full py-8 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 mt-auto max-w-3xl mx-auto px-8 sm:px-12">
              <button onClick={prevPage} disabled={currentPage === 1} className="flex items-center gap-2 px-4 py-2 text-stone-500 disabled:opacity-30 hover:text-stone-900 dark:hover:text-stone-100 transition-colors font-medium">
                  <ChevronLeft size={20} /> <span>Назад</span>
              </button>
              
              <div className="flex flex-col items-center">
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Страница {currentPage} / {book.totalPages || 1}</div>
                  <div className="w-48 h-1 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div className="h-full bg-stone-400 transition-all duration-300" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }} />
                  </div>
              </div>

              <button onClick={nextPage} disabled={currentPage === book.totalPages} className="flex items-center gap-2 px-4 py-2 text-stone-500 disabled:opacity-30 hover:text-stone-900 dark:hover:text-stone-100 transition-colors font-medium">
                  <span>Вперед</span> <ChevronRight size={20} />
              </button>
          </div>
        </div>

        <aside className="w-80 md:w-96 bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-stone-800 h-full z-20 flex flex-col overflow-hidden">
             <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                 <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                     <Bookmark size={18} className="text-stone-400" />
                     Мои заметки
                 </h3>
             </div>
             <div className="overflow-y-auto flex-1 p-4 space-y-4 custom-scrollbar overflow-x-hidden">
                 {book.annotations?.length === 0 ? (
                    <div className="py-20 text-center px-6">
                        <MessageSquarePlus size={32} className="mx-auto mb-3 text-stone-200 dark:text-stone-800" />
                        <p className="text-stone-400 text-sm">Выделите текст, чтобы создать свою первую цветную заметку.</p>
                    </div>
                 ) : (
                    book.annotations?.map((ann) => {
                        const theme = ANNOTATION_COLORS.find(c => c.name === ann.color) || ANNOTATION_COLORS[0];
                        const isHovered = hoveredNoteId === ann.id;
                        const isShared = sharedNotes.has(ann.id);
                        const isSharing = sharingNoteId === ann.id;
                        
                        return (
                            <div 
                                key={ann.id} 
                                onMouseEnter={() => setHoveredNoteId(ann.id)}
                                onMouseLeave={() => setHoveredNoteId(null)}
                                className={`p-4 rounded-2xl border transition-all duration-300 group animate-fade-in relative ${theme.sideBg} ${theme.border} ${isHovered ? 'shadow-lg ring-2 ring-stone-900 dark:ring-stone-100' : 'shadow-sm'} max-w-full overflow-hidden`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${theme.bg} ${theme.text} shrink-0`}>Цитата</span>
                                    <div className="flex gap-1">
                                        {user.id !== 'guest' && (
                                            <button 
                                                onClick={() => handleShareNote(ann)}
                                                disabled={isShared || isSharing}
                                                title={isShared ? "Опубликовано" : "Опубликовать в ленте"}
                                                className={`p-1.5 transition-all rounded-lg ${isShared ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/40' : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'} ${!isShared && !isSharing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                                            >
                                                {isSharing ? <Loader2 size={14} className="animate-spin" /> : isShared ? <Check size={14} /> : <Share2 size={14} />}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => deleteAnnotation(ann.id)}
                                            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-stone-500 italic mb-3 line-clamp-3 leading-relaxed border-l-2 pl-3 border-stone-200 dark:border-stone-700 break-all w-full">
                                    {ann.quote}
                                </p>
                                <p className="text-stone-800 dark:text-stone-200 text-sm leading-relaxed font-medium break-all w-full">
                                    {ann.comment}
                                </p>
                                <div className="mt-4 flex justify-between items-center text-[10px] text-stone-400 font-medium">
                                    <span>{new Date(ann.timestamp).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })
                 )}
             </div>
        </aside>

        {selection && !isAddingNote && (
            <div 
                className="fixed z-[100] animate-scale-in" 
                style={{ 
                    top: `${selection.rect!.top - 60}px`, 
                    left: `${selection.rect!.left + selection.rect!.width / 2}px`, 
                    transform: 'translateX(-50%)' 
                }}
            >
                <button 
                    onClick={() => setIsAddingNote(true)} 
                    className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold hover:scale-110 active:scale-95 transition-all ring-4 ring-white/10"
                >
                    <MessageSquarePlus size={18} /> <span className="text-sm">Заметка</span>
                </button>
            </div>
        )}

        {isAddingNote && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsAddingNote(false)}>
                 <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-stone-100 dark:border-stone-800" onClick={e => e.stopPropagation()}>
                     <h3 className="font-serif font-bold text-xl text-stone-800 dark:text-white mb-6">Создать заметку</h3>
                     
                     <div className="bg-stone-50 dark:bg-stone-950 p-4 rounded-xl border border-stone-100 dark:border-stone-800 mb-6 max-h-32 overflow-y-auto">
                        <p className="text-stone-400 italic text-sm leading-relaxed break-all">"{selection?.text}"</p>
                     </div>

                     <div className="flex gap-3 mb-6">
                         {ANNOTATION_COLORS.map(color => (
                             <button
                                key={color.name}
                                onClick={() => setSelectedColor(color)}
                                className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${color.bg} ${selectedColor.name === color.name ? 'ring-2 ring-stone-900 dark:ring-stone-100 scale-110' : 'hover:scale-105 opacity-60'}`}
                             >
                                 {selectedColor.name === color.name && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                             </button>
                         ))}
                     </div>

                     <textarea 
                        value={noteText} 
                        onChange={e => setNoteText(e.target.value)} 
                        placeholder="О чем вы думаете? Поделитесь своими мыслями..." 
                        className="w-full p-4 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl h-32 resize-none mb-6 outline-none focus:ring-2 focus:ring-stone-500 transition-all dark:text-white" 
                        autoFocus 
                     />
                     
                     <div className="flex gap-3">
                         <button onClick={() => setIsAddingNote(false)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors">Отмена</button>
                         <button 
                            onClick={saveAnnotation} 
                            disabled={!noteText.trim()} 
                            className="flex-1 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl font-bold shadow-lg disabled:opacity-30 hover:opacity-90 transition-opacity"
                         >
                             Сохранить
                         </button>
                     </div>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};
