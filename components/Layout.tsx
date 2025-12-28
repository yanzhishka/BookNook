
import React from 'react';
import { BookOpen, Users, Sun, Moon, LogOut, Lock, Home, Mail, Sparkles } from 'lucide-react';
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
    { id: 'messages', label: 'Сообщения', icon: Mail, restricted: true },
  ];

  const NavButton = ({ item, isMobile = false }: { item: typeof navItems[0], isMobile?: boolean }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const isLocked = isGuest && item.restricted;

    if (isMobile) return (
      <button
        onClick={() => onTabChange(item.id)}
        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${isActive ? 'text-stone-800 dark:text-stone-100 scale-110' : 'text-stone-400'}`}
      >
        <div className="relative">
          <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
          {isLocked && <Lock size={10} className="absolute -top-1 -right-1 text-stone-400 bg-white dark:bg-stone-900 rounded-full" />}
        </div>
        <span className="text-[10px] font-medium">{item.label}</span>
      </button>
    );

    return (
      <button
        onClick={() => onTabChange(item.id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative ${
          isActive ? 'bg-stone-800 dark:bg-stone-700 text-white shadow-lg scale-[1.02]' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <Icon size={20} className="group-hover:scale-110 transition-transform" />
        <span className="font-medium">{item.label}</span>
        {isLocked && <Lock size={14} className="absolute right-4 text-stone-400 opacity-70" />}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-stone-50 dark:bg-stone-950 transition-colors duration-300">
      <aside className="hidden md:flex w-64 flex-col border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 h-screen sticky top-0 z-30">
        <div className="p-6 border-b border-stone-100 dark:border-stone-800">
          <h1 className="text-2xl font-serif font-black tracking-tighter text-stone-800 dark:text-stone-100 cursor-pointer" onClick={() => onTabChange('home')}>
            B.NOOK
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map(item => <NavButton key={item.id} item={item} />)}
        </nav>

        <div className="p-4 space-y-4">
             <div className="bg-stone-100 dark:bg-black/30 p-1 rounded-xl flex relative">
                <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${currentTheme === 'light' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-400'}`}><Sun size={18}/></button>
                <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center py-2 rounded-lg transition-all ${currentTheme === 'dark' ? 'bg-stone-700 shadow-sm text-white' : 'text-stone-400'}`}><Moon size={18}/></button>
             </div>
             
             <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors">
                <LogOut size={18} />
                <span>{isGuest ? 'Выйти' : 'Выход'}</span>
              </button>
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800">
          {isGuest ? (
              <button onClick={onLoginClick} className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-3 rounded-xl font-bold text-sm shadow-lg">Войти</button>
          ) : (
              <div onClick={() => onTabChange('profile')} className={`flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-all ${activeTab === 'profile' ? 'bg-stone-100 dark:bg-stone-800' : ''}`}>
                <img src={user.avatar} className="w-10 h-10 rounded-full border border-stone-200 dark:border-stone-700 object-cover" />
                <div className="text-xs overflow-hidden">
                  <p className="font-bold text-stone-800 dark:text-stone-200 truncate w-32">{user.name}</p>
                  <p className="text-stone-500">Профиль</p>
                </div>
              </div>
          )}
        </div>
      </aside>

      <header className="md:hidden h-14 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between px-4 sticky top-0 z-30">
        <h1 className="font-serif font-black text-stone-800 dark:text-stone-100" onClick={() => onTabChange('home')}>B.NOOK</h1>
        <div className="flex items-center gap-2">
            <button onClick={() => setTheme(currentTheme === 'light' ? 'dark' : 'light')} className="p-2 text-stone-500">{currentTheme === 'light' ? <Sun size={20}/> : <Moon size={20}/>}</button>
            <div onClick={() => onTabChange('profile')}><img src={user.avatar} className="w-8 h-8 rounded-full object-cover" /></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full custom-scrollbar">
        <div key={activeTab} className="animate-fade-in-up h-full">{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 flex justify-around p-2 z-40 pb-safe shadow-lg">
        {navItems.map(item => <NavButton key={item.id} item={item} isMobile />)}
      </nav>
    </div>
  );
};
