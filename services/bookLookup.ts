import { supabase } from './supabase';
import type { CatalogBook, CatalogSearch, CatalogText, BookLanguage } from '../shared/bookCatalog';
import type { ImportedEpub } from './epub/import';
export { BOOK_LANGUAGES, languageInfo } from '../shared/bookCatalog';
export type BookLookupResult = CatalogBook;
export type BookTextResult = { kind: 'editions'; books: CatalogBook[] } | {
  kind: 'ready'; book: ImportedEpub; sourceUrl: string; chapterCount: number;
};

async function invoke<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { data, error } = await supabase.functions.invoke('book-proxy', { body, signal, timeout: 60_000 });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) {
    let message = 'Не удалось связаться с источником книг. Попробуйте ещё раз.';
    if (error.context instanceof Response) {
      const payload = await error.context.json().catch(() => null);
      if (typeof payload?.error === 'string') message = payload.error;
    }
    throw new Error(message);
  }
  return data as T;
}

export function searchBooks(options: { query: string; language: BookLanguage; onlyReadable: boolean; page?: number }, signal?: AbortSignal) {
  return invoke<CatalogSearch>({ action: 'catalog_search', ...options }, signal);
}

export async function fetchBookText(book: CatalogBook, signal?: AbortSignal, onProgress: (message: string) => void = () => {}): Promise<BookTextResult> {
  if (!book.hasReadableText || book.provider !== 'wikisource') throw new Error('У этой карточки нет открытого текста. Добавьте свой EPUB, PDF или TXT.');
  onProgress('Получаем текст и оглавление из Викитеки…');
  const result = await invoke<CatalogText>({ action: 'catalog_text', language: book.language, sourcePage: book.sourcePage }, signal);
  if (result.kind === 'editions') return result;
  if (result.kind !== 'text' || !result.chapters?.length) throw new Error('Источник не вернул текст. Выберите другое издание.');
  const { importWebBook } = await import('./epub/web');
  const imported = await importWebBook(result, onProgress);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { kind: 'ready', book: imported, sourceUrl: result.sourceUrl, chapterCount: result.chapters.length };
}
