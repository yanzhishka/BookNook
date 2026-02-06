
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity } from '../types';
import { BookOpen, ArrowRight, Clock, Flame, Activity as ActivityIcon, Target, Zap, ChevronRight } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 reveal">
        <div className="space-y-2 md:space-y-4">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-black text-stone-900 dark:text-stone-50 tracking-tighter leading-tight">
            {greeting}, <br/><span className="text-amber-500">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 font-medium text-sm md:text-lg">Сегодня прекрасный день, чтобы дочитать главу.</p>
        </div>
        
        <div className="glass p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl flex items-center gap-4 md:gap-8 w-full md:min-w-[340px] md:w-auto border-white/20 dark:border-white/5">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center text-white shadow-lg shrink-0">
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-tighter leading-none opacity-80">Lvl</span>
                <span className="text-2xl md:text-3xl font-black">{user.level || 1}</span>
            </div>
            <div className="flex-1 space-y-2 md:space-y-3">
                <div className="flex justify-between text-[10px] md:text-[11px] font-black uppercase tracking-widest text-stone-400">
                    <span>{user.xp || 0} XP</span>
                    <span>{nextLevelXp} XP</span>
                </div>
                <div className="h-2 md:h-3 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000" style={{ width: `${levelProgress}%` }}></div>
                </div>
                <p className="text-[8px] md:text-[9px] font-bold text-stone-400 uppercase tracking-widest">До следующего уровня: {nextLevelXp - (user.xp || 0)} XP</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Featured Reading Card */}
        <div className="lg:col-span-8 group">
          <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-12 shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden transition-all duration-500 hover:shadow-2xl">
            <div className="absolute -top-20 -right-20 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-1000 hidden md:block">
                <BookOpen size={400} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-8 md:gap-12 items-center">
              {currentBook ? (
                <>
                  <div className="w-40 md:w-56 shrink-0 relative perspective-1000">
                    <img src={currentBook.coverUrl} className="w-full aspect-[2/3] object-cover rounded-3xl md:rounded-[2.5rem] shadow-2xl transition-transform duration-700 md:group-hover:rotate-y-12" />
                    <div className="absolute -bottom-3 -right-3 md:-bottom-6 md:-right-6 w-12 h-12 md:w-20 md:h-20 bg-amber-500 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl border-2 md:border-4 border-white dark:border-stone-900">
                      <span className="text-sm md:text-2xl font-black text-white">{currentBook.progress}%</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4 md:space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-stone-100 dark:bg-stone-800 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-500">
                      <Clock size={12} className="animate-pulse text-amber-500" /> Сейчас читаю
                    </div>
                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-serif font-black text-stone-900 dark:text-stone-50 leading-tight">{currentBook.title}</h2>
                    <p className="text-stone-500 dark:text-stone-400 text-sm md:text-xl font-medium italic">от {currentBook.author}</p>
                    <button onClick={() => onNavigate('library')} className="w-full md:w-auto px-6 py-4 md:px-10 md:py-5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-2xl md:rounded-[2rem] font-black uppercase text-[10px] md:text-xs tracking-widest shadow-xl flex items-center justify-center md:justify-start gap-4 hover:scale-[1.02] active:scale-95 transition-all">
                      Продолжить <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8 md:py-12 text-center w-full space-y-4 md:space-y-6">
                  <p className="text-stone-400 font-serif italic text-lg md:text-2xl">Ваша полка пуста. Время для новой главы.</p>
                  <button onClick={() => onNavigate('library')} className="px-6 py-3 md:px-8 md:py-4 bg-amber-500 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest shadow-lg shadow-amber-500/20">Найти книгу</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 dark:from-stone-800 dark:to-stone-950 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
            <Flame size={120} className="absolute -bottom-8 -right-8 opacity-10 md:group-hover:scale-125 transition-transform duration-700 text-amber-500" />
            <div className="relative z-10 space-y-4 md:space-y-8">
              <div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Ударная серия</span>
                <h3 className="text-5xl md:text-7xl font-black tracking-tighter leading-none mt-2">{user.streakDays || 0}</h3>
              </div>
              <p className="text-xs md:text-sm font-medium opacity-60 leading-relaxed max-w-[200px]">Дней непрерывного чтения. Вы молодец!</p>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm flex items-center gap-4 md:gap-6 group">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 dark:bg-amber-900/20 rounded-xl md:rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
              <Target className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="flex-1">
              <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Цель на год</h4>
              <p className="text-xl md:text-2xl font-black text-stone-900 dark:text-white leading-none">{user.booksReadThisYear} / 20</p>
              <div className="h-1 w-full bg-stone-100 dark:bg-stone-800 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${(user.booksReadThisYear / 20) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rituals & Feed Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="bg-white dark:bg-stone-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm space-y-6 md:space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <Zap className="text-amber-500 w-5 h-5 md:w-6 md:h-6" />
              <h3 className="font-serif font-black text-lg md:text-xl text-stone-800 dark:text-stone-100">Статистика</h3>
            </div>
            <button onClick={() => onNavigate('profile')} className="text-stone-400 hover:text-stone-900"><ChevronRight size={20}/></button>
          </div>
          <div className="space-y-4 md:space-y-6">
            <div>
              <p className="text-3xl md:text-4xl font-black text-stone-900 dark:text-white tracking-tighter">{formatReadingTime(user.totalReadingTime || 0)}</p>
              <p className="text-[9px] md:text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Всего в читалке</p>
            </div>
            <div className="h-px bg-stone-100 dark:bg-stone-800" />
            <div>
              <p className="text-3xl md:text-4xl font-black text-stone-900 dark:text-white tracking-tighter">{user.booksReadThisYear}</p>
              <p className="text-[9px] md:text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Завершено книг</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm space-y-6 md:space-y-8 lg:col-span-2">
          <div className="flex items-center gap-3 md:gap-4">
            <ActivityIcon className="text-amber-500 w-5 h-5 md:w-6 md:h-6" />
            <h3 className="font-serif font-black text-lg md:text-xl text-stone-800 dark:text-stone-100">Сообщество</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {loadingFeed ? <div className="animate-pulse space-y-4 col-span-2"><div className="h-4 bg-stone-100 rounded w-full"></div><div className="h-4 bg-stone-100 rounded w-3/4"></div></div> : recentActivity.length === 0 ? <p className="text-stone-400 text-sm font-medium col-span-2 py-4">Лента пока пуста.</p> : recentActivity.slice(0, 4).map(act => (
              <div key={act.id} className="flex gap-4 p-4 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 group hover:bg-white dark:hover:bg-stone-800 transition-all cursor-pointer">
                <img src={act.user.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-xs text-stone-800 dark:text-stone-200 truncate">{act.user.name}</p>
                  <p className="text-[10px] text-stone-400 line-clamp-2 italic mt-1 leading-relaxed">«{act.content}»</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
