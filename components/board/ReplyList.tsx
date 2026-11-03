import type { RefObject } from "react";
import type { ThreadReply, User } from "../../types";
import { ThreadReplyItem } from "./ThreadReplyItem";
import styles from "./ReplyList.module.css";
interface Props {
  containerRef: RefObject<HTMLDivElement>;
  isAdmin: boolean;
  loading: boolean;
  replies: ThreadReply[];
  user: User;
  error: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: () => void;
  onDeleteReply: (id: string) => void;
  onModerateReply: (reply: ThreadReply) => void;
}
export const ReplyList = (p: Props) => (
  <div ref={p.containerRef} className={styles.replies} aria-busy={p.loading}>
    {p.loading ? (
      <p role="status" className={styles.state}>
        Загружаем ответы…
      </p>
    ) : (
      <>
        {p.error && (
          <div className={styles.error} role="alert">
            <p>{p.error}</p>
            <button onClick={p.hasOlder ? p.onLoadOlder : p.onRetry}>
              Повторить
            </button>
          </div>
        )}
        {p.hasOlder && !p.error && (
          <button
            className={styles.older}
            disabled={p.loadingOlder}
            onClick={p.onLoadOlder}
          >
            {p.loadingOlder ? "Загружаем…" : "Ранние ответы"}
          </button>
        )}
        {!p.replies.length && !p.error ? (
          <p className={styles.state}>Пока нет ответов — начните обсуждение</p>
        ) : (
          p.replies.map((reply, index) => (
            <ThreadReplyItem
              key={reply.id}
              canDelete={p.isAdmin || p.user.id === reply.authorId}
              delayIndex={Math.min(index, 24)}
              reply={reply}
              onDelete={() => p.onDeleteReply(reply.id)}
              canModerate={
                p.user.id !== "guest" && p.user.id !== reply.authorId
              }
              onModerate={() => p.onModerateReply(reply)}
            />
          ))
        )}
      </>
    )}
  </div>
);
