import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  ArrowUpRight, 
  Layers,
  Calendar,
  Check,
  Filter,
  ArrowLeft
} from 'lucide-react';
import { 
  getPartyBillWiseStatement, 
  BillWiseItem, 
  PartyBillWiseStatement 
} from '../services/billWiseStatementService';
import { formatDateDMY } from '../utils/dateUtils';

interface BillWiseLedgerStatementViewProps {
  ledgerName: string;
  currencySymbol?: string;
  onDrillVoucher?: (refNo: string) => void;
  onBackToLedgerView?: () => void;
  headerHeight?: number;
}

export const BillWiseLedgerStatementView: React.FC<BillWiseLedgerStatementViewProps> = ({
  ledgerName,
  currencySymbol = 'Nu.',
  onDrillVoucher,
  onBackToLedgerView,
  headerHeight = 0
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  // Compute bill-wise statement
  const statement = useMemo<PartyBillWiseStatement | null>(() => {
    return getPartyBillWiseStatement(ledgerName, filterStatus);
  }, [ledgerName, filterStatus]);

  // Filter bills by search query
  const displayedBills = useMemo<BillWiseItem[]>(() => {
    if (!statement) return [];
    if (!searchQuery.trim()) return statement.bills;
    const q = searchQuery.toLowerCase().trim();
    return statement.bills.filter(b => 
      b.billNo.toLowerCase().includes(q) || 
      b.billType.toLowerCase().includes(q) ||
      (b.notes && b.notes.toLowerCase().includes(q))
    );
  }, [statement, searchQuery]);

  if (!statement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 text-xs">No bill-wise transactions found for {ledgerName}.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedBillId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* 1. Filter Controls & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {onBackToLedgerView && (
            <button
              type="button"
              onClick={onBackToLedgerView}
              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs mr-1"
              title="Return to Standard Dr/Cr Ledger Statement View (F5)"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Standard Dr/Cr View (F5)</span>
            </button>
          )}

          <span className="text-slate-500 font-bold text-[11px] mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Show:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Bills ({statement.totalBillsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              filterStatus === 'PENDING'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            Pending Only ({statement.unpaidCount + statement.partiallyPaidCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('SETTLED')}
            className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
              filterStatus === 'SETTLED'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            Fully Settled ({statement.settledBillsCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Bill No..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 rounded-lg border border-slate-300 focus:bg-white focus:border-indigo-500 outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Bill-by-Bill Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th className="py-2.5 px-3 w-28">Bill Date</th>
                <th className="py-2.5 px-3 w-36">Bill / Ref No</th>
                <th className="py-2.5 px-3 w-28">Bill Type</th>
                <th className="py-2.5 px-3 text-right w-28">Original Amt</th>
                <th className="py-2.5 px-3 text-right w-28">Paid / Settled</th>
                <th className="py-2.5 px-3 text-right w-28">Pending Due</th>
                <th className="py-2.5 px-3 text-center w-28">Status</th>
                <th className="py-2.5 px-3 text-center w-24">Ageing</th>
                <th className="py-2.5 px-3 w-20 text-center">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {displayedBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <span className="font-semibold block">No matching bills found</span>
                    <span className="text-[11px] text-slate-400">Try changing the filter or search query</span>
                  </td>
                </tr>
              ) : (
                displayedBills.map((bill, index) => {
                  const isExpanded = expandedBillId === bill.id;
                  return (
                    <React.Fragment key={bill.id}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition ${
                          bill.status === 'Fully Settled' ? 'bg-slate-50/40 text-slate-600' : 'bg-white font-medium'
                        }`}
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-700">
                          {formatDateDMY(bill.billDate)}
                        </td>
                        <td className="py-2 px-3">
                          <span 
                            onClick={() => onDrillVoucher && onDrillVoucher(bill.billNo)}
                            className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                            title="Click to view voucher/invoice details"
                          >
                            {bill.billNo}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          <span className="text-[11px]">{bill.billType}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {currencySymbol} {bill.originalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {bill.paidAmount > 0 
                            ? `${currencySymbol} ${bill.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black">
                          {bill.pendingAmount > 0 ? (
                            <span className="text-rose-700">
                              {currencySymbol} {bill.pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">0.00</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {bill.status === 'Fully Settled' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Fully Settled</span>
                            </span>
                          )}
                          {bill.status === 'Partially Paid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              <span>Partially Paid</span>
                            </span>
                          )}
                          {bill.status === 'Unpaid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="h-3 w-3" />
                              <span>Pending / Unpaid</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {bill.status === 'Fully Settled' ? (
                            <span className="text-slate-400 text-[10px]">Cleared</span>
                          ) : bill.isOverdue ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {bill.daysOverdue}d overdue
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px] font-medium">
                              {bill.daysOverdue}d ago
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleExpand(bill.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title={isExpanded ? 'Collapse settlement history' : 'Expand settlement history'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-indigo-600" />
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <span>{bill.settlements.length}</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Settlement Audit Breakdown */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/40 border-b border-indigo-100">
                          <td colSpan={10} className="p-3 pl-12">
                            <div className="bg-white rounded-xl border border-indigo-200 p-3 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[11px] text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-indigo-600" />
                                  <span>Settlement History for Bill #{bill.billNo}</span>
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Original Amount: <strong className="text-slate-900 font-mono">{currencySymbol} {bill.originalAmount.toFixed(2)}</strong>
                                </span>
                              </div>

                              {bill.settlements.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-1">
                                  No payment vouchers have been allocated against this bill yet. (100% outstanding)
                                </p>
                              ) : (
                                <div className="space-y-1.5 pt-1">
                                  {bill.settlements.map((s, sIdx) => (
                                    <div 
                                      key={sIdx}
                                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200">
                                          {s.voucherType}
                                        </span>
                                        <span 
                                          onClick={() => onDrillVoucher && onDrillVoucher(s.voucherNo)}
                                          className="font-mono font-bold text-indigo-600 hover:underline cursor-pointer"
                                        >
                                          #{s.voucherNo}
                                        </span>
                                        <span className="text-slate-400 text-[11px]">•</span>
                                        <span className="text-slate-500 font-mono text-[11px]">{formatDateDMY(s.date)}</span>
                                        {s.narration && (
                                          <span className="text-slate-500 text-[11px] italic truncate max-w-xs">
                                            "{s.narration}"
                                          </span>
                                        )}
                                      </div>

                                      <div className="font-mono font-black text-emerald-700">
                                        + {currencySymbol} {s.amount.toFixed(2)}
                                      </div>
                                    </div>
                                  ))}

                                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs font-bold">
                                    <span className="text-slate-600">Remaining Balance:</span>
                                    <span className={`font-mono text-sm ${bill.pendingAmount > 0 ? 'text-rose-700 font-black' : 'text-emerald-700'}`}>
                                      {currencySymbol} {bill.pendingAmount.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {/* Table Footer with Summary */}
            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
              <tr>
                <td colSpan={4} className="py-2.5 px-3 uppercase tracking-wider text-[11px]">
                  Total Movement ({displayedBills.length} Bills)
                </td>
                <td className="py-2.5 px-3 text-right font-mono">
                  {currencySymbol} {displayedBills.reduce((s, b) => s + b.originalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-black">
                  {currencySymbol} {displayedBills.reduce((s, b) => s + b.paidAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-rose-800 font-black">
                  {currencySymbol} {displayedBills.reduce((s, b) => s + b.pendingAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={3} className="py-2.5 px-3 text-center text-slate-500 font-normal">
                  {displayedBills.filter(b => b.status === 'Fully Settled').length} Settled • {displayedBills.filter(b => b.status !== 'Fully Settled').length} Pending
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
