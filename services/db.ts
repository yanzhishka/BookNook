
import { supabase } from './supabaseClient';
import { User, Book, Quote, Activity, Comment, Chat, Message } from '../types';

export const ADMIN_EMAIL = 'nme030609@gmail.com';

export interface UserData {
  profile: User;
  email: string;
  id: string;
  password?: string;
}

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  email: profile.email, 
  name: profile.name || 'User',
  handle: profile.handle || profile.email?.split('@')[0] || 'user',
  avatar: profile.avatar || `https://ui-avatars.com/api/?name=User&background=random`,
  bannerUrl: profile.banner_url,
  bio: profile.bio,
  location: profile.location,
  joinedDate: profile.joined_date,
  booksReadThisYear: 0,
  streakDays: profile.streak_days || 0,
  totalReadingTime: profile.total_reading_time || 0,
});

const mapDbBookToBook = (b: any): Book => ({
  id: b.id,
  title: b.title,
  author: b.author,
  coverUrl: b.cover_url,
  progress: b.progress || 0,
  status: b.status || 'want_to_read',
  myRating: b.my_rating || 0,
  content: b.content,
  currentPage: b.current_page || 1,
  totalPages: b.total_pages || 1,
  annotations: b.annotations || []
});

export const db = {
  async getSession(): Promise<{ user: User, books: Book[], quotes: Quote[] } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return await this.loadUserData(session.user.id);
  },

  async loadUserData(userId: string): Promise<{ user: User, books: Book[], quotes: Quote[] }> {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    const { data: books } = await supabase.from('books').select('*').eq('user_id', userId);
    const { data: quotes } = await supabase.from('quotes').select('*').eq('user_id', userId);

    const user = mapProfileToUser(profile || { id: userId });
    user.booksReadThisYear = books?.filter((b: any) => b.status === 'completed').length || 0;

    return {
      user,
      books: (books || []).map(mapDbBookToBook),
      quotes: (quotes || []).map((q: any) => ({
        ...q,
        bookId: q.book_id,
        bookTitle: q.book_title
      }))
    };
  },

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return this.loadUserData(data.user.id);
  },

  async register(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) throw error;
    const profile = { 
      id: data.user!.id, 
      email, 
      name, 
      handle: email.split('@')[0], 
      avatar: `https://ui-avatars.com/api/?name=${name}` 
    };
    await supabase.from('profiles').upsert([profile]);
    return mapProfileToUser(profile);
  },

  async logout() { await supabase.auth.signOut(); },

  async deleteChat(chatId: string): Promise<void> {
    await supabase.from('messages').delete().eq('chat_id', chatId);
    await supabase.from('chat_participants').delete().eq('chat_id', chatId);
    const { error: chatErr } = await supabase.from('chats').delete().eq('id', chatId);
    if (chatErr) throw new Error("Не удалось удалить чат");
  },

  async getChats(userId: string): Promise<Chat[]> {
    const { data: partRecs } = await supabase.from('chat_participants').select('chat_id').eq('user_id', userId);
    if (!partRecs || partRecs.length === 0) return [];
    
    const chatIds = partRecs.map(r => r.chat_id);
    const { data, error } = await supabase.from('chats')
      .select(`*, messages (content, created_at), chat_participants (profiles (*))`)
      .in('id', chatIds)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data.map((c: any) => ({
      id: c.id,
      updatedAt: c.updated_at,
      participants: c.chat_participants.map((p: any) => mapProfileToUser(p.profiles)),
      lastMessage: c.messages?.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.content || '...'
    }));
  },

  async sendMessage(chatId: string, senderId: string, content: string): Promise<Message> {
    const { data, error } = await supabase.from('messages').insert([{ chat_id: chatId, sender_id: senderId, content }]).select().single();
    if (error) throw error;
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
    return {
      id: data.id,
      chatId: data.chat_id,
      senderId: data.sender_id,
      content: data.content,
      createdAt: data.created_at,
      isRead: data.is_read
    };
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    return (data || []).map((m: any) => ({
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      content: m.content,
      createdAt: m.created_at,
      isRead: m.is_read
    }));
  },

  async createChat(targetUserId: string, currentUserId: string): Promise<Chat> {
    const chatId = crypto.randomUUID();
    const { error: chatErr } = await supabase.from('chats').insert({ id: chatId });
    if (chatErr) throw chatErr;
    
    const { error: partErr } = await supabase.from('chat_participants').insert([
      { chat_id: chatId, user_id: currentUserId },
      { chat_id: chatId, user_id: targetUserId }
    ]);
    if (partErr) throw partErr;

    return this.getChatById(chatId);
  },

  async getChatById(chatId: string): Promise<Chat> {
    const { data, error } = await supabase.from('chats').select(`*, chat_participants (profiles (*))`).eq('id', chatId).single();
    if (error) throw error;
    return {
      id: data.id,
      updatedAt: data.updated_at,
      participants: data.chat_participants.map((p: any) => mapProfileToUser(p.profiles)),
      lastMessage: ''
    };
  },

  async searchUserByEmail(email: string) {
    const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    return data ? mapProfileToUser(data) : null;
  },

  async getFeed(): Promise<Activity[]> {
    const { data } = await supabase.from('activities')
      .select(`*, profiles:user_id (*), books:book_id (*)`)
      .order('created_at', { ascending: false });
    return (data || []).map((item: any) => ({
      id: item.id,
      user: mapProfileToUser(item.profiles),
      book: item.books ? mapDbBookToBook(item.books) : null,
      type: item.type,
      content: item.content,
      timestamp: new Date(item.created_at).toLocaleDateString(),
      likes: (item.liked_by || []).length,
      likedBy: item.liked_by || [],
      comments: item.comments || []
    }));
  },

  async createActivity(activity: Activity): Promise<Activity> {
    const { data, error } = await supabase.from('activities').insert([{
      user_id: activity.user.id,
      book_id: activity.book?.id,
      type: activity.type,
      content: activity.content,
      liked_by: [],
      comments: []
    }]).select().single();
    if (error) throw error;
    return { ...activity, id: data.id, timestamp: new Date(data.created_at).toLocaleDateString() };
  },

  async toggleActivityLike(activityId: string, userId: string) {
    const { data } = await supabase.from('activities').select('liked_by').eq('id', activityId).maybeSingle();
    if (!data) return;
    let likes = data.liked_by || [];
    likes = likes.includes(userId) ? likes.filter((id: string) => id !== userId) : [...likes, userId];
    await supabase.from('activities').update({ liked_by: likes }).eq('id', activityId);
  },

  async addComment(activityId: string, comment: Comment) {
    const { data } = await supabase.from('activities').select('comments').eq('id', activityId).maybeSingle();
    if (!data) return;
    await supabase.from('activities').update({ comments: [...(data.comments || []), comment] }).eq('id', activityId);
  },

  async deleteActivity(id: string) { await supabase.from('activities').delete().eq('id', id); },

  async getLeaderboard(limit: number = 5): Promise<User[]> {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (!profiles) return [];
    const users = await Promise.all(profiles.map(async (p: any) => {
      const { count } = await supabase.from('books').select('*', { count: 'exact', head: true })
        .eq('user_id', p.id).eq('status', 'completed');
      const u = mapProfileToUser(p);
      u.booksReadThisYear = count || 0;
      return u;
    }));
    const sorted = users.sort((a, b) => b.booksReadThisYear - a.booksReadThisYear);
    return limit === -1 ? sorted : sorted.slice(0, limit);
  },

  async addBook(book: Book, userId: string) {
    const payload = { 
      user_id: userId, 
      title: book.title, 
      author: book.author, 
      cover_url: book.coverUrl, 
      progress: Number(book.progress) || 0, 
      status: book.status, 
      my_rating: Number(book.myRating) || 0, 
      content: book.content, 
      current_page: Number(book.currentPage) || 1, 
      total_pages: Number(book.totalPages) || 1 
    };
    const { data, error } = await supabase.from('books').insert([payload]).select().single();
    if (error) throw error;
    return mapDbBookToBook(data);
  },

  async updateBook(book: Book) {
    // Fix: line 256 used book.my_rating (snake_case) instead of book.myRating (camelCase)
    await supabase.from('books').update({ 
      progress: Number(book.progress) || 0, 
      status: book.status, 
      my_rating: Number(book.myRating) || 0, 
      current_page: Number(book.currentPage) || 1,
      total_pages: Number(book.totalPages) || 1
    }).eq('id', book.id);
  },

  async deleteBook(id: string) { 
    await supabase.from('activities').delete().eq('book_id', id);
    await supabase.from('books').delete().eq('id', id);
  },

  async updateUserProfile(user: User) {
    await supabase.from('profiles').update({ 
      name: user.name, 
      bio: user.bio, 
      location: user.location, 
      avatar: user.avatar, 
      banner_url: user.bannerUrl,
      total_reading_time: user.totalReadingTime
    }).eq('id', user.id);
  },

  async getAllUsersData(): Promise<UserData[]> {
    const { data } = await supabase.from('profiles').select('*');
    return (data || []).map(p => ({ 
      profile: mapProfileToUser(p), 
      email: p.email, 
      id: p.id,
      password: p.password 
    }));
  },

  async deleteUser(id: string) { await supabase.from('profiles').delete().eq('id', id); }
};
