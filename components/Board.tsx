import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { MessageSquare, Plus } from "lucide-react";
import type {
  Book,
  CommunityTopic,
  ModerationTarget,
  User,
} from "../types";
import { db } from "../services/db";
import {
  community,
  topicKey,
  type TopicIdentity,
  type TopicScope,
} from "../services/community";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorNotice } from "./ErrorNotice";
import { BoardHeader } from "./board/BoardHeader";
import { CreateThreadModal } from "./board/CreateThreadModal";
import { ThreadCard } from "./board/ThreadCard";
import { ThreadDetailModal } from "./board/ThreadDetailModal";
import { CommunityTermsDialog } from "./CommunityTermsDialog";
import { ModerationDialog } from "./ModerationDialog";
import styles from "./Board.module.css";
import { useTopicList } from './board/useTopicList';
import { useTopicConversation } from './board/useTopicConversation';
import { useTopicComposer } from './board/useTopicComposer';
import { errorText } from './board/errors';

interface BoardProps {
  user: User;
  books: Book[];
  onRequireLogin?: () => void;
  onUpdateUser?: (user: User) => void;
  onActivitySaved?: () => void;
  onViewProfile?: (id: string) => void;
  pendingTopic?: TopicIdentity | null;
  onConsumePendingTopic?: () => void;
  api?: typeof community;
}
interface DeleteTarget {
  topic: CommunityTopic;
  replyId?: string;
}
export const Board = ({
  user,
  books,
  onRequireLogin,
  onUpdateUser,
  onActivitySaved,
  onViewProfile,
  pendingTopic,
  onConsumePendingTopic,
  api = community,
}: BoardProps) => {
  const list = useTopicList(api);
  const { topics, criteria, search, setSearch, loading, hasMore, listError, refresh, changeCriteria } = list;
  const [operationError, setOperationError] = useState('');
  const conversation = useTopicConversation({ api, userId: user.id, onTopicUpdate: list.updateTopic,
    onActivitySaved, pendingTopic, onConsumePendingTopic, onOpenError: setOperationError });
  const { activeTopic, activeKey, replies, repliesLoading, olderLoading, hasOlder, replyError,
    operationError: replyOperationError, replyDraft, setReplyDraft, isReplying,
    repliesContainer, updateTopic, loadOlder } = conversation;
  const composer = useTopicComposer(api, user.id, topic => {
    list.created(topic); conversation.open(topic); onActivitySaved?.();
  });
  const { showCreate, setShowCreate, newTitle, setNewTitle, newContent, setNewContent,
    newKind, setNewKind, newBookId, setNewBookId, newImage, setNewImage,
    createError, setCreateError, isCreating, createLock } = composer;
  const [uploading, setUploading] = useState(false);
  const [likePending, setLikePending] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [moderationTarget, setModerationTarget] =
    useState<ModerationTarget | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);
  const [termsError, setTermsError] = useState("");
  const likesLock = useRef(new Set<string>());
  const deleteLock = useRef(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const imageVersion = useRef(0);
  const alive = useRef(true);
  const createInput = useRef<HTMLInputElement>(null),
    replyInput = useRef<HTMLInputElement>(null);
  const isAdmin = user.role === "admin";

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      imageVersion.current++;
    };
  }, []);
  useEffect(() => { imageVersion.current++; setUploading(false); }, [activeKey]);

  const requireMember = (action: () => void) => {
    if (user.id === "guest") {
      onRequireLogin?.();
      return;
    }
    if (!user.termsAcceptedAt) {
      pendingAction.current = action;
      setTermsError("");
      setShowTerms(true);
      return;
    }
    action();
  };
  const requestCreate = () =>
    requireMember(() => {
      setOperationError("");
      conversation.open(null);
      setShowCreate(true);
    });
  const setScope = (scope: TopicScope) => {
    if (scope === "mine" && user.id === "guest") {
      onRequireLogin?.();
      return;
    }
    changeCriteria({ scope });
  };
  const closeTopic = () => {
    if (deleteLock.current || !conversation.close()) return;
    imageVersion.current++;
    setUploading(false);
    setOperationError("");
  };
  const closeCreate = () => {
    if (createLock.current) return;
    imageVersion.current++;
    setUploading(false);
    setShowCreate(false);
  };
  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    target: "topic" | "reply",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const version = ++imageVersion.current;
    setUploading(true);
    target === "topic" ? setCreateError("") : setOperationError("");
    try {
      if (
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          file.type,
        ) ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error(
          "Используйте PNG, JPEG, WebP или GIF размером до 2 МБ.",
        );
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Не удалось прочитать изображение."));
        reader.readAsDataURL(file);
      });
      if (version !== imageVersion.current || !alive.current) return;
      if (target === "topic") setNewImage(image);
      else setReplyDraft({ image });
    } catch (error) {
      if (version === imageVersion.current) {
        const message = errorText(error, "Не удалось загрузить изображение.");
        target === "topic"
          ? setCreateError(message)
          : setOperationError(message);
      }
    } finally {
      event.target.value = "";
      if (version === imageVersion.current && alive.current)
        setUploading(false);
    }
  };
  const create = (event: FormEvent) => {
    event.preventDefault();
    if (createLock.current || uploading) return;
    requireMember(() => { void composer.create(); });
  };
  const like = (topic: CommunityTopic) =>
    requireMember(() => {
      void (async () => {
        const key = topicKey(topic);
        if (likesLock.current.has(key)) return;
        likesLock.current.add(key);
        setLikePending(new Set(likesLock.current));
        setOperationError("");
        try {
          const updated = await api.like(topic, user.id, !topic.likedByMe);
          if (alive.current) updateTopic(updated);
        } catch (error) {
          if (alive.current)
            setOperationError(
              errorText(
                error,
                "Не удалось сохранить реакцию. Попробуйте ещё раз.",
              ),
            );
        } finally {
          likesLock.current.delete(key);
          if (alive.current) setLikePending(new Set(likesLock.current));
        }
      })();
    });
  const sendReply = () => {
    if (uploading) return;
    setOperationError('');
    requireMember(() => { void conversation.sendReply(); });
  };
  const confirmDelete = async () => {
    if (!deleteTarget || deleteLock.current) return;
    const target = deleteTarget;
    deleteLock.current = true;
    setIsDeleting(true);
    setDeleteError("");
    try {
      if (target.replyId) {
        await api.removeReply(target.topic, target.replyId);
        if (!alive.current) return;
        conversation.removedReply(target.topic, target.replyId);
        // The deletion succeeded. A failed counter refresh must not invite a second deletion.
        void api
          .get(target.topic)
          .then((topic) => {
            if (alive.current) updateTopic(topic);
          })
          .catch(() => {});
      } else {
        await api.remove(target.topic);
        list.remove(target.topic);
        if (activeTopic && topicKey(activeTopic) === topicKey(target.topic))
          conversation.open(null);
      }
      setDeleteTarget(null);
      onActivitySaved?.();
    } catch (error) {
      setDeleteError(
        errorText(error, "Не удалось удалить запись. Попробуйте ещё раз."),
      );
    } finally {
      deleteLock.current = false;
      if (alive.current) setIsDeleting(false);
    }
  };
  const acceptTerms = async () => {
    setIsAcceptingTerms(true);
    setTermsError("");
    try {
      const accepted = await db.acceptCommunityTerms(user.id);
      onUpdateUser?.({ ...user, termsAcceptedAt: accepted });
      setShowTerms(false);
      const action = pendingAction.current;
      pendingAction.current = null;
      action?.();
    } catch (error) {
      setTermsError(
        errorText(error, "Не удалось сохранить согласие. Попробуйте ещё раз."),
      );
    } finally {
      setIsAcceptingTerms(false);
    }
  };
  const blocked = (userId: string) => {
    list.removeAuthor(userId); conversation.removeAuthor(userId); refresh();
  };
  const reportTopic = (topic: CommunityTopic) =>
    setModerationTarget({
      contentType: topic.source === "thread" ? "thread" : "post",
      contentId: topic.id,
      userId: topic.authorId,
      userName: topic.authorName,
    });
  const startDelete = (target: DeleteTarget) => {
    setDeleteError("");
    setDeleteTarget(target);
  };

  return (
    <div className={styles.board}>
      <BoardHeader
        query={search}
        kind={criteria.kind}
        scope={criteria.scope}
        sort={criteria.sort}
        loading={loading}
        onQueryChange={setSearch}
        onSearch={() => changeCriteria({ query: search.trim() })}
        onKindChange={(kind) => changeCriteria({ kind })}
        onScopeChange={setScope}
        onSortChange={(sort) => changeCriteria({ sort })}
        onCreateThread={requestCreate}
        onRefresh={refresh}
      />
      {operationError && !activeTopic && (
        <ErrorNotice message={operationError} />
      )}
      {listError && <ErrorNotice message={listError} onRetry={refresh} />}
      {loading && !topics.length ? (
        <div className={styles.loader} role="status">
          <span className={styles.loadingDot} />
          <span>Загружаем темы…</span>
        </div>
      ) : !topics.length && !listError ? (
        <div className={styles.empty}>
          <MessageSquare size={32} />
          <h2>
            {criteria.query ||
            criteria.kind !== "all" ||
            criteria.scope !== "all"
              ? "Темы не найдены"
              : "Начните разговор о книгах"}
          </h2>
          <p>
            {criteria.query ||
            criteria.kind !== "all" ||
            criteria.scope !== "all"
              ? "Попробуйте другой запрос или сбросьте фильтры"
              : "Задайте вопрос, поделитесь цитатой или напишите отзыв"}
          </p>
          <div>
            {(criteria.query ||
              criteria.kind !== "all" ||
              criteria.scope !== "all") && (
              <button
                onClick={list.reset}
              >
                Сбросить фильтры
              </button>
            )}
            <button onClick={requestCreate}>
              <Plus size={16} />
              Новая тема
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.threadGrid} aria-busy={loading}>
          {topics.map((topic) => (
            <ThreadCard
              key={topicKey(topic)}
              thread={topic}
              canDelete={isAdmin || user.id === topic.authorId}
              likePending={likePending.has(topicKey(topic))}
              onOpen={() => {
                setOperationError("");
                conversation.open(topic);
              }}
              onLike={() => like(topic)}
              onDelete={() => startDelete({ topic })}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}
      {hasMore && !listError && (
        <button
          className={styles.more}
          disabled={loading}
          onClick={list.loadMore}
        >
          {loading ? "Загружаем…" : "Показать ещё"}
        </button>
      )}
      {activeTopic && (
        <ThreadDetailModal
          thread={activeTopic}
          user={user}
          isAdmin={isAdmin}
          replies={replies}
          loadingReplies={repliesLoading}
          replyError={replyError}
          operationError={operationError || replyOperationError}
          hasOlder={hasOlder}
          loadingOlder={olderLoading}
          onLoadOlder={() => void loadOlder()}
          onRetryReplies={conversation.retry}
          repliesScrollContainerRef={repliesContainer}
          replyContent={replyDraft?.content || ""}
          replyImage={replyDraft?.image || null}
          replyFileInputRef={replyInput}
          isReplying={isReplying}
          uploading={uploading}
          likePending={likePending.has(activeKey) || repliesLoading}
          onLike={() => like(activeTopic)}
          suspended={showTerms || !!deleteTarget || !!moderationTarget}
          onClose={closeTopic}
          onReplyContentChange={(content) => setReplyDraft({ content })}
          onReplyImageClear={() => setReplyDraft({ image: null })}
          onReplyImageUpload={(event) => void upload(event, "reply")}
          onPostReply={sendReply}
          onDeleteReply={(replyId) =>
            startDelete({ topic: activeTopic, replyId })
          }
          onModerateThread={() => reportTopic(activeTopic)}
          onModerateReply={(reply) =>
            setModerationTarget({
              contentType:
                activeTopic.source === "thread" ? "reply" : "comment",
              contentId: reply.id,
              userId: reply.authorId,
              userName: reply.authorName,
            })
          }
          onViewProfile={onViewProfile}
          onRequireLogin={onRequireLogin}
        />
      )}
      {showCreate && (
        <CreateThreadModal
          fileInputRef={createInput}
          isCreating={isCreating}
          uploading={uploading}
          newTitle={newTitle}
          newContent={newContent}
          newImage={newImage}
          kind={newKind}
          bookId={newBookId}
          books={books}
          error={createError}
          onClose={closeCreate}
          onTitleChange={setNewTitle}
          onContentChange={setNewContent}
          onKindChange={setNewKind}
          onBookChange={setNewBookId}
          onImageClear={() => setNewImage(null)}
          onImageUpload={(event) => void upload(event, "topic")}
          onSubmit={create}
        />
      )}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.replyId ? "Удалить ответ?" : "Удалить тему?"}
        message={deleteError || "Это действие нельзя отменить."}
        isConfirming={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleteLock.current) setDeleteTarget(null);
        }}
      />
      <ModerationDialog
        currentUser={user}
        target={moderationTarget}
        onBlocked={blocked}
        onClose={() => setModerationTarget(null)}
      />
      <CommunityTermsDialog
        isOpen={showTerms}
        isAccepting={isAcceptingTerms}
        error={termsError}
        onAccept={acceptTerms}
        onClose={() => {
          if (!isAcceptingTerms) {
            setShowTerms(false);
            pendingAction.current = null;
          }
        }}
      />
    </div>
  );
};
