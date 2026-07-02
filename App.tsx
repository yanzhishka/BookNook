
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { CustomCursor } from './components/CustomCursor';
import { LoginPrompt } from './components/LoginPrompt';
import { User, Book } from './types';
import { db } from './services/db';
import { Loader2, ZapOff, Zap, WifiOff } from 'lucide-react';
import { Auth } from './components/Auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

// На нативной платформе (Android/iOS) управление тапами — кастомный курсор не нужен.
const isNativePlatform = Capacitor.isNativePlatform();

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Feed = lazy(() => import('./components/Feed').then(module => ({ default: module.Feed })));
const Library = lazy(() => import('./components/Library').then(module => ({ default: module.Library })));
const Oracle = lazy(() => import('./components/Oracle').then(module => ({ default: module.Oracle })));
const Profile = lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const Board = lazy(() => import('./components/Board').then(module => ({ default: module.Board })));

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
  const [zenMode, setZenMode] = useState(false);
  
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
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Индикатор отсутствия сети
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Android: системная кнопка «Назад» — на главную, с главной — свернуть приложение
  useEffect(() => {
    if (!isNativePlatform) return;
    const sub = CapacitorApp.addListener('backButton', () => {
      const currentTab = localStorage.getItem(TAB_STORAGE_KEY) || 'home';
      if (currentTab !== 'home') {
        setActiveTab('home');
        setViewingProfileId(null);
      } else {
        CapacitorApp.minimizeApp();
      }
    });
    return () => { sub.then(s => s.remove()); };
  }, []);

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
    if (isGuest && (tab !== 'feed' && tab !== 'board')) {
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

  const handleContinueReading = useCallback((bookId: string) => {
    setPendingBookId(bookId);
    setActiveTab('library');
  }, []);

  const awardXp = useCallback(async (amount: number) => {
    if (!user || isGuest) return;
    let newXp = (user.xp || 0) + amount;
    let newLevel = user.level || 1;
    const threshold = 1000;
    if (newXp >= threshold) {
        newLevel += Math.floor(newXp / threshold);
        newXp = newXp % threshold;
    }
    const updatedUser = { ...user, xp: newXp, level: newLevel };
    setUser(updatedUser);
    try {
      await db.addXp(user.id, amount);
    } catch (e) {
      console.error("Failed to persist XP update", e);
    }
  }, [user, isGuest]);

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fcfaf7] dark:bg-stone-950">
      <Loader2 className="animate-spin text-stone-900 dark:text-stone-100" size={40} />
    </div>
  );

  const offlineBanner = isOffline && (
    <div className="fixed top-0 inset-x-0 z-[2000] bg-stone-900 text-white text-center text-[11px] font-black uppercase tracking-widest py-2.5 flex items-center justify-center gap-2 shadow-2xl">
      <WifiOff size={14} className="text-amber-400" /> Нет подключения к интернету
    </div>
  );

  if (!isAuthenticated || !user) return (
    <div className={theme === 'dark' ? 'dark' : ''}>
       {!isNativePlatform && <CustomCursor />}
       {offlineBanner}
       <Auth onLogin={handleLogin} onGuestLogin={handleGuestLogin} />
    </div>
  );

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} ${zenMode ? 'zen-active' : ''}`}>
        {!isNativePlatform && <CustomCursor />}
        {offlineBanner}

        {/* Floating Zen Toggle - Displayed STRICTLY only on 'board' tab */}
        {activeTab === 'board' && (
          <button 
            onClick={() => setZenMode(!zenMode)}
            className={`
              fixed top-10 right-10 z-[300] p-4 rounded-2xl backdrop-blur-xl border border-stone-100 dark:border-stone-800 shadow-2xl transition-all duration-500
              ${zenMode 
                ? 'bg-amber-500 text-white border-amber-400 rotate-12 scale-110' 
                : 'bg-white/80 dark:bg-stone-900/80 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'}
            `}
            title={zenMode ? "Выйти из Дзен-режима" : "Активировать Дзен-режим"}
          >
            {zenMode ? <Zap size={20} /> : <ZapOff size={20} />}
          </button>
        )}

        <Layout 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            user={user} 
            currentTheme={theme}
            setTheme={setTheme}
            onLogout={handleLogout}
            isGuest={isGuest}
            onLoginClick={() => setShowLoginPrompt(true)}
            zenMode={zenMode}
        >
            <Suspense fallback={<PageLoader />}>
                {(() => {
                  switch (activeTab) {
                    case 'home': return <Dashboard user={user} books={books} onNavigate={handleTabChange} onContinueReading={handleContinueReading} />;
                    case 'feed': return <Feed user={user} books={books} onRequireLogin={() => setShowLoginPrompt(true)} onViewProfile={handleViewProfile} onUpdateUser={setUser} awardXp={awardXp} />;
                    case 'board': return <Board user={user} onRequireLogin={() => setShowLoginPrompt(true)} />;
                    case 'library': return <Library books={books} setBooks={setBooks} user={user} onUpdateUser={setUser} awardXp={awardXp} pendingBookId={pendingBookId} onConsumePendingBook={() => setPendingBookId(null)} />;
                    case 'oracle': return <Oracle books={books} />;
                    case 'profile': return <Profile user={user} onUpdateUser={setUser} books={books} viewingUserId={viewingProfileId || undefined} onNavigate={handleTabChange} />;
                    default: return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
                  }
                })()}
            </Suspense>
        </Layout>
        <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} onLogin={handleLogout} />
        
        <style>{`
          .zen-active main {
            background: #fcfaf7 !important;
          }
          .dark.zen-active main {
            background: #0c0a09 !important;
          }
          .zen-active .aurora-container {
            display: none;
          }
        `}</style>
    </div>
  );
};

export default App;
