import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunityTopic } from '../../types';
import { community, topicKey, type TopicQuery } from '../../services/community';
import { errorText } from './errors';

const initialQuery: TopicQuery = { query: '', kind: 'all', scope: 'all', sort: 'new' };

export function useTopicList(api: typeof community) {
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [criteria, setCriteria] = useState<TopicQuery>(initialQuery);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [listError, setListError] = useState('');
  const request = useRef<AbortController | null>(null);
  const pagingLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    pagingLock.current = true;
    setLoading(true); setListError('');
    if (offset === 0) setTopics([]);
    void api.list({ ...criteria, offset }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setTopics(current => offset === 0 ? result.topics : [...current,
        ...result.topics.filter(topic => !current.some(item => topicKey(item) === topicKey(topic)))]);
      setHasMore(result.hasMore);
    }).catch(error => {
      if (!controller.signal.aborted) setListError(errorText(error, 'Не удалось загрузить темы. Проверьте подключение и повторите попытку.'));
    }).finally(() => { if (!controller.signal.aborted) { pagingLock.current = false; setLoading(false); } });
    return () => controller.abort();
  }, [api, criteria, offset, revision]);

  const refresh = useCallback(() => {
    request.current?.abort(); setOffset(0); setRevision(value => value + 1);
  }, []);
  const changeCriteria = useCallback((patch: Partial<TopicQuery>) => {
    request.current?.abort(); setOffset(0); setCriteria(current => ({ ...current, ...patch }));
  }, []);
  const reset = useCallback(() => {
    request.current?.abort(); setSearch(''); setOffset(0); setCriteria({ ...initialQuery });
  }, []);
  const updateTopic = useCallback((topic: CommunityTopic) => {
    setTopics(current => current.map(item => topicKey(item) === topicKey(topic) ? topic : item));
  }, []);
  const created = (topic: CommunityTopic) => {
    reset();
    setTopics(current => [topic, ...current.filter(item => topicKey(item) !== topicKey(topic))]);
  };
  const remove = (topic: CommunityTopic) => setTopics(current => current.filter(item => topicKey(item) !== topicKey(topic)));
  const removeAuthor = (id: string) => setTopics(current => current.filter(item => item.authorId !== id));
  const loadMore = () => {
    if (loading || pagingLock.current || !hasMore) return;
    pagingLock.current = true;
    setOffset(value => value + 20);
  };

  return { topics, criteria, search, setSearch, loading, hasMore, listError, refresh, changeCriteria, reset,
    updateTopic, created, remove, removeAuthor, loadMore };
}
