import React, { useState, useEffect, useRef } from 'react';
import { MultiUnitEditor } from './MultiUnitEditor';
import { UnitMaster } from './masters/UnitMaster';
import {
  Config,
  Item,
  ItemGroup,
  Unit,
  UnitGroup,
  Ledger,
  LedgerGroup
} from '../types';
import {
  saveItem,
  deleteItem,
  saveItemGroup,
  saveUnit,
  saveUnitGroup,
  saveLedger,
  deleteLedger,
  saveLedgerGroup,
  saveItemCategory,
  getItemCategories,
  generateBarcode,
  generateMissingBarcodes
} from '../services/storageService';
import { Search, Plus, Edit2, Trash2, CheckCircle2, X, FolderPlus, Tag, KeyRound, Sparkles, Check, Save, Layers, Building2 } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { VoucherTypeManager } from './vouchers/VoucherTypeManager';
import { playSaveSound } from '../utils/audio';

interface MastersProps {
  config: Config;
  items: Item[];
  itemGroups: ItemGroup[];
  units: Unit[];
  unitGroups: UnitGroup[];
  categories?: string[];
  ledgers: Ledger[];
  ledgerGroups: LedgerGroup[];
  onDataRefresh: () => void;
  openItemModalCode?: string | null;
  openLedgerModalGroup?: string | null;
}

export const Masters: React.FC<MastersProps> = ({
  config,
  items,
  itemGroups,
  units,
  unitGroups,
  categories = [],
  ledgers,
  ledgerGroups,
  onDataRefresh,
  openItemModalCode,
  openLedgerModalGroup
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'ledgers' | 'vouchertypes' | 'itemgroups' | 'units' | 'unitgroups' | 'ledgergroups'>('items');
  const [tabHistory, setTabHistory] = useState<('items' | 'ledgers' | 'vouchertypes' | 'itemgroups' | 'units' | 'unitgroups' | 'ledgergroups')[]>(['items']);
  const [itemSearch, setItemSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  const switchTab = (tab: 'items' | 'ledgers' | 'vouchertypes' | 'itemgroups' | 'units' | 'unitgroups' | 'ledgergroups') => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setTabHistory(prev => (prev[prev.length - 1] === tab ? prev : [...prev, tab]));
  };

  const masterTabs = [
    { id: 'items', label: 'Items Master' },
    { id: 'ledgers', label: 'Ledgers Master' },
    { id: 'vouchertypes', label: 'Voucher Types' },
    { id: 'itemgroups', label: 'Item Groups' },
    { id: 'units', label: 'Units' },
    { id: 'unitgroups', label: 'Unit Groups' },
    { id: 'ledgergroups', label: 'Ledger Groups' }
  ] as const;

  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow key navigation between Masters tabs (ArrowLeft, ArrowRight, Home, End, Alt+Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // If user is inside an input modal or search input, only trigger when Alt is held
      if (isInputFocused && !e.altKey) {
        return;
      }

      const currentIndex = masterTabs.findIndex(t => t.id === activeTab);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowRight' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % masterTabs.length;
        switchTab(masterTabs[nextIndex].id as any);
        tabButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowLeft' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + masterTabs.length) % masterTabs.length;
        switchTab(masterTabs[prevIndex].id as any);
        tabButtonRefs.current[prevIndex]?.focus();
      } else if (e.key === 'Home' && !isInputFocused) {
        e.preventDefault();
        switchTab(masterTabs[0].id as any);
        tabButtonRefs.current[0]?.focus();
      } else if (e.key === 'End' && !isInputFocused) {
        e.preventDefault();
        switchTab(masterTabs[masterTabs.length - 1].id as any);
        tabButtonRefs.current[masterTabs.length - 1]?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Categories list state
  const [categoryList, setCategoryList] = useState<string[]>([]);

  useEffect(() => {
    const loaded = getItemCategories();
    // Merge prop categories and loaded categories without duplicates
    const combined = Array.from(new Set([...loaded, ...categories]));
    setCategoryList(combined);
  }, [categories]);

  // Quick Add Sub-Modals State
  const showCategory = String(config.EnableCategory) !== 'false';

  const [showQuickGroupModal, setShowQuickGroupModal] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState('');
  const [quickGroupParent, setQuickGroupParent] = useState('');

  const [showQuickUnitModal, setShowQuickUnitModal] = useState(false);
  const [quickUnitName, setQuickUnitName] = useState('');
  const [quickUnitSymbol, setQuickUnitSymbol] = useState('');

  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');

  const [showQuickLedgerGroupModal, setShowQuickLedgerGroupModal] = useState(false);
  const [quickLedgerGroupName, setQuickLedgerGroupName] = useState('');
  const [quickLedgerGroupParent, setQuickLedgerGroupParent] = useState('');
  const [quickLedgerGroupNature, setQuickLedgerGroupNature] = useState<'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital'>('Asset');

  // Auto trigger ledger or item modal if requested
  React.useEffect(() => {
    if (openLedgerModalGroup) {
      setActiveTab('ledgers');
      openNewLedger(openLedgerModalGroup);
    }
  }, [openLedgerModalGroup]);

  React.useEffect(() => {
    if (openItemModalCode) {
      setActiveTab('items');
      const found = items.find(i => i['Item Code'] === openItemModalCode);
      if (found) {
        openEditItem(found);
      } else {
        openNewItem();
      }
    }
  }, [openItemModalCode]);

  // Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemCode, setEditingItemCode] = useState<string | null>(null);
  const [showOpeningSerialModal, setShowOpeningSerialModal] = useState(false);
  const [itemForm, setItemSearchForm] = useState<Partial<Item>>({
    'Item Name': '',
    'Print Name': '',
    Barcode: '',
    Group: itemGroups[0]?.['Group Name'] || 'General Electronics',
    Category: '',
    Unit: units[0]?.['Unit Name'] || 'Pcs',
    'Purchase Rate': 0,
    'Sale Rate': 0,
    MRP: 0,
    'GST %': 5,
    'Zero Rated (Y/N)': 'N',
    'Is Serialized': 'N',
    'Opening Stock': 0,
    'Reorder Level': 0,
    'Opening Serials': ''
  });

  // Ledger Modal State
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [editingLedgerName, setEditingLedgerName] = useState<string | null>(null);
  const [ledgerForm, setLedgerForm] = useState<Partial<Ledger>>({
    'Ledger Name': '',
    Group: ledgerGroups[0]?.['Group Name'] || 'Sundry Debtors',
    'GST No': '',
    'TPN No': '',
    Address: '',
    'Contact No': '',
    Email: '',
    'Bank Name': '',
    Branch: '',
    'Account No': '',
    'Opening Balance': 0,
    'Balance Type (Dr/Cr)': 'Dr'
  });

  // Save State Tracking for Masters (Orange before save, Green for save notification)
  const [justSavedItem, setJustSavedItem] = useState(false);
  const [justSavedLedger, setJustSavedLedger] = useState(false);
  const [justSavedQuickGroup, setJustSavedQuickGroup] = useState(false);
  const [justSavedQuickCategory, setJustSavedQuickCategory] = useState(false);
  const [justSavedQuickUnit, setJustSavedQuickUnit] = useState(false);
  const [justSavedQuickLedgerGroup, setJustSavedQuickLedgerGroup] = useState(false);

  const handleMastersBack = () => {
    if (showOpeningSerialModal) {
      setShowOpeningSerialModal(false);
      return true;
    }
    if (showQuickGroupModal) {
      setShowQuickGroupModal(false);
      return true;
    }
    if (showQuickUnitModal) {
      setShowQuickUnitModal(false);
      return true;
    }
    if (showQuickCategoryModal) {
      setShowQuickCategoryModal(false);
      return true;
    }
    if (showQuickLedgerGroupModal) {
      setShowQuickLedgerGroupModal(false);
      return true;
    }
    if (showItemModal) {
      setShowItemModal(false);
      return true;
    }
    if (showLedgerModal) {
      setShowLedgerModal(false);
      return true;
    }
    if (itemSearch.trim()) {
      setItemSearch('');
      return true;
    }
    if (ledgerSearch.trim()) {
      setLedgerSearch('');
      return true;
    }
    if (tabHistory.length > 1) {
      const updated = [...tabHistory];
      updated.pop();
      const prevTab = updated[updated.length - 1] || 'items';
      setTabHistory(updated);
      setActiveTab(prevTab);
      return true;
    }
    if (activeTab !== 'items') {
      setActiveTab('items');
      setTabHistory(['items']);
      return true;
    }
    return false;
  };

  // Close active modals or step back on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const handled = handleMastersBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    showOpeningSerialModal,
    showQuickGroupModal,
    showQuickUnitModal,
    showQuickCategoryModal,
    showQuickLedgerGroupModal,
    showItemModal,
    showLedgerModal,
    itemSearch,
    ledgerSearch,
    activeTab,
    tabHistory
  ]);

  // Intercept app:back event from Header/App navigation
  useEffect(() => {
    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleMastersBack();
      if (handled) {
        e.preventDefault();
      }
    };
    window.addEventListener('app:back' as any, handleBackEvent);
    return () => window.removeEventListener('app:back' as any, handleBackEvent);
  }, [
    showOpeningSerialModal,
    showQuickGroupModal,
    showQuickUnitModal,
    showQuickCategoryModal,
    showQuickLedgerGroupModal,
    showItemModal,
    showLedgerModal,
    itemSearch,
    ledgerSearch,
    activeTab,
    tabHistory
  ]);

  const showGst = String(config.EnableGST) !== 'false';
  const showSerials = String(config.EnableSerials) === 'true';

  // Open New / Edit Item Modal
  const openNewItem = () => {
    setEditingItemCode(null);
    setItemSearchForm({
      'Item Name': '',
      'Print Name': '',
      Barcode: generateBarcode(),
      Group: itemGroups[0]?.['Group Name'] || 'General Electronics',
      Category: categoryList[0] || 'General',
      Unit: units[0]?.['Unit Name'] || 'Pcs',
      'Purchase Rate': 0,
      'Sale Rate': 0,
      MRP: 0,
      'GST %': Number(config.GSTRate) || 5,
      'Zero Rated (Y/N)': 'N',
      'Is Serialized': 'N',
      'Opening Stock': 0,
      'Reorder Level': 0,
      'Opening Serials': ''
    });
    setShowItemModal(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItemCode(item['Item Code']);
    setItemSearchForm({
      ...item,
      oldCode: item['Item Code'],
      'Is Serialized': item['Is Serialized'] || 'N',
      'Opening Serials': item['Opening Serials'] || ''
    });
    setShowItemModal(true);
  };

  const handleSaveItem = () => {
    if (!itemForm['Item Name']?.trim()) {
      alert('Item Name is required.');
      return;
    }

    const opStock = Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0));
    const isSerializedItem = showSerials && itemForm['Is Serialized'] === 'Y';

    // If serialized item with opening stock, ensure all serial numbers are entered
    if (isSerializedItem && opStock > 0) {
      const entered = (itemForm['Opening Serials'] || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (entered.length < opStock) {
        alert(`Serial number tracking is enabled for this item. Please enter all ${opStock} serial numbers for the opening stock.`);
        setShowOpeningSerialModal(true);
        return;
      }
    }

    const toSave: Item = {
      ...(itemForm as Item),
      'Is Serialized': isSerializedItem ? 'Y' : 'N',
      'Opening Serials': isSerializedItem && opStock > 0 ? itemForm['Opening Serials'] : ''
    };

    saveItem(toSave);
    playSaveSound();
    setJustSavedItem(true);
    onDataRefresh();
    setTimeout(() => {
      setJustSavedItem(false);
      setShowItemModal(false);
    }, 700);
  };

  const handleDeleteItem = (code: string) => {
    if (confirm('Delete this item?')) {
      deleteItem(code);
      onDataRefresh();
    }
  };

  // Open New / Edit Ledger Modal
  const openNewLedger = (grp?: string) => {
    const defaultGroup = grp || ledgerGroups[0]?.['Group Name'] || 'Sundry Debtors';
    const isParty = defaultGroup.toLowerCase().includes('debtor') || defaultGroup.toLowerCase().includes('customer') || defaultGroup.toLowerCase().includes('creditor') || defaultGroup.toLowerCase().includes('supplier');
    setEditingLedgerName(null);
    setLedgerForm({
      'Ledger Name': '',
      Group: defaultGroup,
      'GST Type': isParty ? 'Regular' : undefined,
      'GST Exempted': 'N',
      'GST No': '',
      'TPN No': '',
      Address: '',
      'Contact No': '',
      Email: '',
      'Bank Name': '',
      Branch: '',
      'Account No': '',
      'Opening Balance': 0,
      'Balance Type (Dr/Cr)': 'Dr'
    });
    setShowLedgerModal(true);
  };

  const openEditLedger = (l: Ledger) => {
    const isParty = (l.Group || '').toLowerCase().includes('debtor') || (l.Group || '').toLowerCase().includes('customer') || (l.Group || '').toLowerCase().includes('creditor') || (l.Group || '').toLowerCase().includes('supplier');
    const gstType = l['GST Type'] === 'Exempted' || l['GST Exempted'] === 'Y' ? 'Exempted' : 'Regular';
    setEditingLedgerName(l['Ledger Name']);
    setLedgerForm({
      ...l,
      'GST Type': isParty ? gstType : undefined,
      'GST Exempted': isParty && gstType === 'Exempted' ? 'Y' : 'N',
      oldName: l['Ledger Name']
    });
    setShowLedgerModal(true);
  };

  const handleSaveLedger = () => {
    if (!ledgerForm['Ledger Name']?.trim()) {
      alert('Ledger Name is required.');
      return;
    }
    const isParty = (ledgerForm.Group || '').toLowerCase().includes('debtor') || (ledgerForm.Group || '').toLowerCase().includes('customer') || (ledgerForm.Group || '').toLowerCase().includes('creditor') || (ledgerForm.Group || '').toLowerCase().includes('supplier');
    const toSave: Ledger = {
      ...(ledgerForm as Ledger),
      'GST Type': isParty ? (ledgerForm['GST Type'] || 'Regular') : undefined,
      'GST Exempted': isParty && ledgerForm['GST Type'] === 'Exempted' ? 'Y' : 'N'
    };
    saveLedger(toSave);
    playSaveSound();
    setJustSavedLedger(true);
    onDataRefresh();
    setTimeout(() => {
      setJustSavedLedger(false);
      setShowLedgerModal(false);
    }, 700);
  };

  const handleDeleteLedger = (name: string) => {
    if (confirm('Delete this ledger?')) {
      deleteLedger(name);
      onDataRefresh();
    }
  };

  // Quick Save Handlers
  const handleSaveQuickGroup = () => {
    const grpName = quickGroupName.trim();
    if (!grpName) {
      alert('Group Name is required.');
      return;
    }
    saveItemGroup({ 'Group Name': grpName, 'Parent Group': quickGroupParent.trim() });
    playSaveSound();
    setJustSavedQuickGroup(true);
    onDataRefresh();
    setItemSearchForm(prev => ({ ...prev, Group: grpName }));
    setQuickGroupName('');
    setQuickGroupParent('');
    setTimeout(() => {
      setJustSavedQuickGroup(false);
      setShowQuickGroupModal(false);
    }, 700);
  };

  const handleSaveQuickUnit = () => {
    const uName = quickUnitName.trim();
    if (!uName) {
      alert('Unit Name is required.');
      return;
    }
    const sym = quickUnitSymbol.trim() || uName.toLowerCase();
    saveUnit({ 'Unit Name': uName, Symbol: sym, Group: 'Count', 'Conversion Factor': 1 });
    playSaveSound();
    setJustSavedQuickUnit(true);
    onDataRefresh();
    setItemSearchForm(prev => ({ ...prev, Unit: uName }));
    setQuickUnitName('');
    setQuickUnitSymbol('');
    setTimeout(() => {
      setJustSavedQuickUnit(false);
      setShowQuickUnitModal(false);
    }, 700);
  };

  const handleSaveQuickCategory = () => {
    const cName = quickCategoryName.trim();
    if (!cName) {
      alert('Category Name is required.');
      return;
    }
    const res = saveItemCategory(cName);
    playSaveSound();
    setJustSavedQuickCategory(true);
    setCategoryList(res.categories);
    onDataRefresh();
    setItemSearchForm(prev => ({ ...prev, Category: cName }));
    setQuickCategoryName('');
    setTimeout(() => {
      setJustSavedQuickCategory(false);
      setShowQuickCategoryModal(false);
    }, 700);
  };

  const handleSaveQuickLedgerGroup = () => {
    const lgName = quickLedgerGroupName.trim();
    if (!lgName) {
      alert('Ledger Group Name is required.');
      return;
    }
    saveLedgerGroup({
      'Group Name': lgName,
      'Parent Group': quickLedgerGroupParent.trim(),
      Nature: quickLedgerGroupNature
    });
    playSaveSound();
    setJustSavedQuickLedgerGroup(true);
    onDataRefresh();
    setLedgerForm(prev => ({ ...prev, Group: lgName }));
    setQuickLedgerGroupName('');
    setQuickLedgerGroupParent('');
    setTimeout(() => {
      setJustSavedQuickLedgerGroup(false);
      setShowQuickLedgerGroupModal(false);
    }, 700);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Masters Directory</h1>
        <p className="text-xs text-slate-500 font-medium">Manage items, stock groups, units, and customer/supplier ledgers</p>
      </div>

      {/* Navigation Tabs with Arrow Keys */}
      <div 
        role="tablist"
        aria-label="Masters Directory Tabs"
        className="flex gap-2 rounded-2xl bg-slate-100 p-1.5 border border-slate-200 overflow-x-auto"
      >
        {masterTabs.map((t, idx) => (
          <button
            key={t.id}
            ref={el => (tabButtonRefs.current[idx] = el)}
            role="tab"
            aria-selected={activeTab === t.id}
            tabIndex={activeTab === t.id ? 0 : -1}
            onClick={() => switchTab(t.id as any)}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === t.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ITEMS MASTER */}
      {activeTab === 'items' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search items by name or barcode..."
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const res = generateMissingBarcodes();
                  if (res.count > 0) {
                    alert(`Successfully auto-generated 6-7 digit barcodes for ${res.count} product(s)!`);
                    onDataRefresh();
                  } else {
                    alert('All products already have barcodes assigned.');
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100"
                title="Auto-generate 6-7 digit barcodes for items without barcode"
              >
                ⚡ Generate Missing Barcodes
              </button>
              <button
                onClick={openNewItem}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                + New Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left">Code</th>
                  <th className="py-2.5 px-3 text-left">Barcode</th>
                  <th className="py-2.5 px-3 text-left">Item Name</th>
                  <th className="py-2.5 px-3 text-left">Group</th>
                  {showCategory && <th className="py-2.5 px-3 text-left">Category</th>}
                  <th className="py-2.5 px-3 text-right">Sale Rate</th>
                  {showGst && <th className="py-2.5 px-3 text-right">GST %</th>}
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items
                  .filter(i => !itemSearch || i['Item Name'].toLowerCase().includes(itemSearch.toLowerCase()) || i.Barcode.includes(itemSearch) || (i.Category && i.Category.toLowerCase().includes(itemSearch.toLowerCase())))
                  .map(item => (
                    <tr key={item['Item Code']} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-mono text-slate-500">{item['Item Code']}</td>
                      <td className="py-2 px-3 font-mono text-slate-800">{item.Barcode}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{item['Item Name']}</td>
                      <td className="py-2 px-3 text-slate-600">{item.Group}</td>
                      {showCategory && (
                        <td className="py-2 px-3 text-slate-600 font-medium">
                          {item.Category ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-indigo-100">
                              <Tag className="w-3 h-3 text-indigo-500" />
                              {item.Category}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right font-mono font-bold">{config.CurrencySymbol || 'Nu.'} {item['Sale Rate']}</td>
                      {showGst && <td className="py-2 px-3 text-right font-mono">{item['GST %']}%</td>}
                      <td className="py-2 px-3 text-right font-bold">
                        {item['Maintain Stock'] === 'N' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 font-semibold">
                            Non-Stock
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs ${item['Current Stock'] <= item['Reorder Level'] ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {item['Current Stock']}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => openEditItem(item)} className="p-1 text-slate-500 hover:text-indigo-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteItem(item['Item Code'])} className="p-1 text-slate-500 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEDGERS MASTER */}
      {activeTab === 'ledgers' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledgers..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none"
              />
            </div>
            <button
              onClick={() => openNewLedger()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              + New Ledger
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left">Ledger Name</th>
                  <th className="py-2.5 px-3 text-left">Group</th>
                  {showGst && <th className="py-2.5 px-3 text-left">GSTIN</th>}
                  <th className="py-2.5 px-3 text-right">Current Balance</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgers
                  .filter(l => !ledgerSearch || l['Ledger Name'].toLowerCase().includes(ledgerSearch.toLowerCase()))
                  .map(l => (
                    <tr key={l['Ledger Name']} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-3 font-bold text-slate-900">{l['Ledger Name']}</td>
                      <td className="py-2 px-3 text-slate-600">{l.Group}</td>
                      {showGst && <td className="py-2 px-3 font-mono text-slate-500">{l['GST No'] || '-'}</td>}
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={l['Current Balance'] >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {Math.abs(l['Current Balance']).toFixed(2)} {l['Current Balance'] >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => openEditLedger(l)} className="p-1 text-slate-500 hover:text-indigo-600">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteLedger(l['Ledger Name'])} className="p-1 text-slate-500 hover:text-rose-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VOUCHER TYPES MASTER */}
      {activeTab === 'vouchertypes' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <VoucherTypeManager onUpdated={onDataRefresh} />
        </div>
      )}

      {activeTab === 'units' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <UnitMaster units={units} onUpdated={onDataRefresh} />
        </div>
      )}

      {/* Item Groups, Unit Groups, Ledger Groups */}
      {['itemgroups', 'unitgroups', 'ledgergroups'].includes(activeTab) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">System pre-configured groups & units are loaded and active.</p>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 space-y-3">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-200 bg-white -mx-4 -mt-4 px-4 py-2.5 rounded-t-2xl">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItemCode ? 'Edit Item Master' : 'New Item Creation'}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer">
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
                  value={itemForm['Item Name'] || ''}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Item Name': e.target.value, 'Print Name': e.target.value })}
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
                    onClick={() => setItemSearchForm({ ...itemForm, Barcode: generateBarcode() })}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    ⚡ Auto
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Barcode / UPC"
                  value={itemForm.Barcode || ''}
                  onChange={e => setItemSearchForm({ ...itemForm, Barcode: e.target.value })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {/* Group */}
              <div className={showCategory ? "sm:col-span-2" : "sm:col-span-3"}>
                <label className="block font-semibold text-slate-700 mb-0.5">Group *</label>
                <div className="flex gap-1">
                  <select
                    value={itemForm.Group || ''}
                    onChange={e => setItemSearchForm({ ...itemForm, Group: e.target.value })}
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

              {/* Category (Optional) */}
              {showCategory && (
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-0.5">Category</label>
                  <div className="flex gap-1">
                    <select
                      value={itemForm.Category || ''}
                      onChange={e => setItemSearchForm({ ...itemForm, Category: e.target.value })}
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
              <div className={showCategory ? "sm:col-span-3" : "sm:col-span-2"}>
                <label className="block font-semibold text-slate-700 mb-0.5">Primary Unit *</label>
                <div className="flex gap-1">
                  <select
                    value={itemForm.Unit || ''}
                    onChange={e => setItemSearchForm({ ...itemForm, Unit: e.target.value })}
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
                  value={itemForm['Purchase Rate'] || 0}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Purchase Rate': Number(e.target.value) })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Sale Rate *</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Sale Rate'] || 0}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Sale Rate': Number(e.target.value) })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-indigo-900 text-xs outline-none focus:border-indigo-500 bg-indigo-50/20"
                />
              </div>

              {(config.EnableWholesalePrice !== 'false') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Wholesale Rate</label>
                  <input
                    type="number"
                    step="any"
                    value={itemForm['Wholesale Rate'] || 0}
                    onChange={e => setItemSearchForm({ ...itemForm, 'Wholesale Rate': Number(e.target.value) })}
                    className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-emerald-800 text-xs outline-none focus:border-emerald-500 bg-emerald-50/20"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">MRP</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm.MRP || 0}
                  onChange={e => setItemSearchForm({ ...itemForm, MRP: Number(e.target.value) })}
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
                      setItemSearchForm({
                        ...itemForm,
                        'GST %': Number(val),
                        'Zero Rated (Y/N)': val === '0' ? 'Y' : 'N'
                      });
                    }}
                    className="w-full h-8 rounded-lg border border-slate-300 px-1.5 font-medium text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="5">5% GST Taxable</option>
                    <option value="0">0% Zero-Rated</option>
                  </select>
                </div>
              )}
            </div>

            {/* Row 3: Stock & Inventory Options */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="font-semibold text-slate-700">Opening Stock</label>
                  {showSerials && itemForm['Is Serialized'] === 'Y' && (Math.max(0, Math.floor(Number(itemForm['Opening Stock']) || 0)) > 0) && (
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
                  value={itemForm['Opening Stock'] ?? 0}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Opening Stock': Number(e.target.value) || 0 })}
                  className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-0.5">Reorder Level</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Reorder Level'] || 0}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Reorder Level': Number(e.target.value) })}
                  className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="sm:col-span-6 flex flex-wrap gap-3 items-center pt-3 sm:pt-0">
                {/* Don't Maintain Stock Checkbox */}
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={itemForm['Maintain Stock'] === 'N'}
                    onChange={e => {
                      const dontMaintain = e.target.checked;
                      setItemSearchForm(prev => ({
                        ...prev,
                        'Maintain Stock': dontMaintain ? 'N' : 'Y',
                        'Opening Stock': dontMaintain ? 0 : (prev['Opening Stock'] || 0)
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
                        const currentSerials = (itemForm['Opening Serials'] || '').split(',').map(s => s.trim()).filter(Boolean);
                        setItemSearchForm(prev => ({
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
            {(config.EnableAltUnitPrice !== 'false') && (
              <MultiUnitEditor itemForm={itemForm} setItemForm={setItemSearchForm} units={units} showWholesalePrice={config.EnableWholesalePrice !== 'false'} />
            )}

            {/* Modal Action Footer */}
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 bg-white -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedItem}
                onClick={handleSaveItem}
                className={`px-5 py-1.5 text-xs font-bold text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  justSavedItem
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                }`}
              >
                {justSavedItem ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-100 animate-bounce" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 text-indigo-100" />
                    <span>{editingItemCode ? 'Update Item' : 'Save Item'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                setItemSearchForm(prev => ({
                  ...prev,
                  'Opening Serials': serials.join(', ')
                }));
                setShowOpeningSerialModal(false);
              }}
            />
          )}

      {/* Ledger Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingLedgerName ? 'Edit Ledger' : 'New Ledger Creation'}
              </h3>
              <button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Ledger Name *</label>
                <input
                  type="text"
                  value={ledgerForm['Ledger Name'] || ''}
                  onChange={e => setLedgerForm({ ...ledgerForm, 'Ledger Name': e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Group *</label>
                <div className="flex gap-1.5">
                  <select
                    value={ledgerForm.Group || ''}
                    onChange={e => setLedgerForm({ ...ledgerForm, Group: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none focus:border-indigo-500"
                  >
                    {ledgerGroups.length === 0 ? (
                      <option value="">No Groups - Click + to Add</option>
                    ) : (
                      ledgerGroups.map(g => (
                        <option key={g['Group Name']} value={g['Group Name']}>
                          {g['Group Name']}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickLedgerGroupModal(true)}
                    className="flex-shrink-0 h-9 w-9 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center font-bold shadow-xs transition"
                    title="Quick Add New Ledger Group"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {((ledgerForm.Group || '').toLowerCase().includes('bank')) && (
                <div className="space-y-2.5 p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 border-b border-blue-200/60 pb-1.5">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>Bank Account Details (Prints on Invoice)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={ledgerForm['Bank Name'] || ''}
                        onChange={e => setLedgerForm({ ...ledgerForm, 'Bank Name': e.target.value })}
                        placeholder="e.g. Bank of Bhutan"
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium bg-white outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
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
                    <label className="block font-semibold text-slate-700 mb-1 text-xs">Branch Name / Location</label>
                    <input
                      type="text"
                      value={ledgerForm.Branch || ''}
                      onChange={e => setLedgerForm({ ...ledgerForm, Branch: e.target.value })}
                      placeholder="e.g. Thimphu Main Branch"
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium bg-white outline-none focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>
              )}

              {((ledgerForm.Group || '').toLowerCase().includes('debtor') || 
                (ledgerForm.Group || '').toLowerCase().includes('customer') || 
                (ledgerForm.Group || '').toLowerCase().includes('creditor') || 
                (ledgerForm.Group || '').toLowerCase().includes('supplier')) && (
                <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {showGst && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          GST Registration Type <span className="text-indigo-600 font-bold">(Party)</span>
                        </label>
                        <select
                          value={ledgerForm['GST Type'] || (ledgerForm['GST Exempted'] === 'Y' ? 'Exempted' : 'Regular')}
                          onChange={e => {
                            const val = e.target.value;
                            setLedgerForm({
                              ...ledgerForm,
                              'GST Type': val as any,
                              'GST Exempted': val === 'Exempted' ? 'Y' : 'N'
                            });
                          }}
                          className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium bg-white outline-none focus:border-indigo-500"
                        >
                          <option value="Regular">Regular Taxpayer</option>
                          <option value="Exempted">GST Not Applicable</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                        <input
                          type="text"
                          value={ledgerForm['GST No'] || ''}
                          onChange={e => setLedgerForm({ ...ledgerForm, 'GST No': e.target.value })}
                          placeholder="e.g. 30BBBBB1111B1Z2"
                          className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono bg-white outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">TPN No</label>
                      <input
                        type="text"
                        value={ledgerForm['TPN No'] || ''}
                        onChange={e => setLedgerForm({ ...ledgerForm, 'TPN No': e.target.value })}
                        placeholder="Tax Payer Number"
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contact No / Phone</label>
                      <input
                        type="text"
                        value={ledgerForm['Contact No'] || ''}
                        onChange={e => setLedgerForm({ ...ledgerForm, 'Contact No': e.target.value })}
                        placeholder="Phone number"
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium bg-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Address <span className="text-xs text-indigo-600 font-medium">(Prints on Bill / Invoices)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={ledgerForm.Address || ''}
                      onChange={e => setLedgerForm({ ...ledgerForm, Address: e.target.value })}
                      placeholder="Street Address, City, Location details..."
                      className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium bg-white outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Opening Balance</label>
                <input
                  type="number"
                  step="any"
                  value={ledgerForm['Opening Balance'] || 0}
                  onChange={e => setLedgerForm({ ...ledgerForm, 'Opening Balance': Number(e.target.value) })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedLedger}
                onClick={handleSaveLedger}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  justSavedLedger
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {justSavedLedger ? (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 text-orange-100" />
                    <span>{editingLedgerName ? 'Update Ledger' : 'Save Ledger'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Item Group Sub-Modal */}
      {showQuickGroupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-600" />
                Quick Create Item Group
              </h4>
              <button onClick={() => setShowQuickGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Phones, Dairy Products"
                  value={quickGroupName}
                  onChange={e => setQuickGroupName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Parent Group (Optional)</label>
                <select
                  value={quickGroupParent}
                  onChange={e => setQuickGroupParent(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none"
                >
                  <option value="">-- None / Primary Group --</option>
                  {itemGroups.map(g => (
                    <option key={g['Group Name']} value={g['Group Name']}>
                      {g['Group Name']}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickGroupModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedQuickGroup}
                onClick={handleSaveQuickGroup}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  justSavedQuickGroup
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {justSavedQuickGroup ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 text-orange-100" />
                    <span>Create Group</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Category Sub-Modal */}
      {showQuickCategoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-600" />
                Quick Create Category
              </h4>
              <button onClick={() => setShowQuickCategoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Footwear, Beverages, Electrical"
                  value={quickCategoryName}
                  onChange={e => setQuickCategoryName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickCategoryModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedQuickCategory}
                onClick={handleSaveQuickCategory}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  justSavedQuickCategory
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {justSavedQuickCategory ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 text-orange-100" />
                    <span>Create Category</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Unit Sub-Modal */}
      {showQuickUnitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" />
                Quick Create Measurement Unit
              </h4>
              <button onClick={() => setShowQuickUnitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Unit Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Packet, Dozen, Meter, Bottle"
                  value={quickUnitName}
                  onChange={e => setQuickUnitName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. pkt, dzn, m, btl"
                  value={quickUnitSymbol}
                  onChange={e => setQuickUnitSymbol(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickUnitModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedQuickUnit}
                onClick={handleSaveQuickUnit}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  justSavedQuickUnit
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {justSavedQuickUnit ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 text-orange-100" />
                    <span>Create Unit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Ledger Group Sub-Modal */}
      {showQuickLedgerGroupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-600" />
                Quick Create Ledger Group
              </h4>
              <button onClick={() => setShowQuickLedgerGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Ledger Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mobile Vendors, Operating Expenses"
                  value={quickLedgerGroupName}
                  onChange={e => setQuickLedgerGroupName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Parent Group (Optional)</label>
                <select
                  value={quickLedgerGroupParent}
                  onChange={e => setQuickLedgerGroupParent(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none"
                >
                  <option value="">-- None / Primary Group --</option>
                  {ledgerGroups.map(g => (
                    <option key={g['Group Name']} value={g['Group Name']}>
                      {g['Group Name']}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Nature *</label>
                <select
                  value={quickLedgerGroupNature}
                  onChange={e => setQuickLedgerGroupNature(e.target.value as any)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none"
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
                onClick={() => setShowQuickLedgerGroupModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedQuickLedgerGroup}
                onClick={handleSaveQuickLedgerGroup}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  justSavedQuickLedgerGroup
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
                }`}
              >
                {justSavedQuickLedgerGroup ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 text-orange-100" />
                    <span>Create Ledger Group</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
