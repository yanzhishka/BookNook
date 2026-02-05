
import React, { useState, useEffect, useMemo } from 'react';
import { User, Book } from '../types';
// Added Lock to the imports from lucide-react to avoid shadowing by global type
import { Flame, Edit3, History, BarChart3, Award, Calendar as CalendarIcon, BookOpen, Loader2, Lock } from 'lucide-react';
import { db } from '../services/db';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  books: Book[];
  viewingUserId?: string;
  onNavigate?: (tab: string) => void;
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

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const Profile: React.FC<ProfileProps> = ({ user: currentUser, onUpdateUser, books: currentBooks, viewingUserId }) => {
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser.id;
  
  const [profileUser, setProfileUser] = useState<User>(currentUser);
  const [profileBooks, setProfileBooks] = useState<Book[]>(currentBooks);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'achievements'>('info');
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');

  useEffect(() => {
    if (isOwnProfile) {
        setProfileUser(currentUser);
        setProfileBooks(currentBooks);
        setEditName(currentUser.name);
        setEditBio(currentUser.bio || '');
        setEditLocation(currentUser.location || '');
    } else {
        loadTargetProfile(viewingUserId!);
    }
  }, [viewingUserId, isOwnProfile, currentUser, currentBooks]);

  const loadTargetProfile = async (id: string) => {
      setIsLoadingProfile(true);
      try {
          const data = await db.loadUserData(id);
          setProfileUser(data.user);
          setProfileBooks(data.books);
      } catch (e) { console.error(e); } finally { setIsLoadingProfile(false); }
  };

  const completedBooks = useMemo(() => profileBooks.filter(b => b.status === 'completed'), [profileBooks]);
  const totalPagesRead = useMemo(() => profileBooks.reduce((acc, b) => acc + (b.currentPage || 0), 0), [profileBooks]);
  const totalAnnotations = useMemo(() => profileBooks.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [profileBooks]);

  const heatmapData = useMemo(() => {
    const days = 30;
    const data = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(today.getDate() - (days - 1 - i));
        const intensity = (i % 7 === 0 || i % 5 === 0) ? Math.floor(Math.random() * 4) + 1 : 0;
        data.push({ date, intensity });
    }
    return data;
  }, []);

  const achievements = useMemo((): Achievement[] => [
    { id: 'bookworm', icon: '🐛', title: 'Книжный червь', desc: 'Прочитать 5 книг', goal: 5, progress: completedBooks.length, isUnlocked: completedBooks.length >= 5 },
    { id: 'on_fire', icon: '🔥', title: 'В ударе', desc: 'Серия чтения 7 дней', goal: 7, progress: profileUser.streakDays || 0, isUnlocked: (profileUser.streakDays || 0) >= 7 },
    { id: 'thinker', icon: '🧠', title: 'Мыслитель', desc: 'Создать 10 заметок', goal: 10, progress: totalAnnotations, isUnlocked: totalAnnotations >= 10 },
    { id: 'marathon', icon: '🏃', title: 'Марафонец', desc: '1 час чтения', goal: 3600, progress: profileUser.totalReadingTime || 0, isUnlocked: (profileUser.totalReadingTime || 0) >= 3600 },
  ], [completedBooks, profileUser.streakDays, totalAnnotations, profileUser.totalReadingTime]);

  const handleSave = async () => {
    const updatedUser = { ...profileUser, name: editName, bio: editBio, location: editLocation };
    onUpdateUser(updatedUser); 
    await db.updateUserProfile(updatedUser); 
    setProfileUser(updatedUser);
    setIsEditing(false);
  };

  if (isLoadingProfile) return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in"><Loader2 className="animate-spin text-amber-500 mb-4" size={40} /></div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <div className="relative w-full h-64 mb-24">
        <div className="absolute inset-0 rounded-[3rem] overflow-hidden shadow-2xl bg-stone-200 dark:bg-stone-800">
            <img src={profileUser.bannerUrl || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=2070&auto=format&fit=crop"} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        <div className="absolute -bottom-16 left-10 z-20">
            <div className="w-40 h-40 rounded-[2.5rem] border-[6px] border-stone-50 dark:border-stone-950 shadow-2xl overflow-hidden bg-white dark:bg-stone-800"><img src={profileUser.avatar} alt={profileUser.name} className="w-full h-full object-cover" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
            <div className="flex justify-between items-start mb-10">
                <div className="flex-1">
                    {isEditing ? (
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-4xl font-serif font-black text-stone-900 dark:text-stone-100 bg-transparent border-b-2 border-stone-200 dark:border-stone-700 outline-none pb-2 mb-4 w-full" />
                    ) : (
                        <h1 className="text-5xl font-serif font-black text-stone-900 dark:text-stone-100 mb-2 tracking-tighter flex items-center gap-4 flex-wrap">{profileUser.name}</h1>
                    )}
                    <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-xs">{profileUser.handle}</p>
                </div>
                {isOwnProfile && (
                    isEditing ? (
                        <div className="flex gap-3"><button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-500 font-bold text-sm">Отмена</button><button onClick={handleSave} className="px-8 py-3 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-black text-sm shadow-xl">Сохранить</button></div>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all"><Edit3 size={20}/></button>
                    )
                )}
            </div>

            <div className="flex border-b border-stone-100 dark:border-stone-800 mb-10 gap-8">
                {[{ id: 'info', label: 'Обзор', icon: History }, { id: 'stats', label: 'Статистика', icon: BarChart3 }, { id: 'achievements', label: 'Достижения', icon: Award }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 relative ${activeTab === tab.id ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}><tab.icon size={16} /> {tab.label}{activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 dark:bg-stone-100 rounded-full animate-scale-in" />}</button>
                ))}
            </div>

            {activeTab === 'info' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[2.5rem] text-white flex flex-col justify-between group overflow-hidden relative border border-stone-800"><Flame size={100} className="absolute -bottom-8 -right-8 opacity-10" /><div className="relative z-10"><h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Текущая серия</h4><p className="text-5xl font-black">{profileUser.streakDays || 0} Дней</p></div></div>
                        <div className="p-8 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col justify-between group overflow-hidden relative"><div className="relative z-10"><h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Прочитано</h4><p className="text-5xl font-black text-stone-900 dark:text-white">{completedBooks.length}</p></div></div>
                    </div>
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="animate-fade-in-up space-y-12">
                    <div className="p-10 bg-white dark:bg-stone-900 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                        <div className="flex items-center gap-3 mb-8"><CalendarIcon size={20} className="text-amber-500" /><h4 className="text-xs font-black text-stone-400 uppercase tracking-widest">Активность чтения (30 дней)</h4></div>
                        <div className="flex flex-wrap gap-2">
                            {heatmapData.map((d, i) => (
                                <div 
                                    key={i} 
                                    title={d.date.toLocaleDateString()} 
                                    className={`w-4 h-4 rounded-sm transition-all hover:scale-125 cursor-help ${
                                        d.intensity === 0 ? 'bg-stone-100 dark:bg-stone-800' : 
                                        d.intensity === 1 ? 'bg-amber-200 dark:bg-amber-900/40' :
                                        d.intensity === 2 ? 'bg-amber-400 dark:bg-amber-700/60' :
                                        'bg-amber-600 dark:bg-amber-500'
                                    }`} 
                                />
                            ))}
                        </div>
                        <div className="mt-6 flex justify-between items-center"><p className="text-xs text-stone-500 font-medium">Всего страниц прочитано: {totalPagesRead}</p><div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-stone-400"><span>Реже</span><div className="flex gap-1"><div className="w-2 h-2 rounded-sm bg-stone-100 dark:bg-stone-800" /><div className="w-2 h-2 rounded-sm bg-amber-200 dark:bg-amber-900/40" /><div className="w-2 h-2 rounded-sm bg-amber-400 dark:bg-amber-700/60" /><div className="w-2 h-2 rounded-sm bg-amber-600 dark:bg-amber-500" /></div><span>Чаще</span></div></div>
                    </div>
                </div>
            )}

            {activeTab === 'achievements' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-up">
                    {achievements.map((ach) => (
                        <div key={ach.id} className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex gap-6 items-center group relative overflow-hidden ${ach.isUnlocked ? 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-xl' : 'bg-stone-50/50 dark:bg-stone-900/30 border-dashed border-stone-200 dark:border-stone-800 opacity-60 grayscale'}`}>
                            {/* Lock icon correctly used here after import fix */}
                            <div className="text-5xl shrink-0 filter group-hover:scale-110 transition-transform relative z-10">{ach.isUnlocked ? ach.icon : <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-2xl"><Lock size={24} className="text-stone-400" /></div>}</div>
                            <div className="flex-1 relative z-10"><h4 className="font-serif font-bold text-lg text-stone-800 dark:text-stone-100 leading-tight mb-1">{ach.title}</h4><p className="text-xs text-stone-500 dark:text-stone-400 font-medium mb-3">{ach.desc}</p>{ach.isUnlocked && <span className="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-500 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">Разблокировано</span>}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="lg:col-span-4 space-y-8">
            <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[3rem] text-white border border-stone-800 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10"><BookOpen size={120} /></div>
                <div className="relative z-10"><h5 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Всего времени</h5><p className="text-4xl font-black mb-1">{formatReadingTime(profileUser.totalReadingTime || 0)}</p><p className="text-xs font-medium opacity-60">Наслаждения текстом</p></div>
            </div>
        </div>
      </div>
    </div>
  );
};
