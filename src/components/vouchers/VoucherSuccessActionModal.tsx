import React, { useEffect, useRef } from 'react';
import { GlowButton } from '../common/GlowButton';
import {
  CheckCircle2,
  Printer,
  Share2,
  Download,
  Plus,
  ArrowRight,
  X,
  FileCheck,
  Calendar,
  User,
  DollarSign
} from 'lucide-react';

export interface VoucherSuccessDetails {
  voucherNo: string;
  voucherType: string;
  date?: string;
  partyName?: string;
  totalAmount?: number;
  totalItems?: number;
  currencySymbol?: string;
  onPrint?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onNewVoucher?: () => void;
}

interface VoucherSuccessActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: VoucherSuccessDetails | null;
}

export const VoucherSuccessActionModal: React.FC<VoucherSuccessActionModalProps> = ({
  isOpen,
  onClose,
  details
}) => {
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus Share button by default for quick keyboard access
    const timer = setTimeout(() => {
      shareBtnRef.current?.focus();
    }, 80);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      } else if (e.key.toLowerCase() === 'p' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+P -> Print
        if (details?.onPrint) {
          e.preventDefault();
          details.onPrint();
        }
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const buttons = Array.from(document.querySelectorAll('#voucher-success-dialog button:not([disabled])')) as HTMLButtonElement[];
        const currentIndex = buttons.findIndex(b => b === document.activeElement);
        if (currentIndex !== -1) {
          e.preventDefault();
          let nextIndex = currentIndex;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % buttons.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
          }
          buttons[nextIndex]?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, details]);

  if (!isOpen || !details) return null;

  const {
    voucherNo,
    voucherType,
    date,
    partyName,
    totalAmount,
    totalItems,
    currencySymbol = 'Nu.',
    onPrint,
    onShare,
    onDownload,
    onNewVoucher
  } = details;

  return (
    <div
      id="voucher-success-backdrop"
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="voucher-success-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transform scale-100 transition-all text-slate-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-wide flex items-center gap-1.5">
                <span>Voucher Saved Successfully</span>
              </h3>
              <p className="text-xs text-emerald-100 font-medium">{voucherType}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Summary Card */}
        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Document No</span>
                <p className="text-base font-extrabold text-slate-900 font-mono">{voucherNo}</p>
              </div>

              {totalAmount !== undefined && (
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Value</span>
                  <p className="text-base font-black text-emerald-700">
                    {currencySymbol} {Number(totalAmount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {date && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Date: <strong className="text-slate-800 font-semibold">{new Date(date).toLocaleDateString()}</strong></span>
                </div>
              )}

              {partyName && (
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">Party: <strong className="text-slate-800 font-semibold">{partyName}</strong></span>
                </div>
              )}

              {totalItems !== undefined && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileCheck className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Items: <strong className="text-slate-800 font-semibold">{totalItems} Line Items</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Core Action Grid: Print, Share, Download */}
          <div>
            <span className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
              Print or Share Options
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Share PDF Button */}
              {onShare && (
                <GlowButton
                  type="button"
                  onClick={onShare}
                  variant="purple"
                  size="md"
                  icon={Share2}
                  fullWidth
                >
                  Share PDF
                </GlowButton>
              )}

              {/* Print Slip Button */}
              {onPrint && (
                <GlowButton
                  type="button"
                  onClick={onPrint}
                  variant="blue"
                  size="md"
                  icon={Printer}
                  fullWidth
                >
                  Print Slip
                </GlowButton>
              )}

              {/* Download PDF Button */}
              {onDownload && (
                <GlowButton
                  type="button"
                  onClick={onDownload}
                  variant="cyan"
                  size="md"
                  icon={Download}
                  fullWidth
                >
                  Save PDF
                </GlowButton>
              )}
            </div>
          </div>

          {/* Footer Action: Next / Continue */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              Done / Close (Esc)
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNewVoucher) onNewVoucher();
              }}
              className="py-2.5 px-5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Another Voucher</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
