
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity } from '../types';
import { BookOpen, ArrowRight, Quote as QuoteIcon, Clock, Flame, Activity as ActivityIcon, Target, Zap, ChevronRight } from 'lucide-react';
import { db } from '../services/db';

interface DashboardProps {
  user: User;
  books: Book[];
  onNavigate: (tab: string) => void;
}

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const Dashboard: React.FC<DashboardProps> = ({ user, books, onNavigate }) => {
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [greeting, setGreeting] = useState('');

  const currentBook = useMemo(() => books
    .filter(b => b.status === 'reading')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0], [books]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 5) setGreeting('Доброй ночи');
    else if (hour < 12) setGreeting('Доброе утро');
    else if (hour < 18) setGreeting('Добрый день');
    else setGreeting('Добрый вечер');

    const loadQuickFeed = async () => {
      try {
        const feed = await db.getFeed(5);
        setRecentActivity(feed);
      } catch (e) {
        console.error("Dashboard feed error", e);
      } finally {
        setLoadingFeed(false);
      }
    };
    loadQuickFeed();
  }, []);

  const nextLevelXp = (user.level || 1) * 1000;
  const levelProgress = Math.min(100, Math.round(((user.xp || 0) / nextLevelXp) * 100));

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-12">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 reveal">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-7xl font-serif font-black text-stone-900 dark:text-stone-50 tracking-tighter leading-none">
            {greeting}, <br/><span className="text-amber-500">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 font-medium text-lg">Сегодня прекрасный день, чтобы дочитать главу.</p>
        </div>
        
        <div className="glass p-8 rounded-[3rem] shadow-2xl flex items-center gap-8 min-w-[340px] border-white/20 dark:border-white/5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center text-white shadow-lg">
                <span className="text-[10px] font-black uppercase tracking-tighter leading-none opacity-80">Lvl</span>
                <span className="text-3xl font-black">{user.level || 1}</span>
            </div>
            <div className="flex-1 space-y-3">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-stone-400">
                    <span>{user.xp || 0} XP</span>
                    <span>{nextLevelXp} XP</span>
                </div>
                <div className="h-3 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000" style={{ width: `${levelProgress}%` }}></div>
                </div>
                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">До следующего уровня: {nextLevelXp - (user.xp || 0)} XP</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Featured Reading Card */}
        <div className="lg:col-span-8 group">
          <div className="bg-white dark:bg-stone-900 rounded-[4rem] p-12 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            <div className="absolute -top-20 -right-20 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-1000">
                <BookOpen size={400} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
              {currentBook ? (
                <>
                  <div className="w-56 shrink-0 relative perspective-1000">
                    <img src={currentBook.coverUrl} className="w-full aspect-[2/3] object-cover rounded-[2.5rem] shadow-2xl transition-transform duration-700 group-hover:rotate-y-12" />
                    <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-white dark:border-stone-900">
                      <span className="text-2xl font-black text-white">{currentBook.progress}%</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-stone-800 rounded-full text-[10px] font-black uppercase tracking-widest text-stone-500">
                      <Clock size={14} className="animate-pulse text-amber-500" /> Сейчас читаю
                    </div>
                    <h2 className="text-5xl font-serif font-black text-stone-900 dark:text-stone-50 leading-tight">{currentBook.title}</h2>
                    <p className="text-stone-500 dark:text-stone-400 text-xl font-medium italic">от {currentBook.author}</p>
                    <button onClick={() => onNavigate('library')} className="px-10 py-5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-4 hover:scale-105 active:scale-95 transition-all">
                      Открыть читалку <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center w-full space-y-6">
                  <p className="text-stone-400 font-serif italic text-2xl">Ваша полка пуста. Время для новой главы.</p>
                  <button onClick={() => onNavigate('library')} className="px-8 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-amber-500/20">Найти книгу</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 dark:from-stone-800 dark:to-stone-950 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all">
            <Flame size={120} className="absolute -bottom-8 -right-8 opacity-10 group-hover:scale-125 transition-transform duration-700 text-amber-500" />
            <div className="relative z-10 space-y-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ударная серия</span>
                <h3 className="text-7xl font-black tracking-tighter leading-none mt-2">{user.streakDays || 0}</h3>
              </div>
              <p className="text-sm font-medium opacity-60 leading-relaxed max-w-[200px]">Дней непрерывного чтения. Вы молодец!</p>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm flex items-center gap-6 group hover:border-amber-500/30 transition-all">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-500 transition-transform group-hover:scale-110">
              <Target size={32} />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Цель на год</h4>
              <p className="text-2xl font-black text-stone-900 dark:text-white leading-none mb-1">{user.booksReadThisYear} / 20</p>
              <div className="h-1 w-24 bg-stone-100 dark:bg-stone-800 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(user.booksReadThisYear / 20) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rituals & Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm space-y-8 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Zap className="text-amber-500" size={24} />
              <h3 className="font-serif font-black text-xl text-stone-800 dark:text-stone-100">Статистика</h3>
            </div>
            <button onClick={() => onNavigate('profile')} className="text-stone-400 hover:text-stone-900"><ChevronRight size={20}/></button>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">{formatReadingTime(user.totalReadingTime || 0)}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Всего в читалке</p>
            </div>
            <div className="h-px bg-stone-100 dark:bg-stone-800" />
            <div>
              <p className="text-4xl font-black text-stone-900 dark:text-white tracking-tighter">{user.booksReadThisYear}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Завершено книг</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm space-y-8 md:col-span-2">
          <div className="flex items-center gap-4">
            <ActivityIcon className="text-amber-500" size={24} />
            <h3 className="font-serif font-black text-xl text-stone-800 dark:text-stone-100">Последнее из сообщества</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingFeed ? <div className="animate-pulse space-y-4 col-span-2"><div className="h-4 bg-stone-100 rounded w-full"></div><div className="h-4 bg-stone-100 rounded w-3/4"></div></div> : recentActivity.map(act => (
              <div key={act.id} className="flex gap-4 p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 group hover:bg-white dark:hover:bg-stone-800 transition-all cursor-pointer">
                <img src={act.user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-stone-800 dark:text-stone-200 truncate">{act.user.name}</p>
                  <p className="text-xs text-stone-400 line-clamp-2 italic mt-1 leading-relaxed">«{act.content}»</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
