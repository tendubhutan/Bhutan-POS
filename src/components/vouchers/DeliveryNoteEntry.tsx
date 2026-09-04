import React, { useState, useEffect } from 'react';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger, DeliveryNoteItem, DeliveryNote } from '../../types';
import {
  saveDeliveryNote, getDeliveryNotes, deleteDeliveryNote, peekNextVoucherNo
} from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import {
  Truck, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, FileText, MapPin, Calendar, Layers, Share2, Download, ArrowLeft, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { generateDeliveryNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';

interface DeliveryNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintDeliveryNote?: (note: DeliveryNote) => void;
  onNavigateBack?: () => void;
}

export const DeliveryNoteEntry: React.FC<DeliveryNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintDeliveryNote,
  onNavigateBack
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [noteNo, setNoteNo] = useState(() => (isAutoMode ? peekNextVoucherNo('DEL_NOTE', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [orderRefNo, setOrderRefNo] = useState('');
  const [dispatchThrough, setDispatchThrough] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [savedNotes, setSavedNotes] = useState<DeliveryNote[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);

  // Line items state
  const [noteItems, setNoteItems] = useState<DeliveryNoteItem[]>([]);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  const getGridNavOpts = (idx: number, field: 'item' | 'qty' | 'rate') => ({
    prefix: 'dn',
    idx,
    field,
    totalRows: noteItems.length,
    searchPickerId: 'dn-fast-item-picker',
    hasDiscount: false,
    hasGst: false,
    onDeleteRow: (i: number) => handleRemoveItem(i),
    onOpenNewItemModal: () => onOpenNewItemModal && onOpenNewItemModal(),
  });

  
  useEffect(() => {
    if (noteItems.length > 0 && customerName) {
      setIsHeaderCollapsed(true);
    } else if (noteItems.length === 0) {
      setIsHeaderCollapsed(false);
    }
  }, [noteItems.length]);

  const loadSavedDeliveryNotes = () => {
    const list = getDeliveryNotes();
    setSavedNotes(list);
  };

  useEffect(() => {
    loadSavedDeliveryNotes();
  }, []);

  useEffect(() => {
    if (isAutoMode) {
      setNoteNo(peekNextVoucherNo('DEL_NOTE', config));
    }
  }, [config, isAutoMode]);

  // Set default customer
  useEffect(() => {
    if (!customerName && ledgers.length > 0) {
      const debtor = ledgers.find(l => l.Group === 'Sundry Debtors')?.['Ledger Name'] || ledgers[0]['Ledger Name'];
      setCustomerName(debtor);
    }
  }, [ledgers]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleAddItem = () => {
    setNoteItems(prev => [
      ...prev,
      {
        itemCode: '',
        itemName: '',
        qty: 1,
        unit: 'Pcs',
        rate: 0,
        amount: 0
      }
    ]);
  };

  const handleQuickAddItem = (selectedItem: Item) => {
    const qty = 1;
    const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
    const unit = selectedItem.Unit || 'Pcs';

    const existingIdx = noteItems.findIndex(l => l.itemCode === selectedItem['Item Code']);
    let updatedItems = [...noteItems];
    let targetIndex = existingIdx;

    if (existingIdx > -1) {
      const newQty = (Number(updatedItems[existingIdx].qty) || 0) + qty;
      const r = Number(updatedItems[existingIdx].rate) || 0;
      updatedItems[existingIdx] = {
        ...updatedItems[existingIdx],
        qty: newQty,
        amount: newQty * r
      };
    } else {
      const newLine: DeliveryNoteItem = {
        itemCode: selectedItem['Item Code'],
        itemName: selectedItem['Item Name'],
        qty,
        unit,
        rate,
        amount: qty * rate,
        description: ''
      };
      if (noteItems.length === 1 && !noteItems[0].itemCode) {
        updatedItems = [newLine];
        targetIndex = 0;
      } else {
        updatedItems.push(newLine);
        targetIndex = updatedItems.length - 1;
      }
    }

    setNoteItems(updatedItems);
    showToast(`Added: ${selectedItem['Item Name']}`, 'success');

    setTimeout(() => {
      const qtyEl = document.getElementById(`dn-qty-${targetIndex}`) as HTMLInputElement | null;
      if (qtyEl) {
        qtyEl.focus();
        qtyEl.select();
      }
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    if (noteItems.length <= 1) {
      setNoteItems([{ itemCode: '', itemName: '', qty: 1, unit: 'Pcs', rate: 0, amount: 0 }]);
      return;
    }
    setNoteItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemSelect = (index: number, code: string) => {
    const target = items.find(i => i['Item Code'] === code);
    if (!target) return;
    setNoteItems(prev => {
      const updated = prev.map((l, i) => {
        if (i === index) {
          const qty = Number(l.qty) || 1;
          const rate = target['Sale Rate'] || 0;
          return {
            ...l,
            itemCode: target['Item Code'],
            itemName: target['Item Name'],
            unit: target.Unit || 'Pcs',
            rate,
            amount: qty * rate
          };
        }
        return l;
      });

      // If selecting in the last row, automatically append a new empty row
      if (index === prev.length - 1) {
        return [
          ...updated,
          {
            itemCode: '',
            itemName: '',
            qty: 1,
            unit: 'Pcs',
            rate: 0,
            amount: 0
          }
        ];
      }
      return updated;
    });
  };

  const handleQtyChange = (index: number, qty: number | '') => {
    setNoteItems(prev =>
      prev.map((l, i) => {
        if (i === index) {
          const q = typeof qty === 'number' ? qty : 0;
          const r = Number(l.rate) || 0;
          return {
            ...l,
            qty,
            amount: q * r
          };
        }
        return l;
      })
    );
  };

  const validItems = noteItems.filter(it => it.itemCode.trim() !== '' && (Number(it.qty) || 0) > 0);
  const totalQty = validItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalValuation = validItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      showToast('Please select or specify a Customer.', 'error');
      return;
    }

    if (validItems.length === 0 || totalQty <= 0) {
      showToast('Please add at least one valid item to the delivery note with quantity > 0.', 'error');
      return;
    }

    const customerLedger = ledgers.find(l => l['Ledger Name'] === customerName);

    const payload = {
      noteNo: noteNo.trim() || undefined,
      date: new Date(date).toISOString(),
      customer: {
        ledger: customerName,
        name: customerName,
        gstNo: customerLedger?.['GST No'] || '',
        tpnNo: customerLedger?.['TPN No'] || '',
        address: customerLedger?.Address || destination.trim() || '',
        phone: customerLedger?.['Contact No'] || ''
      },
      orderRefNo: orderRefNo.trim(),
      dispatchThrough: dispatchThrough.trim(),
      destination: destination.trim(),
      vehicleNo: vehicleNo.trim(),
      remarks: remarks.trim(),
      items: validItems.map(it => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        qty: Number(it.qty) || 0,
        unit: it.unit || 'Pcs',
        rate: Number(it.rate) || 0,
        amount: Number(it.amount) || 0
      }))
    };

    const res = saveDeliveryNote(payload);
    if (res.ok) {
      showToast(`Delivery Note ${res.noteNo} saved & stock deducted!`, 'success');
      onDataRefresh();
      loadSavedDeliveryNotes();

      const savedObj: DeliveryNote = {
        ...payload,
        noteNo: res.noteNo,
        status: 'Dispatched',
        items: payload.items
      };

      setSuccessModalDetails({
        voucherNo: res.noteNo,
        voucherType: 'Delivery Note Challan',
        date: payload.date,
        partyName: customerName,
        totalAmount: totalValuation,
        totalItems: payload.items.length,
        currencySymbol,
        onPrint: () => {
          if (onPrintDeliveryNote) {
            onPrintDeliveryNote(savedObj);
          } else {
            const doc = generateDeliveryNotePDF(savedObj, config);
            doc.save(`DeliveryNote_${res.noteNo}.pdf`);
          }
        },
        onShare: () => {
          const doc = generateDeliveryNotePDF(savedObj, config);
          shareOrDownloadPDF(doc, `DeliveryNote_${res.noteNo}.pdf`, `Delivery Challan ${res.noteNo}`);
        },
        onDownload: () => {
          const doc = generateDeliveryNotePDF(savedObj, config);
          doc.save(`DeliveryNote_${res.noteNo}.pdf`);
        },
        onNewVoucher: () => {
          if (isAutoMode) {
            setNoteNo(peekNextVoucherNo('DEL_NOTE', config));
          }
          setNoteItems([]);
        }
      });

      if (isAutoMode) {
        setNoteNo(peekNextVoucherNo('DEL_NOTE', config));
      }
      setOrderRefNo('');
      setVehicleNo('');
      setDestination('');
      setRemarks('');
    }
  };

  const handleDelete = (num: string) => {
    if (window.confirm(`Delete delivery note ${num}? Dispatched stock will be restored.`)) {
      const res = deleteDeliveryNote(num);
      if (res.ok) {
        showToast(`Delivery note ${num} deleted and stock restored.`, 'success');
        onDataRefresh();
        loadSavedDeliveryNotes();
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

  const handleDeliveryBack = (): boolean => {
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

  // Global F2 and Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const handled = handleDeliveryBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          return;
        }
      }
      if ((e.key === 'F2' || e.code === 'F2') && activeTab === 'create') {
        e.preventDefault();
        const formEl = document.getElementById('delivery-note-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
    };

    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleDeliveryBack();
      if (handled) {
        e.preventDefault();
      }
    };
    const handleSaveEvent = (e: CustomEvent) => {
      if (activeTab === 'create') {
        const formEl = document.getElementById('delivery-note-form') as HTMLFormElement | null;
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
  }, [activeTab, customerName, totalQty, noteItems, date, orderRefNo, dispatchThrough, destination, vehicleNo, remarks, successModalDetails, onNavigateBack]);

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

      {/* Top Banner & View Switcher */}
      <div className="rounded-xl border border-cyan-200 bg-linear-to-r from-cyan-50/90 to-blue-50/70 px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-xs">
            <Truck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-cyan-950 leading-tight">
              Delivery Note / Outward Goods Challan
            </h2>
            <p className="text-[11px] text-cyan-700 font-medium">
              Dispatch inventory to customers with vehicle & transport tracking prior to billing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white/90 p-0.5 rounded-lg border border-cyan-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'create'
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'text-cyan-800 hover:bg-cyan-100/50'
            }`}
          >
            + New Challan
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              loadSavedDeliveryNotes();
            }}
            className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
              activeTab === 'register'
                ? 'bg-cyan-600 text-white shadow-2xs'
                : 'text-cyan-800 hover:bg-cyan-100/50'
            }`}
          >
            📋 Delivery Register ({savedNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form id="delivery-note-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col space-y-2">
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
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm">Note No</span>
                    <span className="font-bold text-slate-800">{noteNo || '-'}</span>
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
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Challan / Note No.</label>
                <input
                  id="dn-challan-no"
                  type="text"
                  value={noteNo || ''}
                  onChange={e => setNoteNo(e.target.value)}
                  disabled={isAutoMode}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-dispatch-date');
                    }
                  }}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                    isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-cyan-600'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Dispatch Date</label>
                <input
                  id="dn-dispatch-date"
                  type="date"
                  value={date || ''}
                  onChange={e => setDate(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-customer');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('dn-challan-no');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Consignee / Customer</label>
                <SearchableLedgerSelect
                  id="dn-customer"
                  ledgers={ledgers}
                  value={customerName}
                  onChange={setCustomerName}
                  filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
                  onCreateNew={() => onOpenQuickLedger('Sundry Debtors')}
                  placeholder="Select Customer / Consignee"
                  onEnterNext={() => focusElement('dn-order-ref')}
                  onArrowRight={() => focusElement('dn-order-ref')}
                  onArrowDown={() => focusElement('dn-order-ref')}
                  onArrowLeft={() => focusElement('dn-dispatch-date')}
                  onArrowUp={() => focusElement('dn-dispatch-date')}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Customer Order / PO Ref.</label>
                <input
                  id="dn-order-ref"
                  type="text"
                  placeholder="e.g. PO-8923 or Verbal"
                  value={orderRefNo || ''}
                  onChange={e => setOrderRefNo(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-vehicle-no');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('dn-customer');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                />
              </div>
            </div>

            {/* Transport details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Vehicle / Truck No.</label>
                <input
                  id="dn-vehicle-no"
                  type="text"
                  placeholder="e.g. BP-1-A1234"
                  value={vehicleNo || ''}
                  onChange={e => setVehicleNo(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-dispatch-through');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('dn-order-ref');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Dispatched Through / Carrier</label>
                <input
                  id="dn-dispatch-through"
                  type="text"
                  placeholder="e.g. Store Van, Courier, Self"
                  value={dispatchThrough || ''}
                  onChange={e => setDispatchThrough(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-destination');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('dn-vehicle-no');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Destination / Site Address</label>
                <input
                  id="dn-destination"
                  type="text"
                  placeholder="e.g. Warehouse Site 2, Thimphu"
                  value={destination || ''}
                  onChange={e => setDestination(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      focusElement('dn-item-0-item');
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      focusElement('dn-dispatch-through');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                />
              </div>
            </div>
              </div>
            )}
          </div>

          {/* Line Items Table with Top Selection */}
          <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative text-xs">
            {/* Top Quick Item Selection Bar */}
            <div className="px-3 py-2 border-b border-slate-200 bg-cyan-50/40 space-y-2 relative z-30">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Package className="h-4 w-4 text-cyan-600" />
                  <span>Select & Dispatch Items ({validItems.length} items added)</span>
                </h3>
                <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                  Search item to auto-add immediately
                </span>
              </div>

              {/* Fast Item Selector Top Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <SearchableItemSelect
                    id="dn-fast-item-picker"
                    items={items}
                    placeholder="Type or scan item name / barcode to auto-add..."
                    currencySymbol={currencySymbol}
                    onEndOfList={(id) => id && focusNextOutsideGrid(id)}
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
                    className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 font-bold text-white hover:bg-cyan-700 transition shadow-xs cursor-pointer text-xs"
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
                    <th className="py-2.5 px-2.5 w-24 text-center">Dispatch Qty</th>
                    <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Approx Rate ({currencySymbol})</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Amount ({currencySymbol})</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {noteItems.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-1.5 px-3 min-w-[240px]">
                        <SearchableItemSelect
                          variant="grid"
                          id={`dn-item-${idx}`}
                          valueCode={line.itemCode}
                          items={items}
                          placeholder="Select item..."
                          currencySymbol={currencySymbol}
                          priceType="sale"
                          showPrice={true}
                          onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                          onSelect={selectedItem => {
                            const qty = line.qty || 1;
                            const rate = Number((selectedItem as any)['Sale Rate'] ?? (selectedItem as any)['Sales Rate'] ?? selectedItem.MRP ?? selectedItem['Purchase Rate'] ?? 0);
                            const unit = selectedItem.Unit || 'Pcs';

                            const updated = [...noteItems];
                            updated[idx] = {
                              ...updated[idx],
                              itemCode: selectedItem['Item Code'],
                              itemName: selectedItem['Item Name'],
                              unit,
                              rate,
                              amount: qty * rate
                            };
                            setNoteItems(updated);
                            setTimeout(() => {
                              const qtyEl = document.getElementById(`dn-qty-${idx}`) as HTMLInputElement | null;
                              if (qtyEl) {
                                qtyEl.focus();
                                qtyEl.select();
                              }
                            }, 50);
                          }}
                          onEnterNext={() => {
                            setTimeout(() => {
                              const el = document.getElementById(`dn-qty-${idx}`);
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
                            placeholder="Item note / description..."
                            value={line.description || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setNoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: val } : it));
                            }}
                            className="w-full mt-1 px-2 py-0.5 rounded border border-slate-200 text-[11px] outline-none focus:border-cyan-600 text-slate-700 bg-white"
                          />
                        )}
                      </td>

                      <td className="py-1.5 px-2.5">
                        <input
                          id={`dn-qty-${idx}`}
                          type="number"
                          min="0.01"
                          step="any"
                          value={line.qty !== undefined && line.qty !== null ? line.qty : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'qty'))}
                          onChange={e =>
                            handleQtyChange(
                              idx,
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full text-center rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-cyan-600 text-xs bg-white"
                        />
                      </td>

                      <td className="py-1.5 px-2 text-center font-bold text-slate-600 text-xs">
                        {line.unit || 'Pcs'}
                      </td>

                      <td className="py-1.5 px-2.5 text-right font-semibold text-slate-700">
                        <input
                          id={`dn-rate-${idx}`}
                          type="number"
                          step="any"
                          value={line.rate !== undefined && line.rate !== null ? line.rate : ''}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => handleGridKeyDown(e, getGridNavOpts(idx, 'rate'))}
                          onChange={e => {
                            const r = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            const q = Number(line.qty) || 0;
                            setNoteItems(prev => prev.map((it, i) => i === idx ? { ...it, rate: r, amount: q * r } : it));
                          }}
                          className="w-24 text-right rounded-lg border border-slate-300 px-2 py-1 font-bold outline-none focus:border-cyan-600 text-xs bg-white inline-block"
                        />
                      </td>

                      <td className="py-1.5 px-2.5 text-right font-black text-slate-900 font-mono">
                        {currencySymbol} {(Number(line.amount) || 0).toFixed(2)}
                      </td>

                      <td className="py-1.5 px-2 text-center">
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
                        id="dn-fast-item-picker"
                        items={items}
                        placeholder="+ Type Item Name or Scan Barcode..."
                        currencySymbol={currencySymbol}
                        priceType="sale"
                        showPrice={true}
                        onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={selectedItem => handleQuickAddItem(selectedItem)}
                        autoClearAfterSelect={true}
                        onEnterNext={() => focusNextOutsideGrid('dn-fast-item-picker')}
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

          {/* Bottom Bar */}
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
                id="dn-save-btn"
                type="submit"
                onKeyDown={e => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (noteItems.length > 0) {
                      focusElement(`dn-item-${noteItems.length - 1}-qty`);
                    } else {
                      focusElement('dn-destination');
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-2 focus:ring-cyan-400 outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Delivery Note (F2)</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Saved Delivery Notes Register */
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3 text-xs">
          <h3 className="font-extrabold text-slate-900 text-sm">
            Dispatched Delivery Notes & Challans
          </h3>

          {savedNotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Truck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">No delivery notes generated yet</p>
              <p className="text-[11px]">Click "+ New Delivery Challan" to dispatch inventory</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Note No</th>
                    <th className="py-2.5 px-3">Customer / Consignee</th>
                    <th className="py-2.5 px-3">Vehicle / Transport</th>
                    <th className="py-2.5 px-3 text-center">Items</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {savedNotes.map((n, idx) => (
                    <tr key={`${n.noteNo || 'n'}-${idx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {new Date(n.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">
                        {n.noteNo}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {n.customer?.name || n.customer?.ledger}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {n.vehicleNo ? `${n.vehicleNo} (${n.dispatchThrough || 'Carrier'})` : n.dispatchThrough || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {n.items?.length || 0} items
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-bold text-cyan-700 text-[10px] border border-cyan-200">
                          {n.status || 'Dispatched'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const doc = generateDeliveryNotePDF(n, config);
                              shareOrDownloadPDF(doc, `DeliveryNote_${n.noteNo}.pdf`, `Delivery Challan ${n.noteNo}`);
                            }}
                            className="p-1 text-slate-500 hover:text-cyan-700 transition"
                            title="Share / Save PDF"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onPrintDeliveryNote) {
                                onPrintDeliveryNote(n);
                              } else {
                                const doc = generateDeliveryNotePDF(n, config);
                                doc.save(`DeliveryNote_${n.noteNo}.pdf`);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-cyan-700 transition"
                            title="Print / Save Challan"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(n.noteNo)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Delete & Restore Stock"
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
