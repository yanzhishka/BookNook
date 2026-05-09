
import React from 'react';
import { BookOpen, Home, LayoutGrid, Sparkles, Users } from 'lucide-react';
import { User } from '../types';
import { Theme } from '../App';
import { classNames } from '../utils/classNames';
import { DesktopSidebar } from './layout/DesktopSidebar';
import { MobileNavigation } from './layout/MobileNavigation';
import { NavigationItem } from './layout/types';
import styles from './Layout.module.css';

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

const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'library', label: 'Библиотека', icon: BookOpen },
  { id: 'board', label: 'The Grid', icon: LayoutGrid },
  { id: 'oracle', label: 'Оракул', icon: Sparkles },
  { id: 'feed', label: 'Лента', icon: Users },
];

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  user,
  currentTheme,
  setTheme,
  isGuest,
  onLoginClick,
  zenMode,
  onLogout,
}) => {
  return (
    <div className={classNames(styles.layout, zenMode && styles.zenLayout)}>
      <DesktopSidebar
        activeTab={activeTab}
        currentTheme={currentTheme}
        isGuest={isGuest}
        navigationItems={NAVIGATION_ITEMS}
        user={user}
        zenMode={zenMode}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onTabChange={onTabChange}
        setTheme={setTheme}
      />

      <MobileNavigation
        activeTab={activeTab}
        navigationItems={NAVIGATION_ITEMS}
        user={user}
        zenMode={zenMode}
        onTabChange={onTabChange}
      />

      <main className={classNames(styles.main, zenMode && styles.mainZen)}>
        <div key={activeTab} className={styles.page}>
          {children}
        </div>
      </main>
    </div>
  );
};
