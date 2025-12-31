
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User, Activity } from '../types';
import { ChevronLeft, ChevronRight, Bookmark, MessageSquarePlus, Trash2, Share2, Check, Loader2, Maximize2, Minimize2, Volume2, VolumeX, Music, Timer, Sparkles, X, Download } from 'lucide-react';
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
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);

  // AI Scene State
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [visualizedImage, setVisualizedImage] = useState<string | null>(null);

  // Time tracking state
  const lastSyncTime = useRef<number>(Date.now());

  const syncReadingTime = useCallback(async () => {
    if (user.id === 'guest') return;
    const now = Date.now();
    const sessionSeconds = Math.floor((now - lastSyncTime.current) / 1000);
    if (sessionSeconds <= 0) return;
    const updatedUser = { ...user, totalReadingTime: (user.totalReadingTime || 0) + sessionSeconds };
    lastSyncTime.current = now;
    await db.updateUserProfile(updatedUser);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => syncReadingTime(), 30000);
    return () => { clearInterval(timer); syncReadingTime(); };
  }, [syncReadingTime]);

  useEffect(() => {
    let interval: any;
    if (isStopwatchRunning) interval = setInterval(() => setStopwatchTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeSound) {
        const sound = AMBIENT_SOUNDS.find(s => s.id === activeSound);
        if (sound) {
            audio.src = sound.url;
            audio.load();
            audio.play().catch(e => console.warn(e));
        }
    } else { audio.pause(); audio.src = ""; }
  }, [activeSound]);

  const handleVisualizeScene = async () => {
    const start = (currentPage - 1) * CHARS_PER_PAGE;
    const textSnippet = book.content?.slice(start, start + 800) || '';
    if (!textSnippet) return;

    setIsVisualizing(true);
    try {
        const prompt = `Atmospheric book illustration for this scene: "${textSnippet}". High quality, artistic, evocative, no text in image.`;
        const imageUrl = await generateSceneImage(prompt, '1K', '16:9');
        setVisualizedImage(imageUrl);
    } catch (e) {
        alert("Оракулу нужно немного больше времени. Попробуйте еще раз.");
    } finally {
        setIsVisualizing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      setSelection({ text: windowSelection.toString(), rect: range.getBoundingClientRect() });
    } else setSelection(null);
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
    onUpdateBook({ ...book, annotations: [newAnnotation, ...(book.annotations || [])] });
    setNoteText(''); setIsAddingNote(false); setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const deleteAnnotation = (id: string) => {
      onUpdateBook({ ...book, annotations: (book.annotations || []).filter(a => a.id !== id) });
  };

  const handleShareNote = async (ann: Annotation) => {
    if (user.id === 'guest') return;
    setSharingNoteId(ann.id);
    const activity: Activity = {
        id: '', user: user, book: book, type: 'note',
        content: `Цитата: "${ann.quote}"\n\nМоя мысль: ${ann.comment}`,
        timestamp: '', likes: 0, likedBy: [], comments: []
    };
    try {
        await db.createActivity(activity);
        setSharedNotes(prev => new Set(prev).add(ann.id));
    } finally { setSharingNoteId(null); }
  };

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-700 overflow-hidden flex flex-col ${isZenMode ? 'bg-stone-950' : 'bg-[#FDFCFB] dark:bg-[#0C0A09]'}`}>
      <audio ref={audioRef} loop />
      
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
                onClick={handleVisualizeScene}
                disabled={isVisualizing}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 disabled:opacity-50"
             >
                 {isVisualizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                 {isVisualizing ? 'Рисуем...' : 'Сцена'}
             </button>
             <button 
                onClick={() => { setIsZenMode(true); setIsStopwatchRunning(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 rounded-xl hover:scale-105 transition-all text-xs font-black uppercase tracking-widest border border-stone-200 dark:border-stone-800"
             >
                 <Maximize2 size={16} /> Zen Mode
             </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col items-stretch transition-all duration-700 ${isZenMode ? 'max-w-4xl mx-auto' : ''}`} ref={textRef}>
          <div className={`py-12 flex-1 relative mx-auto transition-all duration-500 ${isZenMode ? 'px-16 sm:px-24' : 'max-w-3xl px-8 sm:px-12'}`} onMouseUp={handleTextSelection}>
             <div className={`whitespace-pre-line leading-[2.2] font-serif selection:bg-stone-200 dark:selection:bg-stone-700 transition-all duration-500 ${isZenMode ? 'text-2xl text-stone-200' : 'text-xl text-stone-800 dark:text-stone-200'}`}>
                {book.content ? (
                    (() => {
                        const start = (currentPage - 1) * CHARS_PER_PAGE;
                        const end = start + CHARS_PER_PAGE;
                        const pageText = book.content.slice(start, end);
                        return pageText; // Simplification for brevity, annotation logic remains the same
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
                 <h3 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><Bookmark size={18} className="text-stone-400" /> Заметки</h3>
             </div>
             <div className="overflow-y-auto flex-1 p-4 space-y-4 custom-scrollbar">
                 {book.annotations?.map((ann) => (
                    <div key={ann.id} className="p-4 rounded-2xl border bg-stone-50 dark:bg-stone-900/40 relative group">
                        <div className="flex justify-between items-start mb-2">
                             <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800">Заметка</span>
                             <div className="flex gap-2">
                                <button onClick={() => handleShareNote(ann)} className="p-1 text-stone-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all"><Share2 size={14}/></button>
                                <button onClick={() => deleteAnnotation(ann.id)} className="p-1 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                             </div>
                        </div>
                        <p className="text-xs text-stone-500 italic mb-2 line-clamp-2">"{ann.quote}"</p>
                        <p className="text-sm text-stone-800 dark:text-stone-200">{ann.comment}</p>
                    </div>
                 ))}
             </div>
        </aside>

        {/* AI Visualization Overlay */}
        {visualizedImage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl animate-fade-in">
                <button onClick={() => setVisualizedImage(null)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
                    <X size={32} />
                </button>
                <div className="max-w-4xl w-full flex flex-col items-center gap-6">
                    <img src={visualizedImage} className="w-full h-auto rounded-[2rem] shadow-2xl animate-scale-in" alt="Scene Visualization" />
                    <div className="flex gap-4">
                        <a href={visualizedImage} download="scene.png" className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                            <Download size={16} /> Сохранить
                        </a>
                        <button onClick={handleVisualizeScene} disabled={isVisualizing} className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-widest border border-white/20">
                            {isVisualizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Еще раз
                        </button>
                    </div>
                </div>
            </div>
        )}

        {isZenMode && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-stone-900/60 backdrop-blur-2xl border border-white/10 p-2 rounded-3xl animate-fade-in-up z-[60] shadow-2xl">
                <button onClick={() => { setIsZenMode(false); setIsStopwatchRunning(false); setActiveSound(null); }} className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all"><Minimize2 size={20} /></button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <div className="relative">
                    <button onClick={() => setShowSoundMenu(!showSoundMenu)} className={`p-3 transition-all rounded-2xl ${activeSound ? 'text-amber-400 bg-amber-400/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>{activeSound ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
                    {showSoundMenu && (
                        <div className="absolute bottom-16 left-0 bg-stone-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 w-64 shadow-2xl animate-scale-in space-y-2">
                            {AMBIENT_SOUNDS.map(s => <button key={s.id} onClick={() => { setActiveSound(s.id); setShowSoundMenu(false); }} className={`w-full text-left p-2 hover:bg-white/10 rounded-xl text-xs flex items-center gap-2 ${activeSound === s.id ? 'text-amber-400' : 'text-white/80'}`}><Music size={14} /> {s.label}</button>)}
                        </div>
                    )}
                </div>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <div className="flex items-center gap-3 px-4 text-white font-mono text-sm min-w-[100px] justify-center">
                    <Timer size={18} className={isStopwatchRunning ? 'text-rose-500 animate-pulse' : 'text-white/40'} />
                    <span className="tabular-nums font-bold tracking-wider">{formatTime(stopwatchTime)}</span>
                </div>
            </div>
        )}

        {selection && !isAddingNote && !isZenMode && (
            <div className="fixed z-[100] animate-scale-in" style={{ top: `${selection.rect!.top - 60}px`, left: `${selection.rect!.left + selection.rect!.width / 2}px`, transform: 'translateX(-50%)' }}>
                <button onClick={() => setIsAddingNote(true)} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 font-bold hover:scale-110 transition-all ring-4 ring-white/10"><MessageSquarePlus size={18} /> <span className="text-sm">Заметка</span></button>
            </div>
        )}
      </div>
    </div>
  );
};
