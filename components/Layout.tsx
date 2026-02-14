
import React from 'react';
import { BookOpen, Users, Sun, Moon, Home, Sparkles, LayoutGrid, LogOut } from 'lucide-react';
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
  zenMode?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ 
    children, activeTab, onTabChange, user, currentTheme, setTheme, isGuest, onLoginClick, zenMode, onLogout
}) => {
  const navItems = [
    { id: 'home', label: 'Главная', icon: Home, restricted: true },
    { id: 'library', label: 'Библиотека', icon: BookOpen, restricted: true },
    { id: 'board', label: 'The Grid', icon: LayoutGrid, restricted: false },
    { id: 'oracle', label: 'Оракул', icon: Sparkles, restricted: true },
    { id: 'feed', label: 'Лента', icon: Users, restricted: false },
  ];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-transparent transition-all duration-1000 ${zenMode ? 'zen-layout' : ''}`}>
      {/* Desktop Sidebar */}
      <aside className={`
        hidden md:flex w-80 flex-col border-r border-stone-200/40 dark:border-stone-800/40 bg-white/30 dark:bg-stone-950/30 backdrop-blur-3xl h-screen sticky top-0 z-[100]
        transition-all duration-1000 ease-in-out
        ${zenMode ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}>
        <div className="p-12">
          <h1 className="text-4xl font-serif font-black tracking-tighter text-stone-900 dark:text-stone-50 cursor-pointer flex items-center gap-4 group" onClick={() => onTabChange('home')}>
            <div className="w-12 h-12 bg-stone-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-stone-950 text-2xl transform rotate-3 group-hover:rotate-0 transition-all duration-500 shadow-xl group-hover:shadow-amber-500/20">B</div>
            B.NOOK
          </h1>
        </div>
        
        <nav className="flex-1 px-8 space-y-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-6 px-7 py-5 rounded-[2.5rem] transition-all duration-500 relative group overflow-hidden ${isActive ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-2xl scale-[1.03]' : 'text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white/50 dark:hover:bg-white/5'}`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-black uppercase text-[11px] tracking-[0.25em]">{item.label}</span>
                {isActive && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-amber-500 rounded-r-full shadow-[0_0_15px_rgba(245,158,11,0.6)]" />}
              </button>
            );
          })}
        </nav>

        <div className="p-10 space-y-8">
          <div className="bg-stone-100/50 dark:bg-white/5 p-1.5 rounded-2xl flex border border-stone-200/50 dark:border-white/5">
            <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center py-3 rounded-xl transition-all ${currentTheme === 'light' ? 'bg-white shadow-xl text-stone-950 scale-105' : 'text-stone-400 hover:text-stone-600'}`}><Sun size={20}/></button>
            <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center py-3 rounded-xl transition-all ${currentTheme === 'dark' ? 'bg-stone-800 shadow-xl text-white scale-105' : 'text-stone-400 hover:text-stone-200'}`}><Moon size={20}/></button>
          </div>
          
          <div className="h-px bg-stone-200/30 dark:bg-stone-800/30" />

          {isGuest ? (
            <button onClick={onLoginClick} className="w-full bg-stone-900 dark:bg-white text-white dark:text-stone-900 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">Войти</button>
          ) : (
            <div className="flex items-center gap-3">
              <div onClick={() => onTabChange('profile')} className={`flex-1 flex items-center gap-5 cursor-pointer p-5 rounded-[2.5rem] transition-all ${activeTab === 'profile' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-2xl scale-[1.02]' : 'hover:bg-stone-100 dark:hover:bg-white/5'}`}>
                <img src={user.avatar} className="w-14 h-14 rounded-[1.5rem] object-cover ring-2 ring-white/10 shadow-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black truncate leading-none mb-2">{user.name}</p>
                  <p className="text-[10px] opacity-50 font-black tracking-widest uppercase">Уровень {user.level}</p>
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="p-5 rounded-[1.5rem] bg-stone-100 dark:bg-white/5 text-stone-400 hover:text-red-500 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:rotate-12"
                title="Выйти"
              >
                <LogOut size={22} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className={`
        md:hidden fixed bottom-0 left-0 right-0 z-[200] px-6 pb-8 pt-4 bg-gradient-to-t from-stone-50/95 dark:from-stone-950/95 via-stone-50/70 dark:via-stone-950/70 to-transparent pointer-events-none
        transition-all duration-700 ease-in-out
        ${zenMode ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}
      `}>
        <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-2xl border border-stone-200/50 dark:border-stone-800 rounded-[3rem] p-3 flex justify-around items-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] pointer-events-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`p-5 rounded-full transition-all duration-500 ${isActive ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 scale-125 shadow-xl -translate-y-1' : 'text-stone-400 hover:scale-110'}`}
              >
                <Icon size={24} />
              </button>
            );
          })}
          <button
            onClick={() => onTabChange('profile')}
            className={`p-1.5 rounded-full transition-all duration-500 border-2 ${activeTab === 'profile' ? 'border-amber-500 scale-125 shadow-xl -translate-y-1' : 'border-transparent'}`}
          >
            <img src={user.avatar} className="w-10 h-10 rounded-full object-cover shadow-inner" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`
        flex-1 overflow-y-auto custom-scrollbar p-6 md:p-16 pb-36 md:pb-16 relative
        transition-all duration-1000
        ${zenMode ? 'md:ml-0 md:p-24 lg:p-40' : ''}
      `}>
        <div key={activeTab} className="reveal min-h-full max-w-[1500px] mx-auto">{children}</div>
      </main>
    </div>
  );
};
