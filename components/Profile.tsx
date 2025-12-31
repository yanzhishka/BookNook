
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Book, UserArchetype } from '../types';
import { MapPin, Calendar, Edit3, BookOpen, Award, Flame, Camera, ShieldAlert, Trash2, BarChart3, History, Lock, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { db, UserData } from '../services/db';
import { analyzeReadingArchetype } from '../services/geminiService';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  books: Book[];
}

interface Achievement {
    id: string;
    icon: string;
    title: string;
    desc: string;
    isUnlocked: boolean;
    progress?: number;
    goal: number;
}

const ADMIN_EMAIL = 'nme030609@gmail.com';

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

// Функция для генерации данных Heatmap (заглушка)
const generateHeatmapData = () => {
    const data = [];
    for (let i = 0; i < 90; i++) {
        data.push({ level: Math.floor(Math.random() * 5) });
    }
    return data;
};

export const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, books }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'achievements'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editLocation, setEditLocation] = useState(user.location || '');

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const isAdmin = user.handle === ADMIN_EMAIL;

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const completedBooks = useMemo(() => books.filter(b => b.status === 'completed'), [books]);
  const totalPagesRead = useMemo(() => books.reduce((acc, b) => acc + (b.currentPage || 0), 0), [books]);
  const totalAnnotations = useMemo(() => books.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [books]);
  
  const heatmapData = useMemo(() => generateHeatmapData(), []);

  const achievements = useMemo((): Achievement[] => [
    { id: 'bookworm', icon: '🐛', title: 'Книжный червь', desc: 'Прочитать 5 книг', goal: 5, progress: completedBooks.length, isUnlocked: completedBooks.length >= 5 },
    { id: 'on_fire', icon: '🔥', title: 'В ударе', desc: 'Серия чтения 7 дней', goal: 7, progress: user.streakDays || 0, isUnlocked: (user.streakDays || 0) >= 7 },
    { id: 'thinker', icon: '🧠', title: 'Мыслитель', desc: 'Создать 10 заметок', goal: 10, progress: totalAnnotations, isUnlocked: totalAnnotations >= 10 },
  ], [completedBooks, user.streakDays, totalAnnotations]);

  useEffect(() => {
      if (isAdmin) loadAllUsers();
  }, [isAdmin]);

  const loadAllUsers = async () => {
      try {
          const users = await db.getAllUsersData();
          setAllUsers(users);
      } catch (e) { console.error(e); }
  };

  const handleArchetypeAnalysis = async () => {
    if (books.length === 0) {
        alert("Прочитайте хотя бы одну книгу для анализа!");
        return;
    }
    setIsAnalyzing(true);
    try {
        const result = await analyzeReadingArchetype(books, books.flatMap(b => b.annotations?.map(a => a.comment) || []));
        const updatedUser = { ...user, archetype: result };
        onUpdateUser(updatedUser);
        await db.updateUserProfile(updatedUser);
    } catch (e) { console.error(e); }
    finally { setIsAnalyzing(false); }
  };

  const handleSave = async () => {
    const updatedUser = { ...user, name: editName, bio: editBio, location: editLocation };
    onUpdateUser(updatedUser); await db.updateUserProfile(updatedUser); setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const updatedUser = { ...user, [field]: ev.target?.result as string };
        onUpdateUser(updatedUser); await db.updateUserProfile(updatedUser);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <div className="relative w-full h-64 rounded-[3rem] overflow-hidden shadow-2xl mb-24 bg-stone-200 dark:bg-stone-800">
        <img src={user.bannerUrl || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=2070&auto=format&fit=crop"} alt="Cover" className="w-full h-full object-cover" />
        {isEditing && (
            <button onClick={() => bannerInputRef.current?.click()} className="absolute bottom-6 right-6 bg-white/20 backdrop-blur-xl text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-white/40 transition-all cursor-pointer z-10 border border-white/30"><Camera size={18} /> <span className="text-sm font-bold">Обложка</span></button>
        )}
        <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'bannerUrl')} />
        <div className="absolute -bottom-16 left-10">
          <div className="w-40 h-40 rounded-[2.5rem] border-[6px] border-stone-50 dark:border-stone-950 shadow-2xl overflow-hidden bg-white dark:bg-stone-800 relative group">
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              {isEditing && (
                  <div onClick={() => avatarInputRef.current?.click()} className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera className="text-white" size={32} /></div>
              )}
          </div>
          <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
            <div className="flex justify-between items-start mb-10">
                <div className="flex-1">
                    {isEditing ? (
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-4xl font-serif font-black text-stone-900 dark:text-stone-100 bg-transparent border-b-2 border-stone-200 dark:border-stone-700 outline-none pb-2 mb-4 w-full" />
                    ) : (
                        <h1 className="text-5xl font-serif font-black text-stone-900 dark:text-stone-100 mb-2 tracking-tighter flex items-center gap-4 flex-wrap">
                            {user.name} {isAdmin && <ShieldAlert className="text-rose-500" size={24} />}
                            {user.archetype && <span className="text-sm px-4 py-1.5 rounded-full font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20">{user.archetype.icon} {user.archetype.title}</span>}
                        </h1>
                    )}
                </div>
                {isEditing ? (
                    <div className="flex gap-3"><button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-500 font-bold text-sm">Отмена</button><button onClick={handleSave} className="px-8 py-3 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-black text-sm shadow-xl">Сохранить</button></div>
                ) : <button onClick={() => setIsEditing(true)} className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all"><Edit3 size={20}/></button>}
            </div>

            {/* Activity Heatmap (Новое!) */}
            <div className="mb-12 p-8 bg-white dark:bg-stone-900 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6 flex items-center gap-2"><History size={16} className="text-amber-500" /> История странствий (90 дней)</h3>
                <div className="grid grid-cols-15 gap-1.5 h-32">
                    {heatmapData.map((d, i) => (
                        <div 
                            key={i} 
                            className={`w-full rounded-[4px] transition-colors ${
                                d.level === 0 ? 'bg-stone-50 dark:bg-stone-850' : 
                                d.level === 1 ? 'bg-amber-100 dark:bg-amber-900/20' : 
                                d.level === 2 ? 'bg-amber-300 dark:bg-amber-700/40' : 
                                d.level === 3 ? 'bg-amber-500 dark:bg-amber-600/60' : 
                                'bg-amber-700 dark:bg-amber-500'
                            }`}
                            title={`Активность: уровень ${d.level}`}
                        />
                    ))}
                </div>
                <div className="mt-4 flex justify-between items-center text-[10px] font-black uppercase text-stone-400">
                    <span>Редко</span>
                    <div className="flex gap-1">
                        {[0,1,2,3,4].map(l => <div key={l} className={`w-2.5 h-2.5 rounded-sm ${l === 0 ? 'bg-stone-50 dark:bg-stone-850' : l === 1 ? 'bg-amber-100' : l === 2 ? 'bg-amber-300' : l === 3 ? 'bg-amber-500' : 'bg-amber-700'}`} />)}
                    </div>
                    <span>Часто</span>
                </div>
            </div>

            <div className="flex border-b border-stone-100 dark:border-stone-800 mb-10 gap-8">
                {['info', 'stats', 'achievements'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                        {tab === 'info' ? 'Обзор' : tab === 'stats' ? 'Статистика' : 'Достижения'}
                        {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 dark:bg-stone-100 rounded-full animate-scale-in" />}
                    </button>
                ))}
            </div>

            {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
                    <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[2.5rem] text-white flex flex-col justify-between group overflow-hidden relative border border-stone-800">
                        <Flame size={100} className="absolute -bottom-8 -right-8 opacity-10" />
                        <div className="relative z-10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Серия</h4>
                            <p className="text-5xl font-black">{user.streakDays || 0} Дней</p>
                        </div>
                    </div>
                    <div className="p-8 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col justify-between relative">
                         <div className="relative z-10">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Книг</h4>
                            <p className="text-5xl font-black text-stone-900 dark:text-white">{completedBooks.length}</p>
                         </div>
                    </div>
                </div>
            )}
        </div>

        <div className="lg:col-span-4 space-y-8">
            <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[3rem] text-white border border-stone-800 overflow-hidden relative group">
                <BookOpen size={120} className="absolute -bottom-4 -right-4 opacity-10" />
                <div className="relative z-10">
                    <h5 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Всего времени</h5>
                    <p className="text-4xl font-black mb-1">{formatReadingTime(user.totalReadingTime || 0)}</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
