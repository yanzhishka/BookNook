import React from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Theme } from '../../App';
import { User } from '../../types';
import { classNames } from '../../utils/classNames';
import { NavigationItem } from './types';
import styles from './DesktopSidebar.module.css';

interface DesktopSidebarProps {
  activeTab: string;
  currentTheme: Theme;
  isGuest?: boolean;
  navigationItems: NavigationItem[];
  user: User;
  zenMode?: boolean;
  onLoginClick?: () => void;
  onLogout: () => void;
  onTabChange: (tab: string) => void;
  setTheme: (theme: Theme) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  currentTheme,
  isGuest,
  navigationItems,
  user,
  zenMode,
  onLoginClick,
  onLogout,
  onTabChange,
  setTheme,
}) => {
  return (
    <aside
      className={classNames(
        styles.sidebar,
        zenMode ? styles.sidebarHidden : styles.sidebarVisible,
      )}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>
          <button
            type="button"
            className={styles.brandButton}
            onClick={() => onTabChange('home')}
          >
            <span className={styles.brandMark}>B</span>
            <span>B.NOOK</span>
          </button>
        </h1>
      </header>

      <nav className={styles.navigation} aria-label="Основная навигация">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
              className={classNames(
                styles.navigationButton,
                isActive ? styles.navigationButtonActive : styles.navigationButtonIdle,
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={classNames(styles.navigationIcon, isActive && styles.navigationIconActive)}
              />
              <span className={styles.navigationLabel}>{item.label}</span>
              {isActive && <span className={styles.activeMarker} />}
            </button>
          );
        })}
      </nav>

      <footer className={styles.footer}>
        <div className={styles.themeSwitcher} aria-label="Выбор темы">
          <button
            type="button"
            aria-label="Светлая тема"
            onClick={() => setTheme('light')}
            className={classNames(
              styles.themeButton,
              currentTheme === 'light' ? styles.lightThemeActive : styles.themeButtonIdle,
            )}
          >
            <Sun size={20} />
          </button>
          <button
            type="button"
            aria-label="Темная тема"
            onClick={() => setTheme('dark')}
            className={classNames(
              styles.themeButton,
              currentTheme === 'dark' ? styles.darkThemeActive : styles.themeButtonIdle,
            )}
          >
            <Moon size={20} />
          </button>
        </div>

        <div className={styles.divider} />

        {isGuest ? (
          <button type="button" onClick={onLoginClick} className={styles.loginButton}>
            Войти
          </button>
        ) : (
          <div className={styles.userActions}>
            <button
              type="button"
              onClick={() => onTabChange('profile')}
              className={classNames(
                styles.profileButton,
                activeTab === 'profile' ? styles.profileButtonActive : styles.profileButtonIdle,
              )}
            >
              <img src={user.avatar} className={styles.avatar} alt={user.name} />
              <span className={styles.userText}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userLevel}>Уровень {user.level}</span>
              </span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className={styles.logoutButton}
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut size={22} />
            </button>
          </div>
        )}
      </footer>
    </aside>
  );
};
