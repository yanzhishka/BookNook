
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { CustomCursor } from './components/CustomCursor';
import { LoginPrompt } from './components/LoginPrompt';
import { User, Book } from './types';
import { db } from './services/db';
import { Loader2 } from 'lucide-react';
import { Auth } from './components/Auth';

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Feed = lazy(() => import('./components/Feed').then(module => ({ default: module.Feed })));
const Library = lazy(() => import('./components/Library').then(module => ({ default: module.Library })));
const Oracle = lazy(() => import('./components/Oracle').then(module => ({ default: module.Oracle })));
const Profile = lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));

const GUEST_USER: User = {
  id: 'guest',
  name: 'Гость',
  handle: '@guest',
  avatar: 'https://ui-avatars.com/api/?name=G&background=b45309&color=fff',
  bio: 'Любитель книг и тихих вечеров.',
  booksReadThisYear: 0,
  joinedDate: new Date().toLocaleDateString(),
  streakDays: 0,
  xp: 0,
  level: 1
};

const TAB_STORAGE_KEY = 'bnook_active_tab';
const THEME_STORAGE_KEY = 'bnook_theme';

export type Theme = 'light' | 'dark';

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in">
    <Loader2 className="animate-spin text-stone-300 dark:text-stone-700 mb-4" size={32} />
    <p className="text-stone-400 text-xs font-black uppercase tracking-widest">Листаем страницы...</p>
  </div>
);

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(TAB_STORAGE_KEY) || 'home';
  });
  
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
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
        setIsLoading(false);
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
    setViewingProfileId(null);
    localStorage.removeItem(TAB_STORAGE_KEY);
  }, [isGuest]);

  const handleTabChange = useCallback((tab: string) => {
    if (isGuest && tab !== 'feed') {
      setShowLoginPrompt(true);
    } else {
      setActiveTab(tab);
      if (tab !== 'profile') setViewingProfileId(null);
    }
  }, [isGuest]);

  const handleViewProfile = useCallback((userId: string) => {
    setViewingProfileId(userId);
    setActiveTab('profile');
  }, []);

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fcfaf7] dark:bg-stone-950">
      <Loader2 className="animate-spin text-stone-900 dark:text-stone-100" size={40} />
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
            <Suspense fallback={<PageLoader />}>
                {(() => {
                  switch (activeTab) {
                    case 'home': return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
                    case 'feed': return <Feed user={user} books={books} onRequireLogin={() => setShowLoginPrompt(true)} onViewProfile={handleViewProfile} />;
                    case 'library': return <Library books={books} setBooks={setBooks} user={user} />;
                    case 'oracle': return <Oracle books={books} />;
                    case 'profile': return <Profile user={user} onUpdateUser={setUser} books={books} viewingUserId={viewingProfileId || undefined} onNavigate={handleTabChange} />;
                    default: return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
                  }
                })()}
            </Suspense>
        </Layout>
        <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} onLogin={handleLogout} />
    </div>
  );
};

export default App;
