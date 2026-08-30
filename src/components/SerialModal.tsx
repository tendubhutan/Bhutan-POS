import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface SerialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (serials: string[]) => void;
  requiredQty: number;
  itemName: string;
  initialSerials?: string[];
  mode?: 'input' | 'select';
  availableSerials?: string[];
}

export const SerialModal: React.FC<SerialModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  requiredQty,
  itemName,
  initialSerials = [],
  mode = 'input',
  availableSerials = []
}) => {
  const [serials, setSerials] = useState<string[]>([]);
  const inputRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      const arr = Array.from({ length: requiredQty }, (_, i) => initialSerials[i] || '');
      setSerials(arr);
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0]?.focus();
      }, 100);

      const handleGlobalKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', handleGlobalKey);
      return () => window.removeEventListener('keydown', handleGlobalKey);
    }
  }, [isOpen, requiredQty, initialSerials, onClose]);

  if (!isOpen) return null;

  const handleChange = (index: number, val: string) => {
    const updated = [...serials];
    updated[index] = val;
    setSerials(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index + 1 < requiredQty) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // Auto confirm on last entry
        handleSave();
      }
    }
  };

  const handleSave = () => {
    const valid = serials.map(s => s.trim()).filter(s => s !== '');
    onConfirm(valid);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-slate-800 text-center mb-1">
          {mode === 'select' ? 'Select Serial Numbers' : 'Enter Serial Numbers'}
        </h3>
        <p className="text-xs text-slate-500 text-center mb-4">
          <span className="font-semibold text-amber-600">{requiredQty}</span> serials required for <b className="text-slate-800">{itemName}</b>
        </p>

        <div className="max-h-[50vh] overflow-y-auto space-y-2.5 pr-1 mb-6">
          {Array.from({ length: requiredQty }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 text-xs font-semibold text-slate-400 text-right">{idx + 1}.</span>
              {mode === 'input' ? (
                <input
                  ref={el => (inputRefs.current[idx] = el as HTMLInputElement)}
                  type="text"
                  placeholder={`Serial #${idx + 1}`}
                  value={serials[idx] || ''}
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              ) : (
                <select
                  ref={el => (inputRefs.current[idx] = el as HTMLSelectElement)}
                  value={serials[idx] || ''}
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
                >
                  <option value="">Select Serial...</option>
                  {availableSerials.map(s => (
                    <option key={s} value={s} disabled={serials.includes(s) && serials[idx] !== s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition"
          >
            <Check className="h-4 w-4" />
            Confirm Serials
          </button>
        </div>
      </div>
    </div>
  );
};
