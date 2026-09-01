import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, RefreshCw, X, ShieldAlert, Calendar, DollarSign, Search, RotateCcw } from 'lucide-react';
import { getTrashLog, emptyTrash, restoreFromTrash, restoreAllFromTrash } from '../services/storageService';
import { TrashEntry } from '../types';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  currencySymbol?: string;
}

export const TrashModal: React.FC<TrashModalProps> = ({ isOpen, onClose, onDataChanged, currencySymbol = 'Nu.' }) => {
  const [trashList, setTrashList] = useState<TrashEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const loadTrash = () => {
    setTrashList(getTrashLog());
  };

  useEffect(() => {
    if (isOpen) {
      loadTrash();
      setShowConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEmptyTrash = () => {
    emptyTrash();
    loadTrash();
    setShowConfirm(false);
    onDataChanged();
  };

  const filtered = trashList.filter(item => {
    const q = searchTerm.toLowerCase();
    return (
      item.refNo.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.narration.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Trash & Recycle Bin</h2>
              <p className="text-xs text-slate-400">Deleted vouchers are kept for 24 hours before auto-cleaning.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search deleted records..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadTrash}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="Refresh trash"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>

            {trashList.length > 0 && (
              <>
                <button
                  onClick={() => {
                    restoreAllFromTrash();
                    loadTrash();
                    onDataChanged();
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Restore all items from trash back to active records"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore All ({trashList.length})</span>
                </button>

                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Empty Trash</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Empty Confirm Banner */}
        {showConfirm && (
          <div className="bg-rose-50 border-b border-rose-200 p-4 flex items-center justify-between gap-3 text-rose-900 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Are you sure you want to permanently clear all records from Trash? This action cannot be undone.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 shadow-xs"
              >
                Confirm Empty
              </button>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Trash2 className="h-10 w-10 mx-auto stroke-1 opacity-40" />
              <p className="font-semibold text-sm">Trash is empty</p>
              <p className="text-xs">Permanently deleted items will appear here before auto-cleaning.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map(item => (
                <div key={item.id} className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{item.refNo}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border border-slate-200">
                        {item.type}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Deleted: {new Date(item.deletedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600 italic">{item.narration}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right font-mono font-bold text-slate-900 text-sm bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      {currencySymbol} {item.amount.toFixed(2)}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        restoreFromTrash(item.id);
                        loadTrash();
                        onDataChanged();
                      }}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                      title="Restore voucher back into active records"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span>Trash auto-cleans entries older than 24 hours</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
