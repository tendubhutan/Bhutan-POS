import React, { useState, useEffect, useRef } from 'react';
import { Item, Config } from '../types';
import { loadJson, saveJson, saveItem, saveItemGroup, saveItemCategory, saveUnit, getItemCategories, getUnits, STORAGE_KEYS, DEFAULT_UNITS, DEFAULT_ITEM_GROUPS } from '../services/storageService';
import { X, Save, Plus, KeyRound, Check } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { MultiUnitEditor } from './MultiUnitEditor';
import { handleFormKeyDown, focusFirstFormInput } from '../utils/formKeyNavigation';

interface QuickItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
  config: Config;
  itemToEdit?: Item | null;
}

export const QuickItemModal: React.FC<QuickItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  config,
  itemToEdit
}) => {
  const [itemForm, setItemForm] = useState<Partial<Item>>({});
  const [showOpeningSerialModal, setShowOpeningSerialModal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Quick Sub-Modals
  const [showQuickGroupModal, setShowQuickGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showQuickUnitModal, setShowQuickUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');

  // Master Lists
  const [itemGroups, setItemGroups] = useState<any[]>([]);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  const modalRef = useRef<HTMLDivElement>(null);

  const generateBarcode = () => String(100000 + Math.floor(Math.random() * 900000));

  useEffect(() => {
    if (isOpen) {
      const loadedGroups = loadJson<any[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
      const loadedCats = loadJson<string[]>(STORAGE_KEYS.ITEM_CATEGORIES, ['General']);
      const loadedUnits = loadJson<any[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);

      setItemGroups(loadedGroups);
      setCategoryList(loadedCats);
      setUnits(loadedUnits);

      focusFirstFormInput(modalRef.current);

      if (itemToEdit) {
        setItemForm({ ...itemToEdit });
      } else {
        const defaultGroup = loadedGroups[0]?.['Group Name'] || 'General';
        const defaultUnit = loadedUnits[0]?.['Unit Name'] || 'Pcs';
        setItemForm({
          'Item Code': 'ITM' + new Date().toISOString().replace(/\D/g, '').slice(2, 14),
          'Item Name': '',
          'Print Name': '',
          Barcode: generateBarcode(),
          Group: defaultGroup,
          Category: '',
          Unit: defaultUnit,
          'Purchase Rate': '' as any,
          'Sale Rate': '' as any,
          'Wholesale Rate': '' as any,
          MRP: '' as any,
          'GST %': 0,
          'Zero Rated (Y/N)': 'N',
          'Opening Stock': '' as any,
          'Opening Amount': 0,
          'Reorder Level': '' as any,
          'Maintain Stock': 'Y',
          'Is Serialized': 'N',
          'Opening Serials': ''
        });
      }
    }
  }, [isOpen, itemToEdit]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'F2') {
        if (showOpeningSerialModal || showQuickGroupModal || showQuickCategoryModal || showQuickUnitModal) return;
        e.preventDefault();
        e.stopPropagation();
        const saveBtn = document.getElementById('quick-item-submit-btn');
        saveBtn?.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        if (showOpeningSerialModal) {
          setShowOpeningSerialModal(false);
          return;
        }
        if (showQuickGroupModal || showQuickCategoryModal || showQuickUnitModal) {
          setShowQuickGroupModal(false);
          setShowQuickCategoryModal(false);
          setShowQuickUnitModal(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    isOpen,
    showOpeningSerialModal,
    showQuickGroupModal,
    showQuickCategoryModal,
    showQuickUnitModal,
    onClose
  ]);

  if (!isOpen) return null;

  const showGst = String(config.EnableGST) !== 'false';
  const showSerials = String(config.EnableSerials) === 'true';
  const showCategory = true;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemForm['Item Name']?.trim()) {
      alert('Item Name is required.');
      return;
    }
    const res = saveItem(itemForm as Item);
    if (res.ok) {
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
        onSave(itemForm as Item);
      }, 250);
    } else {
      alert(res.error);
    }
  };

  // Quick Add Handlers
  const handleAddQuickGroup = () => {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    const res = saveItemGroup({ 'Group Name': name, 'Parent Group': 'Primary' });
    if (!res.ok) {
      alert(res.error || `Duplicate Item Group: An item group named "${name}" already exists.`);
      return;
    }
    const updated = loadJson<any[]>(STORAGE_KEYS.ITEM_GROUPS, DEFAULT_ITEM_GROUPS);
    setItemGroups(updated);
    setItemForm(prev => ({ ...prev, Group: name }));
    setNewGroupName('');
    setShowQuickGroupModal(false);
  };

  const handleAddQuickCategory = () => {
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    const res = saveItemCategory(name);
    if (!res.ok) {
      alert(res.error || `Duplicate Category: Category "${name}" already exists.`);
      return;
    }
    const updated = getItemCategories();
    setCategoryList(updated);
    setItemForm(prev => ({ ...prev, Category: name }));
    setNewCategoryName('');
    setShowQuickCategoryModal(false);
  };

  const handleAddQuickUnit = () => {
    if (!newUnitName.trim()) return;
    const uName = newUnitName.trim();
    const uSymbol = newUnitSymbol.trim() || uName;
    const res = saveUnit({ 'Unit Name': uName, Symbol: uSymbol, Group: 'Count', 'Conversion Factor': 1 });
    if (!res.ok) {
      alert(res.error || `Duplicate Unit: A measurement unit named "${uName}" already exists.`);
      return;
    }
    const updated = getUnits();
    setUnits(updated);
    setItemForm(prev => ({ ...prev, Unit: uName }));
    setNewUnitName('');
    setNewUnitSymbol('');
    setShowQuickUnitModal(false);
  };

  return (
    <div
      ref={modalRef}
      onKeyDown={e =>
        handleFormKeyDown(
          e,
          modalRef.current,
          () => {
            const btn = document.getElementById('quick-item-submit-btn');
            btn?.click();
          },
          onClose
        )
      }
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto"
    >
      <div className="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 space-y-3">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 bg-white -mx-4 -mt-4 px-4 py-2.5 rounded-t-2xl">
          <h3 className="text-sm font-bold text-slate-900">
            {itemToEdit ? `Edit Item Master (${itemToEdit['Item Name']})` : 'New Item Creation'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Row 1: Identification & Grouping */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
          {/* Item Name */}
          <div className="sm:col-span-4">
            <label className="block font-semibold text-slate-700 mb-0.5">Item Name *</label>
            <input
              type="text"
              required
              autoFocus
              value={itemForm['Item Name'] || ''}
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  'Item Name': e.target.value,
                  'Print Name': e.target.value
                })
              }
              className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-semibold text-slate-900 outline-none focus:border-indigo-500 text-xs"
              placeholder="Enter item name"
            />
          </div>

          {/* Barcode */}
          <div className="sm:col-span-3">
            <div className="flex justify-between items-center mb-0.5">
              <label className="font-semibold text-slate-700">Barcode</label>
              <button
                type="button"
                onClick={() => setItemForm({ ...itemForm, Barcode: generateBarcode() })}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
              >
                ⚡ Auto
              </button>
            </div>
            <input
              type="text"
              placeholder="Barcode / UPC"
              value={itemForm.Barcode || ''}
              onChange={e => setItemForm({ ...itemForm, Barcode: e.target.value })}
              className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs outline-none focus:border-indigo-500"
            />
          </div>

          {/* Group */}
          <div className={showCategory ? 'sm:col-span-2' : 'sm:col-span-3'}>
            <label className="block font-semibold text-slate-700 mb-0.5">Group *</label>
            <div className="flex gap-1">
              <select
                value={itemForm.Group || ''}
                onChange={e => setItemForm({ ...itemForm, Group: e.target.value })}
                className="w-full h-8 rounded-lg border border-slate-300 px-1.5 font-medium text-xs outline-none focus:border-indigo-500"
              >
                {itemGroups.length === 0 ? (
                  <option value="">No Groups</option>
                ) : (
                  itemGroups.map(g => (
                    <option key={g['Group Name']} value={g['Group Name']}>
                      {g['Group Name']}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowQuickGroupModal(true)}
                className="flex-shrink-0 h-8 w-8 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
                title="Quick Add New Group"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Category */}
          {showCategory && (
            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-0.5">Category</label>
              <div className="flex gap-1">
                <select
                  value={itemForm.Category || ''}
                  onChange={e => setItemForm({ ...itemForm, Category: e.target.value })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-1.5 font-medium text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">-- Category --</option>
                  {categoryList.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowQuickCategoryModal(true)}
                  className="flex-shrink-0 h-8 w-8 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
                  title="Quick Add Category"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Primary Unit */}
          <div className={showCategory ? 'sm:col-span-3' : 'sm:col-span-2'}>
            <label className="block font-semibold text-slate-700 mb-0.5">Primary Unit *</label>
            <div className="flex gap-1">
              <select
                value={itemForm.Unit || ''}
                onChange={e => setItemForm({ ...itemForm, Unit: e.target.value })}
                className="w-full h-8 rounded-lg border border-slate-300 px-1.5 font-semibold text-xs outline-none focus:border-indigo-500"
              >
                {units.length === 0 ? (
                  <option value="">No Units</option>
                ) : (
                  units.map(u => (
                    <option key={u['Unit Name']} value={u['Unit Name']}>
                      {u['Unit Name']} ({u.Symbol})
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowQuickUnitModal(true)}
                className="flex-shrink-0 h-8 w-8 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
                title="Quick Add Unit"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Rates & Taxation */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Purchase Rate</label>
            <input
              type="number"
              step="any"
              value={itemForm['Purchase Rate'] ?? ''}
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  'Purchase Rate': e.target.value === '' ? ('' as any) : Number(e.target.value)
                })
              }
              className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">Sale Rate *</label>
            <input
              type="number"
              step="any"
              value={itemForm['Sale Rate'] ?? ''}
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  'Sale Rate': e.target.value === '' ? ('' as any) : Number(e.target.value)
                })
              }
              className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-indigo-900 text-xs outline-none focus:border-indigo-500 bg-indigo-50/20"
            />
          </div>

          {config.EnableWholesalePrice !== 'false' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">Wholesale Rate</label>
              <input
                type="number"
                step="any"
                value={itemForm['Wholesale Rate'] ?? ''}
                onChange={e =>
                  setItemForm({
                    ...itemForm,
                    'Wholesale Rate': e.target.value === '' ? ('' as any) : Number(e.target.value)
                  })
                }
                className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-emerald-800 text-xs outline-none focus:border-emerald-500 bg-emerald-50/20"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-0.5">MRP</label>
            <input
              type="number"
              step="any"
              value={itemForm.MRP ?? ''}
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  MRP: e.target.value === '' ? ('' as any) : Number(e.target.value)
                })
              }
              className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500"
            />
          </div>

          {showGst && (
            <div>
              <label className="block font-semibold text-slate-700 mb-0.5">GST Taxation</label>
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
                className="w-full h-8 rounded-lg border border-slate-300 px-1.5 font-medium text-xs outline-none focus:border-indigo-500"
              >
                <option value="5">5% GST Taxable</option>
                <option value="0">0% Zero-Rated / Exempt</option>
              </select>
            </div>
          )}
        </div>

        {/* Row 3: Stock & Inventory Options */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-0.5">
              <label className="font-semibold text-slate-700">Opening Stock</label>
              {showSerials &&
                itemForm['Is Serialized'] === 'Y' &&
                Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0)) > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOpeningSerialModal(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" /> Serials
                  </button>
                )}
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={itemForm['Opening Stock'] ?? ''}
              onChange={e => {
                const newQty = e.target.value === '' ? ('' as any) : Number(e.target.value);
                const purchaseRate = Number(itemForm['Purchase Rate']) || 0;
                setItemForm({
                  ...itemForm,
                  'Opening Stock': newQty,
                  'Opening Amount': typeof newQty === 'number' ? newQty * purchaseRate : 0
                });
              }}
              className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block font-semibold text-slate-700 mb-0.5">Opening Value (Amt)</label>
            <input
              type="number"
              step="any"
              value={
                itemForm['Opening Amount'] !== undefined
                  ? itemForm['Opening Amount']
                  : (Number(itemForm['Opening Stock'] || 0) * Number(itemForm['Purchase Rate'] || 0)) || ''
              }
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  'Opening Amount': e.target.value === '' ? ('' as any) : Number(e.target.value)
                })
              }
              className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-0.5">Reorder Level</label>
            <input
              type="number"
              step="any"
              value={itemForm['Reorder Level'] ?? ''}
              onChange={e =>
                setItemForm({
                  ...itemForm,
                  'Reorder Level': e.target.value === '' ? ('' as any) : Number(e.target.value)
                })
              }
              className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="sm:col-span-5 flex flex-wrap gap-3 items-center pt-3 sm:pt-0">
            {/* Don't Maintain Stock Checkbox */}
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={itemForm['Maintain Stock'] === 'N'}
                onChange={e => {
                  const dontMaintain = e.target.checked;
                  setItemForm(prev => ({
                    ...prev,
                    'Maintain Stock': dontMaintain ? 'N' : 'Y',
                    'Opening Stock': dontMaintain ? 0 : prev['Opening Stock'] || 0
                  }));
                }}
                className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Don't track stock</span>
            </label>

            {/* Serial Number Tracking Checkbox */}
            {showSerials && itemForm['Maintain Stock'] !== 'N' && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={itemForm['Is Serialized'] === 'Y'}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    const opQty = Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0));
                    const currentSerials = (itemForm['Opening Serials'] || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean);
                    setItemForm(prev => ({
                      ...prev,
                      'Is Serialized': isChecked ? 'Y' : 'N'
                    }));
                    if (isChecked && opQty > 0 && currentSerials.length !== opQty) {
                      setShowOpeningSerialModal(true);
                    }
                  }}
                  className="rounded border-slate-300 h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Track Serial Nos</span>
              </label>
            )}
          </div>
        </div>

        {/* Row 4: Alternative Units & Pricing Rates */}
        {config.EnableAltUnitPrice !== 'false' && (
          <MultiUnitEditor
            itemForm={itemForm}
            setItemForm={setItemForm}
            units={units}
            showWholesalePrice={config.EnableWholesalePrice !== 'false'}
          />
        )}

        {/* Modal Action Footer */}
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 bg-white -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="quick-item-submit-btn"
            type="button"
            disabled={justSaved}
            onClick={() => handleSave()}
            className={`px-5 py-1.5 text-xs font-bold text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer select-none ${
              justSaved
                ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            {justSaved ? (
              <>
                <Check className="h-4 w-4 text-emerald-100 animate-bounce" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-indigo-100" />
                <span>{itemToEdit ? 'Update Item' : 'Save Item'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Opening Stock Serial Numbers Modal */}
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

      {/* Quick Add Group Modal */}
      {showQuickGroupModal && (
        <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Add New Item Group</h4>
              <button
                type="button"
                onClick={() => setShowQuickGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group Name *</label>
              <input
                type="text"
                autoFocus
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuickGroup();
                  }
                }}
                placeholder="e.g. Beverages, Electronics"
                className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 font-medium"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickGroupModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddQuickGroup}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                Add Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Category Modal */}
      {showQuickCategoryModal && (
        <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Add New Category</h4>
              <button
                type="button"
                onClick={() => setShowQuickCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuickCategory();
                  }
                }}
                placeholder="e.g. Premium, Imported, Local"
                className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 font-medium"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickCategoryModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddQuickCategory}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Unit Modal */}
      {showQuickUnitModal && (
        <div className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">Add New Primary Unit</h4>
              <button
                type="button"
                onClick={() => setShowQuickUnitModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Name *</label>
                <input
                  type="text"
                  autoFocus
                  value={newUnitName}
                  onChange={e => setNewUnitName(e.target.value)}
                  placeholder="e.g. Pieces, Kilograms, Liters"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Symbol / Abbreviation</label>
                <input
                  type="text"
                  value={newUnitSymbol}
                  onChange={e => setNewUnitSymbol(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddQuickUnit();
                    }
                  }}
                  placeholder="e.g. pcs, kg, ltr"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickUnitModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddQuickUnit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                Add Unit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
