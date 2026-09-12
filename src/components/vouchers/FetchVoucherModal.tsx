import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Download,
  FileText,
  Truck,
  ShoppingBag,
  ShoppingCart,
  CheckCircle2,
  Calendar,
  User,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import {
  getSalesOrders,
  getDeliveryNotes,
  getQuotations,
  getPurchaseOrders,
  getReceiptNotes
} from '../../services/storageService';
import {
  SalesOrder,
  DeliveryNote,
  Quotation,
  PurchaseOrder,
  ReceiptNote,
  Config
} from '../../types';

export type FetchSourceType =
  | 'sales_order'
  | 'delivery_note'
  | 'quotation'
  | 'purchase_order'
  | 'receipt_note'
  | 'sales_cycle' // Tabs for Delivery Note and Sales Order
  | 'purchase_cycle'; // Tabs for Receipt Note and Purchase Order

export interface FetchVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: FetchSourceType;
  initialParty?: string;
  config?: Config;
  onSelectVoucher: (data: {
    type: 'sales_order' | 'delivery_note' | 'quotation' | 'purchase_order' | 'receipt_note';
    voucher: SalesOrder | DeliveryNote | Quotation | PurchaseOrder | ReceiptNote;
  }) => void;
}

export const FetchVoucherModal: React.FC<FetchVoucherModalProps> = ({
  isOpen,
  onClose,
  sourceType,
  initialParty,
  config,
  onSelectVoucher
}) => {
  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  // Active sub-tab if sourceType is cycle
  const [activeTab, setActiveTab] = useState<'delivery_note' | 'sales_order' | 'quotation' | 'receipt_note' | 'purchase_order'>(() => {
    if (sourceType === 'sales_cycle') return 'delivery_note';
    if (sourceType === 'purchase_cycle') return 'receipt_note';
    return sourceType as any;
  });

  useEffect(() => {
    if (sourceType === 'sales_cycle') setActiveTab('delivery_note');
    else if (sourceType === 'purchase_cycle') setActiveTab('receipt_note');
    else setActiveTab(sourceType as any);
  }, [sourceType, isOpen]);

  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState<string>(initialParty ? initialParty.trim() : '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending'>('pending');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initial party when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialParty && initialParty.trim() && initialParty !== 'Cash Sale') {
        setPartyFilter(initialParty.trim());
      } else {
        setPartyFilter('');
      }
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 60);
    }
  }, [isOpen, initialParty]);

  // Load vouchers data based on active tab
  const rawList = useMemo(() => {
    if (!isOpen) return [];
    try {
      if (activeTab === 'sales_order') return getSalesOrders();
      if (activeTab === 'delivery_note') return getDeliveryNotes();
      if (activeTab === 'quotation') return getQuotations();
      if (activeTab === 'purchase_order') return getPurchaseOrders();
      if (activeTab === 'receipt_note') return getReceiptNotes();
    } catch (e) {
      console.error('Error fetching source vouchers:', e);
    }
    return [];
  }, [isOpen, activeTab]);

  // Unified normalized list items
  const normalizedList = useMemo(() => {
    return rawList.map((item: any) => {
      let docNo = '';
      let date = '';
      let partyName = '';
      let total = 0;
      let status = '';
      let itemsCount = (item.items || []).length;
      let refNo = '';

      if (activeTab === 'sales_order') {
        docNo = item.orderNo || '';
        date = item.date || '';
        partyName = item.customer?.name || item.customer?.ledger || '';
        total = Number(item.total) || 0;
        status = item.status || 'Pending';
      } else if (activeTab === 'delivery_note') {
        docNo = item.noteNo || '';
        date = item.date || '';
        partyName = item.customer?.name || item.customer?.ledger || (typeof item.customer === 'string' ? item.customer : '') || '';
        total = (item.items || []).reduce((sum: number, it: any) => sum + (Number(it.amount) || (Number(it.qty) * (Number(it.rate) || 0))), 0);
        status = item.status || 'Dispatched';
        refNo = item.orderRefNo || '';
      } else if (activeTab === 'quotation') {
        docNo = item.quotationNo || '';
        date = item.date || '';
        partyName = item.customer?.name || item.customer?.ledger || '';
        total = Number(item.total) || 0;
        status = item.status || 'Draft';
      } else if (activeTab === 'purchase_order') {
        docNo = item.poNo || '';
        date = item.date || '';
        partyName = item.supplier?.name || item.supplier?.ledger || '';
        total = Number(item.total) || 0;
        status = item.status || 'Pending';
      } else if (activeTab === 'receipt_note') {
        docNo = item.noteNo || '';
        date = item.date || '';
        partyName = item.supplier?.name || item.supplier?.ledger || '';
        total = Number(item.total) || (item.items || []).reduce((sum: number, it: any) => sum + (Number(it.lineTotal) || (Number(it.qty) * (Number(it.rate) || 0))), 0);
        status = item.status || 'Received';
        refNo = item.supplierChallanNo || '';
      }

      return {
        raw: item,
        docNo,
        date: date ? date.split('T')[0] : '',
        partyName,
        total,
        status,
        itemsCount,
        refNo,
        items: item.items || []
      };
    });
  }, [rawList, activeTab]);

  // Filtered list
  const filteredList = useMemo(() => {
    return normalizedList.filter(item => {
      // Party filter
      if (partyFilter && partyFilter.trim()) {
        const p1 = (item.partyName || '').toLowerCase();
        const p2 = partyFilter.toLowerCase();
        if (!p1.includes(p2) && !p2.includes(p1)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'pending') {
        const s = (item.status || '').toLowerCase();
        if (s === 'invoiced' || s === 'cancelled' || s === 'delivered' && activeTab === 'sales_order') {
          // If filtering pending, skip invoiced/cancelled
          return false;
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const inDoc = item.docNo.toLowerCase().includes(q);
        const inParty = item.partyName.toLowerCase().includes(q);
        const inDate = item.date.toLowerCase().includes(q);
        const inRef = (item.refNo || '').toLowerCase().includes(q);
        const inItems = (item.items || []).some((it: any) => 
          (it.itemName || '').toLowerCase().includes(q) || (it.itemCode || '').toLowerCase().includes(q)
        );
        return inDoc || inParty || inDate || inRef || inItems;
      }

      return true;
    });
  }, [normalizedList, partyFilter, statusFilter, searchTerm, activeTab]);

  const selectedItem = filteredList[selectedIndex] || null;

  // Handle select / confirm
  const handleConfirm = (itemToFetch?: typeof selectedItem) => {
    const target = itemToFetch || selectedItem;
    if (!target) return;
    onSelectVoucher({
      type: activeTab,
      voucher: target.raw
    });
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedItem) {
          e.preventDefault();
          handleConfirm(selectedItem);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filteredList, selectedIndex, selectedItem]);

  if (!isOpen) return null;

  const getDocTypeTitle = () => {
    switch (activeTab) {
      case 'sales_order': return 'Sales Orders';
      case 'delivery_note': return 'Delivery Notes (Challans)';
      case 'quotation': return 'Quotations / Estimates';
      case 'purchase_order': return 'Purchase Orders';
      case 'receipt_note': return 'Receipt Notes (GRN)';
      default: return 'Source Vouchers';
    }
  };

  const getTabIcon = (tab: typeof activeTab) => {
    switch (tab) {
      case 'sales_order': return <ShoppingCart className="h-4 w-4" />;
      case 'delivery_note': return <Truck className="h-4 w-4" />;
      case 'quotation': return <FileText className="h-4 w-4" />;
      case 'purchase_order': return <ShoppingBag className="h-4 w-4" />;
      case 'receipt_note': return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                  Fetch Details from {getDocTypeTitle()}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  Auto-fill Form
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Select an existing document to automatically pull party info, items, rates, and reference numbers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Multi-Tab Selector (if cycle mode) */}
        {(sourceType === 'sales_cycle' || sourceType === 'purchase_cycle') && (
          <div className="flex items-center gap-2 px-5 py-2 bg-slate-100/80 border-b border-slate-200 shrink-0">
            <span className="text-xs font-bold text-slate-500 mr-2">Fetch From:</span>
            {sourceType === 'sales_cycle' ? (
              <>
                <button
                  type="button"
                  onClick={() => { setActiveTab('delivery_note'); setSelectedIndex(0); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    activeTab === 'delivery_note'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Delivery Notes (Challan)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('sales_order'); setSelectedIndex(0); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    activeTab === 'sales_order'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Sales Orders</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setActiveTab('receipt_note'); setSelectedIndex(0); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    activeTab === 'receipt_note'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>Receipt Notes (GRN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('purchase_order'); setSelectedIndex(0); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    activeTab === 'purchase_order'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Purchase Orders</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search by ${activeTab === 'sales_order' ? 'SO No' : activeTab === 'delivery_note' ? 'DN No' : 'Doc No'}, party name, item, or date...`}
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Party Filter Chip if provided */}
            {partyFilter ? (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg font-bold">
                <User className="h-3.5 w-3.5 text-indigo-600" />
                <span className="max-w-[140px] truncate">{partyFilter}</span>
                <button
                  type="button"
                  onClick={() => { setPartyFilter(''); setSelectedIndex(0); }}
                  className="ml-1 text-indigo-600 hover:text-indigo-900"
                  title="Show all parties"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              initialParty && (
                <button
                  type="button"
                  onClick={() => { setPartyFilter(initialParty.trim()); setSelectedIndex(0); }}
                  className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 border border-dashed border-slate-300 px-2 py-1 rounded-lg hover:border-indigo-300 transition"
                >
                  Filter for: {initialParty}
                </button>
              )
            )}

            {/* Status toggle */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => { setStatusFilter('pending'); setSelectedIndex(0); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open / Pending
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setSelectedIndex(0); }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Documents
              </button>
            </div>
          </div>
        </div>

        {/* Modal Main Body (2 Columns: List on left, preview on right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-slate-50">
          
          {/* Left Column: List of Vouchers */}
          <div className="md:col-span-5 border-r border-slate-200 bg-white overflow-y-auto p-2.5 space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">
              <span>Matching Documents ({filteredList.length})</span>
              <span>Use ↑ ↓ to navigate</span>
            </div>

            {filteredList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileText className="h-10 w-10 text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-bold text-slate-600">No {getDocTypeTitle()} Found</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                  {partyFilter
                    ? `No records found for "${partyFilter}". Try switching to "All Documents" or clearing the party filter.`
                    : 'There are no records matching your search query.'}
                </p>
                {partyFilter && (
                  <button
                    type="button"
                    onClick={() => setPartyFilter('')}
                    className="mt-3 px-3 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
                  >
                    Clear Party Filter
                  </button>
                )}
              </div>
            ) : (
              filteredList.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.docNo + idx}
                    onClick={() => setSelectedIndex(idx)}
                    onDoubleClick={() => handleConfirm(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none text-xs relative ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-400 shadow-xs ring-1 ring-indigo-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                          {item.docNo}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {item.date}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          item.status === 'Pending' || item.status === 'Draft' || item.status === 'Dispatched' || item.status === 'Received'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : item.status === 'Invoiced' || item.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 truncate my-1 text-[13px]">
                      {item.partyName || 'Cash / Unspecified Party'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 mt-1.5">
                      <span className="font-medium flex items-center gap-1 text-slate-600">
                        <Package className="h-3 w-3 text-slate-400" />
                        {item.itemsCount} {item.itemsCount === 1 ? 'Item' : 'Items'}
                      </span>
                      <span className="font-mono font-extrabold text-indigo-950">
                        {currencySymbol} {item.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Document Full Preview */}
          <div className="md:col-span-7 bg-slate-50 flex flex-col overflow-hidden">
            {selectedItem ? (
              <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4 space-y-3">
                {/* Header preview card */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-2 shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900 font-mono">
                          {selectedItem.docNo}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-indigo-100 text-indigo-800">
                          {getDocTypeTitle().slice(0, -1)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Dated: <strong>{selectedItem.date}</strong> {selectedItem.refNo && <>• Ref: <strong>{selectedItem.refNo}</strong></>}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Total Value</div>
                      <div className="text-base font-black text-emerald-600 font-mono">
                        {currencySymbol} {selectedItem.total.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Party / Account</span>
                      <span className="font-bold text-slate-900">{selectedItem.partyName || 'Cash'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                      <span className="font-semibold text-slate-700">{selectedItem.status}</span>
                    </div>
                  </div>
                </div>

                {/* Items Table Preview */}
                <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Items in this Document ({selectedItem.items.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">All lines will be populated</span>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-3">#</th>
                          <th className="py-1.5 px-3">Item Description</th>
                          <th className="py-1.5 px-3 text-right">Qty</th>
                          <th className="py-1.5 px-3 text-right">Rate</th>
                          <th className="py-1.5 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {selectedItem.items.map((it: any, i: number) => {
                          const qty = Number(it.qty) || 0;
                          const rate = Number(it.rate) || 0;
                          const lineTot = Number(it.lineTotal) || Number(it.amount) || (qty * rate);
                          return (
                            <tr key={i} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                              <td className="py-2 px-3 font-semibold">
                                <div className="text-slate-900 font-bold">{it.itemName || it.itemCode}</div>
                                {it.itemCode && it.itemName && it.itemCode !== it.itemName && (
                                  <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                                )}
                                {it.lineDescription && (
                                  <div className="text-[10px] text-indigo-600 italic">{it.lineDescription}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {qty} {it.unit || 'Pcs'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {currencySymbol} {rate.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-extrabold text-indigo-950">
                                {currencySymbol} {lineTot.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Action inside preview */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-3 shrink-0">
                  <div className="text-xs text-slate-500 font-medium">
                    Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-700">Enter</kbd> to fetch
                  </div>
                  <button
                    type="button"
                    onClick={() => handleConfirm(selectedItem)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm hover:shadow-md transition cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Fetch & Fill Form ({selectedItem.docNo})</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Sparkles className="h-10 w-10 text-slate-300 mb-2 stroke-1" />
                <p className="text-xs font-bold text-slate-600">Select a document from the list</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Details will appear here for verification before loading.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Cycle:</span> Quotation → Sales Order → Delivery Note → Sales Invoice
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition"
          >
            Cancel [Esc]
          </button>
        </div>

      </div>
    </div>
  );
};
