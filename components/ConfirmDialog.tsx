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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="bg-white dark:bg-stone-900 w-full max-w-sm p-6 rounded-2xl shadow-2xl relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800 transform transition-all">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-5 text-red-500 animate-shake shadow-inner">
          <AlertTriangle size={28} />
        </div>
        
        <h3 className="text-xl font-serif font-bold text-stone-800 dark:text-stone-100 text-center mb-2">
          {title}
        </h3>
        
        <p className="text-stone-500 dark:text-stone-400 text-center text-sm mb-8 leading-relaxed">
          {message}
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 py-3 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg hover:shadow-red-500/20 active:scale-95 text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};