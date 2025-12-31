
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity, Quest } from '../types';
import { BookOpen, ArrowRight, Quote as QuoteIcon, Zap, Clock, TrendingUp, Sparkles, Flame, Target, Trophy, Star } from 'lucide-react';
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

const QUOTE_LIBRARY = [
  { text: "Книги — это уникальное портативное волшебство.", source: "Стивен Кинг" },
  { text: "Мир — это книга, и те, кто не путешествуют, читают лишь одну страницу.", source: "Святой Августин" },
  { text: "Книги — это зеркала: в них видишь только то, что уже есть у тебя в душе.", source: "Карлос Руис Сафон" }
];

const DEFAULT_QUESTS: Quest[] = [
  { id: '1', title: 'Прочитать 20 страниц', icon: '📖', goal: 20, current: 12, reward: 'Мудрость' },
  { id: '2', title: 'Оставить 3 заметки', icon: '✍️', goal: 3, current: 1, reward: 'Вдохновение' },
  { id: '3', title: 'Поделиться цитатой', icon: '✨', goal: 1, current: 0, reward: 'Признание' },
];

export const Dashboard: React.FC<DashboardProps> = ({ user, books, onNavigate }) => {
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [greeting, setGreeting] = useState('');
  
  const dailyQuote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * QUOTE_LIBRARY.length);
    return QUOTE_LIBRARY[randomIndex];
  }, []);

  const currentBook = useMemo(() => books
    .filter(b => b.status === 'reading')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0], [books]);

  const yearlyGoal = 20;
  const progressPercent = Math.min(100, Math.round((user.booksReadThisYear / yearlyGoal) * 100));
  
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 5) setGreeting('Доброй ночи');
    else if (hour < 12) setGreeting('Доброе утро');
    else if (hour < 18) setGreeting('Добрый день');
    else setGreeting('Добрый вечер');

    const loadQuickFeed = async () => {
      try {
        const feed = await db.getFeed();
        setRecentActivity(feed.slice(0, 5)); 
      } catch (e) {
        console.error("Failed to load dashboard feed", e);
      } finally {
        setLoadingFeed(false);
      }
    };
    loadQuickFeed();
  }, []);

  return (
    <div className="max-w-6xl mx-auto pb-24 px-4 md:px-0 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 dark:bg-amber-500/[0.02] rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 animate-fade-in-up">
        <div>
          <h1 className="text-5xl md:text-6xl font-serif font-black text-stone-800 dark:text-stone-100 mb-2 tracking-tighter">
            {greeting}, {user.name.split(' ')[0]}.
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-xl">Ваш прогресс сегодня впечатляет.</p>
        </div>
        <div className="mt-6 md:mt-0 flex flex-col items-end">
           <p className="text-sm font-black text-stone-400 uppercase tracking-[0.3em] mb-2">
               {new Date().toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' })}
           </p>
           <div className="h-1 w-20 bg-stone-900 dark:bg-stone-100 rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-8 bg-white dark:bg-stone-900 rounded-[3rem] p-10 border border-stone-100 dark:border-stone-800 relative overflow-hidden group shadow-sm hover:shadow-xl transition-all duration-500">
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                  <span className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 border border-stone-200 dark:border-stone-700">
                      <Clock size={14} className="text-amber-500 animate-pulse" /> Продолжить чтение
                  </span>
              </div>

              {currentBook ? (
                <div className="flex flex-col md:flex-row gap-10">
                    <div className="w-40 md:w-52 shrink-0 relative">
                        <img 
                            src={currentBook.coverUrl} 
                            alt={currentBook.title} 
                            loading="lazy"
                            className="relative w-full aspect-[2/3] object-cover rounded-2xl shadow-2xl transform -rotate-2 group-hover:rotate-0 transition-all duration-700" 
                        />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                        <h2 className="text-4xl font-serif font-black text-stone-800 dark:text-stone-100 mb-3 leading-tight tracking-tight">
                            {currentBook.title}
                        </h2>
                        <p className="text-stone-500 dark:text-stone-400 text-lg mb-8 font-medium">от {currentBook.author}</p>
                        
                        <div className="mb-4 flex justify-between items-end">
                            <span className="text-3xl font-black text-stone-900 dark:text-white">{currentBook.progress}%</span>
                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{currentBook.currentPage} / {currentBook.totalPages} стр.</span>
                        </div>
                        <div className="w-full bg-stone-100 dark:bg-stone-800/50 rounded-full h-2.5 overflow-hidden mb-10">
                            <div className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-1000 ease-out" style={{ width: `${currentBook.progress}%` }}></div>
                        </div>

                        <button 
                            onClick={() => onNavigate('library')}
                            className="w-full md:w-fit bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:gap-5 transition-all shadow-lg active:scale-95"
                        >
                            Открыть <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
              ) : (
                <div className="text-center py-20">
                    <BookOpen size={64} className="text-stone-200 dark:text-stone-800 mb-6 mx-auto" />
                    <button onClick={() => onNavigate('library')} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-xl font-bold text-sm">В библиотеку</button>
                </div>
              )}
           </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-stone-900 dark:bg-stone-950 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group border border-stone-800">
                <Sparkles size={120} className="absolute -top-10 -right-10 opacity-10 group-hover:scale-125 transition-transform duration-1000" />
                <h3 className="text-xl font-serif font-black mb-6 flex items-center gap-2">
                    <Star size={20} className="text-amber-400 fill-amber-400" /> Квесты дня
                </h3>
                <div className="space-y-6">
                    {DEFAULT_QUESTS.map(quest => (
                        <div key={quest.id} className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-stone-400">
                                <span className="flex items-center gap-2"><span className="text-base">{quest.icon}</span> {quest.title}</span>
                                <span>{quest.current}/{quest.goal}</span>
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400" style={{ width: `${(quest.current / quest.goal) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                <div className="flex items-center gap-8">
                    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 absolute inset-0">
                            <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-stone-50 dark:text-stone-800/40" />
                            <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" 
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                className="text-stone-900 dark:text-amber-500 transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-stone-900 dark:text-white leading-none mb-0.5">{user.booksReadThisYear}</span>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Книг</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-2">Цель</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">{user.booksReadThisYear} из {yearlyGoal}</p>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase">
                            <TrendingUp size={12} /> {progressPercent}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
            <div className="bg-stone-900 dark:bg-stone-950 p-8 h-full rounded-[3rem] text-white flex flex-col justify-center items-center text-center shadow-lg group">
                <Flame size={28} className="text-orange-500 animate-bounce mb-4" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Серия</h4>
                <p className="text-5xl font-black tracking-tighter">{user.streakDays || 0}</p>
                <p className="text-xs font-bold opacity-60 uppercase mt-2 tracking-widest">Дней</p>
            </div>
        </div>

        <div className="lg:col-span-9 bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-black text-stone-800 dark:text-stone-100 flex items-center gap-3">
                    <Zap className="text-rose-500" size={24} />
                    События друзей
                </h3>
            </div>
            <div className="flex-1 space-y-4">
                {loadingFeed ? (
                  [1,2,3].map(i => <div key={i} className="h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl animate-pulse" />)
                ) : (
                    recentActivity.map((act) => (
                        <div key={act.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                            <img src={act.user.avatar} className="w-10 h-10 rounded-full object-cover" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-stone-800 dark:text-stone-100">{act.user.name}</p>
                                <p className="text-[10px] text-stone-400 line-clamp-1 italic">{act.content}</p>
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
