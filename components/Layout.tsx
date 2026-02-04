
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
    { id: 'library', label: 'Библиотека', icon: BookOpen, restricted: true },
    { id: 'oracle', label: 'Оракул', icon: Sparkles, restricted: true },
    { id: 'feed', label: 'Сообщество', icon: Users, restricted: false },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent">
      <aside className="hidden md:flex w-80 flex-col border-r border-stone-200/50 dark:border-stone-800/50 bg-white/40 dark:bg-stone-950/40 backdrop-blur-2xl h-screen sticky top-0 z-[100]">
        <div className="p-10">
          <h1 className="text-3xl font-serif font-black tracking-tighter text-stone-900 dark:text-stone-50 cursor-pointer flex items-center gap-3 group" onClick={() => onTabChange('home')}>
            <div className="w-10 h-10 bg-stone-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-stone-950 text-xl transform rotate-3 group-hover:rotate-0 transition-transform">B</div>
            B.NOOK
          </h1>
        </div>
        
        <nav className="flex-1 px-6 space-y-3">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-5 px-6 py-4 rounded-[2rem] transition-all duration-500 relative group ${isActive ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-2xl scale-[1.02]' : 'text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-white/5'}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-black uppercase text-[10px] tracking-[0.2em]">{item.label}</span>
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-500 rounded-r-full" />}
              </button>
            );
          })}
        </nav>

        <div className="p-8 space-y-6">
          <div className="bg-stone-100 dark:bg-white/5 p-1 rounded-2xl flex border border-stone-200 dark:border-white/5">
            <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center py-2.5 rounded-xl transition-all ${currentTheme === 'light' ? 'bg-white shadow-lg text-stone-950' : 'text-stone-400'}`}><Sun size={18}/></button>
            <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center py-2.5 rounded-xl transition-all ${currentTheme === 'dark' ? 'bg-stone-800 shadow-lg text-white' : 'text-stone-400'}`}><Moon size={18}/></button>
          </div>
          
          <div className="h-px bg-stone-100 dark:bg-stone-800" />

          {isGuest ? (
            <button onClick={onLoginClick} className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Войти</button>
          ) : (
            <div onClick={() => onTabChange('profile')} className={`flex items-center gap-4 cursor-pointer p-4 rounded-3xl transition-all ${activeTab === 'profile' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-xl' : 'hover:bg-stone-100 dark:hover:bg-white/5'}`}>
              <img src={user.avatar} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/10" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate leading-none mb-1">{user.name}</p>
                <p className="text-[10px] opacity-40 font-bold tracking-widest uppercase">{user.level} Уровень</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 relative">
        <div key={activeTab} className="animate-reveal min-h-full">{children}</div>
      </main>
    </div>
  );
};
