import type { EpubDocument } from './services/epub/document';
export interface Annotation {
  id: string;
  quote: string;
  comment: string;
  color: string;
  timestamp: number;
}

export interface Quote {
  id: string;
  text: string;
  bookId?: string;
  bookTitle: string;
  page?: string;
  color: string; 
  timestamp: number;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  progress: number;
  status: 'reading' | 'completed' | 'want_to_read';
  myRating?: number;
  isLendable?: boolean;
  annotations?: Annotation[];
  content?: string;
  document?: EpubDocument;
  hasContent?: boolean;
  annotationCount?: number;
  currentPage?: number;
  readingOffset?: number;
  totalPages?: number;
  tags?: string[];
  collectionId?: string;
}

// Shelf state never owns document text, illustrations or note bodies.
export type BookSummary = Omit<Book, 'content' | 'document' | 'annotations'> & {
  hasContent: boolean;
  annotationCount: number;
};

export type BookContent = Pick<Book, 'content' | 'document'>;

export interface User {
  id: string;
  name: string;
  email?: string;
  role: 'user' | 'admin';
  handle?: string;
  avatar: string;
  bannerUrl?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  booksReadThisYear: number;
  totalBooksRead?: number;
  streakDays?: number;
  totalReadingTime?: number; 
  xp: number;
  level: number;
  termsAcceptedAt?: string;
}

export interface Thread {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
  repliesCount: number;
  timestamp: string;
  isPinned?: boolean;
  replies?: ThreadReply[];
}

export interface ThreadReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
}

export type CommunityKind = 'discussion' | 'quote' | 'review';
export type CommunitySource = 'thread' | 'post';
export interface CommunityTopic extends Thread {
  source: CommunitySource;
  kind: CommunityKind;
  authorAvatar?: string;
  createdAt: string;
  lastActivityAt: string;
  likesCount: number;
  likedByMe: boolean;
  book: Pick<Book, 'title' | 'author' | 'coverUrl'> | null;
}

export interface Activity {
  id: string;
  user: User;
  book: Book | null;
  type: 'progress' | 'review' | 'note' | 'finished';
  content?: string;
  timestamp: string;
  likes: number;
  likedBy: string[];
  comments: Comment[];
}

export type ReportContentType = 'post' | 'comment' | 'thread' | 'reply' | 'user';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'child_safety'
  | 'other';

export interface ModerationTarget {
  contentId?: string;
  contentType: ReportContentType;
  userId: string;
  userName: string;
}
