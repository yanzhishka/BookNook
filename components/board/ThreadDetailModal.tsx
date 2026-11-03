import { createPortal } from "react-dom";
import type { ChangeEvent, RefObject } from "react";
import { BookOpen, Flag, Heart, X } from "lucide-react";
import type { CommunityTopic, ThreadReply, User } from "../../types";
import { useDialog } from "../../utils/useDialog";
import { Identicon } from "../Identicon";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyList } from "./ReplyList";
import { kindLabel, replyLabel } from "./ThreadCard";
import styles from "./ThreadDetailModal.module.css";
interface Props {
  isAdmin: boolean;
  isReplying: boolean;
  uploading: boolean;
  loadingReplies: boolean;
  replies: ThreadReply[];
  repliesScrollContainerRef: RefObject<HTMLDivElement>;
  replyContent: string;
  replyFileInputRef: RefObject<HTMLInputElement>;
  replyImage: string | null;
  thread: CommunityTopic;
  user: User;
  replyError: string;
  operationError: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  likePending: boolean;
  suspended: boolean;
  onClose: () => void;
  onDeleteReply: (id: string) => void;
  onPostReply: () => void;
  onReplyContentChange: (v: string) => void;
  onReplyImageClear: () => void;
  onReplyImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onModerateThread: () => void;
  onModerateReply: (reply: ThreadReply) => void;
  onLoadOlder: () => void;
  onRetryReplies: () => void;
  onLike: () => void;
  onViewProfile?: (id: string) => void;
  onRequireLogin?: () => void;
}
export const ThreadDetailModal = (p: Props) => {
  const ref = useDialog(p.onClose, p.isReplying, p.suspended);
  const titleId = `grid-topic-${p.thread.source}-${p.thread.id}`;
  return createPortal(
    <div className={styles.modalLayer}>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Закрыть тему"
        disabled={p.isReplying}
        onClick={p.onClose}
      />
      <section
        ref={ref}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <span>{kindLabel(p.thread.kind)}</span>
          <button
            type="button"
            onClick={p.onClose}
            disabled={p.isReplying}
            aria-label="Закрыть"
          >
            <X size={24} />
          </button>
        </header>
        <div className={styles.body}>
          <div className={styles.context}>
            <button
              type="button"
              className={styles.author}
              disabled={!p.onViewProfile || p.isReplying}
              onClick={() => p.onViewProfile?.(p.thread.authorId)}
            >
              {p.thread.authorAvatar ? (
                <img src={p.thread.authorAvatar} alt="" />
              ) : (
                <Identicon seed={p.thread.authorId} size={36} />
              )}
              <span>
                <strong>{p.thread.authorName}</strong>
                <time dateTime={p.thread.createdAt}>{p.thread.timestamp}</time>
              </span>
            </button>
            <h2 id={titleId}>{p.thread.title}</h2>
            <div
              className={`${styles.content} ${p.thread.kind === "quote" ? styles.quote : ""}`}
            >
              {p.thread.content}
            </div>
            {p.thread.imageUrl && (
              <img
                className={styles.image}
                src={p.thread.imageUrl}
                alt="Изображение к теме"
              />
            )}
            {p.thread.book && (
              <div className={styles.book}>
                <BookOpen size={18} />
                <span>
                  <strong>{p.thread.book.title}</strong>
                  <span>{p.thread.book.author}</span>
                </span>
              </div>
            )}
            <div className={styles.topicActions}>
              <button
                type="button"
                onClick={p.onLike}
                disabled={p.likePending || p.isReplying}
                aria-label="Нравится"
                aria-pressed={p.thread.likedByMe}
              >
                <Heart
                  size={18}
                  fill={p.thread.likedByMe ? "currentColor" : "none"}
                />
                {p.thread.likesCount}
              </button>
              {p.user.id !== "guest" && p.thread.authorId !== p.user.id && (
                <button
                  type="button"
                  onClick={p.onModerateThread}
                  disabled={p.isReplying}
                >
                  <Flag size={16} />
                  Пожаловаться
                </button>
              )}
            </div>
            {p.operationError && (
              <p role="alert" className={styles.error}>
                {p.operationError}
              </p>
            )}
          </div>
          <div className={styles.discussion}>
            <h3 className={styles.discussionTitle}>
              {replyLabel(p.thread.repliesCount)}
            </h3>
            <ReplyList
              containerRef={p.repliesScrollContainerRef}
              isAdmin={p.isAdmin}
              loading={p.loadingReplies}
              replies={p.replies}
              user={p.user}
              onDeleteReply={p.onDeleteReply}
              onModerateReply={p.onModerateReply}
              error={p.replyError}
              hasOlder={p.hasOlder}
              loadingOlder={p.loadingOlder}
              onLoadOlder={p.onLoadOlder}
              onRetry={p.onRetryReplies}
            />
            <ReplyComposer
              fileInputRef={p.replyFileInputRef}
              image={p.replyImage}
              isReplying={p.isReplying}
              uploading={p.uploading}
              loading={p.loadingReplies}
              value={p.replyContent}
              allowImages={p.thread.source === "thread"}
              isGuest={p.user.id === "guest"}
              onRequireLogin={p.onRequireLogin}
              onClearImage={p.onReplyImageClear}
              onImageUpload={p.onReplyImageUpload}
              onSubmit={p.onPostReply}
              onValueChange={p.onReplyContentChange}
            />
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};
