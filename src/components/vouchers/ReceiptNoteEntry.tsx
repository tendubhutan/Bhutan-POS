import React, { useState, useEffect } from 'react';
import { Config, Item, Ledger, ReceiptNote, ReceiptNoteItem, PurchaseOrder } from '../../types';
import {
  saveReceiptNote, getReceiptNotes, deleteReceiptNote, peekNextVoucherNo, getUnits
} from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import { QuitConfirmModal } from '../QuitConfirmModal';
import { ItemNoteButton, ItemNoteInput } from './ItemNoteField';
import { FetchVoucherModal } from './FetchVoucherModal';
import {
  Trash2, CheckCircle2, AlertCircle, Printer, FileText, X, FilePlus, ArrowDownToLine
} from 'lucide-react';
import { generateReceiptNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface ReceiptNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintReceiptNote?: (note: ReceiptNote) => void;
  onNavigateBack?: () => void;
  activeTab?: 'create' | 'register';
  onTabChange?: (tab: 'create' | 'register') => void;
  voucherTypeSelector?: React.ReactNode;
}

export const ReceiptNoteEntry: React.FC<ReceiptNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  initialVoucherTarget,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintReceiptNote,
  onNavigateBack,
  activeTab: propActiveTab,
  onTabChange,
  voucherTypeSelector
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingNoteNo, setEditingNoteNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [noteNo, setNoteNo] = useState(() => (isAutoMode ? peekNextVoucherNo('RECEIPT_NOTE', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierChallanNo, setSupplierChallanNo] = useState('');
  const [poNo, setPoNo] = useState('');

  const [supplier, setSupplier] = useState<{
    name: string;
    phone?: string;
    address?: string;
    gstNo?: string;
    tpnNo?: string;
  }>({
    name: '',
    phone: '',
    address: '',
    gstNo: '',
    tpnNo: ''
  });
  const [showSupplierDetailsModal, setShowSupplierDetailsModal] = useState(false);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);

  const handleFetchPurchaseOrder = (data: { type: any; voucher: any }) => {
    const po = data.voucher as PurchaseOrder;
    if (!po) return;

    if (po.supplier?.name || po.supplier?.ledger) {
      setSupplier({
        name: po.supplier.name || po.supplier.ledger,
        phone: po.supplier.phone || '',
        address: po.supplier.address || '',
        gstNo: po.supplier.gstNo || '',
        tpnNo: po.supplier.tpnNo || ''
      });
    }
    if (po.poNo) {
      setPoNo(po.poNo);
      setSupplierChallanNo(po.poNo);
    }
    if (po.remarks && !remarks) {
      setRemarks(po.remarks);
    }
    if (po.items && po.items.length > 0) {
      setNoteItems(po.items.map(it => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        description: it.description || '',
        lineDescription: it.lineDescription || '',
        qty: it.qty,
        unit: it.unit || 'Pcs',
        rate: it.rate || 0,
        discount: it.discount || 0,
        discountType: it.discountType || 'flat',
        taxableValue: it.taxableValue || (it.qty * (it.rate || 0)),
        gstPct: it.gstPct || 0,
        gstAmount: it.gstAmount || 0,
        zeroRated: it.zeroRated || 'N',
        lineTotal: it.lineTotal || (it.qty * (it.rate || 0))
      })));
    }
    showToast(`✓ Fetched ${po.items?.length || 0} items from Purchase Order ${po.poNo}`);
  };

  const [internalTab, setInternalTab] = useState<'create' | 'register'>('create');
  const activeTab = propActiveTab ?? internalTab;
  const setActiveTab = (tab: 'create' | 'register') => {
    setInternalTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [savedNotes, setSavedNotes] = useState<ReceiptNote[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [noteItems, setNoteItems] = useState<ReceiptNoteItem[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const currencySymbol = config?.CurrencySymbol || 'Nu.';
  const units = getUnits();

  useEffect(() => {
    loadSavedNotes();
  }, []);

  const loadSavedNotes = () => {
    const list = getReceiptNotes();
    setSavedNotes(list);
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
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

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate' | 'disc' | 'gst') => ({
    prefix: 'grn',
    idx,
    field,
    totalRows: noteItems.length,
    searchPickerId: 'grn-fast-item-picker',
    hasDiscount: false,
    hasGst: false,
    onDeleteRow: (i: number) => handleRemoveItem(i),
    onOpenNewItemModal: () => onOpenNewItemModal && onOpenNewItemModal()
  });

  const focusFirstItemOrPicker = () => {
    setTimeout(() => {
      const el = document.getElementById('grn-fast-item-picker');
      if (el) el.focus();
    }, 100);
  };

  const handleAddItem = (item: Item) => {
    const itemCode = item['Item Code'];
    const existingIdx = noteItems.findIndex(it => it.itemCode === itemCode);
    if (existingIdx >= 0) {
      const updated = [...noteItems];
      updated[existingIdx].qty += 1;
      calculateLineTotals(updated);
      setNoteItems(updated);
      showToast(`Incremented: ${item['Item Name']}`, 'success');
      setTimeout(() => {
        const qtyEl = document.getElementById(`grn-qty-${existingIdx}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    } else {
      const rate = Number(item['Purchase Rate'] ?? (item as any)['Cost Price'] ?? (item as any)['costPrice'] ?? item['Sale Rate'] ?? 0);
      const gstPct = Number(item['GST %'] || 0);
      const newItem: ReceiptNoteItem = {
        itemCode,
        itemName: item['Item Name'],
        qty: 1,
        unit: item.Unit || 'Pcs',
        rate: rate,
        discount: 0,
        discountType: 'percent',
        taxableValue: rate,
        gstPct: gstPct,
        gstAmount: (rate * gstPct) / 100,
        zeroRated: (item['Zero Rated (Y/N)'] === 'Y' || gstPct === 0) ? 'Y' : 'N',
        lineTotal: rate + (rate * gstPct) / 100
      };
      const updated = [...noteItems, newItem];
      calculateLineTotals(updated);
      setNoteItems(updated);
      showToast(`Added: ${item['Item Name']}`, 'success');
      const targetIdx = updated.length - 1;
      setTimeout(() => {
        const qtyEl = document.getElementById(`grn-qty-${targetIdx}`) as HTMLInputElement | null;
        if (qtyEl) {
          qtyEl.focus();
          qtyEl.select();
        }
      }, 50);
    }
  };

  const calculateLineTotals = (list: ReceiptNoteItem[]) => {
    list.forEach(line => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const disc = Number(line.discount) || 0;
      let gross = qty * rate;

      if (line.discountType === 'percent') {
        gross -= (gross * disc) / 100;
      } else {
        gross -= disc;
      }
      gross = Math.max(0, gross);

      line.taxableValue = gross;
      const gstPct = Number(line.gstPct) || 0;
      line.gstAmount = (gross * gstPct) / 100;
      line.lineTotal = gross + line.gstAmount;
      line.zeroRated = gstPct === 0 ? 'Y' : 'N';
    });
  };

  const handleUpdateItem = (idx: number, field: keyof ReceiptNoteItem, value: any) => {
    const updated = [...noteItems];
    (updated[idx] as any)[field] = value;

    if (field === 'itemCode') {
      const selectedObj = items.find(i => i['Item Code'] === value);
      if (selectedObj) {
        updated[idx].itemName = selectedObj['Item Name'];
        updated[idx].rate = Number(selectedObj['Purchase Rate'] ?? (selectedObj as any)['Cost Price'] ?? (selectedObj as any)['costPrice'] ?? selectedObj['Sale Rate'] ?? 0);
        updated[idx].unit = selectedObj.Unit || 'Pcs';
        updated[idx].gstPct = Number(selectedObj['GST %'] || 0);
      }
    }

    calculateLineTotals(updated);
    setNoteItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = noteItems.filter((_, i) => i !== idx);
    calculateLineTotals(updated);
    setNoteItems(updated);
  };

  const totals = noteItems.reduce(
    (acc, line) => {
      acc.taxable += line.taxableValue || 0;
      acc.gst += line.gstAmount || 0;
      acc.net += line.lineTotal || 0;
      if (line.zeroRated === 'Y') acc.zeroRated += line.taxableValue || 0;
      return acc;
    },
    { taxable: 0, gst: 0, net: 0, zeroRated: 0 }
  );

  const totalQty = noteItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalValuation = totals.net;

  const handleSelectSupplierLedger = (ledgerName: string) => {
    const matched = ledgers.find(l => l['Ledger Name'] === ledgerName);
    setSupplier({
      name: ledgerName,
      address: matched?.Address || '',
      phone: matched?.['Contact No'] || '',
      gstNo: matched?.['GST No'] || matched?.['TPN No'] || '',
      tpnNo: matched?.['TPN No'] || ''
    });
  };

  const handleSave = () => {
    if (!supplier.name.trim()) {
      showToast('Please select or enter Supplier Name', 'error');
      return;
    }
    if (noteItems.length === 0) {
      showToast('Please add at least one item to the Receipt Note', 'error');
      return;
    }

    const res = saveReceiptNote({
      noteNo: noteNo || undefined,
      originalNoteNo: editingNoteNo || undefined,
      poNo,
      date,
      supplierChallanNo,
      supplier,
      taxable: totals.taxable,
      zeroRated: totals.zeroRated,
      gstAmt: totals.gst,
      total: totals.net,
      status: 'Received',
      remarks,
      items: noteItems
    });

    if (res.ok && res.receiptNote) {
      showToast(`Receipt Note ${res.noteNo} saved & stock updated successfully!`, 'success');
      onDataRefresh();
      loadSavedNotes();

      const savedObj = res.receiptNote;

      setSuccessModalDetails({
        voucherNo: res.noteNo,
        voucherTypeLabel: 'Receipt Note (GRN)',
        voucherType: 'Receipt Note (GRN)',
        partyName: supplier.name,
        amount: totals.net,
        totalAmount: totals.net,
        date: date,
        itemCount: noteItems.length,
        totalItems: noteItems.length,
        currencySymbol,
        rawVoucher: savedObj,
        onPrint: () => {
          if (onPrintReceiptNote) {
            onPrintReceiptNote(savedObj);
          } else {
            const doc = generateReceiptNotePDF(savedObj, config);
            doc.save(`ReceiptNote_${res.noteNo}.pdf`);
          }
        },
        onShare: () => {
          const doc = generateReceiptNotePDF(savedObj, config);
          shareOrDownloadPDF(doc, `ReceiptNote_${res.noteNo}.pdf`, `Receipt Note ${res.noteNo}`);
        },
        onDownload: () => {
          const doc = generateReceiptNotePDF(savedObj, config);
          doc.save(`ReceiptNote_${res.noteNo}.pdf`);
        },
        onNewVoucher: () => {
          handleClearForm();
        }
      });

      handleClearForm();
    }
  };

  const handleClearForm = () => {
    setEditingNoteNo(null);
    setNoteNo(isAutoMode ? peekNextVoucherNo('RECEIPT_NOTE', config) : '');
    setDate(new Date().toISOString().split('T')[0]);
    setSupplierChallanNo('');
    setPoNo('');
    setSupplier({ name: '', phone: '', address: '', gstNo: '', tpnNo: '' });
    setNoteItems([]);
    setRemarks('');
  };

  const handleEditNote = (note: ReceiptNote) => {
    setEditingNoteNo(note.noteNo);
    setNoteNo(note.noteNo);
    setDate(note.date ? note.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setSupplierChallanNo(note.supplierChallanNo || '');
    setPoNo(note.poNo || '');
    setSupplier(note.supplier || { name: '', phone: '', address: '', gstNo: '', tpnNo: '' });
    setNoteItems(note.items || []);
    setRemarks(note.remarks || '');
    setActiveTab('create');
  };

  const handleDeleteNote = (nNo: string) => {
    if (confirm(`Are you sure you want to delete Receipt Note ${nNo}? This will reverse the stock inward.`)) {
      deleteReceiptNote(nNo);
      loadSavedNotes();
      onDataRefresh();
      showToast(`Receipt Note ${nNo} deleted and stock reversed`, 'success');
    }
  };

  const handleGRNBack = () => {
    if (showFetchModal) {
      setShowFetchModal(false);
      return true;
    }
    if (showSupplierDetailsModal) {
      setShowSupplierDetailsModal(false);
      focusFirstItemOrPicker();
      return true;
    }
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
    if (activeTab === 'register') {
      setActiveTab('create');
      return true;
    }

    const hasData =
      !!supplier.name ||
      !!supplierChallanNo ||
      Boolean(remarks.trim()) ||
      !!editingNoteNo ||
      noteItems.length > 0;

    if (hasData) {
      setShowQuitModal(true);
      return true;
    }

    handleClearForm();
    if (onNavigateBack) {
      onNavigateBack();
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowFetchModal(true);
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleSave();
      }
    };

    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleGRNBack();
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:back' as any, handleBackEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:back' as any, handleBackEvent);
    };
  }, [supplier, supplierChallanNo, noteItems, remarks, date, noteNo, activeTab, showAcceptModal, showQuitModal, successModalDetails]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingNoteNo ? `Save changes to ${editingNoteNo}?` : "Save Goods Receipt Note?"}
        onConfirm={handleSave}
        onCancel={() => setShowAcceptModal(false)}
      />
      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="Receipt Note (GRN)"
        onConfirm={() => {
          setShowQuitModal(false);
          handleClearForm();
          if (onNavigateBack) onNavigateBack();
        }}
        onCancel={() => setShowQuitModal(false)}
      />

      <FetchVoucherModal
        isOpen={showFetchModal}
        onClose={() => setShowFetchModal(false)}
        sourceType="purchase_order"
        initialParty={supplier.name}
        config={config}
        onSelectVoucher={handleFetchPurchaseOrder}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all ${
            toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'create' ? (
        <form
          id="receipt-note-form"
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
          className="flex-1 min-h-0 flex flex-col space-y-2"
        >
          {/* Top Header Row with Voucher Selector + Form Fields */}
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs mb-1 shrink-0 flex items-center gap-2.5 flex-wrap text-xs">
            {voucherTypeSelector}

            {/* Note No */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="grn-note-no" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Receipt / GRN No.</label>
              <input
                id="grn-note-no"
                type="text"
                value={noteNo || ''}
                onChange={e => setNoteNo(e.target.value)}
                disabled={isAutoMode}
                onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusElement('grn-date');
                  }
                }}
                className={`h-7 w-28 rounded-md border px-2 font-mono font-bold text-slate-900 outline-none text-xs ${
                  isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-cyan-600'
                }`}
              />
            </div>

            {/* Date */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="grn-date" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Receipt Date</label>
              <input
                id="grn-date"
                type="date"
                value={date || ''}
                onChange={e => setDate(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusElement('grn-supplier');
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusElement('grn-note-no');
                  }
                }}
                className="h-7 rounded-md border border-slate-300 bg-white px-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
              />
            </div>

            {/* Supplier / Vendor */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
              <label htmlFor="grn-supplier" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Supplier / Vendor</label>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <SearchableLedgerSelect
                  id="grn-supplier"
                  ledgers={ledgers}
                  value={supplier.name}
                  onChange={handleSelectSupplierLedger}
                  filterGroups={['Sundry Creditors', 'Cash-in-Hand', 'Bank Accounts']}
                  prioritizeGroups={['Sundry Creditors']}
                  onCreateNew={() => onOpenQuickLedger('Sundry Creditors')}
                  placeholder="Select Supplier / Vendor"
                  onEnterNext={() => {
                    if (supplier.name) {
                      setShowSupplierDetailsModal(true);
                    } else {
                      focusFirstItemOrPicker();
                    }
                  }}
                  onArrowRight={() => {
                    if (supplier.name) setShowSupplierDetailsModal(true);
                    else focusFirstItemOrPicker();
                  }}
                  onArrowDown={() => {
                    if (supplier.name) setShowSupplierDetailsModal(true);
                    else focusFirstItemOrPicker();
                  }}
                  onArrowLeft={() => focusElement('grn-date')}
                  onArrowUp={() => focusElement('grn-date')}
                />
                {supplier.name && (
                  <button
                    type="button"
                    onClick={() => setShowSupplierDetailsModal(true)}
                    className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer bg-cyan-50 hover:bg-cyan-100 px-2 py-1 rounded border border-cyan-200 transition shrink-0"
                    title="Edit supplier challan, transport, vehicle and address"
                  >
                    <span>🚚 Details</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFetchModal(true)}
                  className="h-7 px-2.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
                  title="Fetch items and details from Purchase Order (Alt+F)"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Fetch PO [Alt+F]</span>
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative text-xs overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-[160px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Item Details & Description</th>
                    <th className="py-2.5 px-2.5 w-24 text-center">Received Qty</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Approx Rate ({currencySymbol})</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Amount ({currencySymbol})</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {noteItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-0.5 px-2 min-w-[240px] align-middle">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <SearchableItemSelect
                              variant="grid"
                              id={`grn-item-${idx}`}
                              valueCode={line.itemCode}
                              items={items}
                              placeholder="Select item..."
                              currencySymbol={currencySymbol}
                              priceType="purchase"
                              showPrice={true}
                              onEndOfList={(id) => id && focusElement('grn-save-btn')}
                              onSelect={selectedItem => {
                                const rate = Number(selectedItem['Purchase Rate'] ?? (selectedItem as any)['Cost Price'] ?? (selectedItem as any)['costPrice'] ?? selectedItem['Sale Rate'] ?? 0);
                                const unit = selectedItem.Unit || 'Pcs';
                                const gstPct = Number(selectedItem['GST %'] || 0);

                                const updated = [...noteItems];
                                updated[idx] = {
                                  ...updated[idx],
                                  itemCode: selectedItem['Item Code'],
                                  itemName: selectedItem['Item Name'],
                                  unit,
                                  rate,
                                  gstPct,
                                  taxableValue: (updated[idx].qty || 1) * rate,
                                  lineTotal: (updated[idx].qty || 1) * rate + ((updated[idx].qty || 1) * rate * gstPct) / 100
                                };
                                calculateLineTotals(updated);
                                setNoteItems(updated);
                                setTimeout(() => {
                                  const qtyEl = document.getElementById(`grn-qty-${idx}`) as HTMLInputElement | null;
                                  if (qtyEl) {
                                    qtyEl.focus();
                                    qtyEl.select();
                                  }
                                }, 50);
                              }}
                              onEnterNext={() => {
                                setTimeout(() => {
                                  const el = document.getElementById(`grn-qty-${idx}`);
                                  if (el) { el.focus(); (el as HTMLInputElement).select?.(); }
                                }, 10);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') return;
                                handleGridKeyDown(e, getGridNavOpts(idx, 'item'));
                              }}
                              onCreateNew={onOpenNewItemModal}
                            />
                          </div>
                          {line.itemCode && (
                            <ItemNoteButton
                              hasNote={Boolean((line as any).description && (line as any).description.trim())}
                              onClick={() => setActiveNoteIdx(activeNoteIdx === idx ? null : idx)}
                              accentColor="cyan"
                            />
                          )}
                        </div>

                        {(Boolean((line as any).description && (line as any).description.trim()) || activeNoteIdx === idx) && (
                          <ItemNoteInput
                            value={(line as any).description || ''}
                            onChange={val => setNoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: val } : it))}
                            onClose={() => setActiveNoteIdx(null)}
                            accentColor="cyan"
                          />
                        )}
                      </td>

                      <td className="py-0.5 px-1 align-middle text-center">
                        <input
                          id={`grn-qty-${idx}`}
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                          onChange={e => handleUpdateItem(idx, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          className="w-full text-center h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        />
                      </td>

                      <td className="py-0.5 px-1 align-middle text-center">
                        <select
                          value={line.unit || 'Pcs'}
                          onChange={e => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="w-full text-center h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        >
                          {units.map((u, ui) => {
                            const val = u.Symbol || u['Unit Name'] || 'Pcs';
                            return <option key={`${val}-${ui}`} value={val}>{val}</option>;
                          })}
                        </select>
                      </td>

                      <td className="py-0.5 px-1 align-middle">
                        <input
                          id={`grn-rate-${idx}`}
                          type="number"
                          step="any"
                          value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                          onChange={e => handleUpdateItem(idx, 'rate', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          className="w-full text-right h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        />
                      </td>

                      <td className="py-0.5 px-2 text-right font-black text-slate-900 font-mono align-middle">
                        {currencySymbol} {(Number(line.lineTotal) || 0).toFixed(2)}
                      </td>

                      <td className="py-0.5 px-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Active Table Cell Search Row (Tally.Prime Style) */}
                  <tr className="bg-cyan-50/40 hover:bg-cyan-100/40 transition border-t border-cyan-100 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                    <td className="py-1.5 px-3 min-w-[240px]">
                      <SearchableItemSelect
                        variant="grid"
                        id="grn-fast-item-picker"
                        items={items}
                        placeholder="+ Type Item Name or Scan Barcode..."
                        currencySymbol={currencySymbol}
                        priceType="purchase"
                        showPrice={true}
                        onEndOfList={(id) => id && focusElement('grn-save-btn')}
                        onSelect={selectedItem => handleAddItem(selectedItem)}
                        autoClearAfterSelect={true}
                        onEnterNext={() => focusElement('grn-save-btn')}
                        onCreateNew={onOpenNewItemModal}
                      />
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-1.5 px-2 text-center font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-1.5 px-2.5 text-right font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-1.5 px-2.5 text-right font-semibold text-slate-400 text-xs">—</td>
                    <td className="py-1.5 px-2 text-center font-bold text-cyan-600 text-[10px]">NEW</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Narration Bar */}
          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs">
            <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">Narration:</span>
            <input
              id="grn-narration"
              type="text"
              placeholder="Enter goods receipt narration / remarks..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:border-cyan-600 transition"
            />
          </div>

          {/* Bottom Summary Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-4 font-bold text-slate-600">
              <div>
                <span>Items: </span>
                <span className="text-slate-900 font-extrabold">{noteItems.filter(i => i.itemCode).length}</span>
              </div>
              <div>
                <span>Total Qty: </span>
                <span className="text-slate-900 font-extrabold">{totalQty} units</span>
              </div>
              <div className="rounded-lg bg-cyan-100/80 border border-cyan-300 px-2.5 py-1 text-cyan-950 font-black text-xs">
                Valuation: {currencySymbol} {totalValuation.toFixed(2)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'create' ? 'register' : 'create')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 transition flex items-center gap-1 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>{activeTab === 'create' ? `GRN Register (${savedNotes.length})` : '← Back to Entry'}</span>
              </button>

              <button
                id="grn-save-btn"
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-[4px] focus:ring-cyan-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10 relative focus:scale-[1.02] outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{editingNoteNo ? 'Update Receipt Note (F2)' : 'Save Receipt Note (F2)'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Saved Receipt Notes Register */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3 text-xs flex-1 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Saved Receipt Notes (GRN) Register
            </h3>
            <button
              onClick={() => setActiveTab('create')}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:bg-cyan-700 transition"
            >
              <FilePlus className="h-3.5 w-3.5" />
              <span>+ New Receipt Note</span>
            </button>
          </div>

          {savedNotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No receipt notes created yet</p>
              <p className="text-[11px]">Click "+ New Receipt Note" to start recording inward inventory</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-xs border-b border-slate-200">
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">GRN No</th>
                    <th className="py-2.5 px-3">Supplier / Vendor</th>
                    <th className="py-2.5 px-3">Challan / Inv Ref</th>
                    <th className="py-2.5 px-3 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Valuation</th>
                    <th className="py-2.5 px-3 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedNotes.map(n => (
                    <tr key={n.noteNo} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {n.date ? n.date.split('T')[0] : ''}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">
                        {n.noteNo}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {n.supplier?.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {n.supplierChallanNo || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                        {n.items?.length || 0} items
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        {currencySymbol} {n.total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              if (onPrintReceiptNote) {
                                onPrintReceiptNote(n);
                              } else {
                                const doc = generateReceiptNotePDF(n, config);
                                doc.save(`ReceiptNote_${n.noteNo}.pdf`);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded transition"
                            title="Print Receipt Note"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditNote(n)}
                            className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                            title="Edit Receipt Note"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.noteNo)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Receipt Note"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Supplier Extra Details Modal */}
      {showSupplierDetailsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800">Supplier & Receipt Details</h3>
              <button onClick={() => setShowSupplierDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Supplier Challan / Invoice Ref</label>
                <input
                  type="text"
                  value={supplierChallanNo || ''}
                  onChange={e => setSupplierChallanNo(e.target.value)}
                  placeholder="e.g. SUPP-CH-9941"
                  className="w-full h-8 px-3 text-xs border border-slate-300 rounded-lg outline-none focus:border-cyan-600 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={supplier.phone || ''}
                  onChange={e => setSupplier({ ...supplier, phone: e.target.value })}
                  placeholder="Phone number"
                  className="w-full h-8 px-3 text-xs border border-slate-300 rounded-lg outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Supplier Address</label>
                <textarea
                  value={supplier.address || ''}
                  onChange={e => setSupplier({ ...supplier, address: e.target.value })}
                  placeholder="Address"
                  rows={2}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg resize-none outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">GSTIN / TPN No</label>
                <input
                  type="text"
                  value={supplier.gstNo || ''}
                  onChange={e => setSupplier({ ...supplier, gstNo: e.target.value })}
                  placeholder="Tax ID / GSTIN"
                  className="w-full h-8 px-3 text-xs border border-slate-300 rounded-lg outline-none focus:border-cyan-600"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowSupplierDetailsModal(false);
                  focusFirstItemOrPicker();
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Success Action Modal */}
      {successModalDetails && (
        <VoucherSuccessActionModal
          isOpen={!!successModalDetails}
          onClose={() => setSuccessModalDetails(null)}
          details={successModalDetails}
          onPrint={() => {
            if (onPrintReceiptNote && successModalDetails.rawVoucher) {
              onPrintReceiptNote(successModalDetails.rawVoucher);
            }
          }}
        />
      )}
    </div>
  );
};
