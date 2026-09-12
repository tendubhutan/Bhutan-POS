import React, { useState, useEffect } from 'react';
import { GlowButton } from '../common/GlowButton';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger } from '../../types';
import { saveCreditNote, peekNextVoucherNo, getVoucherDetails } from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { ItemNoteButton, ItemNoteInput } from './ItemNoteField';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import { QuitConfirmModal } from '../QuitConfirmModal';
import { generateCreditNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';
import {
  Undo2, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, Sparkles, Receipt, Share2, Download, ChevronDown, ChevronUp, X, FileText, SlidersHorizontal } from 'lucide-react';

interface CreditNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintVoucher?: (refNo: string) => void;
  onNavigateBack?: () => void;
  voucherTypeSelector?: React.ReactNode;
}

interface ItemLine {
  id: string;
  itemCode: string;
  itemName: string;
  description?: string;
  qty: number | '';
  rate: number | '';
  gstPct: number;
  amount: number;
}

export const CreditNoteEntry: React.FC<CreditNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  initialVoucherTarget,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintVoucher,
  onNavigateBack,
  voucherTypeSelector
}) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingVoucherNo, setEditingVoucherNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [voucherNo, setVoucherNo] = useState(() => (isAutoMode ? peekNextVoucherNo('CN', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyLedger, setPartyLedger] = useState('');
  const [salesReturnLedger, setSalesReturnLedger] = useState('Sales Account');
  const [originalInvoiceRef, setOriginalInvoiceRef] = useState('');
  const [narration, setNarration] = useState('');
  const [hasStockReturn, setHasStockReturn] = useState(true);

  // Accounting-only lump sum state
  const [lumpSumAmount, setLumpSumAmount] = useState<number | ''>('');
  const [lumpSumGst, setLumpSumGst] = useState<number | ''>(0);

  // Line items state (for stock returns)
  const [itemLines, setItemLines] = useState<ItemLine[]>([]);

  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const details = getVoucherDetails(initialVoucherTarget.voucherNo);
      if (details) {
        const v: any = details.header || details;
        if (v.type === 'CN' || v.voucherNo?.startsWith('CN-')) {
          setEditingVoucherNo(v.voucherNo);
          setVoucherNo(v.voucherNo);
          if (v.date) setDate(new Date(v.date).toISOString().split('T')[0]);
          if (v.partyLedger || v.partyName) setPartyLedger(v.partyLedger || v.partyName);
          if (v.salesReturnLedger || v.debitLedger) setSalesReturnLedger(v.salesReturnLedger || v.debitLedger);
          if (v.originalInvoiceRef) setOriginalInvoiceRef(v.originalInvoiceRef);
          if (v.narration) setNarration(v.narration);
          if (Array.isArray(v.items) && v.items.length > 0) {
            setHasStockReturn(true);
            setItemLines(v.items.map((it: any, idx: number) => ({
              id: String(idx + 1),
              itemCode: it.itemCode || it['Item Code'] || '',
              itemName: it.itemName || it['Item Name'] || '',
              description: it.description || it['Item Description'] || '',
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
      setVoucherNo(peekNextVoucherNo('CN', config));
    }
  }, [config, isAutoMode, editingVoucherNo]);

  // Set default customer
  useEffect(() => {
    if (ledgers.some(l => l['Ledger Name'] === 'Sales Return')) {
      setSalesReturnLedger('Sales Return');
    }
  }, [ledgers]);

  
  const focusItemSelectionBox = () => {
    setTimeout(() => {
      const fastPicker = document.getElementById('cn-fast-item-picker') as HTMLInputElement | null;
      if (fastPicker) {
        fastPicker.focus();
        return;
      }
      const item0 = document.getElementById('cn-item-0') as HTMLInputElement | null;
      if (item0) {
        item0.focus();
        return;
      }
      const qty0 = document.getElementById('cn-qty-0') as HTMLInputElement | null;
      if (qty0) {
        qty0.focus();
        qty0.select();
        return;
      }
      const lumpSum = document.getElementById('cn-lumpsum-amt') as HTMLInputElement | null;
      if (lumpSum) {
        lumpSum.focus();
        lumpSum.select();
      }
    }, 100);
  };

  const closeDetailsModalAndFocusItem = () => {
    setShowDetailsModal(false);
    focusItemSelectionBox();
  };

  useEffect(() => {
    if (showDetailsModal) {
      setTimeout(() => {
        const refEl = document.getElementById('cn-original-ref') as HTMLInputElement | null;
        if (refEl) {
          refEl.focus();
          refEl.select();
        }
      }, 100);
    }
  }, [showDetailsModal]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate' | 'gst') => ({
    prefix: 'cn',
    idx,
    field,
    totalRows: itemLines.length,
    searchPickerId: 'cn-fast-item-picker',
    hasDiscount: false,
    hasGst: true,
    onDeleteRow: (i: number) => {
      if (itemLines.length <= 1) {
        setItemLines([{
          id: String(Date.now()),
          itemCode: '',
          itemName: '',
          qty: 1,
          rate: 0,
          gstPct: 0,
          amount: 0,
          description: ''
        }]);
        showToast('Item line cleared.', 'success');
        return;
      }
      setItemLines(prev => prev.filter((_, index) => index !== i));
    },
    onOpenNewItemModal: () => onOpenNewItemModal && onOpenNewItemModal(),
  });

  const handleQuickAddItem = (selectedItem: Item) => {
    const qty = 1;
    const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
    const gst = selectedItem['GST %'] || 0;

    const newLine: ItemLine = {
      id: String(Date.now()),
      itemCode: selectedItem['Item Code'],
      itemName: selectedItem['Item Name'],
      qty,
      rate,
      gstPct: gst,
      amount: qty * rate,
      description: ''
    };

    let updated: ItemLine[];
    let targetIndex: number;

    if (itemLines.length === 1 && !itemLines[0].itemCode) {
      updated = [newLine];
      targetIndex = 0;
    } else {
      updated = [...itemLines, newLine];
      targetIndex = updated.length - 1;
    }

    setItemLines(updated);
    showToast(`Added: ${selectedItem['Item Name']}`, 'success');

    setTimeout(() => {
      const qtyEl = document.getElementById(`cn-qty-${targetIndex}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
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
      setItemLines([{
        id: String(Date.now()),
        itemCode: '',
        itemName: '',
        qty: 1,
        rate: 0,
        gstPct: 0,
        amount: 0,
        description: ''
      }]);
      showToast('Item line cleared.', 'success');
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
          const rate = Number((target as any)['Sale Rate'] ?? (target as any)['Sales Rate'] ?? target.MRP ?? target['Purchase Rate'] ?? 0);
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

  const totalCreditAmount = calculatedTaxable + calculatedGst;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!partyLedger) {
      showToast('Please select a valid Customer / Debtor ledger.', 'error');
      return;
    }

    if (totalCreditAmount <= 0) {
      showToast('Credit Note amount must be greater than zero.', 'error');
      return;
    }

    setShowAcceptModal(true);
  };

  const proceedSave = () => {
    setShowAcceptModal(false);

    const partyObj = ledgers.find(l => l['Ledger Name'] === partyLedger);

    const payload = {
      voucherNo: voucherNo.trim() || undefined,
      originalVoucherNo: editingVoucherNo || undefined,
      date: new Date(date).toISOString(),
      partyLedger,
      partyAddress: partyObj?.Address || '',
      partyPhone: partyObj?.['Contact No'] || '',
      partyGstNo: partyObj?.['GST No'] || '',
      salesReturnLedger,
      originalInvoiceRef: originalInvoiceRef.trim(),
      amount: totalCreditAmount,
      taxable: calculatedTaxable,
      gstAmt: calculatedGst,
      narration: narration.trim() || `Credit Note to ${partyLedger} against ${originalInvoiceRef || 'Sales Return'}`,
      returnStock: hasStockReturn,
      items: hasStockReturn
        ? itemLines.map(l => ({
            itemCode: l.itemCode,
            itemName: l.itemName,
            description: l.description || '',
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            gstPct: Number(l.gstPct) || 0,
            amount: Number(l.amount) || 0
          }))
        : undefined
    };

    const res = saveCreditNote(payload);
    if (res.ok) {
      showToast(`Credit Note ${res.voucherNo} saved successfully!`, 'success');
      onDataRefresh();
      setEditingVoucherNo(null);

      const savedObj = {
        ...payload,
        voucherNo: res.voucherNo,
        amount: totalCreditAmount,
        partyLedger: partyLedger
      };

      setSuccessModalDetails({
        voucherNo: res.voucherNo,
        voucherType: 'Credit Note',
        date: payload.date,
        partyName: partyLedger,
        totalAmount: totalCreditAmount,
        totalItems: hasStockReturn ? itemLines.length : 1,
        currencySymbol,
        onPrint: () => {
          if (onPrintVoucher) {
            onPrintVoucher(res.voucherNo);
          } else {
            const doc = generateCreditNotePDF(savedObj, config);
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
          }
        },
        onShare: () => {
          const doc = generateCreditNotePDF(savedObj, config);
          shareOrDownloadPDF(doc, `CreditNote_${res.voucherNo}.pdf`, `Credit Note ${res.voucherNo}`);
        },
        onDownload: () => {
          const doc = generateCreditNotePDF(savedObj, config);
          doc.save(`CreditNote_${res.voucherNo}.pdf`);
        },
        onNewVoucher: () => {
          if (isAutoMode) {
            setVoucherNo(peekNextVoucherNo('CN', config));
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
        setVoucherNo(peekNextVoucherNo('CN', config));
      }
      setOriginalInvoiceRef('');
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

  const resetForm = () => {
    setEditingVoucherNo(null);
    if (isAutoMode) {
      setVoucherNo(peekNextVoucherNo('CN', config));
    }
    setDate(new Date().toISOString().split('T')[0]);
    setPartyLedger('');
    setSalesReturnLedger('Sales Account');
    setOriginalInvoiceRef('');
    setNarration('');
    setLumpSumAmount('');
    setLumpSumGst(0);
    setItemLines([
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
  };

  const handleCreditBack = (): boolean => {
    if (showQuitModal) {
      setShowQuitModal(false);
      return true;
    }
    if (showAcceptModal) {
      setShowAcceptModal(false);
      return true;
    }
    if (successModalDetails) {
      setSuccessModalDetails(null);
      return true;
    }

    const hasData =
      !!partyLedger ||
      (Number(lumpSumAmount) > 0) ||
      (Number(lumpSumGst) > 0) ||
      !!originalInvoiceRef ||
      Boolean(narration.trim()) ||
      !!editingVoucherNo ||
      (itemLines.length > 0 && itemLines.some(l => !!l.itemCode || !!l.itemName || (Number(l.rate) > 0) || (Number(l.amount) > 0)));

    if (hasData) {
      setShowQuitModal(true);
      return true;
    }

    resetForm();
    if (onNavigateBack) {
      onNavigateBack();
      return true;
    }
    return false;
  };

  // Global F2 and app event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        const formEl = document.getElementById('credit-note-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };

    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleCreditBack();
      if (handled) {
        e.preventDefault();
      }
    };

    const handleSaveEvent = (e: CustomEvent) => {
      const formEl = document.getElementById('credit-note-form') as HTMLFormElement | null;
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
  }, [
    totalCreditAmount,
    partyLedger,
    date,
    originalInvoiceRef,
    itemLines,
    lumpSumAmount,
    lumpSumGst,
    narration,
    editingVoucherNo,
    showQuitModal,
    showAcceptModal,
    successModalDetails,
    onNavigateBack
  ]);

  return (
    <form id="credit-note-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingVoucherNo ? `Save changes to ${editingVoucherNo}?` : "Save Credit Note?"}
        onConfirm={proceedSave}
        onCancel={() => setShowAcceptModal(false)}
      />
      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="Credit Note"
        onConfirm={() => {
          setShowQuitModal(false);
          resetForm();
          if (onNavigateBack) {
            onNavigateBack();
          }
        }}
        onCancel={() => setShowQuitModal(false)}
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

      {/* Header Fields Row - Voucher Selector + Credit Note No. + Voucher Date + Customer + Goods return dropdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs space-y-2 text-xs">
        <div className="flex flex-wrap items-end gap-2.5">
          {voucherTypeSelector}

          {/* Credit Note No. */}
          <div className="flex-1 min-w-[120px]">
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Credit Note No.</label>
            <input
              id="cn-voucher-no"
              type="text"
              value={voucherNo || ''}
              onChange={e => setVoucherNo(e.target.value)}
              disabled={isAutoMode}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusElement('cn-date');
                }
              }}
              className={`w-full h-8 rounded-lg border px-2.5 py-1 font-mono font-bold text-slate-900 outline-none text-xs ${
                isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-purple-600'
              }`}
            />
          </div>

          {/* Voucher Date */}
          <div className="flex-1 min-w-[130px]">
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Voucher Date</label>
            <input
              id="cn-date"
              type="date"
              value={date || ''}
              onChange={e => setDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusElement('cn-customer');
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusElement('cn-voucher-no');
                }
              }}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-400/80 focus:bg-indigo-50/50 focus:border-indigo-400 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all z-10 relative text-xs"
            />
          </div>

          {/* Customer (Debtor) */}
          <div className="flex-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-0.5">
              <label className="block font-bold text-slate-700 text-[11px]">Customer (Debtor)</label>
              {partyLedger && (
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(true)}
                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1 cursor-pointer transition"
                  title="Edit Original Invoice Ref, Debit Account & Narration"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Ref & Details</span>
                </button>
              )}
            </div>
            <SearchableLedgerSelect
              id="cn-customer"
              ledgers={ledgers}
              value={partyLedger || ''}
              onChange={(val) => {
                setPartyLedger(val);
                if (val) {
                  setShowDetailsModal(true);
                }
              }}
              filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
              prioritizeGroups={['Sundry Debtors']}
              onCreateNew={() => onOpenQuickLedger('Sundry Debtors')}
              placeholder="Select Customer Ledger"
              onEnterNext={() => {
                if (partyLedger) setShowDetailsModal(true);
              }}
              onArrowRight={() => {
                if (partyLedger) setShowDetailsModal(true);
              }}
              onArrowLeft={() => focusElement('cn-date')}
            />
          </div>

          {/* Goods return / Accounting Adjustment Dropdown */}
          <div className="flex-1 min-w-[210px]">
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Goods return / Accounting Adjustment</label>
            <select
              id="cn-adjustment-type"
              value={hasStockReturn ? 'goods_return' : 'accounting_only'}
              onChange={e => setHasStockReturn(e.target.value === 'goods_return')}
              className="w-full h-8 rounded-lg border border-purple-300 bg-purple-50/80 hover:bg-purple-50 px-2.5 py-1 font-bold text-purple-950 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 text-xs cursor-pointer transition shadow-2xs"
            >
              <option value="goods_return">📦 Return Goods into Stock</option>
              <option value="accounting_only">💰 Accounting Adjustment Only</option>
            </select>
          </div>
        </div>

        {/* Summary indicator if Ref/Narration/Debit Account is specified */}
        {(originalInvoiceRef || narration || (salesReturnLedger && salesReturnLedger !== 'Sales Account' && salesReturnLedger !== 'Sales Return')) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-[11px]">
            <span className="font-semibold text-slate-500">Details:</span>
            {originalInvoiceRef && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-bold">
                Ref: {originalInvoiceRef}
              </span>
            )}
            {salesReturnLedger && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
                Account: {salesReturnLedger}
              </span>
            )}
            {narration && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium truncate max-w-xs">
                Reason: {narration}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              className="text-[10px] text-purple-600 hover:text-purple-800 underline font-bold cursor-pointer ml-auto"
            >
              Edit details
            </button>
          </div>
        )}
      </div>

      {/* Floating Details Modal for Pink Fields (Original Invoice Ref, Sales Return Account, Narration) */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-100 max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Credit Note Reference & Details
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Customer: <span className="font-bold text-purple-700">{partyLedger || 'Not Selected'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetailsModalAndFocusItem}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Pink Field 1: Original Invoice Ref. */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Original Invoice Ref.
                </label>
                <input
                  id="cn-original-ref"
                  type="text"
                  placeholder="e.g. INV-1002"
                  value={originalInvoiceRef || ''}
                  onChange={e => setOriginalInvoiceRef(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusElement('cn-sales-return');
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 text-xs transition"
                />
              </div>

              {/* Pink Field 2: Sales Return / Debit Account */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Sales Return / Debit Account
                </label>
                <SearchableLedgerSelect
                  id="cn-sales-return"
                  ledgers={ledgers}
                  value={salesReturnLedger || ''}
                  onChange={setSalesReturnLedger}
                  placeholder="Sales Return or Sales Account"
                  onEnterNext={() => focusElement('cn-narration')}
                />
              </div>

              {/* Pink Field 3: Narration / Reason */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Narration / Reason
                </label>
                <textarea
                  id="cn-narration"
                  rows={2}
                  placeholder="Reason for return or credit note..."
                  value={narration || ''}
                  onChange={e => setNarration(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      closeDetailsModalAndFocusItem();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-200 text-xs transition resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeDetailsModalAndFocusItem}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={closeDetailsModalAndFocusItem}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition cursor-pointer"
              >
                Done & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Item Lines Grid or Lump Sum Fields */}
      {hasStockReturn ? (
        <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
          <div className="flex-1 overflow-y-auto min-h-[160px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                <tr>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-2.5 w-24 text-center">Return Qty</th>
                  <th className="py-2 px-2.5 w-28 text-right">Return Rate ({currencySymbol})</th>
                  <th className="py-2 px-2 w-16 text-center">GST %</th>
                  <th className="py-2 px-2.5 w-28 text-right">Line Total ({currencySymbol})</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemLines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-1.5 px-3 min-w-[240px]">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 min-w-0">
                          <SearchableItemSelect
                            variant="grid"
                            id={`cn-item-${idx}`}
                            valueCode={line.itemCode}
                            items={items}
                            placeholder="Select item..."
                            currencySymbol={currencySymbol}
                            priceType="sale"
                            showPrice={true}
                            dropdownPosition="down"
                            onCreateNew={onOpenNewItemModal}
                            onEndOfList={(id) => id && focusElement('cn-save-btn')}
                            onSelect={selectedItem => {
                              const qty = Number(line.qty) || 1;
                              const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
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
                              setTimeout(() => {
                                const qtyEl = document.getElementById(`cn-qty-${idx}`) as HTMLInputElement | null;
                                if (qtyEl) {
                                  qtyEl.focus();
                                  qtyEl.select();
                                }
                              }, 50);
                            }}
                            onEnterNext={() => {
                              setTimeout(() => {
                                const el = document.getElementById(`cn-qty-${idx}`);
                                if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
                              }, 10);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') return;
                              handleGridKeyDown(e, getGridNavOpts(idx, 'item'));
                            }}
                          />
                        </div>
                        {line.itemCode && (
                          <ItemNoteButton
                            hasNote={Boolean(line.description && line.description.trim())}
                            onClick={() => setActiveNoteIdx(activeNoteIdx === idx ? null : idx)}
                            accentColor="purple"
                          />
                        )}
                      </div>

                      {(Boolean(line.description && line.description.trim()) || activeNoteIdx === idx) && (
                        <ItemNoteInput
                          value={line.description || ''}
                          onChange={(val) => {
                            setItemLines(prev =>
                              prev.map(l => (l.id === line.id ? { ...l, description: val } : l))
                            );
                          }}
                          onClose={() => setActiveNoteIdx(null)}
                          accentColor="purple"
                        />
                      )}
                    </td>

                    <td className="py-1.5 px-2.5">
                      <input
                        id={`cn-qty-${idx}`}
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'qty',
                            e.target.value === '' ? '' : parseFloat(e.target.value)
                          )
                        }
                        className="w-full text-center rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-purple-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <input
                        id={`cn-rate-${idx}`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'rate',
                            e.target.value === '' ? '' : parseFloat(e.target.value)
                          )
                        }
                        className="w-full text-right rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-purple-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2">
                      <input
                        id={`cn-gst-${idx}`}
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.gstPct !== undefined && line.gstPct !== null ? line.gstPct : 0}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'gst'))}
                        onChange={e =>
                          handleLineChange(
                            line.id,
                            'gstPct',
                            e.target.value === '' ? 0 : parseFloat(e.target.value)
                          )
                        }
                        className="w-full text-center rounded-lg border border-slate-200 px-2 py-1 font-bold outline-none focus:border-purple-600 text-xs"
                      />
                    </td>

                    <td className="py-1.5 px-2.5 text-right font-black text-slate-900">
                      {currencySymbol} {line.amount.toFixed(2)}
                    </td>

                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItemLine(line.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Active Table Cell Search Row (Quotation Style) */}
                <tr className="bg-purple-50/50 hover:bg-purple-100/50 transition border-t border-purple-100 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                  <td className="py-2 px-3 min-w-[240px]">
                    <SearchableItemSelect
                      variant="grid"
                      id="cn-fast-item-picker"
                      items={items}
                      placeholder="+ Type Item Name or Scan Barcode..."
                      currencySymbol={currencySymbol}
                      priceType="sale"
                      showPrice={true}
                      dropdownPosition="down"
                      onEndOfList={(id) => id && focusElement('cn-save-btn')}
                      onSelect={selectedItem => handleQuickAddItem(selectedItem)}
                      autoClearAfterSelect={true}
                      onEnterNext={() => focusElement('cn-save-btn')}
                      onCreateNew={onOpenNewItemModal}
                    />
                  </td>
                  <td className="py-2 px-2 text-center text-slate-400 font-bold">—</td>
                  <td className="py-2 px-2 text-right text-slate-400 font-bold">—</td>
                  <td className="py-2 px-2 text-center text-slate-400 font-bold">—</td>
                  <td className="py-2 px-3 text-right text-slate-400 font-bold">—</td>
                  <td className="py-2 px-2 text-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 uppercase tracking-wide">
                      NEW
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
          <h3 className="font-extrabold text-slate-900 text-xs">Credit Note Financial Values</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">
                Taxable Amount ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={lumpSumAmount !== undefined && lumpSumAmount !== null ? lumpSumAmount : ''}
                onChange={e =>
                  setLumpSumAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900 outline-none focus:border-purple-600 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">
                GST Reversal Amount ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={lumpSumGst !== undefined && lumpSumGst !== null ? lumpSumGst : ''}
                onChange={e =>
                  setLumpSumGst(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-black text-slate-900 outline-none focus:border-purple-600 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Narration Field */}
      <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs">
        <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">Narration:</span>
        <input
          id="cn-narration"
          type="text"
          placeholder="Enter voucher narration / remarks..."
          value={narration}
          onChange={e => setNarration(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:border-purple-600 transition"
        />
      </div>

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
          <div className="rounded-lg bg-purple-100/80 border border-purple-300 px-2.5 py-1 text-purple-950 font-black text-xs">
            Total: {currencySymbol} {totalCreditAmount.toFixed(2)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GlowButton
            id="cn-save-btn"
            type="submit"
            variant="purple"
            size="sm"
            icon={CheckCircle2}
          >
            Save Credit Note (F2)
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
