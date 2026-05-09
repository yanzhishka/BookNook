import React from 'react';
import { Clock, Flame, MessageSquare, Trash2 } from 'lucide-react';
import { Thread } from '../../types';
import { classNames } from '../../utils/classNames';
import { Identicon } from '../Identicon';
import styles from './ThreadCard.module.css';

interface ThreadCardProps {
  canDelete: boolean;
  thread: Thread;
  onDelete: () => void;
  onOpen: () => void;
}

const getHeatClassName = (repliesCount: number) => {
  if (repliesCount > 50) return styles.heatCritical;
  if (repliesCount > 20) return styles.heatHot;
  if (repliesCount > 5) return styles.heatWarm;
  return styles.heatQuiet;
};

export const ThreadCard: React.FC<ThreadCardProps> = ({
  canDelete,
  thread,
  onDelete,
  onOpen,
}) => {
  const isHotThread = thread.repliesCount > 20;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={classNames(styles.card, getHeatClassName(thread.repliesCount))}
    >
      <div className={styles.cardContent}>
        <div className={styles.metaRow}>
          <div className={styles.author}>
            <Identicon seed={thread.authorId} size={36} />
            <div>
              <span className={styles.authorName}>{thread.authorName}</span>
              <span className={styles.authorId}>ID: {thread.authorId?.slice(0, 6) || 'Anon'}</span>
            </div>
          </div>

          <div className={styles.cardActions}>
            <span className={styles.timestamp}>
              <Clock size={10} />
              {thread.timestamp}
            </span>

            {canDelete && (
              <button
                type="button"
                aria-label="Удалить тред"
                className={styles.deleteButton}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <h3 className={styles.threadTitle}>{thread.title}</h3>

        {thread.imageUrl && (
          <div className={styles.imageWrap}>
            <img src={thread.imageUrl} className={styles.image} alt="" />
          </div>
        )}

        <p className={styles.preview}>{thread.content}</p>

        <div className={styles.footer}>
          <div className={styles.replies}>
            <span className={classNames(styles.repliesIcon, isHotThread && styles.repliesIconHot)}>
              {isHotThread ? <Flame size={14} /> : <MessageSquare size={14} />}
            </span>
            <span className={styles.replyCount}>{thread.repliesCount}</span>
          </div>

          <button type="button" className={styles.openButton}>
            Открыть тред
          </button>
        </div>
      </div>
    </article>
  );
};
