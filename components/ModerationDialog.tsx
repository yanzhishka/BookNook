import React, { useEffect, useState } from 'react';
import { Ban, CheckCircle, Flag, Loader2, X } from 'lucide-react';
import { db } from '../services/db';
import { ModerationTarget, ReportReason, User } from '../types';

interface ModerationDialogProps {
  currentUser: User;
  target: ModerationTarget | null;
  onBlocked: (userId: string) => void;
  onClose: () => void;
}

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Спам или реклама' },
  { value: 'harassment', label: 'Оскорбления или травля' },
  { value: 'hate', label: 'Ненависть или дискриминация' },
  { value: 'sexual', label: 'Материалы сексуального характера' },
  { value: 'violence', label: 'Насилие или опасные действия' },
  { value: 'child_safety', label: 'Угроза безопасности ребёнка' },
  { value: 'other', label: 'Другое нарушение' },
];

export const ModerationDialog: React.FC<ModerationDialogProps> = ({
  currentUser,
  target,
  onBlocked,
  onClose,
}) => {
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReason('spam');
    setDetails('');
    setMessage(null);
    setError(null);
  }, [target]);

  if (!target) return null;

  const handleReport = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await db.reportContent(
        currentUser.id,
        target.userId,
        target.contentType,
        target.contentId,
        reason,
        details,
      );
      setMessage('Жалоба отправлена на проверку');
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Не удалось отправить жалобу');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async () => {
    setIsBlocking(true);
    setError(null);
    try {
      await db.blockUser(currentUser.id, target.userId);
      onBlocked(target.userId);
      onClose();
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : 'Не удалось заблокировать пользователя');
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="moderation-title" className="relative z-10 w-full max-w-md rounded-[2.5rem] bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"><X size={20} /></button>
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center mb-5"><Flag size={26} /></div>
        <h3 id="moderation-title" className="text-2xl font-serif font-black text-stone-900 dark:text-stone-100 mb-1">Пожаловаться</h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
          {target.contentType === 'user' ? 'Профиль пользователя' : 'Материал пользователя'} {target.userName}
        </p>

        {message ? (
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 p-4 flex items-center gap-3 text-sm mb-5"><CheckCircle size={20} />{message}</div>
        ) : (
          <>
            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-2">Причина</label>
            <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} className="w-full rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 px-4 py-3 text-sm text-stone-800 dark:text-stone-100 mb-4">
              {REPORT_REASONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} placeholder="Дополнительные сведения (необязательно)" className="w-full h-24 resize-none rounded-2xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 px-4 py-3 text-sm text-stone-800 dark:text-stone-100 mb-4" />
            <button type="button" onClick={handleReport} disabled={isSubmitting} className="w-full rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-3.5 font-black text-[10px] uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2">
              {isSubmitting && <Loader2 size={15} className="animate-spin" />} Отправить жалобу
            </button>
          </>
        )}

        {error && <p role="alert" className="mt-4 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button type="button" onClick={handleBlock} disabled={isBlocking} className="w-full mt-4 rounded-2xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 py-3.5 font-black text-[10px] uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2">
          {isBlocking ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Заблокировать {target.userName}
        </button>
      </section>
    </div>
  );
};
