import React, { useState, useEffect } from 'react';
import { VoucherType, VoucherGroupType } from '../../types';
import { getVoucherTypes, saveVoucherType, deleteVoucherType, toggleVoucherTypeStatus, setVoucherTypeDefault } from '../../services/storageService';
import { playSaveSound } from '../../utils/audio';
import { 
  Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Layers, 
  Sparkles, Check, X, Shield, ArrowRight, FileText, Hash, 
  SlidersHorizontal, RefreshCw, Star, ToggleLeft, ToggleRight
} from 'lucide-react';

interface VoucherTypeManagerProps {
  onUpdated?: () => void;
}

const TYPE_CATEGORIES: { id: VoucherGroupType | 'All'; label: string; color: string }[] = [
  { id: 'All', label: 'All Types', color: 'bg-slate-100 text-slate-800' },
  { id: 'Payment', label: 'Payment', color: 'bg-rose-100 text-rose-800' },
  { id: 'Receipt', label: 'Receipt', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'Purchase', label: 'Purchase', color: 'bg-amber-100 text-amber-800' },
  { id: 'Journal', label: 'Journal', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'Contra', label: 'Contra', color: 'bg-teal-100 text-teal-800' },
  { id: 'CreditNote', label: 'Credit Note', color: 'bg-purple-100 text-purple-800' },
  { id: 'DebitNote', label: 'Debit Note', color: 'bg-orange-100 text-orange-800' },
  { id: 'DeliveryNote', label: 'Delivery Note', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'Quotation', label: 'Quotation', color: 'bg-sky-100 text-sky-800' }
];

export const VoucherTypeManager: React.FC<VoucherTypeManagerProps> = ({ onUpdated }) => {
  const [voucherTypes, setVoucherTypes] = useState<VoucherType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VoucherGroupType | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<VoucherType>>({
    name: '',
    type: 'Payment',
    prefix: '',
    numberingMode: 'auto',
    startingNumber: 1,
    description: '',
    isDefault: false,
    isActive: true
  });

  const loadData = () => {
    const list = getVoucherTypes();
    setVoucherTypes(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleOpenCreate = (presetType?: VoucherGroupType) => {
    setEditingId(null);
    const targetType = presetType || (selectedCategory !== 'All' ? selectedCategory : 'Payment');
    
    // Auto-generate a suggested prefix
    const defaultPrefixMap: Record<string, string> = {
      Payment: 'PMT-',
      Receipt: 'RCT-',
      Sale: 'INV-',
      Purchase: 'PUR-',
      Journal: 'JRN-',
      Contra: 'CTR-',
      CreditNote: 'CN-',
      'Credit Note': 'CN-',
      DebitNote: 'DN-',
      'Debit Note': 'DN-',
      DeliveryNote: 'DC-',
      'Delivery Note': 'DC-',
      Quotation: 'QTN-',
      PhysicalStock: 'PHY-',
      'Physical Stock': 'PHY-'
    };

    setFormData({
      name: '',
      type: targetType,
      prefix: defaultPrefixMap[targetType] || 'VCH-',
      numberingMode: 'auto',
      startingNumber: 1,
      description: '',
      isDefault: false,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vt: VoucherType) => {
    setEditingId(vt.id);
    setFormData({ ...vt });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showFeedback('Voucher Type Name is required.', 'error');
      return;
    }
    if (!formData.type) {
      showFeedback('Parent Voucher Group is required.', 'error');
      return;
    }

    const payload: Partial<VoucherType> = {
      ...(editingId ? { id: editingId } : {}),
      name: formData.name.trim(),
      parentType: formData.type as VoucherGroupType,
      type: formData.type as VoucherGroupType,
      prefix: (formData.prefix || '').trim().toUpperCase(),
      numberingMode: formData.numberingMode || 'auto',
      startingNumber: Number(formData.startingNumber) || 1,
      description: (formData.description || '').trim(),
      isDefault: Boolean(formData.isDefault),
      isActive: formData.isActive !== false
    };

    const res = saveVoucherType(payload);
    if (res.ok) {
      loadData();
      playSaveSound();
      setIsModalOpen(false);
      showFeedback(`Voucher type "${payload.name}" saved successfully!`, 'success');
      if (onUpdated) onUpdated();
    } else {
      showFeedback('Failed to save voucher type.', 'error');
    }
  };

  const handleDelete = (vt: VoucherType) => {
    if (vt.isDefault) {
      alert('System default voucher type cannot be deleted. You can edit it or set another as default first.');
      return;
    }
    if (confirm(`Are you sure you want to delete voucher type "${vt.name}"?`)) {
      const res = deleteVoucherType(vt.id);
      if (res.ok) {
        loadData();
        showFeedback(`Voucher type "${vt.name}" deleted.`, 'success');
        if (onUpdated) onUpdated();
      } else {
        showFeedback(res.message || 'Could not delete voucher type', 'error');
      }
    }
  };

  const handleToggleDefault = (vt: VoucherType) => {
    if (vt.isDefault) return; // already default
    const res = setVoucherTypeDefault(vt.id);
    if (res.ok) {
      loadData();
      showFeedback(`"${vt.name}" is now default for ${vt.type}.`, 'success');
      if (onUpdated) onUpdated();
    }
  };

  const handleToggleStatus = (vt: VoucherType) => {
    if (vt.isDefault) {
      showFeedback('Cannot deactivate the default voucher type for this group.', 'error');
      return;
    }
    const res = toggleVoucherTypeStatus(vt.id);
    if (res.ok) {
      loadData();
      showFeedback(`"${vt.name}" is now ${!vt.isActive ? 'Active' : 'Inactive'}.`, 'success');
      if (onUpdated) onUpdated();
    }
  };

  const filteredTypes = voucherTypes.filter(vt => {
    if (vt.type === 'Sale' || vt.parentType === 'Sale') return false;
    const matchesCat = selectedCategory === 'All' || vt.type === selectedCategory;
    const matchesSearch = 
      vt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.prefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vt.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner / Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>Custom Voucher Types (ERP Master)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and organize multiple custom voucher types under Payment, Receipt, Journal, Purchase, and more.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreate()}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Create Voucher Type</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150 ${
          feedbackMsg.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter Chips & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {TYPE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
              {cat.id !== 'All' && (
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedCategory === cat.id ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {voucherTypes.filter(v => v.type === cat.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search voucher types by name, prefix, or description..."
            className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-700 font-semibold px-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Voucher Types Grid / Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Voucher Type Name</th>
              <th className="py-2.5 px-3">Parent Group</th>
              <th className="py-2.5 px-3">Prefix / Sample</th>
              <th className="py-2.5 px-3">Numbering</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3 text-center">Default</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTypes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                  No voucher types found. Click "Create Voucher Type" above to add one.
                </td>
              </tr>
            ) : (
              filteredTypes.map(vt => {
                const catObj = TYPE_CATEGORIES.find(c => c.id === vt.type);
                return (
                  <tr key={vt.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{vt.name}</span>
                        {vt.isDefault && (
                          <span className="px-1.5 py-0.2 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">
                            Default
                          </span>
                        )}
                        {!vt.isActive && (
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 text-[10px]">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono ${catObj?.color || 'bg-slate-100 text-slate-800'}`}>
                        {vt.type}
                      </span>
                    </td>

                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      <span className="text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100">
                        {vt.prefix || ''}{vt.startingNumber || 1}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-600">
                      <span className="capitalize font-semibold">{vt.numberingMode || 'auto'}</span>
                    </td>

                    <td className="py-2 px-3 text-slate-500 truncate max-w-[200px]" title={vt.description}>
                      {vt.description || <span className="text-slate-300 italic">—</span>}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleDefault(vt)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          vt.isDefault ? 'text-amber-500 hover:text-amber-600' : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={vt.isDefault ? 'Current default voucher for this group' : 'Set as default voucher for this group'}
                      >
                        <Star className={`h-4 w-4 ${vt.isDefault ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </td>

                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(vt)}
                          className={`p-1 rounded-lg transition cursor-pointer ${
                            vt.isActive ? 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600' : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={vt.isActive ? 'Mark as Inactive' : 'Mark as Active'}
                        >
                          {vt.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(vt)}
                          className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                          title="Edit voucher type"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {!vt.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDelete(vt)}
                            className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                            title="Delete voucher type"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Voucher Type Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {editingId ? 'Edit Voucher Type' : 'Create New Voucher Type'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure voucher numbering, prefix, and categorization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Voucher Type Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank Payment Voucher, Sales Tax Invoice, Cash Sale"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Parent Voucher Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => {
                      const newType = e.target.value as VoucherGroupType;
                      const defaultPrefixMap: Record<string, string> = {
                        Payment: 'PMT-',
                        Receipt: 'RCT-',
                        Sale: 'INV-',
                        Purchase: 'PUR-',
                        Journal: 'JRN-',
                        Contra: 'CTR-',
                        CreditNote: 'CN-',
                        'Credit Note': 'CN-',
                        DebitNote: 'DN-',
                        'Debit Note': 'DN-',
                        DeliveryNote: 'DC-',
                        'Delivery Note': 'DC-',
                        Quotation: 'QTN-',
                        PhysicalStock: 'PHY-',
                        'Physical Stock': 'PHY-'
                      };
                      setFormData({
                        ...formData,
                        type: newType,
                        prefix: formData.prefix || defaultPrefixMap[newType] || 'VCH-'
                      });
                    }}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-indigo-600"
                  >
                    <option value="Payment">Payment</option>
                    <option value="Receipt">Receipt</option>
                    <option value="Purchase">Purchase Entry</option>
                    <option value="Journal">Journal Voucher</option>
                    <option value="Contra">Contra (Bank / Cash)</option>
                    <option value="CreditNote">Credit Note (Sales Return)</option>
                    <option value="DebitNote">Debit Note (Purchase Return)</option>
                    <option value="DeliveryNote">Delivery Note / Challan</option>
                    <option value="Quotation">Quotation / Estimate</option>
                    <option value="PhysicalStock">Physical Stock Verification</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Prefix Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PMT-, BNK-, INV-"
                    value={formData.prefix || ''}
                    onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Numbering Method
                  </label>
                  <select
                    value={formData.numberingMode || 'auto'}
                    onChange={e => setFormData({ ...formData, numberingMode: e.target.value as 'auto' | 'manual' })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-indigo-600"
                  >
                    <option value="auto">Automatic (Sequential)</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Starting Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.startingNumber || 1}
                    onChange={e => setFormData({ ...formData, startingNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Dedicated voucher type for vendor bank RTGS / online payments"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-sans text-xs text-slate-800 outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault || false}
                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Set as Default for {formData.type}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Active</span>
                </label>
              </div>

              {/* Sample Voucher Number Preview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Sample Generated Number:</span>
                <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {(formData.prefix || '').toUpperCase()}{formData.startingNumber || 1}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingId ? 'Update Voucher Type' : 'Create Voucher Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
