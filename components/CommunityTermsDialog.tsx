import React from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';

interface CommunityTermsDialogProps {
  isAccepting: boolean;
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
}

export const CommunityTermsDialog: React.FC<CommunityTermsDialogProps> = ({
  isAccepting,
  isOpen,
  onAccept,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="community-terms-title" className="relative z-10 w-full max-w-lg rounded-[2.5rem] bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute top-5 right-5 p-2 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"><X size={20} /></button>
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center mb-5"><ShieldCheck size={28} /></div>
        <h3 id="community-terms-title" className="text-2xl font-serif font-black text-stone-900 dark:text-stone-100 mb-3">Правила книжного сообщества</h3>
        <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400 mb-5">
          Перед первой публикацией подтвердите, что будете общаться уважительно, не размещать незаконные, опасные или оскорбительные материалы и соблюдать правила B.Nook.
        </p>
        <div className="flex flex-wrap gap-4 text-xs mb-7">
          <a href="/terms.html" target="_blank" rel="noreferrer" className="font-bold text-amber-700 dark:text-amber-400 hover:underline">Условия использования</a>
          <a href="/community-guidelines.html" target="_blank" rel="noreferrer" className="font-bold text-amber-700 dark:text-amber-400 hover:underline">Правила сообщества</a>
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="font-bold text-amber-700 dark:text-amber-400 hover:underline">Конфиденциальность</a>
        </div>
        <button
          type="button"
          disabled={isAccepting}
          onClick={onAccept}
          className="w-full rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-4 font-black text-xs uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isAccepting && <Loader2 size={16} className="animate-spin" />}
          Принимаю правила
        </button>
      </section>
    </div>
  );
};
