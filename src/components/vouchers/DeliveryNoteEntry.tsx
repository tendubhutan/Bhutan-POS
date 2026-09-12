import React, { useState, useEffect } from 'react';
import { focusNextOutsideGrid } from '../../utils/domUtils';
import { Config, Item, Ledger, DeliveryNoteItem, DeliveryNote } from '../../types';
import {
  saveDeliveryNote, getDeliveryNotes, deleteDeliveryNote, peekNextVoucherNo, getUnits
} from '../../services/storageService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';
import { SearchableItemSelect } from '../SearchableItemSelect';
import { ItemNoteButton, ItemNoteInput } from './ItemNoteField';
import { handleGridKeyDown } from '../../utils/gridKeyboardNav';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './VoucherSuccessActionModal';
import { AcceptModal } from '../AcceptModal';
import { QuitConfirmModal } from '../QuitConfirmModal';
import {
  Truck, Plus, Trash2, CheckCircle2, AlertCircle, Package, Printer, FileText, MapPin, Calendar, Layers, Share2, Download, ArrowLeft, Sparkles, ChevronUp, ChevronDown, X, ArrowDownToLine
} from 'lucide-react';
import { generateDeliveryNotePDF, shareOrDownloadPDF } from '../../utils/pdfExport';
import { FetchVoucherModal } from './FetchVoucherModal';
import { SalesOrder } from '../../types';

interface DeliveryNoteEntryProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onOpenQuickLedger: (group: string) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onPrintDeliveryNote?: (note: DeliveryNote) => void;
  onNavigateBack?: () => void;
  voucherTypeSelector?: React.ReactNode;
}

export const DeliveryNoteEntry: React.FC<DeliveryNoteEntryProps> = ({
  config,
  items,
  ledgers,
  onDataRefresh,
  initialVoucherTarget,
  onOpenQuickLedger,
  onOpenNewItemModal,
  onPrintDeliveryNote,
  onNavigateBack,
  voucherTypeSelector
}) => {
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingNoteNo, setEditingNoteNo] = useState<string | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [noteNo, setNoteNo] = useState(() => (isAutoMode ? peekNextVoucherNo('DEL_NOTE', config) : ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [orderRefNo, setOrderRefNo] = useState('');
  const [dispatchThrough, setDispatchThrough] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showFetchModal, setShowFetchModal] = useState(false);

  const handleFetchSalesOrder = (data: { type: any; voucher: any }) => {
    const so = data.voucher as SalesOrder;
    if (!so) return;

    if (so.customer?.ledger || so.customer?.name) {
      setCustomerName(so.customer.ledger || so.customer.name);
    }
    if (so.orderNo) {
      setOrderRefNo(so.orderNo);
    }
    if (so.customer?.address && !destination) {
      setDestination(so.customer.address);
    }
    if (so.remarks && !remarks) {
      setRemarks(so.remarks);
    }
    if (so.items && so.items.length > 0) {
      setNoteItems(so.items.map(it => ({
        itemCode: it.itemCode,
        itemName: it.itemName,
        description: it.description || '',
        lineDescription: it.lineDescription || '',
        qty: it.qty,
        unit: it.unit || 'Pcs',
        rate: it.rate || 0,
        amount: it.lineTotal || (it.qty * (it.rate || 0))
      })));
    }
    showToast(`✓ Fetched ${so.items?.length || 0} items from Sales Order ${so.orderNo}`);
  };

  const handleCustomerSelect = (name: string) => {
    setCustomerName(name);
    if (name) {
      const matchedLedger = ledgers.find(l => l['Ledger Name'] === name);
      if (matchedLedger && matchedLedger.Address && !destination) {
        setDestination(matchedLedger.Address);
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setShowTransportModal(true);
    }
  };

  useEffect(() => {
    if (showTransportModal) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const timer = setTimeout(() => {
        const el = document.getElementById('dn-modal-order-ref') || document.getElementById('dn-modal-vehicle-no');
        if (el) {
          el.focus();
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showTransportModal]);

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'register'>('create');
  const [savedNotes, setSavedNotes] = useState<DeliveryNote[]>([]);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);

  // Line items state
  const [noteItems, setNoteItems] = useState<DeliveryNoteItem[]>([]);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const currencySymbol = config?.CurrencySymbol || 'Nu.';
  const units = getUnits();

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
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const all = getDeliveryNotes();
      const dn = all.find(x => x.noteNo === initialVoucherTarget.voucherNo);
      if (dn) {
        setEditingNoteNo(dn.noteNo);
        setNoteNo(dn.noteNo);
        if (dn.date) setDate(new Date(dn.date).toISOString().split('T')[0]);
        if ((dn as any).customerName || dn.customer) setCustomerName((dn as any).customerName || dn.customer);
        if (dn.orderRefNo) setOrderRefNo(dn.orderRefNo);
        if (dn.dispatchThrough) setDispatchThrough(dn.dispatchThrough);
        if (dn.destination) setDestination(dn.destination);
        if (dn.vehicleNo) setVehicleNo(dn.vehicleNo);
        if (dn.remarks) setRemarks(dn.remarks);
        if (Array.isArray(dn.items)) {
          setNoteItems(dn.items.map((it: any) => ({
            itemCode: it.itemCode || it['Item Code'] || '',
            itemName: it.itemName || it['Item Name'] || '',
            description: it.description || it['Item Description'] || '',
            unit: it.unit || it.Unit || 'Pcs',
            qty: it.qty !== undefined ? Number(it.qty) : (it.Qty !== undefined ? Number(it.Qty) : 1),
            rate: it.rate !== undefined ? Number(it.rate) : (it.Rate !== undefined ? Number(it.Rate) : 0),
            amount: it.amount !== undefined ? Number(it.amount) : (it.total !== undefined ? Number(it.total) : (Number(it.qty || 1) * Number(it.rate || 0)))
          })));
        }
        setActiveTab('create');
      }
    }
  }, [initialVoucherTarget]);

  useEffect(() => {
    if (isAutoMode && !editingNoteNo) {
      setNoteNo(peekNextVoucherNo('DEL_NOTE', config));
    }
  }, [config, isAutoMode, editingNoteNo]);

  // Set default customer
  useEffect(() => {
    // Disabled auto-fill to keep ledger fields empty by default
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

    setShowAcceptModal(true);
  };

  const proceedSaveDeliveryNote = () => {
    setShowAcceptModal(false);

    const customerLedger = ledgers.find(l => l['Ledger Name'] === customerName);

    const payload = {
      noteNo: noteNo.trim() || undefined,
      originalNoteNo: editingNoteNo || undefined,
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
      setEditingNoteNo(null);

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

  const resetForm = () => {
    setEditingNoteNo(null);
    if (isAutoMode) {
      setNoteNo(peekNextVoucherNo('DEL_NOTE', config));
    }
    setDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setOrderRefNo('');
    setDispatchThrough('');
    setDestination('');
    setVehicleNo('');
    setRemarks('');
    setNoteItems([]);
  };

  const handleDeliveryBack = (): boolean => {
    if (showFetchModal) {
      setShowFetchModal(false);
      return true;
    }
    if (showTransportModal) {
      setShowTransportModal(false);
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
      !!customerName ||
      !!orderRefNo ||
      !!dispatchThrough ||
      !!destination ||
      !!vehicleNo ||
      Boolean(remarks.trim()) ||
      !!editingNoteNo ||
      (noteItems.length > 0 && noteItems.some(i => !!i.itemCode || Number(i.rate) > 0 || Number(i.qty) > 1));

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

  // Global F2 and shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'F2' || e.code === 'F2') && activeTab === 'create') {
        e.preventDefault();
        const formEl = document.getElementById('delivery-note-form') as HTMLFormElement | null;
        if (formEl) {
          formEl.requestSubmit();
        }
      }
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowFetchModal(true);
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
  }, [
    activeTab,
    customerName,
    totalQty,
    noteItems,
    date,
    orderRefNo,
    dispatchThrough,
    destination,
    vehicleNo,
    remarks,
    editingNoteNo,
    showQuitModal,
    showAcceptModal,
    showFetchModal,
    showTransportModal,
    successModalDetails,
    onNavigateBack
  ]);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal
        isOpen={showAcceptModal}
        title={editingNoteNo ? `Save changes to ${editingNoteNo}?` : "Save Delivery Note / Challan?"}
        onConfirm={proceedSaveDeliveryNote}
        onCancel={() => setShowAcceptModal(false)}
      />
      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="Delivery Note"
        onConfirm={() => {
          setShowQuitModal(false);
          resetForm();
          if (onNavigateBack) {
            onNavigateBack();
          }
        }}
        onCancel={() => setShowQuitModal(false)}
      />
      <FetchVoucherModal
        isOpen={showFetchModal}
        onClose={() => setShowFetchModal(false)}
        sourceType="sales_order"
        initialParty={customerName}
        config={config}
        onSelectVoucher={handleFetchSalesOrder}
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

      {activeTab === 'create' ? (
        <form id="delivery-note-form" onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Top Header Row with Voucher Selector + Form Fields */}
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-xs mb-1 shrink-0 flex items-center gap-2.5 flex-wrap text-xs">
            {voucherTypeSelector}

            {/* Challan / Note No. */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="dn-challan-no" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Challan / Note No.</label>
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
                className={`h-7 w-28 rounded-md border px-2 font-mono font-bold text-slate-900 outline-none text-xs ${
                  isAutoMode ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-cyan-600'
                }`}
              />
            </div>

            {/* Dispatch Date */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label htmlFor="dn-dispatch-date" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Dispatch Date</label>
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
                className="h-7 rounded-md border border-slate-300 bg-white px-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
              />
            </div>

            {/* Consignee / Customer */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
              <label htmlFor="dn-customer" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Consignee / Customer</label>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <SearchableLedgerSelect
                  id="dn-customer"
                  ledgers={ledgers}
                  value={customerName}
                  onChange={handleCustomerSelect}
                  filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
                  prioritizeGroups={['Sundry Debtors']}
                  onCreateNew={() => onOpenQuickLedger('Sundry Debtors')}
                  placeholder="Select Customer / Consignee"
                  onEnterNext={() => {
                    setShowTransportModal(true);
                  }}
                  onArrowRight={() => setShowTransportModal(true)}
                  onArrowDown={() => setShowTransportModal(true)}
                  onArrowLeft={() => focusElement('dn-dispatch-date')}
                  onArrowUp={() => focusElement('dn-dispatch-date')}
                />
                {customerName && (
                  <button
                    type="button"
                    onClick={() => setShowTransportModal(true)}
                    className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer bg-cyan-50 hover:bg-cyan-100 px-2 py-1 rounded border border-cyan-200 transition shrink-0"
                    title="Edit order ref, vehicle, carrier & transport destination"
                  >
                    <Truck className="h-3 w-3" />
                    <span>🚚 Details</span>
                  </button>
                )}
              </div>
            </div>

            {/* Fetch from Sales Order Button */}
            <button
              type="button"
              onClick={() => setShowFetchModal(true)}
              className="h-7 px-2.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-[11px] flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
              title="Fetch details from Sales Order (Alt+F)"
            >
              <ArrowDownToLine className="h-3.5 w-3.5 text-indigo-600" />
              <span>Fetch Order [Alt+F]</span>
            </button>
          </div>

          {/* Floating Transport & Order Ref Details Modal */}
          {showTransportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-cyan-100 text-cyan-700 rounded-xl">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Transport & Order Reference Details</h3>
                      <p className="text-xs text-slate-500 font-medium">Consignee: <strong className="text-cyan-800 font-bold">{customerName || 'Selected Customer'}</strong></p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransportModal(false);
                      setTimeout(() => focusElement('dn-fast-item-picker'), 50);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Customer Order / PO Ref. */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Customer Order / PO Ref.</label>
                    <input
                      id="dn-modal-order-ref"
                      type="text"
                      placeholder="e.g. PO-8923 or Verbal"
                      value={orderRefNo || ''}
                      onChange={e => setOrderRefNo(e.target.value)}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusElement('dn-modal-vehicle-no');
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Vehicle / Truck No.</label>
                    <input
                      id="dn-modal-vehicle-no"
                      type="text"
                      placeholder="e.g. BP-1-A1234"
                      value={vehicleNo || ''}
                      onChange={e => setVehicleNo(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusElement('dn-modal-dispatch-through');
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Dispatched Through / Carrier</label>
                    <input
                      id="dn-modal-dispatch-through"
                      type="text"
                      placeholder="e.g. Store Van, Courier, Self"
                      value={dispatchThrough || ''}
                      onChange={e => setDispatchThrough(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          focusElement('dn-modal-destination');
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-xs">Destination / Site Address</label>
                    <textarea
                      id="dn-modal-destination"
                      rows={2}
                      placeholder="e.g. Warehouse Site 2, Thimphu"
                      value={destination || ''}
                      onChange={e => setDestination(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          setShowTransportModal(false);
                          setTimeout(() => focusElement('dn-fast-item-picker'), 50);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 outline-none focus:border-cyan-600 text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransportModal(false);
                      focusElement('dn-fast-item-picker');
                    }}
                    className="w-full sm:w-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Save & Continue to Items</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs relative text-xs overflow-hidden">
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
                      <td className="py-0.5 px-2 min-w-[240px] align-middle">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <SearchableItemSelect
                              variant="grid"
                              id={`dn-item-${idx}`}
                              disabled={showTransportModal}
                              valueCode={line.itemCode}
                              items={items}
                              placeholder="Select item..."
                              currencySymbol={currencySymbol}
                              priceType="sale"
                              showPrice={true}
                              onEndOfList={(id) => id && focusElement('dn-save-btn')}
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
                          </div>
                          {line.itemCode && (
                            <ItemNoteButton
                              hasNote={Boolean(line.description && line.description.trim())}
                              onClick={() => setActiveNoteIdx(activeNoteIdx === idx ? null : idx)}
                              accentColor="cyan"
                            />
                          )}
                        </div>

                        {(Boolean(line.description && line.description.trim()) || activeNoteIdx === idx) && (
                          <ItemNoteInput
                            value={line.description || ''}
                            onChange={val => setNoteItems(prev => prev.map((it, i) => i === idx ? { ...it, description: val } : it))}
                            onClose={() => setActiveNoteIdx(null)}
                            accentColor="cyan"
                          />
                        )}
                      </td>

                      <td className="py-0.5 px-1 align-middle text-center">
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
                          className="w-full text-center h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        />
                      </td>

                      <td className="py-0.5 px-1 align-middle text-center">
                        <select
                          value={line.unit || 'Pcs'}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = [...noteItems];
                            updated[idx].unit = val;
                            const item = items.find(i => (i['Item Code'] && i['Item Code'] === updated[idx].itemCode) || i['Item Name'] === updated[idx].itemName);
                            if (item) {
                              if (val === item.Unit) {
                                updated[idx].rate = Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0);
                              } else if (item.multiUnits) {
                                const mu = item.multiUnits.find(m => m.unit === val);
                                if (mu && mu.saleRate) {
                                  updated[idx].rate = mu.saleRate;
                                }
                              }
                              updated[idx].amount = (updated[idx].qty || 0) * (updated[idx].rate || 0);
                            }
                            setNoteItems(updated);
                          }}
                          className="w-full text-center h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        >
                          {units.map(u => (
                            <option key={u['Unit Name']} value={u['Unit Name']}>{u.Symbol || u['Unit Name']}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-0.5 px-1 align-middle">
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
                          className="w-full text-right h-6 rounded border border-slate-300 text-xs font-semibold focus:border-cyan-600 outline-none bg-white"
                        />
                      </td>

                      <td className="py-0.5 px-2 text-right font-black text-slate-900 font-mono align-middle">
                        {currencySymbol} {(Number(line.amount) || 0).toFixed(2)}
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
                        id="dn-fast-item-picker"
                        disabled={showTransportModal}
                        items={items}
                        placeholder="+ Type Item Name or Scan Barcode..."
                        currencySymbol={currencySymbol}
                        priceType="sale"
                        showPrice={true}
                        onEndOfList={(id) => id && focusElement('dn-save-btn')}
                        onSelect={selectedItem => handleQuickAddItem(selectedItem)}
                        autoClearAfterSelect={true}
                        onEnterNext={() => focusElement('dn-save-btn')}
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

          {/* Narration Field */}
          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs">
            <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">Narration:</span>
            <input
              id="del-narration"
              type="text"
              placeholder="Enter delivery note narration / remarks..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:border-cyan-600 transition"
            />
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-[4px] focus:ring-cyan-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10 relative focus:scale-[1.02] outline-none cursor-pointer"
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
