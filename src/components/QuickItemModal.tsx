import React, { useState, useEffect, useRef } from 'react';
import { Item, ItemVariant, ItemBatch, Config } from '../types';
import { loadJson, saveJson, saveItem, saveItemGroup, saveItemCategory, saveUnit, getItemCategories, getUnits, getRacks, saveRack, getCompatibilities, saveCompatibility, getSizes, saveSize, getColors, saveColor, STORAGE_KEYS, DEFAULT_UNITS, DEFAULT_ITEM_GROUPS } from '../services/storageService';
import { X, Save, Plus, KeyRound, Check, Shirt, Trash2 } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { MultiUnitEditor } from './MultiUnitEditor';
import { MultiTagSelect } from './MultiTagSelect';
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
  const [racksList, setRacksList] = useState<string[]>(getRacks());
  const [compatibilitiesList, setCompatibilitiesList] = useState<string[]>(getCompatibilities());
  const [sizesList, setSizesList] = useState<string[]>(getSizes());
  const [colorsList, setColorsList] = useState<string[]>(getColors());
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
  const showPharmacyBatch = String(config.EnablePharmacyBatch) !== 'false';
  const showCategory = true;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!itemForm['Item Name']?.trim()) {
      alert('Item Name is required.');
      return;
    }

    const purRate = Number(itemForm['Purchase Rate']) || 0;
    const saleRate = Number(itemForm['Sale Rate']) || 0;
    const wholesaleRate = Number((itemForm as any)['Wholesale Rate'] || (itemForm as any)['wholesaleRate'] || 0) || 0;
    const mrp = Number(itemForm.MRP) || 0;
    const opStock = Number(itemForm['Opening Stock']) || 0;

    let finalBatches = itemForm.batches;
    if (itemForm.isPharmacy === 'Y' || itemForm.maintainBatch === 'Y') {
      if (!finalBatches || finalBatches.length === 0) {
        finalBatches = [{
          id: `batch_${Date.now()}`,
          batchNo: 'B-101',
          expDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          barcode: itemForm.Barcode ? `${itemForm.Barcode}-B1` : `${Math.floor(100000 + Math.random() * 900000)}`,
          openingStock: opStock,
          currentStock: opStock,
          purchaseRate: purRate,
          saleRate: saleRate,
          wholesaleRate: wholesaleRate,
          mrp: mrp
        }];
      } else {
        const batchCount = finalBatches.length;
        const totalExplicitStock = finalBatches.reduce((sum, b) => sum + (Number(b.currentStock) || Number(b.openingStock) || 0), 0);
        const baseStock = batchCount > 0 ? Math.floor(opStock / batchCount) : opStock;
        const remainder = batchCount > 0 ? opStock % batchCount : 0;

        finalBatches = finalBatches.map((b, idx) => {
          let bOp = Number(b.openingStock) || 0;
          let bCur = Number(b.currentStock) || 0;

          if (totalExplicitStock === 0 && opStock > 0) {
            bOp = baseStock + (idx === 0 ? remainder : 0);
            bCur = bOp;
          } else {
            if (bOp === 0 && opStock > 0) bOp = baseStock;
            if (bCur === 0) bCur = bOp > 0 ? bOp : opStock;
          }

          return {
            ...b,
            openingStock: bOp,
            currentStock: bCur,
            purchaseRate: purRate,
            saleRate: saleRate,
            wholesaleRate: wholesaleRate,
            mrp: mrp
          };
        });
      }
    }

    const itemToSave = {
      ...itemForm,
      batches: finalBatches
    } as Item;

    const res = saveItem(itemToSave);
    if (res.ok) {
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
        onSave(itemToSave);
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

        {/* Spare Parts Additional Fields (if enabled) */}
        {config.EnableSpareParts === 'true' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
            <div className="sm:col-span-4">
              <label className="block font-semibold text-slate-700 mb-0.5">Part Number / OEM No.</label>
              <input
                type="text"
                value={itemForm.partNumber || ''}
                onChange={e => setItemForm({ ...itemForm, partNumber: e.target.value })}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-xs outline-none focus:border-indigo-500 bg-white"
                placeholder="e.g. 13780-61M00 / OEM-492"
              />
            </div>
            {config.EnableRackBin !== 'false' && (
              <div className="sm:col-span-3">
                <MultiTagSelect
                  label="Rack / Bin Location(s)"
                  value={itemForm.rackLocation || ''}
                  onChange={val => setItemForm({ ...itemForm, rackLocation: val })}
                  options={racksList}
                  onAddNewOption={newVal => {
                    const res = saveRack(newVal);
                    if (res.ok) setRacksList(res.racks);
                  }}
                  placeholder="Type rack/bin..."
                  iconType="location"
                  badgeBgColor="bg-amber-100 text-amber-900 border-amber-300"
                />
              </div>
            )}
            {config.EnableCompatibility !== 'false' && (
              <div className={config.EnableRackBin !== 'false' ? "sm:col-span-5" : "sm:col-span-8"}>
                <MultiTagSelect
                  label="Vehicle / Machine Compatibility"
                  value={itemForm.compatibility || ''}
                  onChange={val => setItemForm({ ...itemForm, compatibility: val })}
                  options={compatibilitiesList}
                  onAddNewOption={newVal => {
                    const res = saveCompatibility(newVal);
                    if (res.ok) setCompatibilitiesList(res.compatibilities);
                  }}
                  placeholder="Type vehicle model..."
                  iconType="vehicle"
                  badgeBgColor="bg-indigo-50 text-indigo-900 border-indigo-200"
                />
              </div>
            )}
          </div>
        )}

        {/* Garments & Footwear Size & Color Variants (Opening Stock Breakdown) */}
        {config.EnableGarmentsAndFootwear === 'true' && (
          <div className="space-y-2">
            <div className="bg-purple-50/80 p-2 rounded-xl border border-purple-200 text-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-purple-950">
                  <Shirt className="w-4 h-4 text-purple-700" />
                  <span>Size & Color Variants (Opening Stock Breakdown)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentVars = itemForm.variants || [];
                    const lastVar = currentVars.length > 0 ? currentVars[currentVars.length - 1] : null;
                    const newVar: ItemVariant = {
                      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      size: '',
                      color: '',
                      barcode: itemForm.Barcode ? `${itemForm.Barcode}-${currentVars.length + 1}` : `${Math.floor(100000 + Math.random() * 900000)}`,
                      openingStock: 0,
                      purchaseRate: lastVar ? (Number(lastVar.purchaseRate) || 0) : (Number(itemForm['Purchase Rate']) || 0),
                      saleRate: lastVar ? (Number(lastVar.saleRate) || 0) : (Number(itemForm['Sale Rate']) || 0),
                      wholesaleRate: lastVar ? (Number(lastVar.wholesaleRate) || 0) : (Number((itemForm as any)['Wholesale Rate'] || (itemForm as any)['wholesaleRate'] || 0) || 0),
                      mrp: lastVar ? (Number(lastVar.mrp) || 0) : (Number(itemForm.MRP) || 0),
                    };
                    const updatedVars = [...currentVars, newVar];
                    const totalOp = updatedVars.reduce((sum, v) => sum + (Number(v.openingStock) || 0), 0);
                    const totalVal = updatedVars.reduce((sum, v) => sum + ((Number(v.openingStock) || 0) * (Number(v.purchaseRate) || Number(itemForm['Purchase Rate']) || 0)), 0);
                    setItemForm({
                      ...itemForm,
                      variants: updatedVars,
                      'Opening Stock': totalOp,
                      'Opening Amount': totalVal,
                    });
                  }}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all text-[11px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Variant Row
                </button>
              </div>

              {(!itemForm.variants || itemForm.variants.length === 0) ? (
                <div className="text-[11px] text-purple-800 italic bg-white/70 p-2 rounded-lg border border-purple-100">
                  No specific variant rows added yet. Click <strong>"+ Add Variant Row"</strong> to specify unique barcodes, opening stock, and custom rates for each size/color combination.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-purple-200 bg-white shadow-xs">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-purple-100/80 text-purple-900 font-bold border-b border-purple-200">
                      <tr>
                        <th className="py-1.5 px-2">Color</th>
                        <th className="py-1.5 px-2">Size</th>
                        <th className="py-1.5 px-2">Barcode</th>
                        <th className="py-1.5 px-2 text-center">Opening Qty</th>
                        <th className="py-1.5 px-2 text-right">Pur. Rate</th>
                        <th className="py-1.5 px-2 text-right">Sale Rate</th>
                        <th className="py-1.5 px-2 text-right">Wholesale Rate</th>
                        <th className="py-1.5 px-2 text-right">MRP</th>
                        <th className="py-1.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {itemForm.variants.map((v, vIdx) => (
                        <tr key={v.id || vIdx} className="hover:bg-purple-50/40">
                          <td className="p-1">
                            <input
                              type="text"
                              value={v.color}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                updated[vIdx] = { ...updated[vIdx], color: e.target.value };
                                setItemForm({ ...itemForm, variants: updated });
                              }}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              placeholder="Color"
                              className="w-full h-7 px-1.5 rounded border border-slate-300 font-medium text-[11px] outline-none focus:border-purple-500"
                              list={`q_colors_list_${vIdx}`}
                            />
                            <datalist id={`q_colors_list_${vIdx}`}>
                              {colorsList.map((c, cI) => <option key={cI} value={c} />)}
                            </datalist>
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={v.size}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                updated[vIdx] = { ...updated[vIdx], size: e.target.value };
                                setItemForm({ ...itemForm, variants: updated });
                              }}
                              onFocus={e => e.target.select()}
                              onClick={e => (e.target as HTMLInputElement).select()}
                              placeholder="Size"
                              className="w-full h-7 px-1.5 rounded border border-slate-300 font-medium text-[11px] outline-none focus:border-purple-500"
                              list={`q_sizes_list_${vIdx}`}
                            />
                            <datalist id={`q_sizes_list_${vIdx}`}>
                              {sizesList.map((s, sI) => <option key={sI} value={s} />)}
                            </datalist>
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={v.barcode}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                updated[vIdx] = { ...updated[vIdx], barcode: e.target.value };
                                setItemForm({ ...itemForm, variants: updated });
                              }}
                              onFocus={e => e.target.select()}
                              placeholder="Box / Custom Barcode"
                              className="w-full h-7 px-1.5 rounded border border-slate-300 font-mono text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              min="0"
                              value={v.openingStock || ''}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                const newOp = e.target.value === '' ? 0 : Number(e.target.value);
                                updated[vIdx] = { ...updated[vIdx], openingStock: newOp };
                                const totalOp = updated.reduce((sum, item) => sum + (Number(item.openingStock) || 0), 0);
                                const totalVal = updated.reduce((sum, item) => sum + ((Number(item.openingStock) || 0) * (Number(item.purchaseRate) || Number(itemForm['Purchase Rate']) || 0)), 0);
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                  'Opening Stock': totalOp,
                                  'Opening Amount': totalVal
                                });
                              }}
                              onFocus={e => e.target.select()}
                              className="w-16 h-7 px-1 rounded border border-slate-300 text-center font-bold text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              step="any"
                              value={v.purchaseRate || ''}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                const newPR = e.target.value === '' ? 0 : Number(e.target.value);
                                updated[vIdx] = { ...updated[vIdx], purchaseRate: newPR };
                                const totalVal = updated.reduce((sum, item) => sum + ((Number(item.openingStock) || 0) * (Number(item.purchaseRate) || Number(itemForm['Purchase Rate']) || 0)), 0);
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                  'Opening Amount': totalVal,
                                });
                              }}
                              onFocus={e => e.target.select()}
                              className="w-16 h-7 px-1 rounded border border-slate-300 text-right font-mono text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              step="any"
                              value={v.saleRate || ''}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                const newSR = e.target.value === '' ? 0 : Number(e.target.value);
                                updated[vIdx] = { ...updated[vIdx], saleRate: newSR };
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                });
                              }}
                              onFocus={e => e.target.select()}
                              className="w-16 h-7 px-1 rounded border border-slate-300 text-right font-mono font-bold text-indigo-900 text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              step="any"
                              value={v.wholesaleRate || ''}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                const newWR = e.target.value === '' ? 0 : Number(e.target.value);
                                updated[vIdx] = { ...updated[vIdx], wholesaleRate: newWR };
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                });
                              }}
                              onFocus={e => e.target.select()}
                              className="w-16 h-7 px-1 rounded border border-slate-300 text-right font-mono text-emerald-800 text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-right">
                            <input
                              type="number"
                              step="any"
                              value={v.mrp || ''}
                              onChange={e => {
                                const updated = [...(itemForm.variants || [])];
                                const newMRP = e.target.value === '' ? 0 : Number(e.target.value);
                                updated[vIdx] = { ...updated[vIdx], mrp: newMRP };
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                });
                              }}
                              onFocus={e => e.target.select()}
                              className="w-16 h-7 px-1 rounded border border-slate-300 text-right font-mono text-[11px] outline-none focus:border-purple-500"
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (itemForm.variants || []).filter((_, i) => i !== vIdx);
                                const totalOp = updated.reduce((sum, item) => sum + (Number(item.openingStock) || 0), 0);
                                const totalVal = updated.reduce((sum, item) => sum + ((Number(item.openingStock) || 0) * (Number(item.purchaseRate) || Number(itemForm['Purchase Rate']) || 0)), 0);
                                setItemForm({
                                  ...itemForm,
                                  variants: updated,
                                  'Opening Stock': updated.length > 0 ? totalOp : itemForm['Opening Stock'],
                                  'Opening Amount': updated.length > 0 ? totalVal : itemForm['Opening Amount']
                                });
                              }}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Remove Variant"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pharmacy Batch & Expiry Tracking Section */}
        {showPharmacyBatch && (
          <div className="space-y-2">
            <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 text-xs">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk_is_pharmacy"
                    checked={itemForm.isPharmacy === 'Y' || itemForm.maintainBatch === 'Y'}
                    onChange={e => {
                      const val = e.target.checked ? 'Y' : 'N';
                      setItemForm({ ...itemForm, isPharmacy: val, maintainBatch: val });
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="chk_is_pharmacy" className="font-bold text-emerald-950 cursor-pointer flex items-center gap-1.5">
                    💊 Maintain Pharmacy Batch & Expiry Date
                  </label>
                </div>

                {(itemForm.isPharmacy === 'Y' || itemForm.maintainBatch === 'Y') && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentBatches = itemForm.batches || [];
                      const newBatch: ItemBatch = {
                        id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        batchNo: `B-${currentBatches.length + 101}`,
                        expDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        barcode: itemForm.Barcode ? `${itemForm.Barcode}-B${currentBatches.length + 1}` : `${Math.floor(100000 + Math.random() * 900000)}`,
                        openingStock: 0,
                        currentStock: 0,
                        purchaseRate: Number(itemForm['Purchase Rate']) || 0,
                        saleRate: Number(itemForm['Sale Rate']) || 0,
                        wholesaleRate: Number((itemForm as any)['Wholesale Rate'] || (itemForm as any)['wholesaleRate'] || 0) || 0,
                        mrp: Number(itemForm.MRP) || 0
                      };
                      const updated = [...currentBatches, newBatch];
                      const totalOp = updated.reduce((sum, b) => sum + (Number(b.openingStock) || 0), 0);
                      setItemForm({
                        ...itemForm,
                        batches: updated,
                        'Opening Stock': updated.length > 0 ? totalOp : itemForm['Opening Stock']
                      });
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Batch Row
                  </button>
                )}
              </div>

              {(itemForm.isPharmacy === 'Y' || itemForm.maintainBatch === 'Y') && (
                <div className="overflow-x-auto pt-1">
                  {(itemForm.batches || []).length === 0 ? (
                    <p className="text-[11px] text-emerald-800 italic">No batches created yet. Click "Add Batch Row" to add initial stock batches with batch numbers and expiry dates.</p>
                  ) : (
                    <table className="w-full text-[11px] border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-emerald-100/70 text-emerald-900 font-bold border-b border-emerald-200">
                          <th className="p-1.5 text-left">Batch No *</th>
                          <th className="p-1.5 text-left">Expiry Date *</th>
                          <th className="p-1.5 text-left">Batch Barcode</th>
                          <th className="p-1.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(itemForm.batches || []).map((b, bIdx) => (
                          <tr key={b.id} className="border-b border-emerald-100 hover:bg-emerald-50">
                            <td className="p-1">
                              <input
                                type="text"
                                value={b.batchNo}
                                onChange={e => {
                                  const updated = [...(itemForm.batches || [])];
                                  updated[bIdx] = { ...updated[bIdx], batchNo: e.target.value };
                                  setItemForm({ ...itemForm, batches: updated });
                                }}
                                placeholder="Batch No"
                                className="w-full h-7 px-1.5 rounded border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="date"
                                value={b.expDate}
                                onChange={e => {
                                  const updated = [...(itemForm.batches || [])];
                                  updated[bIdx] = { ...updated[bIdx], expDate: e.target.value };
                                  setItemForm({ ...itemForm, batches: updated });
                                }}
                                className="w-full h-7 px-1.5 rounded border border-slate-300 font-mono outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="text"
                                value={b.barcode || ''}
                                onChange={e => {
                                  const updated = [...(itemForm.batches || [])];
                                  updated[bIdx] = { ...updated[bIdx], barcode: e.target.value };
                                  setItemForm({ ...itemForm, batches: updated });
                                }}
                                placeholder="Barcode"
                                className="w-full h-7 px-1.5 rounded border border-slate-300 font-mono text-[11px] outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (itemForm.batches || []).filter((_, i) => i !== bIdx);
                                  setItemForm({ ...itemForm, batches: updated });
                                }}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                                title="Delete Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
