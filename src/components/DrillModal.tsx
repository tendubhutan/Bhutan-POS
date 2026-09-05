import React, { useEffect, useState } from 'react';
import { GlowButton } from './common/GlowButton';
import {
  getItemStockLedger,
  getFullLedgerStatement,
  getVoucherDetails,
  getCategoryLedgerBreakdown,
  cancelVoucherByRef,
  deleteVoucherPermanentByRef,
  DEFAULT_CONFIG
} from '../services/storageService';
import { Config, StockLedgerEntry, LedgerLogEntry } from '../types';
import {
  X,
  ArrowLeft,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Download,
  Share2,
  Ban,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  FileText
} from 'lucide-react';
import {
  generateInvoicePDF,
  generatePurchaseBillPDF,
  generateCreditNotePDF,
  generateDebitNotePDF,
  generateDeliveryNotePDF,
  generateQuotationPDF,
  generatePhysicalStockPDF,
  generateVoucherSlipPDF,
  shareOrDownloadPDF,
  printPdfDoc
} from '../utils/pdfExport';
import { ThermalReceiptModal } from './ThermalReceiptModal';

interface DrillModalProps {
  type: 'group' | 'stock' | 'ledger' | 'voucher' | null;
  targetId: string | null;
  initialHistory?: TargetState[];
  config?: Config;
  fromDate?: string;
  toDate?: string;
  onClose: () => void;
  onRefresh?: () => void;
  onDrillVoucher?: (refNo: string) => void;
  onDrillLedger?: (name: string) => void;
  onDrillStock?: (code: string) => void;
  onOpenVoucherInEntry?: (refNo: string, vType?: string, currentActive?: TargetState, currentHistory?: TargetState[]) => void;
}

export interface TargetState {
  type: 'group' | 'stock' | 'ledger' | 'voucher';
  targetId: string;
}

export const DrillModal: React.FC<DrillModalProps> = ({
  type,
  targetId,
  initialHistory,
  config,
  fromDate,
  toDate,
  onClose,
  onRefresh,
  onDrillVoucher,
  onDrillLedger,
  onDrillStock,
  onOpenVoucherInEntry
}) => {
  const [active, setActive] = useState<TargetState | null>(null);
  const [history, setHistory] = useState<TargetState[]>([]);

  const [groupData, setGroupData] = useState<any>(null);
  const [stockLogs, setStockLogs] = useState<StockLedgerEntry[]>([]);
  const [ledgerLog, setLedgerLog] = useState<{ openingBalance: number; rows: LedgerLogEntry[] }>({ openingBalance: 0, rows: [] });
  const [voucherData, setVoucherData] = useState<any>(null);

  // Action Dialog States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingPermanent, setIsDeletingPermanent] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync with prop changes when modal opens or target changes from outside
  useEffect(() => {
    if (type && targetId) {
      setActive(prev => {
        if (prev && prev.type === type && prev.targetId === targetId) {
          return prev;
        }
        return { type, targetId };
      });

      if (initialHistory && initialHistory.length > 0) {
        setHistory(initialHistory);
      } else {
        // Only reset history if this is an entirely new modal opening from outside
        setHistory(prev => {
          if (active && active.type === type && active.targetId === targetId) {
            return prev;
          }
          return [];
        });
      }
      resetActionModals();
    } else {
      setActive(null);
      setHistory([]);
      resetActionModals();
    }
  }, [type, targetId, initialHistory]);

  const resetActionModals = () => {
    setShowCancelModal(false);
    setShowDeleteModal(false);
    setShowShareModal(false);
    setShowReceiptModal(false);
    setCancelReason('');
    setActionFeedback(null);
    setCopiedText(false);
  };

  // Load data whenever active state changes
  useEffect(() => {
    if (!active) return;
    resetActionModals();

    if (active.type === 'group') {
      const data = getCategoryLedgerBreakdown(active.targetId, fromDate, toDate);
      setGroupData(data);
    } else if (active.type === 'stock') {
      const data = getItemStockLedger(active.targetId);
      setStockLogs(data);
    } else if (active.type === 'ledger') {
      const data = getFullLedgerStatement(active.targetId);
      setLedgerLog(data);
    } else if (active.type === 'voucher') {
      const data = getVoucherDetails(active.targetId);
      setVoucherData(data);
    }
  }, [active, fromDate, toDate]);

  const handleBack = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setActive(previous);
    } else {
      onClose();
    }
  };

  // Listen to app:back event dispatched from Header or App.tsx
  useEffect(() => {
    if (!active || !active.type || !active.targetId) return;
    const handleAppBack = (e: CustomEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {
        resetActionModals();
        return;
      }
      handleBack();
    };

    window.addEventListener('app:back' as any, handleAppBack);
    return () => window.removeEventListener('app:back' as any, handleAppBack);
  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, onClose]);

  // Keyboard Escape Handler (Steps back drilled history, or closes modal) - runs in capture phase
  useEffect(() => {
    if (!active || !active.type || !active.targetId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {
          resetActionModals();
          return;
        }
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, onClose]);

  if (!active || !active.type || !active.targetId) return null;

  const navigateTo = (nextType: 'group' | 'stock' | 'ledger' | 'voucher', nextId: string) => {
    if (!nextId) return;
    setHistory(prev => [...prev, active]);
    setActive({ type: nextType, targetId: nextId });
  };

  const formatDateStr = (d: any) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString();
  };

  const formatDateTimeStr = (d: any) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleString();
  };

  const fmt = (v: any) => (Number(v) || 0).toFixed(2);

  // Helper to generate doc for current voucher
  const getDocForVoucher = (vData: any, cfg: Config) => {
    if (!vData || !vData.header) return null;
    const type = vData.type;
    const header = vData.header;
    if (type === 'INV' || type === 'S') {
      return {
        doc: generateInvoicePDF(header, cfg),
        filename: `Invoice_${header.invoiceNo || 'INV'}.pdf`,
        title: `Tax Invoice ${header.invoiceNo || ''}`
      };
    } else if (type === 'PUR') {
      return {
        doc: generatePurchaseBillPDF(header, cfg),
        filename: `PurchaseBill_${header.billNo || header.invoiceNo || 'PUR'}.pdf`,
        title: `Purchase Bill ${header.billNo || header.invoiceNo || ''}`
      };
    } else if (type === 'CN') {
      return {
        doc: generateCreditNotePDF(header, cfg),
        filename: `CreditNote_${header.voucherNo || 'CN'}.pdf`,
        title: `Credit Note ${header.voucherNo || ''}`
      };
    } else if (type === 'DN') {
      return {
        doc: generateDebitNotePDF(header, cfg),
        filename: `DebitNote_${header.voucherNo || 'DN'}.pdf`,
        title: `Debit Note ${header.voucherNo || ''}`
      };
    } else if (type === 'DLV') {
      return {
        doc: generateDeliveryNotePDF(header, cfg),
        filename: `DeliveryChallan_${header.noteNo || 'DLV'}.pdf`,
        title: `Delivery Challan ${header.noteNo || ''}`
      };
    } else if (type === 'QTN') {
      return {
        doc: generateQuotationPDF(header, cfg),
        filename: `Quotation_${header.quotationNo || 'QTN'}.pdf`,
        title: `Quotation ${header.quotationNo || ''}`
      };
    } else if (type === 'PHY') {
      return {
        doc: generatePhysicalStockPDF(header, cfg),
        filename: `StockAudit_${header.voucherNo || 'AUDIT'}.pdf`,
        title: `Physical Stock Audit ${header.voucherNo || ''}`
      };
    } else {
      return {
        doc: generateVoucherSlipPDF(header, cfg),
        filename: `Voucher_${header.voucherNo || 'VOUCHER'}.pdf`,
        title: `Voucher ${header.voucherNo || ''}`
      };
    }
  };

  const getEffectiveConfig = (): Config => {
    return config || DEFAULT_CONFIG;
  };

  // 1. Print handler
  const handlePrintVoucher = async () => {
    if (!voucherData) return;
    const cfg = getEffectiveConfig();
    const type = voucherData.type;

    if (type === 'INV' || type === 'S') {
      setShowReceiptModal(true);
      return;
    }

    const res = getDocForVoucher(voucherData, cfg);
    if (!res) return;

    printPdfDoc(res.doc);
  };

  // 2. Save PDF handler
  const handleSavePdf = () => {
    if (!voucherData) return;
    const cfg = getEffectiveConfig();
    const res = getDocForVoucher(voucherData, cfg);
    if (!res) return;
    res.doc.save(res.filename);
    setActionFeedback({ type: 'success', message: `Saved ${res.filename} to downloads.` });
  };

  // 3. Share Text Builder
  const buildShareSummaryText = (vData: any, cfg: Config) => {
    if (!vData || !vData.header) return '';
    const h = vData.header;
    const refNo = h.invoiceNo || h.billNo || h.voucherNo || h.noteNo || h.quotationNo || active.targetId;
    const party =
      h.party ||
      (typeof h.customer === 'object' ? h.customer?.name || h.customer?.ledger : h.customer) ||
      (typeof h.supplier === 'object' ? h.supplier?.name || h.supplier?.ledger : h.supplier) ||
      h.partyLedger ||
      'Customer / Account';
    const total = Number(h.total || h.amount || h.netPayable || 0).toFixed(2);
    const sym = cfg?.CurrencySymbol || 'Nu.';
    const typeLabel =
      vData.type === 'INV'
        ? 'Tax Invoice / Bill'
        : vData.type === 'PUR'
        ? 'Purchase Bill'
        : vData.type === 'CN'
        ? 'Credit Note'
        : vData.type === 'DN'
        ? 'Debit Note'
        : vData.type === 'DLV'
        ? 'Delivery Challan'
        : vData.type === 'QTN'
        ? 'Quotation'
        : 'Accounting Voucher';

    let text = `*${cfg?.CompanyName || 'BUSINESS'}*\n`;
    text += `📄 *${typeLabel}*\n`;
    text += `*Ref No:* ${refNo}\n`;
    text += `*Date:* ${new Date(h.date || Date.now()).toLocaleDateString()}\n`;
    text += `*Party:* ${party}\n`;
    text += `*Amount:* ${sym} ${total}\n`;
    if (h.status === 'Cancelled' || h.isCancelled) {
      text += `*Status:* ⛔ CANCELLED (VOID)\n`;
    }
    if (h.narration || h.remarks) {
      text += `*Remarks:* ${h.narration || h.remarks}\n`;
    }
    text += `\nThank you for doing business with us!`;
    return text;
  };

  // 4. WhatsApp Share
  const handleShareWhatsApp = () => {
    if (!voucherData) return;
    const cfg = getEffectiveConfig();
    const text = buildShareSummaryText(voucherData, cfg);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 5. Copy Text Share
  const handleCopyShareText = async () => {
    if (!voucherData) return;
    const cfg = getEffectiveConfig();
    const text = buildShareSummaryText(voucherData, cfg);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      // Fallback
    }
  };

  // 6. Native Web Share / Download PDF
  const handleNativeSharePdf = async () => {
    if (!voucherData) return;
    const cfg = getEffectiveConfig();
    const res = getDocForVoucher(voucherData, cfg);
    if (!res) return;
    const text = buildShareSummaryText(voucherData, cfg);
    await shareOrDownloadPDF(res.doc, res.filename, res.title, text);
  };

  // 7. Confirm Cancellation (Void)
  const handleConfirmCancel = () => {
    const refNo =
      voucherData?.header?.invoiceNo ||
      voucherData?.header?.billNo ||
      voucherData?.header?.voucherNo ||
      voucherData?.header?.noteNo ||
      voucherData?.header?.quotationNo ||
      active.targetId;

    setIsCancelling(true);
    try {
      const res = cancelVoucherByRef(refNo, cancelReason);
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: `Voucher ${refNo} has been Cancelled (Voided). All ledger and stock movements have been safely reversed.`
        });
        const updated = getVoucherDetails(refNo);
        if (updated) setVoucherData(updated);
        setShowCancelModal(false);
        setCancelReason('');
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { refNo } }));
        window.dispatchEvent(new CustomEvent('voucher:cancelled', { detail: { refNo } }));
      } else {
        setActionFeedback({ type: 'error', message: (res as any).error || 'Failed to cancel voucher' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Error occurred while cancelling voucher' });
    } finally {
      setIsCancelling(false);
    }
  };

  // 8. Confirm Permanent Deletion
  const handleConfirmDeletePermanent = () => {
    const refNo =
      voucherData?.header?.invoiceNo ||
      voucherData?.header?.billNo ||
      voucherData?.header?.voucherNo ||
      voucherData?.header?.noteNo ||
      voucherData?.header?.quotationNo ||
      active.targetId;

    setIsDeletingPermanent(true);
    try {
      const res = deleteVoucherPermanentByRef(refNo);
      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: `Voucher ${refNo} permanently deleted from database and ledger reversed.`
        });
        setShowDeleteModal(false);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('app:refresh-data', { detail: { refNo } }));
        window.dispatchEvent(new CustomEvent('voucher:deleted', { detail: { refNo } }));
        setTimeout(() => {
          if (history.length > 0) {
            handleBack();
          } else {
            onClose();
          }
        }, 1200);
      } else {
        setActionFeedback({ type: 'error', message: (res as any).error || 'Failed to delete voucher' });
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err?.message || 'Error occurred while deleting voucher' });
    } finally {
      setIsDeletingPermanent(false);
    }
  };

  return (
    <div data-drill-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150 relative">
        {/* Header with Back button and Close */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {active.type === 'group' && `Category Breakdown: ${active.targetId}`}
              {active.type === 'stock' && `Stock Ledger: ${active.targetId}`}
              {active.type === 'ledger' && `Ledger Statement: ${active.targetId}`}
              {active.type === 'voucher' && (
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  <span>Voucher Detailed View: {active.targetId}</span>
                </span>
              )}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {actionFeedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 shadow-xs ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* GROUP / CATEGORY BREAKDOWN */}
        {active.type === 'group' && groupData && (
          <div className="overflow-auto max-h-[65vh] text-xs space-y-2">
            {groupData.type === 'stock' ? (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Item Name</th>
                    <th className="py-2 px-3 text-left">Code</th>
                    <th className="py-2 px-3 text-right">Closing Stock</th>
                    <th className="py-2 px-3 text-right">Purchase Rate</th>
                    <th className="py-2 px-3 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!groupData.rows || groupData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                        No items found under this valuation
                      </td>
                    </tr>
                  ) : (
                    groupData.rows.map((r: any, idx: number) => (
                      <tr
                        key={idx}
                        onClick={() => navigateTo('stock', r.code)}
                        className="hover:bg-indigo-50/60 cursor-pointer transition"
                      >
                        <td className="py-2 px-3 font-semibold text-slate-800">{r.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{r.code}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">{r.stock}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{fmt(r.rate)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{fmt(r.valuation)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <th className="py-2 px-3 text-left">Ledger Account</th>
                    <th className="py-2 px-3 text-left">Group</th>
                    <th className="py-2 px-3 text-right">Balance / Net</th>
                    <th className="py-2 px-3 text-center">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!groupData.rows || groupData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                        No accounts found under this category
                      </td>
                    </tr>
                  ) : (
                    groupData.rows.map((r: any, idx: number) => (
                      <tr
                        key={idx}
                        onClick={() => navigateTo('ledger', r.name)}
                        className="hover:bg-indigo-50/60 cursor-pointer transition"
                      >
                        <td className="py-2 px-3 font-semibold text-slate-800">{r.name}</td>
                        <td className="py-2 px-3 text-slate-500">{r.group}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-900">{fmt(r.amount)}</td>
                        <td className="py-2 px-3 text-center font-bold text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded-full ${
                              r.type === 'Dr' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* STOCK LEDGER */}
        {active.type === 'stock' && (
          <div className="overflow-auto max-h-[65vh] text-xs">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Ref No</th>
                  <th className="py-2 px-3 text-right">Qty In</th>
                  <th className="py-2 px-3 text-right">Qty Out</th>
                  <th className="py-2 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No stock transactions found
                    </td>
                  </tr>
                ) : (
                  stockLogs.map((log, idx) => (
                    <tr
                      key={idx}
                      onClick={() => log['Ref No'] && navigateTo('voucher', log['Ref No'])}
                      className="hover:bg-indigo-50/60 cursor-pointer transition"
                    >
                      <td className="py-2 px-3 font-mono text-slate-500">{formatDateStr(log.DateIso)}</td>
                      <td className="py-2 px-3 font-medium">{log.Type}</td>
                      <td className="py-2 px-3 font-bold text-indigo-600">{log['Ref No']}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600">{log['Qty In'] || ''}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600">{log['Qty Out'] || ''}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{log.Balance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LEDGER STATEMENT */}
        {active.type === 'ledger' && (
          <div className="overflow-auto max-h-[65vh] text-xs">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Type</th>
                  <th className="py-2 px-3 text-left">Ref No</th>
                  <th className="py-2 px-3 text-left">Narration</th>
                  <th className="py-2 px-3 text-right">Debit</th>
                  <th className="py-2 px-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={4} className="py-2 px-3 text-left">
                    Opening Balance
                  </td>
                  <td colSpan={2} className="py-2 px-3 text-right font-mono">
                    {ledgerLog.openingBalance >= 0
                      ? `${fmt(ledgerLog.openingBalance)} Dr`
                      : `${fmt(Math.abs(ledgerLog.openingBalance))} Cr`}
                  </td>
                </tr>
                {ledgerLog.rows.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => row['Ref No'] && navigateTo('voucher', row['Ref No'])}
                    className="hover:bg-indigo-50/60 cursor-pointer transition"
                  >
                    <td className="py-2 px-3 font-mono text-slate-500">{formatDateStr(row.DateIso)}</td>
                    <td className="py-2 px-3 font-medium">{row.Type}</td>
                    <td className="py-2 px-3 font-bold text-indigo-600">{row['Ref No']}</td>
                    <td className="py-2 px-3 text-slate-600">{row.Narration}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-600">{row.Debit ? fmt(row.Debit) : ''}</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-600">{row.Credit ? fmt(row.Credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VOUCHER DETAILS WITH FULL ACTION SUITE */}
        {active.type === 'voucher' && voucherData && (() => {
          const refNo =
            voucherData.header?.invoiceNo ||
            voucherData.header?.billNo ||
            voucherData.header?.voucherNo ||
            voucherData.header?.noteNo ||
            voucherData.header?.quotationNo ||
            active.targetId;
          const isCancelled = voucherData.header?.status === 'Cancelled' || voucherData.header?.isCancelled;
          const currency = config?.CurrencySymbol || 'Nu.';

          const totalAmt = Number(voucherData.header?.total || voucherData.header?.amount || voucherData.header?.netPayable || 0);

          return (
            <div className="space-y-4 text-xs">
              {/* Header summary box */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isCancelled ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono font-black text-base ${
                          isCancelled ? 'line-through text-slate-400' : 'text-indigo-900'
                        }`}
                      >
                        {refNo}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase tracking-wide border border-indigo-200">
                        {voucherData.type === 'INV'
                          ? 'Sales Invoice / POS'
                          : voucherData.type === 'PUR'
                          ? 'Purchase Invoice'
                          : voucherData.type === 'P'
                          ? 'Payment Voucher'
                          : voucherData.type === 'R'
                          ? 'Receipt Voucher'
                          : voucherData.type === 'J'
                          ? 'Journal Voucher'
                          : voucherData.type === 'C'
                          ? 'Contra Voucher'
                          : voucherData.type === 'CN'
                          ? 'Credit Note'
                          : voucherData.type === 'DN'
                          ? 'Debit Note'
                          : voucherData.type === 'DLV'
                          ? 'Delivery Challan'
                          : voucherData.type === 'PHY'
                          ? 'Physical Stock Audit'
                          : voucherData.type === 'QTN'
                          ? 'Quotation'
                          : voucherData.type}
                      </span>
                      {isCancelled ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider shadow-2xs">
                          Cancelled / Void
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase border border-emerald-200">
                          {voucherData.header?.status || 'Active'}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 font-medium">
                      Date: <span className="font-semibold text-slate-800">{formatDateTimeStr(voucherData.header?.date)}</span>
                    </div>

                    {(voucherData.header?.party ||
                      voucherData.header?.customer ||
                      voucherData.header?.supplier ||
                      voucherData.header?.partyLedger) && (
                      <div className="text-[11px] text-slate-700 font-semibold">
                        Party / Account:{' '}
                        <span className="text-slate-950 font-bold">
                          {voucherData.header?.party ||
                            (typeof voucherData.header?.customer === 'object'
                              ? voucherData.header.customer?.name || voucherData.header.customer?.ledger
                              : voucherData.header?.customer) ||
                            (typeof voucherData.header?.supplier === 'object'
                              ? voucherData.header.supplier?.name || voucherData.header.supplier?.ledger
                              : voucherData.header?.supplier) ||
                            voucherData.header?.partyLedger}
                        </span>
                      </div>
                    )}

                    {(voucherData.header?.customer?.address || voucherData.header?.supplier?.address || voucherData.header?.partyAddress) && (
                      <div className="text-[11px] text-slate-600 font-medium">
                        Address:{' '}
                        <span className="text-slate-800 font-medium">
                          {voucherData.header?.customer?.address || voucherData.header?.supplier?.address || voucherData.header?.partyAddress}
                        </span>
                      </div>
                    )}

                    {voucherData.header?.supplierBillNo && (
                      <div className="text-[11px] text-slate-600 font-medium">
                        Supplier Bill Ref: <span className="font-mono font-bold text-slate-800">{voucherData.header.supplierBillNo}</span>
                      </div>
                    )}

                    {voucherData.header?.cancelledReason && (
                      <div className="text-[11px] text-rose-700 font-semibold bg-rose-100/80 px-2 py-1 rounded-lg border border-rose-200 mt-1">
                        Cancellation Reason: <span className="italic">{voucherData.header.cancelledReason}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Voucher Value</div>
                    <div
                      className={`text-right font-black text-xl font-mono ${
                        isCancelled ? 'line-through text-slate-400' : 'text-indigo-950'
                      }`}
                    >
                      {currency} {fmt(totalAmt)}
                    </div>
                  </div>
                </div>

                {/* Voucher Quick Actions Bar */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Print Button */}
                    <GlowButton
                      type="button"
                      onClick={handlePrintVoucher}
                      variant="blue"
                      size="sm"
                      icon={Printer}
                      title="Print Voucher / Bill"
                    >
                      Print
                    </GlowButton>

                    {/* Save PDF Button */}
                    <GlowButton
                      type="button"
                      onClick={handleSavePdf}
                      variant="cyan"
                      size="sm"
                      icon={Download}
                      title="Save PDF file to computer"
                    >
                      Save PDF
                    </GlowButton>

                    {/* Share Button */}
                    <GlowButton
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      variant="purple"
                      size="sm"
                      icon={Share2}
                      title="Share Voucher via WhatsApp, Copy Text or PDF"
                    >
                      Share
                    </GlowButton>

                    {/* Open in Entry Screen */}
                    {onOpenVoucherInEntry && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => onOpenVoucherInEntry(refNo, voucherData.type, active, history)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition active:scale-95 cursor-pointer"
                        title="Edit / Open in original entry form"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Open in Entry</span>
                      </button>
                    )}
                  </div>

                  {/* Danger Zone: Cancel & Delete Buttons */}
                  <div className="flex items-center gap-1.5">
                    {!isCancelled ? (
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-300 transition active:scale-95 cursor-pointer"
                        title="Cancel (Void) this voucher while preserving the audit number"
                      >
                        <Ban className="h-3.5 w-3.5 text-amber-700" />
                        <span>Cancel (Void)</span>
                      </button>
                    ) : (
                      <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-500 font-semibold text-xs border border-slate-200">
                        Voucher is Voided
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-300 transition active:scale-95 cursor-pointer"
                      title="Permanently remove voucher from records"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* IN-MODAL CANCEL (VOID) CONFIRMATION MODAL */}
              {showCancelModal && (
                <div className="rounded-2xl border border-amber-400 bg-amber-50/95 p-4 text-xs space-y-3 shadow-md animate-in fade-in">
                  <div className="font-bold text-amber-950 flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                      <span>Cancel (Void) Voucher {refNo}?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-900 text-[11px] leading-relaxed space-y-1">
                    <p>
                      • <b>Sequential Audit Trail:</b> Voucher <b>{refNo}</b> remains recorded with status marked as <b>Cancelled</b>.
                    </p>
                    <p>
                      • <b>Financial & Stock Safety:</b> All associated ledger postings and inventory stock movements will be <b>automatically reversed</b>.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Reason for Cancellation (Optional):
                    </label>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      placeholder="e.g., Customer returned order / Entry error / Duplicate entry"
                      className="w-full px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => setShowCancelModal(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={handleConfirmCancel}
                      className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>{isCancelling ? 'Cancelling...' : 'Confirm Cancellation (Void)'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* IN-MODAL PERMANENT DELETE CONFIRMATION MODAL */}
              {showDeleteModal && (
                <div className="rounded-2xl border border-rose-400 bg-rose-50/95 p-4 text-xs space-y-3 shadow-md animate-in fade-in">
                  <div className="font-bold text-rose-950 flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                      <span>Permanently Delete Voucher {refNo}?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-900 text-[11px] leading-relaxed space-y-1">
                    <p>
                      ⚠️ <b>Permanent Record Removal:</b> This voucher will be completely removed from the database.
                    </p>
                    <p>
                      • All inventory stock and accounting ledger entries for this voucher will be reversed.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isDeletingPermanent}
                      onClick={() => setShowDeleteModal(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition cursor-pointer"
                    >
                      Keep Voucher
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingPermanent}
                      onClick={handleConfirmDeletePermanent}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isDeletingPermanent ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* IN-MODAL SHARE OPTIONS MODAL */}
              {showShareModal && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/95 p-4 text-xs space-y-3 shadow-md animate-in fade-in">
                  <div className="font-bold text-indigo-950 flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
                      <span>Share Voucher {refNo}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowShareModal(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-indigo-100 font-mono text-[11px] text-slate-700 whitespace-pre-wrap select-all">
                    {buildShareSummaryText(voucherData, getEffectiveConfig())}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Copy Text */}
                    <button
                      type="button"
                      onClick={handleCopyShareText}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      {copiedText ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 text-slate-600" />
                          <span>Copy Text</span>
                        </>
                      )}
                    </button>

                    {/* Native Share / PDF */}
                    <button
                      type="button"
                      onClick={handleNativeSharePdf}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Share PDF</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Financial Multi-lines (Accounting Entries Dr / Cr) if present */}
              {voucherData.header?.lines && voucherData.header.lines.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
                    Accounting Entries (Dr / Cr)
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm font-bold text-slate-700 text-[11px]">
                        <tr>
                          <th className="py-2 px-2.5 text-left w-16">Type</th>
                          <th className="py-2 px-2.5 text-left">Ledger Account</th>
                          <th className="py-2 px-2.5 text-right">Debit ({currency})</th>
                          <th className="py-2 px-2.5 text-right">Credit ({currency})</th>
                          <th className="py-2 px-2.5 text-left">Line Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {voucherData.header.lines.map((l: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 font-black text-[10px]">
                              <span
                                className={
                                  l.type === 'Dr'
                                    ? 'text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded'
                                    : 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded'
                                }
                              >
                                {l.type}
                              </span>
                            </td>
                            <td
                              className="py-2 px-2.5 font-bold text-slate-900 cursor-pointer hover:underline"
                              onClick={() => navigateTo('ledger', l.ledger)}
                            >
                              {l.ledger}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                              {l.type === 'Dr' ? fmt(l.amount || l.debit) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                              {l.type === 'Cr' ? fmt(l.amount || l.credit) : '-'}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 italic text-[11px]">{l.narration || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Single entry Dr/Cr accounts if no multi-lines */}
              {(!voucherData.header?.lines || voucherData.header.lines.length === 0) &&
                (voucherData.header?.debitLedger || voucherData.header?.creditLedger) && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Debit Account</span>
                      <div
                        className="font-bold text-slate-900 text-xs cursor-pointer hover:text-indigo-600 hover:underline"
                        onClick={() => navigateTo('ledger', voucherData.header?.debitLedger)}
                      >
                        {voucherData.header?.debitLedger}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Credit Account</span>
                      <div
                        className="font-bold text-slate-900 text-xs cursor-pointer hover:text-indigo-600 hover:underline"
                        onClick={() => navigateTo('ledger', voucherData.header?.creditLedger)}
                      >
                        {voucherData.header?.creditLedger}
                      </div>
                    </div>
                  </div>
                )}

              {/* Items breakdown table if present */}
              {voucherData.items && voucherData.items.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">Items Breakdown</div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm font-bold text-slate-700 text-[11px]">
                        <tr>
                          <th className="py-2 px-2.5 text-left">Item Name</th>
                          <th className="py-2 px-2.5 text-center">Qty</th>
                          <th className="py-2 px-2.5 text-right">Rate</th>
                          <th className="py-2 px-2.5 text-right">Discount</th>
                          {voucherData.header?.gstAmt > 0 && <th className="py-2 px-2.5 text-right">GST</th>}
                          <th className="py-2 px-2.5 text-right">Total ({currency})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {voucherData.items.map((item: any, idx: number) => {
                          const itemDesc = item.description || item.Description || item['Item Description'];
                          const lineTot = item['Line Total'] ?? item.lineTotal ?? item.total ?? 0;
                          const gstAmt = item['GST Amount'] ?? item.gstAmt ?? 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td
                                className="py-2 px-2.5 font-bold text-slate-900 cursor-pointer hover:underline"
                                onClick={() => navigateTo('stock', item['Item Code'] || item.code || item['Item Name'])}
                              >
                                <div>{item['Item Name'] || item.itemName || item.name}</div>
                                {itemDesc && <div className="text-[10px] text-slate-500 italic mt-0.5">{itemDesc}</div>}
                                {(item['Item Code'] || item.code) && (
                                  <span className="text-[10px] text-slate-400 font-mono">Code: {item['Item Code'] || item.code}</span>
                                )}
                                {item['Serial Numbers'] && (
                                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5">SN: {item['Serial Numbers']}</div>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-center font-mono font-semibold">
                                {item.Qty ?? item.qty} {item.Unit || item.unit || ''}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono">{fmt(item.Rate || item.rate || item.price)}</td>
                              <td className="py-2 px-2.5 text-right font-mono text-slate-500">{fmt(item.Discount || item.discount || 0)}</td>
                              {voucherData.header?.gstAmt > 0 && (
                                <td className="py-2 px-2.5 text-right font-mono text-slate-500">{fmt(gstAmt)}</td>
                              )}
                              <td className="py-2 px-2.5 text-right font-mono font-black text-slate-900">{fmt(lineTot)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Settlement breakdown if present */}
              {(() => {
                const header = voucherData.header;
                if (!header) return null;
                const totalVal = Number(header.total || header.amount || header.netPayable || 0);
                const partyNameStr = (header.party || header.customer?.name || header.customer?.ledger || header.customer || header.supplier?.name || header.supplier?.ledger || header.supplier || '').toString().trim().toLowerCase();
                const isCashCustomer = ['cash', 'cash customer', 'walking cash sale', 'walking cash', 'walk-in', 'walk-in customer', 'cash sale', 'cash-in-hand', 'cash supplier'].includes(partyNameStr);
                
                let cashAmt = Number(header.cash) || Number(header.paymentDetails?.cash) || Number(header.paymentDetails?.cashAmount) || 0;
                let bank1Amt = Number(header.bank1) || Number(header.paymentDetails?.bank1) || Number(header.paymentDetails?.bank1Amount) || 0;
                let bank2Amt = Number(header.bank2) || Number(header.paymentDetails?.bank2) || Number(header.paymentDetails?.bank2Amount) || 0;
                let dueAmt = Number(header.credit) || Number(header.paymentDetails?.credit) || Number(header.paymentDetails?.dueAmount) || 0;

                if (isCashCustomer && cashAmt === 0 && bank1Amt === 0 && bank2Amt === 0) {
                  cashAmt = totalVal;
                  dueAmt = 0;
                }

                if (cashAmt <= 0 && bank1Amt <= 0 && bank2Amt <= 0 && dueAmt <= 0) {
                  return null;
                }

                return (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Settlement / Payment Breakdown:
                    </span>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {cashAmt > 0 && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="text-slate-400">Cash:</span>
                          <span className="font-mono font-bold text-emerald-700">{currency} {fmt(cashAmt)}</span>
                        </div>
                      )}
                      {bank1Amt > 0 && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="text-slate-400">
                            {header.paymentDetails?.bank1Ledger || config?.Bank1Ledger || 'Bank 1'}:
                          </span>
                          <span className="font-mono font-bold text-blue-700">{currency} {fmt(bank1Amt)}</span>
                          {(header.bankTxnNo || header.paymentDetails?.bank1TxnId || header.bankTxnId) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              (Txn: {header.bankTxnNo || header.paymentDetails?.bank1TxnId || header.bankTxnId})
                            </span>
                          )}
                        </div>
                      )}
                      {bank2Amt > 0 && (
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <span className="text-slate-400">
                            {header.paymentDetails?.bank2Ledger || config?.Bank2Ledger || 'Bank 2'}:
                          </span>
                          <span className="font-mono font-bold text-indigo-700">{currency} {fmt(bank2Amt)}</span>
                          {(header.bank2TxnNo || header.paymentDetails?.bank2TxnId || header.bank2TxnId) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              (Txn: {header.bank2TxnNo || header.paymentDetails?.bank2TxnId || header.bank2TxnId})
                            </span>
                          )}
                        </div>
                      )}
                      {dueAmt > 0 && (
                        <div className="flex items-center gap-1.5 font-bold text-rose-700">
                          <span className="text-rose-500">Credit / Balance Due:</span>
                          <span className="font-mono">{currency} {fmt(dueAmt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Additional Expenses if present */}
              {voucherData.header?.additionalExpenses && voucherData.header.additionalExpenses.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Additional Expenses:
                  </span>
                  <div className="space-y-1">
                    {voucherData.header.additionalExpenses.map((exp: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-semibold">{exp.ledger}</span>
                        <span className="font-mono font-bold text-slate-900">{currency} {fmt(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Narration if any */}
              {voucherData.header?.narration && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                    Narration / Remarks:
                  </span>
                  <p className="font-medium text-slate-800 italic">{voucherData.header.narration}</p>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div className="text-[11px] text-slate-400 font-medium">
            Click any entry to drill deeper into statements or vouchers
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {showReceiptModal && (voucherData?.type === 'INV' || voucherData?.type === 'S') && voucherData.header && (
        <ThermalReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          invoice={voucherData.header}
          config={getEffectiveConfig()}
        />
      )}
    </div>
  );
};
