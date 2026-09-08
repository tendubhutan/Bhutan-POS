import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, Check } from 'lucide-react';

export function parseSmartDate(inputStr: string): string | null {
  if (!inputStr) return null;
  const trimmed = inputStr.trim();
  const currentYear = new Date().getFullYear();

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle formats like "08-Aug-2026" or "8-Aug-2026"
  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const namedMatch = trimmed.match(/^(\d{1,2})[-/\s]+([a-zA-Z]{3,})[-/\s]*(\d{2,4})?$/);
  if (namedMatch) {
    const d = parseInt(namedMatch[1], 10);
    const mStr = namedMatch[2].toLowerCase().substring(0, 3);
    const m = monthNames[mStr];
    let y = namedMatch[3] ? parseInt(namedMatch[3], 10) : currentYear;
    if (y < 100) y += 2000;
    if (m && d >= 1 && d <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  // Replace dots, slashes, dashes, spaces with /
  const clean = trimmed.replace(/[.\-\s/]+/g, '/');
  const parts = clean.split('/').filter(Boolean);

  let day: number | null = null;
  let month: number | null = null;
  let year: number = currentYear;

  if (parts.length === 1) {
    // e.g. "0808" -> 08 Aug
    if (/^\d{4}$/.test(parts[0])) {
      day = parseInt(parts[0].substring(0, 2), 10);
      month = parseInt(parts[0].substring(2, 4), 10);
    } else if (/^\d{1,2}$/.test(parts[0])) {
      day = parseInt(parts[0], 10);
      month = new Date().getMonth() + 1;
    }
  } else if (parts.length === 2) {
    // "8/8", "8.8", "8-8", "8 8" -> 8th Aug
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (parts.length >= 3) {
    // "8/8/25" or "8.8.2025"
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) {
      y = y + 2000;
    }
    year = y;
  }

  if (day !== null && month !== null && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return null;
}

export function formatDisplayDate(isoStr: string): string {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || 'Jan';
  return `${String(d).padStart(2, '0')}-${monthName}-${y}`;
}

export interface ChangePeriodModalProps {
  isOpen: boolean;
  fromDate: string;
  toDate: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
  title?: string;
}

export const ChangePeriodModal: React.FC<ChangePeriodModalProps> = ({
  isOpen,
  fromDate,
  toDate,
  onApply,
  onClose,
  title = 'Change Period'
}) => {
  const [tempFromDate, setTempFromDate] = useState(fromDate);
  const [tempToDate, setTempToDate] = useState(toDate);
  const [fromInputText, setFromInputText] = useState(() => formatDisplayDate(fromDate));
  const [toInputText, setToInputText] = useState(() => formatDisplayDate(toDate));

  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTempFromDate(fromDate);
      setTempToDate(toDate);
      setFromInputText(formatDisplayDate(fromDate));
      setToInputText(formatDisplayDate(toDate));

      setTimeout(() => {
        fromInputRef.current?.focus();
        fromInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, fromDate, toDate]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_fy') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let f = toIso(now);
    let t = toIso(now);

    if (preset === 'today') {
      f = toIso(now);
      t = toIso(now);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      f = toIso(y);
      t = toIso(y);
    } else if (preset === 'this_week') {
      const curr = new Date();
      const firstDay = new Date(curr.setDate(curr.getDate() - curr.getDay() + 1));
      f = toIso(firstDay);
      t = toIso(new Date());
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      f = toIso(firstDay);
      t = toIso(lastDay);
    } else if (preset === 'last_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      f = toIso(firstDay);
      t = toIso(lastDay);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), qMonth, 1);
      const lastDay = new Date(now.getFullYear(), qMonth + 3, 0);
      f = toIso(firstDay);
      t = toIso(lastDay);
    } else if (preset === 'this_fy') {
      // Financial Year (FY) is January 1 to December 31
      const currentYear = now.getFullYear();
      f = `${currentYear}-01-01`;
      t = `${currentYear}-12-31`;
    }

    onApply(f, t);
    onClose();
  };

  const handleApply = () => {
    const pFrom = parseSmartDate(fromInputText) || tempFromDate;
    const pTo = parseSmartDate(toInputText) || tempToDate;
    if (pFrom && pTo) {
      onApply(pFrom, pTo);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-base">{title}</h3>
            <kbd className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">
              Alt+D / Alt+F2
            </kbd>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Preset Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              1-Click Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_quarter', label: 'This Quarter' },
                { id: 'this_fy', label: 'Financial Year (FY)' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id as any)}
                  className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Custom Date Inputs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Custom Period Dates
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Type e.g. <strong className="text-indigo-600 font-bold">8/8</strong> or <strong className="text-indigo-600 font-bold">8.8</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* From Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">From Date</label>
                  {(() => {
                    const parsed = parseSmartDate(fromInputText);
                    return parsed ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        ✓ {formatDisplayDate(parsed)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-medium">Type 8/8 or 8.8</span>
                    );
                  })()}
                </div>
                <div className="relative flex items-center">
                  <input
                    ref={fromInputRef}
                    type="text"
                    value={fromInputText}
                    onChange={(e) => setFromInputText(e.target.value)}
                    onBlur={() => {
                      const parsed = parseSmartDate(fromInputText);
                      if (parsed) {
                        setTempFromDate(parsed);
                        setFromInputText(formatDisplayDate(parsed));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        const parsed = parseSmartDate(fromInputText);
                        if (parsed) {
                          setTempFromDate(parsed);
                          setFromInputText(formatDisplayDate(parsed));
                        }
                        toInputRef.current?.focus();
                        toInputRef.current?.select();
                      }
                    }}
                    placeholder="e.g. 8/8, 8.8"
                    className="w-full h-10 rounded-xl border border-slate-300 pl-3 pr-8 font-bold text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <label className="absolute right-2 text-slate-400 hover:text-indigo-600 cursor-pointer p-1" title="Pick from Calendar">
                    <Calendar className="h-4 w-4" />
                    <input
                      type="date"
                      value={tempFromDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setTempFromDate(e.target.value);
                          setFromInputText(formatDisplayDate(e.target.value));
                        }
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* To Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">To Date</label>
                  {(() => {
                    const parsed = parseSmartDate(toInputText);
                    return parsed ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        ✓ {formatDisplayDate(parsed)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-medium">Type 15/8 or 15.8</span>
                    );
                  })()}
                </div>
                <div className="relative flex items-center">
                  <input
                    ref={toInputRef}
                    type="text"
                    value={toInputText}
                    onChange={(e) => setToInputText(e.target.value)}
                    onBlur={() => {
                      const parsed = parseSmartDate(toInputText);
                      if (parsed) {
                        setTempToDate(parsed);
                        setToInputText(formatDisplayDate(parsed));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleApply();
                      }
                    }}
                    placeholder="e.g. 15/8, 15.8"
                    className="w-full h-10 rounded-xl border border-slate-300 pl-3 pr-8 font-bold text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                  />
                  <label className="absolute right-2 text-slate-400 hover:text-indigo-600 cursor-pointer p-1" title="Pick from Calendar">
                    <Calendar className="h-4 w-4" />
                    <input
                      type="date"
                      value={tempToDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setTempToDate(e.target.value);
                          setToInputText(formatDisplayDate(e.target.value));
                        }
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 px-5 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Press <kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs text-slate-700">Enter</kbd> to Apply
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
            >
              Cancel (Esc)
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Period
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
