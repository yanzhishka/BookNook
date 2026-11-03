
import { createPortal } from 'react-dom';
import React from 'react';
import { LogIn, X } from 'lucide-react';
import { useDialog } from '../utils/useDialog';

interface LoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  description?: string;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ isOpen, onClose, onLogin, description }) => {
  const ref = useDialog<HTMLDivElement>(onClose, false, false, isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" aria-describedby="login-prompt-message" className="bg-white dark:bg-stone-900 w-full max-h-[calc(100dvh-2rem)] overflow-y-auto max-w-md p-8 rounded-2xl shadow-2xl relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800">
        <button 
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
        >
          <X size={20} />
        </button>
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
            <LogIn size={32} />
          </div>
          <h3 id="login-prompt-title" className="text-2xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-2">
            Присоединяйтесь к сообществу
          </h3>
          <p id="login-prompt-message" className="text-stone-500 dark:text-stone-400">
            {description || 'Войдите в B.Nook, чтобы создавать темы, ставить лайки, отвечать и собирать свою библиотеку.'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-200 dark:border-stone-700 font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Позже
          </button>
          <button
            onClick={onLogin}
            className="flex-1 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold hover:opacity-90 transition-opacity shadow-lg"
          >
            Войти / Регистрация
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
