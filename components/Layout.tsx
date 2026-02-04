
import React from 'react';
import { BookOpen, Users, Sun, Moon, LogOut, Lock, Home, Sparkles } from 'lucide-react';
import { User } from '../types';
import { Theme } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: User;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  onLogout: () => void;
  isGuest?: boolean;
  onLoginClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
    children, activeTab, onTabChange, user, currentTheme, setTheme, onLogout, isGuest, onLoginClick
}) => {
  const navItems = [
    { id: 'home', label: 'Главная', icon: Home, restricted: true },
    { id: 'library', label: 'Мой дневник', icon: BookOpen, restricted: true },
    { id: 'oracle', label: 'Оракул', icon: Sparkles, restricted: true },
    { id: 'feed', label: 'Сообщество', icon: Users, restricted: false },
  ];

  const NavButton: React.FC<{ item: typeof navItems[0], isMobile?: boolean }> = ({ item, isMobile = false }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const isLocked = isGuest && item.restricted;

    if (isMobile) return (
      <button
        onClick={() => onTabChange(item.id)}
        className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-stone-900 dark:text-stone-50 scale-110' : 'text-stone-400'}`}
      >
        <div className="relative">
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
          {isLocked && <Lock size={10} className="absolute -top-1 -right-1 text-stone-400 bg-white dark:bg-stone-900 rounded-full" />}
        </div>
        <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
      </button>
    );

    return (
      <button
        onClick={() => onTabChange(item.id)}
        className={`w-full flex items-center gap-4 px-6 py-3.5 rounded-[1.5rem] transition-all duration-500 group relative ${
          isActive 
            ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_40px_-10px_rgba(255,255,255,0.1)] scale-[1.05] z-10' 
            : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5'
        }`}
      >
        <Icon size={20} className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
        <span className="font-bold tracking-tight text-sm">{item.label}</span>
        {isLocked && <Lock size={14} className="absolute right-6 opacity-30" />}
        {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-500 rounded-r-full"></div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent transition-colors duration-500">
      <aside className="hidden md:flex w-72 flex-col border-r border-stone-200/50 dark:border-stone-800/50 bg-white/40 dark:bg-stone-950/40 backdrop-blur-xl h-screen sticky top-0 z-30">
        <div className="p-8">
          <h1 className="text-2xl font-serif font-black tracking-tighter text-stone-900 dark:text-stone-50 cursor-pointer flex items-center gap-2 group" onClick={() => onTabChange('home')}>
            <div className="w-8 h-8 bg-stone-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-stone-950 text-base transform rotate-3 group-hover:rotate-0 transition-transform">B</div>
            B.NOOK
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => <NavButton key={item.id} item={item} />)}
        </nav>

        <div className="p-6 space-y-4">
             <div className="bg-stone-100 dark:bg-white/5 p-1 rounded-2xl flex relative border border-stone-200/50 dark:border-white/5">
                <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center py-2 rounded-xl transition-all ${currentTheme === 'light' ? 'bg-white shadow-md text-stone-950' : 'text-stone-400'}`}><Sun size={18}/></button>
                <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center py-2 rounded-xl transition-all ${currentTheme === 'dark' ? 'bg-stone-800 shadow-md text-white' : 'text-stone-400'}`}><Moon size={18}/></button>
             </div>
             
             <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all">
                <LogOut size={18} />
                <span>Выход</span>
              </button>
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800/50">
          {isGuest ? (
              <button onClick={onLoginClick} className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Войти</button>
          ) : (
              <div onClick={() => onTabChange('profile')} className={`flex items-center gap-3 cursor-pointer p-3 rounded-2xl transition-all ${activeTab === 'profile' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-lg' : 'hover:bg-stone-100 dark:hover:bg-white/5'}`}>
                <img src={user.avatar} className="w-10 h-10 rounded-xl border-2 border-white/20 object-cover shadow-md" />
                <div className="text-[10px] overflow-hidden flex-1">
                  <p className="font-black truncate">{user.name}</p>
                  <p className="opacity-50">Мой профиль</p>
                </div>
              </div>
          )}
        </div>
      </aside>

      <header className="md:hidden h-16 glass flex items-center justify-between px-6 sticky top-0 z-40">
        <h1 className="text-xl font-serif font-black text-stone-900 dark:text-stone-50" onClick={() => onTabChange('home')}>B.NOOK</h1>
        <div className="flex items-center gap-4">
            <button onClick={() => setTheme(currentTheme === 'light' ? 'dark' : 'light')} className="p-2 text-stone-500">{currentTheme === 'light' ? <Sun size={20}/> : <Moon size={20}/>}</button>
            <div onClick={() => onTabChange('profile')} className="ring-2 ring-amber-500/20 p-0.5 rounded-full"><img src={user.avatar} className="w-8 h-8 rounded-full object-cover shadow-md" /></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-10 max-w-7xl mx-auto w-full relative">
        <div key={activeTab} className="animate-reveal h-full">{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-4 left-4 right-4 h-16 glass rounded-full flex justify-around items-center z-50 shadow-[0_20px_50px_rgba(0,0,0,0.3)] px-2">
        {navItems.map(item => <NavButton key={item.id} item={item} isMobile />)}
      </nav>
    </div>
  );
};
