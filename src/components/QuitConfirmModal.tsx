import React, { useState, useEffect } from 'react';
import { LogOut, ArrowRight, X } from 'lucide-react';

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

    // Reset selection to 'yes' when modal opens
    setSelectedOption('yes');

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent other handlers while quit dialog is open
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
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        id="quit-confirm-dialog"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform scale-100 transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">Quit Confirmation</h3>
              <p className="text-[11px] text-slate-400">Exit to Main Menu?</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            title="Cancel & Stay (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 text-amber-600 border border-amber-200 mb-4 shadow-sm">
            <span className="text-2xl font-black">?</span>
          </div>

          <h4 className="text-lg font-black text-slate-900 mb-1">
            Do you want to quit?
          </h4>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            Exit <span className="font-bold text-slate-800 underline decoration-indigo-300">{viewName}</span> and return to the <span className="font-semibold text-slate-800">Main Menu (Dashboard)</span>?
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              id="quit-confirm-yes-btn"
              type="button"
              onClick={onConfirm}
              onMouseEnter={() => setSelectedOption('yes')}
              className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                selectedOption === 'yes'
                  ? 'bg-rose-600 text-white ring-4 ring-rose-100 shadow-md scale-[1.02]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>Yes, Quit</span>
              <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                selectedOption === 'yes' ? 'bg-rose-700 text-rose-100' : 'bg-slate-200 text-slate-600'
              }`}>
                Y / ↵
              </kbd>
            </button>

            <button
              id="quit-confirm-no-btn"
              type="button"
              onClick={onCancel}
              onMouseEnter={() => setSelectedOption('no')}
              className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                selectedOption === 'no'
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-md scale-[1.02]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>No, Stay</span>
              <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                selectedOption === 'no' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
              }`}>
                Esc / N
              </kbd>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-center gap-3">
            <span>Press <strong className="text-slate-800 font-bold">Y</strong> to Quit</span>
            <span>&bull;</span>
            <span>Press <strong className="text-slate-800 font-bold">Esc / N</strong> to Stay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
