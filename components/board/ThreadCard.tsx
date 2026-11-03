import { BookOpen, Heart, MessageSquare, Trash2 } from "lucide-react";
import type { CommunityTopic } from "../../types";
import { Identicon } from "../Identicon";
import styles from "./ThreadCard.module.css";
export const replyLabel = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? "ответ" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "ответа" : "ответов"}`;
export const kindLabel = (kind: CommunityTopic["kind"]) =>
  kind === "quote" ? "Цитата" : kind === "review" ? "Отзыв" : "Обсуждение";
interface Props {
  canDelete: boolean;
  thread: CommunityTopic;
  likePending: boolean;
  onDelete: () => void;
  onOpen: () => void;
  onLike: () => void;
  onViewProfile?: (id: string) => void;
}
export const ThreadCard = ({
  canDelete,
  thread,
  likePending,
  onDelete,
  onOpen,
  onLike,
  onViewProfile,
}: Props) => (
  <article className={styles.card}>
    <header className={styles.metaRow}>
      <button
        type="button"
        className={styles.author}
        disabled={!onViewProfile}
        onClick={() => onViewProfile?.(thread.authorId)}
      >
        {thread.authorAvatar ? (
          <img src={thread.authorAvatar} alt="" className={styles.avatar} />
        ) : (
          <Identicon seed={thread.authorId} size={32} />
        )}
        <span>{thread.authorName}</span>
      </button>
      <time dateTime={thread.createdAt}>{thread.timestamp}</time>
      {canDelete && (
        <button
          type="button"
          className={styles.deleteButton}
          aria-label={`Удалить тему «${thread.title}»`}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      )}
    </header>
    <p className={styles.kind}>{kindLabel(thread.kind)}</p>
    <h2 className={styles.threadTitle}>
      <button type="button" onClick={onOpen}>
        {thread.title}
      </button>
    </h2>
    <p
      className={`${styles.preview} ${thread.kind === "quote" ? styles.quote : ""}`}
    >
      {thread.content}
    </p>
    {thread.imageUrl && (
      <button
        type="button"
        className={styles.imageWrap}
        onClick={onOpen}
        aria-label={`Открыть изображение темы «${thread.title}»`}
      >
        <img
          src={thread.imageUrl}
          className={styles.image}
          alt=""
          loading="lazy"
        />
      </button>
    )}
    {thread.book && (
      <div className={styles.book}>
        <BookOpen size={16} aria-hidden="true" />
        <span>
          <strong>{thread.book.title}</strong>
          <span>{thread.book.author}</span>
        </span>
      </div>
    )}
    <footer className={styles.footer}>
      <button
        type="button"
        aria-label={`Нравится: ${thread.title}`}
        aria-pressed={thread.likedByMe}
        disabled={likePending}
        onClick={onLike}
        className={thread.likedByMe ? styles.liked : ""}
      >
        <Heart size={18} fill={thread.likedByMe ? "currentColor" : "none"} />
        <span>{thread.likesCount}</span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Открыть тему «${thread.title}»`}
      >
        <MessageSquare size={18} />
        <span>{replyLabel(thread.repliesCount)}</span>
      </button>
    </footer>
  </article>
);
