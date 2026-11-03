
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, CommunityTopic } from '../types';
import { BookOpen, ArrowRight, Flame, Activity as ActivityIcon, Target, Zap, ChevronRight } from 'lucide-react';
import { community } from '../services/community';
import styles from './Dashboard.module.css';

interface DashboardProps {
  user: User;
  books: Book[];
  onNavigate: (tab: string) => void;
  onContinueReading?: (bookId: string) => void;
  onOpenTopic?: (topic: CommunityTopic) => void;
}

const formatReadingTime = (seconds: number) => {
  if (!seconds) return '0м';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
};

export const Dashboard: React.FC<DashboardProps> = ({ user, books, onNavigate, onContinueReading, onOpenTopic }) => {
  const [recentActivity, setRecentActivity] = useState<CommunityTopic[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [communityError, setCommunityError] = useState(false);
  const [greeting, setGreeting] = useState('');

  const currentBook = useMemo(() => books
    .filter(b => b.status === 'reading')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0], [books]);

  useEffect(() => {
    const controller = new AbortController();
    const hour = new Date().getHours();
    if (hour < 5) setGreeting('Доброй ночи');
    else if (hour < 12) setGreeting('Доброе утро');
    else if (hour < 18) setGreeting('Добрый день');
    else setGreeting('Добрый вечер');

    const loadCommunity = async () => {
      try {
        const result = await community.list({query:'',kind:'all',scope:'all',sort:'active',pageSize:4},controller.signal);
        if(!controller.signal.aborted) setRecentActivity(result.topics);
      } catch (e) {
        if(!controller.signal.aborted) setCommunityError(true);
      } finally {
        if(!controller.signal.aborted) setLoadingCommunity(false);
      }
    };
    loadCommunity();
    return () => controller.abort();
  }, []);

  const nextLevelXp = (user.level || 1) * 1000;
  const levelProgress = Math.min(100, Math.round(((user.xp || 0) / nextLevelXp) * 100));

  return (
    <div className={styles.dashboard}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.intro}>
          <h1 className={`${styles.greeting} font-serif font-bold text-stone-900 dark:text-stone-50 leading-snug`}>
            {greeting}, <span className="text-amber-500">{user.name.split(' ')[0]}</span>
          </h1>
        </div>
        
        <div className={`${styles.levelCard} glass rounded-[2rem] shadow-xl border-white/30 dark:border-white/5 group`}>
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center text-white shadow-2xl shrink-0 transform group-hover:rotate-6 transition-transform duration-500">
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-widest leading-none opacity-80 mb-1">Lvl</span>
                <span className="text-3xl md:text-4xl font-black">{user.level || 1}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-4">
                <div className="flex justify-between text-[11px] md:text-[13px] font-black uppercase tracking-widest text-stone-400">
                    <span className="text-stone-900 dark:text-stone-100">{user.xp || 0} XP</span>
                    <span>{nextLevelXp} XP</span>
                </div>
                <div className="h-3 md:h-4 w-full bg-stone-100 dark:bg-stone-850 rounded-full overflow-hidden shadow-inner p-0.5">
                    <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(245,158,11,0.5)]" style={{ width: `${levelProgress}%` }}></div>
                </div>
            </div>
        </div>
      </div>

      <div className={styles.readingGrid}>
        {/* Featured Reading Card */}
        <div className="min-w-0 group">
          <div className={`${styles.featured} bg-white dark:bg-stone-900 rounded-[2.5rem] shadow-xl border border-stone-100 dark:border-stone-800 relative overflow-hidden transition-all duration-700 hover:shadow-amber-500/5`}>
            <div className="absolute -top-32 -right-32 opacity-[0.02] dark:opacity-[0.04] group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000 hidden md:block text-stone-900 dark:text-white">
                <BookOpen size={600} />
            </div>
            
            <div className={styles.featuredInner}>
              {currentBook ? (
                <>
                  <div className={styles.cover}>
                    <img src={currentBook.coverUrl} className="w-full aspect-[2/3] object-cover rounded-[2.5rem] md:rounded-[4rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)] transition-all duration-700 group-hover:rotate-y-12 group-hover:translate-x-4" />
                    <div className="absolute -bottom-4 -right-4 md:-bottom-8 md:-right-8 w-16 h-16 md:w-24 md:h-24 bg-amber-500 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center shadow-2xl border-4 md:border-8 border-white dark:border-stone-900 transform group-hover:scale-110 transition-transform">
                      <span className="text-lg md:text-3xl font-black text-white">{currentBook.progress}%</span>
                    </div>
                  </div>
                  <div className={`${styles.bookInfo} text-center sm:text-left space-y-6`}>
                    <div>
                      <h2 className="text-xl sm:text-2xl xl:text-3xl font-serif font-bold text-stone-900 dark:text-stone-50 leading-snug mb-3">{currentBook.title}</h2>
                      <p className="text-stone-500 dark:text-stone-400 text-base md:text-lg font-medium opacity-70">{currentBook.author}</p>
                    </div>
                    <button onClick={() => onContinueReading ? onContinueReading(currentBook.id) : onNavigate('library')} className="w-full md:w-auto px-5 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[2.5rem] md:rounded-[3rem] font-black uppercase text-[11px] md:text-xs tracking-[0.2em] shadow-2xl flex items-center justify-center md:justify-start gap-6 hover:scale-105 active:scale-95 transition-all">
                      Продолжить <ArrowRight size={22} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 md:py-24 text-center w-full space-y-8">
                  <BookOpen size={80} className="mx-auto text-stone-200 dark:text-stone-800" />
                  <p className="text-stone-400 font-serif text-2xl md:text-4xl max-w-lg mx-auto leading-relaxed">На полке пока пусто</p>
                  <button onClick={() => onNavigate('library')} className="px-10 py-5 bg-amber-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl hover:scale-105 transition-all">Найти книгу</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Side Stats */}
        <div className={styles.sideStats}>
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 dark:from-stone-800 dark:to-stone-950 p-10 md:p-14 rounded-[3.5rem] md:rounded-[5rem] text-white shadow-2xl relative overflow-hidden group">
            <Flame size={160} className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-125 transition-transform duration-1000 text-amber-500" />
            <div className="relative z-10 space-y-8 md:space-y-12">
              <div>
                <span className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] opacity-40">Ударная серия</span>
                <h3 className="text-4xl md:text-6xl font-bold leading-none mt-4">{user.streakDays || 0}</h3>
              </div>
              <p className="text-sm font-medium opacity-60 leading-relaxed max-w-[240px]">Дней чтения подряд</p>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-stone-100 dark:border-stone-800 shadow-xl flex items-center gap-6 md:gap-8 group hover-lift">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-50 dark:bg-amber-900/20 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-amber-500 shrink-0 shadow-inner group-hover:rotate-12 transition-transform">
              <Target className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2">Цель на год</h4>
              <p className="text-2xl md:text-4xl font-black text-stone-900 dark:text-white leading-none tracking-tighter">{user.booksReadThisYear} / 20</p>
              <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-850 rounded-full mt-4 overflow-hidden shadow-inner">
                <div className="h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, (user.booksReadThisYear / 20) * 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Stats & Community Feed */}
      <div className={styles.quickGrid}>
        <div className={`${styles.statsCard} bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-xl space-y-8 hover-lift`}>
          <div className={styles.sectionHeader}>
            <div className="flex items-center gap-3">
              <Zap className="text-amber-500 w-6 h-6 md:w-8 md:h-8" />
              <h3 className={`${styles.sectionTitle} font-serif font-bold text-stone-800 dark:text-stone-100`}>Статистика</h3>
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

        <div className={`${styles.communityCard} bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-xl space-y-8 hover-lift`}>
          <div className={styles.sectionHeader}>
            <div className="flex items-center gap-3">
              <ActivityIcon className="text-amber-500 w-6 h-6 md:w-8 md:h-8" />
              <h3 className={`${styles.sectionTitle} font-serif font-bold text-stone-800 dark:text-stone-100`}>В The Grid</h3>
            </div>
            <button onClick={() => onNavigate('board')} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all flex items-center gap-2">Все темы <ChevronRight size={14} /></button>
          </div>
          <div className={styles.communityGrid}>
            {loadingCommunity ? (
              <div className="animate-pulse space-y-4 col-span-full">
                {[1,2].map(i => <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl w-full"></div>)}
              </div>
            ) : communityError ? (
              <p className="col-span-full text-sm text-stone-500">Не удалось загрузить темы. <button className="underline" onClick={() => onNavigate('board')}>Открыть The Grid</button></p>
            ) : recentActivity.length === 0 ? (
              <p className="text-stone-400 text-lg font-bold italic col-span-full py-8 text-center opacity-40">В The Grid пока нет тем</p>
            ) : (
              recentActivity.slice(0, 4).map(act => (
                <button type="button" key={`${act.source}:${act.id}`} onClick={() => onOpenTopic ? onOpenTopic(act) : onNavigate('board')} className="text-left flex gap-5 p-5 rounded-[2rem] bg-stone-50/50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 group hover:bg-white dark:hover:bg-stone-800 transition-all cursor-pointer shadow-sm hover:shadow-xl">
                  <img src={act.authorAvatar || 'https://ui-avatars.com/api/?name=Читатель'} className="w-12 h-12 md:w-14 md:h-14 rounded-[1.2rem] object-cover shrink-0 ring-2 ring-white/10" />
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-black text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors">{act.title}</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 italic mt-2 leading-relaxed font-serif">{act.authorName}: {act.content}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
