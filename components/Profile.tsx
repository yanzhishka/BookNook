import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Book, UserArchetype } from '../types';
import { MapPin, Calendar, Edit3, BookOpen, Award, Flame, Camera, ShieldAlert, Trash2, BarChart3, History, Lock, Sparkles, Loader2, RefreshCw, Mail, ArrowRight } from 'lucide-react';
import { db, UserData } from '../services/db';
import { analyzeReadingArchetype } from '../services/geminiService';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  books: Book[];
  viewingUserId?: string; // ID пользователя, чей профиль мы смотрим
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

const ADMIN_EMAIL = 'nme030609@gmail.com';

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const Profile: React.FC<ProfileProps> = ({ user: currentUser, onUpdateUser, books: currentBooks, viewingUserId, onNavigate }) => {
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser.id;
  
  const [profileUser, setProfileUser] = useState<User>(currentUser);
  const [profileBooks, setProfileBooks] = useState<Book[]>(currentBooks);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'achievements'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const isAdmin = currentUser.handle === ADMIN_EMAIL && isOwnProfile;

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
      } catch (e) {
          console.error("Failed to load user profile", e);
      } finally {
          setIsLoadingProfile(false);
      }
  };

  const completedBooks = useMemo(() => profileBooks.filter(b => b.status === 'completed'), [profileBooks]);
  const totalPagesRead = useMemo(() => profileBooks.reduce((acc, b) => acc + (b.currentPage || 0), 0), [profileBooks]);
  const totalAnnotations = useMemo(() => profileBooks.reduce((acc, b) => acc + (b.annotations?.length || 0), 0), [profileBooks]);
  
  const currentReadingBook = useMemo(() => profileBooks.find(b => b.status === 'reading'), [profileBooks]);

  const achievements = useMemo((): Achievement[] => [
    { 
        id: 'bookworm', 
        icon: '🐛', 
        title: 'Книжный червь', 
        desc: 'Прочитать 5 книг', 
        goal: 5,
        progress: completedBooks.length,
        isUnlocked: completedBooks.length >= 5 
    },
    { 
        id: 'on_fire', 
        icon: '🔥', 
        title: 'В ударе', 
        desc: 'Серия чтения 7 дней', 
        goal: 7,
        progress: profileUser.streakDays || 0,
        isUnlocked: (profileUser.streakDays || 0) >= 7 
    },
    { 
        id: 'thinker', 
        icon: '🧠', 
        title: 'Мыслитель', 
        desc: 'Создать 10 заметок', 
        goal: 10,
        progress: totalAnnotations,
        isUnlocked: totalAnnotations >= 10 
    },
    { 
        id: 'marathon', 
        icon: '🏃', 
        title: 'Марафонец', 
        desc: '1 час общего времени чтения', 
        goal: 3600,
        progress: profileUser.totalReadingTime || 0,
        isUnlocked: (profileUser.totalReadingTime || 0) >= 3600 
    },
  ], [completedBooks, profileUser.streakDays, totalAnnotations, profileUser.totalReadingTime]);

  const weeklyStats = [
    { day: 'Пн', pages: 42 }, { day: 'Вт', pages: 12 }, { day: 'Ср', pages: 85 },
    { day: 'Чт', pages: 30 }, { day: 'Пт', pages: 56 }, { day: 'Сб', pages: 110 }, { day: 'Вс', pages: 74 },
  ];
  const maxPages = Math.max(...weeklyStats.map(s => s.pages));

  useEffect(() => {
      if (isAdmin) loadAllUsers();
  }, [isAdmin]);

  const loadAllUsers = async () => {
      try {
          const users = await db.getAllUsersData();
          setAllUsers(users);
      } catch (e) {
          console.error("Failed to load users", e);
      }
  };

  const handleArchetypeAnalysis = async () => {
    if (profileBooks.length === 0) return;
    setIsAnalyzing(true);
    try {
        const bookList = profileBooks.map(b => ({ title: b.title, author: b.author }));
        const annList = profileBooks.flatMap(b => b.annotations?.map(a => a.comment) || []);
        const result: UserArchetype = await analyzeReadingArchetype(bookList, annList);
        const updatedUser = { ...profileUser, archetype: result };
        onUpdateUser(updatedUser);
        await db.updateUserProfile(updatedUser);
        setProfileUser(updatedUser);
    } catch (e) {
        console.error(e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    const updatedUser = { ...profileUser, name: editName, bio: editBio, location: editLocation };
    onUpdateUser(updatedUser); 
    await db.updateUserProfile(updatedUser); 
    setProfileUser(updatedUser);
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        const updatedUser = { ...profileUser, [field]: result };
        onUpdateUser(updatedUser);
        await db.updateUserProfile(updatedUser);
        setProfileUser(updatedUser);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm("Вы уверены?")) {
          try {
              await db.deleteUser(id);
              setAllUsers(prev => prev.filter(u => u.id !== id));
          } catch (e) {}
      }
  };

  const handleMessageUser = async () => {
    if (!profileUser.email) return;
    onNavigate?.('messages');
  };

  if (isLoadingProfile) return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in">
          <Loader2 className="animate-spin text-amber-500 mb-4" size={40} />
          <p className="text-stone-400 font-black uppercase tracking-widest text-xs">Ищем человека...</p>
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <div className="relative w-full h-64 rounded-[3rem] overflow-hidden shadow-2xl mb-24 group bg-stone-200 dark:bg-stone-800">
        <img src={profileUser.bannerUrl || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=2070&auto=format&fit=crop"} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        {isEditing && isOwnProfile && (
            <button 
                onClick={() => bannerInputRef.current?.click()}
                className="absolute bottom-6 right-6 bg-white/20 backdrop-blur-xl text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-white/40 transition-all z-10 border border-white/30"
            >
                <Camera size={18} />
                <span className="text-sm font-bold">Изменить обложку</span>
            </button>
        )}
        <input type="file" ref={bannerInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'bannerUrl')} />
        
        <div className="absolute -bottom-16 left-10">
          <div className="relative group/avatar">
            <div className="w-40 h-40 rounded-[2.5rem] border-[6px] border-stone-50 dark:border-stone-950 shadow-2xl overflow-hidden bg-white dark:bg-stone-800 transition-transform hover:scale-105 duration-500">
                <img src={profileUser.avatar} alt={profileUser.name} className="w-full h-full object-cover" />
            </div>
            {isEditing && isOwnProfile && (
                <div onClick={() => avatarInputRef.current?.click()} className="absolute inset-0 rounded-[2.5rem] bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer z-10 backdrop-blur-sm">
                    <Camera className="text-white" size={32} />
                </div>
            )}
            <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />
          </div>
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
                            {profileUser.name}
                            {profileUser.handle === ADMIN_EMAIL && <ShieldAlert className="text-rose-500" size={24} />}
                            {profileUser.archetype && (
                                <span className="text-sm px-4 py-1.5 rounded-full font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-stone-100 dark:border-stone-800"
                                    style={{ backgroundColor: `${profileUser.archetype.color}20`, color: profileUser.archetype.color, borderColor: `${profileUser.archetype.color}40` }}>
                                    {profileUser.archetype.icon} {profileUser.archetype.title}
                                </span>
                            )}
                        </h1>
                    )}
                    <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-xs">{profileUser.handle}</p>
                </div>
                
                {isOwnProfile ? (
                    isEditing ? (
                        <div className="flex gap-3">
                            <button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-500 font-bold text-sm">Отмена</button>
                            <button onClick={handleSave} className="px-8 py-3 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-black text-sm shadow-xl">Сохранить</button>
                        </div>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all"><Edit3 size={20}/></button>
                    )
                ) : (
                    <button onClick={handleMessageUser} className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:scale-105 transition-all">
                        <Mail size={18} /> Написать
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-6 mb-12">
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full text-lg text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-900 p-6 rounded-[2rem] outline-none min-h-[150px] resize-none" placeholder="Расскажите о себе..." />
                    <div className="flex items-center gap-4 bg-stone-100 dark:bg-stone-900 px-6 py-4 rounded-2xl">
                        <MapPin size={20} className="text-stone-400" />
                        <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Ваш город" className="bg-transparent outline-none flex-1 text-stone-800 dark:text-stone-100" />
                    </div>
                </div>
            ) : (
                <div className="space-y-8 mb-12">
                    <p className="text-xl text-stone-600 dark:text-stone-300 leading-relaxed font-medium">{profileUser.bio || 'У этого книжного странника пока нет описания.'}</p>
                    <div className="flex flex-wrap gap-8 text-sm font-black text-stone-400 uppercase tracking-widest">
                        {profileUser.location && <div className="flex items-center gap-3"><MapPin size={18} className="text-amber-500" /> {profileUser.location}</div>}
                        <div className="flex items-center gap-3"><Calendar size={18} className="text-blue-500" /> С {profileUser.joinedDate}</div>
                    </div>
                </div>
            )}

            {profileUser.archetype && !isEditing && (
                <div className="mb-12 relative overflow-hidden p-8 rounded-[3rem] bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 shadow-sm group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10 animate-fade-in">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Читательская душа</h4>
                                <h3 className="text-3xl font-serif font-black text-stone-800 dark:text-stone-100">{profileUser.archetype.title}</h3>
                            </div>
                            {isOwnProfile && (
                                <button onClick={handleArchetypeAnalysis} disabled={isAnalyzing} className="p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl hover:bg-stone-100 transition-all text-stone-400 hover:text-stone-900">
                                    {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                </button>
                            )}
                        </div>
                        <p className="text-stone-600 dark:text-stone-400 italic mb-6 leading-relaxed">«{profileUser.archetype.description}»</p>
                        <div className="flex flex-wrap gap-3">
                            {profileUser.archetype.traits.map(trait => (
                                <span key={trait} className="px-3 py-1.5 bg-stone-50 dark:bg-stone-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 border border-stone-100 dark:border-stone-700">
                                    {trait}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex border-b border-stone-100 dark:border-stone-800 mb-10 gap-8">
                {[{ id: 'info', label: 'Обзор', icon: History }, { id: 'stats', label: 'Статистика', icon: BarChart3 }, { id: 'achievements', label: 'Достижения', icon: Award }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 relative ${activeTab === tab.id ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400'}`}>
                        <tab.icon size={16} /> {tab.label}
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 dark:bg-stone-100 rounded-full animate-scale-in" />}
                    </button>
                ))}
            </div>

            {activeTab === 'info' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[2.5rem] text-white flex flex-col justify-between group overflow-hidden relative border border-stone-800">
                            <Flame size={100} className="absolute -bottom-8 -right-8 opacity-10 group-hover:scale-125 transition-transform duration-1000" />
                            <div className="relative z-10">
                                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Текущая серия</h4>
                                <p className="text-5xl font-black">{profileUser.streakDays || 0} Дней</p>
                            </div>
                        </div>
                        <div className="p-8 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col justify-between group overflow-hidden relative">
                             <div className="relative z-10">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Прочитано</h4>
                                <p className="text-5xl font-black text-stone-900 dark:text-white">{completedBooks.length}</p>
                             </div>
                        </div>
                    </div>

                    {!isOwnProfile && currentReadingBook && (
                        <div className="p-10 glass rounded-[3rem] animate-fade-in flex items-center gap-10">
                            <img src={currentReadingBook.coverUrl} className="w-24 h-36 rounded-xl object-cover shadow-2xl" />
                            <div className="flex-1">
                                <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Читает сейчас</h4>
                                <h3 className="text-2xl font-serif font-black text-stone-900 dark:text-stone-100 mb-2">{currentReadingBook.title}</h3>
                                <p className="text-stone-500 font-medium italic mb-6">от {currentReadingBook.author}</p>
                                <div className="w-full bg-stone-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: `${currentReadingBook.progress}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="animate-fade-in-up space-y-8">
                    <div className="p-10 bg-white dark:bg-stone-900 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                        <div className="flex justify-between items-end mb-10">
                            <div><h4 className="text-xl font-serif font-black text-stone-900 dark:text-stone-100 mb-1">Активность</h4><p className="text-xs text-stone-400 font-bold uppercase tracking-widest">Страниц за неделю</p></div>
                            <div className="text-right"><p className="text-3xl font-black text-stone-900 dark:text-stone-100">{totalPagesRead}</p><p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">Всего страниц</p></div>
                        </div>
                        <div className="flex items-end justify-between gap-2 h-40">
                            {weeklyStats.map((stat, i) => (
                                <div key={stat.day} className="flex-1 flex flex-col items-center gap-3 group">
                                    <div className="w-full relative flex flex-col items-center"><div className="w-full bg-stone-100 dark:bg-stone-800 rounded-t-xl hover:bg-stone-900 dark:hover:bg-amber-500 transition-all duration-500 cursor-help" style={{ height: `${(stat.pages / maxPages) * 100}%`, minHeight: '4px', animationDelay: `${i * 100}ms` }}><div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] px-2 py-1 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity">{stat.pages}</div></div></div>
                                    <span className="text-[10px] font-black text-stone-400 uppercase">{stat.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'achievements' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in-up">
                    {achievements.map((ach) => (
                        <div key={ach.id} className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex gap-6 items-center group relative overflow-hidden ${ach.isUnlocked ? 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-xl' : 'bg-stone-50/50 dark:bg-stone-900/30 border-dashed border-stone-200 dark:border-stone-800 opacity-60 grayscale'}`}>
                            <div className="text-5xl shrink-0 filter group-hover:scale-110 transition-transform relative z-10">{ach.isUnlocked ? ach.icon : <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-2xl"><Lock size={24} className="text-stone-400" /></div>}</div>
                            <div className="flex-1 relative z-10"><h4 className="font-serif font-bold text-lg text-stone-800 dark:text-stone-100 leading-tight mb-1">{ach.title}</h4><p className="text-xs text-stone-500 dark:text-stone-400 font-medium mb-3">{ach.desc}</p>{!ach.isUnlocked && (<div className="w-full bg-stone-100 dark:bg-stone-800 h-1 rounded-full overflow-hidden"><div className="h-full bg-stone-300 dark:bg-stone-600 transition-all duration-1000" style={{ width: `${Math.min(100, (ach.progress || 0) / ach.goal * 100)}%` }} /></div>)}{ach.isUnlocked && <span className="inline-block text-[9px] font-black uppercase tracking-widest text-emerald-500 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">Разблокировано</span>}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="lg:col-span-4 space-y-8">
            {isAdmin && isOwnProfile && (
                 <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center gap-3 mb-8"><ShieldAlert className="text-rose-500" size={24} /><h3 className="text-xl font-serif font-black text-stone-800 dark:text-stone-100">Админ-панель</h3></div>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {allUsers.map((u) => (
                            <div key={u.id} className="flex items-center justify-between group p-2 hover:bg-stone-50 dark:hover:bg-stone-850 rounded-xl transition-colors">
                                <div className="flex items-center gap-3"><img src={u.profile.avatar} className="w-8 h-8 rounded-full object-cover" alt="" /><div className="text-[10px]"><p className="font-bold text-stone-800 dark:text-stone-100 truncate w-24">{u.profile.name}</p><p className="text-stone-400">{u.email}</p></div></div>
                                {u.email !== ADMIN_EMAIL && <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>}
                            </div>
                        ))}
                    </div>
                 </div>
            )}

            <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[3rem] text-white border border-stone-800 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-150 transition-transform duration-1000"><BookOpen size={120} /></div>
                <div className="relative z-10"><h5 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Всего времени</h5><p className="text-4xl font-black mb-1">{formatReadingTime(profileUser.totalReadingTime || 0)}</p><p className="text-xs font-medium opacity-60">Наслаждения текстом</p></div>
            </div>
        </div>
      </div>
    </div>
  );
};