import React, { useState, useEffect } from 'react';
import { Ledger, Config } from '../types';
import { X, Plus, Save, Building2 } from 'lucide-react';

interface QuickLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ledger: Ledger) => void;
  initialGroup?: string;
  config: Config;
  ledgerToEdit?: Ledger | null;
}

export const QuickLedgerModal: React.FC<QuickLedgerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialGroup = 'Sundry Debtors',
  config,
  ledgerToEdit
}) => {
  const [ledgerForm, setLedgerForm] = useState<Partial<Ledger>>({
    'Ledger Name': '',
    Group: initialGroup,
    'GST Type': 'Regular',
    'GST Exempted': 'N',
    'GST No': '',
    'TPN No': '',
    Address: '',
    'Contact No': '',
    'Opening Balance': 0,
    'Balance Type (Dr/Cr)': 'Dr'
  });

  useEffect(() => {
    if (isOpen) {
      if (ledgerToEdit) {
        setLedgerForm({ ...ledgerToEdit });
      } else {
        setLedgerForm({
          'Ledger Name': '',
          Group: initialGroup || 'Sundry Debtors',
          'GST Type': 'Regular',
          'GST Exempted': 'N',
          'GST No': '',
          'TPN No': '',
          Address: '',
          'Contact No': '',
          'Opening Balance': '' as any,
          'Balance Type (Dr/Cr)': 'Dr'
        });
      }
    }
  }, [isOpen, initialGroup, ledgerToEdit]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        const saveBtn = document.getElementById('quick-ledger-submit-btn');
        saveBtn?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleAppBack = (e: Event) => {
      onClose();
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:back', handleAppBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:back', handleAppBack);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showGst = String(config.EnableGST) !== 'false';
  const isParty = (ledgerForm.Group || '').toLowerCase().includes('debtor') || 
                  (ledgerForm.Group || '').toLowerCase().includes('customer') || 
                  (ledgerForm.Group || '').toLowerCase().includes('creditor') || 
                  (ledgerForm.Group || '').toLowerCase().includes('supplier');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerForm['Ledger Name']?.trim()) {
      alert('Ledger Name is required.');
      return;
    }

    const toSave: Ledger = {
      ...(ledgerForm as Ledger),
      'GST Type': isParty ? (ledgerForm['GST Type'] || 'Regular') : undefined,
      'GST Exempted': isParty && ledgerForm['GST Type'] === 'Exempted' ? 'Y' : 'N'
    };
    onSave(toSave);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">
            {ledgerToEdit ? `Alter Ledger Master (${ledgerToEdit['Ledger Name']})` : 'Quick Create Ledger'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ledger Name *</label>
            <input
              type="text"
              autoFocus
              required
              value={ledgerForm['Ledger Name'] || ''}
              onChange={e => setLedgerForm({ ...ledgerForm, 'Ledger Name': e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Account Group *</label>
            <select
              required
              value={ledgerForm.Group || ''}
              onChange={e => setLedgerForm({ ...ledgerForm, Group: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
            >
              <option value="Cash-in-Hand">Cash-in-Hand</option>
              <option value="Bank Accounts">Bank Accounts</option>
              <option value="Sundry Debtors">Sundry Debtors (Customers)</option>
              <option value="Sundry Creditors">Sundry Creditors (Suppliers)</option>
              <option value="Direct Expenses">Direct Expenses</option>
              <option value="Indirect Expenses">Indirect Expenses</option>
              <option value="Sales Account">Sales Account</option>
              <option value="Purchase Account">Purchase Account</option>
              <option value="Duties & Taxes">Duties & Taxes</option>
              <option value="Current Assets">Current Assets</option>
              <option value="Current Liabilities">Current Liabilities</option>
              <option value="Capital Account">Capital Account</option>
            </select>
          </div>

          {((ledgerForm.Group || '').toLowerCase().includes('bank')) && (
            <div className="space-y-3 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 font-bold text-blue-900 border-b border-blue-200/60 pb-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>Bank Account Details (Prints on Invoice)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={ledgerForm['Bank Name'] || ''}
                    onChange={e => setLedgerForm({ ...ledgerForm, 'Bank Name': e.target.value })}
                    placeholder="e.g. Bank of Bhutan"
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium bg-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={ledgerForm['Account No'] || ''}
                    onChange={e => setLedgerForm({ ...ledgerForm, 'Account No': e.target.value })}
                    placeholder="e.g. 1029384756"
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono bg-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Name / Location</label>
                <input
                  type="text"
                  value={ledgerForm.Branch || ''}
                  onChange={e => setLedgerForm({ ...ledgerForm, Branch: e.target.value })}
                  placeholder="e.g. Thimphu Main Branch"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium bg-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {showGst && isParty && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  GST Registration <span className="text-indigo-600">(Party)</span>
                </label>
                <select
                  value={ledgerForm['GST Type'] || 'Regular'}
                  onChange={e => {
                    const val = e.target.value;
                    setLedgerForm({
                      ...ledgerForm,
                      'GST Type': val as any,
                      'GST Exempted': val === 'Exempted' ? 'Y' : 'N'
                    });
                  }}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
                >
                  <option value="Regular">Regular Taxpayer</option>
                  <option value="Exempted">GST Not Applicable</option>
                </select>
              </div>
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={ledgerForm['GST No'] || ''}
                  onChange={e => setLedgerForm({ ...ledgerForm, 'GST No': e.target.value })}
                  placeholder="e.g. 30BB..."
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 font-mono outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          )}

          {isParty && (
            <div className="space-y-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Address <span className="text-xs text-indigo-600 font-semibold">(Prints on Bill / Invoices)</span>
                </label>
                <textarea
                  rows={2}
                  value={ledgerForm.Address || ''}
                  onChange={e => setLedgerForm({ ...ledgerForm, Address: e.target.value })}
                  placeholder="Street Address, City, Location details..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact No / Phone</label>
                  <input
                    type="text"
                    value={ledgerForm['Contact No'] || ''}
                    onChange={e => setLedgerForm({ ...ledgerForm, 'Contact No': e.target.value })}
                    placeholder="e.g. 17112233"
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">TPN No</label>
                  <input
                    type="text"
                    value={ledgerForm['TPN No'] || ''}
                    onChange={e => setLedgerForm({ ...ledgerForm, 'TPN No': e.target.value })}
                    placeholder="Tax Payer No"
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs font-mono outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Opening Balance</label>
              <input
                type="number"
                step="any"
                value={ledgerForm['Opening Balance'] ?? ''}
                onChange={e => setLedgerForm({ ...ledgerForm, 'Opening Balance': e.target.value === '' ? '' as any : parseFloat(e.target.value) })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dr/Cr</label>
              <select
                value={ledgerForm['Balance Type (Dr/Cr)'] || 'Dr'}
                onChange={e => setLedgerForm({ ...ledgerForm, 'Balance Type (Dr/Cr)': e.target.value as 'Dr' | 'Cr' })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
              >
                <option value="Dr">Debit (Dr)</option>
                <option value="Cr">Credit (Cr)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              id="quick-ledger-submit-btn"
              type="submit"
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
