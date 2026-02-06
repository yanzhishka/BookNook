
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User } from '../types';
import { ChevronLeft, ChevronRight, MessageSquarePlus, Maximize2, Timer, Trash2, Share2, Loader2, Check, Target, Settings2, Minus, Plus as PlusIcon, Type, BookMarked } from 'lucide-react';
import { db } from '../services/db';

const CHARS_PER_PAGE = 2500;

const STORAGE_KEYS = {
  FONT_SIZE: 'bnook_reader_font_size',
  FONT_FAMILY: 'bnook_reader_font_family',
  THEME: 'bnook_reader_theme',
};

const ANNOTATION_COLORS = [
    { name: 'amber', bg: 'bg-amber-200/50', hex: '#fde68a', text: 'text-amber-900' },
    { name: 'rose', bg: 'bg-rose-200/50', hex: '#fecdd3', text: 'text-rose-900' },
    { name: 'emerald', bg: 'bg-emerald-200/50', hex: '#a7f3d0', text: 'text-emerald-900' },
    { name: 'sky', bg: 'bg-sky-200/50', hex: '#bae6fd', text: 'text-sky-900' },
];

const READER_THEMES = [
  { id: 'parchment', name: 'Бумага', bg: 'bg-[#fcfaf7]', text: 'text-stone-900', border: 'border-stone-200', dark: false, hex: '#fcfaf7' },
  { id: 'sepia', name: 'Сепия', bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]', border: 'border-[#e4dcc8]', dark: false, hex: '#f4ecd8' },
  { id: 'night', name: 'Ночь', bg: 'bg-[#0c0a09]', text: 'text-stone-300', border: 'border-stone-800', dark: true, hex: '#0c0a09' },
  { id: 'solar', name: 'Солярис', bg: 'bg-[#073642]', text: 'text-[#93a1a1]', border: 'border-[#002b36]', dark: true, hex: '#073642' },
];

const READER_FONTS = [
  { id: 'serif', name: 'Serif', family: 'Merriweather, serif' },
  { id: 'sans', name: 'Sans', family: 'Inter, sans-serif' },
  { id: 'mono', name: 'Mono', family: 'monospace' },
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
  
  // Customization State with Persistance
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
    return saved ? parseInt(saved, 10) : 20;
  });
  
  const [fontFamily, setFontFamily] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT_FAMILY);
    return READER_FONTS.find(f => f.id === saved) || READER_FONTS[0];
  });
  
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return READER_THEMES.find(t => t.id === saved) || READER_THEMES[0];
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showMobileAnnotations, setShowMobileAnnotations] = useState(false);

  const [isZenMode, setIsZenMode] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const volume = 0.3;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [focusTime, setFocusTime] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_FAMILY, fontFamily.id);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, currentTheme.id);
  }, [currentTheme]);

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
    const index = book.content.indexOf(ann.quote);
    if (index === -1) return;
    const targetPage = Math.floor(index / CHARS_PER_PAGE) + 1;
    handlePageChange(targetPage);
    setActiveAnnotationId(ann.id);
    setHoveredAnnotationId(ann.id);
    setShowMobileAnnotations(false);
    setTimeout(() => setActiveAnnotationId(null), 2000);
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
    <div 
      ref={containerRef} 
      className={`fixed inset-0 z-[100] transition-all duration-700 flex flex-col ${isZenMode && currentTheme.dark ? 'bg-stone-950' : currentTheme.bg} ${currentTheme.text}`}
    >
      <audio ref={audioRef} loop />
      
      {/* Dynamic Header */}
      <header className={`h-16 md:h-20 px-4 md:px-10 border-b ${currentTheme.border} flex items-center justify-between transition-opacity duration-500 z-50 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 md:gap-6">
          <button onClick={onClose} className={`p-2 md:p-3 rounded-2xl transition-all ${currentTheme.dark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><ChevronLeft size={24} /></button>
          <div className="max-w-[120px] md:max-w-xs">
            <h2 className="font-serif font-black text-sm md:text-xl truncate">{book.title}</h2>
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-50">{currentPage} / {book.totalPages}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex p-1 rounded-2xl bg-black/5 dark:bg-white/5">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 md:p-3 rounded-xl transition-all ${showSettings ? 'bg-amber-500 text-white' : 'opacity-40 hover:opacity-100'}`}
            >
              <Type size={18} />
            </button>
            <button 
              onClick={() => setShowMobileAnnotations(!showMobileAnnotations)}
              className={`md:hidden p-2 rounded-xl transition-all ${showMobileAnnotations ? 'bg-amber-500 text-white' : 'opacity-40 hover:opacity-100'}`}
            >
              <BookMarked size={18} />
            </button>
            <button onClick={() => setIsZenMode(!isZenMode)} className={`p-2 md:p-3 rounded-xl transition-all ${isZenMode ? 'bg-amber-500 text-white' : 'opacity-40 hover:opacity-100'}`}><Maximize2 size={18}/></button>
          </div>
        </div>

        {showSettings && (
          <div className="absolute top-full right-4 mt-2 w-72 md:w-80 p-6 md:p-8 bg-[#1a1817] dark:bg-[#1a1817] border border-stone-800 rounded-[2rem] shadow-2xl animate-scale-in z-50 text-stone-100">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-4 block text-center md:text-left">Размер: {fontSize}px</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2 bg-stone-800/50 rounded-xl"><Minus size={14}/></button>
                  <input type="range" min="12" max="42" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 accent-amber-500" />
                  <button onClick={() => setFontSize(Math.min(42, fontSize + 2))} className="p-2 bg-stone-800/50 rounded-xl"><PlusIcon size={14}/></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {READER_FONTS.map(f => (
                  <button key={f.id} onClick={() => setFontFamily(f)} className={`py-2 rounded-xl text-[10px] font-bold border ${fontFamily.id === f.id ? 'border-amber-500 text-amber-500' : 'border-stone-800 text-stone-400'}`} style={{ fontFamily: f.family }}>{f.name}</button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {READER_THEMES.map(t => (
                  <button key={t.id} onClick={() => setCurrentTheme(t)} className={`w-full aspect-square rounded-full border-2 ${currentTheme.id === t.id ? 'border-amber-500 scale-110' : 'border-stone-800'}`} style={{ backgroundColor: t.hex }} />
                ))}
              </div>
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                 {AMBIENT_SOUNDS.map(s => (
                  <button key={s.id} onClick={() => setActiveSound(activeSound === s.id ? null : s.id)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${activeSound === s.id ? 'bg-amber-500 text-white' : 'opacity-40'}`}>{s.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-1000 ${isZenMode ? 'max-w-4xl mx-auto py-12 md:py-24 px-6 md:px-16' : 'p-6 md:p-20'}`} ref={textRef}>
          <div 
            className="max-w-3xl mx-auto leading-[2] md:leading-[2.2] whitespace-pre-line selection:bg-amber-500/20 transition-all duration-500"
            onMouseUp={handleSelection}
            style={{ 
              fontSize: `${fontSize}px`, 
              fontFamily: fontFamily.family,
              color: isZenMode && currentTheme.dark ? '#a8a29e' : undefined 
            }}
          >
            {renderContentWithHighlights()}
          </div>
          
          <div className={`max-w-3xl mx-auto mt-12 md:mt-20 flex justify-between items-center border-t ${currentTheme.border} pt-8 pb-24`}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1}
              className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl disabled:opacity-10"
            >
              <ChevronLeft size={20}/>
            </button>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{Math.round((currentPage / (book.totalPages || 1)) * 100)}%</span>
              <div className={`h-1 w-20 md:w-32 rounded-full overflow-hidden ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }}></div>
              </div>
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= (book.totalPages || 1)}
              className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl disabled:opacity-10"
            >
              <ChevronRight size={20}/>
            </button>
          </div>
        </main>

        {/* Desktop Sidebar & Mobile Drawer */}
        <aside className={`
          fixed md:relative inset-y-0 right-0 w-80 md:w-96 bg-white dark:bg-[#110f0e] border-l ${currentTheme.border} 
          transition-transform duration-500 z-[60] flex flex-col
          ${showMobileAnnotations || (!isZenMode && window.innerWidth >= 768) ? 'translate-x-0' : 'translate-x-full md:hidden'}
        `}>
          <div className="p-8 border-b opacity-50 flex justify-between items-center">
            <h3 className="font-serif font-black text-xl">Заметки</h3>
            <button onClick={() => setShowMobileAnnotations(false)} className="md:hidden"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32 md:pb-6">
            {book.annotations?.map(ann => (
              <div 
                key={ann.id} 
                onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                onMouseLeave={() => setHoveredAnnotationId(null)}
                onClick={() => navigateToAnnotation(ann)}
                className={`
                  p-6 rounded-[2rem] border shadow-sm transition-all duration-300 relative group/ann cursor-pointer
                  ${currentTheme.dark ? 'bg-white/5 border-transparent' : 'bg-black/5 border-transparent'}
                  ${hoveredAnnotationId === ann.id ? 'border-amber-500/50 shadow-lg scale-[1.02] bg-opacity-100' : ''}
                `}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-${ann.color}-200/50 text-${ann.color}-900`}>Цитата</span>
                  <div className="flex gap-1 md:opacity-0 group-hover/ann:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleShareNote(ann); }} className="p-2 bg-white dark:bg-stone-800 text-stone-400 rounded-xl"><Share2 size={12}/></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(ann.id); }} className="p-2 bg-white dark:bg-stone-800 text-stone-400 rounded-xl hover:text-red-500"><Trash2 size={12}/></button>
                  </div>
                </div>
                <p className="text-xs opacity-50 italic mb-4 line-clamp-3 leading-relaxed">«{ann.quote}»</p>
                <div className="flex justify-between items-end">
                  <p className="text-sm font-medium flex-1">{ann.comment}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {selection && (
        <div className="fixed z-[200] animate-scale-in" style={{ top: selection.top - 60, left: selection.left, transform: 'translateX(-50%)' }}>
          <button onClick={() => setIsAddingNote(true)} className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:scale-110 transition-all ring-4 ring-white/10"><MessageSquarePlus size={16}/> Заметка</button>
        </div>
      )}

      {isAddingNote && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-fade-in" onClick={() => setIsAddingNote(false)}>
          <div className="bg-white dark:bg-stone-900 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] w-full max-w-lg shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-serif font-black text-2xl md:text-3xl mb-6 md:mb-8">Новая заметка</h3>
            <div className="bg-stone-50 dark:bg-stone-800 p-4 md:p-6 rounded-3xl border border-stone-100 dark:border-stone-700 mb-6 md:mb-8"><p className="text-stone-400 italic text-xs md:text-sm line-clamp-3">«{selection?.text}»</p></div>
            <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2">
              {ANNOTATION_COLORS.map(c => (<button key={c.name} onClick={() => setSelectedColor(c)} className={`w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0 transition-transform ${selectedColor.name === c.name ? 'ring-4 ring-amber-500/30' : ''}`} style={{ background: c.hex }} />))}
            </div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ваши мысли..." className="w-full h-32 md:h-40 bg-stone-50 dark:bg-stone-800 border-none rounded-3xl p-4 md:p-6 outline-none focus:ring-4 ring-amber-500/10 mb-6 md:mb-8 resize-none text-sm md:text-base" autoFocus />
            <div className="flex gap-3 md:gap-4">
              <button onClick={() => setIsAddingNote(false)} className="flex-1 py-3 md:py-4 font-bold text-stone-400 text-xs md:text-sm uppercase tracking-widest">Отмена</button>
              <button onClick={saveNote} disabled={!noteText.trim()} className="flex-1 py-3 md:py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-xl disabled:opacity-30">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const X = ({size}: {size: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
