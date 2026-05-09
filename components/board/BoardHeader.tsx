import React from 'react';
import { Plus } from 'lucide-react';
import styles from './BoardHeader.module.css';

interface BoardHeaderProps {
  onCreateThread: () => void;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({ onCreateThread }) => {
  return (
    <header className={styles.header}>
      <div>
        <h2 className={styles.title}>The Grid</h2>
        <p className={styles.subtitle}>Бесконечный поток коллективного разума.</p>
      </div>

      <button type="button" onClick={onCreateThread} className={styles.createButton}>
        <Plus size={18} />
        <span>Создать тред</span>
      </button>
    </header>
  );
};
