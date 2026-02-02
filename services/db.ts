
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

  async searchUserByEmail(email: string) {
    const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    return data ? mapProfileToUser(data) : null;
  },

  async getFeed(limit: number = 15): Promise<Activity[]> {
    const { data } = await supabase.from('activities')
      .select(`*, profiles:user_id (*), books:book_id (*)`)
      .order('created_at', { ascending: false })
      .limit(limit);
      
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

  async deleteComment(activityId: string, commentId: string) {
    const { data } = await supabase.from('activities').select('comments').eq('id', activityId).maybeSingle();
    if (!data || !data.comments) return;
    const updatedComments = data.comments.filter((c: any) => c.id !== commentId);
    await supabase.from('activities').update({ comments: updatedComments }).eq('id', activityId);
  },

  async deleteActivity(id: string) { await supabase.from('activities').delete().eq('id', id); },

  async getLeaderboard(limit: number = 5): Promise<User[]> {
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (!profiles) return [];
    
    const { data: counts } = await supabase
      .from('books')
      .select('user_id')
      .eq('status', 'completed');

    const bookCounts: Record<string, number> = {};
    counts?.forEach((b: any) => {
      bookCounts[b.user_id] = (bookCounts[b.user_id] || 0) + 1;
    });

    const users = profiles.map((p: any) => {
      const u = mapProfileToUser(p);
      u.booksReadThisYear = bookCounts[p.id] || 0;
      return u;
    });

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

  /**
   * Fetches all chats for a given user, including participant profiles.
   */
  async getChats(userId: string): Promise<Chat[]> {
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId);
    
    if (!participants || participants.length === 0) return [];
    
    const chatIds = participants.map(p => p.chat_id);
    
    const { data: chatsData } = await supabase
      .from('chats')
      .select(`
        *,
        chat_participants (
          user_id,
          profiles:user_id (*)
        )
      `)
      .in('id', chatIds)
      .order('updated_at', { ascending: false });
      
    return (chatsData || []).map((c: any) => ({
      id: c.id,
      lastMessage: c.last_message,
      updatedAt: c.updated_at,
      participants: c.chat_participants.map((cp: any) => mapProfileToUser(cp.profiles))
    }));
  },

  /**
   * Fetches all messages belonging to a specific chat ID.
   */
  async getMessages(chatId: string): Promise<Message[]> {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
      
    return (data || []).map((m: any) => ({
      id: m.id,
      chatId: m.chat_id,
      senderId: m.sender_id,
      content: m.content,
      createdAt: m.created_at,
      isRead: m.is_read
    }));
  },

  /**
   * Inserts a new message and updates the corresponding chat's last message timestamp.
   */
  async sendMessage(chatId: string, senderId: string, content: string) {
    const { error } = await supabase.from('messages').insert([{
      chat_id: chatId,
      sender_id: senderId,
      content
    }]);
    if (error) throw error;
    
    await supabase.from('chats').update({ 
      last_message: content, 
      updated_at: new Date().toISOString() 
    }).eq('id', chatId);
  },

  /**
   * Creates a new chat between two users, or returns an existing one if they already share a chat.
   */
  async createChat(userId1: string, userId2: string): Promise<Chat> {
    const { data: p1 } = await supabase.from('chat_participants').select('chat_id').eq('user_id', userId1);
    const { data: p2 } = await supabase.from('chat_participants').select('chat_id').eq('user_id', userId2);
    
    const commonChatId = p1?.find(cp1 => p2?.some(cp2 => cp2.chat_id === cp1.chat_id))?.chat_id;
    
    if (commonChatId) {
      const allChats = await this.getChats(userId1);
      return allChats.find(c => c.id === commonChatId)!;
    }

    const { data: chat, error } = await supabase.from('chats').insert([{}]).select().single();
    if (error) throw error;
    
    await supabase.from('chat_participants').insert([
      { chat_id: chat.id, user_id: userId1 },
      { chat_id: chat.id, user_id: userId2 }
    ]);
    
    const allChats = await this.getChats(userId1);
    return allChats.find(c => c.id === chat.id)!;
  },

  /**
   * Removes a user from a chat. In a real-world scenario, this might also delete the chat if empty.
   */
  async deleteChat(chatId: string, userId: string) {
    await supabase.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', userId);
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
