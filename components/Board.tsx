import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ModerationTarget, Thread, ThreadReply, User } from '../types';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';
import { BoardHeader } from './board/BoardHeader';
import { CreateThreadModal } from './board/CreateThreadModal';
import { ThreadCard } from './board/ThreadCard';
import { ThreadDetailModal } from './board/ThreadDetailModal';
import { DeleteTarget } from './board/types';
import { CommunityTermsDialog } from './CommunityTermsDialog';
import { ModerationDialog } from './ModerationDialog';
import styles from './Board.module.css';

interface BoardProps {
  user: User;
  onRequireLogin?: () => void;
  onUpdateUser?: (user: User) => void;
}

type ImageTarget = 'thread' | 'reply';

export const Board: React.FC<BoardProps> = ({ user, onRequireLogin, onUpdateUser }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [replyContent, setReplyContent] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [threadReplies, setThreadReplies] = useState<Record<string, ThreadReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] = useState<ModerationTarget | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const repliesScrollContainerRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.role === 'admin';
  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  const loadThreads = useCallback(async () => {
    setLoading(true);

    try {
      const data = await db.getThreads();
      setThreads(data);
    } catch (error) {
      console.error('Failed to load threads', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const scrollRepliesToTop = () => {
    repliesScrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetCreateForm = () => {
    setNewTitle('');
    setNewContent('');
    setNewImage(null);
  };

  const requestCreateThread = () => {
    if (user.id === 'guest') {
      onRequireLogin?.();
      return;
    }
    if (!user.termsAcceptedAt) {
      setShowTerms(true);
      return;
    }
    setShowCreateModal(true);
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: ImageTarget = 'thread',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const image = reader.result as string;

      if (target === 'reply') {
        setReplyImage(image);
      } else {
        setNewImage(image);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();

    if (user.id === 'guest') {
      onRequireLogin?.();
      return;
    }

    if (!user.termsAcceptedAt) {
      setShowTerms(true);
      return;
    }

    if (!newTitle.trim() || !newContent.trim()) return;

    setIsCreating(true);

    try {
      const createdThread = await db.createThread(
        newTitle,
        newContent,
        newImage,
        user.id,
        user.name,
      );

      setThreads((currentThreads) => [createdThread, ...currentThreads]);
      setShowCreateModal(false);
      resetCreateForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const openThreadModal = async (threadId: string) => {
    setActiveThreadId(threadId);

    if (threadReplies[threadId]) return;

    setLoadingReplies(threadId);

    try {
      const replies = await db.getThreadReplies(threadId);
      setThreadReplies((currentReplies) => ({
        ...currentReplies,
        [threadId]: [...replies].reverse(),
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingReplies(null);
    }
  };

  const handlePostReply = async (threadId: string) => {
    if (user.id === 'guest') {
      onRequireLogin?.();
      return;
    }

    if (!user.termsAcceptedAt) {
      setShowTerms(true);
      return;
    }

    if (!replyContent.trim()) return;

    setIsReplying(true);

    try {
      const reply = await db.postReply(threadId, replyContent, replyImage, user.id, user.name);

      setThreadReplies((currentReplies) => ({
        ...currentReplies,
        [threadId]: [reply, ...(currentReplies[threadId] || [])],
      }));

      setThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId
            ? { ...thread, repliesCount: thread.repliesCount + 1 }
            : thread,
        ),
      );

      setReplyContent('');
      setReplyImage(null);
      scrollRepliesToTop();
    } catch (error) {
      console.error(error);
    } finally {
      setIsReplying(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'thread') {
        await db.deleteThread(deleteTarget.id);
        setThreads((currentThreads) =>
          currentThreads.filter((thread) => thread.id !== deleteTarget.id),
        );

        if (activeThreadId === deleteTarget.id) {
          setActiveThreadId(null);
        }
      } else {
        await db.deleteThreadReply(deleteTarget.id);

        setThreadReplies((currentReplies) => ({
          ...currentReplies,
          [deleteTarget.parentId]: (currentReplies[deleteTarget.parentId] || []).filter(
            (reply) => reply.id !== deleteTarget.id,
          ),
        }));

        setThreads((currentThreads) =>
          currentThreads.map((thread) =>
            thread.id === deleteTarget.parentId
              ? { ...thread, repliesCount: Math.max(0, thread.repliesCount - 1) }
              : thread,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to delete', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAcceptTerms = async () => {
    setIsAcceptingTerms(true);
    try {
      const acceptedAt = await db.acceptCommunityTerms(user.id);
      onUpdateUser?.({ ...user, termsAcceptedAt: acceptedAt });
      setShowTerms(false);
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const handleBlocked = (blockedUserId: string) => {
    setThreads(current => current.filter(thread => thread.authorId !== blockedUserId));
    setThreadReplies(current => Object.fromEntries(
      Object.entries(current).map(([threadId, replies]) => [
        threadId,
        replies.filter(reply => reply.authorId !== blockedUserId),
      ]),
    ));
    if (activeThread?.authorId === blockedUserId) setActiveThreadId(null);
  };

  return (
    <div className={styles.board}>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'thread' ? 'Удалить тред?' : 'Удалить ответ?'}
        message="Это действие нельзя отменить."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <CommunityTermsDialog
        isOpen={showTerms}
        isAccepting={isAcceptingTerms}
        onAccept={handleAcceptTerms}
        onClose={() => setShowTerms(false)}
      />
      <ModerationDialog
        currentUser={user}
        target={moderationTarget}
        onBlocked={handleBlocked}
        onClose={() => setModerationTarget(null)}
      />

      <BoardHeader onCreateThread={requestCreateThread} />

      {loading ? (
        <div className={styles.loader}>
          <Loader2 size={48} className={styles.spinner} />
          <p className={styles.loaderText}>Синхронизация потоков...</p>
        </div>
      ) : (
        <div className={styles.threadGrid}>
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              canDelete={isAdmin || user.id === thread.authorId}
              onOpen={() => openThreadModal(thread.id)}
              onDelete={() => setDeleteTarget({ type: 'thread', id: thread.id })}
            />
          ))}
        </div>
      )}

      {activeThreadId && activeThread && (
        <ThreadDetailModal
          thread={activeThread}
          replies={threadReplies[activeThreadId] || []}
          loadingReplies={loadingReplies === activeThreadId}
          replyContent={replyContent}
          replyImage={replyImage}
          isReplying={isReplying}
          isAdmin={isAdmin}
          user={user}
          replyFileInputRef={replyFileInputRef}
          repliesScrollContainerRef={repliesScrollContainerRef}
          onClose={() => setActiveThreadId(null)}
          onReplyContentChange={setReplyContent}
          onReplyImageClear={() => setReplyImage(null)}
          onReplyImageUpload={(event) => handleImageUpload(event, 'reply')}
          onPostReply={() => handlePostReply(activeThreadId)}
          onDeleteReply={(replyId) =>
            setDeleteTarget({ type: 'reply', id: replyId, parentId: activeThreadId })
          }
          onModerateThread={() => setModerationTarget({
            contentType: 'thread',
            contentId: activeThread.id,
            userId: activeThread.authorId,
            userName: activeThread.authorName,
          })}
          onModerateReply={(reply) => setModerationTarget({
            contentType: 'reply',
            contentId: reply.id,
            userId: reply.authorId,
            userName: reply.authorName,
          })}
        />
      )}

      {showCreateModal && (
        <CreateThreadModal
          fileInputRef={fileInputRef}
          isCreating={isCreating}
          newContent={newContent}
          newImage={newImage}
          newTitle={newTitle}
          onClose={() => setShowCreateModal(false)}
          onContentChange={setNewContent}
          onImageClear={() => setNewImage(null)}
          onImageUpload={(event) => handleImageUpload(event)}
          onSubmit={handleCreateThread}
          onTitleChange={setNewTitle}
        />
      )}
    </div>
  );
};
