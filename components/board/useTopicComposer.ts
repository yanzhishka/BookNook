import { useEffect, useRef, useState } from 'react';
import type { CommunityKind, CommunityTopic } from '../../types';
import type { community } from '../../services/community';
import { errorText } from './errors';

export function useTopicComposer(api: typeof community, userId: string, onCreated: (topic: CommunityTopic) => void) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newKind, setNewKind] = useState<CommunityKind>('discussion');
  const [newBookId, setNewBookId] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const createLock = useRef(false);
  const draftId = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const create = async () => {
    if (createLock.current || !newTitle.trim() || !newContent.trim()) return;
    createLock.current = true; setIsCreating(true); setCreateError('');
    try {
      const topic = await api.create({ id: draftId.current || (draftId.current = crypto.randomUUID()), title: newTitle,
        content: newContent, kind: newKind, bookId: newBookId || null, imageUrl: newImage }, userId);
      if (!alive.current) return;
      setShowCreate(false); setNewTitle(''); setNewContent(''); setNewImage(null); setNewBookId(''); setNewKind('discussion'); draftId.current = null;
      onCreated(topic);
    } catch (error) {
      if (alive.current) setCreateError(errorText(error, 'Не удалось опубликовать тему. Черновик сохранён в форме — попробуйте ещё раз.'));
    } finally { createLock.current = false; if (alive.current) setIsCreating(false); }
  };
  return { showCreate, setShowCreate, newTitle, setNewTitle, newContent, setNewContent, newKind, setNewKind,
    newBookId, setNewBookId, newImage, setNewImage, createError, setCreateError, isCreating, createLock, create };
}
