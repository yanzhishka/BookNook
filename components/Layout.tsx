
import React from 'react';
import { BookOpen, Home, LayoutGrid, Play, DoorOpen } from 'lucide-react';
import { User } from '../types';
import { Theme } from '../App';
import { DesktopSidebar } from './layout/DesktopSidebar';
import { MobileNavigation } from './layout/MobileNavigation';
import { NavigationItem } from './layout/types';
import styles from './Layout.module.css';
import type { Product } from '../services/ecosystem';
import { ProductSwitcher } from './layout/ProductSwitcher';

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
  product: Product;
  onProductChange: (product: Product) => void;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'library', label: 'Библиотека', icon: BookOpen },
  { id: 'board', label: 'The Grid', icon: LayoutGrid },
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
  onLogout,
  product,
  onProductChange,
}) => {
  const items = product === 'watch' ? [
    { id: 'watch-home', label: 'Просмотр', icon: Play },
    { id: 'watch-rooms', label: 'Комнаты', icon: DoorOpen },
  ] : NAVIGATION_ITEMS;
  return (
    <div className={styles.layout}>
      <header className={styles.mobileHeader}><ProductSwitcher product={product} onChange={onProductChange} /></header>
      <DesktopSidebar
        activeTab={activeTab}
        currentTheme={currentTheme}
        isGuest={isGuest}
        navigationItems={items}
        product={product}
        onProductChange={onProductChange}
        user={user}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onTabChange={onTabChange}
        setTheme={setTheme}
      />

      <MobileNavigation
        activeTab={activeTab}
        navigationItems={items}
        user={user}
        onTabChange={onTabChange}
      />

      <main className={styles.main}>
        <div key={`${product}:${activeTab}`} className={styles.page}>
          {children}
        </div>
      </main>
    </div>
  );
};
