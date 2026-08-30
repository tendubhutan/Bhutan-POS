import React, { useState } from 'react';
import { Config, Ledger, Employee, AdvanceType, EmployeeAdvance } from '../../types';
import { getEmployeeAdvances, saveEmployeeAdvances, nextCounter, getVoucherPrefix, saveMultiLineVoucher } from '../../services/storageService';
import { Search, Plus, CheckCircle, WalletCards, ArrowRightLeft, CreditCard } from 'lucide-react';

interface EmployeeAdvancesProps {
  config: Config;
  ledgers: Ledger[];
  employees: Employee[];
}

export const EmployeeAdvances: React.FC<EmployeeAdvancesProps> = ({ config, ledgers, employees }) => {
  const [advances, setAdvances] = useState<EmployeeAdvance[]>(getEmployeeAdvances());
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<EmployeeAdvance | null>(null);
  
  // Issue Form State
  const [issueForm, setIssueForm] = useState({
    employeeId: '',
    type: 'Local DSA' as AdvanceType,
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    bankLedger: '',
    narration: ''
  });
  
  // Settle Form State
  const [settleForm, setSettleForm] = useState({
    actualExpense: 0,
    settleDate: new Date().toISOString().split('T')[0],
    bankLedger: '',
    expenseLedger: '',
    reimburseImmediate: true,
    narration: ''
  });

  const getControlAccount = (type: AdvanceType) => {
    if (type.includes('DSA')) return 'DSA & Tour Advances (Control)';
    if (type === 'Imprest') return 'Imprest Advances (Control)';
    if (type === 'Salary Advance') return 'Salary Advances (Control)';
    if (type === 'Welfare Loan') return 'Staff Welfare Loans (Control)';
    return 'Advances to Employees (Control)';
  };

  const handleIssueAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === issueForm.employeeId);
    if (!emp) return alert("Select an employee");
    if (issueForm.amount <= 0) return alert("Enter valid amount");
    if (!issueForm.bankLedger) return alert("Select Bank/Cash ledger");

    const controlAcc = getControlAccount(issueForm.type);
    const px = getVoucherPrefix('P', config);
    const voucherNo = px + nextCounter('Voucher');

    const lines: any[] = [
      { type: 'Dr', ledger: controlAcc, amount: issueForm.amount, narration: `${issueForm.type} - ${emp.fullName} (${emp.cidNo}) - ${issueForm.narration}` },
      { type: 'Cr', ledger: issueForm.bankLedger, amount: issueForm.amount, narration: issueForm.narration }
    ];

    saveMultiLineVoucher({
      type: 'P',
      voucherNo,
      date: issueForm.date,
      narration: `Issued ${issueForm.type} to ${emp.fullName}`,
      lines
    });

    const newAdv: EmployeeAdvance = {
      id: crypto.randomUUID(),
      advanceNo: `ADV-${Math.floor(Math.random()*10000)}`,
      employeeId: issueForm.employeeId,
      type: issueForm.type,
      amount: issueForm.amount,
      date: issueForm.date,
      narration: issueForm.narration,
      status: 'Open',
      settledAmount: 0,
      issueVoucherId: voucherNo
    };

    const updated = [...advances, newAdv];
    saveEmployeeAdvances(updated);
    setAdvances(updated);
    setShowIssueModal(false);
    
    // Ensure control accounts exist in ledgers (this should be handled by Masters, but good to know)
    alert(`Advance Issued Successfully!\nVoucher No: ${voucherNo}\nAmount: ${config.CurrencySymbol} ${issueForm.amount.toFixed(2)}`);
  };

  const handleSettleAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvance) return;
    const emp = employees.find(e => e.id === selectedAdvance.employeeId);
    if (!emp) return;

    if (!settleForm.expenseLedger) return alert("Select Expense Ledger");

    const controlAcc = getControlAccount(selectedAdvance.type);
    const difference = settleForm.actualExpense - selectedAdvance.amount;
    
    let voucherType: 'J' | 'P' | 'R' = 'J';
    const lines: any[] = [];
    
    // Always Dr the Expense for the actual amount
    lines.push({ type: 'Dr', ledger: settleForm.expenseLedger, amount: settleForm.actualExpense, narration: `Settlement of ${selectedAdvance.type} - ${emp.fullName}` });
    
    // Always Cr the Control Account for the original advance amount to clear it
    lines.push({ type: 'Cr', ledger: controlAcc, amount: selectedAdvance.amount, narration: `Clearing ${selectedAdvance.type} for ${emp.fullName}` });

    if (difference > 0) {
      // Expense > Advance (Company owes employee)
      if (settleForm.reimburseImmediate && settleForm.bankLedger) {
        // Reimburse immediately
        voucherType = 'P';
        lines.push({ type: 'Cr', ledger: settleForm.bankLedger, amount: difference, narration: `Reimbursement for extra expenses` });
      } else {
        // Book to payable
        voucherType = 'J';
        lines.push({ type: 'Cr', ledger: 'Salary / Reimbursements Payable', amount: difference, narration: `To be paid with Salary` });
      }
    } else if (difference < 0) {
      // Expense < Advance (Employee owes company)
      if (settleForm.reimburseImmediate && settleForm.bankLedger) {
        // Employee returns cash immediately
        voucherType = 'R';
        lines.push({ type: 'Dr', ledger: settleForm.bankLedger, amount: Math.abs(difference), narration: `Refund of unused advance` });
      } else {
        // Recover from salary
        voucherType = 'J';
        lines.push({ type: 'Dr', ledger: 'Advances Recoverable (Salary)', amount: Math.abs(difference), narration: `To be recovered from Salary` });
      }
    }

    const px = getVoucherPrefix(voucherType, config);
    const voucherNo = px + nextCounter('Voucher');

    saveMultiLineVoucher({
      type: voucherType,
      voucherNo,
      date: settleForm.settleDate,
      narration: settleForm.narration || `Settlement of ${selectedAdvance.type} for ${emp.fullName}`,
      lines
    });

    const updated = advances.map(a => {
      if (a.id === selectedAdvance.id) {
        return { ...a, status: 'Settled', settledAmount: settleForm.actualExpense, settledDate: settleForm.settleDate, settlementVoucherId: voucherNo } as EmployeeAdvance;
      }
      return a;
    });

    saveEmployeeAdvances(updated);
    setAdvances(updated);
    setShowSettleModal(false);
    alert(`Settlement Processed!\nVoucher No: ${voucherNo}`);
  };

  const filtered = advances.filter(a => {
    const emp = employees.find(e => e.id === a.employeeId);
    if (!emp) return false;
    return emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           emp.cidNo.includes(searchTerm) || 
           a.advanceNo.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, CID, or advance no..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 h-10 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 h-10 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" /> Issue Advance
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-3">Ref No & Date</th>
                <th className="p-3">Employee Details</th>
                <th className="p-3">Advance Type</th>
                <th className="p-3">Narration</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(adv => {
                const emp = employees.find(e => e.id === adv.employeeId);
                return (
                  <tr key={adv.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-mono font-bold text-slate-700">{adv.advanceNo}</div>
                      <div className="text-xs text-slate-500">{new Date(adv.date).toLocaleDateString()}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{emp?.fullName}</div>
                      <div className="text-[10px] text-slate-500">CID: {emp?.cidNo} • {emp?.designation}</div>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{adv.type}</td>
                    <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate" title={adv.narration}>{adv.narration}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-800">
                      {config.CurrencySymbol} {adv.amount.toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${adv.status === 'Settled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {adv.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {adv.status === 'Open' && (
                        <button
                          onClick={() => { setSelectedAdvance(adv); setShowSettleModal(true); setSettleForm({...settleForm, actualExpense: adv.amount}); }}
                          className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                        >
                          Settle
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No advances found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showIssueModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-indigo-600" />
                Issue Employee Advance / Loan
              </h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-rose-600">&times;</button>
            </div>
            <form onSubmit={handleIssueAdvance} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Employee *</label>
                <select required value={issueForm.employeeId} onChange={e => setIssueForm({...issueForm, employeeId: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} - {emp.designation} (CID: {emp.cidNo})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Advance Type *</label>
                  <select value={issueForm.type} onChange={e => setIssueForm({...issueForm, type: e.target.value as AdvanceType})} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-semibold">
                    <option value="Local DSA">Local DSA</option>
                    <option value="Foreign DSA">Foreign DSA</option>
                    <option value="Imprest">Imprest Advance</option>
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Welfare Loan">Staff Welfare Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Issue Date</label>
                  <input type="date" required value={issueForm.date} onChange={e => setIssueForm({...issueForm, date: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount ({config.CurrencySymbol}) *</label>
                  <input type="number" required min="1" step="0.01" value={issueForm.amount || ''} onChange={e => setIssueForm({...issueForm, amount: Number(e.target.value)})} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold text-indigo-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Paying Bank/Cash Ledger *</label>
                  <select required value={issueForm.bankLedger} onChange={e => setIssueForm({...issueForm, bankLedger: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">-- Select --</option>
                    {ledgers.map(l => <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Purpose *</label>
                <textarea required rows={2} placeholder="e.g. DSA for audit tour to Trashigang..." value={issueForm.narration} onChange={e => setIssueForm({...issueForm, narration: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none"></textarea>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-indigo-600 text-white p-2.5 rounded-xl font-bold hover:bg-indigo-700">Issue Advance & Post Voucher</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettleModal && selectedAdvance && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
             <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Settle Advance: {selectedAdvance.advanceNo}
              </h3>
              <button onClick={() => setShowSettleModal(false)} className="text-slate-400 hover:text-rose-600">&times;</button>
            </div>
            <form onSubmit={handleSettleAdvance} className="p-5 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex justify-between items-center text-sm">
                <span className="font-semibold text-indigo-900">Original Advance Given:</span>
                <span className="font-bold text-indigo-700">{config.CurrencySymbol} {selectedAdvance.amount.toFixed(2)}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Actual Expense / Bills ({config.CurrencySymbol}) *</label>
                  <input type="number" required min="0" step="0.01" value={settleForm.actualExpense} onChange={e => setSettleForm({...settleForm, actualExpense: Number(e.target.value)})} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Date</label>
                  <input type="date" required value={settleForm.settleDate} onChange={e => setSettleForm({...settleForm, settleDate: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Ledger (to charge bills to) *</label>
                <select required value={settleForm.expenseLedger} onChange={e => setSettleForm({...settleForm, expenseLedger: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">-- Select Expense Ledger --</option>
                  {ledgers.map(l => <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Narration / Settlement Remarks</label>
                <textarea rows={2} value={settleForm.narration} onChange={e => setSettleForm({...settleForm, narration: e.target.value})} placeholder="Remarks..." className="w-full p-2 border border-slate-300 rounded-lg text-sm resize-none"></textarea>
              </div>
              {/* Difference logic */}
              {settleForm.actualExpense !== selectedAdvance.amount && (
                <div className={`p-3 rounded-lg border text-sm ${settleForm.actualExpense > selectedAdvance.amount ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className="font-bold mb-2">
                    {settleForm.actualExpense > selectedAdvance.amount 
                      ? `Employee spent ${config.CurrencySymbol} ${(settleForm.actualExpense - selectedAdvance.amount).toFixed(2)} EXTRA.` 
                      : `Employee has ${config.CurrencySymbol} ${(selectedAdvance.amount - settleForm.actualExpense).toFixed(2)} UNUSED advance.`}
                  </p>
                  
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={settleForm.reimburseImmediate} onChange={e => setSettleForm({...settleForm, reimburseImmediate: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                    <span className="font-semibold text-slate-700">
                      {settleForm.actualExpense > selectedAdvance.amount ? 'Reimburse immediately' : 'Receive cash back immediately'}
                    </span>
                  </label>
                  
                  {settleForm.reimburseImmediate && (
                    <select required value={settleForm.bankLedger} onChange={e => setSettleForm({...settleForm, bankLedger: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm mt-1">
                      <option value="">-- Select Bank/Cash Ledger --</option>
                      {ledgers.map(l => <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>)}
                    </select>
                  )}
                  {!settleForm.reimburseImmediate && (
                    <p className="text-xs mt-1 text-slate-600">
                      {settleForm.actualExpense > selectedAdvance.amount 
                        ? 'Will automatically book to Salary/Reimbursements Payable.' 
                        : 'Will automatically book to Advances Recoverable to deduct from Salary.'}
                    </p>
                  )}
                </div>
              )}
              
              <div className="pt-2">
                <button type="submit" className="w-full bg-emerald-600 text-white p-2.5 rounded-xl font-bold hover:bg-emerald-700">Confirm Settlement & Post Vouchers</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
