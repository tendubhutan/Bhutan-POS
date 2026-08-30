import React, { useEffect, useState, useRef } from 'react';
import { VoucherType } from '../../types';
import { ShoppingBag, Tag, Check, ArrowRight, X, Sparkles, Receipt, Building2, CreditCard } from 'lucide-react';

interface SaleVoucherTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherTypes: VoucherType[];
  selectedVoucherTypeId?: string;
  onSelectVoucherType: (voucherType: VoucherType) => void;
}

export const SaleVoucherTypeModal: React.FC<SaleVoucherTypeModalProps> = ({
  isOpen,
  onClose,
  voucherTypes,
  selectedVoucherTypeId,
  onSelectVoucherType
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Focus on default or currently selected or first item
      const initialIdx = voucherTypes.findIndex(v => v.id === selectedVoucherTypeId);
      setFocusedIndex(initialIdx >= 0 ? initialIdx : 0);
      setTimeout(() => {
        cardRefs.current[initialIdx >= 0 ? initialIdx : 0]?.focus();
      }, 50);
    }
  }, [isOpen, selectedVoucherTypeId, voucherTypes]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Quick numeric selection (1, 2, 3, 4, etc.)
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= voucherTypes.length) {
        e.preventDefault();
        onSelectVoucherType(voucherTypes[num - 1]);
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = (prev + 1) % voucherTypes.length;
          cardRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = (prev - 1 + voucherTypes.length) % voucherTypes.length;
          cardRefs.current[next]?.focus();
          return next;
        });
      } else if (e.key === 'Enter') {
        if (voucherTypes[focusedIndex]) {
          e.preventDefault();
          onSelectVoucherType(voucherTypes[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, voucherTypes, onSelectVoucherType, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Select Sale / POS Voucher Type</h2>
              <p className="text-xs text-slate-500 font-medium">
                Choose the sales series to initialize billing & numbering
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
            title="Cancel (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Voucher Type Cards List */}
        <div className="space-y-2.5 overflow-y-auto max-h-[60vh] pr-1">
          {voucherTypes.map((vt, idx) => {
            const isSelected = vt.id === selectedVoucherTypeId;
            const isFocused = idx === focusedIndex;

            return (
              <button
                key={vt.id}
                ref={el => (cardRefs.current[idx] = el)}
                type="button"
                onClick={() => onSelectVoucherType(vt)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group outline-none ${
                  isFocused
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-200 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Number Badge */}
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                    isFocused ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}>
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-950">
                        {vt.name}
                      </span>
                      {vt.isDefault && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                          Default
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Current
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                      <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                        Prefix: {vt.prefix || 'INV-'}
                      </span>
                      {vt.description && (
                        <span className="truncate max-w-[220px] text-slate-500">
                          {vt.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className={`p-2 rounded-lg transition ${
                    isFocused ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50'
                  }`}>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer info & shortcut hint */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 font-medium">
            <span>Press <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold">1</kbd>–<kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold">{voucherTypes.length}</kbd> or <kbd className="font-mono bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold">Enter</kbd> to select</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
