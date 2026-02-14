
import React, { useEffect, useState, useCallback, memo } from 'react';
import { Activity, User, Book, Comment } from '../types';
import { MessageSquare, Heart, BookOpen, Trophy, Loader2, Send, PenTool, Trash2, Quote as QuoteIcon, ChevronDown } from 'lucide-react';
import { db, ADMIN_EMAIL } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

interface FeedProps {
    user: User;
    books: Book[];
    onRequireLogin?: () => void;
    onPostCreated?: () => void;
    onViewProfile?: (userId: string) => void;
    onUpdateUser?: (user: User) => void;
    awardXp?: (amount: number) => void;
}

const ActivityItem = memo(({ activity, user, isAdmin, onLike, onCommentClick, activeCommentId, commentText, setCommentText, onSubmitComment, submittingComment, setDeleteTarget, onViewProfile }: any) => {
    const isLiked = activity.likedBy.includes(user.id);
    const showComments = activeCommentId === activity.id;
    const canDeleteActivity = isAdmin || activity.user.id === user.id;

    return (
        <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] shadow-sm border border-stone-100 dark:border-stone-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 animate-fade-in-up overflow-hidden">
            <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4 cursor-pointer group/user" onClick={() => onViewProfile?.(activity.user.id)}>
                        <img src={activity.user.avatar} loading="lazy" className="w-12 h-12 rounded-full object-cover ring-2 ring-stone-100 dark:ring-stone-800 group-hover/user:scale-110 transition-transform" alt="" />
                        <div>
                            <p className="font-black text-stone-800 dark:text-stone-100 leading-none mb-1 group-hover/user:text-amber-500 transition-colors">{activity.user.name}</p>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{activity.timestamp}</p>
                        </div>
                    </div>
                    {canDeleteActivity && (
                        <button onClick={() => setDeleteTarget({type: 'post', id: activity.id})} className="p-3 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                <div className={`relative ${!activity.book ? 'bg-stone-50 dark:bg-stone-850 p-8 rounded-3xl border border-stone-100 dark:border-stone-800/50' : ''}`}>
                    {!activity.book && <QuoteIcon className="absolute top-4 left-4 text-stone-200 dark:text-stone-800 w-12 h-12 opacity-30" />}
                    <div className={`text-stone-800 dark:text-stone-100 leading-relaxed font-serif relative z-10 ${!activity.book ? 'text-2xl italic font-medium whitespace-pre-line' : 'text-xl mb-6 whitespace-pre-line'}`}>
                        {activity.content}
                    </div>
                    {activity.book && (
                        <div className="bg-stone-50 dark:bg-stone-850 p-5 rounded-2xl flex gap-6 border border-stone-100 dark:border-stone-800/50 group/book cursor-pointer hover:bg-white dark:hover:bg-stone-800 transition-all duration-300">
                            <img src={activity.book.coverUrl} loading="lazy" className="w-16 h-24 object-cover rounded shadow-lg group-hover/book:scale-105 transition-transform" />
                            <div className="flex flex-col justify-center">
                                <h4 className="font-serif font-black text-stone-800 dark:text-stone-100 mb-1 leading-tight group-hover/book:text-amber-600 transition-colors">{activity.book.title}</h4>
                                <p className="text-sm text-stone-500 font-medium">от {activity.book.author}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 flex items-center gap-8">
                    <button onClick={() => onLike(activity.id)} className={`flex items-center gap-2.5 transition-all group/btn ${isLiked ? 'text-rose-500 scale-110' : 'text-stone-400 hover:text-rose-500'}`}><Heart size={20} className={isLiked ? 'fill-current' : 'group-hover/btn:scale-125 transition-transform'} /><span className="text-xs font-black uppercase tracking-widest">{activity.likes}</span></button>
                    <button onClick={() => onCommentClick(showComments ? null : activity.id)} className={`flex items-center gap-2.5 transition-all hover:text-stone-900 dark:hover:text-stone-100 ${showComments ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}><MessageSquare size={20} /><span className="text-xs font-black uppercase tracking-widest">{activity.comments?.length || 0}</span></button>
                </div>
            </div>

            {showComments && (
                <div className="bg-stone-50 dark:bg-stone-950/50 p-8 border-t border-stone-100 dark:border-stone-800 animate-fade-in">
                    <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                        {activity.comments?.map((comment: any) => (
                            <div key={comment.id} className="flex gap-4 group/comment animate-fade-in-up">
                                <img src={comment.userAvatar} onClick={() => onViewProfile?.(comment.userId)} loading="lazy" className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer hover:scale-110 transition-transform" alt="" />
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-sm font-black text-stone-800 dark:text-stone-100 cursor-pointer hover:text-amber-500" onClick={() => onViewProfile?.(comment.userId)}>{comment.userName}</p>
                                        {(isAdmin || comment.userId === user.id) && (
                                            <button onClick={() => setDeleteTarget({ type: 'comment', id: comment.id, parentId: activity.id })} className="p-1.5 text-stone-300 hover:text-red-500 opacity-0 group-hover/comment:opacity-100 transition-all"><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                    <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl rounded-tl-none shadow-sm border border-stone-100 dark:border-stone-800"><p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{comment.text}</p></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4 items-center"><img src={user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" /><div className="flex-1 relative"><input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSubmitComment(activity.id)} placeholder="Оставить комментарий..." className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl px-6 py-3 text-sm outline-none" /><button onClick={() => onSubmitComment(activity.id)} disabled={!commentText.trim() || submittingComment === activity.id} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl disabled:opacity-50">{submittingComment === activity.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button></div></div>
                </div>
            )}
        </div>
    );
});

export const Feed: React.FC<FeedProps> = ({ user, books, onRequireLogin, onPostCreated, onViewProfile, onUpdateUser, awardXp }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isGuest = user.id === 'guest';
  const isAdmin = user.handle === ADMIN_EMAIL;
  
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [isPosting, setIsPosting] = useState(false);

  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'comment'; id: string; parentId?: string } | null>(null);

  const loadData = useCallback(async () => {
      try {
          const [feedData, leaderboardData] = await Promise.all([
            db.getFeed(15), 
            db.getLeaderboard(5)
          ]);
          setActivities(feedData);
          setLeaderboard(leaderboardData);
      } catch (e) {
          console.error("Failed to load feed data", e);
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePostSubmit = async () => {
      if (!newPostContent.trim()) return;
      const selectedBook = selectedBookId ? books.find(b => b.id === selectedBookId) : null;
      setIsPosting(true);
      const tempActivity: Activity = { id: 'temp-' + Date.now(), user, book: selectedBook || null, type: selectedBook ? 'note' : 'review', content: newPostContent, timestamp: 'Только что', likes: 0, likedBy: [], comments: [] };
      try {
          const createdActivity = await db.createActivity(tempActivity);
          setActivities(prev => [createdActivity, ...prev]);
          setNewPostContent('');
          setSelectedBookId('');
          
          // Global XP awarding
          awardXp?.(20);

          if (onPostCreated) onPostCreated();
      } catch (e) {
          console.error("Failed to post", e);
      } finally { setIsPosting(false); }
  };

  const handleLike = useCallback(async (activityId: string) => {
      if (isGuest) { onRequireLogin?.(); return; }
      setActivities(prev => prev.map(act => {
          if (act.id === activityId) {
              const isLiked = act.likedBy.includes(user.id);
              return { ...act, likes: isLiked ? act.likes - 1 : act.likes + 1, likedBy: isLiked ? act.likedBy.filter(id => id !== user.id) : [...act.likedBy, user.id] };
          }
          return act;
      }));
      db.toggleActivityLike(activityId, user.id);
  }, [isGuest, user.id, onRequireLogin]);

  const handleSubmitComment = async (activityId: string) => {
      if (isGuest) { onRequireLogin?.(); return; }
      if (!commentText.trim()) return;
      setSubmittingComment(activityId);
      const newComment: Comment = { id: Date.now().toString(), userId: user.id, userName: user.name, userAvatar: user.avatar, text: commentText, timestamp: 'Только что' };
      try {
          await db.addComment(activityId, newComment);
          setActivities(prev => prev.map(act => { if (act.id === activityId) return { ...act, comments: [...(act.comments || []), newComment] }; return act; }));
          setCommentText('');

          // Global XP awarding
          awardXp?.(5);

      } finally { setSubmittingComment(null); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto pb-20">
      <ConfirmDialog isOpen={!!deleteTarget} title={deleteTarget?.type === 'post' ? "Удалить пост" : "Удалить комментарий"} message="Вы уверены?" onConfirm={async () => { if (deleteTarget?.type === 'post') { await db.deleteActivity(deleteTarget.id); setActivities(prev => prev.filter(a => a.id !== deleteTarget.id)); } else if (deleteTarget?.type === 'comment' && deleteTarget.parentId) { await db.deleteComment(deleteTarget.parentId, deleteTarget.id); setActivities(prev => prev.map(act => { if (act.id === deleteTarget.parentId) return { ...act, comments: act.comments.filter(c => c.id !== deleteTarget.id) }; return act; })); } setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />
      <div className="lg:col-span-2 space-y-8">
        <div className="mb-10 animate-fade-in-up">
          <h2 className="text-5xl font-serif font-black text-stone-800 dark:text-stone-100 tracking-tighter mb-3">Сообщество</h2>
          <p className="text-stone-500 dark:text-stone-400 text-lg">Мысли, цитаты и книжные открытия в одном месте.</p>
        </div>

        {/* Updated Post Creation Area */}
        <div className="bg-white dark:bg-[#110f0e] rounded-[2.5rem] p-10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] dark:shadow-none border border-stone-100 dark:border-stone-850 animate-fade-in-up mb-12 relative overflow-hidden group">
            {isGuest && (
                <div className="absolute inset-0 bg-white/70 dark:bg-stone-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-8">
                    <button onClick={onRequireLogin} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-all">Войти</button>
                </div>
            )}
            <div className={`flex flex-col gap-8 ${isGuest ? 'blur-sm' : ''}`}>
                <div className="flex gap-6 items-start">
                    <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover ring-4 ring-stone-50 dark:ring-stone-800/30 shrink-0" />
                    <textarea 
                        value={newPostContent} 
                        onChange={(e) => setNewPostContent(e.target.value)} 
                        placeholder="О чем вы думаете?" 
                        className="flex-1 bg-transparent border-none text-2xl text-stone-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-800 outline-none resize-none min-h-[120px] font-serif py-2" 
                    />
                </div>
                <div className="h-px bg-stone-100 dark:bg-stone-850 w-full"></div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="relative w-full md:w-80 group/select">
                        <select 
                            value={selectedBookId} 
                            onChange={(e) => setSelectedBookId(e.target.value)} 
                            className="w-full appearance-none bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-400 text-[10px] font-black uppercase tracking-[0.2em] px-6 py-4 rounded-2xl outline-none border border-stone-100 dark:border-stone-800 cursor-pointer pr-12 group-hover/select:border-amber-500/50 transition-colors"
                        >
                            <option value="">Без привязки к книге</option>
                            {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none" size={16} />
                    </div>
                    <button 
                        onClick={handlePostSubmit} 
                        disabled={!newPostContent.trim() || isPosting} 
                        className="w-full md:w-auto bg-[#c7b9a5] dark:bg-stone-100 text-stone-900 px-12 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all hover:scale-[1.02] shadow-xl disabled:opacity-30 disabled:scale-100"
                    >
                        {isPosting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        Опубликовать
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-8 min-h-[500px]">
            {loading ? [1,2,3].map(i => (
                <div key={i} className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 border border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full skeleton" />
                        <div className="space-y-2">
                            <div className="h-3 w-32 skeleton rounded" />
                            <div className="h-2 w-20 skeleton rounded" />
                        </div>
                    </div>
                    <div className="h-4 w-full skeleton rounded mb-4" />
                    <div className="h-4 w-3/4 skeleton rounded" />
                </div>
            )) : activities.length === 0 ? (
                <div className="text-center py-24 bg-stone-50 dark:bg-stone-900/30 rounded-[3rem] border-2 border-dashed border-stone-200 dark:border-stone-800">
                    <PenTool size={48} className="mx-auto mb-6 text-stone-300 dark:text-stone-700" />
                    <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-widest text-sm">Здесь пока пусто.</p>
                </div>
            ) : (
                activities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} user={user} isAdmin={isAdmin} onLike={handleLike} onCommentClick={setActiveCommentId} activeCommentId={activeCommentId} commentText={commentText} setCommentText={setCommentText} onSubmitComment={handleSubmitComment} submittingComment={submittingComment} setDeleteTarget={setDeleteTarget} onViewProfile={onViewProfile} />
                ))
            )}
        </div>
      </div>
      <div className="hidden lg:block space-y-8">
        <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] shadow-sm border border-stone-100 dark:border-stone-800 sticky top-24 animate-slide-in-right">
            <h3 className="font-serif font-black text-2xl text-stone-800 dark:text-stone-100 flex items-center gap-3 mb-8"><Trophy size={24} className="text-amber-500" />Лидеры</h3>
            <div className="space-y-6 mb-10">
                {loading ? [1,2,3].map(i => (<div key={i} className="flex items-center gap-4"><div className="w-4 h-4 skeleton rounded" /><div className="w-12 h-12 rounded-full skeleton" /><div className="flex-1 space-y-2"><div className="h-2 w-20 skeleton rounded" /><div className="h-2 w-full skeleton rounded" /></div></div>)) : leaderboard.map((reader, idx) => (
                    <div key={reader.id} className="flex items-center gap-4 group cursor-pointer" onClick={() => onViewProfile?.(reader.id)}>
                        <div className={`font-black w-4 text-center text-sm ${idx === 0 ? 'text-amber-500' : 'text-stone-300 dark:text-stone-700'}`}>{idx + 1}</div>
                        <img src={reader.avatar} loading="lazy" alt={reader.name} className="w-12 h-12 rounded-full object-cover group-hover:scale-110 transition-transform" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-black text-stone-800 dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors">{reader.name}</p><p className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1"><BookOpen size={10} /> {reader.booksReadThisYear} прочитано</p></div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};
