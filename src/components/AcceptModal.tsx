import React, { useEffect } from 'react';
import { playSaveSound, playPromptSound } from '../utils/audio';
import { Check, X, Save } from 'lucide-react';

interface AcceptModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
}

export const AcceptModal: React.FC<AcceptModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = "Save changes?"
}) => {
  useEffect(() => {
    if (isOpen) {
      playPromptSound();
      
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'y' || key === 'enter') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          playSaveSound();
          onConfirm();
        } else if (key === 'n' || key === 'escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          onCancel();
        }
      };
      
      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      };
    }
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    playSaveSound();
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150 p-4">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150 relative overflow-hidden"
      >
        {/* Decorative Top Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        {/* Icon Badge */}
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-inner">
          <Save className="w-7 h-7" />
        </div>

        {/* Modal Title */}
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5 leading-snug">
          {title}
        </h3>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Press Enter or click Yes to save entry
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700/60"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>No</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-slate-200 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded ml-1 font-mono">
              Esc
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleConfirmClick}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Yes, Save</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded ml-1 font-mono">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
