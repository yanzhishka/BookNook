import type { Book, BookSummary } from '../types';

export function bookSummary(book: Book): BookSummary {
  return {
    id: book.id, title: book.title, author: book.author, coverUrl: book.coverUrl,
    progress: book.progress, status: book.status, myRating: book.myRating,
    isLendable: book.isLendable, currentPage: book.currentPage,
    readingOffset: book.readingOffset, totalPages: book.totalPages,
    tags: book.tags, collectionId: book.collectionId,
    hasContent: book.hasContent ?? Boolean(book.content?.trim()),
    annotationCount: book.annotationCount ?? book.annotations?.length ?? 0,
  };
}
