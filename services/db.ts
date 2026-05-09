import {
  Activity,
  Annotation,
  Book,
  Chat,
  Comment,
  Message,
  Quote,
  Thread,
  ThreadReply,
  User,
} from '../types';

export const ADMIN_EMAIL = 'nme030609@gmail.com';

export interface UserData {
  profile: User;
  email: string;
  id: string;
  password?: string;
}

const API_BASE_URL = import.meta.env.VITE_LOCAL_API_URL || 'http://127.0.0.1:8787/api';
const SESSION_STORAGE_KEY = 'bnook_local_user_id';

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Local API request failed: ${response.status}`);
  }

  return payload as T;
};

const saveSession = (userId: string) => {
  localStorage.setItem(SESSION_STORAGE_KEY, userId);
};

const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

const formatDate = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU');
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTime = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  email: profile.email,
  name: profile.name || 'User',
  handle: profile.handle || profile.email?.split('@')[0] || 'user',
  avatar: profile.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
  bannerUrl: profile.banner_url,
  bio: profile.bio,
  location: profile.location,
  joinedDate: profile.joined_date,
  booksReadThisYear: Number(profile.booksReadThisYear || profile.completed_count || 0),
  streakDays: Number(profile.streak_days || 0),
  totalReadingTime: Number(profile.total_reading_time || 0),
  xp: Number(profile.xp || 0),
  level: Number(profile.level || 1),
});

const mapDbBookToBook = (book: any, allQuotes: any[] = []): Book => {
  const annotations = allQuotes
    .filter((quote) => quote.book_id === book.id || quote.bookId === book.id)
    .map((quote) => {
      const rawTimestamp = quote.timestamp || quote.created_at;
      const timestamp = typeof rawTimestamp === 'number'
        ? rawTimestamp
        : new Date(rawTimestamp).getTime();

      return {
        id: quote.id,
        quote: quote.text || quote.quote || '',
        comment: quote.comment || '',
        color: quote.color || 'amber',
        timestamp: timestamp || Date.now(),
      };
    });

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.cover_url,
    progress: Number(book.progress || 0),
    status: book.status || 'want_to_read',
    myRating: Number(book.my_rating || 0),
    isLendable: Boolean(book.is_lendable),
    content: book.content,
    currentPage: Number(book.current_page || 1),
    totalPages: Number(book.total_pages || 1),
    annotations,
    tags: [],
  };
};

const mapQuote = (quote: any): Quote => ({
  ...quote,
  bookId: quote.book_id,
  bookTitle: quote.book_title,
});

const mapMessage = (message: any): Message => ({
  id: message.id,
  chatId: message.chat_id,
  senderId: message.sender_id,
  content: message.content,
  createdAt: message.created_at,
  isRead: Boolean(message.is_read),
});

const mapThread = (thread: any): Thread => ({
  id: thread.id,
  title: thread.title,
  authorId: thread.author_id,
  authorName: thread.author_name,
  content: thread.content,
  imageUrl: thread.image_url,
  repliesCount: Number(thread.replies_count || 0),
  timestamp: formatDateTime(thread.created_at),
});

const mapThreadReply = (reply: any): ThreadReply => ({
  id: reply.id,
  threadId: reply.thread_id,
  authorId: reply.author_id,
  authorName: reply.author_name,
  content: reply.content,
  imageUrl: reply.image_url,
  timestamp: formatTime(reply.created_at),
});

export const db = {
  async getSession(): Promise<{ user: User; books: Book[]; quotes: Quote[] } | null> {
    const userId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!userId) return null;

    try {
      return await this.loadUserData(userId);
    } catch {
      clearSession();
      return null;
    }
  },

  async loadUserData(userId: string): Promise<{ user: User; books: Book[]; quotes: Quote[] }> {
    if (!userId) throw new Error('User ID is required');

    const data = await apiRequest<{ profile: any; books: any[]; quotes: any[] }>(
      `/users/${encodeURIComponent(userId)}/data`,
    );

    const user = mapProfileToUser(data.profile);
    user.booksReadThisYear = data.books.filter((book) => book.status === 'completed').length;

    return {
      user,
      books: data.books.map((book) => mapDbBookToBook(book, data.quotes)),
      quotes: data.quotes.map(mapQuote),
    };
  },

  async login(email: string, password: string) {
    const { userId } = await apiRequest<{ userId: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    saveSession(userId);
    return this.loadUserData(userId);
  },

  async register(email: string, password: string, name: string) {
    const { userId, profile } = await apiRequest<{ userId: string; profile: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    saveSession(userId);
    return mapProfileToUser(profile);
  },

  async logout() {
    clearSession();
    await apiRequest('/auth/logout', { method: 'POST' });
  },

  async searchUserByEmail(email: string) {
    const profile = await apiRequest<any | null>(
      `/profiles/search?email=${encodeURIComponent(email)}`,
    );
    return profile ? mapProfileToUser(profile) : null;
  },

  async updateUserProfile(user: User) {
    await apiRequest(`/profiles/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: user.name,
        bio: user.bio,
        location: user.location,
        avatar: user.avatar,
        banner_url: user.bannerUrl,
      }),
    });
  },

  async addXp(userId: string, amount: number) {
    try {
      await apiRequest('/xp', {
        method: 'POST',
        body: JSON.stringify({ userId, amount }),
      });
    } catch (error) {
      console.error('XP update error:', error);
    }
  },

  async getThreads(): Promise<Thread[]> {
    const threads = await apiRequest<any[]>('/threads');
    return threads.map(mapThread);
  },

  async createThread(
    title: string,
    content: string,
    imageUrl: string | null,
    userId: string,
    userName: string,
  ): Promise<Thread> {
    const thread = await apiRequest<any>('/threads', {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        image_url: imageUrl,
        author_id: userId,
        author_name: userName,
      }),
    });

    return {
      ...mapThread({ ...thread, replies_count: 0 }),
      timestamp: 'Только что',
    };
  },

  async deleteThread(threadId: string) {
    await apiRequest(`/threads/${encodeURIComponent(threadId)}`, { method: 'DELETE' });
  },

  async getThreadReplies(threadId: string): Promise<ThreadReply[]> {
    const replies = await apiRequest<any[]>(`/threads/${encodeURIComponent(threadId)}/replies`);
    return replies.map(mapThreadReply);
  },

  async postReply(
    threadId: string,
    content: string,
    imageUrl: string | null,
    userId: string,
    userName: string,
  ): Promise<ThreadReply> {
    const reply = await apiRequest<any>(`/threads/${encodeURIComponent(threadId)}/replies`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        image_url: imageUrl,
        author_id: userId,
        author_name: userName,
      }),
    });

    return {
      ...mapThreadReply(reply),
      timestamp: 'Только что',
    };
  },

  async deleteThreadReply(replyId: string) {
    await apiRequest(`/thread-replies/${encodeURIComponent(replyId)}`, { method: 'DELETE' });
  },

  async getFeed(limit = 15): Promise<Activity[]> {
    const activities = await apiRequest<any[]>(`/feed?limit=${limit}`);

    return activities.map((item) => ({
      id: item.id,
      user: mapProfileToUser(item.profile),
      book: item.book ? mapDbBookToBook(item.book) : null,
      type: item.type,
      content: item.content,
      timestamp: formatDate(item.created_at),
      likes: (item.liked_by || []).length,
      likedBy: item.liked_by || [],
      comments: item.comments || [],
    }));
  },

  async createActivity(activity: Activity): Promise<Activity> {
    const created = await apiRequest<any>('/activities', {
      method: 'POST',
      body: JSON.stringify({
        user_id: activity.user.id,
        book_id: activity.book?.id,
        type: activity.type,
        content: activity.content,
        timestamp: activity.timestamp,
      }),
    });

    return {
      ...activity,
      id: created.id,
      timestamp: formatDate(created.created_at),
    };
  },

  async shareAnnotation(user: User, book: Book, annotation: Annotation): Promise<Activity> {
    return this.createActivity({
      id: '',
      user,
      book,
      type: 'note',
      content: `${annotation.quote}\n\n— ${annotation.comment}`,
      timestamp: 'Только что',
      likes: 0,
      likedBy: [],
      comments: [],
    });
  },

  async toggleActivityLike(activityId: string, userId: string) {
    await apiRequest(`/activities/${encodeURIComponent(activityId)}/toggle-like`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async addComment(activityId: string, comment: Comment) {
    await apiRequest(`/activities/${encodeURIComponent(activityId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  async deleteComment(activityId: string, commentId: string) {
    await apiRequest(
      `/activities/${encodeURIComponent(activityId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    );
  },

  async deleteActivity(id: string) {
    await apiRequest(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getLeaderboard(limit = 5): Promise<User[]> {
    const profiles = await apiRequest<any[]>(`/leaderboard?limit=${limit}`);

    return profiles.map((profile) => ({
      ...mapProfileToUser(profile),
      booksReadThisYear: Number(profile.completed_count || 0),
    }));
  },

  async addBook(book: Book, userId: string) {
    const created = await apiRequest<any>('/books', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        progress: Number(book.progress) || 0,
        status: book.status,
        my_rating: Number(book.myRating) || 0,
        is_lendable: Boolean(book.isLendable),
        content: book.content,
        current_page: Number(book.currentPage) || 1,
        total_pages: Number(book.totalPages) || 1,
      }),
    });

    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(created.id, userId, book.title, annotations);
    }

    return mapDbBookToBook(created, annotations);
  },

  async syncAnnotations(
    bookId: string,
    userId: string,
    bookTitle: string,
    annotations: Annotation[],
  ): Promise<any[]> {
    const updatedAnnotations: any[] = [];

    for (const annotation of annotations) {
      const isPersistedId = annotation.id.includes('-') || annotation.id.length > 20;
      const payload: any = {
        user_id: userId,
        book_id: bookId,
        book_title: bookTitle,
        text: annotation.quote,
        comment: annotation.comment,
        color: annotation.color,
        timestamp: Number(annotation.timestamp) || Date.now(),
      };

      if (isPersistedId) {
        payload.id = annotation.id;
      }

      try {
        const saved = await apiRequest<any>('/quotes/upsert', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        updatedAnnotations.push({
          ...annotation,
          id: saved.id,
          book_id: bookId,
        });
      } catch (error) {
        console.error('Failed to sync specific quote:', payload, error);
        updatedAnnotations.push({ ...annotation, book_id: bookId });
      }
    }

    return updatedAnnotations;
  },

  async deleteAnnotation(annotationId: string) {
    if (!annotationId || annotationId.length < 20) return;
    await apiRequest(`/quotes/${encodeURIComponent(annotationId)}`, { method: 'DELETE' });
  },

  async updateBook(book: Book, userId: string): Promise<Book> {
    if (!book.id) throw new Error('Book ID is required for update');

    const updated = await apiRequest<any>(`/books/${encodeURIComponent(book.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        progress: Number(book.progress) || 0,
        status: book.status,
        my_rating: Number(book.myRating) || 0,
        current_page: Number(book.currentPage) || 1,
        total_pages: Number(book.totalPages) || 1,
      }),
    });

    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(book.id, userId, book.title, annotations);
    }

    return mapDbBookToBook(updated, annotations);
  },

  async deleteBook(id: string) {
    await apiRequest(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getChats(userId: string): Promise<Chat[]> {
    const chats = await apiRequest<any[]>(`/users/${encodeURIComponent(userId)}/chats`);

    return chats.map((chat) => ({
      id: chat.id,
      lastMessage: chat.last_message || '',
      participants: (chat.participants || []).map(mapProfileToUser),
    }));
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const messages = await apiRequest<any[]>(`/chats/${encodeURIComponent(chatId)}/messages`);
    return messages.map(mapMessage);
  },

  async sendMessage(chatId: string, senderId: string, content: string): Promise<Message> {
    const message = await apiRequest<any>(`/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        sender_id: senderId,
        content,
      }),
    });

    return mapMessage(message);
  },

  async createChat(userId1: string, userId2: string): Promise<Chat> {
    const chat = await apiRequest<any>('/chats', {
      method: 'POST',
      body: JSON.stringify({ userIds: [userId1, userId2] }),
    });

    return {
      id: chat.id,
      lastMessage: chat.last_message || '',
      participants: (chat.participants || []).map(mapProfileToUser),
    };
  },

  async deleteChat(chatId: string, userId: string) {
    await apiRequest(
      `/chats/${encodeURIComponent(chatId)}/participants/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
  },

  crud: {
    async list<T = unknown>(table: string, limit = 100): Promise<T[]> {
      return apiRequest<T[]>(`/crud/${encodeURIComponent(table)}?limit=${limit}`);
    },

    async get<T = unknown>(table: string, id: string): Promise<T | null> {
      return apiRequest<T | null>(`/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`);
    },

    async create<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
      return apiRequest<T>(`/crud/${encodeURIComponent(table)}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update<T = unknown>(
      table: string,
      id: string,
      data: Record<string, unknown>,
    ): Promise<T> {
      return apiRequest<T>(`/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async remove(table: string, id: string): Promise<void> {
      await apiRequest(`/crud/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async getChatParticipant<T = unknown>(chatId: string, userId: string): Promise<T | null> {
      return apiRequest<T | null>(
        `/crud/chat_participants?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`,
      );
    },

    async updateChatParticipant<T = unknown>(
      chatId: string,
      userId: string,
      data: { joined_at?: string; joinedAt?: string },
    ): Promise<T> {
      return apiRequest<T>(
        `/crud/chat_participants?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
    },

    async removeChatParticipant(chatId: string, userId: string): Promise<void> {
      await apiRequest(
        `/crud/chat_participants?chatId=${encodeURIComponent(chatId)}&userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
      );
    },
  },
};
