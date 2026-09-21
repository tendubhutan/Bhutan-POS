import React, { useState, useEffect } from 'react';
import { Branch, Config } from '../../types';
import { getBranches, saveBranch, deleteBranch } from '../../services/storageService';
import { Building2, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, MapPin, Phone, Mail, Check, X, ShieldCheck } from 'lucide-react';

interface BranchMasterProps {
  config: Config;
  onUpdated?: () => void;
}

const BHUTAN_DZONGKHAGS = [
  'Thimphu',
  'Chhukha (Phuntsholing)',
  'Paro',
  'Sarpang (Gelephu)',
  'Samdrup Jongkhar',
  'Punakha',
  'Wangdue Phodrang',
  'Bumthang',
  'Mongar',
  'Trashigang',
  'Trongsa',
  'Tsirang',
  'Dagana',
  'Haa',
  'Lhuentse',
  'Pemagatshel',
  'Samtse',
  'Trashiyangtse',
  'Zhemgang',
  'Gasa'
];

export const BranchMaster: React.FC<BranchMasterProps> = ({ config, onUpdated }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Branch>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = () => {
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
    setForm({
      code: `BR0${branches.length + 1}`,
      name: '',
      isHeadOffice: branches.length === 0,
      address: '',
      dzongkhag: 'Thimphu',
      phone: '',
      email: '',
      isActive: true
    });
  };

  const handleEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({ ...b });
  };

  const handleSave = () => {
    if (!form.name?.trim()) {
      showToast('Branch Name is required.', 'error');
      return;
    }
    if (!form.code?.trim()) {
      showToast('Branch Code is required.', 'error');
      return;
    }

    const branchToSave: Branch = {
      id: editingId === 'NEW' ? 'br_' + Date.now() : (form.id || 'br_' + Date.now()),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      isHeadOffice: !!form.isHeadOffice,
      address: form.address?.trim() || '',
      dzongkhag: form.dzongkhag || 'Thimphu',
      phone: form.phone?.trim() || '',
      email: form.email?.trim() || '',
      taxId: form.taxId?.trim() || '',
      tradeLicense: form.tradeLicense?.trim() || '',
      isActive: form.isActive !== false
    };

    const res = saveBranch(branchToSave);
    if (!res.ok) {
      showToast(res.error || 'Failed to save branch.', 'error');
      return;
    }

    showToast(`Branch '${branchToSave.name}' saved successfully.`, 'success');
    setEditingId(null);
    setForm({});
    load();
    onUpdated?.();
  };

  const handleDelete = (b: Branch) => {
    if (b.isHeadOffice) {
      showToast('The Head Office branch cannot be deleted.', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete branch '${b.name}'?`)) {
      const res = deleteBranch(b.id);
      if (!res.ok) {
        showToast(res.error || 'Failed to delete branch.', 'error');
        return;
      }
      showToast(`Branch '${b.name}' deleted.`, 'success');
      load();
      onUpdated?.();
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Branch &amp; Outstation Locations
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Manage Head Office and regional branch offices across Bhutan for multi-location inventory &amp; reporting
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddNew}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Branch</span>
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
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <span>{editingId === 'NEW' ? 'Create New Branch' : `Edit Branch: ${form.name}`}</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Branch Code *
              </label>
              <input
                type="text"
                value={form.code || ''}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. HO, PLG, PARO"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                value={form.name || ''}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Head Office (Thimphu) or Phuntsholing Branch"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Dzongkhag / Region
              </label>
              <select
                value={form.dzongkhag || 'Thimphu'}
                onChange={e => setForm({ ...form, dzongkhag: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {BHUTAN_DZONGKHAGS.map(dz => (
                  <option key={dz} value={dz}>
                    {dz}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Physical Street Address
              </label>
              <input
                type="text"
                value={form.address || ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Norzin Lam, Clock Tower Square"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +975-2-321234"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={form.email || ''}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="branch@company.bt"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Trade License / TPN
              </label>
              <input
                type="text"
                value={form.tradeLicense || ''}
                onChange={e => setForm({ ...form, tradeLicense: e.target.value })}
                placeholder="License number"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={!!form.isHeadOffice}
                  onChange={e => setForm({ ...form, isHeadOffice: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>Designate as Main Head Office (HQ)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={form.isActive !== false}
                  onChange={e => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Active Branch</span>
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
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 transition cursor-pointer shadow-xs flex items-center gap-1"
            >
              <Check className="h-4 w-4" />
              <span>Save Branch</span>
            </button>
          </div>
        </div>
      )}

      {/* Branches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 text-[11px] font-bold">
              <th className="py-2.5 px-3 w-16">Code</th>
              <th className="py-2.5 px-3">Branch Name</th>
              <th className="py-2.5 px-3">Dzongkhag / Location</th>
              <th className="py-2.5 px-3">Contact</th>
              <th className="py-2.5 px-3 text-center w-28">HQ Status</th>
              <th className="py-2.5 px-3 text-center w-20">Status</th>
              <th className="py-2.5 px-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.map(b => (
              <tr key={b.id} className="hover:bg-slate-50/80 transition">
                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{b.code}</td>
                <td className="py-2.5 px-3">
                  <span className="font-extrabold text-slate-900 block">{b.name}</span>
                  {b.address && <span className="text-[11px] text-slate-500">{b.address}</span>}
                </td>
                <td className="py-2.5 px-3 text-slate-700 font-medium">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{b.dzongkhag || 'Thimphu'}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {b.phone && <div className="text-[11px]">{b.phone}</div>}
                  {b.email && <div className="text-[10px] text-slate-400">{b.email}</div>}
                  {!b.phone && !b.email && <span className="text-slate-400">-</span>}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {b.isHeadOffice ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Head Office</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Branch</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      b.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(b)}
                      className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                      title="Edit branch"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {!b.isHeadOffice && (
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
