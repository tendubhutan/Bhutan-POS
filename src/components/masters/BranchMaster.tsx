import React, { useState, useEffect } from 'react';
import { Branch, Config, VoucherType, VoucherGroupType } from '../../types';
import { 
  getBranches, saveBranchWithCustomVouchers, deleteBranch, 
  getVoucherTypes, STANDARD_BRANCH_VOUCHER_TEMPLATES, formatVoucherNumber 
} from '../../services/storageService';
import { 
  Building2, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, 
  MapPin, Phone, Mail, Check, X, ShieldCheck, Layers, Hash, Eye, Sparkles, RefreshCw
} from 'lucide-react';

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

interface EditableSeriesItem {
  id?: string;
  name: string;
  parentType: VoucherGroupType;
  typeCode: any;
  prefix: string;
  startingNumber: number;
  zeroPadding: number;
  description: string;
}

export const BranchMaster: React.FC<BranchMasterProps> = ({ config, onUpdated }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allVoucherTypes, setAllVoucherTypes] = useState<VoucherType[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Branch>>({});
  const [autoCreateVouchers, setAutoCreateVouchers] = useState<boolean>(true);
  const [voucherSeries, setVoucherSeries] = useState<EditableSeriesItem[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [viewingSeriesBranch, setViewingSeriesBranch] = useState<Branch | null>(null);

  const load = () => {
    setBranches(getBranches());
    setAllVoucherTypes(getVoucherTypes());
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const buildDefaultSeries = (code: string, name: string, branchId?: string): EditableSeriesItem[] => {
    const cleanCode = (code || 'BR').trim().toUpperCase();
    const cleanName = (name || 'Branch').trim();
    const existingForBranch = branchId ? allVoucherTypes.filter(v => v.branchId === branchId) : [];

    return STANDARD_BRANCH_VOUCHER_TEMPLATES.map(tmpl => {
      const existing = existingForBranch.find(v => v.parentType === tmpl.parentType && v.typeCode === tmpl.typeCode);
      if (existing) {
        return {
          id: existing.id,
          name: existing.name,
          parentType: existing.parentType || tmpl.parentType,
          typeCode: existing.typeCode || tmpl.typeCode,
          prefix: existing.prefix || `${cleanCode}-${tmpl.prefixSuffix}`,
          startingNumber: Number(existing.startingNumber) || tmpl.defaultStartingNumber,
          zeroPadding: existing.zeroPadding !== undefined ? Number(existing.zeroPadding) : tmpl.zeroPadding,
          description: existing.description || `${tmpl.description} for ${cleanName}`
        };
      }
      return {
        name: `${cleanName} ${tmpl.name}`,
        parentType: tmpl.parentType,
        typeCode: tmpl.typeCode,
        prefix: `${cleanCode}-${tmpl.prefixSuffix}`,
        startingNumber: tmpl.defaultStartingNumber,
        zeroPadding: tmpl.zeroPadding,
        description: `${tmpl.description} for ${cleanName}`
      };
    });
  };

  const handleAddNew = () => {
    const newCode = `BR0${branches.length + 1}`;
    setEditingId('NEW');
    setForm({
      code: newCode,
      name: '',
      isHeadOffice: branches.length === 0,
      address: '',
      dzongkhag: 'Thimphu',
      phone: '',
      email: '',
      isActive: true
    });
    setAutoCreateVouchers(true);
    setVoucherSeries(buildDefaultSeries(newCode, 'New Branch'));
  };

  const handleEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({ ...b });
    setAutoCreateVouchers(true);
    setVoucherSeries(buildDefaultSeries(b.code, b.name, b.id));
  };

  const handleCodeOrNameChange = (newCode?: string, newName?: string) => {
    const code = (newCode !== undefined ? newCode : form.code || '').trim().toUpperCase();
    const name = (newName !== undefined ? newName : form.name || '').trim();

    setVoucherSeries(prev => 
      prev.map(item => {
        const tmpl = STANDARD_BRANCH_VOUCHER_TEMPLATES.find(t => t.parentType === item.parentType && t.typeCode === item.typeCode);
        const suffix = tmpl ? tmpl.prefixSuffix : 'VCH-';
        return {
          ...item,
          name: name ? `${name} ${tmpl?.name || item.parentType}` : item.name,
          prefix: code ? `${code}-${suffix}` : item.prefix
        };
      })
    );
  };

  const handleSeriesChange = (idx: number, field: keyof EditableSeriesItem, val: any) => {
    setVoucherSeries(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
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

    const branchId = editingId === 'NEW' ? 'br_' + Date.now() : (form.id || 'br_' + Date.now());
    const branchToSave: Branch = {
      id: branchId,
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

    const voucherPayload = autoCreateVouchers 
      ? voucherSeries.map(s => ({
          ...s,
          branchId: branchToSave.id,
          branchCode: branchToSave.code,
          branchName: branchToSave.name
        }))
      : [];

    const res = saveBranchWithCustomVouchers(branchToSave, voucherPayload);
    if (!res.ok) {
      showToast(res.error || 'Failed to save branch.', 'error');
      return;
    }

    const voucherMsg = autoCreateVouchers ? ` & ${voucherPayload.length} dedicated voucher identities configured` : '';
    showToast(`Branch '${branchToSave.name}' saved successfully${voucherMsg}.`, 'success');
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
    if (confirm(`Are you sure you want to delete branch '${b.name}' and its associated voucher identities?`)) {
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
              Manage Head Office and regional branch offices with auto-created dedicated voucher numbering identities
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
        <div className="bg-white rounded-xl border-2 border-indigo-200 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-600" />
              <span>{editingId === 'NEW' ? 'Create New Branch & Auto-Configure Voucher Identities' : `Edit Branch: ${form.name}`}</span>
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
                onChange={e => {
                  const upper = e.target.value.toUpperCase();
                  setForm({ ...form, code: upper });
                  handleCodeOrNameChange(upper, form.name);
                }}
                placeholder="e.g. HO, PLG, PARO, GLP"
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
                onChange={e => {
                  const n = e.target.value;
                  setForm({ ...form, name: n });
                  handleCodeOrNameChange(form.code, n);
                }}
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

          {/* Dedicated Voucher Identities Section (Mandatory Auto-Creation) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Branch-Specific Voucher Identities &amp; Numbering Series</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-indigo-600 text-white uppercase tracking-wider">Mandatory</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Each branch automatically maintains its own unique series for Sales, Purchases, Payments, Receipts, Contra, and Notes to prevent sequence collisions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVoucherSeries(buildDefaultSeries(form.code || 'BR', form.name || 'Branch', form.id))}
                  className="px-2 py-1 rounded-md text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer border border-indigo-200"
                  title="Reset to branch standard prefixes"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset Series</span>
                </button>
              </div>
            </div>

            {/* Voucher Series Grid/Table */}
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold z-10">
                  <tr>
                    <th className="py-2 px-2.5">Voucher Type</th>
                    <th className="py-2 px-2.5">Series Name</th>
                    <th className="py-2 px-2.5 w-32">Prefix *</th>
                    <th className="py-2 px-2.5 w-24 text-center">Start No.</th>
                    <th className="py-2 px-2.5 w-32 text-right">Sample No.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voucherSeries.map((item, idx) => {
                    const sampleNo = formatVoucherNumber(item.prefix, item.startingNumber || 1, item.zeroPadding || 4);
                    return (
                      <tr key={idx} className="hover:bg-indigo-50/40 transition">
                        <td className="py-1.5 px-2.5 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {item.parentType}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            value={item.name}
                            onChange={e => handleSeriesChange(idx, 'name', e.target.value)}
                            className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            value={item.prefix}
                            onChange={e => handleSeriesChange(idx, 'prefix', e.target.value.toUpperCase())}
                            className="w-full px-1.5 py-0.5 rounded border border-slate-200 font-mono font-bold text-xs text-indigo-700 outline-none focus:border-indigo-500"
                            placeholder="e.g. THI-POS-"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.startingNumber}
                            onChange={e => handleSeriesChange(idx, 'startingNumber', parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-1 py-0.5 rounded border border-slate-200 text-center font-mono text-xs text-slate-800 outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700">
                          {sampleNo}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Save Branch &amp; Create Voucher Identities</span>
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
              <th className="py-2.5 px-3 text-center w-36">Voucher Identities</th>
              <th className="py-2.5 px-3 text-center w-28">HQ Status</th>
              <th className="py-2.5 px-3 text-center w-20">Status</th>
              <th className="py-2.5 px-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.map(b => {
              const branchVouchers = allVoucherTypes.filter(v => v.branchId === b.id);
              const count = branchVouchers.length;

              return (
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
                    <button
                      type="button"
                      onClick={() => setViewingSeriesBranch(b)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                      title="View all voucher identities registered for this branch"
                    >
                      <Layers className="h-3 w-3" />
                      <span>{count > 0 ? `${count} Series Configured` : 'Standard Series'}</span>
                      <Eye className="h-2.5 w-2.5 ml-0.5 text-indigo-500" />
                    </button>
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
                        title="Edit branch and its voucher identities"
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View Series Modal */}
      {viewingSeriesBranch && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Voucher Series for {viewingSeriesBranch.name} ({viewingSeriesBranch.code})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Separate voucher numbering identities dedicated to this branch location
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSeriesBranch(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Series Name</th>
                    <th className="py-2 px-3">Prefix</th>
                    <th className="py-2 px-3 text-center">Start No.</th>
                    <th className="py-2 px-3 text-right">Sample Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allVoucherTypes.filter(v => v.branchId === viewingSeriesBranch.id).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                        No custom series registered. Falls back to global default series. Click &quot;Edit Branch&quot; to auto-generate branch identities.
                      </td>
                    </tr>
                  ) : (
                    allVoucherTypes.filter(v => v.branchId === viewingSeriesBranch.id).map(v => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-700">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                            {v.parentType || v.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{v.name}</td>
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">{v.prefix}</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-700">{v.startingNumber || 1}</td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700">
                          {formatVoucherNumber(v.prefix, v.startingNumber || 1, v.zeroPadding || 4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = viewingSeriesBranch;
                  setViewingSeriesBranch(null);
                  handleEdit(target);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition flex items-center gap-1.5 text-xs border border-indigo-200"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Series in Branch Master</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingSeriesBranch(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
