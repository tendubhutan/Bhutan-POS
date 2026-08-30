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
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { Config } from '../../types';
import { generateVoucherRegisterPDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface RegisterShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  vouchers: any[];
  config: Config;
  filters: {
    startDate?: string;
    endDate?: string;
    vType?: string;
    status?: string;
    ledger?: string;
    searchTerm?: string;
  };
  totalAmount: number;
  onPrint?: () => void;
  onExportExcel?: () => void;
}

export const RegisterShareModal: React.FC<RegisterShareModalProps> = ({
  isOpen,
  onClose,
  vouchers,
  config,
  filters,
  totalAmount,
  onPrint,
  onExportExcel
}) => {
  const [customPhone, setCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  if (!isOpen) return null;

  const currency = config?.CurrencySymbol || 'Nu.';
  const companyName = config?.CompanyName || 'Retail Business';
  const activeCount = vouchers.filter(v => v.status !== 'Cancelled').length;
  const cancelledCount = vouchers.filter(v => v.status === 'Cancelled').length;

  const periodStr =
    filters.startDate || filters.endDate
      ? `${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`
      : 'All Recorded Transactions';

  // Build clean text summary for WhatsApp and copying
  const generateTextSummary = () => {
    let text = `*${companyName.toUpperCase()}*\n`;
    text += `*ACCOUNTING VOUCHER REGISTER REPORT*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📅 *Period:* ${periodStr}\n`;
    if (filters.vType && filters.vType !== 'ALL') {
      text += `🏷️ *Voucher Type:* ${filters.vType}\n`;
    }
    if (filters.status && filters.status !== 'ALL') {
      text += `🔘 *Status:* ${filters.status}\n`;
    }
    if (filters.ledger) {
      text += `👤 *Ledger Filter:* ${filters.ledger}\n`;
    }
    text += `📊 *Total Vouchers:* ${vouchers.length} (${activeCount} Active, ${cancelledCount} Void)\n`;
    text += `💰 *Total Register Amount:* ${currency} ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `*Recent Transactions Preview:*\n`;

    const previewList = vouchers.slice(0, 10);
    previewList.forEach((v, idx) => {
      const vDate = v.date ? new Date(v.date).toLocaleDateString('en-GB') : '-';
      const vNo = v.voucherNo || `REC-${idx + 1}`;
      const vType = v.type === 'P' ? 'Payment' : v.type === 'R' ? 'Receipt' : v.type === 'J' ? 'Journal' : v.type === 'C' ? 'Contra' : (v.type || '-');
      const party = v.lines ? `${v.lines.length} Line Split` : (v.debitLedger || v.partyLedger || '-');
      const amt = Number(v.totalAmount || v.amount || 0);
      const isVoid = v.status === 'Cancelled';
      text += `${idx + 1}. ${vDate} | ${vNo} (${vType}) - ${party} : ${currency} ${amt.toFixed(2)}${isVoid ? ' [VOID]' : ''}\n`;
    });

    if (vouchers.length > 10) {
      text += `... and ${vouchers.length - 10} more records in full report.\n`;
    }

    text += `\n_Generated from ${companyName} Accounting System on ${new Date().toLocaleString()}_`;
    return text;
  };

  const handleCopySummary = async () => {
    try {
      const text = generateTextSummary();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleWhatsAppShare = () => {
    const text = generateTextSummary();
    const encoded = encodeURIComponent(text);
    let url = '';
    const cleanPhone = customPhone.replace(/[^0-9]/g, '');
    if (cleanPhone) {
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encoded}`;
    }
    window.open(url, '_blank');
  };

  const handleSharePDF = async () => {
    try {
      setShareLoading(true);
      const doc = generateVoucherRegisterPDF(vouchers, config, filters);
      const filename = `Voucher_Register_${filters.startDate || 'All'}_${Date.now()}.pdf`;
      const title = `Voucher Register Report - ${companyName}`;
      await shareOrDownloadPDF(doc, filename, title, generateTextSummary());
    } catch (err) {
      console.error('Failed to share PDF', err);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-indigo-200">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Share Voucher Register</h3>
              <p className="text-xs text-indigo-200 font-medium">Export, WhatsApp summary, or share PDF report</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Summary Preview Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-700 text-xs">Register Period</span>
              <span className="font-mono font-bold text-slate-900">{periodStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Total Vouchers:</span>
              <span className="font-bold text-slate-900">
                {vouchers.length} <span className="text-slate-500 font-normal">({activeCount} Active, {cancelledCount} Void)</span>
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-700 font-bold text-xs">Total Amount:</span>
              <span className="font-black text-sm text-indigo-700 font-mono">
                {currency} {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* WhatsApp Direct Share Section */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <MessageSquare className="h-4 w-4" />
              <span>Share via WhatsApp</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Optional phone number (with country code)"
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 text-xs outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                Send WhatsApp
              </button>
            </div>
          </div>

          {/* Action Hub Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Copy Formatted Text */}
            <button
              type="button"
              onClick={handleCopySummary}
              className={`inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                copied
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-400'
              }`}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              {copied ? 'Summary Copied!' : 'Copy Summary Text'}
            </button>

            {/* Share / Download PDF */}
            <button
              type="button"
              onClick={handleSharePDF}
              disabled={shareLoading}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {shareLoading ? 'Generating...' : 'Share / Download PDF'}
            </button>

            {/* Print Register */}
            {onPrint && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPrint();
                }}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                <Printer className="h-4 w-4 text-slate-500" />
                Print Register (A4 Landscape)
              </button>
            )}

            {/* Export to Excel */}
            {onExportExcel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExportExcel();
                }}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export to Excel (.xlsx)
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Close (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};
