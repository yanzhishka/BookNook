import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { ThreadReply, User } from '../../types';
import { ThreadReplyItem } from './ThreadReplyItem';
import styles from './ReplyList.module.css';

interface ReplyListProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isAdmin: boolean;
  loading: boolean;
  replies: ThreadReply[];
  user: User;
  onDeleteReply: (replyId: string) => void;
  onModerateReply: (reply: ThreadReply) => void;
}

export const ReplyList: React.FC<ReplyListProps> = ({
  containerRef,
  isAdmin,
  loading,
  replies,
  user,
  onDeleteReply,
  onModerateReply,
}) => {
  if (loading) {
    return (
      <div ref={containerRef} className={styles.replies}>
        <div className={styles.state}>
          <Loader2 size={40} className={styles.spinner} />
          <p className={styles.stateText}>Загрузка ответов...</p>
        </div>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div ref={containerRef} className={styles.replies}>
        <div className={styles.emptyState}>
          <MessageSquare size={64} className={styles.emptyIcon} />
          <p className={styles.stateText}>Нет ответов. Начните беседу.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.replies}>
      {replies.map((reply, index) => (
        <ThreadReplyItem
          key={reply.id}
          canDelete={isAdmin || user.id === reply.authorId}
          delayIndex={Math.min(index, 24)}
          reply={reply}
          onDelete={() => onDeleteReply(reply.id)}
          canModerate={user.id !== 'guest' && user.id !== reply.authorId}
          onModerate={() => onModerateReply(reply)}
        />
      ))}
    </div>
  );
};
