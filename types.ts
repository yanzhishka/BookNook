
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
  currentPage?: number;
  totalPages?: number;
}

export interface UserArchetype {
  title: string;
  description: string;
  traits: string[];
  color: string;
  icon: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  handle?: string;
  avatar: string;
  bannerUrl?: string;
  bio?: string;
  location?: string;
  joinedDate?: string;
  booksReadThisYear: number;
  totalBooksRead?: number;
  streakDays?: number;
  totalReadingTime?: number; // в секундах
  archetype?: UserArchetype;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
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

export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface MoodCategory {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
}

/**
 * Represents a single message within a chat conversation.
 */
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

/**
 * Represents a chat conversation between multiple users.
 */
export interface Chat {
  id: string;
  participants: User[];
  lastMessage?: string;
  updatedAt: string;
}
