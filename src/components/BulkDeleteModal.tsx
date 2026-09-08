import React, { useState } from 'react';
import { 
  AlertTriangle, Trash2, X, CheckSquare, Square, ShieldAlert, Key, Calendar, 
  Layers, ShoppingCart, FileText, Download, Upload, CreditCard, DollarSign,
  BookOpen, ArrowRightLeft, CornerDownLeft, CornerUpRight, ClipboardList,
  Truck, Package, Users, Check, Filter, RefreshCw
} from 'lucide-react';
import { bulkDeleteData } from '../services/storageService';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataCleared: () => void;
}

const ALL_VOUCHER_CATEGORIES = [
  { id: 'sale_pos', label: 'POS Cash Sales', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'sale_b2b', label: 'B2B Sales Invoices', icon: FileText, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'purchase', label: 'Purchase Invoices', icon: Download, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'payment', label: 'Payment Vouchers', icon: CreditCard, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'receipt', label: 'Receipt Vouchers', icon: DollarSign, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'journal', label: 'Journal Vouchers', icon: BookOpen, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'contra', label: 'Contra Vouchers', icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'credit_note', label: 'Credit Notes', icon: CornerDownLeft, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'debit_note', label: 'Debit Notes', icon: CornerUpRight, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'quotation', label: 'Quotations & Estimates', icon: ClipboardList, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { id: 'delivery_note', label: 'Delivery Notes', icon: Truck, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'physical_stock', label: 'Physical Stock Adjustments', icon: Package, color: 'text-lime-600 bg-lime-50 border-lime-200' },
  { id: 'payroll', label: 'Payroll & Salary Slips', icon: Users, color: 'text-pink-600 bg-pink-50 border-pink-200' },
];

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, onClose, onDataCleared }) => {
  const [deleteTransactions, setDeleteTransactions] = useState(true);
  const [deleteMasters, setDeleteMasters] = useState(false);
  const [resetOpeningBalances, setResetOpeningBalances] = useState(false);

  // Transaction Filters
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'range'>('all');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [selectedVoucherCategories, setSelectedVoucherCategories] = useState<string[]>(() => 
    ALL_VOUCHER_CATEGORIES.map(c => c.id)
  );

  const [confirmCode, setConfirmCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSelectAllVoucherCategories = () => {
    setSelectedVoucherCategories(ALL_VOUCHER_CATEGORIES.map(c => c.id));
  };

  const handleClearAllVoucherCategories = () => {
    setSelectedVoucherCategories([]);
  };

  const toggleVoucherCategory = (id: string) => {
    setSelectedVoucherCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handlePresetDate = (preset: 'today' | 'this_month' | 'last_month' | 'this_fy') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setDateFilterMode('range');

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      setFromDate(firstDay);
      setToDate(lastDay);
    } else if (preset === 'this_fy') {
      // Bhutan FY typically Jan 1 to Dec 31 or Apr 1 to Mar 31
      const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const fyStart = `${year}-04-01`;
      setFromDate(fyStart);
      setToDate(todayStr);
    }
  };

  const handleExecuteBulkDelete = () => {
    if (!deleteTransactions && !deleteMasters && !resetOpeningBalances) {
      setErrorMsg('Please select at least one option to clean.');
      return;
    }

    if (deleteTransactions && selectedVoucherCategories.length === 0) {
      setErrorMsg('Please select at least one voucher type to delete or uncheck "Delete Transactions".');
      return;
    }

    if (confirmCode.trim().toUpperCase() !== 'DELETE') {
      setErrorMsg('Type "DELETE" in capital letters to confirm.');
      return;
    }

    bulkDeleteData({
      deleteTransactions,
      deleteMasters,
      resetOpeningBalances,
      dateFilterMode,
      fromDate: dateFilterMode === 'range' ? fromDate : undefined,
      toDate: dateFilterMode === 'range' ? toDate : undefined,
      selectedVoucherCategories: deleteTransactions ? selectedVoucherCategories : undefined
    });

    onDataCleared();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Bulk Data Cleanup & Transaction Purge</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
                  Ctrl+Alt+D
                </span>
              </div>
              <p className="text-xs text-slate-400">Targeted transaction deletion by date range & voucher types, or full system reset.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Main Scope Selection */}
          <div className="space-y-3">
            
            {/* Option 1: Delete Transactions */}
            <div className={`p-3.5 rounded-2xl border transition ${
              deleteTransactions ? 'bg-rose-50/50 border-rose-200 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-80'
            }`}>
              <div 
                onClick={() => setDeleteTransactions(!deleteTransactions)}
                className="flex items-start gap-3 cursor-pointer select-none"
              >
                <div className="mt-0.5 text-rose-600">
                  {deleteTransactions ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm block">Delete Transactions & Invoices</span>
                    {deleteTransactions && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md">
                        {dateFilterMode === 'range' ? 'Date Filtered' : 'All Dates'} • {selectedVoucherCategories.length} Types
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 text-xs block mt-0.5">
                    Selectively purge transactions by date range and voucher type, or clear all transactional history.
                  </span>
                </div>
              </div>

              {/* Transaction Filter Options (Sub-Panel) */}
              {deleteTransactions && (
                <div className="mt-4 pt-3.5 border-t border-rose-100/80 space-y-4 pl-1">
                  
                  {/* Date Filter Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-rose-600" />
                        <span>Date Range Filter</span>
                      </label>
                      
                      {/* Date Filter Mode Toggle */}
                      <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setDateFilterMode('all')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            dateFilterMode === 'all' 
                              ? 'bg-rose-600 text-white shadow-2xs' 
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          All Dates
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateFilterMode('range')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            dateFilterMode === 'range' 
                              ? 'bg-rose-600 text-white shadow-2xs' 
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Custom Date Range
                        </button>
                      </div>
                    </div>

                    {/* Date Pickers if Range Selected */}
                    {dateFilterMode === 'range' && (
                      <div className="p-3 bg-white rounded-xl border border-rose-200/80 space-y-2.5 shadow-2xs animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">From Date (Inclusive)</label>
                            <input
                              type="date"
                              value={fromDate}
                              onChange={e => setFromDate(e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">To Date (Inclusive)</label>
                            <input
                              type="date"
                              value={toDate}
                              onChange={e => setToDate(e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                            />
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">Quick Presets:</span>
                          <button
                            type="button"
                            onClick={() => handlePresetDate('today')}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePresetDate('this_month')}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                          >
                            This Month
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePresetDate('last_month')}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                          >
                            Last Month
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePresetDate('this_fy')}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition cursor-pointer"
                          >
                            Current Financial Year
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Voucher Type Filter Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Filter className="h-3.5 w-3.5 text-rose-600" />
                        <span>Voucher Types to Delete ({selectedVoucherCategories.length}/{ALL_VOUCHER_CATEGORIES.length})</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVoucherCategories}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-bold transition cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={handleClearAllVoucherCategories}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-bold transition cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Voucher Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-white rounded-xl border border-rose-200/80 max-h-48 overflow-y-auto">
                      {ALL_VOUCHER_CATEGORIES.map(cat => {
                        const isSelected = selectedVoucherCategories.includes(cat.id);
                        const Icon = cat.icon;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleVoucherCategory(cat.id)}
                            className={`p-2 rounded-lg border text-left flex items-center gap-2 transition cursor-pointer select-none text-xs ${
                              isSelected
                                ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200 text-slate-500 hover:bg-slate-100/70 font-medium'
                            }`}
                          >
                            <div className={`p-1 rounded-md shrink-0 ${isSelected ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <span className="truncate flex-1 text-[11px]">{cat.label}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-rose-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Option 2: Delete Masters */}
            <div 
              onClick={() => setDeleteMasters(!deleteMasters)}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer select-none transition ${
                deleteMasters ? 'bg-rose-50/50 border-rose-200 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
              }`}
            >
              <div className="mt-0.5 text-rose-600">
                {deleteMasters ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-sm block">Delete Master Files (Items & Custom Ledgers)</span>
                <span className="text-slate-500 text-xs block mt-0.5">
                  Removes custom inventory items, custom customer/supplier ledgers, employees, and pay heads.
                </span>
              </div>
            </div>

            {/* Option 3: Reset Opening Balances */}
            <div 
              onClick={() => setResetOpeningBalances(!resetOpeningBalances)}
              className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer select-none transition ${
                resetOpeningBalances ? 'bg-rose-50/50 border-rose-200 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
              }`}
            >
              <div className="mt-0.5 text-rose-600">
                {resetOpeningBalances ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-sm block">Reset Opening Balances to Zero</span>
                <span className="text-slate-500 text-xs block mt-0.5">
                  Resets opening cash, bank, ledger balances and item opening stock quantities to 0.00.
                </span>
              </div>
            </div>

          </div>

          {/* Action Summary Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Summary of Bulk Action</p>
              <p className="mt-0.5 text-amber-800 text-[11px]">
                {deleteTransactions ? (
                  dateFilterMode === 'range' 
                    ? `Will delete ${selectedVoucherCategories.length} selected voucher types between ${fromDate} and ${toDate}. Surviving transactions will have stock and ledger balances automatically rebuilt.`
                    : `Will delete all transactions across all dates for ${selectedVoucherCategories.length} voucher types.`
                ) : 'No transactions will be deleted.'}
              </p>
            </div>
          </div>

          {/* Security Confirmation */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Type <span className="text-rose-600 font-mono font-black">DELETE</span> to confirm bulk action:
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Type DELETE"
                value={confirmCode}
                onChange={e => {
                  setConfirmCode(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-600 font-bold animate-in fade-in">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-300 hover:bg-slate-100 text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteBulkDelete}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Execute Bulk Action</span>
          </button>
        </div>

      </div>
    </div>
  );
};

