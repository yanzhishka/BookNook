
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity } from '../types';
import { BookOpen, ArrowRight, Clock, Flame, Activity as ActivityIcon, Target, Zap, ChevronRight } from 'lucide-react';
import { db } from '../services/db';

interface DashboardProps {
  user: User;
  books: Book[];
  onNavigate: (tab: string) => void;
  onContinueReading?: (bookId: string) => void;
}

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const Dashboard: React.FC<DashboardProps> = ({ user, books, onNavigate, onContinueReading }) => {
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
        const feed = await db.getFeed(6);
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
    <div className="max-w-7xl mx-auto space-y-12 md:space-y-20">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 reveal">
        <div className="space-y-3 md:space-y-6">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-black text-stone-900 dark:text-stone-50 tracking-tighter leading-tight">
            {greeting}, <br/><span className="text-amber-500">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="text-stone-500 dark:text-stone-400 font-bold text-lg md:text-2xl opacity-80">Сегодня прекрасный день, чтобы дочитать главу.</p>
        </div>
        
        <div className="glass p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] shadow-2xl flex items-center gap-6 md:gap-10 w-full md:min-w-[400px] md:w-auto border-white/30 dark:border-white/5 group">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center text-white shadow-2xl shrink-0 transform group-hover:rotate-6 transition-transform duration-500">
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest leading-none opacity-80 mb-1">Lvl</span>
                <span className="text-3xl md:text-4xl font-black">{user.level || 1}</span>
            </div>
            <div className="flex-1 space-y-4">
                <div className="flex justify-between text-[11px] md:text-[13px] font-black uppercase tracking-widest text-stone-400">
                    <span className="text-stone-900 dark:text-stone-100">{user.xp || 0} XP</span>
                    <span>{nextLevelXp} XP</span>
                </div>
                <div className="h-3 md:h-4 w-full bg-stone-100 dark:bg-stone-850 rounded-full overflow-hidden shadow-inner p-0.5">
                    <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(245,158,11,0.5)]" style={{ width: `${levelProgress}%` }}></div>
                </div>
                <p className="text-[10px] md:text-[11px] font-black text-stone-400 uppercase tracking-widest text-right opacity-60">До {user.level + 1} уровня: {nextLevelXp - (user.xp || 0)} XP</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        {/* Featured Reading Card */}
        <div className="lg:col-span-8 group">
          <div className="bg-white dark:bg-stone-900 rounded-[3rem] md:rounded-[5rem] p-8 md:p-16 shadow-2xl border border-stone-100 dark:border-stone-800 relative overflow-hidden transition-all duration-700 hover:shadow-amber-500/5">
            <div className="absolute -top-32 -right-32 opacity-[0.02] dark:opacity-[0.04] group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 hidden md:block text-stone-900 dark:text-white">
                <BookOpen size={600} />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-10 md:gap-16 items-center">
              {currentBook ? (
                <>
                  <div className="w-48 md:w-72 shrink-0 relative perspective-1000">
                    <img src={currentBook.coverUrl} className="w-full aspect-[2/3] object-cover rounded-[2.5rem] md:rounded-[4rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] transition-all duration-700 group-hover:rotate-y-12 group-hover:translate-x-4" />
                    <div className="absolute -bottom-4 -right-4 md:-bottom-8 md:-right-8 w-16 h-16 md:w-24 md:h-24 bg-amber-500 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-2xl border-4 md:border-8 border-white dark:border-stone-900 transform group-hover:scale-110 transition-transform">
                      <span className="text-lg md:text-3xl font-black text-white">{currentBook.progress}%</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-6 md:space-y-10">
                    <div className="inline-flex items-center gap-3 px-5 py-2.5 md:px-6 md:py-3 bg-stone-100 dark:bg-stone-800 rounded-full text-[10px] md:text-[12px] font-black uppercase tracking-widest text-stone-500 shadow-sm">
                      <Clock size={16} className="animate-pulse text-amber-500" /> Сейчас в читалке
                    </div>
                    <div>
                      <h2 className="text-3xl md:text-5xl lg:text-6xl font-serif font-black text-stone-900 dark:text-stone-50 leading-tight mb-4 tracking-tighter">{currentBook.title}</h2>
                      <p className="text-stone-500 dark:text-stone-400 text-lg md:text-2xl font-bold italic opacity-70">от {currentBook.author}</p>
                    </div>
                    <button onClick={() => onContinueReading ? onContinueReading(currentBook.id) : onNavigate('library')} className="w-full md:w-auto px-10 py-5 md:px-14 md:py-6 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[2.5rem] md:rounded-[3rem] font-black uppercase text-[11px] md:text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center md:justify-start gap-6 hover:scale-105 active:scale-95 transition-all">
                      Продолжить чтение <ArrowRight size={22} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 md:py-24 text-center w-full space-y-8">
                  <BookOpen size={80} className="mx-auto text-stone-200 dark:text-stone-800" />
                  <p className="text-stone-400 font-serif italic text-2xl md:text-4xl max-w-lg mx-auto leading-relaxed">Ваша полка пуста. Самое время начать новую историю.</p>
                  <button onClick={() => onNavigate('library')} className="px-10 py-5 bg-amber-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-105 transition-all">Найти книгу</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className="lg:col-span-4 space-y-8 md:space-y-12">
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 dark:from-stone-800 dark:to-stone-950 p-10 md:p-14 rounded-[3.5rem] md:rounded-[5rem] text-white shadow-2xl relative overflow-hidden group">
            <Flame size={160} className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-125 transition-transform duration-1000 text-amber-500" />
            <div className="relative z-10 space-y-8 md:space-y-12">
              <div>
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] opacity-40">Ударная серия</span>
                <h3 className="text-6xl md:text-9xl font-black tracking-tighter leading-none mt-4 group-hover:translate-x-2 transition-transform duration-500">{user.streakDays || 0}</h3>
              </div>
              <p className="text-sm md:text-lg font-bold opacity-60 leading-relaxed max-w-[240px]">Дней непрерывного чтения. Твой разум на пределе!</p>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-stone-100 dark:border-stone-800 shadow-xl flex items-center gap-6 md:gap-8 group hover-lift">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-50 dark:bg-amber-900/20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover:rotate-12 transition-transform">
              <Target className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div className="flex-1">
              <h4 className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Цель 2024</h4>
              <p className="text-2xl md:text-4xl font-black text-stone-900 dark:text-white leading-none tracking-tighter">{user.booksReadThisYear} / 20</p>
              <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-850 rounded-full mt-4 overflow-hidden shadow-inner">
                <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, (user.booksReadThisYear / 20) * 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Stats & Community Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        <div className="bg-white dark:bg-stone-900 p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-stone-100 dark:border-stone-800 shadow-xl space-y-8 md:space-y-12 hover-lift">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <Zap className="text-amber-500 w-6 h-6 md:w-8 md:h-8" />
              <h3 className="font-serif font-black text-xl md:text-3xl text-stone-800 dark:text-stone-100 tracking-tight">Статистика</h3>
            </div>
            <button onClick={() => onNavigate('profile')} className="text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"><ChevronRight size={28}/></button>
          </div>
          <div className="space-y-8">
            <div>
              <p className="text-4xl md:text-5xl font-black text-stone-900 dark:text-white tracking-tighter mb-2">{formatReadingTime(user.totalReadingTime || 0)}</p>
              <p className="text-[10px] md:text-[12px] font-black text-stone-400 uppercase tracking-widest">Всего в читалке</p>
            </div>
            <div className="h-px bg-stone-100 dark:bg-stone-800" />
            <div>
              <p className="text-4xl md:text-5xl font-black text-stone-900 dark:text-white tracking-tighter mb-2">{user.booksReadThisYear}</p>
              <p className="text-[10px] md:text-[12px] font-black text-stone-400 uppercase tracking-widest">Завершено книг</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-stone-100 dark:border-stone-800 shadow-xl space-y-10 md:space-y-14 lg:col-span-2 hover-lift">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <ActivityIcon className="text-amber-500 w-6 h-6 md:w-8 md:h-8" />
              <h3 className="font-serif font-black text-xl md:text-3xl text-stone-800 dark:text-stone-100 tracking-tight">Сообщество</h3>
            </div>
            <button onClick={() => onNavigate('feed')} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all flex items-center gap-2">Смотреть всё <ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {loadingFeed ? (
              <div className="animate-pulse space-y-4 col-span-2">
                {[1,2].map(i => <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl w-full"></div>)}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-stone-400 text-lg font-bold italic col-span-2 py-8 text-center opacity-40">Лента пока пуста.</p>
            ) : (
              recentActivity.slice(0, 4).map(act => (
                <div key={act.id} className="flex gap-5 p-5 rounded-[2rem] bg-stone-50/50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 group hover:bg-white dark:hover:bg-stone-800 transition-all cursor-pointer shadow-sm hover:shadow-xl">
                  <img src={act.user.avatar} className="w-12 h-12 md:w-14 md:h-14 rounded-[1.2rem] object-cover shrink-0 ring-2 ring-white/10" />
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-black text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors">{act.user.name}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 italic mt-2 leading-relaxed font-serif">«{act.content}»</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
