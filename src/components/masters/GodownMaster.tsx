import React, { useState, useEffect } from 'react';
import { Godown, Branch, Config } from '../../types';
import { getGodowns, saveGodown, deleteGodown, getBranches } from '../../services/storageService';
import { Warehouse, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Building2, Check, X, ShieldCheck } from 'lucide-react';

interface GodownMasterProps {
  config: Config;
  onUpdated?: () => void;
}

export const GodownMaster: React.FC<GodownMasterProps> = ({ config, onUpdated }) => {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Godown>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = () => {
    setGodowns(getGodowns());
    setBranches(getBranches());
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleAddNew = () => {
    setEditingId('NEW');
    const ho = branches.find(b => b.isHeadOffice) || branches[0];
    setForm({
      code: `GD0${godowns.length + 1}`,
      name: '',
      branchId: ho?.id || '',
      isDefault: godowns.length === 0,
      address: '',
      isActive: true
    });
  };

  const handleEdit = (g: Godown) => {
    setEditingId(g.id);
    setForm({ ...g });
  };

  const handleSave = () => {
    if (!form.name?.trim()) {
      showToast('Godown Name is required.', 'error');
      return;
    }
    if (!form.branchId) {
      showToast('Associated Branch is required.', 'error');
      return;
    }

    const godownToSave: Godown = {
      id: editingId === 'NEW' ? 'gd_' + Date.now() : (form.id || 'gd_' + Date.now()),
      code: form.code?.trim().toUpperCase() || `GD0${godowns.length + 1}`,
      name: form.name.trim(),
      branchId: form.branchId,
      isDefault: !!form.isDefault,
      address: form.address?.trim() || '',
      isActive: form.isActive !== false
    };

    const res = saveGodown(godownToSave);
    if (!res.ok) {
      showToast(res.error || 'Failed to save godown.', 'error');
      return;
    }

    showToast(`Godown '${godownToSave.name}' saved successfully.`, 'success');
    setEditingId(null);
    setForm({});
    load();
    onUpdated?.();
  };

  const handleDelete = (g: Godown) => {
    if (confirm(`Are you sure you want to delete godown '${g.name}'?`)) {
      const res = deleteGodown(g.id);
      if (!res.ok) {
        showToast(res.error || 'Failed to delete godown.', 'error');
        return;
      }
      showToast(`Godown '${g.name}' deleted.`, 'success');
      load();
      onUpdated?.();
    }
  };

  const getBranchName = (bId?: string) => {
    return branches.find(b => b.id === bId)?.name || 'Unknown Branch';
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Godowns &amp; Storage Locations
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Manage warehouses, storage bins, and stock rooms mapped to company branches
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold hover:bg-teal-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Godown</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`px-3 py-2 rounded-lg font-semibold flex items-center gap-2 border ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Add / Edit Form Modal or Card */}
      {editingId && (
        <div className="bg-white rounded-xl border-2 border-teal-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-teal-600" />
              <span>{editingId === 'NEW' ? 'Create New Godown' : `Edit Godown: ${form.name}`}</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({});
              }}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Godown Code *
              </label>
              <input
                type="text"
                value={form.code || ''}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. GD01, WH-THI"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Godown / Warehouse Name *
              </label>
              <input
                type="text"
                value={form.name || ''}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main Central Godown or Paro Stock Room"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900 outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Parent Branch *
              </label>
              <select
                value={form.branchId || ''}
                onChange={e => setForm({ ...form, branchId: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800 outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="" disabled>Select Branch...</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Location / Address Details
              </label>
              <input
                type="text"
                value={form.address || ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Building C, Industrial Area, Gate 2"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-3 flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={!!form.isDefault}
                  onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>Default Godown for this Branch</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Active Storage Location</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({});
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-teal-600 text-white font-extrabold hover:bg-teal-700 transition cursor-pointer shadow-xs flex items-center gap-1"
            >
              <Check className="h-4 w-4" />
              <span>Save Godown</span>
            </button>
          </div>
        </div>
      )}

      {/* Godowns Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
              <th className="py-2.5 px-3 w-16">Code</th>
              <th className="py-2.5 px-3">Godown Name</th>
              <th className="py-2.5 px-3">Associated Branch</th>
              <th className="py-2.5 px-3">Address / Bins</th>
              <th className="py-2.5 px-3 text-center w-28">Default</th>
              <th className="py-2.5 px-3 text-center w-20">Status</th>
              <th className="py-2.5 px-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {godowns.map(g => (
              <tr key={g.id} className="hover:bg-slate-50/80 transition">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{g.code}</td>
                <td className="py-2.5 px-3">
                  <span className="font-extrabold text-slate-900 block">{g.name}</span>
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span>{getBranchName(g.branchId)}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {g.address || <span className="text-slate-400">-</span>}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {g.isDefault ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Default</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">-</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      g.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {g.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(g)}
                      className="p-1 rounded-md text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition cursor-pointer"
                      title="Edit godown"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(g)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Delete godown"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
