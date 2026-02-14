
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="bg-white dark:bg-stone-900 w-full max-w-sm p-8 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800 transform transition-all">
        <div className="w-16 h-16 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 text-red-500 animate-shake shadow-inner">
          <AlertTriangle size={32} />
        </div>
        
        <h3 className="text-2xl font-serif font-black text-stone-800 dark:text-stone-100 text-center mb-2 tracking-tighter">
          {title}
        </h3>
        
        <p className="text-stone-500 dark:text-stone-400 text-center text-sm mb-8 leading-relaxed font-medium">
          {message}
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-4 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 font-black uppercase text-[10px] tracking-widest hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
          >
            Отмена
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};
