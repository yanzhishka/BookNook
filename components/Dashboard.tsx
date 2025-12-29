
import React, { useEffect, useState, useMemo } from 'react';
import { User, Book, Activity } from '../types';
import { BookOpen, ArrowRight, Quote as QuoteIcon, Zap, Clock, TrendingUp, Sparkles, Flame, Target, Trophy } from 'lucide-react';
import { db } from '../services/db';

interface DashboardProps {
  user: User;
  books: Book[];
  onNavigate: (tab: string) => void;
}

const QUOTE_LIBRARY = [
  { text: "Книги — это уникальное портативное волшебство.", source: "Стивен Кинг" },
  { text: "Мир — это книга, и те, кто не путешествуют, читают лишь одну страницу.", source: "Святой Августин" },
  { text: "Человек, который не читает хороших книг, не имеет преимуществ перед человеком, который не умеет читать.", source: "Марк Твен" },
  { text: "Комната без книг подобна телу без души.", source: "Цицерон" },
  { text: "Я всегда воображал, что Рай будет своего рода библиотекой.", source: "Хорхе Луис Борхес" },
  { text: "Нет более верного друга, чем книга.", source: "Эрнест Хемингуэй" },
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
           <div className="absolute top-0 right-0 w-80 h-80 bg-stone-50 dark:bg-stone-800/20 rounded-full translate-x-10 -translate-y-10 blur-3xl"></div>
           
           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                  <span className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 border border-stone-200 dark:border-stone-700">
                      <Clock size={14} className="text-amber-500 animate-pulse" /> Продолжить чтение
                  </span>
              </div>

              {currentBook ? (
                <div className="flex flex-col md:flex-row gap-10">
                    <div className="w-40 md:w-52 shrink-0 relative">
                        <div className="absolute inset-0 bg-black/20 blur-xl translate-y-4 translate-x-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
                        <div className="w-full bg-stone-100 dark:bg-stone-800/50 rounded-full h-2.5 overflow-hidden mb-10 border border-stone-200 dark:border-stone-700">
                            <div className="h-full bg-stone-900 dark:bg-stone-100 rounded-full transition-all duration-1000 ease-out" style={{ width: `${currentBook.progress}%` }}></div>
                        </div>

                        <button 
                            onClick={() => onNavigate('library')}
                            className="w-full md:w-fit bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:gap-5 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-lg active:scale-95"
                        >
                            Открыть книгу <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
              ) : (
                <div className="text-center py-20 flex-1 flex flex-col items-center justify-center">
                    <BookOpen size={64} className="text-stone-200 dark:text-stone-800 mb-6" />
                    <h3 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Ничего не читаете?</h3>
                    <p className="text-stone-500 mb-8 max-w-xs mx-auto">Выберите новую историю в библиотеке или доверьтесь Оракулу.</p>
                    <button onClick={() => onNavigate('library')} className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-xl font-bold text-sm">В библиотеку</button>
                </div>
              )}
           </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
            <div 
                onClick={() => onNavigate('oracle')}
                className="flex-1 bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 p-10 rounded-[3rem] shadow-xl cursor-pointer group relative overflow-hidden hover:scale-[1.02] transition-all duration-500"
            >
                <div className="absolute top-0 right-0 p-4 opacity-20 transform group-hover:scale-150 transition-transform duration-1000">
                    <Sparkles size={180} />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg border border-white/30">
                            <Sparkles size={28} />
                        </div>
                        <h3 className="text-3xl font-serif font-black text-white mb-3 leading-tight">Спросить<br/>Оракула</h3>
                        <p className="text-white/80 text-sm leading-relaxed">ИИ подберет книгу под ваше настроение.</p>
                    </div>
                    <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.3em] mt-8">
                        Узнать судьбу <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm group">
                <div className="flex items-center gap-8">
                    <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 absolute inset-0">
                            <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-stone-50 dark:text-stone-800/40" />
                            <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" 
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                className="text-stone-900 dark:text-amber-500 transition-all duration-1000 ease-out filter dark:drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                            />
                        </svg>
                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-stone-900 dark:text-white leading-none mb-0.5">{user.booksReadThisYear}</span>
                            <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Цель</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-stone-800 dark:text-stone-100 uppercase tracking-widest mb-2">Годовая цель</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">{user.booksReadThisYear} из {yearlyGoal} книг</p>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase">
                            <TrendingUp size={12} /> {progressPercent}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
            <div className="bg-stone-900 dark:bg-stone-950 p-8 rounded-[3rem] text-white flex flex-col justify-between items-center text-center shadow-lg group border border-stone-800 dark:border-stone-900">
                <div className="relative w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 overflow-hidden">
                    <div className="absolute inset-0 bg-orange-500/10 blur-xl"></div>
                    <Flame size={28} className="text-orange-500 animate-bounce relative z-10" />
                </div>
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Серия чтения</h4>
                    <p className="text-5xl font-black mb-1 tracking-tighter">{user.streakDays || 0}</p>
                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Дней подряд</p>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 w-full flex justify-between items-center text-[10px] font-black uppercase opacity-30">
                    <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span className="opacity-100 text-orange-400">Пт</span><span>Сб</span><span>Вс</span>
                </div>
            </div>

            <div className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden relative group">
                 <div className="absolute top-0 right-0 p-4 text-stone-50 dark:text-stone-800/50 -rotate-12 group-hover:scale-125 transition-transform duration-1000">
                    <Target size={100} />
                 </div>
                 <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
                        <Trophy size={14} className="text-amber-500" /> Цель недели
                    </h4>
                    <p className="font-serif font-black text-stone-900 dark:text-stone-100 text-lg leading-tight mb-4">Прочитать 150 страниц</p>
                    <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-stone-900 dark:bg-white" style={{ width: '65%' }}></div>
                    </div>
                 </div>
            </div>
        </div>

        <div className="lg:col-span-6 bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-black text-stone-800 dark:text-stone-100 flex items-center gap-3">
                    <Zap className="text-rose-500" size={24} />
                    События
                </h3>
                <button onClick={() => onNavigate('feed')} className="p-2 bg-stone-50 dark:bg-stone-800 rounded-full hover:rotate-90 transition-transform">
                    <ArrowRight size={20} className="text-stone-400" />
                </button>
            </div>
            
            <div className="flex-1 space-y-4">
                {loadingFeed ? (
                  [1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2 w-24 skeleton rounded" />
                        <div className="h-2 w-full skeleton rounded" />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length > 0 ? (
                    recentActivity.map((act, i) => (
                        <div key={act.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors group" style={{ animationDelay: `${i * 100}ms` }}>
                            <img src={act.user.avatar} loading="lazy" className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-stone-700" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-black text-stone-800 dark:text-stone-100 truncate">{act.user.name}</p>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${act.type === 'note' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{act.type}</span>
                                </div>
                                <p className="text-[10px] text-stone-400 line-clamp-1 italic">{act.content || 'Начал новую книгу'}</p>
                            </div>
                            <span className="text-[9px] font-black text-stone-300 uppercase shrink-0">{act.timestamp}</span>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex items-center justify-center text-stone-300 dark:text-stone-700 italic text-sm">Здесь пока пусто...</div>
                )}
            </div>
        </div>

        <div className="lg:col-span-3 bg-stone-50 dark:bg-stone-850 p-8 rounded-[3rem] border border-stone-200 dark:border-stone-800 relative overflow-hidden flex flex-col justify-between group">
            <QuoteIcon size={80} className="absolute -top-4 -left-4 text-stone-200 dark:text-stone-800 opacity-30 transform -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
            
            <div className="relative z-10 pt-6">
                <div className="h-0.5 w-8 bg-amber-400 mb-6"></div>
                {dailyQuote && (
                    <>
                        <p className="font-serif text-lg text-stone-800 dark:text-stone-200 italic leading-relaxed mb-6">
                            «{dailyQuote.text}»
                        </p>
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">— {dailyQuote.source}</p>
                    </>
                )}
            </div>
            
            <button onClick={() => onNavigate('library')} className="relative z-10 mt-8 w-full py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                Все цитаты
            </button>
        </div>
      </div>
    </div>
  );
};
