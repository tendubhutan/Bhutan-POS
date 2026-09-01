import React, { useState, useEffect } from 'react';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, PhysicalStockItem, PhysicalStockVoucher } from '../../types';
import {
  savePhysicalStockAdjustment, getPhysicalStockRecords, peekNextVoucherNo
} from '../../services/storageService';
import {
  Boxes, Plus, Trash2, CheckCircle2, AlertCircle, Package, RotateCcw, Sparkles, TrendingDown, TrendingUp, Scale, Printer, Share2, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { generatePhysicalStockPDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface PhysicalStockEntryProps {
  config: Config;
  items: Item[];
  onDataRefresh: () => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onNavigateBack?: () => void;
}

export const PhysicalStockEntry: React.FC<PhysicalStockEntryProps> = ({
  config,
  items,
  onDataRefresh,
  onOpenNewItemModal,
  onNavigateBack
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [voucherNo, setVoucherNo] = useState(() => (isAutoMode ? peekNextVoucherNo('PHYSICAL_STOCK', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'audit' | 'history' | 'register'>('create');
  const [savedRecords, setSavedRecords] = useState<PhysicalStockVoucher[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [quickSearchCode, setQuickSearchCode] = useState('');

  // Count lines state
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
    if (isAutoMode) {
      setVoucherNo(peekNextVoucherNo('PHYSICAL_STOCK', config));
    }
  }, [config, isAutoMode]);

  // Prepopulate initial stock lines
  useEffect(() => {
    if (stockLines.length === 0 && items.length > 0) {
      const initial = items.slice(0, 8).map(it => {
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
      setStockLines(initial);
    }
  }, [items]);

  
  useEffect(() => {
    if (stockLines.length > 0 && true) {
      setIsHeaderCollapsed(true);
    } else if (stockLines.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [stockLines.length]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
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

  const handlePhysicalQtyChange = (code: string, val: number | '') => {
    setStockLines(prev =>
      prev.map(line => {
        if (line.itemCode === code) {
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

  const handleRemoveLine = (code: string) => {
    setStockLines(prev => prev.filter(l => l.itemCode !== code));
  };

  // Summary Metrics
  const totalItemsCounted = stockLines.length;
  const changedLines = stockLines.filter(l => l.differenceQty !== 0);
  const totalShortageQty = stockLines.reduce(
    (sum, l) => (l.differenceQty < 0 ? sum + Math.abs(l.differenceQty) : sum),
    0
  );
  const totalExcessQty = stockLines.reduce(
    (sum, l) => (l.differenceQty > 0 ? sum + l.differenceQty : sum),
    0
  );
  const netVarianceVal = stockLines.reduce((sum, l) => sum + l.varianceValue, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (stockLines.length === 0) {
      showToast('Please add items to count.', 'error');
      return;
    }

    const payload = {
      voucherNo: voucherNo.trim() || undefined,
      date: new Date(date).toISOString(),
      verifiedBy: verifiedBy.trim(),
      remarks: remarks.trim() || 'Physical Stock Verification & Count Adjustment',
      items: stockLines.map(l => ({
        ...l,
        physicalQty: Number(l.physicalQty) || 0
      }))
    };

    const res = savePhysicalStockAdjustment(payload);
    if (res.ok) {
      showToast(
        `Physical stock adjustment ${res.voucherNo} posted! Inventory synchronized.`,
        'success'
      );
      onDataRefresh();
      loadHistory();

      const savedObj = {
        ...payload,
        voucherNo: res.voucherNo,
        totalItemsCounted,
        totalExcessQty,
        totalShortageQty,
        netVarianceValue: netVarianceVal
      };

      setSuccessModalDetails({
        voucherNo: res.voucherNo,
        voucherType: 'Physical Stock Audit',
        date: payload.date,
        partyName: verifiedBy || 'Physical Warehouse Count',
        totalAmount: Math.abs(netVarianceVal),
        totalItems: stockLines.length,
        currencySymbol,
        onPrint: () => {
          const doc = generatePhysicalStockPDF(savedObj, config);
          doc.autoPrint();
          window.open(doc.output('bloburl'), '_blank');
        },
        onShare: () => {
          const doc = generatePhysicalStockPDF(savedObj, config);
          shareOrDownloadPDF(doc, `PhysicalStockAudit_${res.voucherNo}.pdf`, `Physical Stock Audit ${res.voucherNo}`);
        },
        onDownload: () => {
          const doc = generatePhysicalStockPDF(savedObj, config);
          doc.save(`PhysicalStockAudit_${res.voucherNo}.pdf`);
        },
        onNewVoucher: () => {
          if (isAutoMode) {
            setVoucherNo(peekNextVoucherNo('PHYSICAL_STOCK', config));
          }
        }
      });

      if (isAutoMode) {
        setVoucherNo(peekNextVoucherNo('PHYSICAL_STOCK', config));
      }
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

  // Global F2 listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && activeTab === 'audit') {
        e.preventDefault();
        const formEl = document.getElementById('physical-stock-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, stockLines, date, verifiedBy, remarks]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
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

      {/* Top Banner */}
      <div className="rounded-xl border border-emerald-200 bg-linear-to-r from-emerald-50/90 to-teal-50/70 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
            <Boxes className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-emerald-950 leading-tight">
              Physical Stock Verification & Inventory Reconciliation
            </h2>
            <p className="text-[11px] text-emerald-700 font-medium">
              Record physical warehouse counts, audit discrepancies & automatically reconcile book stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white/90 p-0.5 rounded-lg border border-emerald-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-800 hover:bg-emerald-100/50'
            }`}
          >
            📋 Stock Count & Audit
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-800 hover:bg-emerald-100/50'
            }`}
          >
            📜 Audit Records ({savedRecords.length})
          </button>
        </div>
      </div>

      {activeTab === 'audit' ? (
        <form id="physical-stock-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Header Grid */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300 mb-2">
            {isHeaderCollapsed ? (
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-violet-100 transition-colors bg-gradient-to-r from-violet-50 to-purple-50 border-b-2 border-violet-200"
                onClick={() => setIsHeaderCollapsed(false)}
                title="Click to expand header details"
              >
                <div className="flex items-center gap-6 text-sm">
                  
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Date</span>
                    <span className="font-bold text-slate-800">{date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Voucher No</span>
                    <span className="font-bold text-slate-800">{voucherNo || '-'}</span>
                  </div>
                </div>
                <button type="button" className="flex items-center gap-1.5 text-xs font-black text-violet-600 hover:text-violet-800 uppercase tracking-wide bg-white px-3 py-1 rounded-lg shadow-sm border border-violet-100">
                  <span>Edit Header</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="p-2.5 space-y-2 relative">
                <div className="absolute top-2 right-2">
                  <button 
                    type="button"
                    onClick={() => setIsHeaderCollapsed(true)}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-violet-600 uppercase tracking-wide cursor-pointer transition-colors"
                    title="Collapse to save space"
                  >
                    <span>Collapse</span>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Physical Stock Doc No.</label>
                <input
                  id="ps-doc-no"
                  type="text"
                  value={voucherNo}
                  onChange={e => setVoucherNo(e.target.value)}
                  disabled={isAutoMode}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('ps-date');
                    }
                  }}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                    isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-emerald-600'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Audit Date</label>
                <input
                  id="ps-date"
                  type="date"
                  value={date}
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Stock Auditor / Verified By</label>
                <input
                  id="ps-auditor"
                  type="text"
                  placeholder="e.g. Storekeeper"
                  value={verifiedBy}
                  onChange={e => setVerifiedBy(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('ps-remarks');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('ps-date');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Remarks / Location</label>
                <input
                  id="ps-remarks"
                  type="text"
                  placeholder="e.g. Month-end warehouse audit"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (stockLines.length > 0) {
                        focusElement(`ps-qty-${stockLines[0].itemCode}`);
                      } else {
                        focusElement('ps-save-btn');
                      }
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('ps-auditor');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-emerald-600 text-xs"
                />
              </div>
            </div>
              </div>
            )}
          </div>

          {/* Verification Table */}
          <div className="flex-1 min-h-[200px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  Physical Count vs Book Balance ({stockLines.length} items)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Fast find bar */}
                <div className="w-64">
                  <SearchableItemSelect
                    valueCode={quickSearchCode}
                    items={items}
                    placeholder="Quick add item to count..."
                    currencySymbol={currencySymbol}
                    priceType="purchase"
                    onCreateNew={onOpenNewItemModal}
                    autoClearAfterSelect={true}
                    dropdownPosition="down"
                    onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={selectedItem => {
                      const code = selectedItem['Item Code'];
                      const exists = stockLines.some(l => l.itemCode === code);
                      if (!exists) {
                        const book = Number(selectedItem['Current Stock']) || 0;
                        const newLine: PhysicalStockItem = {
                          itemCode: selectedItem['Item Code'],
                          itemName: selectedItem['Item Name'],
                          unit: selectedItem.Unit || 'Pcs',
                          bookQty: book,
                          physicalQty: book,
                          differenceQty: 0,
                          rate: Number(selectedItem['Purchase Rate']) || 0,
                          varianceValue: 0
                        };
                        setStockLines(prev => [newLine, ...prev]);
                      }
                      setQuickSearchCode('');
                      focusElement(`ps-qty-${code}`);
                    }}
                    onClear={() => setQuickSearchCode('')}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLoadAllItems}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs cursor-pointer text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Load All ({items.length})</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[140px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs z-10 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Item Name & Code</th>
                    <th className="py-2 px-2 w-16 text-center">Unit</th>
                    <th className="py-2 px-2.5 w-24 text-center">Book Stock</th>
                    <th className="py-2 px-2.5 w-28 text-center bg-emerald-50/80 text-emerald-900 border-x border-emerald-200">
                      Physical Count
                    </th>
                    <th className="py-2 px-2.5 w-28 text-center">Variance (Qty)</th>
                    <th className="py-2 px-2.5 w-24 text-right">Cost Rate</th>
                    <th className="py-2 px-2.5 w-28 text-right">Valuation Diff</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockLines.map((line, idx) => {
                    const isExcess = line.differenceQty > 0;
                    const isShortage = line.differenceQty < 0;
                    const hasDiff = line.differenceQty !== 0;

                    return (
                      <tr
                        key={line.itemCode}
                        className={`hover:bg-slate-50/60 transition ${
                          hasDiff ? (isExcess ? 'bg-emerald-50/20' : 'bg-rose-50/20') : ''
                        }`}
                      >
                        <td className="py-1.5 px-3">
                          <div className="font-bold text-slate-900">{line.itemName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{line.itemCode}</div>
                        </td>

                        <td className="py-1.5 px-2 text-center font-semibold text-slate-600 text-xs">
                          {line.unit}
                        </td>

                        <td className="py-1.5 px-2.5 text-center font-extrabold text-slate-700">
                          {line.bookQty}
                        </td>

                        <td className="py-1 px-2.5 text-center bg-emerald-50/30 border-x border-emerald-100">
                          <input
                            id={`ps-qty-${line.itemCode}`}
                            type="number"
                            step="any"
                            value={line.physicalQty}
                            onFocus={e => e.target.select()}
                            onChange={e =>
                              handlePhysicalQtyChange(
                                line.itemCode,
                                e.target.value === '' ? '' : parseFloat(e.target.value)
                              )
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                if (idx < stockLines.length - 1) {
                                  focusElement(`ps-qty-${stockLines[idx + 1].itemCode}`);
                                } else {
                                  focusElement('ps-save-btn');
                                }
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (idx > 0) {
                                  focusElement(`ps-qty-${stockLines[idx - 1].itemCode}`);
                                } else {
                                  focusElement('ps-remarks');
                                }
                              }
                            }}
                            className="w-full text-center rounded-md border border-emerald-300 bg-white px-2 py-0.5 font-black text-slate-900 outline-none focus:ring-1 focus:ring-emerald-400 text-xs"
                          />
                        </td>

                        <td className="py-1.5 px-2.5 text-center">
                          {hasDiff ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 font-black text-[10px] ${
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

                        <td className="py-1.5 px-2.5 text-right font-semibold text-slate-600">
                          {currencySymbol} {line.rate.toFixed(2)}
                        </td>

                        <td className="py-1.5 px-2.5 text-right font-bold">
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
                        </td>

                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.itemCode)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Summary Bar & Action Button */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
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

            <div className="flex items-center gap-2">
              <button
                id="ps-save-btn"
                type="submit"
                onKeyDown={e => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (stockLines.length > 0) {
                      focusElement(`ps-qty-${stockLines[stockLines.length - 1].itemCode}`);
                    } else {
                      focusElement('ps-remarks');
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-2 focus:ring-emerald-400 outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Reconcile & Save (F2)</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Historical Audit Records */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3 text-xs">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Past Physical Stock Audit Records
          </h3>

          {savedRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Boxes className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No physical stock audits performed yet</p>
              <p className="text-[11px]">Click "Stock Count & Audit" to record warehouse stock</p>
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
