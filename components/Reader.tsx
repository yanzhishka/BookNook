
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Book, Annotation, User } from '../types';
import {
  ChevronLeft, ChevronRight, MessageSquarePlus,
  Trash2, Target, Minus, Info,
  Plus as PlusIcon, Type, BookMarked, X, Share, Check, Loader2, List, CornerDownLeft
} from 'lucide-react';
import { ErrorNotice } from './ErrorNotice';
import styles from './Reader.module.css';
import { EpubContent, ReaderDialog } from './reader/EpubContent';
import { findTextRange, isEpubDocument, textDocument } from '../services/epub/document';
import { ANNOTATION_COLORS, useReaderAnnotations } from './reader/useReaderAnnotations';
import { useReaderProgress } from './reader/useReaderProgress';
import { useReaderNavigation } from './reader/useReaderNavigation';

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 42;
const ReaderContent = React.memo(EpubContent);

const STORAGE_KEYS = {
  FONT_SIZE: 'bnook_reader_font_size',
  FONT_FAMILY: 'bnook_reader_font_family',
  THEME: 'bnook_reader_theme',
};

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
  user: User;
  onClose: () => void;
  onUpdateBook: (book: Book) => Promise<void>;
  onSaveAnnotation: (annotation: Annotation) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  onActivitySaved: () => Promise<void>;
}

export const Reader: React.FC<ReaderProps> = ({ book, onClose, onUpdateBook, onSaveAnnotation, onDeleteAnnotation, onActivitySaved, user }) => {
  const epub = useMemo(() => isEpubDocument(book.document) ? book.document : undefined, [book.document]);
  const document = useMemo(() => epub || textDocument(book.content || 'Текст книги пока не добавлен.', book.title, book.author), [epub, book.content, book.title, book.author]);
  const progress = useReaderProgress(book, onUpdateBook);
  const { isSaving, saveError, savingRef } = progress;
  const [selection, setSelection] = useState<{ text: string; top: number; bottom: number; left: number } | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
    const size = saved ? Number(saved) : 22;
    return Number.isFinite(size) ? Math.round(Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size)) * 10) / 10 : 22;
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

  const [activeSound, setActiveSound] = useState<string | null>(null);
  const volume = 0.3;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const fontMotionRef = useRef<HTMLDivElement>(null);
  const fontAnimationRef = useRef<Animation | null>(null);
  const previousFontSize = useRef(fontSize);
  const visibleFontSize = useRef(fontSize);
  const selectionActionRef = useRef<HTMLDivElement>(null);
  const onPageChanged = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);
  const { screen, currentPage, totalPages, showToc, setShowToc, footnote, setFootnote,
    pageDraft, setPageDraft, pageNumberRef, handlePageChange, submitPageNumber,
    handleBookPointerDown, handleBookPointerMove, cancelBookPress, cancelPageClick, handleBookClick,
    goToBlock, navigateEpub, onContentNavigate, handleContentFocus } = useReaderNavigation({
      book, document, epub, viewportRef, flowRef, fontSize, fontFamily: fontFamily.id,
      blocked: showSettings || isAddingNote || showMobileAnnotations, progress, onPageChanged,
    });
  useLayoutEffect(() => {
    const motion = fontMotionRef.current;
    const scale = motion ? new DOMMatrixReadOnly(getComputedStyle(motion).transform).a : 1;
    visibleFontSize.current = previousFontSize.current * scale;
    fontAnimationRef.current?.cancel();
  }, [fontSize]);
  useLayoutEffect(() => {
    const motion = fontMotionRef.current;
    const from = visibleFontSize.current / fontSize;
    previousFontSize.current = fontSize;
    if (!motion || Math.abs(from - 1) < 0.001 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Repaginate once at the final size, then animate the clipped visible spread
    // on the compositor instead of typesetting the whole EPUB on every frame.
    fontAnimationRef.current = motion.animate([
      { transform: `scale(${from})`, opacity: 0.88 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  }, [fontSize]);
  useLayoutEffect(() => () => fontAnimationRef.current?.cancel(), []);
  useLayoutEffect(() => {
    const action = selectionActionRef.current;
    if (!action || !selection) return;
    const { width, height } = action.getBoundingClientRect();
    const margin = 12;
    const minimumTop = Math.max(margin, viewportRef.current?.getBoundingClientRect().top || margin);
    const above = selection.top - height - 8;
    const top = above >= minimumTop ? above : selection.bottom + 8;
    action.style.top = `${Math.max(margin, Math.min(window.innerHeight - height - margin, top))}px`;
    action.style.left = `${Math.max(margin, Math.min(window.innerWidth - width - margin, selection.left - width / 2))}px`;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FONT_FAMILY, fontFamily.id);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, currentTheme.id);
  }, [currentTheme]);

  useEffect(() => {
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => { window.document.body.style.overflow = previous; };
  }, []);

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

  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && sel.toString().trim() && viewportRef.current &&
      flowRef.current?.contains(sel.anchorNode) && flowRef.current.contains(sel.focusNode)) {
      const range = sel.getRangeAt(0);
      const viewport = viewportRef.current.getBoundingClientRect();
      const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height &&
        rect.right > viewport.left && rect.left < viewport.right && rect.bottom > viewport.top && rect.top < viewport.bottom);
      const rect = rects[0];
      if (!rect) { setSelection(null); return; }
      setSelection({
        text: sel.toString(),
        top: Math.max(viewport.top, Math.min(...rects.map(rect => rect.top))),
        bottom: Math.min(viewport.bottom, Math.max(...rects.map(rect => rect.bottom))),
        left: (Math.max(viewport.left, rect.left) + Math.min(viewport.right, rect.right)) / 2,
      });
    } else {
      setSelection(null);
    }
  };

  const { noteText, setNoteText, selectedColor, setSelectedColor, sharingId, sharedIds,
    startNote, saveNote, handleDeleteNote, handleShareNote } = useReaderAnnotations({
      book, user, quote: selection?.text, progress, onSaveAnnotation, onDeleteAnnotation, onActivitySaved,
      onSaved: () => { setIsAddingNote(false); setSelection(null); },
    });

  const navigateToAnnotation = (ann: Annotation) => {
    if (!book.content || !ann.quote) return;
    const range = findTextRange(book.content, ann.quote);
    if (!range) return;
    void handlePageChange(screen.pageForOffset(range.start) + 1, range.start);
    setActiveAnnotationId(ann.id);
    setHoveredAnnotationId(ann.id);
    setShowMobileAnnotations(false);
    setTimeout(() => setActiveAnnotationId(null), 2000);
  };

  const contentHighlight = useMemo(() => {
    const annotation = book.annotations?.find(item => item.id === (hoveredAnnotationId || activeAnnotationId));
    return annotation ? { quote: annotation.quote, color: (ANNOTATION_COLORS.find(item => item.name === annotation.color) || ANNOTATION_COLORS[0]).hex } : undefined;
  }, [book.annotations, hoveredAnnotationId, activeAnnotationId]);

  return (
    <div
      ref={containerRef}
      className={`${styles.reader} fixed inset-0 z-[1000] transition-colors duration-300 flex flex-col overflow-hidden ${currentTheme.bg} ${currentTheme.text}`}
    >
      <audio ref={audioRef} loop />
      {saveError && !isAddingNote && <div className={styles.saveNotice}><ErrorNotice message={saveError} /></div>}

      <header className={`${styles.header} ${currentTheme.bg}`}>
        <div className={styles.heading}>
          <button aria-label="Закрыть читалку" disabled={isSaving} onClick={onClose} className={`p-2.5 rounded-full transition-all duration-500 ${currentTheme.dark ? 'hover:bg-white/10' : 'hover:bg-black/5'} hover:scale-110 active:scale-90`}><ChevronLeft size={28} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif font-black text-lg md:text-2xl truncate leading-tight tracking-tight">{book.title}</h2>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] opacity-60 mt-1.5">{screen.ready ? `Страница ${currentPage} / ${totalPages}` : 'Подготавливаем страницы…'}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <div className="flex p-1 rounded-2xl bg-black/5 dark:bg-white/10 items-center gap-1 shadow-inner">
            {epub && <button aria-label="Оглавление" onClick={() => setShowToc(true)} className="p-2.5 rounded-xl opacity-70 hover:opacity-100"><List size={22} /></button>}
            <div className="relative">
              <button
                aria-label="Настройки чтения"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2.5 rounded-xl transition-all duration-500 ${showSettings ? 'bg-amber-500 text-white shadow-xl' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
              >
                <Type size={22} />
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-[490]" onClick={() => setShowSettings(false)}></div>
                  <div
                    className={`${styles.settings} bg-white dark:bg-[#1a1817] border border-stone-200 dark:border-stone-800 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] animate-scale-in text-stone-900 dark:text-stone-100`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-8">
                      <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-5">
                        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Параметры</span>
                        <button aria-label="Закрыть настройки" onClick={() => setShowSettings(false)} className="text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"><X size={20}/></button>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-stone-400">
                          <label htmlFor="reader-font-size">Размер текста</label>
                          <output htmlFor="reader-font-size" className={styles.fontSizeValue}>{fontSize.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} px</output>
                        </div>
                        <div className="flex items-center gap-5">
                          <button type="button" aria-label="Уменьшить размер текста" disabled={fontSize <= MIN_FONT_SIZE} onClick={() => setFontSize(size => Math.max(MIN_FONT_SIZE, Math.round((size - 1) * 10) / 10))} className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-30"><Minus size={16}/></button>
                          <input id="reader-font-size" type="range" min={MIN_FONT_SIZE} max={MAX_FONT_SIZE} step="0.1" value={fontSize} onChange={(e) => setFontSize(e.currentTarget.valueAsNumber)} className="min-w-0 flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-100 dark:bg-stone-800 rounded-full appearance-none" />
                          <button type="button" aria-label="Увеличить размер текста" disabled={fontSize >= MAX_FONT_SIZE} onClick={() => setFontSize(size => Math.min(MAX_FONT_SIZE, Math.round((size + 1) * 10) / 10))} className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-30"><PlusIcon size={16}/></button>
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
              aria-label="Открыть заметки"
              onClick={() => setShowMobileAnnotations(!showMobileAnnotations)}
              className={`p-2.5 rounded-xl transition-colors ${showMobileAnnotations ? 'bg-amber-500 text-white shadow-xl' : 'opacity-40 hover:opacity-100'}`}
            >
              <BookMarked size={22} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.content}>
          <div ref={viewportRef} className={styles.pageViewport} data-reader-viewport="true" data-reading-offset={screen.offset} data-screen-page={currentPage} data-screen-count={totalPages} aria-busy={!screen.ready}
            onMouseUp={handleSelection}
            onPointerDown={handleBookPointerDown}
            onPointerMove={handleBookPointerMove}
            onPointerCancel={cancelBookPress}
            onDragStart={cancelBookPress}
            onDoubleClick={cancelPageClick}
            onClick={handleBookClick}
            style={{
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily.family,
              fontWeight: 400
            }}
          >
            <div ref={fontMotionRef} className={styles.pageMotion} data-reader-font-motion="true">
              <div ref={flowRef} className={styles.pageFlow} data-reader-flow="true"
                style={{ transform: screen.transform, visibility: screen.ready ? 'visible' : 'hidden' }}
                onFocusCapture={handleContentFocus}>
              <ReaderContent paginated document={document} blocks={document.blocks} onNavigate={onContentNavigate} highlight={contentHighlight} />
              </div>
            </div>
          </div>

          <nav className={styles.pagination} aria-label="Перелистывание страниц">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              aria-label="Предыдущая страница" disabled={isSaving || !screen.ready || currentPage <= 1}
              className={`p-6 rounded-full disabled:opacity-5 hover:scale-110 active:scale-90 transition-all shadow-xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronLeft size={24}/>
            </button>
            <div className={styles.pagePosition}>
              <form className={styles.pageJump} onSubmit={submitPageNumber} noValidate
                onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPageDraft(null); }}>
                <input ref={pageNumberRef} type="text" inputMode="numeric" enterKeyHint="go" maxLength={10}
                  aria-label="Номер страницы" title={`Введите номер от 1 до ${totalPages} и нажмите Enter`}
                  className={styles.pageNumber} value={pageDraft ?? String(currentPage)} readOnly={isSaving || !screen.ready}
                  onFocus={event => { cancelPageClick(); event.currentTarget.select(); }}
                  onChange={event => setPageDraft(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Escape') { setPageDraft(null); event.currentTarget.blur(); } }} />
                <span className={styles.pageTotal}>/ {totalPages}</span>
                <button type="submit" className={styles.pageGo} aria-label="Перейти к странице" title="Перейти (Enter)" disabled={isSaving || !screen.ready}>
                  <CornerDownLeft size={16} aria-hidden="true" />
                </button>
              </form>
              <div className={styles.pageProgress}>
                <div className={`h-1 flex-1 rounded-full overflow-hidden ${currentTheme.dark ? 'bg-white/10' : 'bg-black/10'}`}>
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${book.progress}%` }}></div>
                </div>
                <span>{book.progress}%</span>
              </div>
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              aria-label="Следующая страница" disabled={isSaving || !screen.ready || currentPage >= totalPages}
              className={`p-6 rounded-full disabled:opacity-5 hover:scale-110 active:scale-90 transition-all shadow-xl ${currentTheme.dark ? 'bg-white/5' : 'bg-black/5'}`}
            >
              <ChevronRight size={24}/>
            </button>
          </nav>
        </main>

        {showMobileAnnotations && (
          <div className="fixed inset-0 bg-black/50 z-[1000]" onClick={() => setShowMobileAnnotations(false)}></div>
        )}

        <aside className={`
          fixed inset-y-0 right-0 w-full sm:w-96 shrink-0 min-w-0 ${currentTheme.bg} transition-transform duration-300 z-[1001] flex flex-col shadow-2xl
          ${showMobileAnnotations ? 'translate-x-0' : 'translate-x-full invisible'}
        `}>
          <div className="p-5 flex justify-between items-center gap-3 shrink-0">
            <div className="min-w-0 flex items-center gap-3">
              <BookMarked size={24} className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
              <h3 className="font-serif font-black text-2xl tracking-tight">Библиотека мыслей</h3>
            </div>
            <button
              onClick={() => setShowMobileAnnotations(false)}
              aria-label="Закрыть заметки" className={`p-3 shrink-0 rounded-full ${currentTheme.dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X size={28}/>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-8">
            {/* Секция с описанием */}
            <div className={`p-5 rounded-[2rem] mb-6 animate-fade-in shadow-sm ${currentTheme.dark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'}`}>
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
                  p-5 rounded-[2rem] transition-all duration-500 relative group/ann cursor-pointer animate-reveal
                  ${currentTheme.dark ? 'bg-white/[0.05] shadow-lg' : 'bg-white shadow-xl'}
                  ${hoveredAnnotationId === ann.id ? 'scale-[1.03] ring-8 ring-amber-500/5' : ''}
                `}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-inner ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.bg} ${ANNOTATION_COLORS.find(c => c.name === ann.color)?.text}`}>Цитата</span>
                  <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover/ann:opacity-100 md:group-focus-within/ann:opacity-100 transition-all duration-500">
                    <button
                      onClick={(e) => handleShareNote(e, ann)}
                      disabled={isSaving || !!sharingId}
                      className="p-2.5 text-stone-300 hover:text-amber-500 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
                      title="Опубликовать в The Grid"
                    >
                      {sharingId === ann.id ? <Loader2 size={16} className="animate-spin" /> : sharedIds.includes(ann.id) ? <Check size={16} /> : <Share size={16} />}
                    </button>
                    <button aria-label="Удалить заметку" disabled={isSaving} onClick={(e) => { e.stopPropagation(); void handleDeleteNote(ann.id); }} className="p-2.5 text-stone-300 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"><Trash2 size={16}/></button>
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

      {epub && showToc && <ReaderDialog title="Оглавление" onClose={() => setShowToc(false)} background={currentTheme.hex} color={currentTheme.dark ? '#d6d3d1' : '#292524'}>
        <nav aria-label="Главы книги" className="flex flex-col gap-2">{epub.toc.map(item => <button key={item.blockId} disabled={isSaving} className="text-left p-3 rounded-xl hover:bg-amber-500/10" onClick={() => void goToBlock(item.blockId)}>{item.label}</button>)}</nav>
        <p className="text-sm opacity-60 mt-5">Страницы подстраиваются под экран и размер шрифта. При повороте экрана место чтения сохраняется. Номера не совпадают с печатным изданием.</p>
        {epub.warnings.map(warning => <p key={warning} className="text-sm mt-3">{warning}</p>)}
      </ReaderDialog>}
      {epub && footnote && epub.notes[footnote] && <ReaderDialog title={`Сноска ${epub.notes[footnote].label}`} onClose={() => setFootnote(null)} background={currentTheme.hex} color={currentTheme.dark ? '#d6d3d1' : '#292524'}>
        <EpubContent document={epub} blocks={[{ id: 'footnote', kind: 'paragraph', source: '', start: 0, text: epub.notes[footnote].text, children: epub.notes[footnote].children }]} onNavigate={navigateEpub} />
      </ReaderDialog>}

      {selection && !isAddingNote && !showToc && !footnote && (
        <div ref={selectionActionRef} className={styles.selectionAction} data-dark={currentTheme.dark}>
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => { startNote(); setIsAddingNote(true); }}
            className={styles.selectionButton}
          >
            <MessageSquarePlus size={20} aria-hidden="true" />
            <span>Создать заметку</span>
          </button>
        </div>
      )}

      {isAddingNote && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in" onClick={() => { if (!savingRef.current) setIsAddingNote(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="reader-note-title" className={`${styles.noteDialog} bg-white dark:bg-stone-900 rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] animate-scale-in`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center gap-3 mb-6">
              <h3 id="reader-note-title" className="font-serif font-black text-2xl sm:text-3xl text-stone-900 dark:text-white leading-none tracking-tighter">Фиксация мысли</h3>
              <button onClick={() => { if (!savingRef.current) setIsAddingNote(false); }} className="text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors hover:rotate-90 duration-500"><X size={32}/></button>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl mb-6 max-h-40 overflow-y-auto shadow-inner">
              <p className="text-stone-400 italic text-base font-serif leading-relaxed opacity-80">«{selection?.text}»</p>
            </div>

            <div className="flex flex-wrap gap-4 mb-6 p-2">
              {ANNOTATION_COLORS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setSelectedColor(c)}
                  className={`w-12 h-12 rounded-full shrink-0 transition-all border-4 shadow-sm ${selectedColor.name === c.name ? 'border-amber-500 scale-125 shadow-amber-500/40' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-110'}`}
                  style={{ background: c.hex }}
                />
              ))}
            </div>

            {saveError && <ErrorNotice message={saveError} />}
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="О чем вы думаете в этот момент?..."
              className="w-full h-32 sm:h-48 bg-stone-50 dark:bg-stone-850 border-none rounded-2xl p-4 outline-none focus:ring-4 ring-amber-500/10 mb-6 resize-none text-lg text-stone-800 dark:text-stone-100 shadow-inner font-serif italic"
              autoFocus
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => { if (!savingRef.current) setIsAddingNote(false); }} className="flex-1 py-5 font-black text-stone-400 text-[11px] uppercase tracking-[0.3em] hover:text-stone-900 dark:hover:text-stone-100 transition-colors">Отмена</button>
              <button
                onClick={saveNote}
                disabled={isSaving || !noteText.trim()}
                className="min-w-0 flex-[2] py-4 px-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-[2.5rem] font-black uppercase text-xs tracking-widest shadow-2xl disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
              >
                {isSaving ? 'Сохраняем…' : 'Сохранить заметку'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
