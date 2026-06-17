import { supabase } from './supabase';

export interface BookLookupResult {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  firstPublishYear?: number;
  pageCount?: number;
  editionCount?: number;
  iaIds: string[];
  hasReadableText: boolean;
  description: string;
}

export interface BookTextResult {
  content: string;
  source: string;
}

const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('book-proxy', { body });
  if (error) throw new Error(error.message || 'Не удалось получить данные книги');
  return data as T;
};

export const searchBooks = async (query: string, signal?: AbortSignal) => {
  const result = await invoke<BookLookupResult[]>({ action: 'search', query });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return result;
};

export const fetchBookText = async (
  iaIds: string[],
  signal?: AbortSignal,
): Promise<BookTextResult | null> => {
  if (!iaIds.length) return null;
  try {
    const result = await invoke<BookTextResult | { content: null }>({ action: 'text', iaIds });
    if (signal?.aborted) return null;
    return result && (result as BookTextResult).content ? (result as BookTextResult) : null;
  } catch {
    return null;
  }
};
