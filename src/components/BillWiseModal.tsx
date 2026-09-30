import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Check, FileText, Calendar, ArrowRight, CheckCircle2, RotateCcw, Sparkles, Plus, Layers, Wallet, Clock, Hash } from 'lucide-react';
import { BillAllocation, BillWiseDetail } from '../types';
import { getPartyOutstandingBills } from '../services/storageService';

export type BillRefMethod = 'New Ref' | 'Agst Ref' | 'On Account' | 'Advance';

interface BillWiseModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyName: string;
  voucherType: 'P' | 'R' | 'J' | 'C' | string;
  voucherAmount: number | '';
  currencySymbol: string;
  defaultBillNo?: string;
  defaultBillDate?: string;
  initialAllocations?: BillAllocation[];
  onConfirm: (allocations: BillAllocation[], totalAllocated: number) => void;
}

export const BillWiseModal: React.FC<BillWiseModalProps> = ({
  isOpen,
  onClose,
  partyName,
  voucherType,
  voucherAmount,
  currencySymbol,
  defaultBillNo,
  defaultBillDate,
  initialAllocations = [],
  onConfirm,
}) => {
  const [bills, setBills] = useState<BillWiseDetail[]>([]);
  const [activeTab, setActiveTab] = useState<BillRefMethod>('Agst Ref');
  
  // Agst Ref Allocations map
  const [agstAllocations, setAgstAllocations] = useState<Record<string, number>>({});
  
  // New Ref state
  const [newRefNo, setNewRefNo] = useState('');
  const [newRefDate, setNewRefDate] = useState('');
  const [newRefDueDate, setNewRefDueDate] = useState('');
  const [newRefCreditDays, setNewRefCreditDays] = useState<number | ''>('');
  const [newRefAmt, setNewRefAmt] = useState<number | ''>('');

  // On Account state
  const [onAccountRef, setOnAccountRef] = useState('On Account');
  const [onAccountAmt, setOnAccountAmt] = useState<number | ''>('');

  // Advance state
  const [advanceRef, setAdvanceRef] = useState('Advance');
  const [advanceAmt, setAdvanceAmt] = useState<number | ''>('');
  
  // Custom confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);

  const applyBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const partyType = voucherType === 'P' ? 'creditor' : voucherType === 'R' ? 'debtor' : undefined;
  const targetAmount = typeof voucherAmount === 'number' && voucherAmount > 0 ? voucherAmount : 0;

  // Load outstanding bills and initialize allocations
  useEffect(() => {
    if (isOpen && partyName) {
      const outstanding = getPartyOutstandingBills(partyName, partyType);
      setBills(outstanding);

      const target = typeof voucherAmount === 'number' && voucherAmount > 0 ? voucherAmount : 0;
      const today = new Date().toISOString().split('T')[0];

      // Check if we already have initial allocations
      if (initialAllocations && initialAllocations.length > 0) {
        const primaryAlloc = initialAllocations[0];
        const primaryRefType = primaryAlloc.refType || (
          outstanding.some(b => b.billNo.toLowerCase() === primaryAlloc.billNo.toLowerCase()) ? 'Agst Ref' :
          primaryAlloc.billNo.toLowerCase().includes('on account') ? 'On Account' :
          primaryAlloc.billNo.toLowerCase().includes('adv') ? 'Advance' : 'New Ref'
        );

        setActiveTab(primaryRefType);

        const initAgstMap: Record<string, number> = {};
        initialAllocations.forEach(a => {
          const rType = a.refType || (outstanding.some(b => b.billNo.toLowerCase() === a.billNo.toLowerCase()) ? 'Agst Ref' : 'New Ref');
          if (rType === 'Agst Ref' || outstanding.some(b => b.billNo.toLowerCase() === a.billNo.toLowerCase())) {
            initAgstMap[a.billNo] = a.amount;
          } else if (rType === 'New Ref') {
            setNewRefNo(a.billNo);
            setNewRefDate(a.billDate || today);
            setNewRefDueDate(a.dueDate || '');
            setNewRefAmt(a.amount);
          } else if (rType === 'On Account') {
            setOnAccountRef(a.billNo || 'On Account');
            setOnAccountAmt(a.amount);
          } else if (rType === 'Advance') {
            setAdvanceRef(a.billNo || 'Advance');
            setAdvanceAmt(a.amount);
          }
        });
        setAgstAllocations(initAgstMap);
      } else {
        // Fresh opening
        // Default tab selection: In Journal vouchers, default to New Ref (new bill/expense). In other vouchers, default to Agst Ref if pending bills exist, or On Account if pure adjustment.
        if (voucherType === 'J') {
          setActiveTab('New Ref');
        } else if (outstanding.length === 0) {
          setActiveTab('On Account');
        } else {
          setActiveTab('Agst Ref');
        }

        // Set New Ref defaults
        setNewRefNo(defaultBillNo || `REF-${Math.floor(1000 + Math.random() * 9000)}`);
        setNewRefDate(defaultBillDate || today);
        setNewRefDueDate('');
        setNewRefCreditDays('');
        setNewRefAmt(target > 0 ? target : '');

        // Set On Account defaults
        setOnAccountRef('On Account');
        setOnAccountAmt(target > 0 ? target : '');

        // Set Advance defaults
        setAdvanceRef(`ADV-${today.replace(/-/g, '')}`);
        setAdvanceAmt(target > 0 ? target : '');

        // Smart auto-allocation for Agst Ref
        const initAgstMap: Record<string, number> = {};
        if (outstanding.length > 0 && target > 0) {
          let remaining = target;
          for (const b of outstanding) {
            if (remaining <= 0) break;
            const toAlloc = Math.min(remaining, b.pendingAmount);
            if (toAlloc > 0) {
              initAgstMap[b.billNo] = Math.round(toAlloc * 100) / 100;
              remaining -= toAlloc;
            }
          }
        } else if (outstanding.length === 1) {
          initAgstMap[outstanding[0].billNo] = outstanding[0].pendingAmount;
        }
        setAgstAllocations(initAgstMap);
      }
    }
  }, [isOpen, partyName, partyType, defaultBillNo, defaultBillDate]);

  // Sync credit days with due date in New Ref
  const handleCreditDaysChange = (days: number | '') => {
    setNewRefCreditDays(days);
    if (days !== '' && Number(days) >= 0) {
      const baseDate = newRefDate ? new Date(newRefDate) : new Date();
      baseDate.setDate(baseDate.getDate() + Number(days));
      setNewRefDueDate(baseDate.toISOString().split('T')[0]);
    }
  };

  const handleDueDateChange = (dStr: string) => {
    setNewRefDueDate(dStr);
    if (dStr && newRefDate) {
      const d1 = new Date(newRefDate).getTime();
      const d2 = new Date(dStr).getTime();
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) setNewRefCreditDays(diffDays);
    }
  };

  // Auto-focus input when tab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector<HTMLInputElement>(
            'input:not([type="checkbox"]):not([disabled])'
          );
          if (firstInput) {
            firstInput.focus();
            firstInput.select?.();
          } else if (applyBtnRef.current) {
            applyBtnRef.current.focus();
          }
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (applyBtnRef.current) {
        applyBtnRef.current.focus();
      }
    }
  };

  // Calculate total allocated based on active tab
  const totalAllocated = useMemo(() => {
    if (activeTab === 'Agst Ref') {
      return Object.values(agstAllocations).reduce((acc, v) => acc + (Number(v) || 0), 0);
    } else if (activeTab === 'New Ref') {
      return Number(newRefAmt) || 0;
    } else if (activeTab === 'On Account') {
      return Number(onAccountAmt) || 0;
    } else if (activeTab === 'Advance') {
      return Number(advanceAmt) || 0;
    }
    return 0;
  }, [activeTab, agstAllocations, newRefAmt, onAccountAmt, advanceAmt]);

  const balanceRemaining = Math.max(0, Math.round((targetAmount - totalAllocated) * 100) / 100);

  if (!isOpen) return null;

  const handleAmountChange = (billNo: string, val: string, maxPending: number) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      const next = { ...agstAllocations };
      delete next[billNo];
      setAgstAllocations(next);
      return;
    }
    const capped = Math.min(num, maxPending);
    setAgstAllocations(prev => ({
      ...prev,
      [billNo]: Math.round(capped * 100) / 100
    }));
  };

  const toggleBillSelection = (bill: BillWiseDetail) => {
    const current = agstAllocations[bill.billNo] || 0;
    if (current > 0) {
      const next = { ...agstAllocations };
      delete next[bill.billNo];
      setAgstAllocations(next);
    } else {
      const currentTotal = Object.values(agstAllocations).reduce((acc, v) => acc + (Number(v) || 0), 0);
      const remainingToAllocate = targetAmount > 0 ? Math.max(0, targetAmount - currentTotal) : Infinity;
      const amountToApply = remainingToAllocate === Infinity ? bill.pendingAmount : Math.min(remainingToAllocate, bill.pendingAmount);
      const finalAmount = amountToApply > 0 ? amountToApply : bill.pendingAmount;
      
      setAgstAllocations(prev => ({
        ...prev,
        [bill.billNo]: Math.round(finalAmount * 100) / 100
      }));
    }
  };

  const handleAutoAllocateFIFO = () => {
    if (targetAmount <= 0) {
      const next: Record<string, number> = {};
      bills.forEach(b => {
        next[b.billNo] = b.pendingAmount;
      });
      setAgstAllocations(next);
      return;
    }

    let remaining = targetAmount;
    const next: Record<string, number> = {};

    for (const b of bills) {
      if (remaining <= 0) break;
      const toAllocate = Math.min(remaining, b.pendingAmount);
      if (toAllocate > 0) {
        next[b.billNo] = Math.round(toAllocate * 100) / 100;
        remaining -= toAllocate;
      }
    }

    setAgstAllocations(next);
  };

  const handleClearAll = () => {
    if (activeTab === 'Agst Ref') {
      setAgstAllocations({});
    } else if (activeTab === 'New Ref') {
      setNewRefAmt('');
    } else if (activeTab === 'On Account') {
      setOnAccountAmt('');
    } else if (activeTab === 'Advance') {
      setAdvanceAmt('');
    }
  };

  const proceedApply = () => {
    const result: BillAllocation[] = [];

    if (activeTab === 'Agst Ref') {
      bills.forEach(b => {
        const amt = agstAllocations[b.billNo];
        if (amt && amt > 0) {
          result.push({
            refType: 'Agst Ref',
            billNo: b.billNo,
            billDate: b.billDate,
            billAmount: b.originalAmount,
            dueDate: b.dueDate,
            amount: amt
          });
        }
      });
    } else if (activeTab === 'New Ref') {
      const amt = Number(newRefAmt) || targetAmount || 0;
      if (amt > 0) {
        result.push({
          refType: 'New Ref',
          billNo: newRefNo.trim() || `REF-${Date.now().toString().slice(-4)}`,
          billDate: newRefDate || new Date().toISOString().split('T')[0],
          dueDate: newRefDueDate || undefined,
          billAmount: amt,
          amount: amt
        });
      }
    } else if (activeTab === 'On Account') {
      const amt = Number(onAccountAmt) || targetAmount || 0;
      if (amt > 0) {
        result.push({
          refType: 'On Account',
          billNo: onAccountRef.trim() || 'On Account',
          amount: amt
        });
      }
    } else if (activeTab === 'Advance') {
      const amt = Number(advanceAmt) || targetAmount || 0;
      if (amt > 0) {
        result.push({
          refType: 'Advance',
          billNo: advanceRef.trim() || 'Advance',
          amount: amt
        });
      }
    }

    onConfirm(result, totalAllocated);
    setShowConfirm(false);
    onClose();
  };

  const handleApply = () => {
    if (targetAmount > 0 && totalAllocated > targetAmount) {
      setShowConfirm(true);
      return;
    }
    proceedApply();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Bill-wise Details (Method of Adjustment)
                </h3>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Party: <span className="font-bold text-white">{partyName}</span>
                {targetAmount > 0 && (
                  <span className="ml-2 font-mono">
                    | Voucher Line Amount: <strong className="text-amber-300">{currencySymbol}{targetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Method of Adjustment Tabs */}
        <div className="px-5 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('New Ref')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'New Ref'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>1. New Ref (New Bill)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Agst Ref')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'Agst Ref'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Agst Ref (Pending Bills)</span>
            {bills.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'Agst Ref' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {bills.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('On Account')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'On Account'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>3. On Account (Pure Adjustment)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Advance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'Advance'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>4. Advance</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: NEW REF */}
          {activeTab === 'New Ref' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-600">
                  <strong className="text-indigo-950 block font-bold mb-0.5">New Reference / Supplier Bill Registration</strong>
                  Use this when recording a <strong>new bill or expense invoice</strong> (e.g. Stationery, Services, Consumables on credit). This creates a new payable bill under <strong>{partyName}</strong> that can be settled later via Payment voucher.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bill / Reference No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-90812 / STAT-001"
                    value={newRefNo}
                    onChange={e => setNewRefNo(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono font-bold text-slate-900 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bill Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newRefDate}
                    onChange={e => setNewRefDate(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-900 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Credit Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 30"
                    value={newRefCreditDays}
                    onChange={e => handleCreditDaysChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono text-slate-900 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newRefDueDate}
                    onChange={e => handleDueDateChange(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-900 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Allocated Bill Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={newRefAmt}
                      onChange={e => setNewRefAmt(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      onKeyDown={handleInputKeyDown}
                      className="w-full h-10 rounded-xl border border-indigo-300 bg-indigo-50/40 px-3 font-mono font-black text-sm text-indigo-950 outline-hidden focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    />
                    {targetAmount > 0 && newRefAmt !== targetAmount && (
                      <button
                        type="button"
                        onClick={() => setNewRefAmt(targetAmount)}
                        className="px-3 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Full Amount ({currencySymbol}{targetAmount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AGST REF */}
          {activeTab === 'Agst Ref' && (
            <div className="space-y-3 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoAllocateFIFO}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto Settle (FIFO)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="text-slate-500">
                    Outstanding Bills: <strong className="text-slate-800">{bills.length}</strong>
                  </span>
                  <span className="text-slate-500">
                    Total Due: <strong className="text-rose-600 font-mono">{currencySymbol}{bills.reduce((s, b) => s + b.pendingAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              </div>

              {bills.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                  <FileText className="w-9 h-9 text-slate-300 mx-auto" />
                  <div>
                    <p className="font-bold text-slate-700 text-sm">No Pending Invoices Found</p>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-sm mx-auto">
                      There are no open unpaid credit invoices recorded for <strong>{partyName}</strong> to settle against.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('New Ref')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-300 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition cursor-pointer"
                    >
                      → Record as New Ref (New Bill)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('On Account')}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
                    >
                      → Record On Account (Pure Adjustment)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3 w-10 text-center">
                          <CheckCircle2 className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="py-2.5 px-3">Bill / Ref No</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Bill Total</th>
                        <th className="py-2.5 px-3 text-right">Pending Due</th>
                        <th className="py-2.5 px-3 text-right w-36">Allocated Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bills.map(b => {
                        const allocated = agstAllocations[b.billNo] || 0;
                        const isSelected = allocated > 0;

                        return (
                          <tr 
                            key={b.billNo}
                            className={`transition ${
                              isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBillSelection(b)}
                                onKeyDown={handleInputKeyDown}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-950">
                              {b.billNo}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {b.billDate ? new Date(b.billDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {b.billType || 'Invoice'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {currencySymbol}{b.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                              {currencySymbol}{b.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-slate-400 font-mono text-[11px]">{currencySymbol}</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={b.pendingAmount}
                                  step="any"
                                  value={agstAllocations[b.billNo] ?? ''}
                                  placeholder="0.00"
                                  onChange={e => handleAmountChange(b.billNo, e.target.value, b.pendingAmount)}
                                  onKeyDown={handleInputKeyDown}
                                  className={`w-24 text-right font-mono font-bold text-xs px-2 py-1 bg-white border rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden ${isSelected ? 'border-indigo-300' : 'border-slate-300'}`}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ON ACCOUNT */}
          {activeTab === 'On Account' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-600">
                  <strong className="text-emerald-950 block font-bold mb-0.5">On Account (Pure Adjustment / Lump Sum)</strong>
                  Use this when there is <strong>no bill or invoice number</strong> involved (e.g. pure ledger balance transfer, year-end adjustments, interest entries, or unreferenced payments). No bill number or bill date is required.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Adjustment Note / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. On Account / Ledger Adjustment"
                    value={onAccountRef}
                    onChange={e => setOnAccountRef(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 font-medium outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={onAccountAmt}
                      onChange={e => setOnAccountAmt(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      onKeyDown={handleInputKeyDown}
                      className="w-full h-9 rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 font-mono font-black text-sm text-emerald-950 outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                    {targetAmount > 0 && onAccountAmt !== targetAmount && (
                      <button
                        type="button"
                        onClick={() => setOnAccountAmt(targetAmount)}
                        className="px-3 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Full ({currencySymbol}{targetAmount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCE */}
          {activeTab === 'Advance' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-600">
                  <strong className="text-amber-950 block font-bold mb-0.5">Advance Payment / Advance Receipt</strong>
                  Use this when making or receiving an advance before any supply or invoice is issued.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Advance Reference / Order No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ADV-001 / PO-991"
                    value={advanceRef}
                    onChange={e => setAdvanceRef(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 font-mono font-bold text-slate-900 outline-hidden focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Advance Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={advanceAmt}
                      onChange={e => setAdvanceAmt(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      onKeyDown={handleInputKeyDown}
                      className="w-full h-9 rounded-xl border border-amber-300 bg-amber-50/40 px-3 font-mono font-black text-sm text-amber-950 outline-hidden focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                    />
                    {targetAmount > 0 && advanceAmt !== targetAmount && (
                      <button
                        type="button"
                        onClick={() => setAdvanceAmt(targetAmount)}
                        className="px-3 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shrink-0 cursor-pointer"
                      >
                        Full ({currencySymbol}{targetAmount})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Method of Adjustment</span>
              <span className="font-extrabold text-xs text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {activeTab}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[10px]">Total Allocated</span>
              <span className="font-mono font-extrabold text-sm text-indigo-900">
                {currencySymbol}{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {targetAmount > 0 && (
              <div>
                <span className="text-slate-500 block text-[10px]">Voucher Target</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  {currencySymbol}{targetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {targetAmount > 0 && balanceRemaining > 0 && (
              <div>
                <span className="text-amber-600 block text-[10px] font-bold">Unallocated</span>
                <span className="font-mono font-bold text-xs text-amber-700">
                  {currencySymbol}{balanceRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              ref={applyBtnRef}
              type="button"
              onClick={handleApply}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleApply();
                }
              }}
              className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 outline-hidden shadow-md shadow-indigo-600/20 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply {activeTab}</span>
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Over-allocation Warning</h3>
            <p className="text-sm text-slate-600 mb-6">
              Total allocation ({currencySymbol}{totalAllocated.toLocaleString()}) exceeds the ledger amount ({currencySymbol}{targetAmount.toLocaleString()}).
              <br /><br />
              Do you want to proceed and overwrite the ledger amount?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={proceedApply}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    proceedApply();
                  }
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 rounded-lg transition"
              >
                Proceed & Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
