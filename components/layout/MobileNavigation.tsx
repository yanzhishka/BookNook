import React from 'react';
import { User } from '../../types';
import { classNames } from '../../utils/classNames';
import { NavigationItem } from './types';
import styles from './MobileNavigation.module.css';

interface MobileNavigationProps {
  activeTab: string;
  navigationItems: NavigationItem[];
  user: User;
  zenMode?: boolean;
  onTabChange: (tab: string) => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  navigationItems,
  user,
  zenMode,
  onTabChange,
}) => {
  return (
    <nav
      className={classNames(
        styles.mobileNavigation,
        zenMode ? styles.mobileNavigationHidden : styles.mobileNavigationVisible,
      )}
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
          aria-label="Профиль"
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          onClick={() => onTabChange('profile')}
          className={classNames(
            styles.profileButton,
            activeTab === 'profile' ? styles.profileButtonActive : styles.profileButtonIdle,
          )}
        >
          <img src={user.avatar} className={styles.avatar} alt={user.name} />
        </button>
      </div>
    </nav>
  );
};
