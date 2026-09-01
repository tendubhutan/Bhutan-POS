import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, CheckSquare, Square, ShieldAlert, Key } from 'lucide-react';
import { bulkDeleteData } from '../services/storageService';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataCleared: () => void;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, onClose, onDataCleared }) => {
  const [deleteTransactions, setDeleteTransactions] = useState(true);
  const [deleteMasters, setDeleteMasters] = useState(false);
  const [resetOpeningBalances, setResetOpeningBalances] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleExecuteBulkDelete = () => {
    if (!deleteTransactions && !deleteMasters && !resetOpeningBalances) {
      setErrorMsg('Please select at least one option to clean.');
      return;
    }

    if (confirmCode.trim().toUpperCase() !== 'DELETE') {
      setErrorMsg('Type "DELETE" in capital letters to confirm.');
      return;
    }

    bulkDeleteData({
      deleteTransactions,
      deleteMasters,
      resetOpeningBalances
    });

    onDataCleared();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-rose-950 text-white px-6 py-4 flex items-center justify-between border-b border-rose-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600/30 text-rose-300 rounded-xl border border-rose-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">Bulk Data Cleanup</h2>
                <span className="px-2 py-0.5 rounded bg-rose-800 text-rose-200 text-[10px] font-mono font-bold">
                  Ctrl+Alt+D
                </span>
              </div>
              <p className="text-xs text-rose-300">Caution: Mass deletion options for trial & system resets.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-900 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Mass Deletion Warning</p>
              <p className="mt-0.5 text-rose-800">
                This will erase selected transactional data or master data. Ideal for cleaning demo transactions before giving trial access to partner shops.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label
              onClick={() => setDeleteTransactions(!deleteTransactions)}
              className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="mt-0.5 text-indigo-600">
                {deleteTransactions ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">Delete All Transactions & Logs</span>
                <span className="text-slate-500 text-xs block">
                  Clears all Sales, Purchases, Vouchers, Quotations, Stock Ledgers, Held Bills, and Trash logs.
                </span>
              </div>
            </label>

            <label
              onClick={() => setDeleteMasters(!deleteMasters)}
              className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="mt-0.5 text-indigo-600">
                {deleteMasters ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">Delete Master Files (Items & Custom Ledgers)</span>
                <span className="text-slate-500 text-xs block">
                  Removes custom inventory items, custom customer/supplier ledgers, employees, and pay heads.
                </span>
              </div>
            </label>

            <label
              onClick={() => setResetOpeningBalances(!resetOpeningBalances)}
              className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition"
            >
              <div className="mt-0.5 text-indigo-600">
                {resetOpeningBalances ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">Reset Opening Balances to Zero</span>
                <span className="text-slate-500 text-xs block">
                  Resets opening cash/bank/ledger balances and item opening stocks to zero.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Type <span className="text-rose-600 font-mono">DELETE</span> to confirm bulk action:
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
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 font-bold rounded-xl border border-slate-300 hover:bg-slate-50 text-xs transition"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteBulkDelete}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center gap-1.5 transition"
          >
            <Trash2 className="h-4 w-4" />
            <span>Execute Bulk Delete</span>
          </button>
        </div>

      </div>
    </div>
  );
};
