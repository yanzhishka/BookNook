import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent, type FocusEvent, type RefObject } from 'react';
import type { Book } from '../../types';
import type { EpubDocument } from '../../services/epub/document';
import type { useReaderProgress } from './useReaderProgress';
import { useScreenPages } from './useScreenPages';

interface Options {
  book: Book;
  document: EpubDocument;
  epub?: EpubDocument;
  viewportRef: RefObject<HTMLDivElement>;
  flowRef: RefObject<HTMLDivElement>;
  fontSize: number;
  fontFamily: string;
  blocked: boolean;
  progress: ReturnType<typeof useReaderProgress>;
  onPageChanged: () => void;
}

export function useReaderNavigation({ book, document, epub, viewportRef, flowRef, fontSize, fontFamily, blocked, progress, onPageChanged }: Options) {
  const { initialOffset, savingRef, savePosition } = progress;
  const screen = useScreenPages(viewportRef, flowRef, initialOffset, book.content?.length || 0, `${book.id}:${fontSize}:${fontFamily}`);
  const currentPage = screen.page + 1, totalPages = screen.count;
  const [showToc, setShowToc] = useState(false);
  const [footnote, setFootnote] = useState<string | null>(null);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const pageNumberRef = useRef<HTMLInputElement>(null);
  const pagePress = useRef<{ id: number; x: number; y: number; started: number; type: string; moved: boolean; hadSelection: boolean } | null>(null);
  const pageClickTimer = useRef<number | null>(null);
  const interactionBlocked = blocked || showToc || Boolean(footnote);
  const cancelPageClick = useCallback(() => {
    if (pageClickTimer.current !== null) window.clearTimeout(pageClickTimer.current);
    pageClickTimer.current = null;
  }, []);
  useEffect(() => cancelPageClick, [cancelPageClick, book.id, currentPage, totalPages, screen.width, fontSize, fontFamily, interactionBlocked]);

  const handlePageChange = useCallback(async (newPage: number, exactOffset?: number) => {
    cancelPageClick();
    const page = Math.max(1, Math.min(totalPages, newPage));
    if (savingRef.current || !screen.ready) return false;
    if (page === currentPage && exactOffset === undefined) return true;
    const offset = exactOffset ?? screen.offsetForPage(page - 1);
    const saved = await savePosition(offset, page, totalPages);
    if (saved) { screen.move(screen.pageForOffset(offset), offset); onPageChanged(); }
    return saved;
  }, [cancelPageClick, totalPages, savingRef, screen, currentPage, savePosition, onPageChanged]);

  const submitPageNumber = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current || !screen.ready) return;
    const value = (pageDraft ?? String(currentPage)).trim();
    if (!/^-?\d+$/.test(value)) { setPageDraft(null); pageNumberRef.current?.blur(); return; }
    if (await handlePageChange(Math.max(1, Math.min(totalPages, Number(value))))) {
      setPageDraft(null); pageNumberRef.current?.blur();
    }
  };

  const handleBookPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    cancelPageClick(); pagePress.current = null;
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]')) return;
    pagePress.current = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(),
      type: event.pointerType, moved: false, hadSelection: Boolean(window.getSelection()?.toString().trim()) };
  };
  const handleBookPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const press = pagePress.current;
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.moved = true;
  };
  const cancelBookPress = () => { pagePress.current = null; cancelPageClick(); };
  const handleBookClick = (event: MouseEvent<HTMLDivElement>) => {
    cancelPageClick();
    const press = pagePress.current;
    pagePress.current = null;
    if (!press || press.moved || press.hadSelection || performance.now() - press.started > 450 ||
      event.defaultPrevented || event.button !== 0 || event.detail > 1 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey ||
      interactionBlocked || (event.target as Element).closest('button,a,input,textarea,select,[role="button"],[contenteditable="true"]') || window.getSelection()?.toString().trim()) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const direction = event.clientX < bounds.left + bounds.width / 2 ? -1 : 1;
    pageClickTimer.current = window.setTimeout(() => {
      pageClickTimer.current = null;
      if (!window.getSelection()?.toString().trim()) void handlePageChange(currentPage + direction);
    }, press.type === 'mouse' ? 300 : 0);
  };

  const goToBlock = async (blockId: string) => {
    const block = document.blocks.find(block => block.id === blockId);
    if (!block || savingRef.current) return;
    if (!await handlePageChange(screen.pageForOffset(block.start) + 1, block.start)) return;
    setShowToc(false); setFootnote(null);
  };
  const navigateEpub = (href: string) => {
    if (epub?.notes[href]) { setFootnote(href); return; }
    const blockId = epub?.targets[href];
    if (blockId) void goToBlock(blockId);
  };
  const contentNavigation = useRef(navigateEpub);
  contentNavigation.current = navigateEpub;
  const onContentNavigate = useCallback((href: string) => contentNavigation.current(href), []);
  const handleContentFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const offset = (target.querySelector<HTMLElement>('[data-reading-start]') || target.closest<HTMLElement>('[data-reading-start]'))?.dataset.readingStart;
    if (offset !== undefined && screen.pageForOffset(Number(offset)) !== screen.page) void handlePageChange(screen.pageForOffset(Number(offset)) + 1, Number(offset));
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || interactionBlocked || target.closest('input,textarea,select,[contenteditable="true"],dialog')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); void handlePageChange(currentPage + (event.key === 'ArrowRight' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [currentPage, handlePageChange, interactionBlocked]);

  return { screen, currentPage, totalPages, showToc, setShowToc, footnote, setFootnote,
    pageDraft, setPageDraft, pageNumberRef, handlePageChange, submitPageNumber, handleBookPointerDown,
    handleBookPointerMove, cancelBookPress, cancelPageClick, handleBookClick, goToBlock, navigateEpub, onContentNavigate, handleContentFocus };
}
