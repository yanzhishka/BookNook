
import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, Message } from '../types';
import { db } from '../services/db';
import { supabase } from '../services/supabaseClient'; 
import { Send, Plus, MessageCircle, Loader2, Trash2, ChevronLeft } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface MessagesProps {
  user: User;
}

export const Messages: React.FC<MessagesProps> = ({ user }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    let channel: any;

    if (activeChatId) {
      loadMessages(activeChatId);

      channel = supabase
        .channel(`chat:${activeChatId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChatId}` },
          (payload) => {
            const newMsg: Message = {
              id: payload.new.id,
              chatId: payload.new.chat_id,
              senderId: payload.new.sender_id,
              content: payload.new.content,
              createdAt: payload.new.created_at,
              isRead: payload.new.is_read
            };

            setMessages(prev => {
              // Проверка на дубликат (на случай если Realtime сработает слишком быстро)
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe();
    }

    return () => {
        if (channel) supabase.removeChannel(channel);
    };
  }, [activeChatId, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChats = async () => {
    setIsLoadingChats(true);
    try {
      const data = await db.getChats(user.id);
      setChats(data);
    } catch (e) {
      console.error("Failed to load chats", e);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await db.getMessages(chatId);
      setMessages(data);
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activeChatId || !newMessage.trim()) return;
    try {
      // Удалено: setMessages(prev => [...prev, savedMsg]);
      // Теперь мы полагаемся исключительно на Realtime подписку для обновления списка сообщений.
      await db.sendMessage(activeChatId, user.id, newMessage);
      setNewMessage('');
      
      // Обновляем только превью последнего сообщения в списке чатов
      setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, lastMessage: newMessage } : c));
    } catch (e) {
      console.error("Failed to send", e);
    }
  };

  const handleCreateChat = async () => {
      if (!targetEmail.trim()) return;
      setIsCreating(true);
      setCreateError(null);
      try {
          const targetUser = await db.searchUserByEmail(targetEmail);
          if (!targetUser) { setCreateError("Пользователь не найден."); return; }
          if (targetUser.id === user.id) { setCreateError("Вы не можете создать чат с самим собой."); return; }
          const newChat = await db.createChat(targetUser.id, user.id);
          setChats(prev => [newChat, ...prev]);
          setActiveChatId(newChat.id);
          setShowCreateModal(false);
          setTargetEmail('');
      } catch (e) {
          setCreateError("Ошибка при создании чата.");
      } finally {
          setIsCreating(false);
      }
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    setIsDeletingChat(true);
    try {
      await db.deleteChat(chatToDelete);
      setChats(prev => prev.filter(c => c.id !== chatToDelete));
      if (activeChatId === chatToDelete) {
        setActiveChatId(null);
        setMessages([]);
      }
      setChatToDelete(null);
    } catch (e) {
      console.error("Error deleting chat:", e);
      alert("Не удалось полностью удалить чат из базы данных. Попробуйте еще раз.");
    } finally {
      setIsDeletingChat(false);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const getChatPartner = (chat: Chat) => chat.participants.find(p => p.id !== user.id) || chat.participants[0];

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-8 animate-fade-in-up relative">
      <ConfirmDialog 
        isOpen={!!chatToDelete} 
        title="Удалить чат навсегда?" 
        message={isDeletingChat ? "Удаление данных..." : "Эта переписка будет удалена для всех участников. Это действие нельзя отменить."} 
        onConfirm={handleDeleteChat} 
        onCancel={() => !isDeletingChat && setChatToDelete(null)} 
      />

      <div className={`w-full md:w-1/3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
            <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif">Сообщения</h2>
            <button onClick={() => setShowCreateModal(true)} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"><Plus size={20} className="text-stone-600 dark:text-stone-300" /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {isLoadingChats ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-stone-400" /></div> : chats.length === 0 ? <div className="text-center py-10 text-stone-400"><MessageCircle size={48} className="mx-auto mb-2 opacity-20" /><p>Нет активных чатов.</p></div> : chats.map(chat => {
                const partner = getChatPartner(chat);
                return (
                    <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className={`group p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-stone-100 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'}`}>
                        <img src={partner?.avatar} className="w-12 h-12 rounded-full object-cover shrink-0" />
                        <div className="flex-1 min-w-0"><div className="flex justify-between items-start"><h4 className="font-bold text-stone-800 dark:text-stone-100 truncate">{partner?.name}</h4><button onClick={(e) => { e.stopPropagation(); setChatToDelete(chat.id); }} className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button></div><p className="text-xs text-stone-500 dark:text-stone-400 truncate">{chat.lastMessage}</p></div>
                    </div>
                );
            })}
        </div>
      </div>

      <div className={`w-full md:w-2/3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {activeChatId ? (
            <><div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => setActiveChatId(null)} className="md:hidden text-stone-400 p-1"><ChevronLeft size={24} /></button><img src={getChatPartner(activeChat!)?.avatar} className="w-10 h-10 rounded-full object-cover" /><div><h3 className="font-bold text-stone-800 dark:text-stone-100">{getChatPartner(activeChat!)?.name}</h3><p className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Online</p></div></div><button onClick={() => setChatToDelete(activeChatId)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={20} /></button></div><div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-stone-50/50 dark:bg-black/20">{isLoadingMessages ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-stone-400" /></div> : messages.map((msg, idx) => { const isMe = msg.senderId === user.id; return (<div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-scale-in`} style={{ animationDelay: `${idx * 10}ms` }}><div className={`max-w-[85%] md:max-w-[70%] p-3 px-4 rounded-2xl text-sm ${isMe ? 'bg-stone-900 text-white rounded-br-none' : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-bl-none shadow-sm border border-stone-100 dark:border-stone-700'}`}><p>{msg.content}</p><p className="text-[10px] mt-1 text-right opacity-40">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></div>); })}<div ref={messagesEndRef} /></div><div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 rounded-b-2xl"><div className="flex gap-2 items-center"><input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Напишите сообщение..." className="flex-1 bg-stone-100 dark:bg-stone-800 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-700 outline-none text-stone-800 dark:text-stone-200" /><button onClick={handleSendMessage} disabled={!newMessage.trim()} className="p-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full hover:scale-105 transition-transform disabled:opacity-50"><Send size={18} /></button></div></div></>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-8 text-center"><div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4"><MessageCircle size={40} /></div><h3 className="text-lg font-bold mb-1 text-stone-600 dark:text-stone-300">Ваши сообщения</h3><p className="text-sm opacity-70">Выберите чат для начала общения.</p></div>
        )}
      </div>

      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div><div className="bg-white dark:bg-stone-900 w-full max-w-sm p-6 rounded-2xl shadow-xl relative z-10 animate-scale-in"><h3 className="font-bold text-lg text-stone-800 dark:text-stone-100 mb-4">Новый чат</h3><div className="mb-4"><label className="block text-xs font-bold text-stone-400 uppercase mb-1">Email пользователя</label><input value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="friend@example.com" className="w-full p-2 bg-stone-100 dark:bg-stone-800 rounded-lg outline-none text-stone-800 dark:text-stone-200" /></div>{createError && <p className="text-red-500 text-xs mb-4">{createError}</p>}<div className="flex gap-2"><button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium">Отмена</button><button onClick={handleCreateChat} disabled={isCreating || !targetEmail} className="flex-1 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold disabled:opacity-50">{isCreating ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Начать чат'}</button></div></div></div>
      )}
    </div>
  );
};
