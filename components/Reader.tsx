
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Annotation, User } from '../types';
import { ChevronLeft, ChevronRight, Bookmark, MessageSquarePlus, Trash2, Check, Loader2, Maximize2, Minimize2, Volume2, VolumeX, Music, Timer, Type as TypeIcon, Palette } from 'lucide-react';
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
  
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.3);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [focusTime, setFocusTime] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

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
            {book.content?.slice((currentPage - 1) * CHARS_PER_PAGE, currentPage * CHARS_PER_PAGE)}
          </div>
          
          <div className="max-w-3xl mx-auto mt-20 flex justify-between items-center border-t border-stone-200 dark:border-stone-800 pt-10">
            <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber-500 transition-colors"><ChevronLeft size={16}/> Назад</button>
            <div className="flex flex-col items-center gap-2">
              <div className="h-1 w-32 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(currentPage / book.totalPages!) * 100}%` }}></div>
              </div>
            </div>
            <button onClick={() => setCurrentPage(p => Math.min(book.totalPages!, p+1))} className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest text-stone-400 hover:text-amber-500 transition-colors">Вперед <ChevronRight size={16}/></button>
          </div>
        </main>

        {!isZenMode && (
          <aside className="w-96 border-l border-stone-200/50 dark:border-stone-800/50 bg-white dark:bg-stone-900 flex flex-col shrink-0 animate-slide-in-right">
            <div className="p-8 border-b border-stone-100 dark:border-stone-800"><h3 className="font-serif font-black text-xl">Заметки</h3></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {book.annotations?.map(ann => (
                <div key={ann.id} className="p-6 rounded-[2rem] bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full mb-3 inline-block bg-${ann.color}-200/50 text-${ann.color}-900`}>Цитата</span>
                  <p className="text-xs text-stone-400 italic mb-4 line-clamp-3">«{ann.quote}»</p>
                  <p className="text-sm font-medium">{ann.comment}</p>
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
