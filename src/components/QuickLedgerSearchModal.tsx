import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Ledger } from '../types';

interface QuickLedgerSearchModalProps {
  ledgers: Ledger[];
  onSelect: (ledgerName: string) => void;
  onClose: () => void;
}

export const QuickLedgerSearchModal: React.FC<QuickLedgerSearchModalProps> = ({ ledgers, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ledgers;
    return ledgers.filter(l => 
      (l['Ledger Name']?.toLowerCase() || '').includes(q) || 
      (l['Group']?.toLowerCase() || '').includes(q)
    ).slice(0, 50); // Limit to 50 for performance
  }, [ledgers, query]);

  useEffect(() => {
    setFocusedIdx(0);
  }, [query]);

  // Trap global Escape to close modal, preventing app navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative border-b border-slate-200 bg-slate-50/90 p-3 flex items-center gap-2">
          <Search className="h-5 w-5 text-indigo-600 ml-1.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIdx(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIdx(prev => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[focusedIdx]) {
                  onSelect(filtered[focusedIdx]['Ledger Name']!);
                }
              }
            }}
            placeholder="Type ledger name (e.g. Cash, Sales, Dorji Traders)..."
            className="w-full bg-transparent text-slate-900 font-bold text-base placeholder-slate-400 outline-none pr-8"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>Found <strong className="text-slate-900 font-bold">{filtered.length}</strong> ledger{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">↑↓</kbd> navigate</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">↵</kbd> select</span>
            <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">ESC</kbd> close</span>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[380px] p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm font-medium">
              No ledgers found matching "<span className="font-semibold text-slate-700">{query}</span>"
            </div>
          ) : (
            filtered.map((l, idx) => {
              const isSelected = idx === focusedIdx;
              const ledgerName = l['Ledger Name'] || '';
              const groupName = l['Group'] || l['Under Group'] || 'General Ledger';

              return (
                <div
                  key={ledgerName || idx}
                  onClick={() => onSelect(ledgerName)}
                  onMouseEnter={() => setFocusedIdx(idx)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-sm ${isSelected ? 'text-white font-black' : 'text-slate-900 font-bold'}`}>
                      {ledgerName}
                    </span>
                    <span className={`text-xs ${isSelected ? 'text-indigo-100 font-medium' : 'text-slate-500 font-medium'}`}>
                      {groupName}
                    </span>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg shrink-0 ${
                    isSelected ? 'bg-indigo-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    Select ↵
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
