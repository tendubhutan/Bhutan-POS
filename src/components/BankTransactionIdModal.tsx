import React, { useState, useEffect, useRef } from 'react';
import { Building, X, CheckCircle2, ArrowRight } from 'lucide-react';

interface BankTransactionIdModalProps {
  isOpen: boolean;
  bankLedgerName: string;
  initialValue?: string;
  onSave: (transactionId: string) => void;
  onClose: () => void;
  title?: string;
}

export const BankTransactionIdModal: React.FC<BankTransactionIdModalProps> = ({
  isOpen,
  bankLedgerName,
  initialValue = '',
  onSave,
  onClose,
  title = 'Bank Reference / Transaction ID'
}) => {
  const [txnId, setTxnId] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTxnId(initialValue || '');
      // Focus input on open
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(txnId.trim());
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const quickPresets = ['mBOB UTR', 'BNB UTR', 'BDBL Ref', 'T-Bank Ref', 'Cheque #'];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-indigo-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-wide text-white">{title}</h3>
              <p className="text-[11px] text-indigo-200 font-medium truncate max-w-[260px]">
                Bank Ledger: <span className="font-bold text-amber-300">{bankLedgerName || 'Bank Account'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-950 flex items-start gap-2.5">
            <Building className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-bold">Bank Ledger Selected: </span>
              <span className="font-extrabold text-indigo-900">{bankLedgerName || 'Bank Account'}</span>.
              <p className="text-[11px] text-slate-600 mt-0.5">
                Please enter the UTR Number, Cheque No, or Online Bank Reference ID for bank reconciliation.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
              Transaction ID / UTR / Cheque No <span className="text-rose-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={txnId}
              onChange={e => setTxnId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. UTR1294827103 or Cheque #002341"
              className="w-full h-11 px-3.5 rounded-xl border-2 border-indigo-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 font-mono text-sm font-bold text-slate-900 outline-none bg-white shadow-xs transition-all"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Quick Prefix Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTxnId(prev => prev ? `${preset} ${prev}` : `${preset} `);
                    inputRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Skip / Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Save Transaction ID</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
