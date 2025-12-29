
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from './components/Layout';
import { Feed } from './components/Feed';
import { Library } from './components/Library';
import { Oracle } from './components/Oracle';
import { Profile } from './components/Profile';
import { Dashboard } from './components/Dashboard';
import { Messages } from './components/Messages';
import { Auth } from './components/Auth';
import { CustomCursor } from './components/CustomCursor';
import { LoginPrompt } from './components/LoginPrompt';
import { User, Book } from './types';
import { db } from './services/db';
import { Loader2 } from 'lucide-react';

const GUEST_USER: User = {
  id: 'guest',
  name: 'Гость',
  handle: '@guest',
  avatar: 'https://ui-avatars.com/api/?name=G&background=b45309&color=fff',
  bio: 'Любитель книг и тихих вечеров.',
  booksReadThisYear: 0,
  joinedDate: new Date().toLocaleDateString(),
  streakDays: 0
};

const LITERARY_QUOTES = [
  "«Свобода — это возможность сказать, что дважды два — четыре»",
  "«Мир — это книга, и те, кто не путешествует, читают лишь одну страницу»",
  "«Книги — это зеркала: в них видишь только то, что уже есть у тебя в душе»",
  "«Я всегда воображал, что Рай будет своего рода библиотекой»",
  "«Человек, который не читает книг, не имеет преимуществ перед тем, кто не умеет читать»",
  "«Если ты не знаешь, куда идешь, любая дорога приведет тебя туда»",
  "«Судьба — это не результат обстоятельств, а результат выбора»",
  "«Все великие книги похожи тем, что они правдивее, чем сама жизнь»",
  "«Мы читаем, чтобы знать, что мы не одиноки»",
  "«Книга — это устройство, способное разжечь воображение»"
];

const STORAGE_KEY = 'bnook_active_tab';

export type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'home';
  });
  
  const [theme, setTheme] = useState<Theme>('dark');
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const loadingQuote = useMemo(() => {
    return LITERARY_QUOTES[Math.floor(Math.random() * LITERARY_QUOTES.length)];
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    (async () => {
      try {
        const session = await db.getSession();
        if (session) {
          setUser(session.user);
          setBooks(session.books);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Session init failed", e);
      } finally {
        setTimeout(() => setIsLoading(false), 2000);
      }
    })();
  }, []);

  const handleLogin = useCallback((u: User, b: Book[]) => {
    setUser(u); setBooks(b);
    setIsAuthenticated(true); setIsGuest(false);
  }, []);

  const handleGuestLogin = useCallback(() => {
    setUser(GUEST_USER); setBooks([]);
    setIsAuthenticated(true); setIsGuest(true);
    setActiveTab('feed'); 
  }, []);

  const handleLogout = useCallback(async () => {
    if (!isGuest) await db.logout();
    setIsAuthenticated(false); setUser(null); setIsGuest(false);
    setBooks([]); 
    setActiveTab('home');
    localStorage.removeItem(STORAGE_KEY);
  }, [isGuest]);

  const handleTabChange = useCallback((tab: string) => {
    if (isGuest && tab !== 'feed') {
      setShowLoginPrompt(true);
    } else {
      setActiveTab(tab);
    }
  }, [isGuest]);

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-100 p-10 overflow-hidden">
      <div className="max-w-lg text-center animate-fade-in-up">
        <div className="mb-8 flex justify-center">
            <Loader2 className="animate-spin text-stone-900 dark:text-stone-100" size={40} />
        </div>
        <p className="text-xl md:text-2xl font-serif italic leading-relaxed text-stone-600 dark:text-stone-300">
           {loadingQuote}
        </p>
        <div className="mt-12 h-1 w-24 bg-stone-200 dark:bg-stone-800 mx-auto rounded-full overflow-hidden">
           <div className="h-full bg-stone-900 dark:bg-stone-100 animate-[shimmer_2s_infinite_linear]" style={{ width: '40%' }}></div>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated || !user) return (
    <div className={theme === 'dark' ? 'dark' : ''}>
       <CustomCursor />
       <Auth onLogin={handleLogin} onGuestLogin={handleGuestLogin} />
    </div>
  );

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
        <CustomCursor />
        <Layout 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            user={user} 
            currentTheme={theme}
            setTheme={setTheme}
            onLogout={handleLogout}
            isGuest={isGuest}
            onLoginClick={() => setShowLoginPrompt(true)}
        >
            {(() => {
              switch (activeTab) {
                case 'home': return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
                case 'feed': return <Feed user={user} books={books} onRequireLogin={() => setShowLoginPrompt(true)} />;
                case 'library': return <Library books={books} setBooks={setBooks} user={user} />;
                case 'oracle': return <Oracle books={books} />;
                case 'messages': return <Messages user={user} />;
                case 'profile': return <Profile user={user} onUpdateUser={setUser} books={books} />;
                default: return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
              }
            })()}
        </Layout>
        <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} onLogin={handleLogout} />
    </div>
  );
};

export default App;
