
import React from 'react';
import { LogIn, X } from 'lucide-react';

interface LoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-stone-900 w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
        >
          <X size={20} />
        </button>
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-400">
            <LogIn size={32} />
          </div>
          <h3 className="text-2xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-2">
            Join the Community
          </h3>
          <p className="text-stone-500 dark:text-stone-400">
            You need a B.Nook account to create posts, like, comment, and build your own library.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-stone-200 dark:border-stone-700 font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={onLogin}
            className="flex-1 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold hover:opacity-90 transition-opacity shadow-lg"
          >
            Log In / Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};
