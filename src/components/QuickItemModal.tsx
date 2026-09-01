import React, { useState, useEffect } from 'react';
import { Item, Config } from '../types';
import { loadJson, saveItem, STORAGE_KEYS, DEFAULT_UNITS, DEFAULT_ITEM_GROUPS } from '../services/storageService';
import { X, Save, KeyRound } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { MultiUnitEditor } from './MultiUnitEditor';

interface QuickItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  config: Config;
  itemToEdit?: Item | null;
}

export const QuickItemModal: React.FC<QuickItemModalProps> = ({ isOpen, onClose, onSave, config, itemToEdit }) => {
  const [itemForm, setItemForm] = useState<Partial<Item>>({});
  const [showOpeningSerialModal, setShowOpeningSerialModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setItemForm({ ...itemToEdit });
      } else {
        setItemForm({
          'Item Code': 'ITM' + new Date().toISOString().replace(/\D/g, '').slice(2, 14),
          'Item Name': '',
          'Group': 'General',
          'Unit': 'Nos',
          'Purchase Rate': 0,
          'Sale Rate': 0,
          'MRP': 0,
          'GST %': 0,
          'Zero Rated (Y/N)': 'N',
          'Opening Stock': 0,
          'Reorder Level': 0,
          'Is Serialized': 'N',
          'Opening Serials': ''
        });
      }
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const showGst = String(config.EnableGST) !== 'false';
  const showSerials = String(config.EnableSerials) === 'true';

  const units = loadJson<any[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const categories = loadJson<any[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm['Item Name']?.trim()) {
      alert('Item Name is required.');
      return;
    }
    const res = saveItem(itemForm as Item);
    if (res.ok) {
      onSave(itemForm as Item);
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            {itemToEdit ? `Alter Item Master (${itemToEdit['Item Name']})` : 'Quick Create Item'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Item Name *</label>
              <input
                type="text"
                autoFocus
                required
                value={itemForm['Item Name'] || ''}
                onChange={e => setItemForm({ ...itemForm, 'Item Name': e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Item Code</label>
              <input
                type="text"
                value={itemForm['Item Code'] || ''}
                onChange={e => setItemForm({ ...itemForm, 'Item Code': e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <select
                value={itemForm['Group'] || ''}
                onChange={e => setItemForm({ ...itemForm, 'Group': e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
              >
                {categories.map(c => (
                  <option key={c['Group Name']} value={c['Group Name']}>{c['Group Name']}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Unit</label>
              <select
                value={itemForm['Unit'] || ''}
                onChange={e => setItemForm({ ...itemForm, 'Unit': e.target.value })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
              >
                {units.map(u => (
                  <option key={u['Unit Name']} value={u['Unit Name']}>{u['Unit Name']}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Sale Rate *</label>
              <input
                type="number"
                step="any"
                value={itemForm['Sale Rate'] || 0}
                onChange={e => setItemForm({ ...itemForm, 'Sale Rate': Number(e.target.value) })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
              />
            </div>

            {(config.EnableWholesalePrice !== 'false') && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Wholesale Rate</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Wholesale Rate'] || 0}
                  onChange={e => setItemForm({ ...itemForm, 'Wholesale Rate': Number(e.target.value) })}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 font-bold text-emerald-800 outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Purchase Rate</label>
              <input
                type="number"
                step="any"
                value={itemForm['Purchase Rate'] || 0}
                onChange={e => setItemForm({ ...itemForm, 'Purchase Rate': Number(e.target.value) })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {showGst && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Taxation</label>
                <select
                  value={itemForm['Zero Rated (Y/N)'] === 'Y' ? '0' : String(itemForm['GST %'])}
                  onChange={e => {
                    const val = e.target.value;
                    setItemForm({
                      ...itemForm,
                      'GST %': Number(val),
                      'Zero Rated (Y/N)': val === '0' ? 'Y' : 'N'
                    });
                  }}
                  className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
                >
                  <option value="5">5% GST Taxable</option>
                  <option value="0">0% Zero-Rated / Exempt</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Opening Stock</label>
              <input
                type="number"
                min="0"
                step="any"
                value={itemForm['Opening Stock'] ?? 0}
                onChange={e => setItemForm({ ...itemForm, 'Opening Stock': Number(e.target.value) || 0 })}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <MultiUnitEditor itemForm={itemForm} setItemForm={setItemForm} units={units} showWholesalePrice={config.EnableWholesalePrice !== 'false'} />

          <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/60 mt-4 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900 select-none">
              <input
                type="checkbox"
                checked={itemForm['Maintain Stock'] === 'N'}
                onChange={e => {
                  const dontMaintain = e.target.checked;
                  setItemForm(prev => ({
                    ...prev,
                    'Maintain Stock': dontMaintain ? 'N' : 'Y',
                    'Opening Stock': dontMaintain ? 0 : (prev['Opening Stock'] || 0)
                  }));
                }}
                className="rounded border-amber-300 h-4 w-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>Don't maintain inventory stock for this item</span>
            </label>
            <p className="text-[11px] text-amber-700/90 ml-6">
              Use this for services, freight, labor, or charges where GST applies on line items but stock counts are not tracked and won't appear on stock reports.
            </p>
          </div>

          {showSerials && itemForm['Maintain Stock'] !== 'N' && (
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 mt-4">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900 mb-2">
                <input
                  type="checkbox"
                  checked={itemForm['Is Serialized'] === 'Y'}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    setItemForm(prev => ({
                      ...prev,
                      'Is Serialized': isChecked ? 'Y' : 'N'
                    }));
                  }}
                  className="rounded border-slate-300 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Track Serial Numbers for this Item</span>
              </label>

              {itemForm['Is Serialized'] === 'Y' && Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0)) > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOpeningSerialModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Set Opening Serials ({(itemForm['Opening Serials'] || '').split(',').filter(Boolean).length}/{Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0))})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Item
            </button>
          </div>
        </form>
      </div>

      {showOpeningSerialModal && (
        <SerialModal
          isOpen={showOpeningSerialModal}
          onClose={() => setShowOpeningSerialModal(false)}
          requiredQty={Math.max(1, Math.floor(Number(itemForm['Opening Stock']) || 1))}
          itemName={itemForm['Item Name'] || 'New Item'}
          initialSerials={(itemForm['Opening Serials'] || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)}
          onConfirm={serials => {
            setItemForm(prev => ({
              ...prev,
              'Opening Serials': serials.join(', ')
            }));
            setShowOpeningSerialModal(false);
          }}
        />
      )}
    </div>
  );
};
