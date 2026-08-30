import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  BookOpen,
  ArrowRightLeft,
  Receipt,
  FileText,
  FileSpreadsheet,
  Package,
  Boxes,
  Truck,
  RotateCcw,
  Undo2,
  FileCheck2,
  Percent,
  Plus
} from 'lucide-react';

export type VoucherCategoryKey = 'financial' | 'invoicing' | 'inventory' | 'orders';

export type VoucherActionType =
  | 'P'
  | 'R'
  | 'J'
  | 'C'
  | 'CN'
  | 'DN'
  | 'DEL_NOTE'
  | 'PHYSICAL_STOCK'
  | 'QUOTATION'
  | 'S'
  | 'PUR';

export interface VoucherCatalogItem {
  id: VoucherActionType;
  name: string;
  category: VoucherCategoryKey;
  shortcut: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  borderLight: string;
  isExternalNavigation?: boolean;
}

export const VOUCHER_CATALOG: VoucherCatalogItem[] = [
  // Financial Vouchers
  {
    id: 'P',
    name: 'Payment Voucher',
    category: 'financial',
    shortcut: 'F5',
    description: 'Record outward payments for expenses, vendor dues, and asset purchases',
    icon: RotateCcw,
    color: 'text-rose-600',
    bgLight: 'bg-rose-50 hover:bg-rose-100/70',
    borderLight: 'border-rose-200'
  },
  {
    id: 'R',
    name: 'Receipt Voucher',
    category: 'financial',
    shortcut: 'F6',
    description: 'Record customer inward payments, cash inflows, and income receipts',
    icon: Receipt,
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50 hover:bg-emerald-100/70',
    borderLight: 'border-emerald-200'
  },
  {
    id: 'J',
    name: 'Journal Voucher',
    category: 'financial',
    shortcut: 'F7',
    description: 'Adjustment entries, depreciation, non-cash accruals & inter-account transfers',
    icon: BookOpen,
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-50 hover:bg-indigo-100/70',
    borderLight: 'border-indigo-200'
  },
  {
    id: 'C',
    name: 'Contra Voucher',
    category: 'financial',
    shortcut: 'F4',
    description: 'Deposit, cash withdrawal, or inter-bank account fund transfers',
    icon: ArrowRightLeft,
    color: 'text-amber-600',
    bgLight: 'bg-amber-50 hover:bg-amber-100/70',
    borderLight: 'border-amber-200'
  },

  // Invoicing & Returns
  {
    id: 'CN',
    name: 'Credit Note (Sales Return)',
    category: 'invoicing',
    shortcut: 'Ctrl+F8',
    description: 'Sales returns, price reductions, or customer credit allowances with stock return option',
    icon: Undo2,
    color: 'text-purple-600',
    bgLight: 'bg-purple-50 hover:bg-purple-100/70',
    borderLight: 'border-purple-200'
  },
  {
    id: 'DN',
    name: 'Debit Note (Purchase Return)',
    category: 'invoicing',
    shortcut: 'Ctrl+F9',
    description: 'Purchase returns to vendors, debit adjustments, or purchase price differences',
    icon: RotateCcw,
    color: 'text-orange-600',
    bgLight: 'bg-orange-50 hover:bg-orange-100/70',
    borderLight: 'border-orange-200'
  },
  {
    id: 'S',
    name: 'Sales Invoice / POS',
    category: 'invoicing',
    shortcut: 'F8',
    description: 'Create commercial tax invoice, retail receipt, or customer credit sale',
    icon: FileText,
    color: 'text-blue-600',
    bgLight: 'bg-blue-50 hover:bg-blue-100/70',
    borderLight: 'border-blue-200',
    isExternalNavigation: true
  },
  {
    id: 'PUR',
    name: 'Purchase Invoice / GRN',
    category: 'invoicing',
    shortcut: 'F9',
    description: 'Record vendor purchase bills, incoming inventory, and supplier liability',
    icon: FileSpreadsheet,
    color: 'text-teal-600',
    bgLight: 'bg-teal-50 hover:bg-teal-100/70',
    borderLight: 'border-teal-200',
    isExternalNavigation: true
  },

  // Inventory & Stock
  {
    id: 'DEL_NOTE',
    name: 'Delivery Note / Challan',
    category: 'inventory',
    shortcut: 'Alt+F8',
    description: 'Outward dispatch challan to record goods sent to customers prior to billing',
    icon: Truck,
    color: 'text-cyan-600',
    bgLight: 'bg-cyan-50 hover:bg-cyan-100/70',
    borderLight: 'border-cyan-200'
  },
  {
    id: 'PHYSICAL_STOCK',
    name: 'Physical Stock Verification',
    category: 'inventory',
    shortcut: 'Alt+F10',
    description: 'Physical inventory audit, count verification, and automatic shortage/excess adjustment',
    icon: Boxes,
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50/70 hover:bg-emerald-100/60',
    borderLight: 'border-emerald-200'
  },

  // Orders & Quotations
  {
    id: 'QUOTATION',
    name: 'Quotation / Estimate',
    category: 'orders',
    shortcut: 'Alt+F4',
    description: 'Generate professional price quotes & estimates with print layout & convert-to-sale',
    icon: FileCheck2,
    color: 'text-violet-600',
    bgLight: 'bg-violet-50 hover:bg-violet-100/70',
    borderLight: 'border-violet-200'
  }
];

interface VoucherCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVoucher: (type: VoucherActionType) => void;
  activeType: VoucherActionType;
}

export const VoucherCatalogModal: React.FC<VoucherCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectVoucher,
  activeType
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<VoucherCategoryKey | 'all'>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setHighlightedIndex(0);
    } else {
      setSearchTerm('');
      setSelectedCategory('all');
    }
  }, [isOpen]);

  const filteredItems = VOUCHER_CATALOG.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.shortcut.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Ensure highlighted index is within bounds
  useEffect(() => {
    if (highlightedIndex >= filteredItems.length) {
      setHighlightedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, highlightedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        onSelectVoucher(filteredItems[highlightedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const categories: { key: VoucherCategoryKey | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: 'All Vouchers', icon: '⚡' },
    { key: 'financial', label: 'Financial & Cash/Bank', icon: '🏦' },
    { key: 'invoicing', label: 'Invoicing & Returns', icon: '📑' },
    { key: 'inventory', label: 'Inventory & Stock', icon: '📦' },
    { key: 'orders', label: 'Orders & Quotations', icon: '📋' }
  ];

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="flex h-[90vh] max-h-[720px] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Voucher Directory & Catalog
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Browse categorized accounting vouchers, notes, challans & quotations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search and Category Filter Bar */}
        <div className="border-b border-slate-200 bg-white p-3 sm:px-6 sm:py-3.5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search voucher type by name, shortcut (e.g. F5, Ctrl+F8), or description..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map(c => (
              <button
                key={c.key}
                onClick={() => {
                  setSelectedCategory(c.key);
                  setHighlightedIndex(0);
                }}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 shadow-2xs ${
                  selectedCategory === c.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Grid */}
        <div ref={gridContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <BookOpen className="h-10 w-10 text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-700">No voucher types found</p>
              <p className="text-xs text-slate-500">Try changing your search terms or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredItems.map((item, idx) => {
                const IconComponent = item.icon;
                const isActive = activeType === item.id;
                const isHighlighted = highlightedIndex === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectVoucher(item.id);
                      onClose();
                    }}
                    onMouseMove={() => {
                      if (highlightedIndex !== idx) setHighlightedIndex(idx);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition text-xs shadow-2xs hover:shadow-md ${
                      isHighlighted
                        ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-500/40 shadow-sm'
                        : isActive
                        ? 'border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-300'
                        : `${item.borderLight} bg-white hover:border-slate-300`
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.bgLight} ${item.color} shadow-2xs`}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <span className="rounded-lg bg-slate-900/5 px-2 py-0.5 font-mono text-[10px] font-extrabold text-slate-800 border border-slate-200/80">
                          {item.shortcut}
                        </span>
                      </div>

                      <h3 className="font-black text-slate-900 text-sm group-hover:text-indigo-600 transition">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400 capitalize">
                        {item.category}
                      </span>
                      <span className={`font-bold text-indigo-600 flex items-center gap-1 transition ${
                        isHighlighted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        Select Voucher &rarr;
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>
            Tip: Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 font-bold border border-slate-300">F10</kbd> anywhere to open catalog. Use ↑/↓ or scroll to highlight and <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700 font-bold border border-slate-300">Enter</kbd> to select.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1 font-bold text-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
