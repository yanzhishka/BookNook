
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation } from '../types';
import { 
  ChevronLeft, ChevronRight, MessageSquarePlus, Maximize2, Timer, 
  Trash2, Target, Minus, Info,
  Plus as PlusIcon, Type, BookMarked, X, Share, Check, Loader2 
} from 'lucide-react';
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
  { id: 'parchment', name: 'Бумага', bg: 'bg-[#fcfaf7]', text: 'text-stone-900', border: 'border-transparent', dark: false, hex: '#fcfaf7' },
  { id: 'sepia', name: 'Сепия', bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]', border: 'border-transparent', dark: false, hex: '#f4ecd8' },
  { id: 'night', name: 'Ночь', bg: 'bg-[#0c0a09]', text: 'text-stone-300', border: 'border-transparent', dark: true, hex: '#0c0a09' },
  { id: 'solar', name: 'Солярис', bg: 'bg-[#073642]', text: 'text-[#93a1a1]', border: 'border-transparent', dark: true, hex: '#073642' },
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
  user: any; 
  onClose: () => void;
  onUpdateBook: (book: Book) => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, onClose, onUpdateBook, user }) => {
  const [currentPage, setCurrentPage] = useState(book.currentPage || 1);
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
    return saved ? parseInt(saved, 10) : 22;
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

  // Sharing state
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_FAMILY, fontFamily.id);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, currentTheme.id);
  }, [currentTheme]);

  const handlePageChange = useCallback((newPage: number) => {
    const total = book.totalPages || 1;
    const clampedPage = Math.max(1, Math.min(total, newPage));
    
    if (clampedPage === currentPage) return;
    setCurrentPage(clampedPage);
    
    const newProgress = Math.floor((clampedPage / total) * 100);
    let newStatus = book.status;
    if (clampedPage === total) newStatus = 'completed';
    else if (clampedPage > 1) newStatus = 'reading';

    onUpdateBook({
      ...book,
      currentPage: clampedPage,
      progress: newProgress,
      status: newStatus as any
    });
    
    if (textRef.current) {
      textRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  const handleShareNote = async (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    if (sharingId) return;

    setSharingId(ann.id);
    try {
      await db.shareAnnotation(user, book, ann);
      setSharedIds(prev => [...prev, ann.id]);
      setTimeout(() => {
        setSharedIds(prev => prev.filter(id => id !== ann.id));
      }, 3000);
    } catch (error) {
      console.error("Failed to share annotation", error);
    } finally {
      setSharingId(null);
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
            transition-all duration-700 rounded-lg px-2 -mx-2 py-0.5
            ${colorConfig.bg} ${colorConfig.text}
            ${isPulsing ? 'ring-8 animate-pulse' : 'ring-2 shadow-xl'}
            ring-amber-500/20 bg-opacity-90 dark:bg-opacity-50
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
      className={`fixed inset-0 z-[1000] transition-all duration-1000 flex flex-col overflow-hidden ${isZenMode && currentTheme.dark ? 'bg-stone-950' : currentTheme.bg} ${currentTheme.text}`}
    >
      <audio ref={audioRef} loop />
      
      <header className={`h-20 md:h-24 px-6 md:px-16 transition-all duration-1000 shrink-0 z-[100] flex items-center justify-between ${currentTheme.bg} ${isZenMode ? 'opacity-0 -translate-y-full hover:opacity-100 hover:translate-y-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-6">
          <button onClick={onClose} className={`p-4 rounded-full transition-all duration-500 ${currentTheme.dark ? 'hover:bg-white/10' : 'hover:bg-black/5'} hover:scale-110 active:scale-90`}><ChevronLeft size={28} /></button>
          <div className="max-w-[180px] md:max-w-xl">
            <h2 className="font-serif font-black text-lg md:text-2xl truncate leading-tight tracking-tight">{book.title}</h2>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 mt-1.5">{currentPage} / {book.totalPages} СТРАНИЦ</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          {isZenMode && <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-amber-500/10 rounded-full font-mono text-xs text-amber-500 shadow-inner"><Timer size={14}/> {formatTime(focusTime)}</div>}
          
          <div className="flex p-1.5 rounded-[2rem] bg-black/5 dark:bg-white/10 items-center gap-1.5 shadow-inner">
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3.5 rounded-[1.5rem] transition-all duration-500 ${showSettings ? 'bg-amber-500 text-white shadow-xl' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
              >
                <Type size={22} />
              </button>
              
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-[490]" onClick={() => setShowSettings(false)}></div>
                  <div 
                    className="absolute top-24 right-0 w-80 p-8 md:p-10 bg-white dark:bg-[#1a1817] border border-stone-200 dark:border-stone-800 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] animate-scale-in z-[500] text-stone-900 dark:text-stone-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-8">
                      <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-5">
                        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Параметры</span>
                        <button onClick={() => setShowSettings(false)} className="text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"><X size={20}/></button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-stone-400">
                          <span>Размер текста</span>
                          <span className="text-amber-500">{fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-5">
                          <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"><Minus size={16}/></button>
                          <input type="range" min="12" max="42" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-100 dark:bg-stone-800 rounded-full appearance-none" />
                          <button onClick={() => setFontSize(Math.min(42, fontSize + 2))} className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"><PlusIcon size={16}/></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {READER_FONTS.map(f => (
                          <button key={f.id} onClick={() => setFontFamily(f)} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all ${fontFamily.id === f.id ? 'border-amber-500 text-amber-500 bg-amber-500/5 shadow-inner' : 'border-stone-100 dark:border-stone-800 text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'}`} style={{ fontFamily: f.family }}>{f.name}</button>
                        ))}
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex gap-4">
                          {READER_THEMES.map(t => (
                            <button key={t.id} onClick={() => setCurrentTheme(t)} title={t.name} className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-125 ${currentTheme.id === t.id ? 'border-amber-500 scale-125 shadow-lg' : 'border-stone-200 dark:border-stone-800'}`} style={{ backgroundColor: t.hex }} />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-stone-100 dark:border-stone-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Атмосфера</span>
                        <div className="flex gap-3">
                          {AMBIENT_SOUNDS.map(s => (
                            <button key={s.id} onClick={() => setActiveSound(activeSound === s.id ? null : s.id)} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSound === s.id ? 'bg-amber-500 text-white shadow-xl scale-105' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 shadow-sm'}`}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setShowMobileAnnotations(!showMobileAnnotations)}
              className={`md:hidden p-3.5 rounded-[1.5rem] transition-all duration-500 ${showMobileAnnotations ? 'bg-amber-500 text-white shadow-xl' : 'opacity-40 hover:opacity-100'}`}
            >
              <BookMarked size={22} />
            </button>
            <button onClick={() => setIsZenMode(!isZenMode)} className={`p-3.5 rounded-[1.5rem] transition-all duration-500 ${isZenMode ? 'bg-amber-500 text-white shadow-xl' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}><Maximize2 size={22}/></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-1000 ${isZenMode ? 'max-w-5xl mx-auto py-16 md:py-32 px-8 md:px-20' : 'p-8 md:p-24'}`} ref={textRef}>
          <div 
            className="max-w-3xl mx-auto leading-[2.2] md:leading-[2.5] whitespace-pre-line selection:bg-amber-500/30 transition-all duration-1000"
            onMouseUp={handleSelection}
            style={{ 
              fontSize: `${fontSize}px`, 
              fontFamily: fontFamily.family,
              color: isZenMode && currentTheme.dark ? '#d6d3d1' : undefined,
              fontWeight: 400
            }}
          >
            {renderContentWithHighlights()}
          </div>
          
          <div className={`max-w-3xl mx-auto mt-24 flex justify-between items-center transition-all duration-1000 pt-12 pb-48`}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1}
              className={`p-6 rounded-full disabled:opacity-5 hover:scale-110 active:scale-90 transition-all shadow-xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronLeft size={32}/>
            </button>
            <div className="flex flex-col items-center gap-4">
              <span className="text-[11px] font-black opacity-30 uppercase tracking-[0.4em]">{Math.round((currentPage / (book.totalPages || 1)) * 100)}% ЗАВЕРШЕНО</span>
              <div className={`h-2 w-48 md:w-80 rounded-full overflow-hidden shadow-inner ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className="h-full bg-amber-500 transition-all duration-1000 shadow-[0_0_20px_rgba(245,158,11,0.5)]" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }}></div>
              </div>
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= (book.totalPages || 1)}
              className={`p-6 rounded-full disabled:opacity-5 hover:scale-110 active:scale-90 transition-all shadow-xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronRight size={32}/>
            </button>
          </div>
        </main>

        {showMobileAnnotations && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[180] md:hidden transition-opacity duration-700 animate-fade-in" onClick={() => setShowMobileAnnotations(false)}></div>
        )}

        <aside className={`
          fixed md:relative inset-y-0 right-0 w-full sm:w-96 md:w-[450px] ${currentTheme.bg} transition-all duration-700 z-[1001] md:z-[10] flex flex-col shadow-2xl md:shadow-none
          ${showMobileAnnotations ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          ${isZenMode ? 'md:hidden' : ''}
        `}>
          <div className={`p-10 flex justify-between items-center shrink-0`}>
            <div className="flex items-center gap-4">
              <BookMarked size={24} className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
              <h3 className="font-serif font-black text-2xl tracking-tight">Библиотека мыслей</h3>
            </div>
            <button 
              onClick={() => setShowMobileAnnotations(false)} 
              className={`p-3 rounded-full md:hidden transition-all duration-500 ${currentTheme.dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X size={28}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar pb-40">
            {/* Секция с описанием */}
            <div className={`p-8 rounded-[2.5rem] mb-6 animate-fade-in shadow-sm ${currentTheme.dark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'}`}>
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <Info size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest opacity-80">О книге</span>
              </div>
              <p className="text-sm italic leading-relaxed opacity-60 font-serif">
                 {book.content?.slice(0, 800).includes('Описание:') 
                  ? book.content.slice(book.content.indexOf('Описание:') + 9, book.content.indexOf('---') > 0 ? book.content.indexOf('---') : 800)
                  : (book.annotations && book.annotations.length > 0 ? "Используйте выделение текста для создания новых заметок в этом пространстве." : "Выделяйте важные фрагменты текста, чтобы сохранять их как заметки. Они будут храниться здесь вечно.")
                 }
              </p>
            </div>

            {book.annotations?.map((ann, idx) => (
              <div 
                key={ann.id} 
                onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                onMouseLeave={() => setHoveredAnnotationId(null)}
                onClick={() => navigateToAnnotation(ann)}
                className={`
                  p-8 rounded-[3rem] transition-all duration-500 relative group/ann cursor-pointer animate-reveal
                  ${currentTheme.dark ? 'bg-white/[0.05] shadow-lg' : 'bg-white shadow-xl'}
                  ${hoveredAnnotationId === ann.id ? 'scale-[1.03] ring-8 ring-amber-500/5' : ''}
                `}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-inner ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.bg} ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.text}`}>Цитата</span>
                  <div className="flex gap-2 opacity-0 group-hover/ann:opacity-100 transition-all duration-500">
                    <button 
                      onClick={(e) => handleShareNote(e, ann)}
                      disabled={!!sharingId}
                      className="p-2.5 text-stone-300 hover:text-amber-500 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
                      title="В ленту сообщества"
                    >
                      {sharingId === ann.id ? <Loader2 size={16} className="animate-spin" /> : sharedIds.includes(ann.id) ? <Check size={16} /> : <Share size={16} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(ann.id); }} className="p-2.5 text-stone-300 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"><Trash2 size={16}/></button>
                  </div>
                </div>
                <p className="text-sm opacity-50 italic mb-6 line-clamp-4 leading-relaxed font-serif tracking-tight">«{ann.quote}»</p>
                <div className="flex justify-between items-end gap-4">
                  <p className="text-lg font-bold flex-1 leading-snug text-stone-900 dark:text-stone-100 tracking-tight">{ann.comment}</p>
                  <Target size={20} className="opacity-0 group-hover/ann:opacity-60 text-amber-500 shrink-0 transform translate-x-4 group-hover:translate-x-0 transition-all duration-500" />
                </div>
              </div>
            ))}
            {(!book.annotations || book.annotations.length === 0) && (
              <div className="text-center py-24 opacity-20 flex flex-col items-center gap-6">
                <BookMarked size={48} className="animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-[0.3em]">Заметок пока нет</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selection && (
        <div className="fixed z-[2000] animate-scale-in" style={{ top: selection.top - 70, left: selection.left, transform: 'translateX(-50%)' }}>
          <button 
            onClick={() => setIsAddingNote(true)} 
            className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-4.5 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex items-center gap-4 font-black text-xs uppercase tracking-[0.2em] hover:scale-110 active:scale-90 transition-all ring-8 ring-white/10 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-amber-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500 -z-10"></div>
            <MessageSquarePlus size={22} className="group-hover:rotate-12 transition-transform"/> Создать заметку
          </button>
        </div>
      )}

      {isAddingNote && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in" onClick={() => setIsAddingNote(false)}>
          <div className="bg-white dark:bg-stone-900 p-10 md:p-16 rounded-[4rem] w-full max-w-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h3 className="font-serif font-black text-4xl text-stone-900 dark:text-white leading-none tracking-tighter">Фиксация мысли</h3>
              <button onClick={() => setIsAddingNote(false)} className="text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors hover:rotate-90 duration-500"><X size={32}/></button>
            </div>
            
            <div className="bg-stone-50 dark:bg-stone-800/50 p-8 rounded-[2.5rem] mb-10 max-h-40 overflow-y-auto shadow-inner">
              <p className="text-stone-400 italic text-base font-serif leading-relaxed opacity-80">«{selection?.text}»</p>
            </div>

            <div className="flex gap-4 mb-10 overflow-x-auto pb-4 no-scrollbar">
              {ANNOTATION_COLORS.map(c => (
                <button 
                  key={c.name} 
                  onClick={() => setSelectedColor(c)} 
                  className={`w-12 h-12 rounded-full shrink-0 transition-all border-4 shadow-sm ${selectedColor.name === c.name ? 'border-amber-500 scale-125 shadow-amber-500/40' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-110'}`} 
                  style={{ background: c.hex }} 
                />
              ))}
            </div>

            <textarea 
              value={noteText} 
              onChange={e => setNoteText(e.target.value)} 
              placeholder="О чем вы думаете в этот момент?..." 
              className="w-full h-48 bg-stone-50 dark:bg-stone-850 border-none rounded-[2.5rem] p-8 outline-none focus:ring-8 ring-amber-500/10 mb-10 resize-none text-lg text-stone-800 dark:text-stone-100 shadow-inner font-serif italic" 
              autoFocus 
            />

            <div className="flex gap-6">
              <button onClick={() => setIsAddingNote(false)} className="flex-1 py-5 font-black text-stone-400 text-[11px] uppercase tracking-[0.3em] hover:text-stone-900 dark:hover:text-stone-100 transition-colors">Отмена</button>
              <button 
                onClick={saveNote} 
                disabled={!noteText.trim()} 
                className="flex-[2] py-5 px-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
              >
                Сохранить в вечность
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
