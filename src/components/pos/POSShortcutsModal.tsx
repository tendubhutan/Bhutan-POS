import React from 'react';
import { X, Keyboard, Zap, ArrowRight, CornerDownLeft } from 'lucide-react';

interface POSShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const POSShortcutsModal: React.FC<POSShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Fast Navigation & Focus',
      shortcuts: [
        { key: 'F3 or /', desc: 'Jump focus to Item Search bar' },
        { key: 'F4', desc: 'Jump focus to Customer Ledger selection' },
        { key: 'F7', desc: 'Open Walk-in Customer Details modal' },
        { key: 'Alt + C or ↓', desc: 'Jump from search directly into Cart rows' },
        { key: 'Alt + P', desc: 'Jump directly to Cash payment input' },
        { key: 'Alt + S', desc: 'Open POS Preferences & Workflow settings' },
        { key: 'Esc', desc: 'Close modals / Return focus to Item Search' }
      ]
    },
    {
      title: 'Cart Table & Inline Editing',
      shortcuts: [
        { key: '↑ / ↓', desc: 'Navigate between cart rows' },
        { key: '← / → / Tab', desc: 'Move between Qty, Rate, and Discount fields' },
        { key: '+ or =', desc: 'Increment quantity of selected item by +1' },
        { key: '-', desc: 'Decrement quantity of selected item by -1' },
        { key: 'Del', desc: 'Delete / remove highlighted item from cart' },
        { key: 'Enter / Esc', desc: 'Confirm edits and return focus to Search bar' }
      ]
    },
    {
      title: 'Billing & Transaction Actions',
      shortcuts: [
        { key: 'F2', desc: 'Fast Checkout, Save & Print Receipt' },
        { key: 'F8', desc: 'Hold current bill' },
        { key: 'F9', desc: 'Resume / recall latest held bill' },
        { key: 'F10', desc: 'Clear entire cart' },
        { key: 'F1', desc: 'Open this Shortcuts Guide' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">POS Keyboard Shortcuts Guide</h2>
              <p className="text-xs text-slate-500 font-medium">90%+ mouse-free keyboard power shortcuts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shortcut Categories */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {shortcutGroups.map((group, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <h3 className="font-bold text-slate-900 mb-2.5 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Zap className="h-3.5 w-3.5 text-indigo-600" />
                {group.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 hover:border-slate-300 transition"
                  >
                    <span className="text-slate-600 text-[11px] font-medium pr-2">{sc.desc}</span>
                    <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded shadow-2xs whitespace-nowrap">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
          <div className="text-[11px] text-slate-500 font-medium">
            Tip: Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold">F2</kbd> from any field to complete checkout.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-900 transition"
          >
            Got it (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
