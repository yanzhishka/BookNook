import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Annotation, Book, User } from '../../types';
import { db } from '../../services/db';
import type { useReaderProgress } from './useReaderProgress';

export const ANNOTATION_COLORS = [
  { name: 'amber', bg: 'bg-amber-200/50', hex: '#fde68a', text: 'text-amber-900' },
  { name: 'rose', bg: 'bg-rose-200/50', hex: '#fecdd3', text: 'text-rose-900' },
  { name: 'emerald', bg: 'bg-emerald-200/50', hex: '#a7f3d0', text: 'text-emerald-900' },
  { name: 'sky', bg: 'bg-sky-200/50', hex: '#bae6fd', text: 'text-sky-900' },
];

interface Options {
  book: Book;
  user: User;
  quote?: string;
  progress: ReturnType<typeof useReaderProgress>;
  onSaveAnnotation: (annotation: Annotation) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  onActivitySaved: () => Promise<void>;
  onSaved: () => void;
}

export function useReaderAnnotations({ book, user, quote, progress, onSaveAnnotation, onDeleteAnnotation, onActivitySaved, onSaved }: Options) {
  const [noteText, setNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  const draftId = useRef<string | null>(null);
  const timers = useRef(new Set<number>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; timers.current.forEach(window.clearTimeout); };
  }, []);

  const startNote = () => { draftId.current = null; progress.setSaveError(null); };
  const saveNote = async () => {
    if (!quote || !noteText.trim() || progress.savingRef.current) return;
    const annotation: Annotation = { id: draftId.current || (draftId.current = crypto.randomUUID()),
      quote, comment: noteText, color: selectedColor.name, timestamp: Date.now() };
    if (!await progress.runMutation(() => onSaveAnnotation(annotation))) return;
    draftId.current = null; setNoteText(''); onSaved();
  };
  const handleDeleteNote = (id: string) => progress.runMutation(() => onDeleteAnnotation(id));
  const handleShareNote = async (event: MouseEvent, annotation: Annotation) => {
    event.stopPropagation();
    if (progress.savingRef.current) return;
    setSharingId(annotation.id);
    const saved = await progress.runMutation(async () => { await db.shareAnnotation(user, book, annotation); });
    if (!alive.current) return;
    if (saved) {
      void onActivitySaved();
      setSharedIds(current => [...current, annotation.id]);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        setSharedIds(current => current.filter(id => id !== annotation.id));
      }, 3000);
      timers.current.add(timer);
    }
    setSharingId(null);
  };
  return { noteText, setNoteText, selectedColor, setSelectedColor, sharingId, sharedIds, startNote, saveNote, handleDeleteNote, handleShareNote };
}
