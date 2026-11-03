
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { CustomCursor } from './components/CustomCursor';
import { LoginPrompt } from './components/LoginPrompt';
import { ErrorNotice } from './components/ErrorNotice';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { User, BookSummary } from './types';
import { db } from './services/db';
import type { TopicIdentity } from './services/community';
import { establishSessionFromAuthUrl, MOBILE_AUTH_CALLBACK } from './services/supabase';
import { Loader2, WifiOff } from 'lucide-react';
import { Auth } from './components/Auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { initialDestination, type Product } from './services/ecosystem';

// На нативной платформе (Android/iOS) управление тапами — кастомный курсор не нужен.
const isNativePlatform = Capacitor.isNativePlatform();
const accountDeletionRequested = new URLSearchParams(window.location.search)
  .get('accountDeletion') === '1';

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Library = lazy(() => import('./components/Library').then(module => ({ default: module.Library })));
const Profile = lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const Board = lazy(() => import('./components/Board').then(module => ({ default: module.Board })));
const WatchPage = lazy(() => import('./components/watch/WatchPage').then(module => ({ default: module.WatchPage })));

const GUEST_USER: User = {
  id: 'guest',
  name: 'Гость',
  role: 'user',
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
const PRODUCT_STORAGE_KEY = 'bnook_active_product';
const readDestination = () => initialDestination(window.location.search, localStorage.getItem(PRODUCT_STORAGE_KEY), localStorage.getItem(TAB_STORAGE_KEY));
const writeDestination = (product: Product, roomId: string | null, push = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set('app', product);
  if (roomId) url.searchParams.set('room', roomId); else url.searchParams.delete('room');
  if (push) window.history.pushState(null, '', url); else window.history.replaceState(null, '', url);
};

export type Theme = 'light' | 'dark';

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-fade-in">
    <Loader2 className="animate-spin text-stone-300 dark:text-stone-700 mb-4" size={32} />
    <p className="text-stone-400 text-xs font-black uppercase tracking-widest">Открываем…</p>
  </div>
);

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  
  const [product, setProduct] = useState<Product>(() => readDestination().product);
  const [roomId, setRoomId] = useState<string | null>(() => readDestination().roomId);
  const [activeTab, setActiveTab] = useState(() => readDestination().tab);
  
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [pendingBookId, setPendingBookId] = useState<string | null>(null);
  const [pendingTopic,setPendingTopic]=useState<TopicIdentity|null>(null);
  const consumePendingTopic=useCallback(()=>setPendingTopic(null),[]);
  const openCommunityTopic=useCallback((topic:TopicIdentity)=>{setPendingTopic({source:topic.source,id:topic.id});setProduct('books');setRoomId(null);writeDestination('books',null);setActiveTab('board');},[]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

  const handleUserUpdate = useCallback((updatedUser: User) => {
    setUser(current => current?.id === updatedUser.id ? updatedUser : current);
  }, []);

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
      const destination = readDestination();
      const home = destination.product === 'watch' ? 'watch-home' : 'home';
      if (currentTab !== home || destination.roomId) {
        setActiveTab(home);
        setRoomId(null);
        writeDestination(destination.product, null);
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
    localStorage.setItem(PRODUCT_STORAGE_KEY, product);
    document.title = product === 'watch' ? 'W.Nook — смотрим вместе' : 'B.Nook — читай, отмечай, делись';
  }, [product]);
  useEffect(() => {
    const restore = () => { const next = readDestination(); setProduct(next.product); setRoomId(next.roomId); setActiveTab(next.tab); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const handleProductChange = useCallback((next: Product) => {
    setProduct(next); setRoomId(null); setViewingProfileId(null);
    if (next === 'watch' && !isAuthenticated) {
      setUser(GUEST_USER); setBooks([]); setIsAuthenticated(true); setIsGuest(true);
    }
    setActiveTab(next === 'watch' ? 'watch-home' : isGuest ? 'board' : 'home');
    writeDestination(next, null);
  }, [isAuthenticated, isGuest]);
  const handleWatchRoom = useCallback((id: string | null) => {
    setProduct('watch'); setRoomId(id); setActiveTab('watch-home'); setViewingProfileId(null);
    writeDestination('watch', id, true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyCurrentSession = async () => {
      const session = await db.getSession();
      if (cancelled) return;
      if (!session) {
        if (readDestination().product === 'watch' && !accountDeletionRequested) {
          setUser(GUEST_USER); setBooks([]); setIsAuthenticated(true); setIsGuest(true);
        }
        return;
      }

      setUser(session.user);
      setBooks(session.books);
      setIsAuthenticated(true);
      setIsGuest(false);
      if (accountDeletionRequested) setActiveTab('profile');
    };

    const handleAuthUrl = async (url: string) => {
      if (!url.startsWith(MOBILE_AUTH_CALLBACK)) return;

      setIsLoading(true);
      setAuthLinkError(null);
      try {
        await establishSessionFromAuthUrl(url);
        await applyCurrentSession();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Не удалось подтвердить адрес';
          setAuthLinkError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const urlListener = isNativePlatform
      ? CapacitorApp.addListener('appUrlOpen', ({ url }) => { void handleAuthUrl(url); })
      : null;

    (async () => {
      try {
        if (isNativePlatform) {
          const launch = await CapacitorApp.getLaunchUrl();
          if (launch?.url) await handleAuthUrl(launch.url);
        }
        await applyCurrentSession();
      } catch (error) {
        console.error('Session init failed', error);
        if (!cancelled) {
          setAuthLinkError('Не удалось загрузить аккаунт. Проверьте соединение и попробуйте войти снова.');
          if (readDestination().product === 'watch' && !accountDeletionRequested) {
            setUser(GUEST_USER); setBooks([]); setIsAuthenticated(true); setIsGuest(true);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      void urlListener?.then(listener => listener.remove());
    };
  }, []);

  const handleLogin = useCallback((u: User, b: BookSummary[]) => {
    setUser(u); setBooks(b);
    setIsAuthenticated(true); setIsGuest(false);
    if (accountDeletionRequested) setActiveTab('profile');
  }, []);

  const handleGuestLogin = useCallback(() => {
    setUser(GUEST_USER); setBooks([]);
    setIsAuthenticated(true); setIsGuest(true);
    setActiveTab(product === 'watch' ? 'watch-home' : 'board');
  }, [product]);

  const handleLogout = useCallback(async () => {
    setShowLoginPrompt(false);
    setAppError(null);
    try {
      if (!isGuest) await db.logout();
    } catch {
      setAppError('Не удалось выйти из аккаунта. Проверьте соединение и попробуйте снова.');
      return;
    }
    const watchGuest = product === 'watch';
    setIsAuthenticated(watchGuest); setUser(watchGuest ? GUEST_USER : null); setIsGuest(watchGuest);
    setBooks([]); 
    setActiveTab(product === 'watch' ? 'watch-home' : 'home');
    setViewingProfileId(null);
    setPendingTopic(null);
    localStorage.removeItem(TAB_STORAGE_KEY);
  }, [isGuest, product]);

  const handleOpenLogin = useCallback(() => {
    setShowLoginPrompt(false); setIsAuthenticated(false); setIsGuest(false);
    setUser(null); setBooks([]); setAppError(null);
  }, []);

  const handleAccountDeleted = useCallback(() => {
    const watchGuest = product === 'watch';
    setIsAuthenticated(watchGuest);
    setUser(watchGuest ? GUEST_USER : null);
    setIsGuest(watchGuest);
    setBooks([]);
    setActiveTab(product === 'watch' ? 'watch-home' : 'home');
    setRoomId(null); writeDestination(product, null);
    setViewingProfileId(null);
    setPendingTopic(null);
    localStorage.removeItem(TAB_STORAGE_KEY);
  }, [product]);

  const handleTabChange = useCallback((tab: string) => {
    const target=tab==='feed'?'board':tab;
    if (isGuest && target !== 'board' && !target.startsWith('watch-')) {
      setShowLoginPrompt(true);
    } else {
      setActiveTab(target);
      setViewingProfileId(null);
      setRoomId(null);
      const next = target.startsWith('watch-') ? 'watch' : target === 'profile' ? product : 'books';
      setProduct(next); writeDestination(next, null);
    }
  }, [isGuest, product]);

  const handleViewProfile = useCallback((userId: string) => {
    setProduct('books'); setRoomId(null); writeDestination('books', null);
    setViewingProfileId(userId);
    setActiveTab('profile');
  }, []);

  const handleContinueReading = useCallback((bookId: string) => {
    setProduct('books'); setRoomId(null); writeDestination('books', null);
    setPendingBookId(bookId);
    setActiveTab('library');
  }, []);

  const authenticatedUserId = user?.id;
  const refreshUserStats = useCallback(() => {
    if (!authenticatedUserId || isGuest) return;
    void db.getPublicProfile(authenticatedUserId).then(profile => {
      setUser(current => current?.id === profile.id ? { ...current, ...profile, email: current.email } : current);
    }).catch(error => console.error('Failed to refresh reading stats', error));
  }, [authenticatedUserId, isGuest]);

  if (isLoading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fcfaf7] dark:bg-stone-950">
      <Loader2 className="animate-spin text-stone-900 dark:text-stone-100" size={40} />
    </div>
  );

  const offlineBanner = isOffline && (
    <div className="offline-banner fixed top-0 inset-x-0 z-[2000] bg-stone-900 text-white text-center text-[11px] font-black uppercase tracking-widest py-2.5 flex items-center justify-center gap-2 shadow-2xl">
      <WifiOff size={14} className="text-amber-400" /> Нет подключения к интернету
    </div>
  );

  if (!isAuthenticated || !user) return (
    <div className={theme === 'dark' ? 'dark' : ''}>
       {!isNativePlatform && !(product === 'watch' && roomId) && <CustomCursor />}
       {offlineBanner}
       <Auth onLogin={handleLogin} onGuestLogin={handleGuestLogin} initialError={authLinkError} product={product} onProductChange={handleProductChange} />
    </div>
  );

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
        {!isNativePlatform && !(product === 'watch' && roomId) && <CustomCursor />}
        {offlineBanner}

        <Layout 
            product={product}
            onProductChange={handleProductChange}
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            user={user} 
            currentTheme={theme}
            setTheme={setTheme}
            onLogout={handleLogout}
            isGuest={isGuest}
            onLoginClick={product === 'watch' ? handleOpenLogin : () => setShowLoginPrompt(true)}
        >
            <AppErrorBoundary resetKey={`${product}:${activeTab}:${roomId || ''}:${viewingProfileId || ''}`} onBack={isGuest ? undefined : () => handleTabChange(product === 'watch' ? 'watch-home' : 'home')}>
            <Suspense fallback={<PageLoader />}>
                {appError && <ErrorNotice message={appError} />}
                {(() => {
                  switch (activeTab) {
                    case 'watch-home':
                    case 'watch-rooms': return <WatchPage user={user} roomId={roomId} view={activeTab === 'watch-rooms' ? 'rooms' : 'home'} onRoomChange={handleWatchRoom} />;
                    case 'home': return <Dashboard user={user} books={books} onNavigate={handleTabChange} onContinueReading={handleContinueReading} onOpenTopic={openCommunityTopic} />;
                    case 'board': return <Board user={user} books={books} onRequireLogin={() => setShowLoginPrompt(true)} onUpdateUser={handleUserUpdate} onActivitySaved={refreshUserStats} onViewProfile={handleViewProfile} pendingTopic={pendingTopic} onConsumePendingTopic={consumePendingTopic} />;
                    case 'library': return <Library books={books} setBooks={setBooks} user={user} onUpdateUser={handleUserUpdate} pendingBookId={pendingBookId} onConsumePendingBook={() => setPendingBookId(null)} />;
                    case 'profile': return <Profile user={user} onUpdateUser={handleUserUpdate} books={books} viewingUserId={viewingProfileId || undefined} onNavigate={handleTabChange} onAccountDeleted={handleAccountDeleted} />;
                    default: return <Dashboard user={user} books={books} onNavigate={handleTabChange} />;
                  }
                })()}
            </Suspense>
            </AppErrorBoundary>
        </Layout>
        <LoginPrompt isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} onLogin={handleOpenLogin} />
        
    </div>
  );
};

export default App;
