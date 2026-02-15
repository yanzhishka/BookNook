
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Thread, ThreadReply, User } from '../types';
import { db, ADMIN_EMAIL } from '../services/db';
import { Identicon } from './Identicon';
import { MessageSquare, Plus, Eye, Flame, Clock, Loader2, Send, X, Camera, MessageCircle, Trash2 } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface BoardProps {
  user: User;
  onRequireLogin?: () => void;
}

export const Board: React.FC<BoardProps> = ({ user, onRequireLogin }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [expandedImgId, setExpandedImgId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'thread' | 'reply'; id: string; parentId?: string } | null>(null);
  
  // Create Thread State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Reply State (Inside Modal)
  const [replyContent, setReplyContent] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [threadReplies, setThreadReplies] = useState<Record<string, ThreadReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const repliesScrollContainerRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.email === ADMIN_EMAIL;

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getThreads();
      setThreads(data);
    } catch (e) {
      console.error("Failed to load threads", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const scrollToTopReplies = () => {
    if (repliesScrollContainerRef.current) {
      repliesScrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isReply: boolean = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isReply) setReplyImage(reader.result as string);
        else setNewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.id === 'guest') { onRequireLogin?.(); return; }
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsCreating(true);
    try {
      const created = await db.createThread(newTitle, newContent, newImage, user.id, user.name);
      setThreads(prev => [created, ...prev]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      setNewImage(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const openThreadModal = async (threadId: string) => {
    setActiveThreadId(threadId);
    if (!threadReplies[threadId]) {
      setLoadingReplies(threadId);
      try {
        const replies = await db.getThreadReplies(threadId);
        setThreadReplies(prev => ({ ...prev, [threadId]: replies.reverse() }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingReplies(null);
      }
    }
  };

  const handlePostReply = async (threadId: string) => {
    if (user.id === 'guest') { onRequireLogin?.(); return; }
    if (!replyContent.trim()) return;

    setIsReplying(true);
    try {
      const reply = await db.postReply(threadId, replyContent, replyImage, user.id, user.name);
      setThreadReplies(prev => ({
        ...prev,
        [threadId]: [reply, ...(prev[threadId] || [])]
      }));
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, repliesCount: t.repliesCount + 1 } : t));
      setReplyContent('');
      setReplyImage(null);
      scrollToTopReplies();
    } catch (e) {
      console.error(e);
    } finally {
      setIsReplying(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'thread') {
        await db.deleteThread(deleteTarget.id);
        setThreads(prev => prev.filter(t => t.id !== deleteTarget.id));
        if (activeThreadId === deleteTarget.id) setActiveThreadId(null);
      } else if (deleteTarget.type === 'reply' && deleteTarget.parentId) {
        await db.deleteThreadReply(deleteTarget.id);
        setThreadReplies(prev => ({
          ...prev,
          [deleteTarget.parentId!]: (prev[deleteTarget.parentId!] || []).filter(r => r.id !== deleteTarget.id)
        }));
        setThreads(prev => prev.map(t => t.id === deleteTarget.parentId ? { ...t, repliesCount: Math.max(0, t.repliesCount - 1) } : t));
      }
    } catch (e) {
      console.error("Failed to delete", e);
    } finally {
      setDeleteTarget(null);
    }
  };

  const getHeatmapStyle = (count: number) => {
    if (count > 50) return 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse-glow';
    if (count > 20) return 'border-orange-400 shadow-[0_0_15px_rgba(251,146,60,0.2)]';
    if (count > 5) return 'border-amber-300';
    return 'border-stone-200 dark:border-stone-800';
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-32">
      <ConfirmDialog 
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'thread' ? "Удалить тред?" : "Удалить ответ?"}
        message="Это действие нельзя отменить."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-fade-in-up">
        <div>
          <h2 className="text-5xl md:text-7xl font-serif font-black text-stone-900 dark:text-stone-50 tracking-tighter leading-none mb-4">The Grid</h2>
          <p className="text-stone-500 dark:text-stone-400 text-lg font-medium">Бесконечный поток коллективного разума.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-3xl font-black uppercase text-xs tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl"
        >
          <Plus size={18} /> Создать тред
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-20">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="font-black uppercase tracking-widest text-xs">Синхронизация потоков...</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
          {threads.map((thread) => {
            const canDelete = isAdmin || user.id === thread.authorId;
            return (
              <div 
                key={thread.id} 
                className={`
                  break-inside-avoid bg-white dark:bg-stone-900/50 backdrop-blur-xl rounded-[2.5rem] 
                  border-2 transition-all duration-500 group relative overflow-hidden
                  ${getHeatmapStyle(thread.repliesCount)}
                  hover:scale-[1.01] hover:shadow-2xl cursor-pointer
                `}
                onClick={() => openThreadModal(thread.id)}
              >
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Identicon seed={thread.authorId} size={36} />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block leading-none mb-1">
                          {thread.authorName}
                        </span>
                        <span className="text-[9px] font-bold text-stone-300 dark:text-stone-600 block leading-none">
                          ID: {thread.authorId?.slice(0, 6) || 'Anon'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
                           <Clock size={10} /> {thread.timestamp}
                        </div>
                        {canDelete && (
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setDeleteTarget({ type: 'thread', id: thread.id });
                             }}
                             className="p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                           >
                             <Trash2 size={16} />
                           </button>
                        )}
                    </div>
                  </div>
                  <h3 className="font-serif font-black text-2xl text-stone-900 dark:text-stone-100 mb-4 leading-tight group-hover:text-amber-500 transition-colors">
                    {thread.title}
                  </h3>
                  {thread.imageUrl && (
                    <div className={`relative mb-6 rounded-2xl overflow-hidden cursor-pointer transition-all duration-700 max-h-64`}>
                      <img src={thread.imageUrl} className={`w-full object-cover transition-transform duration-700 group-hover:scale-105`} alt="" />
                    </div>
                  )}
                  <p className={`text-stone-600 dark:text-stone-300 leading-relaxed mb-8 line-clamp-4`}>
                    {thread.content}
                  </p>
                  <div className="flex items-center gap-6 pt-6 border-t border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl transition-all ${thread.repliesCount > 20 ? 'bg-orange-500 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}>
                        {thread.repliesCount > 20 ? <Flame size={14} /> : <MessageSquare size={14} />}
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-stone-400">{thread.repliesCount}</span>
                    </div>
                    <button className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                      Открыть тред
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Thread Detail Modal (Fixed Layout & Design) */}
      {activeThreadId && activeThread && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 md:p-10">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-fade-in" onClick={() => setActiveThreadId(null)}></div>
          <div className="bg-white dark:bg-stone-900 w-full max-w-6xl h-full md:h-[85vh] md:rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] relative z-10 animate-scale-in flex flex-col md:flex-row overflow-hidden border border-white/5">
            
            {/* Thread Left Sidebar (Context) - Seamless fit to left edge */}
            <div className="w-full md:w-[42%] bg-stone-50 dark:bg-black/40 overflow-y-auto custom-scrollbar flex flex-col md:h-full border-b md:border-b-0 md:border-r border-stone-100 dark:border-white/5">
               <div className="p-8 md:p-12">
                  <div className="flex items-center gap-4 mb-10">
                      <Identicon seed={activeThread.authorId} size={56} className="shadow-2xl ring-4 ring-white/10" />
                      <div>
                        <h4 className="font-black uppercase tracking-widest text-[11px] text-stone-900 dark:text-white leading-none mb-1.5">{activeThread.authorName}</h4>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Создано {activeThread.timestamp}</span>
                      </div>
                  </div>

                  <h2 className="text-4xl md:text-5xl font-serif font-black text-stone-900 dark:text-white mb-8 leading-[1.1] tracking-tighter">{activeThread.title}</h2>
                  
                  {activeThread.imageUrl && (
                      <div className="mb-10 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-white/10">
                        <img src={activeThread.imageUrl} className="w-full object-cover" alt="" />
                      </div>
                  )}

                  <div className="text-stone-700 dark:text-stone-300 text-xl leading-relaxed whitespace-pre-wrap font-serif italic mb-12 opacity-90">
                    {activeThread.content}
                  </div>

                  <div className="inline-flex items-center gap-4 px-6 py-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-stone-100 dark:border-white/5 text-[11px] font-black uppercase tracking-widest text-stone-400">
                      <MessageCircle size={18} className="text-amber-500" /> {activeThread.repliesCount} ответов
                  </div>
               </div>
            </div>

            {/* Replies Section (Scrollable Area) */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0c0a09] relative">
              <div className="px-8 py-6 border-b border-stone-100 dark:border-white/5 flex justify-between items-center shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Поток дискуссии</h3>
                <button onClick={() => setActiveThreadId(null)} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-all hover:scale-110 active:scale-90">
                  <X size={28} />
                </button>
              </div>

              {/* Reply Input (Integrated into the discussion flow) */}
              <div className="p-8 border-b border-stone-100 dark:border-white/5 shrink-0 bg-stone-50/50 dark:bg-white/[0.02]">
                <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-white/5 shadow-inner focus-within:ring-4 ring-amber-500/10 transition-all p-2">
                  <textarea 
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Напишите ответ..."
                    className="w-full bg-transparent border-none outline-none text-base font-medium min-h-[100px] text-stone-900 dark:text-stone-100 resize-none px-6 py-4"
                  />
                  {replyImage && (
                    <div className="relative w-32 h-32 mx-6 mb-4 rounded-2xl overflow-hidden group shadow-2xl">
                      <img src={replyImage} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => setReplyImage(null)} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={24} className="text-white" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center px-4 pb-4">
                    <button 
                      onClick={() => replyFileInputRef.current?.click()}
                      className="p-3 bg-stone-100 dark:bg-white/5 rounded-2xl text-stone-400 hover:text-amber-500 transition-all flex items-center gap-2"
                    >
                      <Camera size={20} />
                      <input type="file" ref={replyFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                    </button>
                    <button 
                      onClick={() => handlePostReply(activeThreadId)}
                      disabled={!replyContent.trim() || isReplying}
                      className="px-10 py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.2em] flex items-center gap-4 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 shadow-2xl"
                    >
                      {isReplying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                      Отправить
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Replies Container */}
              <div 
                ref={repliesScrollContainerRef}
                className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar scroll-smooth"
              >
                {loadingReplies === activeThreadId ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-30">
                    <Loader2 size={40} className="animate-spin mb-4 text-amber-500" />
                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Загрузка ответов...</p>
                  </div>
                ) : (threadReplies[activeThreadId] || []).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                    <MessageSquare size={64} className="mb-6" />
                    <p className="font-black text-[10px] uppercase tracking-[0.3em]">Нет ответов. Начните беседу.</p>
                  </div>
                ) : (
                  <>
                    {threadReplies[activeThreadId].map((reply, idx) => {
                        const canDeleteReply = isAdmin || user.id === reply.authorId;
                        return (
                          <div key={reply.id} className="animate-reveal flex gap-6 group/reply" style={{ animationDelay: `${idx * 40}ms` }}>
                            <Identicon seed={reply.authorId} size={40} className="shrink-0 shadow-lg" />
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-2.5 px-2">
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{reply.authorName}</span>
                                    {canDeleteReply && (
                                       <button 
                                         onClick={() => setDeleteTarget({ type: 'reply', id: reply.id, parentId: activeThreadId })}
                                         className="p-1 text-stone-300 hover:text-red-500 transition-all opacity-0 group-hover/reply:opacity-100"
                                       >
                                         <Trash2 size={14} />
                                       </button>
                                    )}
                                 </div>
                                 <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{reply.timestamp}</span>
                              </div>
                              <div className="bg-stone-50 dark:bg-white/[0.03] p-7 rounded-[2.5rem] rounded-tl-none border border-stone-100 dark:border-white/5 shadow-sm">
                                {reply.imageUrl && (
                                  <div className="mb-5 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
                                    <img src={reply.imageUrl} className="w-full max-h-80 object-cover" alt="" />
                                  </div>
                                )}
                                <p className="text-base text-stone-700 dark:text-stone-200 leading-relaxed whitespace-pre-wrap font-medium">{reply.content}</p>
                              </div>
                            </div>
                          </div>
                        );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Thread Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-fade-in" onClick={() => !isCreating && setShowCreateModal(false)}></div>
          <div className="bg-white dark:bg-stone-900 w-full max-w-2xl p-10 md:p-14 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] relative z-10 animate-scale-in border border-white/5">
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-4xl font-serif font-black text-stone-900 dark:text-stone-100 tracking-tighter">Новый тред</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-900 dark:hover:text-white transition-all hover:scale-110"><X size={36} /></button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-10">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-4 block">Тема обсуждения</label>
                <input 
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="О чем будем говорить?"
                  className="w-full bg-stone-50 dark:bg-white/[0.02] border border-stone-100 dark:border-white/5 rounded-[1.8rem] p-7 outline-none font-serif text-2xl text-stone-900 dark:text-white focus:ring-4 ring-amber-500/10 transition-all shadow-inner"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-4 block">Контент</label>
                <textarea 
                  required
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Разверните вашу мысль..."
                  className="w-full bg-stone-50 dark:bg-white/[0.02] border border-stone-100 dark:border-white/5 rounded-[1.8rem] p-7 min-h-[220px] outline-none text-lg text-stone-700 dark:text-stone-300 resize-none focus:ring-4 ring-amber-500/10 transition-all font-serif italic shadow-inner"
                />
              </div>

              <div className="flex gap-5 items-center">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:bg-stone-50 dark:hover:bg-white/[0.02] ${newImage ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10' : 'border-stone-200 dark:border-white/10'}`}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
                  {newImage ? (
                    <img src={newImage} className="max-h-40 rounded-2xl shadow-2xl" alt="" />
                  ) : (
                    <>
                      <div className="p-5 bg-white dark:bg-stone-800 rounded-full shadow-xl text-stone-400"><Camera size={36} /></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Прикрепить обложку</span>
                    </>
                  )}
                </div>
                {newImage && (
                  <button onClick={() => setNewImage(null)} className="p-5 bg-stone-100 dark:bg-white/5 rounded-3xl text-stone-400 hover:text-red-500 transition-all shadow-lg">
                    <Trash2 size={28} />
                  </button>
                )}
              </div>

              <button 
                type="submit"
                disabled={isCreating}
                className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-7 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] flex items-center justify-center gap-5 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
              >
                {isCreating ? <Loader2 size={24} className="animate-spin" /> : <Send size={20} />}
                Запустить тред
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
