
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User } from '../types';
import { ChevronLeft, ChevronRight, MessageSquarePlus, Maximize2, Timer, Trash2, Share2, Loader2, Check, Target, Settings2, Minus, Plus as PlusIcon, Type } from 'lucide-react';
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
      <header className={`h-20 px-10 border-b ${currentTheme.border} flex items-center justify-between transition-opacity duration-500 z-50 ${isZenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center gap-6">
          <button onClick={onClose} className={`p-3 rounded-2xl transition-all ${currentTheme.dark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}><ChevronLeft size={24} /></button>
          <div>
            <h2 className="font-serif font-black text-xl truncate max-w-xs">{book.title}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{currentPage} / {book.totalPages}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isZenMode && <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl font-mono text-xs text-amber-500"><Timer size={14}/> {formatTime(focusTime)}</div>}
          
          {/* Typography Settings Button */}
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-3 rounded-2xl transition-all ${showSettings ? 'bg-amber-500 text-white' : currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <Type size={20} />
            </button>
            
            {showSettings && (
              <div className="absolute top-full right-0 mt-4 w-80 p-8 bg-[#1a1817] dark:bg-[#1a1817] border border-stone-800 rounded-[2.5rem] shadow-2xl animate-scale-in z-50 text-stone-100">
                <div className="space-y-8">
                  {/* Font Size */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-6 block">Размер</span>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setFontSize(Math.max(12, fontSize - 2))} 
                        className="p-3 bg-stone-800/50 rounded-2xl hover:bg-stone-700 transition-all text-stone-300"
                      >
                        <Minus size={16}/>
                      </button>
                      <div className="flex-1 relative flex items-center h-8">
                         <input 
                          type="range" 
                          min="12" 
                          max="42" 
                          value={fontSize} 
                          onChange={(e) => setFontSize(parseInt(e.target.value))} 
                          className="w-full accent-amber-500 h-1 cursor-pointer bg-stone-700 rounded-lg appearance-none" 
                        />
                        <div 
                          className="absolute w-4 h-4 bg-amber-500 rounded-full shadow-lg pointer-events-none" 
                          style={{ left: `calc(${(fontSize - 12) / (42 - 12) * 100}% - 8px)` }} 
                        />
                      </div>
                      <button 
                        onClick={() => setFontSize(Math.min(42, fontSize + 2))} 
                        className="p-3 bg-stone-800/50 rounded-2xl hover:bg-stone-700 transition-all text-stone-300"
                      >
                        <PlusIcon size={16}/>
                      </button>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-4 block">Шрифт</span>
                    <div className="grid grid-cols-3 gap-3">
                      {READER_FONTS.map(f => (
                        <button 
                          key={f.id} 
                          onClick={() => setFontFamily(f)}
                          className={`py-3 rounded-2xl text-sm font-bold border transition-all ${fontFamily.id === f.id ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-stone-800 bg-stone-800/30 text-stone-400'}`}
                          style={{ fontFamily: f.family }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Themes */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-4 block">Тема</span>
                    <div className="grid grid-cols-4 gap-4">
                      {READER_THEMES.map(t => (
                        <button 
                          key={t.id} 
                          onClick={() => setCurrentTheme(t)}
                          title={t.name}
                          className={`w-full aspect-square rounded-full border-4 transition-all hover:scale-110 shadow-lg ${currentTheme.id === t.id ? 'border-amber-500 scale-110' : 'border-stone-800'}`}
                          style={{ backgroundColor: t.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`flex p-1 rounded-2xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}>
            {AMBIENT_SOUNDS.map(s => (
              <button key={s.id} onClick={() => setActiveSound(activeSound === s.id ? null : s.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeSound === s.id ? 'bg-amber-500 text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}>{s.label}</button>
            ))}
          </div>
          <button onClick={() => setIsZenMode(!isZenMode)} className={`p-3 rounded-2xl transition-all ${isZenMode ? 'bg-amber-500 text-white' : currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}><Maximize2 size={20}/></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex relative">
        <main className={`flex-1 overflow-y-auto custom-scrollbar transition-all duration-1000 ${isZenMode ? 'max-w-4xl mx-auto py-24 px-16' : 'p-12 md:p-20'}`} ref={textRef}>
          <div 
            className="max-w-3xl mx-auto leading-[2.2] whitespace-pre-line selection:bg-amber-500/20 transition-all duration-500"
            onMouseUp={handleSelection}
            style={{ 
              fontSize: `${fontSize}px`, 
              fontFamily: fontFamily.family,
              color: isZenMode && currentTheme.dark ? '#a8a29e' : undefined 
            }}
          >
            {renderContentWithHighlights()}
          </div>
          
          <div className={`max-w-3xl mx-auto mt-20 flex justify-between items-center border-t ${currentTheme.border} pt-10 pb-20`}>
            <button 
              onClick={() => handlePageChange(currentPage - 1)} 
              disabled={currentPage <= 1}
              className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-amber-500 transition-all disabled:opacity-10"
            >
              <ChevronLeft size={16}/> Назад
            </button>
            <div className="flex flex-col items-center gap-2">
              <div className={`h-1 w-32 rounded-full overflow-hidden ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}>
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(currentPage / (book.totalPages || 1)) * 100}%` }}></div>
              </div>
            </div>
            <button 
              onClick={() => handlePageChange(currentPage + 1)} 
              disabled={currentPage >= (book.totalPages || 1)}
              className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-amber-500 transition-all disabled:opacity-10"
            >
              Вперед <ChevronRight size={16}/>
            </button>
          </div>
        </main>

        {!isZenMode && (
          <aside className={`w-96 border-l ${currentTheme.border} transition-colors flex flex-col shrink-0 animate-slide-in-right overflow-hidden`}>
            <div className="p-8 border-b opacity-50 flex justify-between items-center">
              <h3 className="font-serif font-black text-xl">Заметки</h3>
              <div className="text-[10px] font-black uppercase">{book.annotations?.length || 0} шт.</div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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
                  
                  <p className="text-xs opacity-50 italic mb-4 line-clamp-3 leading-relaxed">«{ann.quote}»</p>
                  <div className="flex justify-between items-end">
                    <p className="text-sm font-medium flex-1">{ann.comment}</p>
                    <Target size={14} className="opacity-20 group-hover:opacity-100 group-hover:text-amber-500 transition-colors ml-2" />
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
