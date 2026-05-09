import React from 'react';
import { Trash2 } from 'lucide-react';
import { ThreadReply } from '../../types';
import { classNames } from '../../utils/classNames';
import { Identicon } from '../Identicon';
import styles from './ThreadReplyItem.module.css';

interface ThreadReplyItemProps {
  canDelete: boolean;
  delayIndex: number;
  reply: ThreadReply;
  onDelete: () => void;
}

export const ThreadReplyItem: React.FC<ThreadReplyItemProps> = ({
  canDelete,
  delayIndex,
  reply,
  onDelete,
}) => {
  return (
    <article className={classNames(styles.reply, styles[`delay${delayIndex}`])}>
      <Identicon seed={reply.authorId} size={40} className={styles.avatar} />

      <div className={styles.content}>
        <div className={styles.metaRow}>
          <div className={styles.authorActions}>
            <span className={styles.authorName}>{reply.authorName}</span>

            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className={styles.deleteButton}
                aria-label="Удалить ответ"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <span className={styles.timestamp}>{reply.timestamp}</span>
        </div>

        <div className={styles.bubble}>
          {reply.imageUrl && (
            <div className={styles.imageWrap}>
              <img src={reply.imageUrl} className={styles.image} alt="" />
            </div>
          )}

          <p className={styles.text}>{reply.content}</p>
        </div>
      </div>
    </article>
  );
};
