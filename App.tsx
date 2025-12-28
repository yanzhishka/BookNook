
import React, { useState, useEffect, useCallback } from 'react';
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
import { User, Book, Quote } from './types';
import { db } from './services/db';
import { Loader2, BookOpen } from 'lucide-react';

const GUEST_USER: User = {
  id: 'guest',
  name: 'Гость',
  handle: '@guest',
  avatar: 'https://ui-avatars.com/api/?name=Guest&background=random',
  bio: 'Просмотр в режиме гостя.',
  booksReadThisYear: 0,
  joinedDate: new Date().toLocaleDateString(),
  streakDays: 0
};

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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

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
          setQuotes(session.quotes);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Session init failed", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isGuest && activeTab !== 'feed') {
      setActiveTab('feed');
    }
  }, [isGuest]);

  const handleLogin = useCallback((u: User, b: Book[], q: Quote[]) => {
    setUser(u); setBooks(b); setQuotes(q);
    setIsAuthenticated(true); setIsGuest(false);
  }, []);

  const handleGuestLogin = useCallback(() => {
    setUser(GUEST_USER); setBooks([]); setQuotes([]);
    setIsAuthenticated(true); setIsGuest(true);
    setActiveTab('feed'); 
  }, []);

  const handleLogout = useCallback(async () => {
    if (!isGuest) await db.logout();
    setIsAuthenticated(false); setUser(null); setIsGuest(false);
    setBooks([]); setQuotes([]); 
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
    <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="relative">
        <div className="w-16 h-16 bg-stone-900 dark:bg-stone-100 rounded-2xl flex items-center justify-center animate-bounce-slow shadow-2xl rotate-3">
          <BookOpen className="text-white dark:text-stone-900" size={32} />
        </div>
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
          <div className="w-1.5 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                case 'home': return <Dashboard user={user} books={books} quotes={quotes} onNavigate={handleTabChange} />;
                case 'feed': return <Feed user={user} books={books} onRequireLogin={() => setShowLoginPrompt(true)} />;
                case 'library': return <Library books={books} setBooks={setBooks} quotes={quotes} setQuotes={setQuotes} user={user} />;
                case 'oracle': return <Oracle books={books} user={user} />;
                case 'messages': return <Messages user={user} />;
                case 'profile': return <Profile user={user} onUpdateUser={setUser} books={books} />;
                default: return <Dashboard user={user} books={books} quotes={quotes} onNavigate={handleTabChange} />;
              }
            })()}
        </Layout>
        <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} onLogin={handleLogout} />
    </div>
  );
};

export default App;
