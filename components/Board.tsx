
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Thread, ThreadReply, User } from '../types';
import { db, ADMIN_EMAIL } from '../services/db';
import { Identicon } from './Identicon';
import { MessageSquare, Image as ImageIcon, Plus, Eye, Zap, Flame, Clock, Loader2, Send, X, Camera, MessageCircle, Trash2 } from 'lucide-react';
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
        // Order: Newest first for UI
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
        [threadId]: [reply, ...(prev[threadId] || [])] // Add to top
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
          [deleteTarget.parentId!]: prev[deleteTarget.parentId!].filter(r => r.id !== deleteTarget.id)
        }));
        setThreads(prev => prev.map(t => t.id === deleteTarget.parentId ? { ...t, repliesCount: t.repliesCount - 1 } : t));
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
            const isImgExpanded = expandedImgId === thread.id;
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
                    <div 
                      className={`relative mb-6 rounded-2xl overflow-hidden cursor-pointer transition-all duration-700 max-h-64`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedImgId(isImgExpanded ? null : thread.id);
                      }}
                    >
                      <img src={thread.imageUrl} className={`w-full object-cover transition-transform duration-700 ${isImgExpanded ? 'scale-110' : 'group-hover:scale-105'}`} alt="" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={32} className="text-white drop-shadow-lg" />
                      </div>
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
                    
                    <button 
                      className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
                    >
                      Открыть тред
                    </button>
                  </div>
                </div>

                {thread.repliesCount > 50 && (
                   <div className="absolute inset-0 pointer-events-none border-2 border-red-500/20 rounded-[2.5rem] animate-pulse"></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Thread Detail Modal (Replies) */}
      {activeThreadId && activeThread && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-0 md:p-10">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setActiveThreadId(null)}></div>
          <div className="bg-white dark:bg-stone-900 w-full max-w-6xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl relative z-10 animate-scale-in flex flex-col md:flex-row overflow-hidden border border-stone-100 dark:border-stone-800">
            
            {/* Thread Sidebar/Context - FIXED on the left */}
            <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-r border-stone-100 dark:border-stone-800 overflow-y-auto custom-scrollbar bg-stone-50/30 dark:bg-black/20 p-8 md:p-12 md:h-full">
               <div className="flex items-center gap-4 mb-8">
                  <Identicon seed={activeThread.authorId} size={48} />
                  <div>
                    <h4 className="font-black uppercase tracking-widest text-xs text-stone-900 dark:text-stone-100">{activeThread.authorName}</h4>
                    <span className="text-[10px] font-bold text-stone-400">Создано {activeThread.timestamp}</span>
                  </div>
               </div>

               <h2 className="text-3xl md:text-4xl font-serif font-black text-stone-900 dark:text-white mb-6 leading-tight">{activeThread.title}</h2>
               
               {activeThread.imageUrl && (
                  <img src={activeThread.imageUrl} className="w-full rounded-3xl mb-8 shadow-2xl" alt="" />
               )}

               <div className="text-stone-600 dark:text-stone-300 text-lg leading-relaxed whitespace-pre-wrap font-serif italic mb-12">
                 {activeThread.content}
               </div>

               <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-stone-400 mb-8 md:mb-0">
                  <MessageCircle size={18} /> {activeThread.repliesCount} ответов
               </div>
            </div>

            {/* Replies Section - INDEPENDENTLY SCROLLABLE on the right */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-stone-900 relative">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center shrink-0">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Поток комментариев (сначала новые)</h3>
                <button onClick={() => setActiveThreadId(null)} className="p-2 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Reply Input - At the top of the comment section */}
              <div className="p-6 md:p-8 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-black/10 shrink-0">
                <div className="bg-white dark:bg-stone-900 p-4 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm transition-all focus-within:ring-4 focus-within:ring-amber-500/10">
                  <textarea 
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Присоединиться к дискуссии..."
                    className="w-full bg-transparent border-none outline-none text-sm font-medium min-h-[80px] text-stone-900 dark:text-stone-100 resize-none px-4 py-2"
                  />
                  {replyImage && (
                    <div className="relative w-32 h-32 m-4 rounded-2xl overflow-hidden group shadow-lg">
                      <img src={replyImage} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => setReplyImage(null)} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={20} className="text-white" />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 px-4 pb-2">
                    <button 
                      onClick={() => replyFileInputRef.current?.click()}
                      className="flex items-center gap-2 p-2 text-stone-400 hover:text-amber-500 transition-colors"
                    >
                      <Camera size={20} />
                      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Прикрепить</span>
                      <input type="file" ref={replyFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} />
                    </button>
                    <button 
                      onClick={() => handlePostReply(activeThreadId)}
                      disabled={!replyContent.trim() || isReplying}
                      className="px-8 py-3.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-xl"
                    >
                      {isReplying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                      Отправить
                    </button>
                  </div>
                </div>
              </div>

              <div 
                ref={repliesScrollContainerRef}
                className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar scroll-smooth"
              >
                {loadingReplies === activeThreadId ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20">
                    <Loader2 size={32} className="animate-spin mb-4" />
                    <p className="font-black text-[10px] uppercase tracking-widest">Читаем мысли...</p>
                  </div>
                ) : (threadReplies[activeThreadId] || []).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                    <MessageSquare size={48} className="mb-4" />
                    <p className="font-black text-[10px] uppercase tracking-widest">Здесь пока пусто. Будь первым.</p>
                  </div>
                ) : (
                  <>
                    {threadReplies[activeThreadId].map((reply, idx) => {
                        const canDeleteReply = isAdmin || user.id === reply.authorId;
                        return (
                          <div key={reply.id} className="animate-reveal flex gap-4 md:gap-6 group/reply" style={{ animationDelay: `${idx * 50}ms` }}>
                            <Identicon seed={reply.authorId} size={36} className="shrink-0" />
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-2">
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{reply.authorName}</span>
                                    {canDeleteReply && (
                                       <button 
                                         onClick={() => setDeleteTarget({ type: 'reply', id: reply.id, parentId: activeThreadId })}
                                         className="p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover/reply:opacity-100"
                                       >
                                         <Trash2 size={12} />
                                       </button>
                                    )}
                                 </div>
                                 <span className="text-[9px] font-bold text-stone-300 uppercase">{reply.timestamp}</span>
                              </div>
                              <div className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-3xl rounded-tl-none border border-stone-100 dark:border-stone-800 shadow-sm">
                                {reply.imageUrl && (
                                  <img src={reply.imageUrl} className="w-full max-h-64 object-cover rounded-2xl mb-4 shadow-lg cursor-zoom-in" alt="" />
                                )}
                                <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => !isCreating && setShowCreateModal(false)}></div>
          <div className="bg-white dark:bg-stone-900 w-full max-w-2xl p-8 md:p-12 rounded-[3.5rem] shadow-2xl relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-4xl font-serif font-black text-stone-900 dark:text-stone-100 tracking-tighter">Новый тред</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-stone-400 hover:text-stone-900 transition-colors"><X size={32} /></button>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Тема обсуждения</label>
                <input 
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="О чем будем говорить?"
                  className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-[1.5rem] p-6 outline-none font-serif text-2xl focus:ring-4 ring-amber-500/10 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 block">Контент</label>
                <textarea 
                  required
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Разверните вашу мысль..."
                  className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-[1.5rem] p-6 min-h-[200px] outline-none text-lg text-stone-700 dark:text-stone-300 resize-none focus:ring-4 ring-amber-500/10 transition-all font-serif italic"
                />
              </div>

              <div className="flex gap-4 items-center">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-stone-50 dark:hover:bg-stone-800 ${newImage ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' : 'border-stone-200 dark:border-stone-800'}`}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e)} />
                  {newImage ? (
                    <img src={newImage} className="max-h-32 rounded-xl shadow-2xl" alt="" />
                  ) : (
                    <>
                      <div className="p-4 bg-white dark:bg-stone-900 rounded-full shadow-md text-stone-400"><Camera size={32} /></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Прикрепить обложку</span>
                    </>
                  )}
                </div>
                {newImage && (
                  <button onClick={() => setNewImage(null)} className="p-4 bg-stone-100 dark:bg-stone-800 rounded-3xl text-stone-400 hover:text-red-500 transition-colors">
                    <Trash2 size={24} />
                  </button>
                )}
              </div>

              <button 
                type="submit"
                disabled={isCreating}
                className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-6 rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
              >
                {isCreating ? <Loader2 size={24} className="animate-spin" /> : <Send size={20} />}
                Запустить тред
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .animate-pulse-glow {
          animation: pulse-glow-border 2s ease-in-out infinite;
        }
        @keyframes pulse-glow-border {
          0%, 100% { border-color: rgb(239, 68, 68); box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
          50% { border-color: rgb(220, 38, 38); box-shadow: 0 0 25px rgba(239, 68, 68, 0.5); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
