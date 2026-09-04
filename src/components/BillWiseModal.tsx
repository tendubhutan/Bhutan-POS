import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, FileText, Calendar, ArrowRight, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { BillAllocation, BillWiseDetail } from '../types';
import { getPartyOutstandingBills } from '../services/storageService';

interface BillWiseModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyName: string;
  voucherType: 'P' | 'R' | 'J' | 'C' | string;
  voucherAmount: number | '';
  currencySymbol: string;
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
  initialAllocations = [],
  onConfirm,
}) => {
  const [bills, setBills] = useState<BillWiseDetail[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [advanceRef, setAdvanceRef] = useState('');
  const [advanceAmt, setAdvanceAmt] = useState<number | ''>('');
  
  // Custom confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  
  const partyType = voucherType === 'P' ? 'creditor' : voucherType === 'R' ? 'debtor' : undefined;

  // Load outstanding bills whenever modal opens or party changes
  useEffect(() => {
    if (isOpen && partyName) {
      const outstanding = getPartyOutstandingBills(partyName, partyType);
      setBills(outstanding);

      // Initialize allocations from props or empty
      const initMap: Record<string, number> = {};
      let advAmt = 0;
      let advRef = '';
      initialAllocations.forEach(a => {
        if (outstanding.some(b => b.billNo.toLowerCase() === a.billNo.toLowerCase())) {
          initMap[a.billNo] = a.amount;
        } else {
          advRef = a.billNo;
          advAmt = a.amount;
        }
      });
      setAllocations(initMap);
      setAdvanceRef(advRef);
      setAdvanceAmt(advAmt > 0 ? advAmt : '');
    }
  }, [isOpen, partyName, partyType]);

  const billAllocatedAmount = useMemo(() => {
    return Object.values(allocations).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, [allocations]);

  const totalAllocated = useMemo(() => {
    const fromAdv = Number(advanceAmt) || 0;
    return Math.round((billAllocatedAmount + fromAdv) * 100) / 100;
  }, [billAllocatedAmount, advanceAmt]);

  const targetAmount = typeof voucherAmount === 'number' && voucherAmount > 0 ? voucherAmount : 0;
  const balanceRemaining = Math.max(0, Math.round((targetAmount - totalAllocated) * 100) / 100);

  // Auto-calculate On Account balance
  useEffect(() => {
    if (targetAmount > 0) {
      const remaining = Math.round((targetAmount - billAllocatedAmount) * 100) / 100;
      if (remaining > 0) {
        setAdvanceRef(prev => prev || 'On Account / Advance');
        setAdvanceAmt(remaining);
      } else {
        setAdvanceAmt('');
      }
    }
  }, [billAllocatedAmount, targetAmount]);

  if (!isOpen) return null;

  const handleAmountChange = (billNo: string, val: string, maxPending: number) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      const next = { ...allocations };
      delete next[billNo];
      setAllocations(next);
      return;
    }
    // Cap to pending amount
    const capped = Math.min(num, maxPending);
    setAllocations(prev => ({
      ...prev,
      [billNo]: Math.round(capped * 100) / 100
    }));
  };

  const toggleBillSelection = (bill: BillWiseDetail) => {
    const current = allocations[bill.billNo] || 0;
    if (current > 0) {
      // Uncheck - remove allocation
      const next = { ...allocations };
      delete next[bill.billNo];
      setAllocations(next);
    } else {
      // Check - apply remaining amount or full amount
      const remainingToAllocate = targetAmount > 0 ? Math.max(0, targetAmount - billAllocatedAmount) : Infinity;
      const amountToApply = remainingToAllocate === Infinity ? bill.pendingAmount : Math.min(remainingToAllocate, bill.pendingAmount);
      
      const finalAmount = amountToApply > 0 ? amountToApply : bill.pendingAmount;
      
      setAllocations(prev => ({
        ...prev,
        [bill.billNo]: Math.round(finalAmount * 100) / 100
      }));
    }
  };

  const handleFullSettle = (bill: BillWiseDetail) => {
    setAllocations(prev => ({
      ...prev,
      [bill.billNo]: bill.pendingAmount
    }));
  };

  const handleAutoAllocateFIFO = () => {
    if (targetAmount <= 0) {
      // Settle all full pending
      const next: Record<string, number> = {};
      bills.forEach(b => {
        next[b.billNo] = b.pendingAmount;
      });
      setAllocations(next);
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

    setAllocations(next);
    if (remaining > 0.005) {
      setAdvanceRef('On Account / Advance');
      setAdvanceAmt(Math.round(remaining * 100) / 100);
    } else {
      setAdvanceAmt('');
      setAdvanceRef('');
    }
  };

  const handleClearAll = () => {
    setAllocations({});
    setAdvanceRef('');
    setAdvanceAmt('');
  };

  const proceedApply = () => {
    const result: BillAllocation[] = [];
    bills.forEach(b => {
      const amt = allocations[b.billNo];
      if (amt && amt > 0) {
        result.push({
          billNo: b.billNo,
          billDate: b.billDate,
          billAmount: b.originalAmount,
          amount: amt
        });
      }
    });

    if (Number(advanceAmt) > 0) {
      result.push({
        billNo: advanceRef.trim() || 'On Account',
        amount: Number(advanceAmt)
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-linear-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white tracking-tight">
                  Bill-wise Details & Settlement
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Agst Ref
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Party: <span className="font-bold text-white">{partyName}</span>
                {targetAmount > 0 && (
                  <span className="ml-2 font-mono">
                    | Voucher Amount: {currencySymbol}{targetAmount.toLocaleString()}
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

        {/* Quick Toolbar */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
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
              Total Due: <strong className="text-rose-600 font-mono">{currencySymbol}{bills.reduce((s, b) => s + b.pendingAmount, 0).toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Bills List / Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {bills.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-sm">No Pending Invoices Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are no open unpaid credit invoices recorded for <span className="font-bold">{partyName}</span>. You can still record an On Account or Advance payment below.
              </p>
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
                    const allocated = allocations[b.billNo] || 0;
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
                          {currencySymbol}{b.originalAmount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          {currencySymbol}{b.pendingAmount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 font-mono text-[11px]">{currencySymbol}</span>
                            <input
                              type="number"
                              min="0"
                              max={b.pendingAmount}
                              step="any"
                              value={allocations[b.billNo] ?? ''}
                              placeholder="0.00"
                              onChange={e => handleAmountChange(b.billNo, e.target.value, b.pendingAmount)}
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

          {/* Advance / On Account Section */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 mb-2">
              <span className="text-indigo-600">●</span>
              <span>Advance / On Account Allocation</span>
              <span className="text-[10px] font-normal text-slate-500">(Optional for unadjusted amounts)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reference / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Advance Payment / Cheque No"
                  value={advanceRef}
                  onChange={e => setAdvanceRef(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono text-xs">{currencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={advanceAmt}
                    onChange={e => setAdvanceAmt(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full text-xs font-mono font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Total Allocated</span>
              <span className="font-mono font-extrabold text-sm text-indigo-900">
                {currencySymbol}{totalAllocated.toLocaleString()}
              </span>
            </div>

            {targetAmount > 0 && (
              <div>
                <span className="text-slate-500 block text-[10px]">Voucher Target</span>
                <span className="font-mono font-bold text-sm text-slate-800">
                  {currencySymbol}{targetAmount.toLocaleString()}
                </span>
              </div>
            )}

            {targetAmount > 0 && balanceRemaining > 0 && (
              <div>
                <span className="text-amber-600 block text-[10px] font-bold">Unallocated</span>
                <span className="font-mono font-bold text-xs text-amber-700">
                  {currencySymbol}{balanceRemaining.toLocaleString()}
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
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-600/20 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Allocations</span>
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
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
                onClick={proceedApply}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
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
