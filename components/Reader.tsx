
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User, Activity } from '../types';
import { ChevronLeft, ChevronRight, Bookmark, MessageSquarePlus, Trash2, Share2, Check, Loader2, Maximize2, Minimize2, Volume2, VolumeX, Music, Sparkles, Timer } from 'lucide-react';
import { db } from '../services/db';
import { generateSceneImage } from '../services/geminiService';

const CHARS_PER_PAGE = 2500;

const ANNOTATION_COLORS = [
    { name: 'amber', bg: 'bg-amber-200/50', text: 'text-amber-900', border: 'border-amber-400', sideBg: 'bg-amber-50 dark:bg-amber-900/20' },
    { name: 'rose', bg: 'bg-rose-200/50', text: 'text-rose-900', border: 'border-rose-400', sideBg: 'bg-rose-50 dark:bg-rose-900/20' },
    { name: 'emerald', bg: 'bg-emerald-200/50', text: 'text-emerald-900', border: 'border-emerald-400', sideBg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { name: 'indigo', bg: 'bg-indigo-200/50', text: 'text-indigo-900', border: 'border-indigo-400', sideBg: 'bg-indigo-50 dark:bg-indigo-900/20' },
];

const AMBIENT_SOUNDS = [
    { id: 'rain', label: 'Дождь', url: 'https://www.soundjay.com/nature/rain-01.mp3' },
    { id: 'cafe', label: 'Кофейня', url: 'https://www.soundjay.com/misc/sounds/coffee-shop-1.mp3' },
    { id: 'library', label: 'Библиотека', url: 'https://www.soundjay.com/misc/sounds/ambience-library-1.mp3' },
    { id: 'forest', label: 'Лес', url: 'https://www.soundjay.com/nature/sounds/forest-wind-1.mp3' },
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

  // Focus Mode State
  const [isZenMode, setIsZenMode] = useState(false);
  const [zenBackground, setZenBackground] = useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Time tracking state
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
    }, 30000);

    return () => {
        clearInterval(timer);
        syncReadingTime();
    };
  }, [syncReadingTime]);

  // Pomodoro Timer
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      alert("Время вышло! Пора сделать перерыв.");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Ambient Sounds
  useEffect(() => {
    if (activeSound) {
        const sound = AMBIENT_SOUNDS.find(s => s.id === activeSound);
        if (sound) {
            if (audioRef.current) {
                audioRef.current.src = sound.url;
                audioRef.current.play().catch(() => {});
            }
        }
    } else {
        audioRef.current?.pause();
    }
  }, [activeSound]);

  const generateMoodBackground = async () => {
    setIsGeneratingBg(true);
    try {
        const prompt = `Immersive atmospheric background for the book "${book.title}" by ${book.author}. Style: minimalist, aesthetic, poetic, no text, soft colors, cinematic lighting, 4k.`;
        const img = await generateSceneImage(prompt, '1K', '16:9');
        setZenBackground(img);
    } catch (e) {
        console.error("Mood generation failed", e);
    } finally {
        setIsGeneratingBg(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-700 overflow-hidden flex flex-col ${isZenMode ? 'bg-black' : 'bg-[#FDFCFB] dark:bg-[#0C0A09]'}`}>
      <audio ref={audioRef} loop />
      
      {/* Zen Background */}
      {isZenMode && zenBackground && (
          <div className="absolute inset-0 opacity-40 transition-opacity duration-1000 animate-fade-in pointer-events-none">
              <img src={zenBackground} className="w-full h-full object-cover blur-[2px]" alt="" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60"></div>
          </div>
      )}

      <header className={`h-16 px-6 border-b transition-all duration-500 flex items-center justify-between z-10 bg-inherit ${isZenMode ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0 border-stone-200 dark:border-stone-800'}`}>
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-stone-600 dark:text-stone-400" />
          </button>
          <div>
            <h2 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-lg leading-tight truncate max-w-[200px] sm:max-w-md">{book.title}</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{book.author}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsZenMode(true)}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest border border-stone-200 dark:border-stone-800"
             >
                 <Maximize2 size={16} /> Zen Mode
             </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col items-stretch transition-all duration-700 ${isZenMode ? 'max-w-4xl mx-auto' : ''}`} ref={textRef}>
          <div 
            className={`py-12 flex-1 relative mx-auto transition-all duration-500 ${isZenMode ? 'px-16 sm:px-24' : 'max-w-3xl px-8 sm:px-12'}`} 
            onMouseUp={handleTextSelection}
          >
             <div className={`whitespace-pre-line leading-[2.2] font-serif selection:bg-stone-200 dark:selection:bg-stone-700 transition-all duration-500 ${isZenMode ? 'text-2xl text-stone-200' : 'text-xl text-stone-800 dark:text-stone-200'}`}>
                {book.content ? (
                    (() => {
                        const start = (currentPage - 1) * CHARS_PER_PAGE;
                        const end = start + CHARS_PER_PAGE;
                        const pageText = book.content.slice(start, end);
                        const pageAnnotations = (book.annotations || []).filter(ann => pageText.includes(ann.quote));
                        if (pageAnnotations.length === 0) return pageText;
                        let segments: { text: string; annotation?: Annotation }[] = [{ text: pageText }];
                        pageAnnotations.forEach(ann => {
                            const nextSegments: { text: string; annotation?: Annotation }[] = [];
                            segments.forEach(seg => {
                                if (seg.annotation) nextSegments.push(seg);
                                else {
                                    const parts = seg.text.split(ann.quote);
                                    parts.forEach((part, i) => {
                                        if (part) nextSegments.push({ text: part });
                                        if (i < parts.length - 1) nextSegments.push({ text: ann.quote, annotation: ann });
                                    });
                                }
                            });
                            segments = nextSegments;
                        });
                        return segments.map((seg, i) => seg.annotation ? (
                            <mark 
                                key={i}
                                onMouseEnter={() => setHoveredNoteId(seg.annotation!.id)}
                                onMouseLeave={() => setHoveredNoteId(null)}
                                className={`cursor-help transition-all duration-300 rounded-sm px-0.5 ${(ANNOTATION_COLORS.find(c => c.name === seg.annotation?.color) || ANNOTATION_COLORS[0]).bg} ${(ANNOTATION_COLORS.find(c => c.name === seg.annotation?.color) || ANNOTATION_COLORS[0]).text} ${hoveredNoteId === seg.annotation.id ? 'ring-2 ring-offset-2 ring-stone-400 scale-105' : ''}`}
                            >
                                {seg.text}
                            </mark>
                        ) : <span key={i}>{seg.text}</span>);
                    })()
                ) : "Текст отсутствует."}
             </div>
          </div>
          
          <div className={`w-full py-8 flex items-center justify-between mt-auto mx-auto transition-all duration-500 ${isZenMode ? 'max-w-4xl px-16' : 'max-w-3xl px-8 border-t border-stone-100 dark:border-stone-800'}`}>
              <button onClick={prevPage} disabled={currentPage === 1} className={`flex items-center gap-2 px-4 py-2 transition-colors font-medium disabled:opacity-30 ${isZenMode ? 'text-stone-400 hover:text-white' : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'}`}>
                  <ChevronLeft size={20} /> <span>Назад</span>
              </button>
              
              <div className="flex flex-col items-center">
                  <div className={`text-xs font-bold uppercase tracking-widest mb-2 transition-colors ${isZenMode ? 'text-stone-500' : 'text-stone-400'}`}>Страница {currentPage} / {book.totalPages || 1}</div>
                  <div className={`w-48 h-1 rounded-full overflow-hidden ${isZenMode ? 'bg-white/10' : 'bg-stone-100 dark:bg-stone-800'}`}>
                      <div className={`h-full transition-all duration-300 ${isZenMode ? 'bg-white' : 'bg-stone-400'}`} style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }} />
                  </div>
              </div>

              <button onClick={nextPage} disabled={currentPage === (book.totalPages || 1)} className={`flex items-center gap-2 px-4 py-2 transition-colors font-medium disabled:opacity-30 ${isZenMode ? 'text-stone-400 hover:text-white' : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'}`}>
                  <span>Вперед</span> <ChevronRight size={20} />
              </button>
          </div>
        </div>

        <aside className={`w-80 md:w-96 bg-white dark:bg-stone-950 border-l border-stone-200 dark:border-stone-800 h-full z-20 flex flex-col transition-all duration-700 ${isZenMode ? 'translate-x-full absolute right-0' : 'relative'}`}>
             <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                 <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                     <Bookmark size={18} className="text-stone-400" /> Мои заметки
                 </h3>
             </div>
             <div className="overflow-y-auto flex-1 p-4 space-y-4 custom-scrollbar">
                 {book.annotations?.length === 0 ? (
                    <div className="py-20 text-center px-6">
                        <MessageSquarePlus size={32} className="mx-auto mb-3 text-stone-200 dark:text-stone-800" />
                        <p className="text-stone-400 text-sm">Выделите текст, чтобы создать заметку.</p>
                    </div>
                 ) : (
                    book.annotations?.map((ann) => {
                        const theme = ANNOTATION_COLORS.find(c => c.name === ann.color) || ANNOTATION_COLORS[0];
                        return (
                            <div 
                                key={ann.id} 
                                onMouseEnter={() => setHoveredNoteId(ann.id)}
                                onMouseLeave={() => setHoveredNoteId(null)}
                                className={`p-4 rounded-2xl border transition-all duration-300 group animate-fade-in relative ${theme.sideBg} ${theme.border} ${hoveredNoteId === ann.id ? 'shadow-lg ring-2 ring-stone-900 dark:ring-stone-100 scale-[1.02]' : 'shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${theme.bg} ${theme.text}`}>Цитата</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleShareNote(ann)} disabled={sharedNotes.has(ann.id)} className={`p-1.5 transition-all rounded-lg ${sharedNotes.has(ann.id) ? 'text-emerald-500' : 'text-stone-400 hover:text-amber-600 opacity-0 group-hover:opacity-100'}`}>{sharedNotes.has(ann.id) ? <Check size={14} /> : <Share2 size={14} />}</button>
                                        <button onClick={() => deleteAnnotation(ann.id)} className="p-1.5 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <p className="text-xs text-stone-500 italic mb-2 line-clamp-3 leading-relaxed border-l-2 pl-3 border-stone-200 dark:border-stone-700">{ann.quote}</p>
                                <p className="text-stone-800 dark:text-stone-200 text-sm leading-relaxed font-medium">{ann.comment}</p>
                            </div>
                        );
                    })
                 )}
             </div>
        </aside>

        {/* Floating Zen Controls */}
        {isZenMode && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-stone-900/40 backdrop-blur-xl border border-white/10 p-2 rounded-3xl animate-fade-in-up z-[60]">
                <button 
                    onClick={() => setIsZenMode(false)}
                    className="p-3 text-white/60 hover:text-white transition-all hover:bg-white/10 rounded-2xl"
                    title="Выйти из Zen-режима"
                >
                    <Minimize2 size={20} />
                </button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                
                <div className="relative">
                    <button 
                        onClick={() => setShowSoundMenu(!showSoundMenu)}
                        className={`p-3 transition-all rounded-2xl ${activeSound ? 'text-amber-400 bg-amber-400/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                        title="Звуки окружения"
                    >
                        {activeSound ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                    {showSoundMenu && (
                        <div className="absolute bottom-16 left-0 bg-stone-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 w-48 shadow-2xl animate-scale-in">
                            <button onClick={() => {setActiveSound(null); setShowSoundMenu(false);}} className="w-full text-left p-2 hover:bg-white/10 rounded-lg text-xs text-white/60 flex items-center gap-2"><VolumeX size={14} /> Без звука</button>
                            {AMBIENT_SOUNDS.map(s => (
                                <button key={s.id} onClick={() => {setActiveSound(s.id); setShowSoundMenu(false);}} className={`w-full text-left p-2 hover:bg-white/10 rounded-lg text-xs flex items-center gap-2 ${activeSound === s.id ? 'text-amber-400' : 'text-white/80'}`}><Music size={14} /> {s.label}</button>
                            ))}
                        </div>
                    )}
                </div>

                <button 
                    onClick={generateMoodBackground}
                    disabled={isGeneratingBg}
                    className={`p-3 transition-all rounded-2xl ${zenBackground ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    title="AI Атмосфера"
                >
                    {isGeneratingBg ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                </button>

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                <div className="flex items-center gap-3 px-4 text-white font-mono text-sm">
                    <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`transition-all ${isTimerRunning ? 'text-rose-500' : 'text-white/40'}`}>
                        <Timer size={18} />
                    </button>
                    <span className="tabular-nums">{formatTime(timeLeft)}</span>
                </div>
            </div>
        )}

        {selection && !isAddingNote && !isZenMode && (
            <div className="fixed z-[100] animate-scale-in" style={{ top: `${selection.rect!.top - 60}px`, left: `${selection.rect!.left + selection.rect!.width / 2}px`, transform: 'translateX(-50%)' }}>
                <button onClick={() => setIsAddingNote(true)} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold hover:scale-110 transition-all ring-4 ring-white/10">
                    <MessageSquarePlus size={18} /> <span className="text-sm">Заметка</span>
                </button>
            </div>
        )}

        {isAddingNote && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsAddingNote(false)}>
                 <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in border border-stone-100 dark:border-stone-800" onClick={e => e.stopPropagation()}>
                     <h3 className="font-serif font-bold text-xl text-stone-800 dark:text-white mb-6">Создать заметку</h3>
                     <div className="bg-stone-50 dark:bg-stone-950 p-4 rounded-xl border border-stone-100 dark:border-stone-800 mb-6 max-h-32 overflow-y-auto">
                        <p className="text-stone-400 italic text-sm leading-relaxed">"{selection?.text}"</p>
                     </div>
                     <div className="flex gap-3 mb-6">
                         {ANNOTATION_COLORS.map(color => (
                             <button key={color.name} onClick={() => setSelectedColor(color)} className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${color.bg} ${selectedColor.name === color.name ? 'ring-2 ring-stone-900 dark:ring-stone-100 scale-110' : 'hover:scale-105 opacity-60'}`}>
                                 {selectedColor.name === color.name && <div className="w-2 h-2 rounded-full bg-white shadow-sm" />}
                             </button>
                         ))}
                     </div>
                     <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="О чем вы думаете?.." className="w-full p-4 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl h-32 resize-none mb-6 outline-none focus:ring-2 focus:ring-stone-500 transition-all dark:text-white" autoFocus />
                     <div className="flex gap-3">
                         <button onClick={() => setIsAddingNote(false)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors">Отмена</button>
                         <button onClick={saveAnnotation} disabled={!noteText.trim()} className="flex-1 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl font-bold shadow-lg disabled:opacity-30 hover:opacity-90 transition-opacity">Сохранить</button>
                     </div>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};
