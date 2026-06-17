import {
  Activity,
  Annotation,
  Book,
  Comment,
  Quote,
  Thread,
  ThreadReply,
  User,
} from '../types';
import { supabase } from './supabase';

export const ADMIN_EMAIL = 'nme030609@gmail.com';

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

const unwrap = <T>(data: T | null, error: { message: string } | null): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

const isPersistedId = (id?: string) => Boolean(id && id.length >= 20);

export const db = {
  async getSession(): Promise<{ user: User; books: Book[]; quotes: Quote[] } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    try {
      return await this.loadUserData(session.user.id);
    } catch {
      return null;
    }
  },

  async loadUserData(userId: string): Promise<{ user: User; books: Book[]; quotes: Quote[] }> {
    if (!userId) throw new Error('User ID is required');

    const [profileRes, booksRes, quotesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('books').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('quotes').select('*').eq('user_id', userId),
    ]);

    const profile = unwrap(profileRes.data, profileRes.error);
    const books = booksRes.data || [];
    const quotes = quotesRes.data || [];

    const user = mapProfileToUser(profile);
    user.booksReadThisYear = books.filter((book) => book.status === 'completed').length;

    return {
      user,
      books: books.map((book) => mapDbBookToBook(book, quotes)),
      quotes: quotes.map(mapQuote),
    };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return this.loadUserData(data.user.id);
  },

  async register(email: string, password: string, name: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Не удалось создать пользователя');

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return mapProfileToUser(profile || { id: data.user.id, email, name });
  },

  async logout() {
    await supabase.auth.signOut();
  },

  async searchUserByEmail(email: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();
    return data ? mapProfileToUser(data) : null;
  },

  async updateUserProfile(user: User) {
    const { error } = await supabase
      .from('profiles')
      .update({
        name: user.name,
        bio: user.bio,
        location: user.location,
        avatar: user.avatar,
        banner_url: user.bannerUrl,
      })
      .eq('id', user.id);
    if (error) throw new Error(error.message);
  },

  async addXp(_userId: string, amount: number) {
    const { error } = await supabase.rpc('add_xp', { amount });
    if (error) console.error('XP update error:', error.message);
  },

  async getThreads(): Promise<Thread[]> {
    const { data, error } = await supabase
      .from('threads')
      .select('*, thread_replies(count)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    return (data || []).map((thread: any) =>
      mapThread({ ...thread, replies_count: thread.thread_replies?.[0]?.count ?? 0 }),
    );
  },

  async createThread(
    title: string,
    content: string,
    imageUrl: string | null,
    userId: string,
    userName: string,
  ): Promise<Thread> {
    const { data, error } = await supabase
      .from('threads')
      .insert({ title, content, image_url: imageUrl, author_id: userId, author_name: userName })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return { ...mapThread({ ...data, replies_count: 0 }), timestamp: 'Только что' };
  },

  async deleteThread(threadId: string) {
    const { error } = await supabase.from('threads').delete().eq('id', threadId);
    if (error) throw new Error(error.message);
  },

  async getThreadReplies(threadId: string): Promise<ThreadReply[]> {
    const { data, error } = await supabase
      .from('thread_replies')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapThreadReply);
  },

  async postReply(
    threadId: string,
    content: string,
    imageUrl: string | null,
    userId: string,
    userName: string,
  ): Promise<ThreadReply> {
    const { data, error } = await supabase
      .from('thread_replies')
      .insert({ thread_id: threadId, content, image_url: imageUrl, author_id: userId, author_name: userName })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return { ...mapThreadReply(data), timestamp: 'Только что' };
  },

  async deleteThreadReply(replyId: string) {
    const { error } = await supabase.from('thread_replies').delete().eq('id', replyId);
    if (error) throw new Error(error.message);
  },

  async getFeed(limit = 15): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*, profile:profiles(*), book:books(*)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data || []).map((item: any) => ({
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
    const { data, error } = await supabase
      .from('activities')
      .insert({
        user_id: activity.user.id,
        book_id: activity.book?.id ?? null,
        type: activity.type,
        content: activity.content,
        timestamp: activity.timestamp,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return { ...activity, id: data.id, timestamp: formatDate(data.created_at) };
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
    const { data } = await supabase
      .from('activities')
      .select('liked_by')
      .eq('id', activityId)
      .single();

    const current: string[] = data?.liked_by || [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];

    const { error } = await supabase.from('activities').update({ liked_by: next }).eq('id', activityId);
    if (error) throw new Error(error.message);
  },

  async addComment(activityId: string, comment: Comment) {
    const { data } = await supabase
      .from('activities')
      .select('comments')
      .eq('id', activityId)
      .single();

    const next = [...(data?.comments || []), comment];
    const { error } = await supabase.from('activities').update({ comments: next }).eq('id', activityId);
    if (error) throw new Error(error.message);
  },

  async deleteComment(activityId: string, commentId: string) {
    const { data } = await supabase
      .from('activities')
      .select('comments')
      .eq('id', activityId)
      .single();

    const next = (data?.comments || []).filter((c: Comment) => c.id !== commentId);
    const { error } = await supabase.from('activities').update({ comments: next }).eq('id', activityId);
    if (error) throw new Error(error.message);
  },

  async deleteActivity(id: string) {
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getLeaderboard(limit = 5): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, books(status)')
      .order('xp', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data || []).map((profile: any) => ({
      ...mapProfileToUser(profile),
      booksReadThisYear: (profile.books || []).filter((b: any) => b.status === 'completed').length,
    }));
  },

  async addBook(book: Book, userId: string) {
    const { data, error } = await supabase
      .from('books')
      .insert({
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
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(data.id, userId, book.title, annotations);
    }

    return mapDbBookToBook(data, annotations);
  },

  async syncAnnotations(
    bookId: string,
    userId: string,
    bookTitle: string,
    annotations: Annotation[],
  ): Promise<any[]> {
    const updated: any[] = [];

    for (const annotation of annotations) {
      const payload: any = {
        user_id: userId,
        book_id: bookId,
        book_title: bookTitle,
        text: annotation.quote,
        comment: annotation.comment,
        color: annotation.color,
        timestamp: Number(annotation.timestamp) || Date.now(),
      };
      if (isPersistedId(annotation.id)) payload.id = annotation.id;

      try {
        const query = isPersistedId(annotation.id)
          ? supabase.from('quotes').upsert(payload)
          : supabase.from('quotes').insert(payload);
        const { data, error } = await query.select().single();
        if (error) throw new Error(error.message);
        updated.push({ ...annotation, id: data.id, book_id: bookId });
      } catch (err) {
        console.error('Failed to sync quote:', payload, err);
        updated.push({ ...annotation, book_id: bookId });
      }
    }

    return updated;
  },

  async deleteAnnotation(annotationId: string) {
    if (!isPersistedId(annotationId)) return;
    const { error } = await supabase.from('quotes').delete().eq('id', annotationId);
    if (error) throw new Error(error.message);
  },

  async updateBook(book: Book, userId: string): Promise<Book> {
    if (!book.id) throw new Error('Book ID is required for update');

    const { data, error } = await supabase
      .from('books')
      .update({
        progress: Number(book.progress) || 0,
        status: book.status,
        my_rating: Number(book.myRating) || 0,
        current_page: Number(book.currentPage) || 1,
        total_pages: Number(book.totalPages) || 1,
      })
      .eq('id', book.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(book.id, userId, book.title, annotations);
    }

    return mapDbBookToBook(data, annotations);
  },

  async deleteBook(id: string) {
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
