import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Thread, ThreadReply, User } from '../../types';
import { Identicon } from '../Identicon';
import { ReplyComposer } from './ReplyComposer';
import { ReplyList } from './ReplyList';
import styles from './ThreadDetailModal.module.css';

interface ThreadDetailModalProps {
  isAdmin: boolean;
  isReplying: boolean;
  loadingReplies: boolean;
  replies: ThreadReply[];
  repliesScrollContainerRef: React.RefObject<HTMLDivElement>;
  replyContent: string;
  replyFileInputRef: React.RefObject<HTMLInputElement>;
  replyImage: string | null;
  thread: Thread;
  user: User;
  onClose: () => void;
  onDeleteReply: (replyId: string) => void;
  onPostReply: () => void;
  onReplyContentChange: (value: string) => void;
  onReplyImageClear: () => void;
  onReplyImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ThreadDetailModal: React.FC<ThreadDetailModalProps> = ({
  isAdmin,
  isReplying,
  loadingReplies,
  replies,
  repliesScrollContainerRef,
  replyContent,
  replyFileInputRef,
  replyImage,
  thread,
  user,
  onClose,
  onDeleteReply,
  onPostReply,
  onReplyContentChange,
  onReplyImageClear,
  onReplyImageUpload,
}) => {
  const titleId = `thread-title-${thread.id}`;

  return (
    <div className={styles.modalLayer}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Закрыть тред"
        onClick={onClose}
      />

      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <aside className={styles.threadContext}>
          <div className={styles.threadContextInner}>
            <div className={styles.authorRow}>
              <Identicon seed={thread.authorId} size={56} className={styles.authorAvatar} />
              <div>
                <h4 className={styles.authorName}>{thread.authorName}</h4>
                <span className={styles.createdAt}>Создано {thread.timestamp}</span>
              </div>
            </div>

            <h2 id={titleId} className={styles.threadTitle}>
              {thread.title}
            </h2>

            {thread.imageUrl && (
              <div className={styles.threadImageWrap}>
                <img src={thread.imageUrl} className={styles.threadImage} alt="" />
              </div>
            )}

            <div className={styles.threadContent}>{thread.content}</div>

            <div className={styles.replyStat}>
              <MessageCircle size={18} className={styles.replyStatIcon} />
              {thread.repliesCount} ответов
            </div>
          </div>
        </aside>

        <div className={styles.discussion}>
          <div className={styles.discussionHeader}>
            <h3 className={styles.discussionTitle}>Поток дискуссии</h3>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Закрыть"
            >
              <X size={28} />
            </button>
          </div>

          <ReplyComposer
            fileInputRef={replyFileInputRef}
            image={replyImage}
            isReplying={isReplying}
            value={replyContent}
            onClearImage={onReplyImageClear}
            onImageUpload={onReplyImageUpload}
            onSubmit={onPostReply}
            onValueChange={onReplyContentChange}
          />

          <ReplyList
            containerRef={repliesScrollContainerRef}
            isAdmin={isAdmin}
            loading={loadingReplies}
            replies={replies}
            user={user}
            onDeleteReply={onDeleteReply}
          />
        </div>
      </section>
    </div>
  );
};
