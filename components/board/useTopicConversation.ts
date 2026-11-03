import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunityTopic, ThreadReply } from '../../types';
import { community, topicKey, type TopicIdentity } from '../../services/community';
import { errorText } from './errors';

interface ReplyDraft { id: string; content: string; image: string | null }
interface Options {
  api: typeof community;
  userId: string;
  onTopicUpdate: (topic: CommunityTopic) => void;
  onActivitySaved?: () => void;
  pendingTopic?: TopicIdentity | null;
  onConsumePendingTopic?: () => void;
  onOpenError: (message: string) => void;
}

export function useTopicConversation({ api, userId, onTopicUpdate, onActivitySaved, pendingTopic, onConsumePendingTopic, onOpenError }: Options) {
  const [activeTopic, setActiveTopic] = useState<CommunityTopic | null>(null);
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [revision, setRevision] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, ReplyDraft>>({});
  const [isReplying, setIsReplying] = useState(false);
  const replyLock = useRef(false);
  const olderLock = useRef(false);
  const version = useRef(0);
  const alive = useRef(true);
  const repliesContainer = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);
  const activeKey = activeTopic ? topicKey(activeTopic) : '';
  const identity = useMemo(() => activeTopic ? { id: activeTopic.id, source: activeTopic.source } : null, [activeTopic?.id, activeTopic?.source]);
  const pendingIdentity = useMemo(() => pendingTopic ? { id: pendingTopic.id, source: pendingTopic.source } : null, [pendingTopic?.id, pendingTopic?.source]);
  const replyDraft = drafts[activeKey];

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; version.current++; if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); };
  }, []);
  const open = useCallback((topic: CommunityTopic | null) => {
    version.current++; setActiveTopic(topic); setOperationError('');
  }, []);
  const updateTopic = useCallback((topic: CommunityTopic) => {
    onTopicUpdate(topic);
    setActiveTopic(current => current && topicKey(current) === topicKey(topic) ? topic : current);
  }, [onTopicUpdate]);

  useEffect(() => {
    if (!pendingIdentity) return;
    const controller = new AbortController();
    void api.get(pendingIdentity, controller.signal).then(topic => {
      if (!controller.signal.aborted) open(topic);
    }).catch(() => {
      if (!controller.signal.aborted) onOpenError('Тема недоступна или уже удалена.');
    }).finally(() => { if (!controller.signal.aborted) onConsumePendingTopic?.(); });
    return () => controller.abort();
  }, [api, pendingIdentity, onConsumePendingTopic, onOpenError, open]);

  useEffect(() => {
    const currentVersion = ++version.current;
    olderLock.current = false;
    setReplies([]); setReplyError(''); setOlderLoading(false); setHasOlder(false);
    if (!identity) { setRepliesLoading(false); return; }
    const controller = new AbortController();
    setRepliesLoading(true);
    void Promise.all([api.replies(identity, 0, controller.signal), api.get(identity, controller.signal)]).then(([result, topic]) => {
      if (controller.signal.aborted) return;
      setReplies(result.replies); setHasOlder(result.hasMore); updateTopic(topic);
    }).catch(error => {
      if (!controller.signal.aborted) setReplyError(errorText(error, 'Не удалось загрузить ответы. Попробуйте ещё раз.'));
    }).finally(() => {
      if (!controller.signal.aborted && currentVersion === version.current) setRepliesLoading(false);
    });
    return () => controller.abort();
  }, [api, identity, revision, updateTopic]);

  const close = () => { if (replyLock.current) return false; open(null); return true; };
  const setReplyDraft = (patch: Partial<ReplyDraft>) => {
    if (!activeTopic) return;
    setDrafts(current => ({ ...current, [activeKey]: {
      id: current[activeKey]?.id || crypto.randomUUID(), content: current[activeKey]?.content || '', image: current[activeKey]?.image || null, ...patch,
    } }));
  };
  const sendReply = async () => {
    if (!activeTopic || !replyDraft?.content.trim() || replyLock.current || repliesLoading) return;
    const topic = activeTopic, draft = replyDraft, key = activeKey, currentVersion = version.current;
    replyLock.current = true; setIsReplying(true); setOperationError('');
    try {
      const reply = await api.reply(topic, { id: draft.id, content: draft.content, imageUrl: draft.image }, userId);
      if (!alive.current) return;
      if (currentVersion === version.current) {
        setReplies(current => [...current.filter(item => item.id !== reply.id), reply]);
        scrollFrame.current = requestAnimationFrame(() => repliesContainer.current?.scrollTo({ top: repliesContainer.current.scrollHeight, behavior: 'smooth' }));
      }
      updateTopic({ ...topic, repliesCount: topic.repliesCount + (replies.some(item => item.id === reply.id) ? 0 : 1) });
      setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
      onActivitySaved?.();
    } catch (error) {
      if (alive.current && currentVersion === version.current) setOperationError(errorText(error, 'Не удалось отправить ответ. Текст остался в поле — попробуйте ещё раз.'));
    } finally { replyLock.current = false; if (alive.current) setIsReplying(false); }
  };
  const loadOlder = async () => {
    if (!activeTopic || olderLock.current || repliesLoading || !hasOlder) return;
    const topic = activeTopic, currentVersion = version.current;
    olderLock.current = true; setOlderLoading(true); setReplyError('');
    try {
      const result = await api.replies(topic, replies.length);
      if (alive.current && currentVersion === version.current) {
        setReplies(current => [...result.replies.filter(reply => !current.some(item => item.id === reply.id)), ...current]);
        setHasOlder(result.hasMore);
      }
    } catch (error) {
      if (alive.current && currentVersion === version.current) setReplyError(errorText(error, 'Не удалось загрузить ранние ответы.'));
    } finally {
      if (currentVersion === version.current) { olderLock.current = false; if (alive.current) setOlderLoading(false); }
    }
  };
  const removedReply = (topic: CommunityTopic, id: string) => {
    if (activeKey === topicKey(topic)) setReplies(current => current.filter(reply => reply.id !== id));
    updateTopic({ ...topic, repliesCount: Math.max(0, topic.repliesCount - 1) });
  };
  const removeAuthor = (id: string) => {
    setReplies(current => current.filter(reply => reply.authorId !== id));
    if (activeTopic?.authorId === id) open(null);
  };
  return { activeTopic, activeKey, replies, repliesLoading, olderLoading, hasOlder, replyError, operationError, setOperationError,
    replyDraft, setReplyDraft, isReplying, replyLock, repliesContainer, open, close, updateTopic,
    sendReply, loadOlder, retry: () => setRevision(value => value + 1), removedReply, removeAuthor };
}
