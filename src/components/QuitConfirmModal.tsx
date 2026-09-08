import React, { useState, useEffect } from 'react';
import { LogOut, ArrowLeft, X } from 'lucide-react';
import { playPromptSound } from '../utils/audio';

interface QuitConfirmModalProps {
  isOpen: boolean;
  viewName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function QuitConfirmModal({
  isOpen,
  viewName,
  onConfirm,
  onCancel
}: QuitConfirmModalProps) {
  const [selectedOption, setSelectedOption] = useState<'yes' | 'no'>('yes');

  useEffect(() => {
    if (!isOpen) return;

    // Subtle audio cue
    playPromptSound();

    // Default selection to 'yes'
    setSelectedOption('yes');

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent other background key handlers while quit dialog is active
      e.stopPropagation();

      const key = e.key.toLowerCase();

      if (key === 'y') {
        e.preventDefault();
        onConfirm();
      } else if (key === 'n' || e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedOption('yes');
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        setSelectedOption(prev => (prev === 'yes' ? 'no' : 'yes'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedOption === 'yes') {
          onConfirm();
        } else {
          onCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedOption, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      id="quit-confirm-backdrop"
      className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        id="quit-confirm-dialog"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-5 flex flex-col items-center text-center animate-in zoom-in-95 duration-150 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Top Gradient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-red-500" />

        {/* Top-right subtle close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Stay & Keep Editing (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Compact Icon Badge */}
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3 shadow-inner">
          <LogOut className="w-5 h-5 ml-0.5 stroke-[2.2]" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
          Do you want to quit?
        </h3>

        {/* Concise Description */}
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 max-w-[290px] leading-relaxed">
          Exit <span className="font-semibold text-slate-800 dark:text-slate-200">{viewName}</span>? Any unsaved changes will be discarded.
        </p>

        {/* Action Buttons - Beautifully styled matching Save buttons */}
        <div className="flex items-center justify-center gap-2.5 w-full">
          <button
            id="quit-confirm-no-btn"
            type="button"
            onClick={onCancel}
            onMouseEnter={() => setSelectedOption('no')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
              selectedOption === 'no'
                ? 'bg-slate-200/90 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-sm ring-2 ring-slate-400/30'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60'
            }`}
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>No, Stay</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-slate-200 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
              Esc
            </kbd>
          </button>

          <button
            id="quit-confirm-yes-btn"
            type="button"
            onClick={onConfirm}
            onMouseEnter={() => setSelectedOption('yes')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 ${
              selectedOption === 'yes'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/30 ring-2 ring-rose-500/40'
                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/20'
            }`}
          >
            <LogOut className="w-4 h-4 stroke-[2.2]" />
            <span>Yes, Quit</span>
            <kbd className="hidden sm:inline-block text-[10px] bg-white/25 text-white px-1.5 py-0.5 rounded font-mono">
              Y
            </kbd>
          </button>
        </div>

        {/* Keyboard shortcut legend */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 w-full text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
          <span>Press <strong className="font-semibold text-slate-700 dark:text-slate-300">Y</strong> or <strong className="font-semibold text-slate-700 dark:text-slate-300">↵</strong> to quit</span>
          <span>•</span>
          <span><strong className="font-semibold text-slate-700 dark:text-slate-300">Esc</strong> to stay</span>
        </div>
      </div>
    </div>
  );
}

