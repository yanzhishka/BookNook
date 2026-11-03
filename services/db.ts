import {
  Activity,
  Annotation,
  Book,
  BookContent,
  BookSummary,
  Comment,
  Thread,
  ThreadReply,
  User,
  ReportContentType,
  ReportReason,
} from '../types';
import type { Json, Tables } from './database.types';
import { Capacitor } from '@capacitor/core';
import { MOBILE_AUTH_CALLBACK, supabase } from './supabase';
import { BookContentCache } from './bookContentCache';
import { bookSummary } from './books';

const PUBLIC_PROFILE_COLUMNS = 'id,name,handle,avatar,banner_url,bio,location,joined_date,streak_days,role,xp,level,completed_count,terms_accepted_at';
const BOOK_COLUMNS = 'id,title,author,cover_url,progress,status,my_rating,is_lendable,current_page,reading_offset,total_pages';
const contentCache = new BookContentCache();

type ProfileRecord = Partial<Tables<'profiles'>> & { id: string };
type BookRecord = Pick<Tables<'books'>, 'id' | 'title' | 'author' | 'cover_url' | 'progress' | 'status' | 'my_rating' | 'is_lendable' | 'current_page' | 'reading_offset' | 'total_pages'> &
  Partial<Pick<Tables<'books'>, 'content' | 'document'>> & { has_content?: boolean; annotation_count?: number };
type QuoteRecord = Tables<'quotes'>;

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

const mapProfileToUser = (profile: ProfileRecord, email?: string): User => ({
  id: profile.id,
  email,
  name: profile.name || 'User',
  role: profile.role === 'admin' ? 'admin' : 'user',
  handle: profile.handle || email?.split('@')[0] || 'user',
  avatar: profile.avatar || 'https://ui-avatars.com/api/?name=User&background=random',
  bannerUrl: profile.banner_url || undefined,
  bio: profile.bio || undefined,
  location: profile.location || undefined,
  joinedDate: profile.joined_date || undefined,
  booksReadThisYear: Number(profile.completed_count || 0),
  totalBooksRead: Number(profile.completed_count || 0),
  streakDays: Number(profile.streak_days || 0),
  xp: Number(profile.xp || 0),
  level: Number(profile.level || 1),
  termsAcceptedAt: profile.terms_accepted_at || undefined,
});

const mapAnnotation = (quote: QuoteRecord): Annotation => ({
  id: quote.id,
  quote: quote.text,
  comment: quote.comment || '',
  color: quote.color || 'amber',
  timestamp: Number(quote.timestamp || new Date(quote.created_at).getTime()),
});

const mapDbBookToBook = (book: BookRecord, allQuotes: QuoteRecord[] = []): Book => {
  const annotations = allQuotes
    .filter((quote) => quote.book_id === book.id)
    .map(mapAnnotation);

  return {
    id: book.id,
    title: book.title,
    author: book.author || 'Автор не указан',
    coverUrl: book.cover_url || 'https://ui-avatars.com/api/?name=Book&background=random',
    progress: Number(book.progress || 0),
    status: isBookStatus(book.status) ? book.status : 'want_to_read',
    myRating: Number(book.my_rating || 0),
    isLendable: Boolean(book.is_lendable),
    content: book.content || undefined,
    document: book.document as unknown as Book['document'] || undefined,
    hasContent: book.has_content ?? Boolean(book.content?.trim()),
    annotationCount: book.annotation_count ?? annotations.length,
    currentPage: Number(book.current_page || 1),
    readingOffset: book.reading_offset ?? undefined,
    totalPages: Number(book.total_pages || 1),
    annotations,
    tags: [],
  };
};

const isBookStatus = (value: unknown): value is Book['status'] =>
  value === 'reading' || value === 'completed' || value === 'want_to_read';

const mapBookSnapshot = (snapshot: Json | null): Book | null => {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return null;

  const id = typeof snapshot.id === 'string' ? snapshot.id : '';
  const title = typeof snapshot.title === 'string' ? snapshot.title : '';
  if (!id || !title) return null;

  return {
    id,
    title,
    author: typeof snapshot.author === 'string' ? snapshot.author : 'Автор не указан',
    coverUrl: typeof snapshot.coverUrl === 'string'
      ? snapshot.coverUrl
      : 'https://ui-avatars.com/api/?name=Book&background=random',
    status: isBookStatus(snapshot.status) ? snapshot.status : 'want_to_read',
    progress: 0,
    myRating: 0,
    isLendable: false,
    annotations: [],
    tags: [],
  };
};

const mapActivityComment = (comment: any): Comment => ({
  id: comment.id,
  userId: comment.user_id,
  userName: comment.profile?.name || 'User',
  userAvatar: comment.profile?.avatar
    || 'https://ui-avatars.com/api/?name=User&background=random',
  text: comment.content,
  timestamp: formatDateTime(comment.created_at),
});

const mapThread = (thread: any): Thread => ({
  id: thread.id,
  title: thread.title,
  authorId: thread.author_id || '',
  authorName: thread.author_name,
  content: thread.content,
  imageUrl: thread.image_url,
  repliesCount: Number(thread.replies_count || 0),
  timestamp: formatDateTime(thread.created_at),
});

const mapThreadReply = (reply: any): ThreadReply => ({
  id: reply.id,
  threadId: reply.thread_id || '',
  authorId: reply.author_id || '',
  authorName: reply.author_name,
  content: reply.content,
  imageUrl: reply.image_url,
  timestamp: formatTime(reply.created_at),
});

const unwrap = <T>(data: T | null, error: { message: string } | null): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

export const db = {
  async getPublicProfile(userId: string): Promise<User> {
    const { data, error } = await supabase.from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS).eq('id', userId).single();
    return mapProfileToUser(unwrap(data, error));
  },

  async getSession(): Promise<{ user: User; books: BookSummary[] } | null> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error?.name === 'AuthSessionMissingError') { contentCache.clear(); return null; }
    if (error) throw new Error(error.message);
    if (!user) { contentCache.clear(); return null; }
    return this.loadUserData(user.id, user.email);
  },

  async loadUserData(
    userId: string,
    email?: string,
  ): Promise<{ user: User; books: BookSummary[] }> {
    if (!userId) throw new Error('User ID is required');
    contentCache.forUser(userId);

    const [profileRes, books] = await Promise.all([
      supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', userId).single(),
      this.getBookShelf(userId),
    ]);

    const profile = unwrap(profileRes.data, profileRes.error);
    const user = mapProfileToUser(profile, email);
    return { user, books };
  },

  async getBookShelf(userId: string): Promise<BookSummary[]> {
    if (!userId) throw new Error('User ID is required');
    const books: BookSummary[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from('book_shelf').select('*')
        .eq('user_id', userId).order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + size - 1);
      const rows = unwrap(data, error) || [];
      books.push(...rows.map(row => bookSummary(mapDbBookToBook(row))));
      if (rows.length < size) return books;
    }
  },

  getBookContent(bookId: string, userId: string): Promise<BookContent> {
    if (!bookId || !userId) throw new Error('Book and user IDs are required');
    return contentCache.load(userId, bookId, async signal => {
      const { data, error } = await supabase.from('books').select('content,document')
        .eq('id', bookId).eq('user_id', userId).abortSignal(signal).single();
      const row = unwrap(data, error);
      return { content: row.content || undefined, document: row.document as unknown as Book['document'] || undefined };
    });
  },

  async getBookAnnotations(bookId: string, userId: string): Promise<Annotation[]> {
    if (!bookId || !userId) throw new Error('Book and user IDs are required');
    const annotations: Annotation[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from('quotes').select('*')
        .eq('book_id', bookId).eq('user_id', userId)
        .order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + size - 1);
      const rows = unwrap(data, error) || [];
      annotations.push(...rows.map(mapAnnotation));
      if (rows.length < size) return annotations;
    }
  },

  async login(login: string, password: string) {
    const email = login.trim() === '123' ? '123@booknook.local' : login.trim();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return this.loadUserData(data.user.id, data.user.email);
  },

  async register(email: string, password: string, name: string, acceptedTerms: boolean): Promise<User> {
    if (!acceptedTerms) throw new Error('Для регистрации необходимо принять правила сообщества');

    const termsAcceptedAt = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, terms_accepted_at: termsAcceptedAt },
        ...(Capacitor.isNativePlatform() ? { emailRedirectTo: MOBILE_AUTH_CALLBACK } : {}),
      },
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Не удалось создать пользователя');

    const { data: profile } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', data.user.id)
      .single();

    return mapProfileToUser(
      profile || { id: data.user.id, name, terms_accepted_at: termsAcceptedAt },
      data.user.email,
    );
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    contentCache.clear();
  },

  async deleteAccount() {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirmation: 'DELETE_MY_ACCOUNT' },
    });
    if (error) throw new Error(error.message);

    contentCache.clear();
    await supabase.auth.signOut({ scope: 'local' });
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

  async acceptCommunityTerms(userId: string): Promise<string> {
    const acceptedAt = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ terms_accepted_at: acceptedAt })
      .eq('id', userId);
    if (error) throw new Error(error.message);
    return acceptedAt;
  },

  async reportContent(
    reporterId: string,
    reportedUserId: string,
    contentType: ReportContentType,
    contentId: string | undefined,
    reason: ReportReason,
    details?: string,
  ) {
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      content_type: contentType,
      content_id: contentId || null,
      reason,
      details: details?.trim() || null,
    });
    if (error?.code === '23505') throw new Error('Жалоба на этот материал уже отправлена');
    if (error) throw new Error(error.message);
  },

  async blockUser(blockerId: string, blockedId: string) {
    const { error } = await supabase.from('user_blocks').insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    if (error?.code === '23505') return;
    if (error) throw new Error(error.message);
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
      .select(`
        id,
        user_id,
        book_id,
        type,
        content,
        book_snapshot,
        created_at,
        profile:profiles!activities_user_id_fkey(${PUBLIC_PROFILE_COLUMNS}),
        likes:activity_likes(user_id),
        comments:activity_comments(
          id,
          user_id,
          content,
          created_at,
          profile:profiles!activity_comments_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data || []).map((item: any) => {
      const likedBy = (item.likes || []).map((like: any) => like.user_id);
      const comments = [...(item.comments || [])]
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map(mapActivityComment);

      return {
        id: item.id,
        user: mapProfileToUser(item.profile),
        book: mapBookSnapshot(item.book_snapshot),
        type: item.type,
        content: item.content || undefined,
        timestamp: formatDate(item.created_at),
        likes: likedBy.length,
        likedBy,
        comments,
      };
    });
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
      .select('id, user_id, book_id, type, content, book_snapshot, created_at')
      .single();
    if (error) throw new Error(error.message);

    return {
      ...activity,
      id: data.id,
      book: mapBookSnapshot(data.book_snapshot),
      timestamp: formatDate(data.created_at),
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

  async setActivityLike(activityId: string, userId: string, shouldLike: boolean) {
    const query = shouldLike
      ? supabase.from('activity_likes').upsert(
        { activity_id: activityId, user_id: userId },
        { onConflict: 'activity_id,user_id', ignoreDuplicates: true },
      )
      : supabase
        .from('activity_likes')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', userId);

    const { error } = await query;
    if (error) throw new Error(error.message);
  },

  async addComment(activityId: string, userId: string, text: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('activity_comments')
      .insert({ activity_id: activityId, user_id: userId, content: text.trim() })
      .select(`
        id,
        user_id,
        content,
        created_at,
        profile:profiles!activity_comments_user_id_fkey(${PUBLIC_PROFILE_COLUMNS})
      `)
      .single();
    if (error) throw new Error(error.message);
    return mapActivityComment(data);
  },

  async deleteComment(_activityId: string, commentId: string) {
    const { error } = await supabase.from('activity_comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);
  },

  async deleteActivity(id: string) {
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getLeaderboard(limit = 5): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .order('level', { ascending: false })
      .order('xp', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data || []).map((profile) => mapProfileToUser(profile));
  },

  async addBook(book: Book, userId: string) {
    const { data, error } = await supabase
      .from('books')
      .upsert({
        id: book.id || crypto.randomUUID(),
        user_id: userId,
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        progress: Number(book.progress) || 0,
        status: book.status,
        my_rating: Number(book.myRating) || 0,
        is_lendable: Boolean(book.isLendable),
        content: book.content,
        document: book.document as unknown as Json || null,
        current_page: Number(book.currentPage) || 1,
        reading_offset: book.readingOffset ?? null,
        total_pages: Number(book.totalPages) || 1,
      }, { onConflict: 'id' })
      .select(BOOK_COLUMNS)
      .single();
    if (error) throw new Error(error.message);

    contentCache.put(userId, data.id, { content: book.content, document: book.document });
    return { ...book, ...mapDbBookToBook(data), content: book.content, document: book.document, hasContent: Boolean(book.content?.trim()) };
  },

  async saveAnnotation(
    bookId: string,
    userId: string,
    bookTitle: string,
    annotation: Annotation,
  ): Promise<Annotation> {
    const { data, error } = await supabase.from('quotes').upsert({
        id: annotation.id,
        user_id: userId,
        book_id: bookId,
        book_title: bookTitle,
        text: annotation.quote.trim(),
        comment: annotation.comment.trim(),
        color: annotation.color,
        timestamp: Number(annotation.timestamp) || Date.now(),
      }, { onConflict: 'id' }).select().single();
    return mapAnnotation(unwrap(data, error));
  },

  async deleteAnnotation(annotationId: string, bookId: string, userId: string) {
    const { error } = await supabase.from('quotes').delete()
      .eq('id', annotationId).eq('book_id', bookId).eq('user_id', userId);
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
        reading_offset: book.readingOffset ?? null,
        total_pages: Number(book.totalPages) || 1,
      })
      .eq('id', book.id)
      .eq('user_id', userId)
      .select('id,progress,status,my_rating,current_page,total_pages,reading_offset')
      .single();
    if (error) throw new Error(error.message);

    return { ...book, progress: data.progress, status: isBookStatus(data.status) ? data.status : book.status,
      myRating: data.my_rating, currentPage: data.current_page, totalPages: data.total_pages, readingOffset: data.reading_offset ?? undefined };
  },

  async replaceBookContent(book: Book, userId: string): Promise<Book> {
    const { data, error } = await supabase.from('books').update({
      title: book.title, author: book.author, cover_url: book.coverUrl,
      content: book.content, document: book.document as unknown as Json || null,
      current_page: book.currentPage || 1, total_pages: book.totalPages || 1,
      reading_offset: book.readingOffset ?? null,
      progress: book.progress, status: book.status,
    }).eq('id', book.id).eq('user_id', userId).select(BOOK_COLUMNS).single();
    if (error) throw new Error(error.message);
    contentCache.put(userId, book.id, { content: book.content, document: book.document });
    return { ...book, ...mapDbBookToBook(data), content: book.content, document: book.document,
      hasContent: Boolean(book.content?.trim()), annotations: book.annotations || [], annotationCount: book.annotations?.length ?? book.annotationCount ?? 0 };
  },

  async deleteBook(id: string, userId: string) {
    const { data, error } = await supabase.from('books').delete()
      .eq('id', id).eq('user_id', userId).select('id').single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Книга не найдена');
    contentCache.invalidate(userId, id);
  },
};
