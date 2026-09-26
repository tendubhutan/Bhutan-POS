import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Repeat,
  Sparkles,
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  History,
  ArrowRight,
  Zap,
  Info,
  Building,
  Lightbulb,
  Users,
  CreditCard,
  Layers
} from 'lucide-react';
import { Ledger, Config } from '../../types';
import {
  RecurringVoucherSchedule,
  RecurringVoucherLog,
  getRecurringVoucherSchedules,
  saveRecurringVoucherSchedule,
  deleteRecurringVoucherSchedule,
  toggleRecurringScheduleStatus,
  executeRecurringVoucher,
  getRecurringVoucherLogs,
  processDueRecurringVouchers,
  renderNarrationTemplate
} from '../../services/recurringVoucherService';
import { SearchableLedgerSelect } from '../SearchableLedgerSelect';

interface RecurringVouchersModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  ledgers: Ledger[];
  onDataRefresh: () => void;
  onOpenVoucherDetail?: (voucherNo: string) => void;
}

export const RecurringVouchersModal: React.FC<RecurringVouchersModalProps> = ({
  isOpen,
  onClose,
  config,
  ledgers,
  onDataRefresh,
  onOpenVoucherDetail
}) => {
  const [activeTab, setActiveTab] = useState<'schedules' | 'form' | 'logs'>('schedules');
  const [schedules, setSchedules] = useState<RecurringVoucherSchedule[]>([]);
  const [logs, setLogs] = useState<RecurringVoucherLog[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<RecurringVoucherSchedule | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // Form states
  const [templateName, setTemplateName] = useState('');
  const [frequency, setFrequency] = useState<RecurringVoucherSchedule['frequency']>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState<number>(99); // 99 = Last day of month
  const [voucherType, setVoucherType] = useState<'P' | 'R' | 'J' | 'C'>('P');
  const [entryMode, setEntryMode] = useState<'single' | 'multi'>('single');
  const [debitLedger, setDebitLedger] = useState('');
  const [creditLedger, setCreditLedger] = useState('');
  const [amount, setAmount] = useState('');
  const [narrationTemplate, setNarrationTemplate] = useState('Monthly rent payment for {MONTH_NAME} {YEAR}');
  const [autoPostMode, setAutoPostMode] = useState<'automatic' | 'manual_review'>('automatic');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  // Multi-line lines
  const [multiLines, setMultiLines] = useState<Array<{ type: 'Dr' | 'Cr'; ledger: string; amount: number; narration?: string }>>([
    { type: 'Dr', ledger: '', amount: 0, narration: '' },
    { type: 'Cr', ledger: '', amount: 0, narration: '' }
  ]);

  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  const loadData = () => {
    setSchedules(getRecurringVoucherSchedules());
    setLogs(getRecurringVoucherLogs());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const pendingDueCount = useMemo(() => {
    return schedules.filter(s => s.status === 'active' && s.nextDueDate <= todayStr).length;
  }, [schedules, todayStr]);

  const resetForm = () => {
    setEditingSchedule(null);
    setTemplateName('');
    setFrequency('monthly');
    setDayOfMonth(99);
    setVoucherType('P');
    setEntryMode('single');
    setDebitLedger('');
    setCreditLedger('');
    setAmount('');
    setNarrationTemplate('Monthly rent payment for {MONTH_NAME} {YEAR}');
    setAutoPostMode('automatic');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setMultiLines([
      { type: 'Dr', ledger: '', amount: 0, narration: '' },
      { type: 'Cr', ledger: '', amount: 0, narration: '' }
    ]);
  };

  const handleEdit = (schedule: RecurringVoucherSchedule) => {
    setEditingSchedule(schedule);
    setTemplateName(schedule.templateName);
    setFrequency(schedule.frequency);
    setDayOfMonth(schedule.dayOfMonth ?? 99);
    setVoucherType(schedule.voucherType);
    setEntryMode(schedule.entryMode || 'single');
    setDebitLedger(schedule.debitLedger || '');
    setCreditLedger(schedule.creditLedger || '');
    setAmount(schedule.amount ? String(schedule.amount) : '');
    setNarrationTemplate(schedule.narrationTemplate || '');
    setAutoPostMode(schedule.autoPostMode || 'automatic');
    setStartDate(schedule.startDate || todayStr);
    setEndDate(schedule.endDate || '');
    if (schedule.lines && schedule.lines.length > 0) {
      setMultiLines(schedule.lines);
    } else {
      setMultiLines([
        { type: 'Dr', ledger: schedule.debitLedger || '', amount: schedule.amount || 0, narration: '' },
        { type: 'Cr', ledger: schedule.creditLedger || '', amount: schedule.amount || 0, narration: '' }
      ]);
    }
    setActiveTab('form');
  };

  const applyPreset = (preset: 'rent' | 'electricity' | 'salary' | 'emi' | 'depreciation' | 'internet') => {
    if (preset === 'rent') {
      setTemplateName('Monthly Office / Shop Rent');
      setVoucherType('P');
      setFrequency('monthly');
      setDayOfMonth(99); // End of month
      setNarrationTemplate('Monthly Office Rent for {MONTH_NAME} {YEAR}');
      setAutoPostMode('automatic');
      const rentLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('rent'))?.['Ledger Name'] || '';
      const bankLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('bank') || (l['Ledger Name'] || '').toLowerCase().includes('cash'))?.['Ledger Name'] || '';
      if (rentLedger) setDebitLedger(rentLedger);
      if (bankLedger) setCreditLedger(bankLedger);
    } else if (preset === 'electricity') {
      setTemplateName('Monthly Electricity & Power Bill');
      setVoucherType('P');
      setFrequency('monthly');
      setDayOfMonth(15);
      setNarrationTemplate('Electricity & Power charges for {MONTH_NAME} {YEAR}');
      setAutoPostMode('automatic');
      const elecLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('elec') || (l['Ledger Name'] || '').toLowerCase().includes('util'))?.['Ledger Name'] || '';
      const bankLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('bank') || (l['Ledger Name'] || '').toLowerCase().includes('cash'))?.['Ledger Name'] || '';
      if (elecLedger) setDebitLedger(elecLedger);
      if (bankLedger) setCreditLedger(bankLedger);
    } else if (preset === 'salary') {
      setTemplateName('Monthly Staff Salary & Retainer');
      setVoucherType('P');
      setFrequency('monthly');
      setDayOfMonth(99);
      setNarrationTemplate('Staff salary disbursement for {MONTH_NAME} {YEAR}');
      setAutoPostMode('manual_review');
      const salLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('sal') || (l['Ledger Name'] || '').toLowerCase().includes('wage'))?.['Ledger Name'] || '';
      const bankLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('bank'))?.['Ledger Name'] || '';
      if (salLedger) setDebitLedger(salLedger);
      if (bankLedger) setCreditLedger(bankLedger);
    } else if (preset === 'emi') {
      setTemplateName('Monthly Bank Loan EMI');
      setVoucherType('P');
      setFrequency('monthly');
      setDayOfMonth(5);
      setNarrationTemplate('Bank loan EMI installment for {MONTH_NAME} {YEAR}');
      setAutoPostMode('automatic');
      const loanLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('loan') || (l['Ledger Name'] || '').toLowerCase().includes('emi'))?.['Ledger Name'] || '';
      const bankLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('bank'))?.['Ledger Name'] || '';
      if (loanLedger) setDebitLedger(loanLedger);
      if (bankLedger) setCreditLedger(bankLedger);
    } else if (preset === 'depreciation') {
      setTemplateName('Monthly Asset Depreciation');
      setVoucherType('J');
      setFrequency('monthly');
      setDayOfMonth(99);
      setNarrationTemplate('Monthly depreciation charge on assets for {MONTH_NAME} {YEAR}');
      setAutoPostMode('automatic');
      const depLedger = ledgers.find(l => (l['Ledger Name'] || '').toLowerCase().includes('deprec'))?.['Ledger Name'] || '';
      if (depLedger) setDebitLedger(depLedger);
    } else if (preset === 'internet') {
      setTemplateName('Monthly Internet & Telecom Fee');
      setVoucherType('P');
      setFrequency('monthly');
      setDayOfMonth(1);
      setNarrationTemplate('Broadband & Telecom subscription for {MONTH_NAME} {YEAR}');
      setAutoPostMode('automatic');
    }
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      showToast('Please enter a schedule name.', 'error');
      return;
    }

    let parsedAmount = Number(amount) || 0;
    if (entryMode === 'single') {
      if (!debitLedger.trim() || !creditLedger.trim()) {
        showToast('Please select both Debit and Credit ledgers.', 'error');
        return;
      }
      if (debitLedger === creditLedger) {
        showToast('Debit and Credit ledgers cannot be identical.', 'error');
        return;
      }
      if (parsedAmount <= 0) {
        showToast('Please enter a valid positive amount.', 'error');
        return;
      }
    } else {
      const drTotal = multiLines.filter(l => l.type === 'Dr').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const crTotal = multiLines.filter(l => l.type === 'Cr').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      if (Math.abs(drTotal - crTotal) > 0.01) {
        showToast(`Debit total (Nu. ${drTotal.toFixed(2)}) must equal Credit total (Nu. ${crTotal.toFixed(2)}).`, 'error');
        return;
      }
      if (drTotal <= 0) {
        showToast('Total voucher amount must be greater than zero.', 'error');
        return;
      }
      parsedAmount = drTotal;
    }

    // Determine next due date
    let computedNextDue = startDate;
    if (frequency === 'monthly') {
      const d = new Date(startDate);
      if (dayOfMonth === 99) {
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        computedNextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        computedNextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dayOfMonth, maxDays)).padStart(2, '0')}`;
      }
    }

    const payload: RecurringVoucherSchedule = {
      id: editingSchedule ? editingSchedule.id : 'rc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      templateName: templateName.trim(),
      frequency,
      dayOfMonth,
      voucherType,
      entryMode,
      debitLedger: entryMode === 'single' ? debitLedger : undefined,
      creditLedger: entryMode === 'single' ? creditLedger : undefined,
      amount: parsedAmount,
      lines: entryMode === 'multi' ? multiLines : undefined,
      narrationTemplate: narrationTemplate.trim(),
      autoPostMode,
      startDate,
      endDate: endDate.trim() || undefined,
      nextDueDate: editingSchedule ? editingSchedule.nextDueDate : computedNextDue,
      lastPostedDate: editingSchedule ? editingSchedule.lastPostedDate : undefined,
      lastPostedVoucherNo: editingSchedule ? editingSchedule.lastPostedVoucherNo : undefined,
      status: editingSchedule ? editingSchedule.status : 'active',
      createdAt: editingSchedule ? editingSchedule.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const res = saveRecurringVoucherSchedule(payload);
    if (res.ok) {
      showToast(editingSchedule ? 'Schedule updated successfully!' : 'New recurring schedule created!', 'success');
      resetForm();
      loadData();
      setActiveTab('schedules');
    } else {
      showToast(res.error || 'Failed to save schedule.', 'error');
    }
  };

  const handleExecuteNow = (schedule: RecurringVoucherSchedule) => {
    const res = executeRecurringVoucher(schedule.id);
    if (res.ok && res.voucherNo) {
      showToast(`Voucher ${res.voucherNo} posted successfully!`, 'success');
      loadData();
      onDataRefresh();
    } else {
      showToast(res.error || 'Failed to execute voucher.', 'error');
    }
  };

  const handleProcessAllDue = () => {
    setIsProcessingAll(true);
    setTimeout(() => {
      const res = processDueRecurringVouchers();
      setIsProcessingAll(false);
      if (res.postedCount > 0) {
        showToast(`Successfully posted ${res.postedCount} due recurring voucher(s)!`, 'success');
      } else {
        showToast('No due auto-vouchers found to post.', 'success');
      }
      loadData();
      onDataRefresh();
    }, 400);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the recurring schedule "${name}"?`)) {
      const res = deleteRecurringVoucherSchedule(id);
      if (res.ok) {
        showToast('Schedule deleted.', 'success');
        loadData();
      }
    }
  };

  const handleToggle = (id: string) => {
    const res = toggleRecurringScheduleStatus(id);
    if (res.ok) {
      showToast(`Schedule ${res.status === 'active' ? 'resumed' : 'paused'}.`, 'success');
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Repeat className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">Auto & Recurring Vouchers</h2>
                <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-[10px] font-extrabold uppercase rounded-full tracking-wider">
                  Automated Books
                </span>
              </div>
              <p className="text-xs text-indigo-200/80">
                Automate repetitive transactions (Rent, Salaries, EMIs, Retainers, Utilities) with precision.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 transition ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Sub-Nav Bar */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab('schedules');
                resetForm();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'schedules'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Schedules ({schedules.length})</span>
              {pendingDueCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-900 text-[10px] font-black rounded-full animate-pulse">
                  {pendingDueCount} Due
                </span>
              )}
            </button>

            <button
              onClick={() => {
                resetForm();
                setActiveTab('form');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{editingSchedule ? 'Edit Schedule' : 'New Recurring Schedule'}</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>History & Logs ({logs.length})</span>
            </button>
          </div>

          {pendingDueCount > 0 && activeTab === 'schedules' && (
            <button
              onClick={handleProcessAllDue}
              disabled={isProcessingAll}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{isProcessingAll ? 'Posting...' : `Post All Due Vouchers (${pendingDueCount})`}</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
          {/* TAB 1: SCHEDULES LIST */}
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
                  <Repeat className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No Recurring Schedules Configured</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                    Create your first automated recurring voucher to automatically post monthly rent, utility bills, employee retainers, or EMI entries.
                  </p>
                  <button
                    onClick={() => {
                      resetForm();
                      setActiveTab('form');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Recurring Schedule</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schedules.map(sch => {
                    const isDue = sch.status === 'active' && sch.nextDueDate <= todayStr;
                    return (
                      <div
                        key={sch.id}
                        className={`bg-white rounded-2xl border p-4 shadow-2xs transition hover:shadow-md flex flex-col justify-between ${
                          isDue
                            ? 'border-amber-400 ring-2 ring-amber-200/60 bg-amber-50/20'
                            : sch.status === 'paused'
                            ? 'border-slate-200 opacity-70 bg-slate-50/50'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-slate-900">{sch.templateName}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    sch.status === 'active'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : sch.status === 'paused'
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {sch.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium flex-wrap">
                                <span className="font-bold text-indigo-700 uppercase">{sch.voucherType} Voucher</span>
                                <span>•</span>
                                <span className="capitalize">{sch.frequency}</span>
                                <span>•</span>
                                <span>
                                  {sch.dayOfMonth === 99
                                    ? 'End of Month'
                                    : `Day ${sch.dayOfMonth} of month`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold text-slate-500 block">Amount</span>
                              <span className="text-base font-black text-indigo-950 font-mono">
                                {currencySymbol} {Number(sch.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Ledgers Breakdown */}
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                            {sch.entryMode === 'single' ? (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-slate-500 font-semibold">Debit (By):</span>
                                  <span className="font-bold text-blue-800 truncate max-w-[200px]">{sch.debitLedger}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500 font-semibold">Credit (To):</span>
                                  <span className="font-bold text-emerald-800 truncate max-w-[200px]">{sch.creditLedger}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">Lines:</span>
                                <span className="font-bold text-indigo-800">{sch.lines?.length || 0} Ledger Entries</span>
                              </div>
                            )}
                          </div>

                          {/* Narration Preview */}
                          <div className="text-[11px] text-slate-600 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 italic">
                            <span className="font-bold not-italic text-indigo-900">Narration: </span>
                            "{renderNarrationTemplate(sch.narrationTemplate, sch.nextDueDate || todayStr)}"
                          </div>

                          {/* Due Date & Last Run */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
                            <div>
                              <span>Next Due: </span>
                              <strong className={isDue ? 'text-amber-700 font-black' : 'text-slate-800'}>
                                {sch.nextDueDate}
                              </strong>
                              {isDue && <span className="ml-1 text-[10px] text-amber-600 font-black">(Ready to Post)</span>}
                            </div>
                            <div>
                              <span>Last Run: </span>
                              <strong className="text-slate-700">{sch.lastPostedVoucherNo || sch.lastPostedDate || 'Never'}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggle(sch.id)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title={sch.status === 'active' ? 'Pause Schedule' : 'Resume Schedule'}
                            >
                              {sch.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleEdit(sch)}
                              className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit Schedule"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(sch.id, sch.templateName)}
                              className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Schedule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleExecuteNow(sch)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition"
                            title="Generate and post voucher right now"
                          >
                            <Zap className="h-3.5 w-3.5 fill-current" />
                            <span>Post Voucher Now</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE / EDIT FORM */}
          {activeTab === 'form' && (
            <form onSubmit={handleSaveForm} className="space-y-6">
              {/* Presets Quick Picker */}
              {!editingSchedule && (
                <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 rounded-2xl border border-indigo-100 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>Quick Preset Templates (1-Click Fill)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('rent')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <Building className="h-4 w-4 text-indigo-600" />
                      <span className="text-[11px] font-bold text-slate-800">Office Rent</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('electricity')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      <span className="text-[11px] font-bold text-slate-800">Electricity</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('salary')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span className="text-[11px] font-bold text-slate-800">Salary / Wages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('emi')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <span className="text-[11px] font-bold text-slate-800">Loan EMI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('depreciation')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <Layers className="h-4 w-4 text-purple-600" />
                      <span className="text-[11px] font-bold text-slate-800">Depreciation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('internet')}
                      className="p-2.5 bg-white hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-300 rounded-xl text-left transition cursor-pointer flex flex-col items-center text-center gap-1"
                    >
                      <Zap className="h-4 w-4 text-cyan-600" />
                      <span className="text-[11px] font-bold text-slate-800">Internet Fee</span>
                    </button>
                  </div>
                </div>
              )}

              {/* General Schedule Settings */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  <span>1. Schedule Configuration</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Schedule / Template Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Monthly Shop #2 Rent"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                    <select
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>

                  {frequency === 'monthly' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Day of Month</label>
                      <select
                        value={dayOfMonth}
                        onChange={e => setDayOfMonth(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value={99}>End of the Month (Last Day)</option>
                        <option value={1}>1st of each month</option>
                        <option value={5}>5th of each month</option>
                        <option value={10}>10th of each month</option>
                        <option value={15}>15th of each month</option>
                        <option value={20}>20th of each month</option>
                        <option value={25}>25th of each month</option>
                        <option value={28}>28th of each month</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Execution Mode</label>
                    <select
                      value={autoPostMode}
                      onChange={e => setAutoPostMode(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="automatic">⚡ Automatic (Auto-Post directly to books when due)</option>
                      <option value="manual_review">🔔 Reminder Mode (Prompt user to review before posting)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">End Date (Optional)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Leave blank for indefinitely"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Transaction Configuration */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  <span>2. Financial Voucher & Ledgers</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Voucher Type</label>
                    <select
                      value={voucherType}
                      onChange={e => setVoucherType(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="P">Payment Voucher (PV)</option>
                      <option value="R">Receipt Voucher (RV)</option>
                      <option value="J">Journal Voucher (JV)</option>
                      <option value="C">Contra Voucher (CV)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total Amount ({currencySymbol})</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required={entryMode === 'single'}
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-700 mb-1">
                      Debit Ledger (By / Expense / Asset) <span className="text-rose-500">*</span>
                    </label>
                    <SearchableLedgerSelect
                      ledgers={ledgers}
                      value={debitLedger}
                      onChange={val => setDebitLedger(val)}
                      placeholder="Select Debit Ledger..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-700 mb-1">
                      Credit Ledger (To / Bank / Cash / Source) <span className="text-rose-500">*</span>
                    </label>
                    <SearchableLedgerSelect
                      ledgers={ledgers}
                      value={creditLedger}
                      onChange={val => setCreditLedger(val)}
                      placeholder="Select Credit Ledger..."
                    />
                  </div>
                </div>

                {/* Dynamic Narration Template */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Dynamic Narration Template</label>
                    <span className="text-[10px] text-slate-500">Supports: {'{MONTH_NAME}'}, {'{YEAR}'}, {'{DATE}'}, {'{QUARTER}'}</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={narrationTemplate}
                    onChange={e => setNarrationTemplate(e.target.value)}
                    placeholder="e.g. Monthly rent for {MONTH_NAME} {YEAR}"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-[11px] text-indigo-700 font-medium mt-1">
                    Preview: <span className="font-semibold italic">"{renderNarrationTemplate(narrationTemplate, todayStr)}"</span>
                  </p>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('schedules');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer transition flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{editingSchedule ? 'Update Schedule' : 'Save Recurring Schedule'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: EXECUTION LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
                  <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No automated execution logs recorded yet.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3">Executed At</th>
                        <th className="p-3">Schedule Name</th>
                        <th className="p-3">Voucher No</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-right">Amount ({currencySymbol})</th>
                        <th className="p-3">Narration</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 font-mono text-[11px] text-slate-500">
                            {new Date(log.postedAt).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-slate-900">{log.scheduleName}</td>
                          <td className="p-3 font-mono font-bold text-indigo-700">
                            {log.voucherNo !== '-' && onOpenVoucherDetail ? (
                              <button
                                onClick={() => onOpenVoucherDetail(log.voucherNo)}
                                className="hover:underline text-indigo-600 font-bold cursor-pointer"
                              >
                                {log.voucherNo}
                              </button>
                            ) : (
                              log.voucherNo
                            )}
                          </td>
                          <td className="p-3 font-bold text-slate-600">{log.voucherType}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {Number(log.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate italic">{log.narration}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                log.status === 'success'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
