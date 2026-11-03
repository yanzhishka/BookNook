import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book } from '../../types';
import { isEpubDocument, paginateDocument, pageForOffset } from '../../services/epub/document';

const CHARS_PER_PAGE = 2500;

// One write gate for page position and notes. A failed write leaves both the
// visible page and the draft intact, and a retry uses the same source anchor.
export function useReaderProgress(book: Book, onUpdateBook: (book: Book) => Promise<void>) {
  const pages = useMemo(() => isEpubDocument(book.document) ? paginateDocument(book.document) : [], [book.document]);
  const initialOffset = book.readingOffset ?? pages[(book.currentPage || 1) - 1]?.start ?? ((book.currentPage || 1) - 1) * CHARS_PER_PAGE;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const runMutation = useCallback(async (save: () => Promise<void>) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setIsSaving(true); setSaveError(null);
    try {
      await save();
      return alive.current;
    } catch (error) {
      console.error('Reader save failed', error);
      if (alive.current) setSaveError('Не удалось сохранить изменения. Проверьте соединение и попробуйте ещё раз.');
      return false;
    } finally {
      savingRef.current = false;
      if (alive.current) setIsSaving(false);
    }
  }, []);

  const savePosition = useCallback((offset: number, screenPage: number, screenCount: number) => {
    const end = screenPage === screenCount;
    let status = book.status;
    if (end) status = 'completed';
    else if (screenPage > 1 || status === 'completed') status = 'reading';
    return runMutation(() => onUpdateBook({
      ...book,
      currentPage: pages.length ? pageForOffset(pages, offset) + 1 : Math.floor(offset / CHARS_PER_PAGE) + 1,
      readingOffset: offset,
      progress: end ? 100 : Math.floor(offset / Math.max(1, book.content?.length || 1) * 100),
      status,
    }));
  }, [book, pages, onUpdateBook, runMutation]);

  return { initialOffset, isSaving, saveError, setSaveError, savingRef, runMutation, savePosition };
}
