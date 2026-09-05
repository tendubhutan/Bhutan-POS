import React, { useState, useEffect } from 'react';
import { GlowButton } from '../common/GlowButton';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger } from '../../types';
import { saveDebitNote, peekNextVoucherNo, getVoucherDetails } from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import { generateDebitNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';
import {
  RotateCcw, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, Share2, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface DebitNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintVoucher?: (refNo: string) => void;
  onNavigateBack?: () => void;
}

interface ItemLine {
  id: string;
  itemCode: string;
  itemName: string;
  qty: number | '';
  rate: number | '';
  gstPct: number;
  amount: number;
}

export const DebitNoteEntry: React.FC<DebitNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  initialVoucherTarget,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintVoucher,
  onNavigateBack
}) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingVoucherNo, setEditingVoucherNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [voucherNo, setVoucherNo] = useState(() => (isAutoMode ? peekNextVoucherNo('DN', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierLedger, setSupplierLedger] = useState('');
  const [purchaseReturnLedger, setPurchaseReturnLedger] = useState('Purchase Account');
  const [originalBillRef, setOriginalBillRef] = useState('');
  const [narration, setNarration] = useState('');
  const [hasStockReturn, setHasStockReturn] = useState(true);

  // Lump sum financial state
  const [lumpSumAmount, setLumpSumAmount] = useState<number | ''>('');
  const [lumpSumGst, setLumpSumGst] = useState<number | ''>(0);

  // Line items state (for returning stock)
  const [itemLines, setItemLines] = useState<ItemLine[]>([
    {
      id: '1',
      itemCode: '',
      itemName: '',
      qty: 1,
      rate: 0,
      gstPct: 0,
      amount: 0
    }
  ]);

  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const details = getVoucherDetails(initialVoucherTarget.voucherNo);
      if (details) {
        const v: any = details.header || details;
        if (v.type === 'DN' || v.voucherNo?.startsWith('DN-')) {
          setEditingVoucherNo(v.voucherNo);
          setVoucherNo(v.voucherNo);
          if (v.date) setDate(new Date(v.date).toISOString().split('T')[0]);
          if (v.supplierLedger || v.partyLedger || v.debitLedger) setSupplierLedger(v.supplierLedger || v.partyLedger || v.debitLedger);
          if (v.purchaseReturnLedger || v.creditLedger) setPurchaseReturnLedger(v.purchaseReturnLedger || v.creditLedger);
          if (v.originalInvoiceRef || v.originalBillRef) setOriginalBillRef(v.originalInvoiceRef || v.originalBillRef);
          if (v.narration) setNarration(v.narration);
          if (Array.isArray(v.items) && v.items.length > 0) {
            setHasStockReturn(true);
            setItemLines(v.items.map((it: any, idx: number) => ({
              id: String(idx + 1),
              itemCode: it.itemCode || it['Item Code'] || '',
              itemName: it.itemName || it['Item Name'] || '',
              qty: it.qty !== undefined ? Number(it.qty) : (it.Qty !== undefined ? Number(it.Qty) : 1),
              rate: it.rate !== undefined ? Number(it.rate) : (it.Rate !== undefined ? Number(it.Rate) : 0),
              gstPct: it.gstPct !== undefined ? Number(it.gstPct) : (it['GST %'] !== undefined ? Number(it['GST %']) : 0),
              amount: it.amount !== undefined ? Number(it.amount) : (it.total !== undefined ? Number(it.total) : (Number(it.qty || 1) * Number(it.rate || 0)))
            })));
          } else {
            setHasStockReturn(false);
            setLumpSumAmount(v.amount ?? v.total ?? v.totalAmount ?? '');
          }
        }
      }
    }
  }, [initialVoucherTarget]);

  useEffect(() => {
    if (isAutoMode && !editingVoucherNo) {
      setVoucherNo(peekNextVoucherNo('DN', config));
    }
  }, [config, isAutoMode, editingVoucherNo]);

  // Set default supplier
  useEffect(() => {
    if (ledgers.some(l => l['Ledger Name'] === 'Purchase Return')) {
      setPurchaseReturnLedger('Purchase Return');
    }
  }, [ledgers]);

  
  useEffect(() => {
    if (itemLines.length > 0 && supplierLedger) {
      setIsHeaderCollapsed(true);
    } else if (itemLines.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [itemLines.length]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleAddItemLine = () => {
    setItemLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        itemCode: '',
        itemName: '',
        qty: 1,
        rate: 0,
        gstPct: 0,
        amount: 0
      }
    ]);
  };

  const handleRemoveItemLine = (id: string) => {
    if (itemLines.length <= 1) {
      showToast('At least one item line is required for stock return.', 'error');
      return;
    }
    setItemLines(prev => prev.filter(l => l.id !== id));
  };

  const handleItemSelect = (id: string, code: string) => {
    const target = items.find(i => i['Item Code'] === code);
    if (!target) return;
    setItemLines(prev =>
      prev.map(l => {
        if (l.id === id) {
          const qty = Number(l.qty) || 1;
          const rate = Number(target['Purchase Rate'] ?? (target as any)['Sale Rate'] ?? target.MRP ?? 0);
          return {
            ...l,
            itemCode: target['Item Code'],
            itemName: target['Item Name'],
            rate: rate,
            gstPct: target['GST %'] || 0,
            amount: qty * rate
          };
        }
        return l;
      })
    );
  };

  const handleLineChange = (id: string, field: 'qty' | 'rate' | 'gstPct', val: number | '') => {
    setItemLines(prev =>
      prev.map(l => {
        if (l.id === id) {
          const updated = { ...l, [field]: val };
          const q = Number(updated.qty) || 0;
          const r = Number(updated.rate) || 0;
          updated.amount = q * r;
          return updated;
        }
        return l;
      })
    );
  };

  // Calculations
  const calculatedTaxable = hasStockReturn
    ? itemLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
    : Number(lumpSumAmount) || 0;

  const calculatedGst = hasStockReturn
    ? itemLines.reduce((sum, l) => {
        const lineAmt = Number(l.amount) || 0;
        const gstP = Number(l.gstPct) || 0;
        return sum + (lineAmt * gstP) / 100;
      }, 0)
    : Number(lumpSumGst) || 0;

  const totalDebitAmount = calculatedTaxable + calculatedGst;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierLedger) {
      showToast('Please select a valid Supplier / Creditor ledger.', 'error');
      return;
    }

    if (totalDebitAmount <= 0) {
      showToast('Debit Note amount must be greater than zero.', 'error');
      return;
    }

    setShowAcceptModal(true);
  };

  const proceedSave = () => {
    setShowAcceptModal(false);

    const suppObj = ledgers.find(l => l['Ledger Name'] === supplierLedger);

    const payload = {
      voucherNo: voucherNo.trim() || undefined,
      date: new Date(date).toISOString(),
      supplierLedger,
      supplierAddress: suppObj?.Address || '',
      supplierPhone: suppObj?.['Contact No'] || '',
      supplierGstNo: suppObj?.['GST No'] || '',
      purchaseReturnLedger,
      originalBillRef: originalBillRef.trim(),
      amount: totalDebitAmount,
      taxable: calculatedTaxable,
      gstAmt: calculatedGst,
      narration: narration.trim() || `Debit Note to ${supplierLedger} against ${originalBillRef || 'Purchase Return'}`,
      returnStock: hasStockReturn,
      items: hasStockReturn
        ? itemLines.map(l => ({
            itemCode: l.itemCode,
            itemName: l.itemName,
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            gstPct: Number(l.gstPct) || 0,
            amount: Number(l.amount) || 0
          }))
        : undefined
    };

    const res = saveDebitNote(payload);
    if (res.ok) {
      showToast(`Debit Note ${res.voucherNo} saved successfully!`, 'success');
      onDataRefresh();
      setEditingVoucherNo(null);

      const savedObj = {
        ...payload,
        voucherNo: res.voucherNo,
        amount: totalDebitAmount,
        supplierName: supplierLedger
      };

      setSuccessModalDetails({
        voucherNo: res.voucherNo,
        voucherType: 'Debit Note',
        date: payload.date,
        partyName: supplierLedger,
        totalAmount: totalDebitAmount,
        totalItems: hasStockReturn ? itemLines.length : 1,
        currencySymbol,
        onPrint: () => {
          if (onPrintVoucher) {
            onPrintVoucher(res.voucherNo);
          } else {
            const doc = generateDebitNotePDF(savedObj, config);
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
          }
        },
        onShare: () => {
          const doc = generateDebitNotePDF(savedObj, config);
          shareOrDownloadPDF(doc, `DebitNote_${res.voucherNo}.pdf`, `Debit Note ${res.voucherNo}`);
        },
        onDownload: () => {
          const doc = generateDebitNotePDF(savedObj, config);
          doc.save(`DebitNote_${res.voucherNo}.pdf`);
        },
        onNewVoucher: () => {
          if (isAutoMode) {
            setVoucherNo(peekNextVoucherNo('DN', config));
          }
          setItemLines([
            {
              id: String(Date.now()),
              itemCode: '',
              itemName: '',
              qty: 1,
              rate: 0,
              gstPct: 0,
              amount: 0
            }
          ]);
        }
      });

      // Reset form
      if (isAutoMode) {
        setVoucherNo(peekNextVoucherNo('DN', config));
      }
      setOriginalBillRef('');
      setNarration('');
      setLumpSumAmount('');
      setLumpSumGst(0);
    }
  };

  const focusElement = (id: string) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.select();
        }
      }
    }, 20);
  };

  // Global F2, Escape, and app event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        if (successModalDetails) {
          setSuccessModalDetails(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (onNavigateBack) {
          onNavigateBack();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        const formEl = document.getElementById('debit-note-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };

    const handleBackEvent = (e: CustomEvent) => {
      if (successModalDetails) {
        setSuccessModalDetails(null);
        e.preventDefault();
      } else if (onNavigateBack) {
        onNavigateBack();
        e.preventDefault();
      }
    };

    const handleSaveEvent = (e: CustomEvent) => {
      const formEl = document.getElementById('debit-note-form') as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:back' as any, handleBackEvent);
    window.addEventListener('app:save' as any, handleSaveEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:back' as any, handleBackEvent);
      window.removeEventListener('app:save' as any, handleSaveEvent);
    };
  }, [totalDebitAmount, supplierLedger, date, originalBillRef, itemLines, lumpSumAmount, lumpSumGst, successModalDetails, onNavigateBack]);

  return (
    <form id="debit-note-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingVoucherNo ? `Save changes to ${editingVoucherNo}?` : "Save Debit Note?"}
        onConfirm={proceedSave}
        onCancel={() => setShowAcceptModal(false)}
      />
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all ${
            toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner & Mode Toggle */}
      <div className="rounded-xl border border-orange-200 bg-linear-to-r from-orange-50/90 to-amber-50/70 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white shadow-xs">
            <RotateCcw className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-orange-950 leading-tight">
              Debit Note (Purchase Return & Supplier Deduction)
            </h2>
            <p className="text-[11px] text-orange-700 font-medium">
              Charge back to vendors for goods returned, defective items, or price dispute claims
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white/90 p-0.5 rounded-lg border border-orange-200 text-xs">
          <button
            type="button"
            onClick={() => setHasStockReturn(true)}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              hasStockReturn
                ? 'bg-orange-600 text-white shadow-2xs'
                : 'text-orange-800 hover:bg-orange-100/50'
            }`}
          >
            📦 Return Goods (Stock Out)
          </button>
          <button
            type="button"
            onClick={() => setHasStockReturn(false)}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              !hasStockReturn
                ? 'bg-orange-600 text-white shadow-2xs'
                : 'text-orange-800 hover:bg-orange-100/50'
            }`}
          >
            💰 Accounting Claim Only
          </button>
        </div>
      </div>

      {/* Header Fields Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Debit Note No.</label>
            <input
              id="dn-voucher-no"
              type="text"
              value={voucherNo || ''}
              onChange={e => setVoucherNo(e.target.value)}
              disabled={isAutoMode}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  focusElement('dn-date');
                }
              }}
              className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-orange-600'
              }`}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Voucher Date</label>
            <input
              id="dn-date"
              type="date"
              value={date || ''}
              onChange={e => setDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  focusElement('dn-supplier');
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusElement('dn-voucher-no');
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-400/80 focus:bg-indigo-50/50 focus:border-indigo-400 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all z-10 relative text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Supplier (Creditor)</label>
            <SearchableLedgerSelect
              id="dn-supplier"
              ledgers={ledgers}
              value={supplierLedger}
              onChange={setSupplierLedger}
              filterGroups={['Sundry Creditors', 'Cash-in-Hand', 'Bank Accounts']}
              onCreateNew={() => onOpenQuickLedger('Sundry Creditors')}
              placeholder="Select Supplier Ledger"
              onEnterNext={() => focusElement('dn-original-ref')}
              onArrowRight={() => focusElement('dn-original-ref')}
              onArrowDown={() => focusElement('dn-original-ref')}
              onArrowLeft={() => focusElement('dn-date')}
              onArrowUp={() => focusElement('dn-date')}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Original Bill / Invoice Ref.</label>
            <input
              id="dn-original-ref"
              type="text"
              placeholder="e.g. PUR-1012 or Bill# 582"
              value={originalBillRef || ''}
              onChange={e => setOriginalBillRef(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  focusElement('dn-purchase-return');
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusElement('dn-supplier');
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-400/80 focus:bg-indigo-50/50 focus:border-indigo-400 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all z-10 relative text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-100">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Purchase Return / Credit Account</label>
            <SearchableLedgerSelect
              id="dn-purchase-return"
              ledgers={ledgers}
              value={purchaseReturnLedger || ''}
              onChange={setPurchaseReturnLedger}
              placeholder="Purchase Return or Purchase Account"
              onEnterNext={() => focusElement('dn-narration')}
              onArrowRight={() => focusElement('dn-narration')}
              onArrowDown={() => focusElement('dn-narration')}
              onArrowLeft={() => focusElement('dn-original-ref')}
              onArrowUp={() => focusElement('dn-original-ref')}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Narration / Reason</label>
            <input
              id="dn-narration"
              type="text"
              placeholder="Reason for purchase return or supplier debit..."
              value={narration || ''}
              onChange={e => setNarration(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (hasStockReturn) {
                    focusElement('dn-item-0-item');
                  } else {
                    focusElement('dn-lumpsum-amt');
                  }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  focusElement('dn-purchase-return');
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-400/80 focus:bg-indigo-50/50 focus:border-indigo-400 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all z-10 relative text-xs"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Item Lines Grid or Lump Sum Fields */}
      {hasStockReturn ? (
        <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <Package className="h-4 w-4 text-orange-600" />
              Returned Items ({itemLines.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItemLine}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 font-bold text-orange-700 hover:bg-orange-100 transition shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[160px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                <tr>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-2.5 w-24 text-center">Return Qty</th>
                  <th className="py-2 px-2.5 w-28 text-right">Rate ({currencySymbol})</th>
                  <th className="py-2 px-2 w-16 text-center">GST %</th>
                  <th className="py-2 px-2.5 w-28 text-right">Line Total ({currencySymbol})</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemLines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-1.5 px-3 min-w-[240px]">
                      <SearchableItemSelect
                        id={`dn-item-${idx}-item`}
                        valueCode={line.itemCode}
                        items={items}
                        placeholder="Search item name or scan barcode..."
                        currencySymbol={currencySymbol}
                        onCreateNew={onOpenNewItemModal}
                        priceType="purchase"
                        onEndOfList={(id) => id && focusElement('dn-save-btn')}
                        onSelect={selectedItem => {
                          const qty = Number(line.qty) || 1;
                          const rate = selectedItem['Purchase Rate'] || 0;
                          setItemLines(prev =>
                            prev.map(l => {
                              if (l.id === line.id) {
                                return {
                                  ...l,
                                  itemCode: selectedItem['Item Code'],
                                  itemName: selectedItem['Item Name'],
                                  rate: rate,
                                  gstPct: selectedItem['GST %'] || 0,
                                  amount: qty * rate
                                };
                              }
                              return l;
                            })
                          );
                          focusElement(`dn-item-${idx}-qty`);
                        }}
                        onEnterNext={() => {
                          focusElement(`dn-item-${idx}-qty`);
                        }}
                      />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <input
                        id={`dn-item-${idx}-qty`}
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
                        onFocus={e => e.target.select()}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'qty',
                            e.target.value === '' ? '' : parseFloat(e.target.value)
                          )
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            focusElement(`dn-item-${idx}-rate`);
                          } else if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            focusElement(`dn-item-${idx}-item`);
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (idx < itemLines.length - 1) focusElement(`dn-item-${idx + 1}-qty`);
                            else focusElement('dn-save-btn');
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (idx > 0) focusElement(`dn-item-${idx - 1}-qty`);
                            else focusElement('dn-narration');
                          }
                        }}
                        className="w-full text-center rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-orange-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <input
                        id={`dn-item-${idx}-rate`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
                        onFocus={e => e.target.select()}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'rate',
                            e.target.value === '' ? '' : parseFloat(e.target.value)
                          )
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            focusElement(`dn-item-${idx}-gst`);
                          } else if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            focusElement(`dn-item-${idx}-qty`);
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (idx < itemLines.length - 1) focusElement(`dn-item-${idx + 1}-rate`);
                            else focusElement('dn-save-btn');
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (idx > 0) focusElement(`dn-item-${idx - 1}-rate`);
                            else focusElement(`dn-item-${idx}-qty`);
                          }
                        }}
                        className="w-full text-right rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-orange-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2">
                      <input
                        id={`dn-item-${idx}-gst`}
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.gstPct !== undefined && line.gstPct !== null ? line.gstPct : 0}
                        onFocus={e => e.target.select()}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'gstPct',
                            e.target.value === '' ? 0 : parseFloat(e.target.value)
                          )
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowRight') {
                            e.preventDefault();
                            if (idx < itemLines.length - 1) {
                              focusElement(`dn-item-${idx + 1}-item`);
                            } else {
                              focusElement('dn-save-btn');
                            }
                          } else if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            focusElement(`dn-item-${idx}-rate`);
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (idx < itemLines.length - 1) focusElement(`dn-item-${idx + 1}-gst`);
                            else focusElement('dn-save-btn');
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (idx > 0) focusElement(`dn-item-${idx - 1}-gst`);
                            else focusElement(`dn-item-${idx}-rate`);
                          }
                        }}
                        className="w-full text-center rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-orange-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2.5 text-right font-black text-slate-900">
                      {currencySymbol} {line.amount.toFixed(2)}
                    </td>

                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemLine(line.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
          <h3 className="font-extrabold text-slate-900 text-xs">Debit Note Financial Values</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">
                Taxable Amount ({currencySymbol})
              </label>
              <input
                id="dn-lumpsum-amt"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={lumpSumAmount !== undefined && lumpSumAmount !== null ? lumpSumAmount : ''}
                onFocus={e => e.target.select()}
                onChange={e =>
                  setLumpSumAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusElement('dn-lumpsum-gst');
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusElement('dn-narration');
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900 outline-none focus:border-orange-600 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">
                GST Reversal Amount ({currencySymbol})
              </label>
              <input
                id="dn-lumpsum-gst"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={lumpSumGst !== undefined && lumpSumGst !== null ? lumpSumGst : ''}
                onFocus={e => e.target.select()}
                onChange={e =>
                  setLumpSumGst(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusElement('dn-save-btn');
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusElement('dn-lumpsum-amt');
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900 outline-none focus:border-orange-600 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Summary and Action Bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <div>
            <span>Taxable: </span>
            <span className="text-slate-900 font-extrabold font-mono">
              {currencySymbol} {calculatedTaxable.toFixed(2)}
            </span>
          </div>
          <div>
            <span>GST: </span>
            <span className="text-slate-900 font-extrabold font-mono">
              {currencySymbol} {calculatedGst.toFixed(2)}
            </span>
          </div>
          <div className="rounded-lg bg-orange-100/80 border border-orange-300 px-2.5 py-1 text-orange-950 font-black text-xs">
            Total: {currencySymbol} {totalDebitAmount.toFixed(2)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GlowButton
            id="dn-save-btn"
            type="submit"
            variant="amber"
            size="sm"
            icon={CheckCircle2}
            onKeyDown={e => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (hasStockReturn && itemLines.length > 0) {
                  focusElement(`dn-item-${itemLines.length - 1}-gst`);
                } else {
                  focusElement('dn-lumpsum-gst');
                }
              }
            }}
          >
            Save Debit Note (F2)
          </GlowButton>
        </div>
      </div>

      {/* Post-Save Universal Print / Share Action Modal */}
      <VoucherSuccessActionModal
        isOpen={!!successModalDetails}
        onClose={() => setSuccessModalDetails(null)}
        details={successModalDetails}
      />
    </form>
  );
};
