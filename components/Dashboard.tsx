
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity } from '../types';
import { BookOpen, ArrowRight, Quote as QuoteIcon, Zap, Clock, TrendingUp, Sparkles, Flame} from 'lucide-react';
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
  { text: "Я всегда воображал, что Рай будет своего рода библиотекой.", source: "Хорхе Луис Борхес" },
  { text: "Книги — это зеркала: в них видишь только то, что уже есть у тебя в душе.", source: "Карлос Руис Сафон" }
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
    <div className="max-w-6xl mx-auto pb-24 px-4 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 reveal">
        <div className="max-w-2xl">
          <h1 className="text-6xl md:text-7xl font-serif font-black text-stone-900 dark:text-stone-50 mb-4 tracking-tighter leading-none">
            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">{user.name.split(' ')[0]}</span>.
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-xl font-medium">Ваша литературная история продолжается здесь.</p>
        </div>
        <div className="mt-8 md:mt-0 flex flex-col items-end">
           <p className="text-xs font-black text-stone-400 uppercase tracking-[0.4em] mb-3">
               {new Date().toLocaleDateString('ru-RU', { weekday: 'long', month: 'long', day: 'numeric' })}
           </p>
           <div className="h-[2px] w-24 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Главная карточка: Сейчас читаю */}
        <div className="lg:col-span-8 glass rounded-[3.5rem] p-12 relative overflow-hidden group hover-lift reveal" style={{ animationDelay: '100ms' }}>
           <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-[100px] group-hover:bg-amber-500/20 transition-colors duration-1000"></div>
           
           <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-12">
                  <span className="bg-stone-900 dark:bg-white text-white dark:text-stone-950 text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg">
                      <Clock size={14} className="animate-spin-slow" /> Продолжить
                  </span>
              </div>

              {currentBook ? (
                <div className="flex flex-col md:flex-row gap-12 flex-1">
                    <div className="w-48 md:w-64 shrink-0 relative perspective-1000">
                        <img 
                            src={currentBook.coverUrl} 
                            alt={currentBook.title} 
                            className="relative w-full aspect-[2/3] object-cover rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] transform -rotate-3 group-hover:rotate-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" 
                        />
                        <div className="absolute -bottom-4 -right-4 bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-xl border border-stone-100 dark:border-stone-700 animate-float">
                            <Zap size={24} className="text-amber-500" />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                        <h2 className="text-5xl font-serif font-black text-stone-900 dark:text-stone-50 mb-4 leading-[1.1] tracking-tight">
                            {currentBook.title}
                        </h2>
                        <p className="text-stone-500 dark:text-stone-400 text-2xl mb-10 font-medium italic">от {currentBook.author}</p>
                        
                        <div className="space-y-4 mb-12">
                            <div className="flex justify-between items-end">
                                <span className="text-4xl font-black text-stone-900 dark:text-white">{currentBook.progress}%</span>
                                <span className="text-xs font-black text-stone-400 uppercase tracking-widest">стр. {currentBook.currentPage} / {currentBook.totalPages}</span>
                            </div>
                            <div className="w-full bg-stone-100 dark:bg-white/5 rounded-full h-3 overflow-hidden border border-stone-200/50 dark:border-white/5">
                                <div className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-full transition-all duration-[2s] cubic-bezier(0.16, 1, 0.3, 1)" style={{ width: `${currentBook.progress}%` }}></div>
                            </div>
                        </div>

                        <button 
                            onClick={() => onNavigate('library')}
                            className="w-full md:w-fit bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:scale-105 transition-all shadow-2xl active:scale-95"
                        >
                            Открыть Дневник <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
              ) : (
                <div className="text-center py-20 flex-1 flex flex-col items-center justify-center">
                    <BookOpen size={80} className="text-stone-200 dark:text-stone-800 mb-8 animate-float" />
                    <h3 className="text-3xl font-serif font-black text-stone-900 dark:text-stone-100 mb-4">Время новой главы</h3>
                    <p className="text-stone-500 mb-10 max-w-sm text-lg">Ваша библиотека полна непрожитых жизней. Выберите одну сейчас.</p>
                    <button onClick={() => onNavigate('library')} className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">В Библиотеку</button>
                </div>
              )}
           </div>
        </div>

        {/* Правая колонка: Оракул и Цель */}
        <div className="lg:col-span-4 flex flex-col gap-8">
            <div 
                onClick={() => onNavigate('oracle')}
                className="flex-1 bg-stone-900 dark:bg-[#1a1817] p-12 rounded-[3.5rem] shadow-2xl cursor-pointer group relative overflow-hidden hover-lift reveal"
                style={{ animationDelay: '200ms' }}
            >
                <div className="absolute top-0 right-0 p-6 opacity-30 transform group-hover:scale-125 transition-transform duration-1000 rotate-12">
                    <Sparkles size={200} className="text-amber-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 text-amber-500 border border-white/20 shadow-xl">
                            <Sparkles size={32} />
                        </div>
                        <h3 className="text-4xl font-serif font-black text-white mb-4 leading-tight">Оракул</h3>
                        <p className="text-white/60 text-lg leading-relaxed font-medium">Позвольте интеллекту провидеть ваше следующее чтение.</p>
                    </div>
                    <div className="flex items-center gap-3 text-white font-black text-xs uppercase tracking-[0.3em] mt-12 group-hover:translate-x-2 transition-transform">
                        Спросить судьбу <ArrowRight size={20} />
                    </div>
                </div>
            </div>

            <div className="glass p-10 rounded-[3.5rem] group hover-lift reveal" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-10">
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-stone-100 dark:text-stone-800" />
                            <circle cx="50" cy="50" r="42" stroke="url(#gradient)" strokeWidth="8" fill="transparent" 
                                strokeDasharray="263.89"
                                strokeDashoffset={263.89 - (progressPercent / 100) * 263.89}
                                strokeLinecap="round"
                                className="transition-all duration-[2.5s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                            />
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black text-stone-900 dark:text-white">{user.booksReadThisYear}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-xs font-black text-stone-400 uppercase tracking-[0.3em] mb-2">Годовая цель</h4>
                        <p className="text-xl font-black text-stone-900 dark:text-white mb-2">{yearlyGoal} Книг</p>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                            <TrendingUp size={12} /> {progressPercent}% выполнено
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 reveal" style={{ animationDelay: '400ms' }}>
        <div className="lg:col-span-3 space-y-8">
            <div className="bg-gradient-to-br from-rose-500 to-orange-600 p-10 rounded-[3.5rem] text-white shadow-2xl group relative overflow-hidden hover-lift">
                <Flame size={120} className="absolute -bottom-10 -right-10 opacity-20 group-hover:scale-150 transition-transform duration-[2s]" />
                <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-3">Streak</h4>
                    <p className="text-6xl font-black mb-2 tracking-tighter">{user.streakDays || 0}</p>
                    <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Дней в огне</p>
                </div>
            </div>
        </div>

        <div className="lg:col-span-6 glass p-10 rounded-[3.5rem] flex flex-col hover-lift">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-2xl font-serif font-black text-stone-900 dark:text-stone-50 flex items-center gap-4">
                    <Zap className="text-rose-500 animate-pulse" size={24} />
                    Активность Сообщества
                </h3>
                <button onClick={() => onNavigate('feed')} className="p-3 bg-stone-100 dark:bg-stone-800 rounded-full hover:bg-stone-900 dark:hover:bg-white hover:text-white dark:hover:text-stone-950 transition-all">
                    <ArrowRight size={20} />
                </button>
            </div>
            
            <div className="flex-1 space-y-6">
                {loadingFeed ? (
                  [1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-6 p-4">
                      <div className="w-12 h-12 rounded-full skeleton shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-3 w-32 skeleton rounded-full" />
                        <div className="h-2 w-full skeleton rounded-full" />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length > 0 ? (
                    recentActivity.map((act) => (
                        <div key={act.id} className="flex items-center gap-6 p-4 rounded-3xl hover:bg-stone-50 dark:hover:bg-white/5 transition-all group cursor-pointer">
                            <img src={act.user.avatar} className="w-12 h-12 rounded-full object-cover ring-4 ring-white dark:ring-stone-800 group-hover:ring-amber-500 transition-all" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <p className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">{act.user.name}</p>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500">{act.type}</span>
                                </div>
                                <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-1 italic font-medium">«{act.content || 'Поделился мыслями...'}»</p>
                            </div>
                            <span className="text-[10px] font-black text-stone-300 uppercase shrink-0">{act.timestamp}</span>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex items-center justify-center text-stone-300 dark:text-stone-700 italic text-lg">Пока здесь тишина...</div>
                )}
            </div>
        </div>

        <div className="lg:col-span-3 glass p-10 rounded-[3.5rem] relative overflow-hidden flex flex-col justify-between group hover-lift">
            <QuoteIcon size={100} className="absolute -top-6 -left-6 text-stone-100 dark:text-stone-800 opacity-50 transform -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
            
            <div className="relative z-10 pt-8">
                <div className="h-[2px] w-12 bg-amber-500 mb-8"></div>
                {dailyQuote && (
                    <>
                        <p className="font-serif text-xl text-stone-900 dark:text-stone-200 italic leading-relaxed mb-8 font-medium">
                            «{dailyQuote.text}»
                        </p>
                        <p className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">— {dailyQuote.source}</p>
                    </>
                )}
            </div>
            
            <div className="relative z-10 mt-12 w-full py-6 bg-stone-900 dark:bg-white rounded-3xl flex flex-col items-center shadow-xl">
                <span className="text-[9px] font-black text-white/40 dark:text-stone-400 uppercase tracking-[0.3em] mb-2">Total reading time</span>
                <span className="text-3xl font-black text-white dark:text-stone-900 tracking-tighter">{formatReadingTime(user.totalReadingTime || 0)}</span>
            </div>
        </div>
      </div>
    </div>
  );
};
