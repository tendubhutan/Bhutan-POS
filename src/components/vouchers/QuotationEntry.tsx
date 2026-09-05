import React, { useState, useEffect } from 'react';
import { GlowButton } from '../common/GlowButton';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger, Quotation, QuotationItem } from '../../types';
import {
  saveQuotation, getQuotations, deleteQuotation, updateQuotationStatus, peekNextVoucherNo
} from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import {
  FileCheck2, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, Calendar, Send, ArrowRight, Sparkles, Share2, Download, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { generateQuotationPDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface QuotationEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintQuotation?: (quote: Quotation) => void;
  onNavigateBack?: () => void;
}

export const QuotationEntry: React.FC<QuotationEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  initialVoucherTarget,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintQuotation,
  onNavigateBack
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingQuotationNo, setEditingQuotationNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [quotationNo, setQuotationNo] = useState(() => (isAutoMode ? peekNextVoucherNo('QUOTATION', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Valid until date (default 15 days later)
  const defaultValidDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [validUntil, setValidUntil] = useState(defaultValidDate);

  const [customerName, setCustomerName] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Prices are valid for 15 days.\n2. Goods once sold will not be taken back.\n3. Payment terms: 100% advance or on delivery.'
  );
  const [remarks, setRemarks] = useState('');

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [savedQuotes, setSavedQuotes] = useState<Quotation[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);

  // Line items state
  const [quoteItems, setQuoteItems] = useState<QuotationItem[]>([]);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate' | 'disc' | 'gst') => ({
    prefix: 'qt',
    idx,
    field,
    totalRows: quoteItems.length,
    searchPickerId: 'qt-fast-item-picker',
    hasDiscount: true,
    hasGst: true,
    onDeleteRow: (i: number) => handleRemoveItem(i),
    onOpenNewItemModal: () => onOpenNewItemModal && onOpenNewItemModal(),
  });

  
  useEffect(() => {
    if (quoteItems.length > 0 && customerName) {
      setIsHeaderCollapsed(true);
    } else if (quoteItems.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [quoteItems.length]);

  const loadSavedQuotations = () => {
    const list = getQuotations();
    setSavedQuotes(list);
  };

  useEffect(() => {
    loadSavedQuotations();
  }, []);

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const all = getQuotations();
      const q = all.find(x => x.quotationNo === initialVoucherTarget.voucherNo);
      if (q) {
        setEditingQuotationNo(q.quotationNo);
        setQuotationNo(q.quotationNo);
        if (q.date) setDate(new Date(q.date).toISOString().split('T')[0]);
        if (q.validUntil) setValidUntil(new Date(q.validUntil).toISOString().split('T')[0]);
        if (q.customer) {
          const cName = typeof q.customer === 'object' ? (q.customer.name || q.customer.ledger || '') : q.customer;
          setCustomerName(cName);
          if (typeof q.customer === 'object') {
            setContactNo((q.customer as any).contact || (q.customer as any).contactNo || '');
            setAddress(q.customer.address || '');
            setGstin((q.customer as any).gstin || (q.customer as any).gstNo || '');
          }
        }
        if (q.paymentTerms) setTermsAndConditions(q.paymentTerms);
        if (q.remarks) setRemarks(q.remarks);
        if (Array.isArray(q.items)) {
          setQuoteItems(q.items.map((it: any) => {
            const qty = it.qty !== undefined ? Number(it.qty) : (it.Qty !== undefined ? Number(it.Qty) : 1);
            const rate = it.rate !== undefined ? Number(it.rate) : (it.Rate !== undefined ? Number(it.Rate) : 0);
            const discount = it.discount !== undefined ? Number(it.discount) : (it.Discount !== undefined ? Number(it.Discount) : 0);
            const gstPct = it.gstPct !== undefined ? Number(it.gstPct) : (it['GST %'] !== undefined ? Number(it['GST %']) : 0);
            const taxableValue = (qty * rate) - discount;
            const gstAmount = (taxableValue * gstPct) / 100;
            const lineTotal = taxableValue + gstAmount;

            return {
              itemCode: it.itemCode || it['Item Code'] || '',
              itemName: it.itemName || it['Item Name'] || '',
              description: it.description || it['Item Description'] || '',
              unit: it.unit || it.Unit || 'Pcs',
              qty,
              rate,
              discount,
              taxableValue,
              gstPct,
              gstAmount,
              zeroRated: it.zeroRated || false,
              lineTotal
            };
          }));
        }
        setActiveTab('create');
      }
    }
  }, [initialVoucherTarget]);

  useEffect(() => {
    if (isAutoMode && !editingQuotationNo) {
      setQuotationNo(peekNextVoucherNo('QUOTATION', config));
    }
  }, [config, isAutoMode, editingQuotationNo]);

  // Set default customer
  useEffect(() => {
    // Disabled auto-fill to keep ledger fields empty by default
  }, [ledgers]);

  // Sync customer details when ledger changes
  useEffect(() => {
    const matched = ledgers.find(l => l['Ledger Name'] === customerName);
    if (matched) {
      if (matched['Contact No']) setContactNo(matched['Contact No']);
      if (matched['GST No'] || matched['TPN No']) setGstin(matched['GST No'] || matched['TPN No'] || '');
    }
  }, [customerName, ledgers]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleAddItem = () => {
    const firstItem = items[0];
    setQuoteItems(prev => [
      ...prev,
      {
        itemCode: firstItem?.['Item Code'] || '',
        itemName: firstItem?.['Item Name'] || '',
        qty: 1,
        unit: firstItem?.Unit || 'Pcs',
        rate: firstItem?.['Sale Rate'] || 0,
        discount: 0, taxableValue: 0, gstAmount: 0, zeroRated: "N",
      gstPct: firstItem?.['GST %'] || 0,
        lineTotal: firstItem?.['Sale Rate'] || 0
      }
    ]);
  };

  const handleQuickAddItem = (selectedItem: Item) => {
    const qty = 1;
    const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
    const unit = selectedItem.Unit || 'Pcs';
    const gst = selectedItem['GST %'] || 0;

    const existingIdx = quoteItems.findIndex(l => l.itemCode === selectedItem['Item Code']);
    let updatedItems = [...quoteItems];
    let targetIndex = existingIdx;

    if (existingIdx > -1) {
      const newQty = (Number(updatedItems[existingIdx].qty) || 0) + qty;
      const r = Number(updatedItems[existingIdx].rate) || 0;
      const disc = Number(updatedItems[existingIdx].discount) || 0;
      const discAmt = (newQty * r * disc) / 100;
      updatedItems[existingIdx] = {
        ...updatedItems[existingIdx],
        qty: newQty,
        lineTotal: (newQty * r) - discAmt
      };
    } else {
      const newLine: QuotationItem = {
        itemCode: selectedItem['Item Code'],
        itemName: selectedItem['Item Name'],
        qty,
        unit,
        rate,
        discount: 0,
        taxableValue: rate,
        gstAmount: 0,
        zeroRated: selectedItem['Zero Rated (Y/N)'] || 'N',
        gstPct: gst,
        lineTotal: rate,
        description: ''
      };
      if (quoteItems.length === 1 && !quoteItems[0].itemCode) {
        updatedItems = [newLine];
        targetIndex = 0;
      } else {
        updatedItems.push(newLine);
        targetIndex = updatedItems.length - 1;
      }
    }

    setQuoteItems(updatedItems);
    showToast(`Added: ${selectedItem['Item Name']}`, 'success');

    setTimeout(() => {
      const qtyEl = document.getElementById(`qt-qty-${targetIndex}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    if (quoteItems.length <= 1) {
      showToast('Quotation must have at least one line item.', 'error');
      return;
    }
    setQuoteItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemSelect = (index: number, code: string) => {
    const target = items.find(i => i['Item Code'] === code);
    if (!target) return;
    setQuoteItems(prev =>
      prev.map((l, i) => {
        if (i === index) {
          const qty = Number(l.qty) || 1;
          const rate = target['Sale Rate'] || 0;
          const disc = Number(l.discount) || 0;
          const lineGross = qty * rate;
          const discAmt = (lineGross * disc) / 100;
          return {
            ...l,
            itemCode: target['Item Code'],
            itemName: target['Item Name'],
            unit: target.Unit || 'Pcs',
            rate,
            gstPct: target['GST %'] || 0,
            lineTotal: lineGross - discAmt
          };
        }
        return l;
      })
    );
  };

  const handleLineFieldChange = (
    index: number,
    field: 'qty' | 'rate' | 'discount' | 'gstPct',
    val: number | ''
  ) => {
    setQuoteItems(prev =>
      prev.map((l, i) => {
        if (i === index) {
          const updated = { ...l, [field]: val };
          const q = Number(updated.qty) || 0;
          const r = Number(updated.rate) || 0;
          const disc = Number(updated.discount) || 0;
          const lineGross = q * r;
          const discAmt = (lineGross * disc) / 100;
          updated.lineTotal = lineGross - discAmt;
          return updated;
        }
        return l;
      })
    );
  };

  // Totals calculations
  const grossSubtotal = quoteItems.reduce((sum, it) => {
    const q = Number(it.qty) || 0;
    const r = Number(it.rate) || 0;
    return sum + q * r;
  }, 0);

  const totalDiscount = quoteItems.reduce((sum, it) => {
    const q = Number(it.qty) || 0;
    const r = Number(it.rate) || 0;
    const disc = Number(it.discount) || 0;
    return sum + (q * r * disc) / 100;
  }, 0);

  const taxableTotal = quoteItems.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0);

  const totalGst = quoteItems.reduce((sum, it) => {
    const lineTaxable = Number(it.lineTotal) || 0;
    const gstP = Number(it.gstPct) || 0;
    return sum + (lineTaxable * gstP) / 100;
  }, 0);

  const netQuotationTotal = taxableTotal + totalGst;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      showToast('Please enter or select a customer name.', 'error');
      return;
    }

    if (netQuotationTotal <= 0) {
      showToast('Quotation total must be greater than zero.', 'error');
      return;
    }

    setShowAcceptModal(true);
  };

  const proceedSaveQuotation = () => {
    setShowAcceptModal(false);

    const payload = {
      quotationNo: quotationNo.trim() || undefined,
      date: new Date(date).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      customer: {
        ledger: customerName,
        name: customerName,
        contact: contactNo.trim(),
        address: address.trim(),
        gstin: gstin.trim()
      },
      taxable: taxableTotal, zeroRated: 0, gstAmt: totalGst,
      total: netQuotationTotal,
      status: 'Draft' as const,
      paymentTerms: termsAndConditions.trim(),
      deliveryTerms: 'Standard delivery',
      remarks: remarks.trim(),
      items: quoteItems.map(it => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        qty: Number(it.qty) || 0,
        unit: it.unit || 'Pcs',
        rate: Number(it.rate) || 0,
        discount: Number(it.discount) || 0,
        gstPct: Number(it.gstPct) || 0,
        taxableValue: it.taxableValue || (Number(it.qty) * Number(it.rate)),
        gstAmount: it.gstAmount || 0,
        zeroRated: 'N' as const,
        lineTotal: Number(it.lineTotal) || 0
      }))
    };

    const res = saveQuotation(payload as any);
    if (res.ok) {
      showToast(`Quotation ${res.quotationNo} saved successfully!`, 'success');
      onDataRefresh();
      loadSavedQuotations();
      setEditingQuotationNo(null);

      const savedObj: Quotation = {
        ...payload,
        quotationNo: res.quotationNo,
        items: payload.items
      };

      setSuccessModalDetails({
        voucherNo: res.quotationNo,
        voucherType: 'Quotation / Estimate',
        date: payload.date,
        partyName: customerName,
        totalAmount: netQuotationTotal,
        totalItems: payload.items.length,
        currencySymbol,
        onPrint: () => {
          if (onPrintQuotation) {
            onPrintQuotation(savedObj);
          } else {
            const doc = generateQuotationPDF(savedObj, config);
            doc.save(`Quotation_${res.quotationNo}.pdf`);
          }
        },
        onShare: () => {
          const doc = generateQuotationPDF(savedObj, config);
          shareOrDownloadPDF(doc, `Quotation_${res.quotationNo}.pdf`, `Quotation ${res.quotationNo}`);
        },
        onDownload: () => {
          const doc = generateQuotationPDF(savedObj, config);
          doc.save(`Quotation_${res.quotationNo}.pdf`);
        },
        onNewVoucher: () => {
          if (isAutoMode) {
            setQuotationNo(peekNextVoucherNo('QUOTATION', config));
          }
          setQuoteItems([]);
        }
      });

      if (isAutoMode) {
        setQuotationNo(peekNextVoucherNo('QUOTATION', config));
      }
      setRemarks('');
    }
  };

  const handleStatusChange = (qNo: string, newStatus: 'Draft' | 'Sent' | 'Accepted' | 'Converted' | 'Expired') => {
    updateQuotationStatus(qNo, newStatus);
    showToast(`Quotation status updated to ${newStatus.toUpperCase()}`, 'success');
    loadSavedQuotations();
    onDataRefresh();
  };

  const handleDelete = (qNo: string) => {
    if (window.confirm(`Delete quotation ${qNo}?`)) {
      const res = deleteQuotation(qNo);
      if (res.ok) {
        showToast(`Quotation ${qNo} deleted.`, 'success');
        loadSavedQuotations();
        onDataRefresh();
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

  const handleQuoteBack = () => {
    if (successModalDetails) {
      setSuccessModalDetails(null);
      return true;
    }
    if (activeTab === 'register') {
      setActiveTab('create');
      return true;
    }
    if (onNavigateBack) {
      onNavigateBack();
      return true;
    }
    return false;
  };

  // Global F2, Escape, and shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        const handled = handleQuoteBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          return;
        }
      }
      if ((e.key === 'F2' || e.code === 'F2') && activeTab === 'create') {
        e.preventDefault();
        const formEl = document.getElementById('quotation-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, customerName, netQuotationTotal, quoteItems, date, validUntil, successModalDetails, onNavigateBack]);

  useEffect(() => {
    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleQuoteBack();
      if (handled) {
        e.preventDefault();
      }
    };
    const handleSaveEvent = (e: CustomEvent) => {
      if (activeTab === 'create') {
        const formEl = document.getElementById('quotation-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('app:back' as any, handleBackEvent);
    window.addEventListener('app:save' as any, handleSaveEvent);
    return () => {
      window.removeEventListener('app:back' as any, handleBackEvent);
      window.removeEventListener('app:save' as any, handleSaveEvent);
    };
  }, [activeTab, successModalDetails, onNavigateBack]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingQuotationNo ? `Save changes to ${editingQuotationNo}?` : "Save Quotation / Estimate?"}
        onConfirm={proceedSaveQuotation}
        onCancel={() => setShowAcceptModal(false)}
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

      {/* Top Banner & View Switcher */}
      <div className="rounded-xl border border-violet-200 bg-linear-to-r from-violet-50/90 to-purple-50/70 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              type="button"
              onClick={handleQuoteBack}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white hover:bg-violet-100 text-violet-900 font-bold text-xs border border-violet-200 shadow-2xs transition active:scale-95 cursor-pointer"
              title="Return to Vouchers"
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Back</span>
            </button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
            <FileCheck2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-violet-950 leading-tight">
              Quotation & Price Estimate Generator
            </h2>
            <p className="text-[11px] text-violet-700 font-medium">
              Create formal commercial proposals & estimates (Press <kbd className="font-mono font-bold bg-white px-1 py-0.2 rounded border border-violet-300 text-violet-900 text-[10px]">F2</kbd> to save)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white/90 p-0.5 rounded-lg border border-violet-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'create'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-violet-800 hover:bg-violet-100/50'
            }`}
          >
            + Create New Quotation
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              loadSavedQuotations();
            }}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'register'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-violet-800 hover:bg-violet-100/50'
            }`}
          >
            📜 Quotation Register ({savedQuotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form id="quotation-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col space-y-2">
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
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Party</span>
                    <span className="font-extrabold text-violet-900">{customerName || <span className="text-rose-500">Not Selected</span>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Date</span>
                    <span className="font-bold text-slate-800">{date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Quotation No</span>
                    <span className="font-bold text-slate-800">{quotationNo || '-'}</span>
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
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Quotation No.</label>
                <input
                  id="qt-quote-no"
                  type="text"
                  value={quotationNo || ''}
                  onChange={e => setQuotationNo(e.target.value)}
                  disabled={isAutoMode}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-date');
                    }
                  }}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                    isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-violet-600'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Quotation Date</label>
                <input
                  id="qt-date"
                  type="date"
                  value={date || ''}
                  onChange={e => setDate(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-valid-until');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('qt-quote-no');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-violet-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Valid Until</label>
                <input
                  id="qt-valid-until"
                  type="date"
                  value={validUntil || ''}
                  onChange={e => setValidUntil(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-customer');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('qt-date');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-violet-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Client / Customer</label>
                <SearchableLedgerSelect
                  id="qt-customer"
                  ledgers={ledgers}
                  value={customerName}
                  onChange={setCustomerName}
                  filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
                  onCreateNew={() => onOpenQuickLedger('Sundry Debtors')}
                  placeholder="Select Client / Debtor"
                  onEnterNext={() => focusElement('qt-phone')}
                  onArrowRight={() => focusElement('qt-phone')}
                  onArrowDown={() => focusElement('qt-phone')}
                  onArrowLeft={() => focusElement('qt-valid-until')}
                  onArrowUp={() => focusElement('qt-valid-until')}
                />
              </div>
            </div>

            {/* Client Extra Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Contact Phone</label>
                <input
                  id="qt-phone"
                  type="text"
                  placeholder="e.g. +975 17123456"
                  value={contactNo || ''}
                  onChange={e => setContactNo(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-gstin');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('qt-customer');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-violet-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">GSTIN / TPN Number</label>
                <input
                  id="qt-gstin"
                  type="text"
                  placeholder="Tax ID / TPN"
                  value={gstin || ''}
                  onChange={e => setGstin(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-address');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('qt-phone');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-violet-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Client Address / Location</label>
                <input
                  id="qt-address"
                  type="text"
                  placeholder="Address..."
                  value={address || ''}
                  onChange={e => setAddress(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('qt-item-0-item');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('qt-gstin');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-violet-600 text-xs"
                />
              </div>
            </div>
              </div>
            )}
          </div>

          {/* Line Items Table with Top Auto-Add Selector */}
          <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative text-xs">
            {/* Top Quick Item Selection Bar */}
            <div className="px-3 py-2 border-b border-slate-200 bg-violet-50/40 space-y-2 relative z-30">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Package className="h-4 w-4 text-violet-600" />
                  <span>Select & Quote Items ({quoteItems.filter(i => i.itemCode).length} items added)</span>
                </h3>
                <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                  Search or scan item to auto-add immediately
                </span>
              </div>

              {/* Fast Item Selector Top Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <SearchableItemSelect
                    id="qt-fast-item-picker-top"
                    items={items}
                    placeholder="Type or scan item name / barcode to auto-add to quotation..."
                    currencySymbol={currencySymbol}
                    onEndOfList={(id) => id && focusElement('qt-save-btn')}
                        onSelect={selectedItem => {
                      handleQuickAddItem(selectedItem);
                    }}
                    autoClearAfterSelect={true}
                    onCreateNew={onOpenNewItemModal}
                    dropdownPosition="down"
                  />
                </div>
                <div className="sm:col-span-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 font-bold text-white hover:bg-violet-700 transition shadow-xs cursor-pointer text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Add Blank Row</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[160px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Item Details & Description</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate ({currencySymbol})</th>
                    <th className="py-2.5 px-2 w-16 text-center">Disc %</th>
                    <th className="py-2.5 px-2 w-16 text-center">GST %</th>
                    <th className="py-2.5 px-3 w-28 text-right">Line Total ({currencySymbol})</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2 px-3 min-w-[240px]">
                        <SearchableItemSelect
                          variant="grid"
                          id={`qt-item-${idx}`}
                          valueCode={line.itemCode}
                          items={items}
                          placeholder="Select item..."
                          currencySymbol={currencySymbol}
                          priceType="sale"
                          showPrice={true}
                          onEndOfList={(id) => id && focusElement('qt-save-btn')}
                          onSelect={selectedItem => {
                            const qty = line.qty || 1;
                            const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
                            const unit = selectedItem.Unit || 'Pcs';
                            const gst = selectedItem['GST %'] || 0;
                            const disc = Number(line.discount) || 0;
                            const discAmt = (qty * rate * disc) / 100;
                            const lineTotal = (qty * rate) - discAmt;

                            const updated = [...quoteItems];
                            updated[idx] = {
                              ...updated[idx],
                              itemCode: selectedItem['Item Code'],
                              itemName: selectedItem['Item Name'],
                              unit,
                              rate,
                              gstPct: gst,
                              zeroRated: selectedItem['Zero Rated (Y/N)'] || 'N',
                              lineTotal
                            };
                            setQuoteItems(updated);
                            setTimeout(() => {
                              const qtyEl = document.getElementById(`qt-qty-${idx}`) as HTMLInputElement | null;
                              if (qtyEl) {
                                qtyEl.focus();
                                qtyEl.select();
                              }
                            }, 50);
                          }}
                          onEnterNext={() => {
                            setTimeout(() => {
                              const el = document.getElementById(`qt-qty-${idx}`);
                              if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
                            }, 10);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') return;
                            handleGridKeyDown(e, getGridNavOpts(idx, 'item'));
                          }}
                          onCreateNew={onOpenNewItemModal}
                        />

                        {config.EnableItemDescription && line.itemCode && (
                          <input
                            type="text"
                            placeholder="Item specification / note..."
                            value={line.description || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: val } : it));
                            }}
                            className="w-full mt-1 px-2 py-0.5 rounded border border-slate-200 text-[11px] outline-none focus:border-violet-600 text-slate-700 bg-white"
                          />
                        )}
                      </td>

                      <td className="py-2 px-2">
                        <input
                          id={`qt-qty-${idx}`}
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                          onChange={e =>
                            handleLineFieldChange(
                              idx,
                              'qty',
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-violet-600 bg-white"
                        />
                      </td>

                      <td className="py-2 px-2 text-center font-bold text-slate-600">
                        {line.unit || 'Pcs'}
                      </td>

                      <td className="py-2 px-2">
                        <input
                          id={`qt-rate-${idx}`}
                          type="number"
                          min="0"
                          step="any"
                          value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                          onChange={e =>
                            handleLineFieldChange(
                              idx,
                              'rate',
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full text-right rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-violet-600 bg-white"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          id={`qt-disc-${idx}`}
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={line.discount !== undefined && line.discount !== null ? line.discount : 0}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'disc'))}
                          onChange={e =>
                            handleLineFieldChange(
                              idx,
                              'discount',
                              e.target.value === '' ? 0 : parseFloat(e.target.value)
                            )
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-violet-600 bg-white"
                        />
                      </td>

                      <td className="py-2 px-2">
                        <input
                          id={`qt-gst-${idx}`}
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={line.gstPct !== undefined && line.gstPct !== null ? line.gstPct : 0}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'gst'))}
                          onChange={e =>
                            handleLineFieldChange(
                              idx,
                              'gstPct',
                              e.target.value === '' ? 0 : parseFloat(e.target.value)
                            )
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-violet-600 bg-white"
                        />
                      </td>

                      <td className="py-2 px-3 text-right font-black text-slate-900 font-mono">
                        {currencySymbol} {(Number(line.lineTotal) || 0).toFixed(2)}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove line item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Active Table Cell Search Row (Tally.Prime Style) */}
                  <tr className="bg-violet-50/50 hover:bg-violet-100/50 transition border-t border-violet-100 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <td className="py-2 px-3 min-w-[240px]">
                      <SearchableItemSelect
                        variant="grid"
                        id="qt-fast-item-picker"
                        items={items}
                        placeholder="+ Type Item Name or Scan Barcode..."
                        currencySymbol={currencySymbol}
                        priceType="sale"
                        showPrice={true}
                        onEndOfList={(id) => id && focusElement('qt-save-btn')}
                        onSelect={selectedItem => handleQuickAddItem(selectedItem)}
                        autoClearAfterSelect={true}
                        onEnterNext={() => focusElement('qt-save-btn')}
                        onCreateNew={onOpenNewItemModal}
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-2 text-right font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-2 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-2 px-2 text-center font-bold text-violet-600 text-[10px]">NEW</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Terms and Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs shrink-0">
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-700 text-[11px]">Commercial Terms & Conditions</label>
                {config.PredefinedTermsList && config.PredefinedTermsList.length > 0 && (
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        setTermsAndConditions(e.target.value);
                      }
                    }}
                    className="text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 outline-none"
                  >
                    <option value="">Load Predefined Terms...</option>
                    {config.PredefinedTermsList.map((t: any, idx: number) => {
                      const textVal = typeof t === 'string' ? t : (t.terms || t.title || '');
                      const labelVal = typeof t === 'string' ? (t.length > 30 ? t.slice(0, 30) + '...' : t) : (t.title || t.terms || `Preset ${idx + 1}`);
                      return (
                        <option key={idx} value={textVal}>
                          {labelVal}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
              <textarea
                id="qt-terms"
                rows={2}
                value={termsAndConditions || ''}
                onChange={e => setTermsAndConditions(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    focusElement('qt-save-btn');
                  } else if (e.key === 'ArrowDown' && e.currentTarget.selectionEnd === e.currentTarget.value.length) {
                    e.preventDefault();
                    focusElement('qt-save-btn');
                  } else if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
                    e.preventDefault();
                    if (quoteItems.length > 0) {
                      focusElement(`qt-item-${quoteItems.length - 1}-gst`);
                    }
                  }
                }}
                placeholder="Payment terms, delivery timeline, warranty info..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-violet-600"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 shadow-xs flex flex-col justify-between">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 font-semibold">
                <div>SubtotalAmount: <span className="font-bold text-slate-900">{currencySymbol} {grossSubtotal.toFixed(2)}</span></div>
                {totalDiscount > 0 && <div className="text-rose-600">Disc: <span className="font-bold">-{currencySymbol} {totalDiscount.toFixed(2)}</span></div>}
                <div>Taxable: <span className="font-bold text-slate-900">{currencySymbol} {taxableTotal.toFixed(2)}</span></div>
                <div>GST: <span className="font-bold text-slate-900">+{currencySymbol} {totalGst.toFixed(2)}</span></div>
              </div>
              <div className="pt-1.5 mt-1 border-t border-slate-200 flex items-center justify-between font-black text-xs sm:text-sm text-violet-950">
                <span>Grand Total:</span>
                <span className="text-base text-violet-700 font-mono">
                  {currencySymbol} {netQuotationTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="text-slate-500 font-semibold text-[11px]">
              Estimate does not affect stock balances until converted. Press <kbd className="font-mono font-bold bg-white px-1 py-0.2 rounded border border-slate-200 text-slate-700">F2</kbd> to save.
            </div>

            <div className="flex items-center gap-2">
              <GlowButton
                id="qt-save-btn"
                type="submit"
                variant="blue"
                size="sm"
                icon={CheckCircle2}
                onKeyDown={e => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    focusElement('qt-terms');
                  }
                }}
              >
                Save Quotation (F2)
              </GlowButton>
            </div>
          </div>
        </form>
      ) : (
        /* Saved Quotations Register */
        <div className="flex-1 min-h-[300px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-xs">
              Saved Quotations & Estimates Register ({savedQuotes.length})
            </h3>
          </div>

          {savedQuotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileCheck2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No quotations generated yet</p>
              <p className="text-[11px]">Click "+ Create New Quotation" to start</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-[220px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Quote No</th>
                    <th className="py-2 px-3">Client / Customer</th>
                    <th className="py-2 px-3">Valid Until</th>
                    <th className="py-2 px-3 text-right">Total Amount</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedQuotes.map((q, idx) => (
                    <tr key={`${q.quotationNo || 'q'}-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {new Date(q.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-violet-800">
                        {q.quotationNo}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {q.customer?.name || q.customer?.ledger}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {new Date(q.validUntil).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {currencySymbol} {(q.total || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={q.status || 'Draft'}
                          onChange={e => handleStatusChange(q.quotationNo, e.target.value as any)}
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold outline-none ${
                            q.status === 'Accepted'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : q.status === 'Sent'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : q.status === 'Converted'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="converted">Converted to Sale</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const doc = generateQuotationPDF(q, config);
                              shareOrDownloadPDF(doc, `Quotation_${q.quotationNo}.pdf`, `Quotation ${q.quotationNo}`);
                            }}
                            className="p-1 text-slate-500 hover:text-violet-700 transition"
                            title="Share / Save PDF"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onPrintQuotation) {
                                onPrintQuotation(q);
                              } else {
                                const doc = generateQuotationPDF(q, config);
                                doc.save(`Quotation_${q.quotationNo}.pdf`);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-violet-700 transition"
                            title="Print / Save Quotation"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(q.quotationNo)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
