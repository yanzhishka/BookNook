
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
      
      <header className={`h-16 md:h-20 px-4 md:px-10 border-b ${currentTheme.border} ${currentTheme.bg} flex items-center justify-between shrink-0 z-[100] transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onClose} className={`p-2 rounded-2xl transition-all ${currentTheme.dark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><ChevronLeft size={24} /></button>
          <div className="max-w-[150px] md:max-w-md">
            <h2 className="font-serif font-black text-sm md:text-xl truncate leading-none">{book.title}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{currentPage} / {book.totalPages}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {isZenMode && <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full font-mono text-[10px] text-amber-500"><Timer size={12}/> {formatTime(focusTime)}</div>}
          
          <div className="flex p-1 rounded-2xl bg-black/5 dark:bg-white/5 items-center gap-1">
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-amber-500 text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}
              >
                <Type size={20} />
              </button>
              
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-[490]" onClick={() => setShowSettings(false)}></div>
                  <div 
                    className="fixed top-20 right-4 md:right-10 w-72 md:w-80 p-6 md:p-8 bg-[#1a1817] border border-stone-800 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] animate-scale-in z-[500] text-stone-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-stone-800 pb-4 mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Настройки</span>
                        <button onClick={() => setShowSettings(false)} className="text-stone-500 hover:text-white"><X size={16}/></button>
                      </div>

                      <div>
                        <div className="flex justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-stone-500">
                          <span>Шрифт</span>
                          <span className="text-amber-500">{fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="p-2 bg-stone-800/50 rounded-xl hover:bg-stone-700 transition-colors"><Minus size={14}/></button>
                          <input type="range" min="12" max="42" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none" />
                          <button onClick={() => setFontSize(Math.min(42, fontSize + 2))} className="p-2 bg-stone-800/50 rounded-xl hover:bg-stone-700 transition-colors"><PlusIcon size={14}/></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {READER_FONTS.map(f => (
                          <button key={f.id} onClick={() => setFontFamily(f)} className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${fontFamily.id === f.id ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-stone-800 text-stone-400 hover:border-stone-600'}`} style={{ fontFamily: f.family }}>{f.name}</button>
                        ))}
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {READER_THEMES.map(t => (
                          <button key={t.id} onClick={() => setCurrentTheme(t)} title={t.name} className={`w-full aspect-square rounded-full border-2 transition-all hover:scale-110 ${currentTheme.id === t.id ? 'border-amber-500 scale-110' : 'border-stone-800'}`} style={{ backgroundColor: t.hex }} />
                        ))}
                      </div>

                      <div className="bg-stone-900/50 p-3 rounded-2xl border border-stone-800/50">
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-2 block">Звуки</span>
                        <div className="flex gap-2">
                          {AMBIENT_SOUNDS.map(s => (
                            <button key={s.id} onClick={() => setActiveSound(activeSound === s.id ? null : s.id)} className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${activeSound === s.id ? 'bg-amber-500 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300 bg-stone-800/30'}`}>{s.label}</button>
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
              className={`md:hidden p-2.5 rounded-xl transition-all ${showMobileAnnotations ? 'bg-amber-500 text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}
            >
              <BookMarked size={20} />
            </button>
            <button onClick={() => setIsZenMode(!isZenMode)} className={`p-2.5 rounded-xl transition-all ${isZenMode ? 'bg-amber-500 text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}><Maximize2 size={20}/></button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-700 ${isZenMode ? 'max-w-4xl mx-auto py-12 md:py-20 px-6 md:px-12' : 'p-6 md:p-16'}`} ref={textRef}>
          <div 
            className="max-w-2xl mx-auto leading-[2] md:leading-[2.2] whitespace-pre-line selection:bg-amber-500/30 transition-all duration-500"
            onMouseUp={handleSelection}
            style={{ 
              fontSize: `${fontSize}px`, 
              fontFamily: fontFamily.family,
              color: isZenMode && currentTheme.dark ? '#a8a29e' : undefined 
            }}
          >
            {renderContentWithHighlights()}
          </div>
          
          <div className={`max-w-2xl mx-auto mt-16 flex justify-between items-center border-t ${currentTheme.border} pt-8 pb-32`}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1}
              className={`p-5 rounded-2xl disabled:opacity-10 hover:scale-110 active:scale-95 transition-all shadow-sm ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronLeft size={28}/>
            </button>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">{Math.round((currentPage / (book.totalPages || 1)) * 100)}% Прочитано</span>
              <div className={`h-1.5 w-32 md:w-48 rounded-full overflow-hidden ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className="h-full bg-amber-500 transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }}></div>
              </div>
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= (book.totalPages || 1)}
              className={`p-5 rounded-2xl disabled:opacity-10 hover:scale-110 active:scale-95 transition-all shadow-sm ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronRight size={28}/>
            </button>
          </div>
        </main>

        {showMobileAnnotations && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[180] md:hidden transition-opacity duration-500 animate-fade-in" onClick={() => setShowMobileAnnotations(false)}></div>
        )}

        <aside className={`
          fixed md:relative inset-y-0 right-0 w-80 md:w-96 ${currentTheme.bg} border-l ${currentTheme.border} 
          transition-transform duration-500 z-[190] md:z-[10] flex flex-col shadow-2xl md:shadow-none
          ${showMobileAnnotations ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          ${isZenMode ? 'md:hidden' : ''}
        `}>
          <div className={`p-8 border-b ${currentTheme.border} flex justify-between items-center shrink-0`}>
            <div className="flex items-center gap-3">
              <BookMarked size={20} className="text-amber-500" />
              <h3 className="font-serif font-black text-xl opacity-80">Инфо и заметки</h3>
            </div>
            <button 
              onClick={() => setShowMobileAnnotations(false)} 
              className={`p-2 rounded-xl md:hidden ${currentTheme.dark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
            >
              <X size={24}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
            {/* Секция с описанием */}
            <div className={`p-6 rounded-3xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'} border border-transparent mb-4 animate-fade-in`}>
              <div className="flex items-center gap-2 mb-3 text-amber-500">
                <Info size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Описание и детали</span>
              </div>
              <p className="text-xs italic leading-relaxed opacity-60 font-serif">
                 {book.content?.slice(0, 500).includes('Описание:') 
                  ? book.content.slice(book.content.indexOf('Описание:') + 9, book.content.indexOf('---') > 0 ? book.content.indexOf('---') : 500)
                  : (book.annotations && book.annotations.length > 0 ? "Смотрите ваши заметки ниже." : "Выделяйте важные фрагменты текста, чтобы сохранять их как заметки.")
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
                  p-6 rounded-[2.5rem] border transition-all duration-300 relative group/ann cursor-pointer animate-fade-in-up
                  ${currentTheme.dark ? 'bg-white/5 border-transparent' : 'bg-black/5 border-transparent'}
                  ${hoveredAnnotationId === ann.id ? 'border-amber-500/40 shadow-xl scale-[1.02] bg-opacity-100 ring-4 ring-amber-500/5' : ''}
                `}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.bg} ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.text}`}>Цитата</span>
                  <div className="flex gap-1 opacity-0 group-hover/ann:opacity-100 transition-all">
                    <button 
                      onClick={(e) => handleShareNote(e, ann)}
                      disabled={!!sharingId}
                      className="p-2 text-stone-300 hover:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/10"
                      title="Опубликовать в ленту"
                    >
                      {sharingId === ann.id ? <Loader2 size={14} className="animate-spin" /> : sharedIds.includes(ann.id) ? <Check size={14} /> : <Share size={14} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(ann.id); }} className="p-2 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"><Trash2 size={14}/></button>
                  </div>
                </div>
                <p className="text-xs opacity-40 italic mb-4 line-clamp-3 leading-relaxed font-serif">«{ann.quote}»</p>
                <div className="flex justify-between items-end gap-3">
                  <p className="text-sm font-bold flex-1 leading-snug">{ann.comment}</p>
                  <Target size={16} className="opacity-0 group-hover/ann:opacity-60 text-amber-500 shrink-0" />
                </div>
              </div>
            ))}
            {(!book.annotations || book.annotations.length === 0) && (
              <div className="text-center py-10 opacity-20 flex flex-col items-center gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Заметок пока нет</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {selection && (
        <div className="fixed z-[250] animate-scale-in" style={{ top: selection.top - 60, left: selection.left, transform: 'translateX(-50%)' }}>
          <button 
            onClick={() => setIsAddingNote(true)} 
            className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-3.5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center gap-3 font-black text-[10px] uppercase tracking-widest hover:scale-110 active:scale-95 transition-all ring-4 ring-white/10"
          >
            <MessageSquarePlus size={18}/> Создать заметку
          </button>
        </div>
      )}

      {isAddingNote && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in" onClick={() => setIsAddingNote(false)}>
          <div className="bg-white dark:bg-stone-900 p-8 md:p-12 rounded-[3rem] w-full max-w-lg shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-serif font-black text-3xl text-stone-900 dark:text-white leading-none">Новая заметка</h3>
              <button onClick={() => setIsAddingNote(false)} className="text-stone-300 hover:text-stone-600 dark:hover:text-stone-100"><X size={24}/></button>
            </div>
            
            <div className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-3xl border border-stone-100 dark:border-stone-800 mb-8 max-h-32 overflow-y-auto">
              <p className="text-stone-400 italic text-sm font-serif leading-relaxed">«{selection?.text}»</p>
            </div>

            <div className="flex gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
              {ANNOTATION_COLORS.map(c => (
                <button 
                  key={c.name} 
                  onClick={() => setSelectedColor(c)} 
                  className={`w-10 h-10 rounded-full shrink-0 transition-all border-4 ${selectedColor.name === c.name ? 'border-amber-500 scale-110 shadow-lg shadow-amber-500/20' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                  style={{ background: c.hex }} 
                />
              ))}
            </div>

            <textarea 
              value={noteText} 
              onChange={e => setNoteText(e.target.value)} 
              placeholder="О чем вы думаете?..." 
              className="w-full h-40 bg-stone-50 dark:bg-stone-800 border-none rounded-3xl p-6 outline-none focus:ring-4 ring-amber-500/10 mb-8 resize-none text-base text-stone-700 dark:text-stone-200 shadow-inner" 
              autoFocus 
            />

            <div className="flex gap-4">
              <button onClick={() => setIsAddingNote(false)} className="flex-1 py-4 font-bold text-stone-400 text-xs uppercase tracking-widest hover:text-stone-600 dark:hover:text-stone-200 transition-colors">Отмена</button>
              <button 
                onClick={saveNote} 
                disabled={!noteText.trim()} 
                className="flex-2 py-4 px-8 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
              >
                Сохранить мысль
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
