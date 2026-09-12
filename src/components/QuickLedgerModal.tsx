import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Ledger, Config, LedgerGroup } from '../types';
import { X, Plus, Save, Building2, FolderPlus } from 'lucide-react';
import { handleFormKeyDown, focusFirstFormInput } from '../utils/formKeyNavigation';
import { loadJson, STORAGE_KEYS, saveLedger, saveLedgerGroup } from '../services/storageService';

interface QuickLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ledger: Ledger) => void;
  initialGroup?: string;
  config: Config;
  ledgerToEdit?: Ledger | null;
}

const STANDARD_GROUPS = [
  'Cash-in-Hand',
  'Bank Accounts',
  'Sundry Debtors',
  'Sundry Creditors',
  'Direct Expenses',
  'Indirect Expenses',
  'Sales Account',
  'Purchase Account',
  'Duties & Taxes',
  'Current Assets',
  'Current Liabilities',
  'Capital Account',
  'Fixed Assets',
  'Investments',
  'Loans (Liability)',
  'Stock-in-Hand'
];

export const QuickLedgerModal: React.FC<QuickLedgerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialGroup = 'Sundry Debtors',
  config,
  ledgerToEdit
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const [groupsRefreshCount, setGroupsRefreshCount] = useState<number>(0);
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupParent, setNewGroupParent] = useState<string>('Current Assets');
  const [newGroupNature, setNewGroupNature] = useState<'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital'>('Asset');

  const availableGroups = useMemo(() => {
    const custom = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, [])
      .map(g => g['Group Name'])
      .filter(Boolean);
    const set = new Set([...STANDARD_GROUPS, ...custom]);
    if (initialGroup && !set.has(initialGroup)) {
      set.add(initialGroup);
    }
    if (ledgerToEdit?.Group && !set.has(ledgerToEdit.Group)) {
      set.add(ledgerToEdit.Group);
    }
    return Array.from(set);
  }, [initialGroup, ledgerToEdit, isOpen, groupsRefreshCount]);

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

  const isBankGroup = useMemo(() => {
    const grpName = (ledgerForm.Group || '').toLowerCase();
    if (grpName.includes('bank')) return true;
    const allGroups = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, []);
    let c: string | undefined = ledgerForm.Group;
    while (c) {
      const g = allGroups.find(x => x['Group Name'] === c);
      if (g && (g['Group Name'] || '').toLowerCase().includes('bank')) return true;
      if (g && g['Parent Group']) {
        if (g['Parent Group'].toLowerCase().includes('bank')) return true;
        c = g['Parent Group'];
      } else break;
    }
    return false;
  }, [ledgerForm.Group, groupsRefreshCount]);

  useEffect(() => {
    if (isOpen) {
      focusFirstFormInput(modalRef.current);
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
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, ledgerForm]);

  if (!isOpen) return null;

  const showGst = String(config.EnableGST) !== 'false';
  const isParty = (ledgerForm.Group || '').toLowerCase().includes('debtor') || 
                  (ledgerForm.Group || '').toLowerCase().includes('customer') || 
                  (ledgerForm.Group || '').toLowerCase().includes('creditor') || 
                  (ledgerForm.Group || '').toLowerCase().includes('supplier');

  const handleSave = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmedName = (ledgerForm['Ledger Name'] || '').trim();
    if (!trimmedName) {
      alert('Ledger Name is required.');
      return;
    }

    const group = ledgerForm.Group || initialGroup || 'Sundry Debtors';

    const toSave: Ledger = {
      ...(ledgerForm as Ledger),
      'Ledger Name': trimmedName,
      Group: group,
      'Opening Balance': Number(ledgerForm['Opening Balance']) || 0,
      'GST Type': isParty ? (ledgerForm['GST Type'] || 'Regular') : undefined,
      'GST Exempted': isParty && ledgerForm['GST Type'] === 'Exempted' ? 'Y' : 'N'
    };

    const res = saveLedger(toSave);
    if (!res.ok) {
      alert(res.error || `Duplicate Ledger Name: A ledger named "${trimmedName}" already exists.`);
      return;
    }

    toSave.oldName = trimmedName;
    onSave(toSave);
  };

  return (
    <div 
      ref={modalRef}
      onKeyDown={(e) => handleFormKeyDown(e, modalRef.current, () => handleSave(), onClose)}
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
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
              value={ledgerForm['Ledger Name'] || ''}
              onChange={e => setLedgerForm({ ...ledgerForm, 'Ledger Name': e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Bhutan Supplies"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Account Group *</label>
            <div className="flex gap-2">
              <select
                value={ledgerForm.Group || ''}
                onChange={e => setLedgerForm({ ...ledgerForm, Group: e.target.value })}
                className="flex-1 min-w-0 h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
              >
                {availableGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNewGroupParent(ledgerForm.Group || 'Current Assets');
                  setShowGroupModal(true);
                }}
                className="px-3 h-10 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                title="Create New Sub-Group"
              >
                <FolderPlus className="h-4 w-4 text-indigo-600" />
                <span>+ Sub-Group</span>
              </button>
            </div>
          </div>

          {isBankGroup && (
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
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="quick-ledger-submit-btn"
              type="submit"
              onClick={handleSave}
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              Save Ledger
            </button>
          </div>
        </form>
      </div>

      {showGroupModal && (
        <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                Quick Create Sub-Group / Group
              </h4>
              <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sub-Group / Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Bank Accounts, Mobile Vendors, Operating Expenses"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Group (e.g. Current Assets)</label>
                <select
                  value={newGroupParent}
                  onChange={e => {
                    const pVal = e.target.value;
                    setNewGroupParent(pVal);
                    const custom = loadJson<LedgerGroup[]>(STORAGE_KEYS.LEDGER_GROUPS, []);
                    const parentObj = custom.find(g => g['Group Name'] === pVal);
                    if (parentObj?.Nature) {
                      setNewGroupNature(parentObj.Nature);
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none focus:border-indigo-500"
                >
                  <option value="">-- None / Primary Group --</option>
                  {availableGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nature *</label>
                <select
                  value={newGroupNature}
                  onChange={e => setNewGroupNature(e.target.value as any)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none focus:border-indigo-500"
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Capital">Capital</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const gName = newGroupName.trim();
                  if (!gName) {
                    alert('Sub-Group Name is required.');
                    return;
                  }
                  const res = saveLedgerGroup({
                    'Group Name': gName,
                    'Parent Group': newGroupParent.trim(),
                    Nature: newGroupNature
                  });
                  if (!res.ok) {
                    alert(res.error || 'Failed to save sub-group.');
                    return;
                  }
                  setLedgerForm(prev => ({ ...prev, Group: gName }));
                  setNewGroupName('');
                  setShowGroupModal(false);
                  setGroupsRefreshCount(c => c + 1);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Save Sub-Group</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
