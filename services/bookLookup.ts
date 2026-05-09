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

const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || 'http://127.0.0.1:8787/api';

const request = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${LOCAL_API_URL}${path}`, { signal });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || 'Не удалось получить данные книги');
  }

  return payload as T;
};

export const searchBooks = (query: string, signal?: AbortSignal) => {
  return request<BookLookupResult[]>(
    `/open-library/search?query=${encodeURIComponent(query)}`,
    signal,
  );
};

export const fetchBookText = async (
  iaIds: string[],
  signal?: AbortSignal,
): Promise<BookTextResult | null> => {
  for (const iaId of iaIds.slice(0, 3)) {
    try {
      return await request<BookTextResult>(
        `/open-library/text?iaId=${encodeURIComponent(iaId)}`,
        signal,
      );
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }

  return null;
};
