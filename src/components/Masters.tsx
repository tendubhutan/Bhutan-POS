import React, { useState, useEffect, useRef } from 'react';
import { MultiUnitEditor } from './MultiUnitEditor';
import { UnitMaster } from './masters/UnitMaster';
import { BranchMaster } from './masters/BranchMaster';
import { GodownMaster } from './masters/GodownMaster';
import { ImportItemsModal } from './ImportItemsModal';
import { MultiTagSelect } from './MultiTagSelect';
import {
  Config,
  Item,
  ItemVariant,
  ItemBatch,
  ItemGroup,
  Unit,
  UnitGroup,
  Ledger,
  LedgerGroup,
  BranchStockAllocation
} from '../types';
import {
  saveItem,
  deleteItem,
  saveItemGroup,
  deleteItemGroup,
  saveUnit,
  saveUnitGroup,
  deleteUnitGroup,
  saveLedger,
  deleteLedger,
  saveLedgerGroup,
  deleteLedgerGroup,
  saveItemCategory,
  getItemCategories,
  getRacks,
  saveRack,
  getCompatibilities,
  saveCompatibility,
  getSizes,
  saveSize,
  getColors,
  saveColor,
  generateBarcode,
  generateMissingBarcodes,
  getBranches,
  getGodowns
} from '../services/storageService';
import { Search, Plus, Edit2, Trash2, CheckCircle2, X, FolderPlus, Tag, KeyRound, Sparkles, Check, Save, Layers, Building2, Warehouse, ClipboardPaste, FileSpreadsheet, MapPin, Car, SlidersHorizontal, Palette, Shirt } from 'lucide-react';
import { SerialModal } from './SerialModal';
import { VoucherTypeManager } from './vouchers/VoucherTypeManager';
import { ExportStockExcelModal } from './ExportStockExcelModal';
import { playSaveSound } from '../utils/audio';
import { handleFormKeyDown, focusFirstFormInput } from '../utils/formKeyNavigation';

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
  initialTab?: 'items' | 'ledgers' | 'branches' | 'godowns' | 'vouchertypes' | 'itemgroups' | 'units' | 'unitgroups' | 'ledgergroups';
  isActive?: boolean;
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
  openLedgerModalGroup,
  initialTab,
  isActive = true
}) => {
  type MasterTabKey = 'items' | 'ledgers' | 'branches' | 'godowns' | 'vouchertypes' | 'itemgroups' | 'units' | 'unitgroups' | 'ledgergroups';
  const [activeTab, setActiveTab] = useState<MasterTabKey>(() => (initialTab as MasterTabKey) || 'items');
  const [tabHistory, setTabHistory] = useState<MasterTabKey[]>([initialTab || 'items']);
  const [itemSearch, setItemSearch] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const switchTab = (tab: MasterTabKey) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setTabHistory(prev => (prev[prev.length - 1] === tab ? prev : [...prev, tab]));
  };

  const masterTabs: { id: MasterTabKey; label: string }[] = [
    { id: 'items', label: 'Items Master' },
    { id: 'ledgers', label: 'Ledgers Master' },
    ...(config?.EnableMultiBranch === 'true' ? [{ id: 'branches' as MasterTabKey, label: '🏢 Branches (HO & Outstations)' }] : []),
    ...(config?.EnableMultiGodown === 'true' ? [{ id: 'godowns' as MasterTabKey, label: '🏭 Godowns / Storage' }] : []),
    { id: 'vouchertypes', label: 'Voucher Types' },
    { id: 'itemgroups', label: 'Item Groups' },
    { id: 'units', label: 'Units' },
    { id: 'unitgroups', label: 'Unit Groups' },
    { id: 'ledgergroups', label: 'Ledger Groups' }
  ];

  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow key navigation between Masters tabs (ArrowLeft, ArrowRight, Home, End, Alt+Arrows)
  useEffect(() => {
    if (!isActive) return;

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
  }, [isActive, activeTab]);

  // Categories list state
  const [categoryList, setCategoryList] = useState<string[]>([]);

  useEffect(() => {
    const loaded = getItemCategories();
    // Merge prop categories and loaded categories without duplicates
    const combined = Array.from(new Set([...loaded, ...categories]));
    setCategoryList(combined);
  }, [categories]);

  // Quick Add Sub-Modals & Group Management State
  const showCategory = String(config.EnableCategory) !== 'false';

  const [itemGroupSearch, setItemGroupSearch] = useState('');
  const [unitGroupSearch, setUnitGroupSearch] = useState('');
  const [ledgerGroupSearch, setLedgerGroupSearch] = useState('');

  const [showQuickGroupModal, setShowQuickGroupModal] = useState(false);
  const [quickGroupName, setQuickGroupName] = useState('');
  const [quickGroupParent, setQuickGroupParent] = useState('');
  const [editingItemGroupOldName, setEditingItemGroupOldName] = useState<string | null>(null);

  const [showQuickUnitModal, setShowQuickUnitModal] = useState(false);
  const [quickUnitName, setQuickUnitName] = useState('');
  const [quickUnitSymbol, setQuickUnitSymbol] = useState('');

  const [showQuickUnitGroupModal, setShowQuickUnitGroupModal] = useState(false);
  const [quickUnitGroupName, setQuickUnitGroupName] = useState('');
  const [quickUnitGroupPrimaryUnit, setQuickUnitGroupPrimaryUnit] = useState('');
  const [editingUnitGroupOldName, setEditingUnitGroupOldName] = useState<string | null>(null);

  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');

  const [showQuickLedgerGroupModal, setShowQuickLedgerGroupModal] = useState(false);
  const [quickLedgerGroupName, setQuickLedgerGroupName] = useState('');
  const [quickLedgerGroupParent, setQuickLedgerGroupParent] = useState('');
  const [quickLedgerGroupNature, setQuickLedgerGroupNature] = useState<'Asset' | 'Liability' | 'Income' | 'Expense' | 'Capital'>('Asset');
  const [editingLedgerGroupOldName, setEditingLedgerGroupOldName] = useState<string | null>(null);

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
  const [showBranchAllocModal, setShowBranchAllocModal] = useState(false);
  const [racksList, setRacksList] = useState<string[]>(getRacks());
  const [compatibilitiesList, setCompatibilitiesList] = useState<string[]>(getCompatibilities());
  const [sizesList, setSizesList] = useState<string[]>(getSizes());
  const [colorsList, setColorsList] = useState<string[]>(getColors());

  // Floating Column Visibility Filter State for Items Master
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    code: true,
    barcode: true,
    partNumber: true,
    itemName: true,
    group: true,
    category: true,
    rackBin: true,
    compatibility: true,
    size: true,
    color: true,
    saleRate: true,
    gst: true,
    stock: true,
    actions: true
  });
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const columnFilterRef = useRef<HTMLDivElement>(null);

  // Close floating column filter on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnFilterRef.current && !columnFilterRef.current.contains(e.target as Node)) {
        setShowColumnFilter(false);
      }
    };
    if (showColumnFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnFilter]);
  const [itemForm, setItemSearchForm] = useState<Partial<Item>>({
    'Item Name': '',
    'Print Name': '',
    Barcode: '',
    Group: itemGroups[0]?.['Group Name'] || 'General Electronics',
    Category: '',
    Unit: units[0]?.['Unit Name'] || 'Pcs',
    'Purchase Rate': '' as any,
    'Sale Rate': '' as any,
    MRP: '' as any,
    'GST %': 5,
    'Zero Rated (Y/N)': 'N',
    'Is Serialized': 'N',
    'Opening Stock': '' as any,
    'Reorder Level': '' as any,
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
    'Opening Balance': '' as any,
    'Balance Type (Dr/Cr)': 'Dr'
  });

  // Save State Tracking for Masters (Orange before save, Green for save notification)
  const [justSavedItem, setJustSavedItem] = useState(false);
  const [justSavedLedger, setJustSavedLedger] = useState(false);
  const [justSavedQuickGroup, setJustSavedQuickGroup] = useState(false);
  const [justSavedQuickCategory, setJustSavedQuickCategory] = useState(false);
  const [justSavedQuickUnit, setJustSavedQuickUnit] = useState(false);
  const [justSavedQuickUnitGroup, setJustSavedQuickUnitGroup] = useState(false);
  const [justSavedQuickLedgerGroup, setJustSavedQuickLedgerGroup] = useState(false);

  // Modal Container Refs for Auto-Focus & Keyboard Traversal
  const itemModalRef = useRef<HTMLDivElement>(null);
  const ledgerModalRef = useRef<HTMLDivElement>(null);
  const quickGroupModalRef = useRef<HTMLDivElement>(null);
  const quickCategoryModalRef = useRef<HTMLDivElement>(null);
  const quickUnitModalRef = useRef<HTMLDivElement>(null);
  const quickUnitGroupModalRef = useRef<HTMLDivElement>(null);
  const quickLedgerGroupModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showItemModal) focusFirstFormInput(itemModalRef.current);
  }, [showItemModal]);

  useEffect(() => {
    if (showLedgerModal) focusFirstFormInput(ledgerModalRef.current);
  }, [showLedgerModal]);

  useEffect(() => {
    if (showQuickGroupModal) focusFirstFormInput(quickGroupModalRef.current);
  }, [showQuickGroupModal]);

  useEffect(() => {
    if (showQuickCategoryModal) focusFirstFormInput(quickCategoryModalRef.current);
  }, [showQuickCategoryModal]);

  useEffect(() => {
    if (showQuickUnitModal) focusFirstFormInput(quickUnitModalRef.current);
  }, [showQuickUnitModal]);

  useEffect(() => {
    if (showQuickLedgerGroupModal) focusFirstFormInput(quickLedgerGroupModalRef.current);
  }, [showQuickLedgerGroupModal]);

  const handleMastersBack = () => {
    if (showStockExportModal) {
      setShowStockExportModal(false);
      return true;
    }
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

  // Close active modals or step back on Escape key / Save on F2
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        triggerMasterSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isActive,
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
    tabHistory,
    itemForm,
    ledgerForm,
    quickGroupName,
    quickUnitName,
    quickCategoryName,
    quickLedgerGroupName
  ]);

  const triggerMasterSave = () => {
    if (showQuickGroupModal) handleSaveQuickGroup();
    else if (showQuickUnitModal) handleSaveQuickUnit();
    else if (showQuickCategoryModal) handleSaveQuickCategory();
    else if (showQuickLedgerGroupModal) handleSaveQuickLedgerGroup();
    else if (showItemModal) handleSaveItem();
    else if (showLedgerModal) handleSaveLedger();
  };

  // Intercept app:back and app:save events from Header/App navigation
  useEffect(() => {
    if (!isActive) return;

    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleMastersBack();
      if (handled) {
        e.preventDefault();
      }
    };
    const handleSaveEvent = (e: CustomEvent) => {
      triggerMasterSave();
      e.preventDefault();
    };
    window.addEventListener('app:back' as any, handleBackEvent);
    window.addEventListener('app:save' as any, handleSaveEvent);
    return () => {
      window.removeEventListener('app:back' as any, handleBackEvent);
      window.removeEventListener('app:save' as any, handleSaveEvent);
    };
  }, [
    isActive,
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
    tabHistory,
    itemForm,
    ledgerForm,
    quickGroupName,
    quickUnitName,
    quickCategoryName,
    quickLedgerGroupName
  ]);

  const showGst = String(config.EnableGST) !== 'false';
  const showSerials = String(config.EnableSerials) === 'true';
  const showPharmacyBatch = String(config.EnablePharmacyBatch) !== 'false';

  const [showImportModal, setShowImportModal] = useState(false);
  const [showStockExportModal, setShowStockExportModal] = useState(false);

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
      'Purchase Rate': '' as any,
      'Sale Rate': '' as any,
      MRP: '' as any,
      'GST %': Number(config.GSTRate) || 5,
      'Zero Rated (Y/N)': 'N',
      'Is Serialized': 'N',
      'Opening Stock': '' as any,
      'Reorder Level': '' as any,
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

    const purRate = Number(itemForm['Purchase Rate']) || 0;
    const saleRate = Number(itemForm['Sale Rate']) || 0;
    const wholesaleRate = Number((itemForm as any)['Wholesale Rate'] || (itemForm as any)['wholesaleRate'] || 0) || 0;
    const mrp = Number(itemForm.MRP) || 0;

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

    const toSave: Item = {
      ...(itemForm as Item),
      batches: finalBatches,
      'Is Serialized': isSerializedItem ? 'Y' : 'N',
      'Opening Serials': isSerializedItem && opStock > 0 ? itemForm['Opening Serials'] : ''
    };

    const res = saveItem(toSave);
    if (!res.ok) {
      alert(res.error || 'Failed to save item.');
      return;
    }

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
      const res = deleteItem(code);
      if (!res.ok) {
        alert(res.error || 'Cannot delete item.');
        return;
      }
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
      'Opening Balance': '' as any,
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
    const res = saveLedger(toSave);
    if (!res.ok) {
      alert(res.error || 'Failed to save ledger.');
      return;
    }
    playSaveSound();
    setJustSavedLedger(true);
    onDataRefresh();
    setTimeout(() => {
      setJustSavedLedger(false);
      setShowLedgerModal(false);
    }, 700);
  };

  const handleDeleteLedger = (name: string) => {
    if (confirm(`Delete ledger "${name}"?`)) {
      const res = deleteLedger(name);
      if (!res.ok) {
        alert(res.error || 'Cannot delete ledger.');
        return;
      }
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
    const res = saveItemGroup({
      'Group Name': grpName,
      'Parent Group': quickGroupParent.trim(),
      oldName: editingItemGroupOldName || undefined
    });
    if (!res.ok) {
      alert(res.error || 'Failed to save group.');
      return;
    }
    playSaveSound();
    setJustSavedQuickGroup(true);
    onDataRefresh();
    setItemSearchForm(prev => ({ ...prev, Group: grpName }));
    setQuickGroupName('');
    setQuickGroupParent('');
    setEditingItemGroupOldName(null);
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
    const res = saveUnit({ 'Unit Name': uName, Symbol: sym, Group: 'Count', 'Conversion Factor': 1 });
    if (!res.ok) {
      alert(res.error || 'Failed to create unit.');
      return;
    }
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

  const handleSaveQuickUnitGroup = () => {
    const ugName = quickUnitGroupName.trim();
    if (!ugName) {
      alert('Unit Group Name is required.');
      return;
    }
    const res = saveUnitGroup({
      'Group Name': ugName,
      'Primary Unit': quickUnitGroupPrimaryUnit.trim(),
      oldName: editingUnitGroupOldName || undefined
    });
    if (!res.ok) {
      alert(res.error || 'Failed to save unit group.');
      return;
    }
    playSaveSound();
    setJustSavedQuickUnitGroup(true);
    onDataRefresh();
    setQuickUnitGroupName('');
    setQuickUnitGroupPrimaryUnit('');
    setEditingUnitGroupOldName(null);
    setTimeout(() => {
      setJustSavedQuickUnitGroup(false);
      setShowQuickUnitGroupModal(false);
    }, 700);
  };

  const handleSaveQuickCategory = () => {
    const cName = quickCategoryName.trim();
    if (!cName) {
      alert('Category Name is required.');
      return;
    }
    const res = saveItemCategory(cName);
    if (!res.ok) {
      alert(res.error || 'Failed to create category.');
      return;
    }
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
    const res = saveLedgerGroup({
      'Group Name': lgName,
      'Parent Group': quickLedgerGroupParent.trim(),
      Nature: quickLedgerGroupNature,
      oldName: editingLedgerGroupOldName || undefined
    });
    if (!res.ok) {
      alert(res.error || 'Failed to save ledger group.');
      return;
    }
    playSaveSound();
    setJustSavedQuickLedgerGroup(true);
    onDataRefresh();
    setLedgerForm(prev => ({ ...prev, Group: lgName }));
    setQuickLedgerGroupName('');
    setQuickLedgerGroupParent('');
    setEditingLedgerGroupOldName(null);
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
            <div className="flex items-center gap-2 flex-wrap">
              {/* Floating Column Visibility Filter Button & Menu */}
              <div className="relative" ref={columnFilterRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnFilter(!showColumnFilter)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold shadow-xs transition cursor-pointer ${
                    showColumnFilter
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Filter column headers to show/hide"
                >
                  <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                  <span>Headers ({Object.values(visibleColumns).filter(Boolean).length})</span>
                </button>

                {showColumnFilter && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                        Header Column Filter
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowColumnFilter(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      {[
                        { id: 'code', label: 'Item Code' },
                        { id: 'barcode', label: 'Barcode' },
                        ...(config.EnableSpareParts === 'true' ? [{ id: 'partNumber', label: 'Part No. / OEM' }] : []),
                        { id: 'itemName', label: 'Item Name' },
                        { id: 'group', label: 'Group' },
                        ...(showCategory ? [{ id: 'category', label: 'Category' }] : []),
                        ...(config.EnableSpareParts === 'true' && config.EnableRackBin !== 'false' ? [{ id: 'rackBin', label: 'Rack / Bin Location' }] : []),
                        ...(config.EnableSpareParts === 'true' && config.EnableCompatibility !== 'false' ? [{ id: 'compatibility', label: 'Vehicle Compatibility' }] : []),
                        ...(config.EnableGarmentsAndFootwear === 'true' && config.EnableSize !== 'false' ? [{ id: 'size', label: 'Size' }] : []),
                        ...(config.EnableGarmentsAndFootwear === 'true' && config.EnableColor !== 'false' ? [{ id: 'color', label: 'Color' }] : []),
                        { id: 'saleRate', label: 'Sale Rate' },
                        ...(showGst ? [{ id: 'gst', label: 'GST %' }] : []),
                        { id: 'stock', label: 'Current Stock' },
                        { id: 'actions', label: 'Action Buttons' }
                      ].map(col => (
                        <label
                          key={col.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none"
                        >
                          <span>{col.label}</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.id] !== false}
                            onChange={e => {
                              setVisibleColumns(prev => ({ ...prev, [col.id]: e.target.checked }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setVisibleColumns({
                            code: true,
                            barcode: true,
                            partNumber: true,
                            itemName: true,
                            group: true,
                            category: true,
                            rackBin: true,
                            compatibility: true,
                            saleRate: true,
                            gst: true,
                            stock: true,
                            actions: true
                          });
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      >
                        Reset / Show All
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowColumnFilter(false)}
                        className="px-3 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
                onClick={() => setShowStockExportModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-100 transition cursor-pointer"
                title="Export complete stock report or selected fields to Excel"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export Stock (Excel)
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <ClipboardPaste className="h-4 w-4" />
                Import Items
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

          <div className="overflow-auto max-h-[calc(100vh-230px)] rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  {visibleColumns.code !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Code</th>}
                  {visibleColumns.barcode !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Barcode</th>}
                  {config.EnableSpareParts === 'true' && visibleColumns.partNumber !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Part No. / OEM</th>}
                  {visibleColumns.itemName !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Item Name</th>}
                  {visibleColumns.group !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Group</th>}
                  {showCategory && visibleColumns.category !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Category</th>}
                  {config.EnableSpareParts === 'true' && config.EnableRackBin !== 'false' && visibleColumns.rackBin !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Rack / Bin</th>}
                  {config.EnableSpareParts === 'true' && config.EnableCompatibility !== 'false' && visibleColumns.compatibility !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Compatibility</th>}
                  {config.EnableGarmentsAndFootwear === 'true' && config.EnableSize !== 'false' && visibleColumns.size !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Size</th>}
                  {config.EnableGarmentsAndFootwear === 'true' && config.EnableColor !== 'false' && visibleColumns.color !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Color</th>}
                  {visibleColumns.saleRate !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-right whitespace-nowrap">Sale Rate</th>}
                  {showGst && visibleColumns.gst !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-right whitespace-nowrap">GST %</th>}
                  {visibleColumns.stock !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-right whitespace-nowrap">Current Stock</th>}
                  {visibleColumns.actions !== false && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items
                  .filter(i => !itemSearch || i['Item Name'].toLowerCase().includes(itemSearch.toLowerCase()) || i.Barcode.includes(itemSearch) || (i.Category && i.Category.toLowerCase().includes(itemSearch.toLowerCase())))
                  .map(item => (
                    <tr key={item['Item Code']} className="hover:bg-slate-50 transition">
                      {visibleColumns.code !== false && <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{item['Item Code']}</td>}
                      {visibleColumns.barcode !== false && <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap">{item.Barcode}</td>}
                      {config.EnableSpareParts === 'true' && visibleColumns.partNumber !== false && (
                        <td className="py-2 px-3 font-mono font-bold text-blue-800 whitespace-nowrap">
                          {item.partNumber || <span className="text-slate-400 font-normal italic">-</span>}
                        </td>
                      )}
                      {visibleColumns.itemName !== false && <td className="py-2 px-3 font-bold text-slate-900">{item['Item Name']}</td>}
                      {visibleColumns.group !== false && <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{item.Group}</td>}
                      {showCategory && visibleColumns.category !== false && (
                        <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">
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
                      {config.EnableSpareParts === 'true' && config.EnableRackBin !== 'false' && visibleColumns.rackBin !== false && (
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {item.rackLocation ? (
                            <div className="flex flex-wrap gap-1 min-w-[130px]">
                              {item.rackLocation.split(/[,/;|]+/).map(r => r.trim()).filter(Boolean).map((rack, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                  <MapPin className="h-3 w-3 text-amber-700 shrink-0" />
                                  {rack}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      )}
                      {config.EnableSpareParts === 'true' && config.EnableCompatibility !== 'false' && visibleColumns.compatibility !== false && (
                        <td className="py-2 px-3 text-slate-600">
                          {item.compatibility ? (
                            <div className="flex flex-wrap gap-1 min-w-[150px]">
                              {item.compatibility.split(/[,/;|]+/).map(c => c.trim()).filter(Boolean).map((compat, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                  <Car className="h-3 w-3 text-indigo-600 shrink-0" />
                                  {compat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      )}
                      {config.EnableGarmentsAndFootwear === 'true' && config.EnableSize !== 'false' && visibleColumns.size !== false && (
                        <td className="py-2 px-3 text-purple-900">
                          {item.size ? (
                            <div className="flex flex-wrap gap-1 min-w-[100px]">
                              {item.size.split(/[,/;|]+/).map(s => s.trim()).filter(Boolean).map((sz, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                  <Tag className="h-3 w-3 text-purple-700 shrink-0" />
                                  {sz}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      )}
                      {config.EnableGarmentsAndFootwear === 'true' && config.EnableColor !== 'false' && visibleColumns.color !== false && (
                        <td className="py-2 px-3 text-pink-900">
                          {item.color ? (
                            <div className="flex flex-wrap gap-1 min-w-[100px]">
                              {item.color.split(/[,/;|]+/).map(c => c.trim()).filter(Boolean).map((col, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-pink-100 text-pink-900 border border-pink-300 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                  <Palette className="h-3 w-3 text-pink-700 shrink-0" />
                                  {col}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.saleRate !== false && <td className="py-2 px-3 text-right font-mono font-bold">{config.CurrencySymbol || 'Nu.'} {item['Sale Rate']}</td>}
                      {showGst && visibleColumns.gst !== false && <td className="py-2 px-3 text-right font-mono">{item['GST %']}%</td>}
                      {visibleColumns.stock !== false && (
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
                      )}
                      {visibleColumns.actions !== false && (
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
                      )}
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

          <div className="overflow-auto max-h-[calc(100vh-230px)] rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Ledger Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Group</th>
                  {showGst && <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">GSTIN</th>}
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-right whitespace-nowrap">Current Balance</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
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

      {/* BRANCHES MASTER */}
      {activeTab === 'branches' && config?.EnableMultiBranch === 'true' && (
        <BranchMaster config={config} onUpdated={onDataRefresh} />
      )}

      {/* GODOWNS MASTER */}
      {activeTab === 'godowns' && config?.EnableMultiGodown === 'true' && (
        <GodownMaster config={config} onUpdated={onDataRefresh} />
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

      {/* ITEM GROUPS MASTER */}
      {activeTab === 'itemgroups' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search item groups & sub-groups..."
                value={itemGroupSearch}
                onChange={e => setItemGroupSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none"
              />
            </div>
            <button
              onClick={() => {
                setEditingItemGroupOldName(null);
                setQuickGroupName('');
                setQuickGroupParent('');
                setShowQuickGroupModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              + New Item Group / Sub-Group
            </button>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-230px)] rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Group Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Parent Group</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Items Count</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-medium">No item groups created yet.</td>
                  </tr>
                ) : (
                  itemGroups
                    .filter(g => !itemGroupSearch || g['Group Name'].toLowerCase().includes(itemGroupSearch.toLowerCase()) || (g['Parent Group'] && g['Parent Group'].toLowerCase().includes(itemGroupSearch.toLowerCase())))
                    .map(g => {
                      const count = items.filter(i => i.Group === g['Group Name']).length;
                      return (
                        <tr key={g['Group Name']} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{g['Group Name']}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {g['Parent Group'] ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md text-[11px] font-bold border border-amber-200/60">
                                {g['Parent Group']}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">Primary</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                              {count} item{count !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItemGroupOldName(g['Group Name']);
                                  setQuickGroupName(g['Group Name']);
                                  setQuickGroupParent(g['Parent Group'] || '');
                                  setShowQuickGroupModal(true);
                                }}
                                className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer"
                                title="Edit Item Group"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete Item Group "${g['Group Name']}"?`)) {
                                    deleteItemGroup(g['Group Name']);
                                    onDataRefresh();
                                  }
                                }}
                                className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                                title="Delete Item Group"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UNIT GROUPS MASTER */}
      {activeTab === 'unitgroups' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search unit groups..."
                value={unitGroupSearch}
                onChange={e => setUnitGroupSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none"
              />
            </div>
            <button
              onClick={() => {
                setEditingUnitGroupOldName(null);
                setQuickUnitGroupName('');
                setQuickUnitGroupPrimaryUnit(units[0]?.['Unit Name'] || 'Pcs');
                setShowQuickUnitGroupModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <Layers className="h-4 w-4" />
              + New Unit Group
            </button>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-230px)] rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Unit Group Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Primary Unit</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 font-medium">No unit groups created yet.</td>
                  </tr>
                ) : (
                  unitGroups
                    .filter(ug => !unitGroupSearch || ug['Group Name']?.toLowerCase().includes(unitGroupSearch.toLowerCase()))
                    .map(ug => (
                      <tr key={ug['Group Name']} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{ug['Group Name']}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-semibold">{ug['Primary Unit'] || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingUnitGroupOldName(ug['Group Name']);
                                setQuickUnitGroupName(ug['Group Name']);
                                setQuickUnitGroupPrimaryUnit(ug['Primary Unit'] || '');
                                setShowQuickUnitGroupModal(true);
                              }}
                              className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer"
                              title="Edit Unit Group"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete Unit Group "${ug['Group Name']}"?`)) {
                                  deleteUnitGroup(ug['Group Name']);
                                  onDataRefresh();
                                }
                              }}
                              className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                              title="Delete Unit Group"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEDGER GROUPS MASTER */}
      {activeTab === 'ledgergroups' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger groups & sub-groups..."
                value={ledgerGroupSearch}
                onChange={e => setLedgerGroupSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-medium outline-none"
              />
            </div>
            <button
              onClick={() => {
                setEditingLedgerGroupOldName(null);
                setQuickLedgerGroupName('');
                setQuickLedgerGroupParent('Current Assets');
                setQuickLedgerGroupNature('Asset');
                setShowQuickLedgerGroupModal(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
            >
              <FolderPlus className="h-4 w-4" />
              + New Ledger Group / Sub-Group
            </button>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-230px)] rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-2xs border-b border-slate-200">
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Group Name</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Parent Group</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-left whitespace-nowrap">Nature</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Ledgers Count</th>
                  <th className="sticky top-0 z-20 bg-slate-100 py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">No ledger groups created yet.</td>
                  </tr>
                ) : (
                  ledgerGroups
                    .filter(lg => !ledgerGroupSearch || lg['Group Name'].toLowerCase().includes(ledgerGroupSearch.toLowerCase()) || (lg['Parent Group'] && lg['Parent Group'].toLowerCase().includes(ledgerGroupSearch.toLowerCase())))
                    .map(lg => {
                      const count = ledgers.filter(l => l.Group === lg['Group Name']).length;
                      const natureColors: Record<string, string> = {
                        Asset: 'bg-blue-50 text-blue-700 border-blue-200',
                        Liability: 'bg-purple-50 text-purple-700 border-purple-200',
                        Income: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        Expense: 'bg-rose-50 text-rose-700 border-rose-200',
                        Capital: 'bg-amber-50 text-amber-700 border-amber-200'
                      };
                      return (
                        <tr key={lg['Group Name']} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{lg['Group Name']}</td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {lg['Parent Group'] ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md text-[11px] font-bold border border-amber-200/60">
                                {lg['Parent Group']}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">Primary</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-md border ${natureColors[lg.Nature || 'Asset'] || 'bg-slate-100 text-slate-700'}`}>
                              {lg.Nature || 'Asset'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
                              {count} ledger{count !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingLedgerGroupOldName(lg['Group Name']);
                                  setQuickLedgerGroupName(lg['Group Name']);
                                  setQuickLedgerGroupParent(lg['Parent Group'] || '');
                                  setQuickLedgerGroupNature(lg.Nature || 'Asset');
                                  setShowQuickLedgerGroupModal(true);
                                }}
                                className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer"
                                title="Edit Ledger Group"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete Ledger Group "${lg['Group Name']}"?`)) {
                                    deleteLedgerGroup(lg['Group Name']);
                                    onDataRefresh();
                                  }
                                }}
                                className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                                title="Delete Ledger Group"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div 
          ref={itemModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, itemModalRef.current, handleSaveItem, () => setShowItemModal(false))}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3"
        >
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

            {/* Spare Parts Additional Fields (if enabled) */}
            {config.EnableSpareParts === 'true' && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-0.5">Part Number / OEM No.</label>
                  <input
                    type="text"
                    value={itemForm.partNumber || ''}
                    onChange={e => setItemSearchForm({ ...itemForm, partNumber: e.target.value })}
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-xs outline-none focus:border-indigo-500 bg-white"
                    placeholder="e.g. 13780-61M00 / OEM-492"
                  />
                </div>
                {config.EnableRackBin !== 'false' && (
                  <div className="sm:col-span-3">
                    <MultiTagSelect
                      label="Rack / Bin Location(s)"
                      value={itemForm.rackLocation || ''}
                      onChange={val => setItemSearchForm({ ...itemForm, rackLocation: val })}
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
                      onChange={val => setItemSearchForm({ ...itemForm, compatibility: val })}
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
                <div className="bg-purple-50/80 p-2.5 rounded-xl border border-purple-200 text-xs">
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
                        
                        setItemSearchForm({
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
                                    setItemSearchForm({ ...itemForm, variants: updated });
                                  }}
                                  onFocus={e => e.target.select()}
                                  onClick={e => (e.target as HTMLInputElement).select()}
                                  placeholder="Color"
                                  className="w-full h-7 px-1.5 rounded border border-slate-300 font-medium text-[11px] outline-none focus:border-purple-500"
                                  list={`colors_list_${vIdx}`}
                                />
                                <datalist id={`colors_list_${vIdx}`}>
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
                                    setItemSearchForm({ ...itemForm, variants: updated });
                                  }}
                                  onFocus={e => e.target.select()}
                                  onClick={e => (e.target as HTMLInputElement).select()}
                                  placeholder="Size"
                                  className="w-full h-7 px-1.5 rounded border border-slate-300 font-medium text-[11px] outline-none focus:border-purple-500"
                                  list={`sizes_list_${vIdx}`}
                                />
                                <datalist id={`sizes_list_${vIdx}`}>
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
                                    setItemSearchForm({ ...itemForm, variants: updated });
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
                                    setItemSearchForm({
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
                                    setItemSearchForm({
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
                                    setItemSearchForm({
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
                                    setItemSearchForm({
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
                                    setItemSearchForm({
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
                                    setItemSearchForm({
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
                        id="chk_is_pharmacy_master"
                        checked={itemForm.isPharmacy === 'Y' || itemForm.maintainBatch === 'Y'}
                        onChange={e => {
                          const val = e.target.checked ? 'Y' : 'N';
                          setItemSearchForm({ ...itemForm, isPharmacy: val, maintainBatch: val });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="chk_is_pharmacy_master" className="font-bold text-emerald-950 cursor-pointer flex items-center gap-1.5">
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
                          setItemSearchForm({
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
                                      setItemSearchForm({ ...itemForm, batches: updated });
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
                                      setItemSearchForm({ ...itemForm, batches: updated });
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
                                      setItemSearchForm({ ...itemForm, batches: updated });
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
                                      setItemSearchForm({ ...itemForm, batches: updated });
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
                  onChange={e => setItemSearchForm({ ...itemForm, 'Purchase Rate': e.target.value === '' ? '' as any : Number(e.target.value) })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Sale Rate *</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Sale Rate'] ?? ''}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Sale Rate': e.target.value === '' ? '' as any : Number(e.target.value) })}
                  className="w-full h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-indigo-900 text-xs outline-none focus:border-indigo-500 bg-indigo-50/20"
                />
              </div>

              {(config.EnableWholesalePrice !== 'false') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Wholesale Rate</label>
                  <input
                    type="number"
                    step="any"
                    value={itemForm['Wholesale Rate'] ?? ''}
                    onChange={e => setItemSearchForm({ ...itemForm, 'Wholesale Rate': e.target.value === '' ? '' as any : Number(e.target.value) })}
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
                  onChange={e => setItemSearchForm({ ...itemForm, MRP: e.target.value === '' ? '' as any : Number(e.target.value) })}
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
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-0.5">
                  <label className="font-semibold text-slate-700">Opening Stock</label>
                  <div className="flex items-center gap-1">
                    {config.EnableMultiBranch === 'true' && (
                      <button
                        type="button"
                        onClick={() => setShowBranchAllocModal(true)}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5 cursor-pointer"
                        title="Allocate opening stock across branches directly"
                      >
                        <Building2 className="w-2.5 h-2.5" /> Branch Split
                      </button>
                    )}
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
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={itemForm['Opening Stock'] ?? ''}
                  onChange={e => {
                    const newQty = e.target.value === '' ? '' as any : Number(e.target.value);
                    const purchaseRate = Number(itemForm['Purchase Rate']) || 0;
                    setItemSearchForm({ 
                      ...itemForm, 
                      'Opening Stock': newQty,
                      'Opening Amount': typeof newQty === 'number' ? newQty * purchaseRate : 0
                    });
                  }}
                  className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
                />
                {itemForm.branchAllocations && itemForm.branchAllocations.length > 0 && (
                  <div className="text-[10px] text-amber-700 font-medium truncate mt-0.5">
                    {itemForm.branchAllocations.filter((a: any) => (a.openingStock || 0) > 0).length} branches allocated
                  </div>
                )}
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-0.5">Opening Value (Amt)</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Opening Amount'] !== undefined ? itemForm['Opening Amount'] : ((Number(itemForm['Opening Stock'] || 0) * Number(itemForm['Purchase Rate'] || 0)) || '')}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Opening Amount': e.target.value === '' ? '' as any : Number(e.target.value) })}
                  className="w-full h-7.5 rounded-lg border border-slate-300 px-2 font-mono text-xs outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-0.5">Reorder Level</label>
                <input
                  type="number"
                  step="any"
                  value={itemForm['Reorder Level'] ?? ''}
                  onChange={e => setItemSearchForm({ ...itemForm, 'Reorder Level': e.target.value === '' ? '' as any : Number(e.target.value) })}
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

          {/* Branch Opening Stock Allocation Modal */}
          {showBranchAllocModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Branch Stock Allocation</h3>
                      <p className="text-[11px] text-slate-500">Opening stock allocation by branch</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowBranchAllocModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200/60 rounded-lg p-2.5">
                  Allocate stock directly to each branch or godown/store. Stock ledgers will record individual opening balances without requiring manual stock transfer vouchers.
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {getBranches().map(b => {
                    const branchGodowns = getGodowns().filter(g => g.branchId === b.id && g.isActive);
                    const hasGodowns = branchGodowns.length > 0;

                    if (!hasGodowns) {
                      const currentAlloc = (itemForm.branchAllocations || []).find((a: any) => a.branchId === b.id && !a.godownId);
                      const qty = currentAlloc ? currentAlloc.openingStock : 0;
                      return (
                        <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50">
                          <div>
                            <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                              {b.name}
                              {b.isHeadOffice && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">HQ</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{b.code || b.id}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={qty || ''}
                              placeholder="0"
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                const prevAllocs = itemForm.branchAllocations || [];
                                const filtered = prevAllocs.filter((a: any) => !(a.branchId === b.id && !a.godownId));
                                const updated = [...filtered, { branchId: b.id, branchName: b.name, openingStock: val }];
                                const totalQty = updated.reduce((sum, a) => sum + (Number(a.openingStock) || 0), 0);
                                const pRate = Number(itemForm['Purchase Rate']) || 0;
                                setItemSearchForm({
                                  ...itemForm,
                                  branchAllocations: updated,
                                  'Opening Stock': totalQty,
                                  'Opening Amount': totalQty * pRate
                                });
                              }}
                              className="w-24 h-7 text-right rounded border border-slate-300 px-2 font-mono text-xs outline-none focus:border-amber-500 bg-white"
                            />
                            <span className="text-xs text-slate-500">{itemForm['Base Unit'] || 'Pcs'}</span>
                          </div>
                        </div>
                      );
                    }

                    // Has one or more godowns for this branch
                    return (
                      <div key={b.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/70">
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            {b.name}
                            {b.isHeadOffice && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">HQ</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{branchGodowns.length} godown(s)</span>
                        </div>
                        <div className="space-y-1.5 pl-2">
                          {branchGodowns.map(g => {
                            const currentAlloc = (itemForm.branchAllocations || []).find((a: any) => a.branchId === b.id && a.godownId === g.id);
                            const qty = currentAlloc ? currentAlloc.openingStock : 0;
                            return (
                              <div key={g.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white border border-slate-200/80">
                                <div className="flex items-center gap-1.5">
                                  <Warehouse className="w-3 h-3 text-amber-600" />
                                  <div>
                                    <div className="text-xs font-medium text-slate-700">
                                      {g.name}
                                      {g.isDefault && <span className="ml-1 text-[9px] text-amber-600 font-semibold">(Default)</span>}
                                    </div>
                                    <div className="text-[9px] text-slate-400">{g.code || g.id}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={qty || ''}
                                    placeholder="0"
                                    onChange={e => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      const prevAllocs = itemForm.branchAllocations || [];
                                      const filtered = prevAllocs.filter((a: any) => !(a.branchId === b.id && a.godownId === g.id));
                                      const updated = [...filtered, {
                                        branchId: b.id,
                                        branchName: b.name,
                                        godownId: g.id,
                                        godownName: g.name,
                                        openingStock: val
                                      }];
                                      const totalQty = updated.reduce((sum, a) => sum + (Number(a.openingStock) || 0), 0);
                                      const pRate = Number(itemForm['Purchase Rate']) || 0;
                                      setItemSearchForm({
                                        ...itemForm,
                                        branchAllocations: updated,
                                        'Opening Stock': totalQty,
                                        'Opening Amount': totalQty * pRate
                                      });
                                    }}
                                    className="w-20 h-6.5 text-right rounded border border-slate-300 px-1.5 font-mono text-xs outline-none focus:border-amber-500 bg-white"
                                  />
                                  <span className="text-[11px] text-slate-500">{itemForm['Base Unit'] || 'Pcs'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    Total: <strong className="text-slate-900 font-mono text-sm">{Number(itemForm['Opening Stock']) || 0}</strong> {itemForm['Base Unit'] || 'Pcs'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBranchAllocModal(false)}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Ledger Modal */}
      {showLedgerModal && (
        <div 
          ref={ledgerModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, ledgerModalRef.current, handleSaveLedger, () => setShowLedgerModal(false))}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
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

              {(() => {
                const grpName = (ledgerForm.Group || '').toLowerCase();
                if (grpName.includes('bank')) return true;
                let c: string | undefined = ledgerForm.Group;
                while (c) {
                  const g = ledgerGroups.find(x => x['Group Name'] === c);
                  if (g && (g['Group Name'] || '').toLowerCase().includes('bank')) return true;
                  if (g && g['Parent Group']) {
                    if (g['Parent Group'].toLowerCase().includes('bank')) return true;
                    c = g['Parent Group'];
                  } else break;
                }
                return false;
              })() && (
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
                  value={ledgerForm['Opening Balance'] ?? ''}
                  onChange={e => setLedgerForm({ ...ledgerForm, 'Opening Balance': e.target.value === '' ? '' as any : Number(e.target.value) })}
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
        <div 
          ref={quickGroupModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, quickGroupModalRef.current, handleSaveQuickGroup, () => setShowQuickGroupModal(false))}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-600" />
                {editingItemGroupOldName ? 'Edit Item Group' : 'Quick Create Item Group'}
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
                    <span>{editingItemGroupOldName ? 'Update Group' : 'Create Group'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Category Sub-Modal */}
      {showQuickCategoryModal && (
        <div 
          ref={quickCategoryModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, quickCategoryModalRef.current, handleSaveQuickCategory, () => setShowQuickCategoryModal(false))}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
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
        <div 
          ref={quickUnitModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, quickUnitModalRef.current, handleSaveQuickUnit, () => setShowQuickUnitModal(false))}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
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
        <div 
          ref={quickLedgerGroupModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, quickLedgerGroupModalRef.current, handleSaveQuickLedgerGroup, () => setShowQuickLedgerGroupModal(false))}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-orange-600" />
                {editingLedgerGroupOldName ? 'Edit Ledger Group' : 'Quick Create Ledger Group'}
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
                <label className="block font-semibold text-slate-600 mb-1">Parent Group (e.g. Current Assets)</label>
                <select
                  value={quickLedgerGroupParent}
                  onChange={e => {
                    const pName = e.target.value;
                    setQuickLedgerGroupParent(pName);
                    if (pName) {
                      const pObj = ledgerGroups.find(g => g['Group Name'] === pName);
                      if (pObj && pObj.Nature) {
                        setQuickLedgerGroupNature(pObj.Nature);
                      }
                    }
                  }}
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
                    <span>{editingLedgerGroupOldName ? 'Update Ledger Group' : 'Create Ledger Group'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Unit Group Sub-Modal */}
      {showQuickUnitGroupModal && (
        <div 
          ref={quickUnitGroupModalRef}
          onKeyDown={(e) => handleFormKeyDown(e, quickUnitGroupModalRef.current, handleSaveQuickUnitGroup, () => setShowQuickUnitGroupModal(false))}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {editingUnitGroupOldName ? 'Edit Unit Group' : 'Quick Create Unit Group'}
              </h4>
              <button onClick={() => setShowQuickUnitGroupModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Unit Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mass, Volume, Count"
                  value={quickUnitGroupName}
                  onChange={e => setQuickUnitGroupName(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Primary Unit</label>
                <select
                  value={quickUnitGroupPrimaryUnit}
                  onChange={e => setQuickUnitGroupPrimaryUnit(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-2 font-medium outline-none"
                >
                  <option value="">-- Select Primary Unit --</option>
                  {units.map(u => (
                    <option key={u['Unit Name']} value={u['Unit Name']}>
                      {u['Unit Name']} ({u.Symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickUnitGroupModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={justSavedQuickUnitGroup}
                onClick={handleSaveQuickUnitGroup}
                className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  justSavedQuickUnitGroup
                    ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                }`}
              >
                {justSavedQuickUnitGroup ? (
                  <>
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    <span>Saved Successfully!</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 text-indigo-100" />
                    <span>{editingUnitGroupOldName ? 'Update Unit Group' : 'Create Unit Group'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportItemsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={onDataRefresh}
      />

      {showStockExportModal && (
        <ExportStockExcelModal
          isOpen={showStockExportModal}
          onClose={() => setShowStockExportModal(false)}
          items={items}
          config={config}
          title="Export Items & Stock to Excel"
        />
      )}
    </div>
  );
};
