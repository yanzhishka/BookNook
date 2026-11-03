import React from 'react';
import { LogIn } from 'lucide-react';
import { User } from '../../types';
import { classNames } from '../../utils/classNames';
import { NavigationItem } from './types';
import styles from './MobileNavigation.module.css';

interface MobileNavigationProps {
  activeTab: string;
  navigationItems: NavigationItem[];
  user: User;
  onTabChange: (tab: string) => void;
  isGuest?: boolean;
  onLoginClick?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  navigationItems,
  user,
  onTabChange,
  isGuest,
  onLoginClick,
}) => {
  return (
    <nav
      className={styles.mobileNavigation}
      aria-label="Мобильная навигация"
    >
      <div className={styles.navigationBar}>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
              className={classNames(
                styles.navigationButton,
                isActive ? styles.navigationButtonActive : styles.navigationButtonIdle,
              )}
            >
              <Icon size={24} />
            </button>
          );
        })}

        <button
          type="button"
          aria-label={isGuest ? 'Войти' : 'Профиль'}
          aria-current={!isGuest && activeTab === 'profile' ? 'page' : undefined}
          onClick={() => isGuest ? onLoginClick?.() : onTabChange('profile')}
          className={isGuest ? classNames(styles.navigationButton, styles.navigationButtonIdle) : classNames(
            styles.profileButton,
            activeTab === 'profile' ? styles.profileButtonActive : styles.profileButtonIdle,
          )}
        >
          {isGuest ? <LogIn size={24} /> : <img src={user.avatar} className={styles.avatar} alt={user.name} />}
        </button>
      </div>
    </nav>
  );
};
