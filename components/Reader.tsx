
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User } from '../types';
import { ChevronLeft, ChevronRight, MessageSquarePlus, Maximize2, Timer, Trash2, Share2, Loader2, Check, Target } from 'lucide-react';
import { db } from '../services/db';

const CHARS_PER_PAGE = 2500;

const ANNOTATION_COLORS = [
    { name: 'amber', bg: 'bg-amber-200/50', hex: '#fde68a', text: 'text-amber-900' },
    { name: 'rose', bg: 'bg-rose-200/50', hex: '#fecdd3', text: 'text-rose-900' },
    { name: 'emerald', bg: 'bg-emerald-200/50', hex: '#a7f3d0', text: 'text-emerald-900' },
    { name: 'sky', bg: 'bg-sky-200/50', hex: '#bae6fd', text: 'text-sky-900' },
];

const AMBIENT_SOUNDS = [
    { id: 'rain', label: 'Дождь', url: 'https://assets.mixkit.co/active_storage/sfx/2443/2443-preview.mp3' },
    { id: 'forest', label: 'Лес', url: 'https://assets.mixkit.co/active_storage/sfx/2434/2434-preview.mp3' },
];

interface ReaderProps {
  book: Book;
  user: User;
  onClose: () => void;
  onUpdateBook: (book: Book) => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, user, onClose, onUpdateBook }) => {
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [sharingNoteId, setSharingNoteId] = useState<string | null>(null);
  const [sharedNoteId, setSharedNoteId] = useState<string | null>(null);
  
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const volume = 0.3;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [focusTime, setFocusTime] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Helper to sync page and progress
  const handlePageChange = useCallback((newPage: number) => {
    const total = book.totalPages || 1;
    const clampedPage = Math.max(1, Math.min(total, newPage));
    
    if (clampedPage === currentPage) return;

    setCurrentPage(clampedPage);
    
    // Calculate new progress percentage
    const newProgress = Math.floor((clampedPage / total) * 100);
    
    // Determine status
    let newStatus = book.status;
    if (clampedPage === total) {
      newStatus = 'completed';
    } else if (clampedPage > 1) {
      newStatus = 'reading';
    }

    onUpdateBook({
      ...book,
      currentPage: clampedPage,
      progress: newProgress,
      status: newStatus as any
    });
  }, [book, currentPage, onUpdateBook]);

  useEffect(() => {
    let interval: any;
    if (isZenMode) {
      interval = setInterval(() => setFocusTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isZenMode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (activeSound) {
        const sound = AMBIENT_SOUNDS.find(s => s.id === activeSound);
        if (sound) {
          audioRef.current.src = sound.url;
          audioRef.current.play().catch(e => console.log("Audio play blocked", e));
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [activeSound, volume]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim() && containerRef.current) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parentRect = containerRef.current.getBoundingClientRect();
      setSelection({
        text: sel.toString(),
        top: rect.top - parentRect.top,
        left: rect.left - parentRect.left + rect.width / 2
      });
    } else {
      setSelection(null);
    }
  };

  const saveNote = () => {
    if (!selection || !noteText.trim()) return;
    const newAnn: Annotation = {
      id: Date.now().toString(),
      quote: selection.text,
      comment: noteText,
      color: selectedColor.name,
      timestamp: Date.now()
    };
    onUpdateBook({ ...book, annotations: [...(book.annotations || []), newAnn] });
    setIsAddingNote(false);
    setNoteText('');
    setSelection(null);
  };

  const handleDeleteNote = async (annId: string) => {
    const updatedAnnotations = (book.annotations || []).filter(a => a.id !== annId);
    onUpdateBook({ ...book, annotations: updatedAnnotations });
    try {
      await db.deleteAnnotation(annId);
    } catch (e) {
      console.error("Failed to delete annotation from DB:", e);
    }
  };

  const handleShareNote = async (ann: Annotation) => {
    if (sharingNoteId) return;
    setSharingNoteId(ann.id);
    try {
      await db.shareAnnotation(user, book, ann);
      setSharedNoteId(ann.id);
      setTimeout(() => setSharedNoteId(null), 3000);
    } catch (e) {
      console.error("Failed to share annotation:", e);
    } finally {
      setSharingNoteId(null);
    }
  };

  const navigateToAnnotation = (ann: Annotation) => {
    if (!book.content || !ann.quote) return;
    
    // Find absolute index of the quote
    const index = book.content.indexOf(ann.quote);
    if (index === -1) return;

    // Calculate target page
    const targetPage = Math.floor(index / CHARS_PER_PAGE) + 1;
    handlePageChange(targetPage);

    // Set active and hovered to trigger highlight
    setActiveAnnotationId(ann.id);
    setHoveredAnnotationId(ann.id);

    // Briefly pulse the focus
    setTimeout(() => {
        setActiveAnnotationId(null);
    }, 2000);

    // Scroll main area to top if needed, though most reading apps just change page
    textRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContentWithHighlights = () => {
    const pageText = book.content?.slice((currentPage - 1) * CHARS_PER_PAGE, currentPage * CHARS_PER_PAGE) || "";
    
    if (!hoveredAnnotationId && !activeAnnotationId) return pageText;

    const highlightId = hoveredAnnotationId || activeAnnotationId;
    const ann = book.annotations?.find(a => a.id === highlightId);
    if (!ann || !ann.quote) return pageText;

    const index = pageText.indexOf(ann.quote);
    if (index === -1) return pageText;

    const colorConfig = ANNOTATION_COLORS.find(c => c.name === ann.color) || ANNOTATION_COLORS[0];
    const isPulsing = activeAnnotationId === ann.id;

    return (
      <>
        {pageText.slice(0, index)}
        <mark 
          className={`
            transition-all duration-500 rounded px-1 -mx-1 py-0.5
            ${colorConfig.bg} ${colorConfig.text}
            ${isPulsing ? 'animate-pulse ring-4' : 'ring-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]'}
            ring-amber-500/20 bg-opacity-80 dark:bg-opacity-40
          `}
        >
          {ann.quote}
        </mark>
        {pageText.slice(index + ann.quote.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[100] transition-all duration-700 flex flex-col ${isZenMode ? 'bg-stone-950 text-stone-400' : 'bg-[#fcfaf7] dark:bg-stone-950 text-stone-900 dark:text-stone-100'}`}>
      <audio ref={audioRef} loop />
      
      {/* Dynamic Header */}
      <header className={`h-20 px-10 border-b border-stone-200/50 dark:border-stone-800/50 flex items-center justify-between transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl transition-all"><ChevronLeft size={24} /></button>
          <div>
            <h2 className="font-serif font-black text-xl truncate max-w-xs">{book.title}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{currentPage} / {book.totalPages}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isZenMode && <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl font-mono text-xs text-amber-500"><Timer size={14}/> {formatTime(focusTime)}</div>}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl">
            {AMBIENT_SOUNDS.map(s => (
              <button key={s.id} onClick={() => setActiveSound(activeSound === s.id ? null : s.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSound === s.id ? 'bg-amber-500 text-white' : 'text-stone-400'}`}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => setIsZenMode(!isZenMode)} className={`p-3 rounded-2xl transition-all ${isZenMode ? 'bg-amber-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}><Maximize2 size={20}/></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-1000 ${isZenMode ? 'max-w-4xl mx-auto py-24 px-16' : 'p-12 md:p-20'}`} ref={textRef}>
          <div 
            className={`max-w-3xl mx-auto leading-[2.2] whitespace-pre-line font-serif selection:bg-amber-500/20 transition-all duration-500 ${isZenMode ? 'text-2xl text-stone-300' : 'text-xl'}`}
            onMouseUp={handleSelection}
          >
            {renderContentWithHighlights()}
          </div>
          
          <div className="max-w-3xl mx-auto mt-20 flex justify-between items-center border-t border-stone-200 dark:border-stone-800 pt-10">
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1}
              className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber-500 transition-colors disabled:opacity-20"
            >
              <ChevronLeft size={16}/> Назад
            </button>
            <div className="flex flex-col items-center gap-2">
              <div className="h-1 w-32 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }}></div>
              </div>
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= (book.totalPages || 1)}
              className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber-500 transition-colors disabled:opacity-20"
            >
              Вперед <ChevronRight size={16}/>
            </button>
          </div>
        </main>

        {!isZenMode && (
          <aside className="w-96 border-l border-stone-200/50 dark:border-stone-800/50 bg-white dark:bg-stone-900 flex flex-col shrink-0 animate-slide-in-right">
            <div className="p-8 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <h3 className="font-serif font-black text-xl">Заметки</h3>
              <div className="text-[10px] font-black uppercase text-stone-400">{book.annotations?.length || 0} шт.</div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {book.annotations?.map(ann => (
                <div 
                  key={ann.id} 
                  onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                  onMouseLeave={() => setHoveredAnnotationId(null)}
                  onClick={() => navigateToAnnotation(ann)}
                  className={`
                    p-6 rounded-[2rem] bg-stone-50 dark:bg-stone-850 border shadow-sm transition-all duration-300 relative group/ann cursor-pointer
                    ${hoveredAnnotationId === ann.id ? 'border-amber-500/50 shadow-lg scale-[1.02] bg-white dark:bg-stone-800' : 'border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700'}
                  `}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-${ann.color}-200/50 text-${ann.color}-900`}>Цитата</span>
                    
                    <div className="flex gap-1 opacity-0 group-hover/ann:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleShareNote(ann); }}
                        title="Поделиться в ленте"
                        className={`p-2 rounded-xl transition-all ${sharedNoteId === ann.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-stone-800 text-stone-400 hover:text-amber-500'}`}
                      >
                        {sharingNoteId === ann.id ? <Loader2 size={14} className="animate-spin" /> : sharedNoteId === ann.id ? <Check size={14} /> : <Share2 size={14} />}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteNote(ann.id); }}
                        title="Удалить навсегда"
                        className="p-2 bg-white dark:bg-stone-800 text-stone-400 hover:text-red-500 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-stone-400 italic mb-4 line-clamp-3 leading-relaxed">«{ann.quote}»</p>
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-200 flex-1">{ann.comment}</p>
                    <Target size={14} className="text-stone-300 group-hover/ann:text-amber-500 transition-colors ml-2" />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {selection && (
        <div className="fixed z-[200] animate-scale-in" style={{ top: selection.top - 60, left: selection.left, transform: 'translateX(-50%)' }}>
          <button onClick={() => setIsAddingNote(true)} className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:scale-110 transition-all ring-4 ring-white/10"><MessageSquarePlus size={16}/> Заметка</button>
        </div>
      )}

      {isAddingNote && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setIsAddingNote(false)}>
          <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif font-black text-3xl mb-8">Новая заметка</h3>
            <div className="bg-stone-50 dark:bg-stone-800 p-6 rounded-3xl border border-stone-100 dark:border-stone-700 mb-8"><p className="text-stone-400 italic text-sm">«{selection?.text}»</p></div>
            <div className="flex gap-2 mb-8">
              {ANNOTATION_COLORS.map(c => (<button key={c.name} onClick={() => setSelectedColor(c)} className={`w-8 h-8 rounded-full transition-transform hover:scale-125 ${selectedColor.name === c.name ? 'ring-4 ring-amber-500/30' : ''}`} style={{ background: c.hex }} />))}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ваши мысли..." className="w-full h-40 bg-stone-50 dark:bg-stone-800 border-none rounded-3xl p-6 outline-none focus:ring-4 ring-amber-500/10 mb-8 resize-none" autoFocus />
            <div className="flex gap-4">
              <button onClick={() => setIsAddingNote(false)} className="flex-1 py-4 font-bold text-stone-400">Отмена</button>
              <button onClick={saveNote} disabled={!noteText.trim()} className="flex-1 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-30">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
