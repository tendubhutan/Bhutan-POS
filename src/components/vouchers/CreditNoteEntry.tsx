import React, { useState, useEffect } from 'react';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger } from '../../types';
import { saveCreditNote, peekNextVoucherNo } from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { generateCreditNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';
import {
  Undo2, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, Sparkles, Receipt, Share2, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface CreditNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
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

export const CreditNoteEntry: React.FC<CreditNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintVoucher,
  onNavigateBack
}) => {
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
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
  const [itemLines, setItemLines] = useState<ItemLine[]>([
    {
      id: '1',
      itemCode: items[0]?.['Item Code'] || '',
      itemName: items[0]?.['Item Name'] || '',
      qty: 1,
      rate: items[0]?.['Sale Rate'] || 0,
      gstPct: items[0]?.['GST %'] || 0,
      amount: items[0]?.['Sale Rate'] || 0
    }
  ]);

  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  useEffect(() => {
    if (isAutoMode) {
      setVoucherNo(peekNextVoucherNo('CN', config));
    }
  }, [config, isAutoMode]);

  // Set default customer
  useEffect(() => {
    if (!partyLedger && ledgers.length > 0) {
      const debtor = ledgers.find(l => l.Group === 'Sundry Debtors')?.['Ledger Name'] || ledgers[0]['Ledger Name'];
      setPartyLedger(debtor);
    }
    if (ledgers.some(l => l['Ledger Name'] === 'Sales Return')) {
      setSalesReturnLedger('Sales Return');
    }
  }, [ledgers]);

  
  useEffect(() => {
    if (itemLines.length > 0 && partyLedger) {
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
    const firstItem = items[0];
    setItemLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        itemCode: firstItem?.['Item Code'] || '',
        itemName: firstItem?.['Item Name'] || '',
        qty: 1,
        rate: firstItem?.['Sale Rate'] || 0,
        gstPct: firstItem?.['GST %'] || 0,
        amount: firstItem?.['Sale Rate'] || 0
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

    const partyObj = ledgers.find(l => l['Ledger Name'] === partyLedger);

    const payload = {
      voucherNo: voucherNo.trim() || undefined,
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
            qty: Number(l.qty) || 0,
            rate: Number(l.rate) || 0,
            gstPct: Number(l.gstPct) || 0,
            amount: Number(l.amount) || 0
          }))
        : undefined
    };

    const res = saveCreditNote(payload);
    if (res.ok) {
      showToast(`Credit Note ${res.voucherNo} created successfully!`, 'success');
      onDataRefresh();

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
          const firstItem = items[0];
          setItemLines([
            {
              id: String(Date.now()),
              itemCode: firstItem?.['Item Code'] || '',
              itemName: firstItem?.['Item Name'] || '',
              qty: 1,
              rate: firstItem?.['Sale Rate'] || 0,
              gstPct: firstItem?.['GST %'] || 0,
              amount: firstItem?.['Sale Rate'] || 0
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

  // Global F2, Escape, and app event listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
        const formEl = document.getElementById('credit-note-form') as HTMLFormElement | null;
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
  }, [totalCreditAmount, partyLedger, date, originalInvoiceRef, itemLines, lumpSumAmount, lumpSumGst, successModalDetails, onNavigateBack]);

  return (
    <form id="credit-note-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 space-y-2">
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
      <div className="rounded-xl border border-purple-200 bg-linear-to-r from-purple-50/90 to-indigo-50/70 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-xs">
            <Undo2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-purple-950 leading-tight">
              Credit Note (Sales Return & Customer Allowance)
            </h2>
            <p className="text-[11px] text-purple-700 font-medium">
              Issue credit against customer returns, rate concessions, or billing adjustments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white/90 p-0.5 rounded-lg border border-purple-200 text-xs">
          <button
            type="button"
            onClick={() => setHasStockReturn(true)}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              hasStockReturn
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-purple-800 hover:bg-purple-100/50'
            }`}
          >
            📦 Return Goods into Stock
          </button>
          <button
            type="button"
            onClick={() => setHasStockReturn(false)}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              !hasStockReturn
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-purple-800 hover:bg-purple-100/50'
            }`}
          >
            💰 Accounting Adjustment Only
          </button>
        </div>
      </div>

      {/* Header Fields Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
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
              className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-purple-600'
              }`}
            />
          </div>

          <div>
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
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-purple-600 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Customer (Debtor)</label>
            <SearchableLedgerSelect
              id="cn-customer"
              ledgers={ledgers}
              value={partyLedger || ''}
              onChange={setPartyLedger}
              filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
              onCreateNew={() => onOpenQuickLedger('Sundry Debtors')}
              placeholder="Select Customer Ledger"
              onEnterNext={() => focusElement('cn-original-ref')}
              onArrowRight={() => focusElement('cn-original-ref')}
              onArrowDown={() => focusElement('cn-original-ref')}
              onArrowLeft={() => focusElement('cn-date')}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Original Invoice Ref.</label>
            <input
              id="cn-original-ref"
              type="text"
              placeholder="e.g. INV-1002"
              value={originalInvoiceRef || ''}
              onChange={e => setOriginalInvoiceRef(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusElement('cn-sales-return');
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusElement('cn-customer');
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-purple-600 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-100">
          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Sales Return / Debit Account</label>
            <SearchableLedgerSelect
              id="cn-sales-return"
              ledgers={ledgers}
              value={salesReturnLedger || ''}
              onChange={setSalesReturnLedger}
              placeholder="Sales Return or Sales Account"
              onEnterNext={() => focusElement('cn-narration')}
              onArrowRight={() => focusElement('cn-narration')}
              onArrowDown={() => focusElement('cn-narration')}
              onArrowLeft={() => focusElement('cn-original-ref')}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Narration / Reason</label>
            <input
              id="cn-narration"
              type="text"
              placeholder="Reason for return or credit note..."
              value={narration || ''}
              onChange={e => setNarration(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (hasStockReturn) {
                    focusElement('cn-item-0-qty');
                  } else {
                    focusElement('cn-lumpsum-amt');
                  }
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusElement('cn-sales-return');
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-purple-600 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Item Lines Grid or Lump Sum Fields */}
      {hasStockReturn ? (
        <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
              <Package className="h-4 w-4 text-purple-600" />
              Returned Items ({itemLines.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItemLine}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 font-bold text-purple-700 hover:bg-purple-100 transition shadow-2xs cursor-pointer"
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
                      <SearchableItemSelect
                        valueCode={line.itemCode}
                        items={items}
                        placeholder="Search item name or scan barcode..."
                        currencySymbol={currencySymbol}
                        onCreateNew={onOpenNewItemModal}
                        onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={selectedItem => {
                          const qty = Number(line.qty) || 1;
                          const rate = selectedItem['Sale Rate'] || 0;
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
                        }}
                      />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
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
                        type="number"
                        min="0"
                        step="any"
                        value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
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
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.gstPct !== undefined && line.gstPct !== null ? line.gstPct : 0}
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
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Save Credit Note (F2)</span>
          </button>
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
