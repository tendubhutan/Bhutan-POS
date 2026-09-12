import React, { useState, useEffect } from 'react';
import { focusElement } from '../../utils/domUtils';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { Config, Item, PhysicalStockItem, PhysicalStockVoucher } from '../../types';
import {
  savePhysicalStockAdjustment, getPhysicalStockRecords, peekNextVoucherNo
} from '../../services/storageService';
import {
  Boxes, Trash2, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import { QuitConfirmModal } from '../QuitConfirmModal';
import { generatePhysicalStockPDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface PhysicalStockEntryProps {
  config: Config;
  items: Item[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onNavigateBack?: () => void;
  voucherTypeSelector?: React.ReactNode;
}

export const PhysicalStockEntry: React.FC<PhysicalStockEntryProps> = ({
  config,
  items,
  onDataRefresh,
  initialVoucherTarget,
  onOpenNewItemModal,
  onNavigateBack,
  voucherTypeSelector
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingVoucherNo, setEditingVoucherNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [voucherNo, setVoucherNo] = useState(() => (isAutoMode ? peekNextVoucherNo('PHYSICAL_STOCK', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const [activeTab, setActiveTab] = useState<'create' | 'audit' | 'history' | 'register'>('audit');
  const [savedRecords, setSavedRecords] = useState<PhysicalStockVoucher[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [quickSearchCode, setQuickSearchCode] = useState('');

  // Count lines state initialized clean
  const [stockLines, setStockLines] = useState<PhysicalStockItem[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  const loadHistory = () => {
    const list = getPhysicalStockRecords();
    setSavedRecords(list);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const all = getPhysicalStockRecords();
      const ps = all.find(x => x.voucherNo === initialVoucherTarget.voucherNo);
      if (ps) {
        setEditingVoucherNo(ps.voucherNo);
        setVoucherNo(ps.voucherNo);
        if (ps.date) setDate(new Date(ps.date).toISOString().split('T')[0]);
        if (ps.verifiedBy) setVerifiedBy(ps.verifiedBy);
        if (ps.remarks) setRemarks(ps.remarks);
        if (Array.isArray(ps.items) && ps.items.length > 0) {
          setStockLines(ps.items.map((it: any) => ({
            itemCode: it.itemCode || it['Item Code'] || '',
            itemName: it.itemName || it['Item Name'] || '',
            unit: it.unit || it.Unit || 'Pcs',
            physicalQty: Number(it.physicalQty !== undefined ? it.physicalQty : (it.Qty !== undefined ? it.Qty : 0)),
            bookQty: Number(it.bookQty !== undefined ? it.bookQty : 0),
            differenceQty: Number(it.differenceQty !== undefined ? it.differenceQty : (it.difference !== undefined ? it.difference : (Number(it.physicalQty || 0) - Number(it.bookQty || 0)))),
            varianceValue: Number(it.varianceValue !== undefined ? it.varianceValue : 0),
            rate: Number(it.rate !== undefined ? it.rate : (it.Rate !== undefined ? it.Rate : 0)),
            remarks: it.remarks || ''
          })));
        }
        setActiveTab('audit');
      }
    }
  }, [initialVoucherTarget]);

  useEffect(() => {
    if (isAutoMode && !editingVoucherNo) {
      setVoucherNo(peekNextVoucherNo('PHYSICAL_STOCK', config));
    }
  }, [config, isAutoMode, editingVoucherNo]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate' | 'disc' | 'gst') => ({
    prefix: 'ps',
    idx,
    field,
    totalRows: stockLines.length,
    searchPickerId: 'ps-fast-item-picker',
    hasRate: false,
    hasDiscount: false,
    hasGst: false,
    onDeleteRow: (i: number) => handleRemoveLine(i),
    onOpenNewItemModal: () => onOpenNewItemModal && onOpenNewItemModal(),
  });

  const focusFirstItemOrPicker = () => {
    setTimeout(() => {
      if (stockLines.length > 0) {
        const itemEl = document.getElementById('ps-item-0') || document.getElementById('ps-qty-0');
        if (itemEl) {
          itemEl.focus();
          return;
        }
      }
      const picker = document.getElementById('ps-fast-item-picker');
      if (picker) {
        picker.focus();
      }
    }, 60);
  };

  const handleLoadAllItems = () => {
    const all = items.map(it => {
      const book = Number(it['Current Stock']) || 0;
      return {
        itemCode: it['Item Code'],
        itemName: it['Item Name'],
        unit: it.Unit || 'Pcs',
        bookQty: book,
        physicalQty: book,
        differenceQty: 0,
        rate: Number(it['Purchase Rate']) || 0,
        varianceValue: 0
      };
    });
    setStockLines(all);
    showToast(`Loaded all ${all.length} inventory items for physical count.`, 'success');
  };

  const handleItemSelect = (idx: number, code: string) => {
    const selectedItem = items.find(i => i['Item Code'] === code);
    if (!selectedItem) return;
    const book = Number(selectedItem['Current Stock']) || 0;
    const rate = Number(selectedItem['Purchase Rate']) || 0;
    setStockLines(prev =>
      prev.map((line, i) => {
        if (i === idx) {
          const phys = typeof line.physicalQty === 'number' && line.physicalQty !== 0 ? line.physicalQty : book;
          const diff = phys - book;
          return {
            ...line,
            itemCode: selectedItem['Item Code'],
            itemName: selectedItem['Item Name'],
            unit: selectedItem.Unit || 'Pcs',
            bookQty: book,
            physicalQty: phys,
            differenceQty: diff,
            rate,
            varianceValue: diff * rate
          };
        }
        return line;
      })
    );
    setTimeout(() => {
      const qtyEl = document.getElementById(`ps-qty-${idx}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const handleQuickAddItem = (selectedItem: Item) => {
    const code = selectedItem['Item Code'];
    const existingIdx = stockLines.findIndex(l => l.itemCode === code);
    if (existingIdx > -1) {
      showToast(`Item ${selectedItem['Item Name']} is already in the list. Focused.`, 'success');
      setTimeout(() => {
        const qtyEl = document.getElementById(`ps-qty-${existingIdx}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
      return;
    }

    const book = Number(selectedItem['Current Stock']) || 0;
    const rate = Number(selectedItem['Purchase Rate']) || 0;
    const newLine: PhysicalStockItem = {
      itemCode: selectedItem['Item Code'],
      itemName: selectedItem['Item Name'],
      unit: selectedItem.Unit || 'Pcs',
      bookQty: book,
      physicalQty: book,
      differenceQty: 0,
      rate,
      varianceValue: 0
    };

    let updated: PhysicalStockItem[];
    let targetIndex: number;

    const emptyIdx = stockLines.findIndex(l => !l.itemCode);
    if (emptyIdx > -1) {
      updated = stockLines.map((l, i) => (i === emptyIdx ? newLine : l));
      targetIndex = emptyIdx;
    } else {
      updated = [...stockLines, newLine];
      targetIndex = updated.length - 1;
    }

    setStockLines(updated);
    showToast(`Added: ${selectedItem['Item Name']}`, 'success');

    setTimeout(() => {
      const qtyEl = document.getElementById(`ps-qty-${targetIndex}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const handlePhysicalQtyChange = (idx: number, val: number | '') => {
    setStockLines(prev =>
      prev.map((line, i) => {
        if (i === idx) {
          const phys = typeof val === 'number' ? val : 0;
          const diff = phys - line.bookQty;
          const variance = diff * line.rate;
          return {
            ...line,
            physicalQty: val === '' ? ('' as any) : phys,
            differenceQty: diff,
            varianceValue: variance
          };
        }
        return line;
      })
    );
  };

  const handleRemoveLine = (idx: number) => {
    setStockLines(prev => prev.filter((_, i) => i !== idx));
    showToast('Item line removed.', 'success');
  };

  // Summary Metrics (filtering for rows with itemCode)
  const validLines = stockLines.filter(l => !!l.itemCode);
  const totalItemsCounted = validLines.length;
  const changedLines = validLines.filter(l => l.differenceQty !== 0);
  const totalShortageQty = validLines.reduce(
    (sum, l) => (l.differenceQty < 0 ? sum + Math.abs(l.differenceQty) : sum),
    0
  );
  const totalExcessQty = validLines.reduce(
    (sum, l) => (l.differenceQty > 0 ? sum + l.differenceQty : sum),
    0
  );
  const netVarianceVal = validLines.reduce((sum, l) => sum + l.varianceValue, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validLines.length === 0) {
      showToast('Please select at least one item to count.', 'error');
      return;
    }

    setShowAcceptModal(true);
  };

  const proceedSavePhysicalStock = () => {
    setShowAcceptModal(false);

    const payload = {
      voucherNo: voucherNo.trim() || undefined,
      originalVoucherNo: editingVoucherNo || undefined,
      date: new Date(date).toISOString(),
      verifiedBy: verifiedBy.trim(),
      remarks: remarks.trim() || 'Physical Stock Verification & Count Adjustment',
      items: validLines.map(l => ({
        ...l,
        physicalQty: Number(l.physicalQty) || 0
      }))
    };

    const res = savePhysicalStockAdjustment(payload);
    if (res.ok) {
      showToast(
        `Physical stock adjustment ${res.voucherNo} saved! Inventory synchronized.`,
        'success'
      );
      onDataRefresh();
      setSuccessModalDetails({
        voucherNo: res.voucherNo,
        voucherTypeLabel: 'Physical Stock',
        date,
        partyName: verifiedBy || 'Stock Auditor',
        amount: netVarianceVal,
        itemCount: totalItemsCounted,
        rawVoucher: res
      });
      resetForm();
    } else {
      showToast('Failed to save physical stock adjustment.', 'error');
    }
  };

  const resetForm = () => {
    setEditingVoucherNo(null);
    if (isAutoMode) {
      setVoucherNo(peekNextVoucherNo('PHYSICAL_STOCK', config));
    }
    setDate(new Date().toISOString().split('T')[0]);
    setVerifiedBy('');
    setRemarks('');
    setStockLines([]);
    setQuickSearchCode('');
  };

  const handlePhysicalBack = (): boolean => {
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
    if (activeTab === 'history') {
      setActiveTab('audit');
      return true;
    }

    const hasData =
      !!verifiedBy ||
      Boolean(remarks.trim()) ||
      !!editingVoucherNo ||
      validLines.length > 0;

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
      if ((e.key === 'F2' || e.code === 'F2') && (activeTab === 'audit' || activeTab === 'create')) {
        e.preventDefault();
        const formEl = document.getElementById('physical-stock-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };

    const handleBackEvent = (e: CustomEvent) => {
      const handled = handlePhysicalBack();
      if (handled) {
        e.preventDefault();
      }
    };
    const handleSaveEvent = (e: CustomEvent) => {
      if (activeTab === 'audit' || activeTab === 'create') {
        const formEl = document.getElementById('physical-stock-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
          e.preventDefault();
        }
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
    activeTab,
    stockLines,
    date,
    verifiedBy,
    remarks,
    editingVoucherNo,
    showQuitModal,
    showAcceptModal,
    successModalDetails,
    onNavigateBack
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingVoucherNo ? `Save changes to ${editingVoucherNo}?` : "Save Physical Stock Verification?"}
        onConfirm={proceedSavePhysicalStock}
        onCancel={() => setShowAcceptModal(false)}
      />
      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="Physical Stock Verification"
        onConfirm={() => {
          setShowQuitModal(false);
          resetForm();
          if (onNavigateBack) {
            onNavigateBack();
          }
        }}
        onCancel={() => setShowQuitModal(false)}
      />
      {/* Toast */}
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

      {/* Top Header Card: Blue Fields (Doc No, Date, Auditor) */}
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 px-3.5 shadow-xs mb-1 shrink-0 flex items-center gap-3.5 flex-wrap text-xs">
        {voucherTypeSelector}

        {/* Physical Stock Doc No. */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="ps-doc-no" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">
            Doc No.
          </label>
          <input
            id="ps-doc-no"
            type="text"
            value={voucherNo || ''}
            onChange={e => setVoucherNo(e.target.value)}
            disabled={isAutoMode}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                focusElement('ps-date');
              }
            }}
            className={`h-8 w-28 rounded-lg border px-2.5 font-mono font-bold text-slate-900 outline-none text-xs ${
              isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-emerald-600'
            }`}
          />
        </div>

        {/* Audit Date */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label htmlFor="ps-date" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">
            Audit Date
          </label>
          <input
            id="ps-date"
            type="date"
            value={date || ''}
            onChange={e => setDate(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                focusElement('ps-auditor');
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                focusElement('ps-doc-no');
              }
            }}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs"
          />
        </div>

        {/* Stock Auditor / Verified By */}
        <div className="flex items-center gap-1.5 min-w-[200px] max-w-md flex-1">
          <label htmlFor="ps-auditor" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">
            Auditor
          </label>
          <input
            id="ps-auditor"
            type="text"
            placeholder="e.g. Storekeeper"
            value={verifiedBy || ''}
            onChange={e => setVerifiedBy(e.target.value)}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                focusFirstItemOrPicker();
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                focusElement('ps-date');
              }
            }}
            className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs"
          />
        </div>
      </div>

      {activeTab === 'audit' || activeTab === 'create' ? (
        <form id="physical-stock-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Verification Table */}
          <div className="flex-1 min-h-[200px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto min-h-[140px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Item Name & Code</th>
                    <th className="py-2 px-2 w-20 text-center">Unit</th>
                    <th className="py-2 px-2.5 w-24 text-center">Book Stock</th>
                    <th className="py-2 px-2.5 w-28 text-center bg-emerald-50/80 text-emerald-900 border-x border-emerald-200">
                      Physical Count
                    </th>
                    <th className="py-2 px-2.5 w-28 text-center">Variance (Qty)</th>
                    <th className="py-2 px-2.5 w-24 text-right">Cost Rate</th>
                    <th className="py-2 px-2.5 w-28 text-right">Valuation Diff</th>
                    <th className="py-2 px-2 w-20 text-center">
                      <button
                        type="button"
                        onClick={handleLoadAllItems}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800 hover:bg-slate-300 transition cursor-pointer"
                        title="Load all inventory items"
                      >
                        <Sparkles className="h-3 w-3 text-amber-600" />
                        <span>All</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockLines.length > 0 &&
                    stockLines.map((line, idx) => {
                      const isExcess = line.differenceQty > 0;
                      const isShortage = line.differenceQty < 0;
                      const hasDiff = line.differenceQty !== 0 && !!line.itemCode;

                      return (
                        <tr
                          key={line.itemCode || `row-${idx}`}
                          className={`hover:bg-slate-50/60 transition ${
                            hasDiff ? (isExcess ? 'bg-emerald-50/20' : 'bg-rose-50/20') : ''
                          }`}
                        >
                          {/* Item Selection Box */}
                          <td className="py-1.5 px-3 min-w-[220px]">
                            <SearchableItemSelect
                              id={`ps-item-${idx}`}
                              valueCode={line.itemCode}
                              items={items}
                              variant="grid"
                              placeholder="Select or search item..."
                              currencySymbol={currencySymbol}
                              priceType="purchase"
                              onCreateNew={onOpenNewItemModal}
                              dropdownPosition={idx > 3 ? 'up' : 'down'}
                              onSelect={selectedItem => handleItemSelect(idx, selectedItem['Item Code'])}
                              onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'item'))}
                            />
                          </td>

                          {/* Unit */}
                          <td className="py-1.5 px-2 text-center font-semibold text-slate-600 text-xs">
                            {line.unit || 'Pcs'}
                          </td>

                          {/* Book Stock */}
                          <td className="py-1.5 px-2.5 text-center font-extrabold text-slate-700">
                            {line.itemCode ? line.bookQty : '-'}
                          </td>

                          {/* Physical Count */}
                          <td className="py-1 px-2.5 text-center bg-emerald-50/30 border-x border-emerald-100">
                            <input
                              id={`ps-qty-${idx}`}
                              type="number"
                              step="any"
                              disabled={!line.itemCode}
                              value={line.physicalQty !== undefined && line.physicalQty !== null ? line.physicalQty : ''}
                              onFocus={e => e.target.select()}
                              onChange={e =>
                                handlePhysicalQtyChange(
                                  idx,
                                  e.target.value === '' ? '' : parseFloat(e.target.value)
                                )
                              }
                              onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                              className="w-full text-center rounded-md border border-emerald-300 bg-white px-2 py-1 font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 text-xs disabled:bg-slate-100 disabled:border-slate-200"
                            />
                          </td>

                          {/* Variance (Qty) */}
                          <td className="py-1.5 px-2.5 text-center">
                            {!line.itemCode ? (
                              <span className="text-slate-300">-</span>
                            ) : hasDiff ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-black text-[10px] ${
                                  isExcess
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isExcess ? '+' : ''}
                                {line.differenceQty} {isExcess ? '(Excess)' : '(Shortage)'}
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-400 text-[11px]">0 (Match)</span>
                            )}
                          </td>

                          {/* Cost Rate */}
                          <td className="py-1.5 px-2.5 text-right font-semibold text-slate-600">
                            {line.itemCode ? `${currencySymbol} ${line.rate.toFixed(2)}` : '-'}
                          </td>

                          {/* Valuation Diff */}
                          <td className="py-1.5 px-2.5 text-right font-bold">
                            {!line.itemCode ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              <span
                                className={
                                  isExcess
                                    ? 'text-emerald-700'
                                    : isShortage
                                    ? 'text-rose-700'
                                    : 'text-slate-500'
                                }
                              >
                                {isExcess ? '+' : ''}
                                {currencySymbol} {line.varianceValue.toFixed(2)}
                              </span>
                            )}
                          </td>

                          {/* Remove Action */}
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer rounded-md hover:bg-rose-50"
                              title="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {/* Fast Item Picker Row at bottom of table */}
                  <tr className="bg-slate-50/80 border-t-2 border-slate-200">
                    <td colSpan={2} className="py-1.5 px-3">
                      <SearchableItemSelect
                        id="ps-fast-item-picker"
                        valueCode={quickSearchCode}
                        items={items}
                        variant="grid"
                        placeholder="+ Type Item Name or Scan Barcode to Add..."
                        currencySymbol={currencySymbol}
                        priceType="purchase"
                        onCreateNew={onOpenNewItemModal}
                        autoClearAfterSelect={true}
                        dropdownPosition="down"
                        onEndOfList={() => {
                          const r = document.getElementById('ps-remarks');
                          if (r) {
                            r.focus();
                          } else {
                            document.getElementById('ps-save-btn')?.focus();
                          }
                        }}
                        onSelect={selectedItem => {
                          handleQuickAddItem(selectedItem);
                          setQuickSearchCode('');
                        }}
                        onClear={() => setQuickSearchCode('')}
                      />
                    </td>
                    <td colSpan={6} className="py-1.5 px-3 text-slate-400 italic text-[11px]">
                      Scan barcode or select item above to add to physical count
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Summary Bar & Action Button */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-4 font-bold text-slate-600 flex-wrap">
              <div>
                <span>Counted: </span>
                <span className="text-slate-900 font-extrabold">{totalItemsCounted} items</span>
              </div>
              <div>
                <span>Discrepancies: </span>
                <span className="text-amber-700 font-extrabold">{changedLines.length}</span>
              </div>
              {totalExcessQty > 0 && (
                <div className="text-emerald-700">
                  <span>Excess: </span>
                  <span className="font-extrabold">+{totalExcessQty}</span>
                </div>
              )}
              {totalShortageQty > 0 && (
                <div className="text-rose-700">
                  <span>Shortage: </span>
                  <span className="font-extrabold">-{totalShortageQty}</span>
                </div>
              )}
              <div
                className={`rounded-lg px-2.5 py-1 font-black text-xs border ${
                  netVarianceVal >= 0
                    ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
                    : 'bg-rose-100/80 border-rose-300 text-rose-950'
                }`}
              >
                Net Variance: {netVarianceVal >= 0 ? '+' : ''}
                {currencySymbol} {netVarianceVal.toFixed(2)}
              </div>
            </div>

            {/* Moved Remarks Field */}
            <div className="flex items-center gap-1.5 min-w-[200px] max-w-xs flex-1">
              <label htmlFor="ps-remarks" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">
                Remarks
              </label>
              <input
                id="ps-remarks"
                type="text"
                placeholder="e.g. Month-end warehouse audit"
                value={remarks || ''}
                onChange={e => setRemarks(e.target.value)}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('ps-save-btn')?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusFirstItemOrPicker();
                  }
                }}
                className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                id="ps-save-btn"
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-[4px] focus:ring-emerald-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(52,211,153,0.6)] z-10 relative focus:scale-[1.02] outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Reconcile & Save (F2)</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Historical Audit Records */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3 text-xs flex-1 overflow-y-auto">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Past Physical Stock Audit Records
          </h3>

          {savedRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Boxes className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No physical stock audits performed yet</p>
              <p className="text-[11px]">Click "Audit Records" to switch views</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Audit Doc No</th>
                    <th className="py-2.5 px-3">Auditor / Verified By</th>
                    <th className="py-2.5 px-3 text-center">Items Counted</th>
                    <th className="py-2.5 px-3 text-center">Excess (Qty)</th>
                    <th className="py-2.5 px-3 text-center">Shortage (Qty)</th>
                    <th className="py-2.5 px-3 text-right">Net Value Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedRecords.map((r, idx) => (
                    <tr key={`${r.voucherNo || 'rec'}-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                        {r.voucherNo}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {r.verifiedBy || 'System Admin'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {r.totalItemsCounted} items
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                        +{r.totalExcessQty}
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-700 font-bold">
                        -{r.totalShortageQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {currencySymbol} {r.netVarianceValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Post-Save Universal Print / Share Action Modal */}
      <VoucherSuccessActionModal
        isOpen={!!successModalDetails}
        onClose={() => setSuccessModalDetails(null)}
        details={successModalDetails}
      />
    </div>
  );
};
