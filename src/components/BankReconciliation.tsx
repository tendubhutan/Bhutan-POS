import React, { useState, useMemo } from 'react';
import { 
  loadJson, 
  STORAGE_KEYS, 
  getBankRecon, 
  saveBankRecon, 
  updateTransactionReference, 
  getVoucherDetails 
} from '../services/storageService';
import { Ledger, LedgerLogEntry, Voucher, SalesInvoice, PurchaseInvoice, Config } from '../types';
import { 
  Search, 
  Printer, 
  Calendar, 
  Check, 
  X, 
  CheckSquare, 
  Square, 
  FileText, 
  Eye, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Edit3, 
  RefreshCw, 
  Building, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Info,
  Hash
} from 'lucide-react';

const formatCurrency = (val: number) => 
  Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ReconFilterType = 'all' | 'unreconciled' | 'reconciled';

export const BankReconciliation: React.FC = () => {
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<ReconFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Drilldown modal state
  const [drilldownLog, setDrilldownLog] = useState<LedgerLogEntry | null>(null);
  const [drilldownDetails, setDrilldownDetails] = useState<any>(null);
  const [editingTxnId, setEditingTxnId] = useState<string>('');
  const [isSavingTxnId, setIsSavingTxnId] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const ledgers = useMemo(() => loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, []), [refreshTrigger]);
  const logs = useMemo(() => loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []), [refreshTrigger]);
  const vouchers = useMemo(() => loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []), [refreshTrigger]);
  const salesInvoices = useMemo(() => loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []), [refreshTrigger]);
  const purchaseInvoices = useMemo(() => loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []), [refreshTrigger]);
  const config = useMemo(() => loadJson<Config>(STORAGE_KEYS.CONFIG, {} as Config), [refreshTrigger]);
  const [reconState, setReconState] = useState(getBankRecon());

  const bankLedgers = useMemo(() => ledgers.filter(l => l.Group === 'Bank Accounts'), [ledgers]);

  // If no bank is selected, auto-select first bank ledger if available
  React.useEffect(() => {
    if (!selectedBank && bankLedgers.length > 0) {
      setSelectedBank(bankLedgers[0]['Ledger Name']);
    }
  }, [bankLedgers, selectedBank]);

  // Helper to resolve transaction ID from all possible sources
  const resolveTransactionId = (log: LedgerLogEntry): string => {
    const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
    if (reconState[key]?.transactionId) {
      return reconState[key].transactionId!;
    }
    if (log.transactionId) return log.transactionId;
    if (log['Transaction ID']) return log['Transaction ID'];

    const ref = log['Ref No'] || '';
    if (!ref) return '';

    // Search vouchers
    const matchedVoucher = vouchers.find(v => v.voucherNo === ref);
    if (matchedVoucher) {
      if (matchedVoucher.transactionId) return matchedVoucher.transactionId;
      if (matchedVoucher.bankTxnNo) return matchedVoucher.bankTxnNo;
      if (matchedVoucher.chequeNo) return matchedVoucher.chequeNo;
    }

    // Search sales invoices
    const matchedSale = salesInvoices.find(s => s.invoiceNo === ref);
    if (matchedSale) {
      if (matchedSale.bankTxnNo) return matchedSale.bankTxnNo;
      if (matchedSale.bank2TxnNo) return matchedSale.bank2TxnNo;
    }

    // Search purchases
    const matchedPurchase = purchaseInvoices.find(p => p.billNo === ref || p.invoiceNo === ref);
    if (matchedPurchase) {
      if (matchedPurchase.bankTxnNo) return matchedPurchase.bankTxnNo;
      if (matchedPurchase.bank2TxnNo) return matchedPurchase.bank2TxnNo;
    }

    // Extract from narration regex
    if (log.Narration) {
      const match = log.Narration.match(/(?:Txn\/Ref|Txn|Ref|Chq|Cheque|ID)[:\s]+([A-Za-z0-9\-_/]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    return '';
  };

  // Get current bank details
  const currentBankLedger = useMemo(() => {
    return ledgers.find(l => l['Ledger Name'] === selectedBank);
  }, [ledgers, selectedBank]);

  // Calculate Book Balance
  const bookBalance = useMemo(() => {
    if (!selectedBank) return 0;
    if (!currentBankLedger) return 0;
    return (Number(currentBankLedger['Current Balance']) || 0) * (currentBankLedger['Balance Type (Dr/Cr)'] === 'Cr' ? -1 : 1);
  }, [currentBankLedger, selectedBank]);

  // All logs for selected bank in date range
  const rawBankLogs = useMemo(() => {
    if (!selectedBank) return [];
    const fDate = new Date(fromDate).setHours(0, 0, 0, 0);
    const tDate = new Date(toDate).setHours(23, 59, 59, 999);
    return logs
      .filter(l => 
        l['Ledger Name'] === selectedBank && 
        new Date(l.DateIso).getTime() >= fDate && 
        new Date(l.DateIso).getTime() <= tDate
      )
      .sort((a, b) => new Date(a.DateIso).getTime() - new Date(b.DateIso).getTime());
  }, [logs, selectedBank, fromDate, toDate]);

  // Calculate reconciliation summary figures across ALL periods for this bank
  const unpresentedCheques = useMemo(() => {
    let sum = 0;
    logs.filter(l => l['Ledger Name'] === selectedBank).forEach(l => {
      const key = `${l.DateIso}|${l['Ref No'] || ''}|${l.Debit || 0}|${l.Credit || 0}`;
      if (!reconState[key]?.isCleared && (Number(l.Credit) || 0) > 0) {
        sum += Number(l.Credit);
      }
    });
    return sum;
  }, [logs, selectedBank, reconState]);

  const unclearedDeposits = useMemo(() => {
    let sum = 0;
    logs.filter(l => l['Ledger Name'] === selectedBank).forEach(l => {
      const key = `${l.DateIso}|${l['Ref No'] || ''}|${l.Debit || 0}|${l.Credit || 0}`;
      if (!reconState[key]?.isCleared && (Number(l.Debit) || 0) > 0) {
        sum += Number(l.Debit);
      }
    });
    return sum;
  }, [logs, selectedBank, reconState]);

  const bankBalance = bookBalance + unpresentedCheques - unclearedDeposits;

  // Filtered logs based on filterType and search query
  const displayedLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rawBankLogs.filter(log => {
      const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
      const isCleared = !!reconState[key]?.isCleared;
      const txnId = resolveTransactionId(log);

      // Status filter
      if (filterType === 'unreconciled' && isCleared) return false;
      if (filterType === 'reconciled' && !isCleared) return false;

      // Search filter
      if (q) {
        const refMatch = (log['Ref No'] || '').toLowerCase().includes(q);
        const narrMatch = (log.Narration || '').toLowerCase().includes(q);
        const typeMatch = (log.Type || '').toLowerCase().includes(q);
        const txnMatch = txnId.toLowerCase().includes(q);
        const debitMatch = log.Debit ? String(log.Debit).includes(q) : false;
        const creditMatch = log.Credit ? String(log.Credit).includes(q) : false;

        if (!refMatch && !narrMatch && !typeMatch && !txnMatch && !debitMatch && !creditMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rawBankLogs, filterType, searchQuery, reconState]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let reconciled = 0;
    let unreconciled = 0;
    rawBankLogs.forEach(log => {
      const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
      if (reconState[key]?.isCleared) reconciled++;
      else unreconciled++;
    });
    return {
      all: rawBankLogs.length,
      reconciled,
      unreconciled
    };
  }, [rawBankLogs, reconState]);

  const toggleClearance = (log: LedgerLogEntry) => {
    const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
    const newState = { ...reconState };
    if (newState[key]?.isCleared) {
      delete newState[key];
    } else {
      const resolvedTxn = resolveTransactionId(log);
      newState[key] = { 
        isCleared: true, 
        clearedDate: new Date().toISOString().split('T')[0],
        transactionId: resolvedTxn || undefined
      };
    }
    setReconState(newState);
    saveBankRecon(newState);
  };

  const updateClearedDate = (log: LedgerLogEntry, date: string) => {
    const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
    const newState = { ...reconState };
    if (newState[key]) {
      newState[key].clearedDate = date;
      setReconState(newState);
      saveBankRecon(newState);
    }
  };

  // Open drill-down modal
  const handleOpenDrilldown = (log: LedgerLogEntry) => {
    setDrilldownLog(log);
    const resolvedTxn = resolveTransactionId(log);
    setEditingTxnId(resolvedTxn);
    setSaveSuccessMsg('');

    // Fetch full details
    const refNo = log['Ref No'] || '';
    if (refNo) {
      const details = getVoucherDetails(refNo);
      setDrilldownDetails(details);
    } else {
      setDrilldownDetails(null);
    }
  };

  const handleSaveDrilldownTxnId = () => {
    if (!drilldownLog) return;
    setIsSavingTxnId(true);
    const refNo = drilldownLog['Ref No'] || '';
    const cleanTxn = editingTxnId.trim();

    // 1. Update in recon state
    const key = `${drilldownLog.DateIso}|${drilldownLog['Ref No'] || ''}|${drilldownLog.Debit || 0}|${drilldownLog.Credit || 0}`;
    const newState = { ...reconState };
    if (!newState[key]) {
      newState[key] = { isCleared: false, transactionId: cleanTxn };
    } else {
      newState[key] = { ...newState[key], transactionId: cleanTxn };
    }
    setReconState(newState);
    saveBankRecon(newState);

    // 2. Update in ledger log, vouchers, sales, purchases
    if (refNo) {
      updateTransactionReference(refNo, cleanTxn, drilldownLog['Ledger Name']);
    }

    setRefreshTrigger(prev => prev + 1);
    setIsSavingTxnId(false);
    setSaveSuccessMsg('Transaction ID updated successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleMarkAllFiltered = (clear: boolean) => {
    const newState = { ...reconState };
    const today = new Date().toISOString().split('T')[0];

    displayedLogs.forEach(log => {
      const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
      if (clear) {
        const resolvedTxn = resolveTransactionId(log);
        newState[key] = {
          isCleared: true,
          clearedDate: today,
          transactionId: resolvedTxn || undefined
        };
      } else {
        delete newState[key];
      }
    });

    setReconState(newState);
    saveBankRecon(newState);
  };

  const handlePrintA5 = () => {
    if (!selectedBank) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const filterLabel = 
      filterType === 'reconciled' ? 'Reconciled Only' :
      filterType === 'unreconciled' ? 'Unreconciled Only' : 'All Transactions';

    let html = `
      <html>
        <head>
          <title>Bank Reconciliation - ${selectedBank}</title>
          <style>
            @page { size: A5; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 9px; color: #1e293b; margin: 0; padding: 0; }
            h2 { text-align: center; margin-bottom: 2px; font-size: 14px; text-transform: uppercase; color: #0f172a; font-weight: 800; }
            h3 { text-align: center; margin-top: 0; margin-bottom: 12px; font-size: 10px; font-weight: 600; color: #64748b; }
            .badge-bar { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 8.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .summary { margin-bottom: 12px; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; background-color: #f8fafc; }
            .summary table { width: 100%; border-collapse: collapse; }
            .summary td { padding: 3px 0; font-size: 9px; }
            .summary .amt { text-align: right; font-weight: 700; font-size: 9.5px; }
            .summary .total-row td { border-top: 1.5px solid #0f172a; font-weight: 800; font-size: 10px; padding-top: 5px; color: #0f172a; }
            table.details { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.details th, table.details td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 8.5px; }
            table.details th { background-color: #f1f5f9; font-weight: 700; color: #334155; text-transform: uppercase; font-size: 8px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .cleared-badge { color: #059669; font-weight: 700; }
            .pending-badge { color: #d97706; font-weight: 700; }
          </style>
        </head>
        <body>
          <h2>${config.CompanyName || 'Bank Reconciliation Statement'}</h2>
          <h3>Bank: ${selectedBank} ${currentBankLedger?.['Account No'] ? `(A/C: ${currentBankLedger['Account No']})` : ''} | Period: ${fromDate} to ${toDate}</h3>
          
          <div class="badge-bar">
            <span><strong>Scope:</strong> ${filterLabel}</span>
            <span><strong>Generated On:</strong> ${new Date().toLocaleString()}</span>
          </div>

          <div class="summary">
            <table>
              <tr>
                <td>Balance as per Company Books:</td>
                <td class="amt">${formatCurrency(Math.abs(bookBalance))} ${bookBalance >= 0 ? 'Dr' : 'Cr'}</td>
              </tr>
              <tr>
                <td>Add: Unpresented Cheques / Outflows (Credits not cleared):</td>
                <td class="amt" style="color: #2563eb;">+ ${formatCurrency(unpresentedCheques)}</td>
              </tr>
              <tr>
                <td>Less: Uncleared Deposits / Inflows (Debits not cleared):</td>
                <td class="amt" style="color: #dc2626;">- ${formatCurrency(unclearedDeposits)}</td>
              </tr>
              <tr class="total-row">
                <td>Balance as per Bank Statement:</td>
                <td class="amt">${formatCurrency(Math.abs(bankBalance))} ${bankBalance >= 0 ? 'Dr' : 'Cr'}</td>
              </tr>
            </table>
          </div>

          <h4 style="margin-bottom: 4px; font-size: 10px; font-weight: 700;">Transactions Statement (${displayedLogs.length} Records)</h4>
          <table class="details">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref / Bill No</th>
                <th>Bank Txn ID / Ref</th>
                <th>Narration</th>
                <th class="text-right">Deposit (Dr)</th>
                <th class="text-right">Withdrawal (Cr)</th>
                <th class="text-center">Status</th>
                <th>Clear Date</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (displayedLogs.length === 0) {
      html += `<tr><td colspan="8" class="text-center" style="padding: 15px; color: #64748b;">No transactions match the selected filter.</td></tr>`;
    } else {
      displayedLogs.forEach(l => {
        const key = `${l.DateIso}|${l['Ref No'] || ''}|${l.Debit || 0}|${l.Credit || 0}`;
        const isCleared = !!reconState[key]?.isCleared;
        const clearedDate = reconState[key]?.clearedDate || '-';
        const txnId = resolveTransactionId(l) || '-';

        html += `
          <tr>
            <td>${new Date(l.DateIso).toLocaleDateString()}</td>
            <td class="font-bold">${l['Ref No'] || '-'}</td>
            <td style="font-family: monospace; font-size: 8px;">${txnId}</td>
            <td>${l.Narration || '-'}</td>
            <td class="text-right font-bold" style="color: #059669;">${l.Debit ? formatCurrency(Number(l.Debit)) : '-'}</td>
            <td class="text-right font-bold" style="color: #dc2626;">${l.Credit ? formatCurrency(Number(l.Credit)) : '-'}</td>
            <td class="text-center ${isCleared ? 'cleared-badge' : 'pending-badge'}">${isCleared ? 'Cleared' : 'Uncleared'}</td>
            <td>${isCleared ? clearedDate : '-'}</td>
          </tr>
        `;
      });
    }

    html += `
            </tbody>
          </table>
          <div style="margin-top: 25px; display: flex; justify-content: space-between; padding: 0 10px;">
            <div>
              <p style="margin: 0; font-size: 8.5px;">Prepared By: ________________</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 8.5px;">Authorized Signatory: ________________</p>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col h-full bg-slate-50/50">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building className="h-7 w-7 text-indigo-600" />
            Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Reconcile book entries with bank statement references, track Bank Txn IDs & Cheque numbers
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            title="Refresh bank logs"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button 
            id="print-bank-recon-btn"
            onClick={handlePrintA5}
            disabled={!selectedBank}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            Print Statement (A5)
          </button>
        </div>
      </div>

      {/* Control & Filter Panel */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Bank Account
            </label>
            <select 
              id="select-bank-ledger"
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-semibold text-slate-800 bg-white"
            >
              <option value="">-- Select Bank Account --</option>
              {bankLedgers.map(l => (
                <option key={l['Ledger Name']} value={l['Ledger Name']}>
                  {l['Ledger Name']} {l['Account No'] ? `(A/C: ${l['Account No']})` : ''} - Bal: Nu. {formatCurrency(Number(l['Current Balance']) || 0)} {l['Balance Type (Dr/Cr)']}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              From Date
            </label>
            <input 
              id="recon-from-date"
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              To Date
            </label>
            <input 
              id="recon-to-date"
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium text-slate-700"
            />
          </div>
        </div>

        {/* Secondary Filter & Search Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <button
              id="filter-all-btn"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                filterType === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {counts.all}
              </span>
            </button>
            <button
              id="filter-unreconciled-btn"
              onClick={() => setFilterType('unreconciled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterType === 'unreconciled'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              Unreconciled Only
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                filterType === 'unreconciled' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-800'
              }`}>
                {counts.unreconciled}
              </span>
            </button>
            <button
              id="filter-reconciled-btn"
              onClick={() => setFilterType('reconciled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                filterType === 'reconciled'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              Reconciled Only
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                filterType === 'reconciled' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800'
              }`}>
                {counts.reconciled}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              id="search-recon-logs"
              type="text"
              placeholder="Search Ref, Txn ID, Narration..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-medium text-slate-700 bg-slate-50/50 focus:bg-white transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedBank ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Reconciliation Summary Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Reconciliation Summary
                </h3>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {counts.all > 0 ? `${Math.round((counts.reconciled / counts.all) * 100)}% Cleared` : '0%'}
                </span>
              </div>

              {/* Bank Metadata */}
              {currentBankLedger && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    {currentBankLedger['Bank Name'] || selectedBank}
                  </div>
                  {currentBankLedger['Account No'] && (
                    <div className="text-slate-500 font-mono">A/C: {currentBankLedger['Account No']}</div>
                  )}
                  {currentBankLedger.Branch && (
                    <div className="text-slate-500">Branch: {currentBankLedger.Branch}</div>
                  )}
                </div>
              )}
              
              {/* Calculations breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">Book Balance:</span>
                  <span className={`font-bold ${bookBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    Nu. {formatCurrency(Math.abs(bookBalance))} {bookBalance >= 0 ? 'Dr' : 'Cr'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 font-medium flex items-center gap-1 text-xs">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    + Unpresented Cheques (Cr):
                  </span>
                  <span className="font-bold text-slate-700">Nu. {formatCurrency(unpresentedCheques)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-rose-700 font-medium flex items-center gap-1 text-xs">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                    - Uncleared Deposits (Dr):
                  </span>
                  <span className="font-bold text-slate-700">Nu. {formatCurrency(unclearedDeposits)}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-3.5 border-t border-slate-100">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Bank Balance
                  </span>
                  <span className="text-[10px] text-slate-400">As per Statement</span>
                </div>
                <span className={`text-base font-black ${bankBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Nu. {formatCurrency(Math.abs(bankBalance))} {bankBalance >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Quick Actions
              </h4>
              <button
                onClick={() => handleMarkAllFiltered(true)}
                disabled={displayedLogs.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                Clear All Filtered ({displayedLogs.length})
              </button>
              <button
                onClick={() => handleMarkAllFiltered(false)}
                disabled={displayedLogs.length === 0}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                Unclear All Filtered
              </button>
            </div>
          </div>
          
          {/* Right Column: Transactions Table */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[550px]">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Bank Transactions
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                    Showing {displayedLogs.length} of {rawBankLogs.length}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Click on any row to drill down into full voucher/invoice details
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[750px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center w-12">
                        Clear
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                        Date
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-28">
                        Ref / Bill No
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-36">
                        Bank Txn ID / Ref
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Narration / Particulars
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right w-28">
                        Deposit (Dr)
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right w-28">
                        Withdrawal (Cr)
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider w-32">
                        Clear Date
                      </th>
                      <th className="py-3 px-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center w-16">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {displayedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-slate-400 font-medium">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Info className="w-8 h-8 text-slate-300" />
                            <p className="text-sm font-semibold text-slate-600">No transactions found</p>
                            <p className="text-xs text-slate-400">
                              {searchQuery || filterType !== 'all' 
                                ? 'Try adjusting your search query or filter selection.'
                                : 'No bank debit/credit logs recorded in this date range.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedLogs.map((log, idx) => {
                        const key = `${log.DateIso}|${log['Ref No'] || ''}|${log.Debit || 0}|${log.Credit || 0}`;
                        const isCleared = !!reconState[key]?.isCleared;
                        const clearedDate = reconState[key]?.clearedDate || '';
                        const txnId = resolveTransactionId(log);
                        
                        return (
                          <tr 
                            key={idx} 
                            className={`hover:bg-indigo-50/40 transition-colors group cursor-pointer ${
                              isCleared ? 'bg-emerald-50/25' : ''
                            }`}
                            onClick={() => handleOpenDrilldown(log)}
                          >
                            {/* Checkbox */}
                            <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => toggleClearance(log)}
                                title={isCleared ? 'Mark as Uncleared' : 'Mark as Cleared'}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                  isCleared 
                                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm' 
                                    : 'bg-white border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500/40'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>
                            </td>

                            {/* Date */}
                            <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {new Date(log.DateIso).toLocaleDateString()}
                            </td>

                            {/* Ref No */}
                            <td className="py-2.5 px-3 text-slate-800 font-bold whitespace-nowrap">
                              <span className="font-mono bg-slate-100 group-hover:bg-indigo-100/60 px-1.5 py-0.5 rounded text-slate-800 transition">
                                {log['Ref No'] || '-'}
                              </span>
                            </td>

                            {/* Bank Txn ID / Ref */}
                            <td className="py-2.5 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              {txnId ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                                  <Hash className="w-3 h-3 text-indigo-400" />
                                  {txnId}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenDrilldown(log)}
                                  className="text-[11px] font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 px-1.5 py-0.5 rounded transition inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-2.5 h-2.5" /> + Add Txn ID
                                </button>
                              )}
                            </td>

                            {/* Narration */}
                            <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate" title={log.Narration}>
                              {log.Narration || '-'}
                            </td>

                            {/* Debit (Deposit) */}
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                              {log.Debit ? `Nu. ${formatCurrency(Number(log.Debit))}` : '-'}
                            </td>

                            {/* Credit (Withdrawal) */}
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 whitespace-nowrap">
                              {log.Credit ? `Nu. ${formatCurrency(Number(log.Credit))}` : '-'}
                            </td>

                            {/* Cleared Date */}
                            <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                              {isCleared ? (
                                <input 
                                  type="date" 
                                  value={clearedDate}
                                  onChange={e => updateClearedDate(log, e.target.value)}
                                  className="h-7 px-2 w-28 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-[11px] font-medium text-slate-700 bg-white"
                                />
                              ) : (
                                <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Uncleared
                                </span>
                              )}
                            </td>

                            {/* Drilldown button */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleOpenDrilldown(log)}
                                title="Drill down to view complete details"
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No Bank Account Selected</h3>
          <p className="text-xs text-slate-400 mt-1">Please select a Bank Ledger above to reconcile transactions.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRILLDOWN DETAIL MODAL */}
      {/* ========================================================================= */}
      {drilldownLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Transaction Drill Down
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Ref No: <span className="font-mono font-bold text-slate-800">{drilldownLog['Ref No'] || 'N/A'}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDrilldownLog(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Date</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {new Date(drilldownLog.DateIso).toLocaleDateString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Type</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {drilldownLog.Type || 'Entry'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Amount</div>
                  <div className={`text-xs font-bold mt-0.5 ${
                    Number(drilldownLog.Debit) > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    Nu. {formatCurrency(Number(drilldownLog.Debit) || Number(drilldownLog.Credit) || 0)}
                    <span className="text-[10px] font-normal ml-1">
                      ({Number(drilldownLog.Debit) > 0 ? 'Deposit/Dr' : 'Withdrawal/Cr'})
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                  {(() => {
                    const key = `${drilldownLog.DateIso}|${drilldownLog['Ref No'] || ''}|${drilldownLog.Debit || 0}|${drilldownLog.Credit || 0}`;
                    const isClr = !!reconState[key]?.isCleared;
                    return (
                      <div className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${
                        isClr ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {isClr ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {isClr ? 'Cleared' : 'Uncleared'}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bank Transaction ID / Cheque Reference Field */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Bank Transaction ID / Reference No / Cheque No
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Hash className="w-4 h-4 text-indigo-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="e.g. TXN-89218392, CHQ-001292, UPI-99823"
                      value={editingTxnId}
                      onChange={e => setEditingTxnId(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-xs font-mono font-bold text-indigo-900 bg-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveDrilldownTxnId}
                    disabled={isSavingTxnId}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                  >
                    {isSavingTxnId ? 'Saving...' : 'Save & Update'}
                  </button>
                </div>
                {saveSuccessMsg && (
                  <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {saveSuccessMsg}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Saving this transaction reference propagates to accounting logs and underlying vouchers/invoices.
                </p>
              </div>

              {/* Narration */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Narration / Notes
                </label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
                  {drilldownLog.Narration || 'No narration entered'}
                </div>
              </div>

              {/* Linked Voucher Journal Lines Breakdown (if available) */}
              {drilldownDetails?.header?.lines && drilldownDetails.header.lines.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Full Accounting Journal Lines ({drilldownDetails.header.lines.length} lines)
                  </label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2 font-bold text-slate-600">Type</th>
                          <th className="p-2 font-bold text-slate-600">Ledger Account</th>
                          <th className="p-2 font-bold text-slate-600 text-right">Amount (Nu.)</th>
                          <th className="p-2 font-bold text-slate-600">Line Narration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drilldownDetails.header.lines.map((ln: any, lIdx: number) => (
                          <tr key={lIdx} className={ln.ledger === selectedBank ? 'bg-indigo-50/40 font-bold' : ''}>
                            <td className={`p-2 font-bold ${ln.type === 'Dr' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {ln.type}
                            </td>
                            <td className="p-2 text-slate-800">
                              {ln.ledger}
                              {ln.ledger === selectedBank && (
                                <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-normal">
                                  Current Bank
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-700">
                              {formatCurrency(Number(ln.amount) || 0)}
                            </td>
                            <td className="p-2 text-slate-500 italic max-w-[150px] truncate">
                              {ln.narration || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Linked Items List (if Sales / Purchase Invoice) */}
              {drilldownDetails?.items && drilldownDetails.items.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Invoice Items ({drilldownDetails.items.length} items)
                  </label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2 font-bold text-slate-600">Item</th>
                          <th className="p-2 font-bold text-slate-600 text-right">Qty</th>
                          <th className="p-2 font-bold text-slate-600 text-right">Rate</th>
                          <th className="p-2 font-bold text-slate-600 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drilldownDetails.items.map((it: any, iIdx: number) => (
                          <tr key={iIdx}>
                            <td className="p-2 text-slate-800 font-medium">
                              {it['Item Name'] || it.itemName || it.name}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">
                              {it.Qty || it.qty || 1}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-600">
                              {formatCurrency(Number(it.Rate || it.rate || 0))}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-800">
                              {formatCurrency(Number(it['Line Total'] || it.total || it['Taxable Value'] || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Clearance Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                {(() => {
                  const key = `${drilldownLog.DateIso}|${drilldownLog['Ref No'] || ''}|${drilldownLog.Debit || 0}|${drilldownLog.Credit || 0}`;
                  const isClr = !!reconState[key]?.isCleared;
                  const clrDate = reconState[key]?.clearedDate || new Date().toISOString().split('T')[0];

                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleClearance(drilldownLog)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                            isClr 
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700' 
                              : 'bg-white border border-slate-300 text-slate-700 hover:border-emerald-500'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          {isClr ? 'Cleared in Bank' : 'Mark as Cleared'}
                        </button>

                        {isClr && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="font-bold">Cleared Date:</span>
                            <input 
                              type="date"
                              value={clrDate}
                              onChange={e => updateClearedDate(drilldownLog, e.target.value)}
                              className="h-8 px-2 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <button
                  onClick={() => setDrilldownLog(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
