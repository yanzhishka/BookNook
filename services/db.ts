
import { supabase } from './supabaseClient';
import { User, Book, Quote, Activity, Comment, Annotation, Chat, Message } from '../types';

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
  xp: profile.xp || 0,
  level: profile.level || 1,
} as User);

const mapDbBookToBook = (b: any, allQuotes: any[] = []): Book => {
  const bookQuotes = allQuotes
    .filter(q => (q.book_id === b.id || q.bookId === b.id))
    .map(q => {
      const rawTime = q.timestamp || q.created_at;
      const timestamp = typeof rawTime === 'number' ? rawTime : new Date(rawTime).getTime();
      
      return {
        id: q.id,
        quote: q.text || q.quote || '',
        comment: q.comment || '',
        color: q.color || 'amber',
        timestamp: timestamp || Date.now()
      };
    });

  return {
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
    annotations: bookQuotes,
    tags: []
  };
};

export const db = {
  async getSession(): Promise<{ user: User, books: Book[], quotes: Quote[] } | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return await this.loadUserData(session.user.id);
  },

  async loadUserData(userId: string): Promise<{ user: User, books: Book[], quotes: Quote[] }> {
    if (!userId) throw new Error("User ID is required");

    const [profileRes, booksRes, quotesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('books').select('*').eq('user_id', userId),
      supabase.from('quotes').select('*').eq('user_id', userId)
    ]);

    const profile = profileRes.data;
    const books = booksRes.data || [];
    const quotes = quotesRes.data || [];

    const user = mapProfileToUser(profile || { id: userId });
    user.booksReadThisYear = books.filter((b: any) => b.status === 'completed').length;

    return {
      user,
      books: books.map(b => mapDbBookToBook(b, quotes)),
      quotes: quotes.map((q: any) => ({
        ...q,
        bookId: q.book_id,
        bookTitle: q.book_title
      }))
    };
  },

  /* XP System Logic */
  async addXp(userId: string, amount: number) {
    try {
      // Refresh current XP from server to avoid race conditions
      const { data: profile, error: fetchError } = await supabase.from('profiles').select('xp, level').eq('id', userId).single();
      
      if (fetchError) {
        console.warn("Could not fetch profile for XP update (table schema might be missing columns?):", fetchError);
        return;
      }

      if (!profile) return;

      let currentXp = profile.xp || 0;
      let currentLevel = profile.level || 1;
      
      let newXp = currentXp + amount;
      const threshold = 1000;

      while (newXp >= threshold) {
        currentLevel += 1;
        newXp -= threshold;
      }

      console.log(`Updating DB XP: ${currentXp} + ${amount} -> ${newXp} (Lvl ${currentLevel})`);
      
      const { error: updateError } = await supabase.from('profiles').update({ xp: newXp, level: currentLevel }).eq('id', userId);
      
      if (updateError) {
        console.error("Supabase XP update failed. Is table schema correct?", updateError);
      }
    } catch (e) {
      console.error("Critical error in addXp logic:", e);
    }
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
      avatar: `https://ui-avatars.com/api/?name=${name}`,
      xp: 0,
      level: 1
    };
    await supabase.from('profiles').upsert([profile]);
    return mapProfileToUser(profile);
  },

  async logout() { await supabase.auth.signOut(); },

  async searchUserByEmail(email: string) {
    const { data } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    return data ? mapProfileToUser(data) : null;
  },

  /* Feed & Activities */
  async getFeed(limit: number = 15): Promise<Activity[]> {
    const { data } = await supabase.from('activities').select(`*, profiles:user_id (*), books:book_id (*)`).order('created_at', { ascending: false }).limit(limit);
    return (data || []).map((item: any) => ({
      id: item.id, user: mapProfileToUser(item.profiles), book: item.books ? mapDbBookToBook(item.books) : null,
      type: item.type, content: item.content, timestamp: new Date(item.created_at).toLocaleDateString(),
      likes: (item.liked_by || []).length, likedBy: item.liked_by || [], comments: item.comments || []
    }));
  },

  async createActivity(activity: Activity): Promise<Activity> {
    const { data, error } = await supabase.from('activities').insert([{
      user_id: activity.user.id, book_id: activity.book?.id, type: activity.type, content: activity.content, liked_by: [], comments: []
    } ]).select().single();
    if (error) throw error;
    return { ...activity, id: data.id, timestamp: new Date(data.created_at).toLocaleDateString() };
  },

  async shareAnnotation(user: User, book: Book, annotation: Annotation): Promise<Activity> {
    return this.createActivity({
      id: '', user, book, type: 'note', content: `${annotation.quote}\n\n— ${annotation.comment}`,
      timestamp: 'Только что', likes: 0, likedBy: [], comments: []
    });
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
    await supabase.from('activities').update({ comments: data.comments.filter((c: any) => c.id !== commentId) }).eq('id', activityId);
  },

  async deleteActivity(id: string) { await supabase.from('activities').delete().eq('id', id); },

  async getLeaderboard(limit: number = 5): Promise<User[]> {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: counts } = await supabase.from('books').select('user_id').eq('status', 'completed');
    const bookCounts: Record<string, number> = {};
    counts?.forEach((b: any) => { bookCounts[b.user_id] = (bookCounts[b.user_id] || 0) + 1; });
    const users = (profiles || []).map((p: any) => {
      const u = mapProfileToUser(p);
      u.booksReadThisYear = bookCounts[p.id] || 0;
      return u;
    });
    return users.sort((a, b) => b.booksReadThisYear - a.booksReadThisYear).slice(0, limit === -1 ? undefined : limit);
  },

  /* Books & Annotations Sync */
  async addBook(book: Book, userId: string) {
    const payload = { 
      user_id: userId, title: book.title, author: book.author, cover_url: book.coverUrl, 
      progress: Number(book.progress) || 0, status: book.status, my_rating: Number(book.myRating) || 0, 
      content: book.content, current_page: Number(book.currentPage) || 1, total_pages: Number(book.totalPages) || 1
    };
    const { data, error } = await supabase.from('books').insert([payload]).select().single();
    if (error) throw error;
    
    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(data.id, userId, book.title, annotations);
    }
    
    return mapDbBookToBook(data, annotations);
  },

  async syncAnnotations(bookId: string, userId: string, bookTitle: string, annotations: Annotation[]): Promise<any[]> {
    const updatedAnnotations: any[] = [];

    for (const ann of annotations) {
      const isUUID = ann.id.includes('-') || ann.id.length > 20;
      
      const payload: any = {
        user_id: userId,
        book_id: bookId,
        book_title: bookTitle,
        text: ann.quote,
        comment: ann.comment,
        color: ann.color,
        timestamp: Number(ann.timestamp) || Date.now()
      };

      if (isUUID) {
        payload.id = ann.id;
      }

      try {
        const { data, error } = await supabase.from('quotes').upsert([payload]).select().single();
        if (error) throw error;
        updatedAnnotations.push({
          ...ann,
          id: data.id,
          book_id: bookId 
        });
      } catch (e) {
        console.error("Failed to sync specific quote:", payload, e);
        updatedAnnotations.push({ ...ann, book_id: bookId });
      }
    }
    return updatedAnnotations;
  },

  async deleteAnnotation(annId: string) {
    if (!annId || annId.length < 20) return;
    await supabase.from('quotes').delete().eq('id', annId);
  },

  async updateBook(book: Book, userId: string): Promise<Book> {
    if (!book.id) throw new Error("Book ID is required for update");
    
    const payload = {
      progress: Number(book.progress) || 0, 
      status: book.status, 
      my_rating: Number(book.myRating) || 0, 
      current_page: Number(book.currentPage) || 1,
      total_pages: Number(book.totalPages) || 1
    };
    
    const { data: bookData, error } = await supabase.from('books').update(payload).eq('id', book.id).select().single();
    if (error) throw error;

    let annotations = book.annotations || [];
    if (annotations.length > 0) {
      annotations = await this.syncAnnotations(book.id, userId, book.title, annotations);
    }

    return mapDbBookToBook(bookData, annotations);
  },

  async deleteBook(id: string) { 
    await supabase.from('quotes').delete().eq('book_id', id);
    await supabase.from('activities').delete().eq('book_id', id);
    await supabase.from('books').delete().eq('id', id);
  },

  async updateUserProfile(user: User) {
    // Note: XP and Level are handled by global awardXp and addXp logic.
    // We only update bio/profile fields here.
    const { error } = await supabase.from('profiles').update({ 
      name: user.name, 
      bio: user.bio, 
      location: user.location, 
      avatar: user.avatar, 
      banner_url: user.bannerUrl
    }).eq('id', user.id);

    if (error) {
      console.error("Supabase profile update error:", error);
      throw error;
    }
  },

  /* Chats Logic */
  async getChats(userId: string): Promise<Chat[]> {
    const { data: participants } = await supabase.from('participants').select('chat_id').eq('user_id', userId);
    if (!participants || participants.length === 0) return [];
    const chatIds = participants.map(p => p.chat_id);
    const { data: chatsData } = await supabase.from('chats').select('*, participants:participants(profiles:user_id(*))').in('id', chatIds);
    return (chatsData || []).map((c: any) => ({
      id: c.id, lastMessage: c.last_message,
      participants: (c.participants || []).map((p: any) => mapProfileToUser(p.profiles))
    }));
  },

  async getMessages(chatId: string): Promise<Message[]> {
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    return (data || []).map((m: any) => ({
      id: m.id, chatId: m.chat_id, senderId: m.sender_id, content: m.content, createdAt: m.created_at, isRead: m.is_read
    }));
  },

  async sendMessage(chatId: string, senderId: string, content: string) {
    await supabase.from('messages').insert([{ chat_id: chatId, sender_id: senderId, content }]);
    await supabase.from('chats').update({ last_message: content }).eq('id', chatId);
  },

  async createChat(userId1: string, userId2: string): Promise<Chat> {
    const { data: newChat } = await supabase.from('chats').insert([{ last_message: '' }]).select().single();
    await supabase.from('participants').insert([{ chat_id: newChat.id, user_id: userId1 }, { chat_id: newChat.id, user_id: userId2 }]);
    const { data: fullChat } = await supabase.from('chats').select('*, participants:participants(profiles:user_id(*))').eq('id', newChat.id).single();
    return { id: fullChat.id, lastMessage: fullChat.last_message, participants: fullChat.participants.map((p: any) => mapProfileToUser(p.profiles)) };
  },

  async deleteChat(chatId: string, userId: string) {
    await supabase.from('participants').delete().eq('chat_id', chatId).eq('user_id', userId);
  }
};
