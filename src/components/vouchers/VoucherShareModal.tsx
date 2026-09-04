import React, { useState } from 'react';
import {
  X,
  Share2,
  Printer,
  Download,
  Copy,
  Check,
  Phone,
  Send,
  MessageSquare,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { Config } from '../../types';
import { generateVoucherSlipPDF, shareOrDownloadPDF } from '../../utils/pdfExport';

export interface VoucherShareData {
  voucherNo: string;
  type?: string;
  voucherTypeName?: string;
  date?: string;
  partyName?: string;
  debitLedger?: string;
  creditLedger?: string;
  amount?: number;
  totalAmount?: number;
  narration?: string;
  lines?: Array<{
    type: 'Dr' | 'Cr';
    ledger: string;
    amount: number;
    narration?: string;
  }>;
  status?: string;
}

interface VoucherShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: VoucherShareData | null;
  config: Config;
  onPrint?: () => void;
}

export const VoucherShareModal: React.FC<VoucherShareModalProps> = ({
  isOpen,
  onClose,
  voucher,
  config,
  onPrint
}) => {
  const [customPhone, setCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  if (!isOpen || !voucher) return null;

  const currency = config?.CurrencySymbol || 'Nu.';
  const val = Number(voucher.totalAmount !== undefined ? voucher.totalAmount : voucher.amount || 0);

  const getTypeName = (t?: string, name?: string) => {
    if (name) return name;
    if (t === 'P') return 'Payment Voucher';
    if (t === 'R') return 'Receipt Voucher';
    if (t === 'J') return 'Journal Voucher';
    if (t === 'C') return 'Contra Voucher';
    if (t === 'CN') return 'Credit Note';
    if (t === 'DN') return 'Debit Note';
    if (t === 'DEL_NOTE') return 'Delivery Note';
    if (t === 'QUOTATION') return 'Quotation';
    if (t === 'PHYSICAL_STOCK') return 'Physical Stock Voucher';
    return 'Accounting Voucher';
  };

  const typeLabel = getTypeName(voucher.type, voucher.voucherTypeName);
  const companyName = config?.CompanyName || 'Accounting';
  const formattedDate = voucher.date ? new Date(voucher.date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

  // Build a clean, formatted text summary for WhatsApp and copying
  const generateTextSummary = () => {
    let text = `*${companyName.toUpperCase()}*\n`;
    text += `*${typeLabel.toUpperCase()}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📄 *Voucher No:* ${voucher.voucherNo}\n`;
    text += `📅 *Date:* ${formattedDate}\n`;
    if (voucher.partyName) {
      text += `👤 *Party / Account:* ${voucher.partyName}\n`;
    }
    if (voucher.lines && voucher.lines.length > 0) {
      text += `\n*Entries Breakdown:*\n`;
      voucher.lines.forEach(l => {
        text += ` • [${l.type}] ${l.ledger}: ${currency} ${Number(l.amount).toFixed(2)}\n`;
      });
    } else if (voucher.debitLedger || voucher.creditLedger) {
      text += ` • [Dr] ${voucher.debitLedger || '-'}: ${currency} ${val.toFixed(2)}\n`;
      text += ` • [Cr] ${voucher.creditLedger || '-'}: ${currency} ${val.toFixed(2)}\n`;
    }
    text += `\n💰 *Total Amount:* ${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    if (voucher.narration) {
      text += `📝 *Narration:* ${voucher.narration}\n`;
    }
    if (voucher.status === 'Cancelled') {
      text += `⚠️ *Status:* CANCELLED / VOID\n`;
    } else {
      text += `✅ *Status:* Recorded & Verified\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    if (false) {
      text += `📞 Contact: ${""}\n`;
    }
    return text;
  };

  const handleCopyText = () => {
    const text = generateTextSummary();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = generateTextSummary();
    const cleanPhone = customPhone.replace(/[^0-9]/g, '');
    let url = '';
    if (cleanPhone) {
      url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    }
    window.open(url, '_blank');
  };

  const handleNativeSharePDF = async () => {
    setShareLoading(true);
    try {
      const doc = generateVoucherSlipPDF(voucher, config);
      shareOrDownloadPDF(
        doc,
        `Voucher_${voucher.voucherNo}.pdf`,
        `${typeLabel} - ${voucher.voucherNo}`
      );
    } catch (e) {
      console.error('Share failed', e);
    } finally {
      setShareLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = generateVoucherSlipPDF(voucher, config);
    doc.save(`Voucher_${voucher.voucherNo}.pdf`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide">Share &amp; Export Voucher</h3>
              <p className="text-xs text-indigo-100 font-medium">
                {typeLabel} • <span className="font-mono">{voucher.voucherNo}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Snapshot preview */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Voucher Details</span>
                <p className="font-extrabold text-sm text-slate-900">{companyName}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Total Value</span>
                <p className="font-black text-base text-indigo-700">
                  {currency} {val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="font-semibold text-slate-400">Date: </span>
                <strong className="text-slate-800">{formattedDate}</strong>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Status: </span>
                <strong className={voucher.status === 'Cancelled' ? 'text-rose-600' : 'text-emerald-700'}>
                  {voucher.status === 'Cancelled' ? 'CANCELLED' : 'Active'}
                </strong>
              </div>
            </div>

            {voucher.narration && (
              <div className="text-slate-600 truncate">
                <span className="font-semibold text-slate-400">Narration: </span>
                <span className="italic text-slate-800">{voucher.narration}</span>
              </div>
            )}
          </div>

          {/* WhatsApp Direct Share Section */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Share Directly via WhatsApp</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="Recipient WhatsApp number (optional, with country code)"
                  value={customPhone || ''}
                  onChange={e => setCustomPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Quick Sharing & Export Options Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Native Share PDF */}
            <button
              type="button"
              disabled={shareLoading}
              onClick={handleNativeSharePDF}
              className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Share2 className="w-5 h-5 text-indigo-600" />
              <span>Share PDF</span>
              <span className="text-[10px] font-normal text-indigo-600">Mobile / App</span>
            </button>

            {/* Print Slip */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onPrint) onPrint();
                else {
                  window.print();
                }
              }}
              className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Printer className="w-5 h-5 text-slate-700" />
              <span>Print Slip</span>
              <span className="text-[10px] font-normal text-slate-500">A4 / A5 Slip</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <Download className="w-5 h-5 text-slate-700" />
              <span>Save PDF</span>
              <span className="text-[10px] font-normal text-slate-500">PDF File</span>
            </button>

            {/* Copy Summary */}
            <button
              type="button"
              onClick={handleCopyText}
              className={`p-3 rounded-2xl border font-extrabold text-xs flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs ${
                copied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>Copied!</span>
                  <span className="text-[10px] font-normal text-emerald-600">To Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 text-slate-700" />
                  <span>Copy Text</span>
                  <span className="text-[10px] font-normal text-slate-500">Summary</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Close */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
