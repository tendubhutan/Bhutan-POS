import { QuitConfirmModal } from './QuitConfirmModal';
import { ItemNoteButton, ItemNoteInput } from './vouchers/ItemNoteField';
import { GlowButton } from './common/GlowButton';
import { Unit } from '../types';
import { loadJson, saveJson, STORAGE_KEYS, DEFAULT_UNITS } from '../services/storageService';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Config,
  Item,
  Ledger,
  CartLine,
  HeldBill,
  CustomerDetails,
  PaymentDetails,
  SalesInvoice,
  VoucherType,
  ItemBatch
} from '../types';
import {
  loadPOSSettings,
  savePOSSettings,
  POSSettings
} from '../types/posSettings';
import { BankTransactionIdModal } from './BankTransactionIdModal';
import { AcceptModal } from './AcceptModal';
import {
  holdBill,
  resumeBill,
  deleteHeldBill,
  saveSalesInvoice, deleteSalesInvoice,
  saveLedger,
  round2,
  getVoucherTypes,
  getSerialNumbersStockReport,
  getActiveUser,
  peekNextInvoiceNumber,
  getDeviceCounterId,
  setDeviceCounterId,
  getDesignatedOfflineCounter,
  canCurrentDeviceBillOffline,
  isSystemOnline,
  getTerminalsConfig,
  DEFAULT_TERMINALS
} from '../services/storageService';
import {
  findBestItemScheme,
  findBestBillScheme,
  getAllActiveSchemes,
  getSchemes
} from '../services/schemeService';
import {
  playScanBeep,
  playSuccessChime,
  playWarningTone
} from '../utils/audio';
import {
  Plus,
  Trash2,
  Tag,
  Tags,
  Gift,
  Pause,
  RotateCcw,
  UserPlus,
  Edit2,
  CheckCircle2,
  Search,
  ShoppingCart,
  CreditCard,
  X,
  Settings,
  Keyboard,
  Zap,
  SlidersHorizontal,
  Volume2,
  AlertTriangle,
  Coins,
  Printer,
  Sparkles,
  ArrowRight,
  Barcode,
  Receipt,
  Percent,
  MessageCircle,
  Mail,
  Check,
  FileDown,
  Share2,
  FileText,
  Calendar,
  Info
} from 'lucide-react';
import { SerialModal } from './SerialModal';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { POSSettingsModal } from './pos/POSSettingsModal';
import { POSShortcutsModal } from './pos/POSShortcutsModal';
import { ItemInfoModal } from './ItemInfoModal';
import { generateInvoicePDF, shareOrDownloadPDF } from '../utils/pdfExport';

interface POSBillingProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  heldBills: HeldBill[];
  selectedVoucherType?: VoucherType | null;
  onOpenVoucherTypeModal?: () => void;
  onDataRefresh: () => void;
  onOpenNewItemModal: (onSelect?: (item: Item) => void, itemToEdit?: Item | null) => void;
  onOpenNewLedgerModal: (group?: string, onSelect?: (name: string) => void) => void;
  onEditLedger: (name: string) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onBack?: (forceDirect?: boolean) => void;
  isActive?: boolean;
}

export const POSBilling: React.FC<POSBillingProps> = ({
  config,
  items,
  ledgers,
  heldBills,
  selectedVoucherType,
  onOpenVoucherTypeModal,
  onDataRefresh,
  onOpenNewItemModal,
  onOpenNewLedgerModal,
  onEditLedger,
  initialVoucherTarget,
  onBack,
  isActive = true
}) => {
  // POS Preferences & Workflow Settings
  const [posSettings, setPosSettings] = useState<POSSettings>(() => loadPOSSettings());
  const units = loadJson<Unit[]>(STORAGE_KEYS.UNITS, DEFAULT_UNITS);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [selectedItemForInfo, setSelectedItemForInfo] = useState<Item | null>(null);

  const getItemPartNumber = (item: Item) => item.partNumber || (item as any)['Part Number'] || (item as any)['Part No'] || (item as any)['part_number'] || '';
  const getItemRackLocation = (item: Item) => item.rackLocation || (item as any)['Rack Location'] || (item as any)['Rack / Bin Location'] || (item as any)['Rack'] || (item as any)['Bin'] || '';
  const getItemCompatibility = (item: Item) => item.compatibility || (item as any)['Compatibility'] || (item as any)['Vehicle / Machine Compatibility'] || '';

  const handleSaveSettings = (newSettings: POSSettings) => {
    setPosSettings(newSettings);
    savePOSSettings(newSettings);
  };

  // Live synchronization of POS preferences across tabs, settings modal, and view switches
  useEffect(() => {
    const syncSettings = () => {
      setPosSettings(loadPOSSettings());
    };
    syncSettings();

    window.addEventListener('pos_settings_changed', syncSettings);
    window.addEventListener('storage', syncSettings);
    window.addEventListener('focus', syncSettings);
    return () => {
      window.removeEventListener('pos_settings_changed', syncSettings);
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('focus', syncSettings);
    };
  }, [config]);

  // Toggle quick mode from header pill
  const toggleItemAddMode = () => {
    const updated: POSSettings = {
      ...posSettings,
      itemAddMode: posSettings.itemAddMode === 'direct' ? 'prompt' : 'direct'
    };
    handleSaveSettings(updated);
  };

  // Active Sale Voucher Type (controlled from menu/launcher or default active sale type)
  const [activeVoucherType, setActiveVoucherType] = useState<VoucherType | null>(selectedVoucherType || null);

  useEffect(() => {
    if (selectedVoucherType) {
      setActiveVoucherType(selectedVoucherType);
    } else {
      try {
        const vts = getVoucherTypes();
        const sTypes = vts.filter(v => (v.type === 'Sale' || v.parentType === 'Sale' || v.typeCode === 'S') && v.isActive !== false && v.status !== 'Inactive');
        if (sTypes.length > 0) {
          const def = sTypes.find(v => v.isDefault) || sTypes[0];
          setActiveVoucherType(def);
        }
      } catch {
        // fallback
      }
    }
  }, [selectedVoucherType, config]);

  
  const [editingInvoiceNo, setEditingInvoiceNo] = useState<string | null>(null);
  const [editingInvoiceDate, setEditingInvoiceDate] = useState<string | null>(null);
  const [editingBillSchemeName, setEditingBillSchemeName] = useState<string | undefined>(undefined);
  const loadedTargetKeyRef = useRef<string | null>(null);
  const [posBillNo, setPosBillNo] = useState<string>(() => {
    try {
      return peekNextInvoiceNumber(true, selectedVoucherType?.id);
    } catch {
      return 'POS-1';
    }
  });
  const [posBillDate, setPosBillDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const [batchSelectModalIdx, setBatchSelectModalIdx] = useState<number | null>(null);

  const [deviceCounterId, setLocalDeviceCounterId] = useState<string>(() => getDeviceCounterId());

  // Allowed terminals strictly filtered based on company configuration / terminal limit
  const allowedTerminals = useMemo(() => {
    const list = getTerminalsConfig().filter(t => t.isActive !== false);
    return list.length > 0 ? list : [DEFAULT_TERMINALS[0]];
  }, [config]);

  // Ensure active selected terminal is valid within the allowed terminals list
  useEffect(() => {
    if (allowedTerminals.length > 0 && !allowedTerminals.some(t => t.code === deviceCounterId || t.id === deviceCounterId)) {
      const firstCode = allowedTerminals[0].code || allowedTerminals[0].id || 'C1';
      setLocalDeviceCounterId(firstCode);
      setDeviceCounterId(firstCode);
    }
  }, [allowedTerminals, deviceCounterId]);

  // Keep posBillNo and posBillDate synchronized with editing state and active voucher series
  useEffect(() => {
    if (editingInvoiceNo) {
      setPosBillNo(editingInvoiceNo);
      if (editingInvoiceDate) {
        try {
          const d = new Date(editingInvoiceDate);
          if (!isNaN(d.getTime())) {
            setPosBillDate(d.toISOString().split('T')[0]);
          }
        } catch {}
      }
    } else {
      try {
        setPosBillNo(peekNextInvoiceNumber(true, activeVoucherType?.id));
      } catch {}
    }

    const refreshBillNo = () => {
      setLocalDeviceCounterId(getDeviceCounterId());
      if (!editingInvoiceNo) {
        try {
          setPosBillNo(peekNextInvoiceNumber(true, activeVoucherType?.id));
        } catch {}
      }
    };

    window.addEventListener('online', refreshBillNo);
    window.addEventListener('offline', refreshBillNo);
    window.addEventListener('device_counter_id_changed', refreshBillNo);
    return () => {
      window.removeEventListener('online', refreshBillNo);
      window.removeEventListener('offline', refreshBillNo);
      window.removeEventListener('device_counter_id_changed', refreshBillNo);
    };
  }, [editingInvoiceNo, editingInvoiceDate, activeVoucherType]);

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const key = `${initialVoucherTarget.voucherNo}_${initialVoucherTarget.timestamp}`;
      if (loadedTargetKeyRef.current !== key) {
        loadedTargetKeyRef.current = key;
        import('../services/storageService').then(m => {
          const details = m.getVoucherDetails(initialVoucherTarget.voucherNo);
          if (details && (details.type === 'INV' || details.type === 'S')) {
            const inv = details.header as any;
            if (inv && (inv.isPOS === false || inv.voucherTypeId === 'VT-SALE-NORMAL')) {
              return;
            }
            const schemeEvalDate = inv.date ? new Date(inv.date) : new Date();
            const allSchemes = getSchemes();
            const newCart: CartLine[] = (inv.items || []).map((it: any) => {
              const itemMatch = items.find(i => i['Item Code'] === (it['Item Code'] || it.itemCode));
              const isZeroRated = (it['Zero Rated (Y/N)'] === 'Y' || it.zeroRated === 'Y' || it.zeroRated === true);
              let rawRate = Number(it.Rate !== undefined ? it.Rate : (it.rate !== undefined ? it.rate : 0));
              const rawQty = Number(it.Qty !== undefined ? it.Qty : (it.qty !== undefined ? it.qty : 1));
              const rawDisc = Number(it.Discount !== undefined ? it.Discount : (it.discount !== undefined ? it.discount : 0));

              let appliedSchemeId = it.appliedSchemeId;
              let appliedSchemeName = it.appliedSchemeName;
              let originalRate = it.originalRate !== undefined ? Number(it.originalRate) : undefined;
              let discount = rawDisc;

              const matchedScheme = appliedSchemeId ? allSchemes.find(s => s.id === appliedSchemeId) : null;
              let discountType: 'flat' | 'percent' = it.discountType 
                || (matchedScheme?.schemeType === 'percent_discount' ? 'percent' : undefined)
                || ((it['Discount %'] && Number(it['Discount %']) > 0) ? 'percent' : (config.ItemDiscountType === 'percent' ? 'percent' : 'flat'));

              // If scheme was not explicitly recorded, check if an active scheme applies for POS
              if (!appliedSchemeName && itemMatch && rawQty > 0) {
                const bestScheme = findBestItemScheme(itemMatch, rawQty, 'pos', schemeEvalDate) 
                  || findBestItemScheme(itemMatch, rawQty, 'pos', new Date());
                if (bestScheme) {
                  if (rawDisc === 0 || rawDisc === bestScheme.discountPct || rawDisc === bestScheme.discountAmt) {
                    appliedSchemeId = bestScheme.scheme.id;
                    appliedSchemeName = bestScheme.badgeText;
                    if (bestScheme.scheme.schemeType === 'percent_discount') {
                      discount = bestScheme.discountPct;
                      discountType = 'percent';
                    } else if (bestScheme.scheme.schemeType === 'flat_discount') {
                      discount = bestScheme.discountAmt;
                      discountType = 'flat';
                    } else if (bestScheme.scheme.schemeType === 'special_rate' && bestScheme.specialRate) {
                      if (rawRate >= bestScheme.specialRate) {
                        originalRate = rawRate;
                        rawRate = bestScheme.specialRate;
                      }
                    }
                  }
                }
              }

              return {
                itemCode: it['Item Code'] || it.itemCode || '',
                itemName: it['Item Name'] || it.itemName || '',
                description: it.description || it['Item Description'] || '',
                lineDescription: it.lineDescription || '',
                qty: rawQty,
                rate: rawRate,
                discount,
                discountType,
                appliedSchemeId,
                appliedSchemeName,
                originalRate,
                unit: it.Unit || it.unit || itemMatch?.Unit || 'Pcs',
                gstPct: Number(it['GST %'] !== undefined ? it['GST %'] : (it.gstPct !== undefined ? it.gstPct : (itemMatch?.['GST %'] || 0))),
                gstAmt: Number(it['GST Amount'] !== undefined ? it['GST Amount'] : (it.gstAmt !== undefined ? it.gstAmt : 0)),
                zeroRated: isZeroRated ? ('Y' as const) : ('N' as const),
                purchaseRate: Number(it.purchaseRate || itemMatch?.['Purchase Rate'] || 0),
                isSerialized: (it.isSerialized || itemMatch?.['Is Serialized'] || 'N') as 'Y' | 'N',
                serials: typeof it['Serial Numbers'] === 'string'
                  ? it['Serial Numbers'].split(',').map((s: string) => s.trim()).filter(Boolean) 
                  : (Array.isArray(it.serials) ? it.serials : []),
                selectedBatchNo: it['Batch No'] || it.selectedBatchNo || it.batchNo || '',
                selectedBatchExp: it['Expiry Date'] || it.selectedBatchExp || it.expiryDate || '',
                selectedBatchId: it.batchId || it.selectedBatchId || ''
              };
            });
            setCart(newCart);
            
            if (inv.customer) {
              if (typeof inv.customer === 'object') {
                setCustomerName(inv.customer.ledger || inv.customer.name || '');
                setWalkInDetails(inv.customer);
              } else {
                setCustomerName(inv.customer);
              }
            }

            const cashAmt = Number(inv.cash ?? inv.payment?.cash ?? 0);
            setCash(cashAmt > 0 ? cashAmt : '');

            const bank1Amt = Number(inv.bank1 ?? inv.payment?.bank1 ?? 0);
            setBank1(bank1Amt > 0 ? bank1Amt : '');

            const bank2Amt = Number(inv.bank2 ?? inv.payment?.bank2 ?? 0);
            setBank2(bank2Amt > 0 ? bank2Amt : '');

            setBankTxnNo(inv.bankTxnNo || inv.payment?.bank1TxnNo || inv.payment?.bankTxnNo || '');
            setBank2TxnNo(inv.bank2TxnNo || inv.payment?.bank2TxnNo || '');

            const discVal = inv.discount ?? inv.billDiscount ?? inv.payment?.discount ?? '';
            if (inv.appliedBillSchemeName) {
              setEditingBillSchemeName(inv.appliedBillSchemeName);
              setBillDiscount('');
            } else {
              const bestBill = findBestBillScheme(Number(inv.subtotal || inv.total), 'pos', inv.date ? new Date(inv.date) : new Date())
                || findBestBillScheme(Number(inv.subtotal || inv.total), 'pos', new Date());
              if (bestBill && (Number(discVal) === 0 || round2(bestBill.discountAmt) === round2(Number(discVal)))) {
                setEditingBillSchemeName(bestBill.badgeText);
                setBillDiscount('');
              } else {
                setEditingBillSchemeName(undefined);
                setBillDiscount(discVal !== '' ? Number(discVal) : '');
              }
            }
            
            setEditingInvoiceNo(inv.invoiceNo || inv.billNo);
            if (inv.date) {
              setEditingInvoiceDate(inv.date);
            }
          }
        });
      }
    } else {
      if (loadedTargetKeyRef.current !== null) {
        loadedTargetKeyRef.current = null;
        setEditingInvoiceNo(null);
        setEditingInvoiceDate(null);
        setEditingBillSchemeName(undefined);
        setCart([]);
        setCustomerName('');
        setWalkInDetails(null);
        setCash('');
        setBank1('');
        setBank2('');
        setBillDiscount('');
        setBankTxnNo('');
        setBank2TxnNo('');
        try {
          setPosBillNo(peekNextInvoiceNumber(true, activeVoucherType?.id));
        } catch {}
      }
    }
  }, [initialVoucherTarget, items, activeVoucherType]);

  // Cart & Customer State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');

  const getItemRate = (item: Item): number => {
    if (pricingMode === 'wholesale' && Number((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate'] || 0) > 0) {
      return Number((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate']);
    }
    return Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0);
  };

  const handlePricingModeChange = (newMode: 'retail' | 'wholesale') => {
    setPricingMode(newMode);
    if (cart.length > 0) {
      const updatedCart = cart.map(line => {
        const match = items.find(i => i['Item Code'] === line.itemCode);
        if (!match) return line;
        let newRate = Number((match as any)['Sale Rate'] ?? (match as any)['Sales Rate'] ?? match.MRP ?? 0);
        if (newMode === 'wholesale' && Number((match as any)['Wholesale Rate'] || (match as any)['wholesaleRate'] || 0) > 0) {
          newRate = Number((match as any)['Wholesale Rate'] || (match as any)['wholesaleRate']);
        }
        const isZ = isCustomerGstExempted || String(line.zeroRated).toUpperCase() === 'Y';
        const lineDisc = config.ItemDiscountType === 'percent' ? ((line.qty * newRate) * line.discount / 100) : line.discount;
        const computedGstAmt = isZ ? 0 : round2(((line.qty * newRate - lineDisc) * (Number(line.gstPct) || 0)) / 100);
        return {
          ...line,
          rate: newRate,
          gstAmt: computedGstAmt
        };
      });
      setCart(updatedCart);
    }
  };
  const [customerName, setCustomerName] = useState('');
  const [walkInDetails, setWalkInDetails] = useState<{ name: string; phone: string; address: string; gst: string; isGSTExempted?: boolean } | null>(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);

  // Grid Entry State
  const [entrySearch, setEntrySearch] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryQty, setEntryQty] = useState<number | string>(1);
  const [entryRate, setEntryRate] = useState<number | ''>('');
  const [entryDisc, setEntryDisc] = useState<number | ''>('');
  const [cartQtyText, setCartQtyText] = useState<{ [idx: number]: string }>({});
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedItemObj, setSelectedItemObj] = useState<Item | null>(null);

  // Customer Modal State (Create & Edit Ledger)
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<'create' | 'edit'>('create');
  const [customerForm, setCustomerForm] = useState<Partial<Ledger>>({
    'Ledger Name': '',
    Group: 'Sundry Debtors',
    'GST Type': 'Regular',
    'GST Exempted': 'N',
    'GST No': '',
    'TPN No': '',
    Address: '',
    'Contact No': '',
    Email: '',
    'Opening Balance': 0,
    'Balance Type (Dr/Cr)': 'Dr'
  });

  // Payment State
  const [cash, setCash] = useState<number | ''>('');
  const [bank1, setBank1] = useState<number | ''>('');
  const [bank2, setBank2] = useState<number | ''>('');
  const [bankTxnNo, setBankTxnNo] = useState<string>('');
  const [bank2TxnNo, setBank2TxnNo] = useState<string>('');
  const [bankTxnModalOpen, setBankTxnModalOpen] = useState(false);
  const [activeBankLedgerName, setActiveBankLedgerName] = useState('');
  const [targetBankField, setTargetBankField] = useState<'bank1' | 'bank2'>('bank1');

  // Bill-level / Lumpsum Discount State (e.g. customer requests 10 discount on 110 bill)
  const [billDiscount, setBillDiscount] = useState<number | ''>('');
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>(config.BillDiscountType || 'flat');
  
  // Modals & Mobile Tabs
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [activeSerialIndex, setActiveSerialIndex] = useState<number>(-1);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<SalesInvoice | null>(null);
  const [mobileTab, setMobileTab] = useState<'cart' | 'payment'>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPurchasePrice, setShowPurchasePrice] = useState(false);
  const [securityAlert, setSecurityAlert] = useState(false);
  const [changeModalData, setChangeModalData] = useState<{
    billAmount: number;
    cashTendered: number;
    changeReturn: number;
  } | null>(null);

  // Refs for Field-to-Field Navigation
  const itemInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const discInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const bank1InputRef = useRef<HTMLInputElement>(null);
  const bank2InputRef = useRef<HTMLInputElement>(null);
  const billDiscountInputRef = useRef<HTMLInputElement>(null);

  // Cart Table Row Refs for inline keyboard navigation
  const cartQtyRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const cartRateRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const cartDiscRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const showGst = String(config.EnableGST) !== 'false';
  const showSerials = String(config.EnableSerials) === 'true';
  const showItemDiscount = posSettings.enableItemDiscount !== false;
  const showBillDiscount = posSettings.enableBillDiscount !== false;

  // Check if selected customer/ledger is GST exempted
  const selectedLedger = ledgers.find(l => l['Ledger Name'] === customerName);
  const isCustomerGstExempted = Boolean(
    walkInDetails?.isGSTExempted ||
    selectedLedger?.['GST Exempted'] === 'Y' ||
    selectedLedger?.['GST Type'] === 'Exempted'
  );

  // Open inline Create Customer Ledger Modal
  const openCreateCustomerModal = () => {
    onOpenNewLedgerModal('Sundry Debtors', (name) => setCustomerName(name));
    return;
    setCustomerModalMode('create');
    setCustomerForm({
      'Ledger Name': '',
      Group: 'Sundry Debtors',
      'GST No': '',
      'TPN No': '',
      'GST Type': 'Regular',
      'GST Exempted': 'N',
      Address: '',
      'Contact No': '',
      Email: '',
      'Opening Balance': 0,
      'Balance Type (Dr/Cr)': 'Dr'
    });
    setShowCustomerModal(true);
  };

  // Open inline Edit Customer Ledger Modal
  const openEditCustomerModal = () => {
    const trimmed = customerName.trim();
    if (!trimmed) {
      alert('Please select or type a customer name to edit.');
      return;
    }
    const found = ledgers.find(l => l['Ledger Name'].toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setCustomerModalMode('edit');
      setCustomerForm({ ...found, oldName: found['Ledger Name'] });
    } else {
      setCustomerModalMode('create');
      setCustomerForm({
        'Ledger Name': trimmed,
        Group: 'Sundry Debtors',
        'GST No': '',
        'TPN No': '',
        'GST Type': 'Regular',
        'GST Exempted': 'N',
        Address: '',
        'Contact No': '',
        Email: '',
        'Opening Balance': 0,
        'Balance Type (Dr/Cr)': 'Dr'
      });
    }
    setShowCustomerModal(true);
  };

  // Save Customer Ledger
  const handleSaveCustomerModal = () => {
    if (!customerForm['Ledger Name']?.trim()) {
      alert('Customer / Ledger Name is required.');
      return;
    }
    const res = saveLedger(customerForm as Ledger);
    if (!res.ok) {
      alert(res.error || 'Failed to save customer ledger.');
      return;
    }
    setCustomerName(customerForm['Ledger Name']!.trim());
    setShowCustomerModal(false);
    onDataRefresh();
    setTimeout(() => itemInputRef.current?.focus(), 50);
  };

  const resetPosForm = () => {
    setCart([]);
    setCustomerName('');
    setWalkInDetails(null);
    setEditingInvoiceNo(null);
    setEditingInvoiceDate(null);
    setCash('');
    setBank1('');
    setBank2('');
    setBillDiscount('');
    setBankTxnNo('');
    setBank2TxnNo('');
    setEntrySearch('');
  };

  const handlePosBack = (): boolean => {
    if (showQuitModal) {
      setShowQuitModal(false);
      return true;
    }
    if (changeModalData) {
      setCash(changeModalData.billAmount);
      setChangeModalData(null);
      return true;
    }
    if (receiptModalOpen) {
      setReceiptModalOpen(false);
      return true;
    }
    if (showWalkInModal) {
      setShowWalkInModal(false);
      return true;
    }
    if (showCustomerModal) {
      setShowCustomerModal(false);
      return true;
    }
    if (showShortcutsModal) {
      setShowShortcutsModal(false);
      return true;
    }
    if (showSettingsModal) {
      setShowSettingsModal(false);
      return true;
    }
    if (serialModalOpen) {
      setSerialModalOpen(false);
      return true;
    }
    if (showDropdown) {
      setShowDropdown(false);
      return true;
    }
    if (entrySearch) {
      setEntrySearch('');
      itemInputRef.current?.focus();
      return true;
    }

    const hasData =
      cart.length > 0 ||
      (!!customerName && customerName !== 'Cash Sale') ||
      !!editingInvoiceNo ||
      !!walkInDetails ||
      (Number(billDiscount) > 0) ||
      !!cash ||
      !!bank1 ||
      !!bank2;
    if (hasData) {
      setShowQuitModal(true);
      return true;
    }

    resetPosForm();
    return false;
  };

  // ESC and Global Keyboard Shortcuts
  useEffect(() => {
    if (isActive === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Open Shortcuts Guide
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // F2: Fast Checkout / Save
      if (e.key === 'F2' || e.code === 'F2') {
        e.preventDefault();
        handleCheckout();
        return;
      }

      // F3 or '/': Focus Search Box
      if (e.key === 'F3') {
        e.preventDefault();
        itemInputRef.current?.focus();
        itemInputRef.current?.select();
        return;
      }

      // F4: Focus Customer / Ledger Select
      if (e.key === 'F4') {
        e.preventDefault();
        const ledgerEl = document.getElementById('customer-ledger-select') as HTMLInputElement;
        if (ledgerEl) {
          ledgerEl.focus();
          ledgerEl.select();
        }
        return;
      }

      // F7: Open Walk-in Modal
      if (e.key === 'F7') {
        e.preventDefault();
        setShowWalkInModal(true);
        return;
      }

      // F8: Hold Bill
      if (e.key === 'F8') {
        e.preventDefault();
        handleHoldBill();
        return;
      }

      // F9: Resume latest held bill
      if (e.key === 'F9') {
        e.preventDefault();
        if (heldBills.length > 0) {
          handleResumeBill(heldBills[0].holdId);
        }
        return;
      }

      // F10: Clear Cart
      if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0 && confirm('Are you sure you want to clear the entire cart?')) {
          setCart([]);
          setCustomerName('');
          setWalkInDetails(null);
          setEditingInvoiceNo(null);
          setEditingInvoiceDate(null);
          itemInputRef.current?.focus();
        }
        return;
      }

      // Alt+S: Open Settings
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowSettingsModal(true);
        return;
      }

      // Alt+C: Quick Create New Item Master
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        if (onOpenNewItemModal) {
          setShowDropdown(false);
          onOpenNewItemModal(newItem => {
            selectItem(newItem);
            setEntrySearch('');
            setShowDropdown(false);
          });
        } else if (cart.length > 0) {
          cartQtyRefs.current[0]?.focus();
          cartQtyRefs.current[0]?.select();
        }
        return;
      }

      // Ctrl+P or Alt+P (when in item selection): Secret toggle Purchase Cost
      if ((e.ctrlKey || (e.altKey && (showDropdown || document.activeElement === itemInputRef.current))) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        const user = getActiveUser();
        const isAllowed = !user || user.role === 'Administrator' || user.role === 'Manager' || user.role === 'Accountant' || (user.role !== 'Cashier' && user.permissions?.some(p => p.display));
        if (isAllowed) {
          setShowPurchasePrice(prev => !prev);
        } else {
          setSecurityAlert(true);
          setTimeout(() => setSecurityAlert(false), 2500);
        }
        return;
      }

      // Alt+P: Jump directly to Cash Payment
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
        return;
      }

      // Alt+D or F6: Jump directly to Lumpsum / Bill Discount Input
      if (((e.altKey && e.key.toLowerCase() === 'd') || e.key === 'F6') && showBillDiscount) {
        e.preventDefault();
        billDiscountInputRef.current?.focus();
        billDiscountInputRef.current?.select();
        return;
      }
    };

    const handleSaveEvent = (e: Event) => {
      e.preventDefault();
      handleCheckout();
    };

    const handleBackEvent = (e: Event) => {
      const handled = handlePosBack();
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('app:save', handleSaveEvent);
    window.addEventListener('app:back', handleBackEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('app:save', handleSaveEvent);
      window.removeEventListener('app:back', handleBackEvent);
    };
  }, [
    isActive,
    showSettingsModal,
    showShortcutsModal,
    showCustomerModal,
    showWalkInModal,
    serialModalOpen,
    receiptModalOpen,
    showDropdown,
    changeModalData,
    showQuitModal,
    cart,
    customerName,
    cash,
    bank1,
    bank2,
    billDiscount,
    heldBills,
    entrySearch,
    editingInvoiceNo,
    onBack
  ]);

  // Calculations with Lumpsum / Bill Discount support & GST Exemption
  const calculateTotals = () => {
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0, itemDiscountTotal = 0;
    cart.forEach(l => {
      let lineDisc = 0;
      if (showItemDiscount || l.appliedSchemeName || Number(l.discount) > 0) {
        const rawDisc = Number(l.discount) || 0;
        const isPct = l.discountType === 'percent' || config.ItemDiscountType === 'percent';
        lineDisc = isPct ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
      }
      itemDiscountTotal += lineDisc;
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0) - lineDisc;
      const isZero = isCustomerGstExempted || String(l.zeroRated).toUpperCase() === 'Y';
      const lineGst = isZero ? 0 : round2(gross * (Number(l.gstPct) || 0) / 100);
      if (isZero) zeroRated += gross; else taxable += gross;
      gstAmt += lineGst;
      rawTotal += (gross + lineGst);
    });

    const subtotal = round2(rawTotal);
    let discountAmt = 0;
    if (showBillDiscount && billDiscount !== '' && Number(billDiscount) > 0) {
      if (billDiscountType === 'percent') {
        discountAmt = round2((subtotal * Number(billDiscount)) / 100);
      } else {
        discountAmt = round2(Number(billDiscount));
      }
    }

    let billSchemeDiscount = 0;
    let appliedBillSchemeName: string | undefined = editingBillSchemeName;
    if ((!showBillDiscount || billDiscount === '' || Number(billDiscount) === 0) && subtotal > 0) {
      const bestBill = findBestBillScheme(subtotal, 'pos', editingInvoiceDate ? new Date(editingInvoiceDate) : new Date())
        || findBestBillScheme(subtotal, 'pos', new Date());
      if (bestBill) {
        billSchemeDiscount = round2(bestBill.discountAmt);
        appliedBillSchemeName = bestBill.badgeText;
      }
    }

    const effectiveBillDiscount = Math.min(subtotal, Math.max(0, Math.max(discountAmt, billSchemeDiscount)));
    const total = Math.max(0, round2(subtotal - effectiveBillDiscount));

    return {
      subtotal,
      discount: effectiveBillDiscount,
      appliedBillSchemeName,
      discountValue: (showBillDiscount && billDiscount !== '') ? Number(billDiscount) : (appliedBillSchemeName ? billSchemeDiscount : 0),
      taxable: round2(taxable),
      zeroRated: round2(zeroRated),
      gstAmt: round2(gstAmt),
      itemDiscountTotal: round2(itemDiscountTotal),
      total
    };
  };

  const totals = calculateTotals();
  const prevTotalRef = useRef(totals.total);
  const prevInvoiceNoRef = useRef(editingInvoiceNo);
  const prevCustomerRef = useRef(customerName);

  // Auto set payment defaults:
  // - If customer is selected, default to 100% Due (Cash and Bank remain 0 unless entered manually)
  // - If no customer selected (Cash Sale), default cash to full total
  useEffect(() => {
    const totalChanged = totals.total !== prevTotalRef.current;
    const justEnteredEditMode = editingInvoiceNo && prevInvoiceNoRef.current !== editingInvoiceNo;
    const customerChanged = customerName !== prevCustomerRef.current;
    
    prevInvoiceNoRef.current = editingInvoiceNo;
    prevCustomerRef.current = customerName;

    if (cart.length === 0) {
      if (!editingInvoiceNo) {
        setCash('');
        setBank1('');
        setBank2('');
      }
      prevTotalRef.current = totals.total;
      return;
    }

    if (editingInvoiceNo) {
      // In edit mode, only auto-update cash if the cart total actually changed or customer changed
      if ((totalChanged || customerChanged) && !justEnteredEditMode) {
        const isCashCustomer = !customerName || customerName.toLowerCase().includes('cash');
        if (isCashCustomer) {
          // Cash customers cannot have credit. Auto-fill any remaining balance to Cash
          const cBank1 = Number(bank1) || 0;
          const cBank2 = Number(bank2) || 0;
          const remaining = Math.max(0, totals.total - cBank1 - cBank2);
          setCash(remaining > 0 ? remaining : '');
        } else {
          if (bank1 === '' && bank2 === '') {
            // Only auto-update if it's a named customer who was explicitly paying 100% in cash
            if (cash === prevTotalRef.current || cash === '') {
              setCash(totals.total);
            }
          }
        }
      }
      prevTotalRef.current = totals.total;
      return;
    }

    // New Sale Mode (Not Editing)
    if (totalChanged || customerChanged || cash === '') {
      const isCashCustomer = !customerName || customerName.toLowerCase().includes('cash');
      
      if (!isCashCustomer) {
        // If customer is selected and cash was set to exact total automatically, clear it so it shows in Due
        if ((cash === totals.total || cash === prevTotalRef.current) && bank1 === '' && bank2 === '') {
          setCash('');
        }
      } else {
        // Walk-in / Cash customer: ALWAYS auto-adjust cash to cover the balance so Due is 0.
        const cBank1 = Number(bank1) || 0;
        const cBank2 = Number(bank2) || 0;
        const remaining = Math.max(0, totals.total - cBank1 - cBank2);
        setCash(remaining > 0 ? remaining : '');
      }
    }
    
    prevTotalRef.current = totals.total;
  }, [customerName, totals.total, cart.length, cash, bank1, bank2, editingInvoiceNo]);

  const expandedItems = useMemo(() => {
    const result: Item[] = [];
    for (const item of items) {
      if (item.variants && item.variants.length > 0) {
        for (const v of item.variants) {
          result.push({
            ...item,
            size: v.size || item.size,
            color: v.color || item.color,
            Barcode: v.barcode || item.Barcode,
            'Purchase Rate': (v.purchaseRate !== undefined && v.purchaseRate > 0) ? v.purchaseRate : item['Purchase Rate'],
            'Sale Rate': (v.saleRate !== undefined && v.saleRate > 0) ? v.saleRate : item['Sale Rate'],
            'Wholesale Rate': (v.wholesaleRate !== undefined && v.wholesaleRate > 0) ? v.wholesaleRate : ((item as any)['Wholesale Rate'] || (item as any)['wholesaleRate']),
            MRP: (v.mrp !== undefined && v.mrp > 0) ? v.mrp : item.MRP,
            'Current Stock': v.currentStock !== undefined ? v.currentStock : item['Current Stock'],
          });
        }
      } else {
        result.push(item);
      }
    }
    return result;
  }, [items]);

  // Item Search Handler (Aligned with B2B Sales logic)
  const handleSearchChange = (q: string) => {
    setEntrySearch(q);
    setEntryCode('');
    setSelectedIndex(-1);
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const searchLower = q.toLowerCase().trim();
    const searchTokens = searchLower.split(/\s+/).filter(Boolean);

    // Look up serial numbers in stock matching query
    let serialMatches: { itemCode: string; serialNo: string }[] = [];
    try {
      const serialReport = getSerialNumbersStockReport();
      serialMatches = serialReport
        .filter(s => s.status === 'In Stock' && s.serialNo.toLowerCase().includes(searchLower))
        .map(s => ({ itemCode: s.itemCode, serialNo: s.serialNo }));
    } catch {}

    const serialItemCodes = new Set(serialMatches.map(s => s.itemCode));
    const exactSerialMatch = serialMatches.find(s => s.serialNo.toLowerCase() === searchLower);

    const getItemScore = (item: Item) => {
      const name = (item['Item Name'] || '').toLowerCase();
      const code = (item['Item Code'] || '').toLowerCase();
      const barcode = (item['Barcode'] || '').toString().toLowerCase();
      const alias = (item['Alias'] || '').toLowerCase();
      const partNo = getItemPartNumber(item).toLowerCase();
      const rack = getItemRackLocation(item).toLowerCase();
      const compat = getItemCompatibility(item).toLowerCase();
      const cat = (item.Category || '').toLowerCase();
      const grp = (item.Group || '').toLowerCase();
      const sz = (item.size || '').toLowerCase();
      const col = (item.color || '').toLowerCase();
      const hasSerial = serialItemCodes.has(item['Item Code']);

      let score = 0;

      // Exact Matches
      if (exactSerialMatch && exactSerialMatch.itemCode === item['Item Code']) score += 3000;
      if (barcode === searchLower) score += 2500;
      if (code === searchLower) score += 2400;
      if (partNo && partNo === searchLower) score += 2300;
      if (name === searchLower) score += 2200;
      if (rack && rack === searchLower) score += 2100;

      // Starts With Matches
      if (partNo && partNo.startsWith(searchLower)) score += 1500;
      if (name.startsWith(searchLower)) score += 1400;
      if (code.startsWith(searchLower)) score += 1300;
      if (rack && rack.startsWith(searchLower)) score += 1200;
      if (compat && compat.startsWith(searchLower)) score += 1100;
      if (sz && sz.startsWith(searchLower)) score += 1100;
      if (col && col.startsWith(searchLower)) score += 1100;

      // Token Matches
      let allTokensFound = true;
      for (const token of searchTokens) {
        let tokenMatch = false;
        if (partNo.includes(token)) { score += 250; tokenMatch = true; }
        if (rack.includes(token)) { score += 220; tokenMatch = true; }
        if (compat.includes(token)) { score += 200; tokenMatch = true; }
        if (sz.includes(token)) { score += 220; tokenMatch = true; }
        if (col.includes(token)) { score += 220; tokenMatch = true; }
        if (name.includes(token)) { score += 180; tokenMatch = true; }
        if (code.includes(token)) { score += 150; tokenMatch = true; }
        if (barcode.includes(token)) { score += 150; tokenMatch = true; }
        if (alias.includes(token)) { score += 120; tokenMatch = true; }
        if (cat.includes(token)) { score += 80; tokenMatch = true; }
        if (grp.includes(token)) { score += 60; tokenMatch = true; }
        if (hasSerial) { score += 300; tokenMatch = true; }

        if (!tokenMatch) allTokensFound = false;
      }

      if (allTokensFound) score += 500;

      return score;
    };

    const matched = expandedItems
      .map(item => {
        const sm = serialMatches.find(s => s.itemCode === item['Item Code']);
        return {
          item: {
            ...item,
            matchedSerial: sm ? sm.serialNo : undefined
          },
          score: getItemScore(item)
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, 15);

    setSearchResults(matched as any);
    setShowDropdown(matched.length > 0);
  };

  // Add Item to Cart (Direct or Step-by-Step, matching B2B rate & GST logic)
  const addItemDirectlyToCart = (
    item: Item, 
    customQty = 1, 
    customRate?: number, 
    customDisc = 0, 
    preSelectedSerial?: string,
    preSelectedBatch?: ItemBatch
  ) => {
    const qty = (typeof customQty === 'number' && !isNaN(customQty) && customQty !== 0) ? customQty : 1;
    let discount = showItemDiscount ? customDisc : 0;
    let discountType: 'flat' | 'percent' = config.ItemDiscountType === 'percent' ? 'percent' : 'flat';
    let appliedSchemeId: string | undefined;
    let appliedSchemeName: string | undefined;
    let originalRate: number | undefined;

    // FEFO Batch Auto-Selection for Pharmacy / Batch-managed items
    let selectedBatch: ItemBatch | undefined = preSelectedBatch;
    if (!selectedBatch && (item.isPharmacy === 'Y' || item.maintainBatch === 'Y' || (item.batches && item.batches.length > 0))) {
      const availableBatches = (item.batches || []).filter(b => (Number(b.currentStock) || 0) > 0);
      const batchListToUse = availableBatches.length > 0 ? availableBatches : (item.batches || []);
      if (batchListToUse.length > 0) {
        const sorted = [...batchListToUse].sort((a, b) => (a.expDate || '').localeCompare(b.expDate || ''));
        selectedBatch = sorted[0];
      }
    }

    let rate = customRate;
    if (rate === undefined) {
      if (selectedBatch) {
        if (pricingMode === 'wholesale' && config.EnableWholesalePrice !== 'false' && (Number(selectedBatch.wholesaleRate) || 0) > 0) {
          rate = Number(selectedBatch.wholesaleRate);
        } else {
          rate = Number(selectedBatch.saleRate) || getItemRate(item);
        }
      } else {
        rate = getItemRate(item);
      }
    }

    // Evaluate Schemes if no manual discount was explicitly supplied
    if (customDisc === 0 && qty > 0) {
      const bestScheme = findBestItemScheme(item, qty, 'pos');
      if (bestScheme) {
        appliedSchemeId = bestScheme.scheme.id;
        appliedSchemeName = bestScheme.badgeText;
        if (bestScheme.scheme.schemeType === 'percent_discount') {
          discount = bestScheme.discountPct;
          discountType = 'percent';
        } else if (bestScheme.scheme.schemeType === 'flat_discount') {
          discount = bestScheme.discountAmt;
          discountType = 'flat';
        } else if (bestScheme.scheme.schemeType === 'special_rate' && bestScheme.specialRate) {
          originalRate = rate;
          rate = bestScheme.specialRate;
        }
      }
    }

    const isZ = isCustomerGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
    const isPct = discountType === 'percent' || config.ItemDiscountType === 'percent';
    const lineDisc = isPct ? ((qty * rate) * discount / 100) : discount;
    const computedGstAmt = isZ ? 0 : round2(((qty * rate - lineDisc) * (Number(item['GST %']) || 0)) / 100);

    const existingIdx = cart.findIndex(l => 
      l.itemCode === item['Item Code'] && 
      (l.selectedSize || '') === (item.size || '') && 
      (l.selectedColor || '') === (item.color || '') &&
      (l.selectedBatchNo || '') === (selectedBatch?.batchNo || '') &&
      ((l.qty > 0 && qty > 0) || (l.qty < 0 && qty < 0))
    );
    let updatedCart = [...cart];
    let targetIndex = existingIdx;

    if (existingIdx > -1 && posSettings.autoIncrementQty) {
      const existingSerials = updatedCart[existingIdx].serials || [];
      if (preSelectedSerial && existingSerials.some(s => s.toLowerCase() === preSelectedSerial.toLowerCase())) {
        if (posSettings.enableSoundFeedback) playWarningTone();
        alert(`Serial Number "${preSelectedSerial}" is already added to the cart!`);
        return;
      }

      const newQty = updatedCart[existingIdx].qty + qty;
      let newRate = customRate !== undefined ? rate : updatedCart[existingIdx].rate;
      let newDisc = customDisc > 0 ? updatedCart[existingIdx].discount + discount : updatedCart[existingIdx].discount;
      let newSchemeId = updatedCart[existingIdx].appliedSchemeId;
      let newSchemeName = updatedCart[existingIdx].appliedSchemeName;

      // Re-evaluate scheme for new cumulative quantity
      if (customDisc === 0 && newQty > 0) {
        const bestScheme = findBestItemScheme(item, newQty, 'pos');
        if (bestScheme) {
          newSchemeId = bestScheme.scheme.id;
          newSchemeName = bestScheme.badgeText;
          if (bestScheme.scheme.schemeType === 'percent_discount') {
            newDisc = bestScheme.discountPct;
          } else if (bestScheme.scheme.schemeType === 'flat_discount') {
            newDisc = bestScheme.discountAmt;
          } else if (bestScheme.scheme.schemeType === 'special_rate' && bestScheme.specialRate) {
            newRate = bestScheme.specialRate;
          }
        }
      }

      const newIsZ = isCustomerGstExempted || String(updatedCart[existingIdx].zeroRated).toUpperCase() === 'Y';
      const newIsPct = (updatedCart[existingIdx].discountType || discountType) === 'percent';
      const newGrossDisc = newIsPct ? ((newQty * newRate) * newDisc / 100) : newDisc;
      const newGstAmt = newIsZ ? 0 : round2(((newQty * newRate - newGrossDisc) * (Number(updatedCart[existingIdx].gstPct) || 0)) / 100);
      const newSerials = preSelectedSerial ? [...existingSerials, preSelectedSerial] : existingSerials;

      updatedCart[existingIdx] = {
        ...updatedCart[existingIdx],
        qty: newQty,
        rate: newRate,
        discount: newDisc,
        appliedSchemeId: newSchemeId,
        appliedSchemeName: newSchemeName,
        gstAmt: newGstAmt,
        serials: newSerials,
        selectedBatchNo: selectedBatch?.batchNo || updatedCart[existingIdx].selectedBatchNo,
        selectedBatchExp: selectedBatch?.expDate || updatedCart[existingIdx].selectedBatchExp,
        selectedBatchId: selectedBatch?.id || updatedCart[existingIdx].selectedBatchId
      };
    } else {
      const newLine: CartLine = {
        itemCode: item['Item Code'],
        itemName: item['Item Name'],
        unit: item.Unit || 'Pcs',
        qty,
        rate,
        discount,
        discountType,
        appliedSchemeId,
        appliedSchemeName,
        originalRate,
        gstPct: Number(item['GST %']) || 0,
        zeroRated: item['Zero Rated (Y/N)'] || 'N',
        purchaseRate: selectedBatch ? (Number(selectedBatch.purchaseRate) || Number(item['Purchase Rate']) || 0) : (Number(item['Purchase Rate']) || 0),
        isSerialized: item['Is Serialized'],
        serials: preSelectedSerial ? [preSelectedSerial] : [],
        gstAmt: computedGstAmt,
        selectedSize: item.size || '',
        selectedColor: item.color || '',
        barcode: selectedBatch?.barcode || item.Barcode || '',
        selectedBatchNo: selectedBatch?.batchNo || '',
        selectedBatchExp: selectedBatch?.expDate || '',
        selectedBatchId: selectedBatch?.id || ''
      };
      updatedCart.push(newLine);
      targetIndex = updatedCart.length - 1;
    }

    setCart(updatedCart);

    // Audio Feedback
    if (posSettings.enableSoundFeedback) {
      playScanBeep();
    }

    // Stock Warning Tone if item <= 0 stock (only for sales, not returns)
    if (posSettings.warnLowStock && item['Maintain Stock'] !== 'N' && (Number(item['Current Stock']) <= 0) && qty > 0) {
      playWarningTone();
    }

    // Reset Entry Fields
    setEntrySearch('');
    setEntryCode('');
    setEntryQty(1);
    setEntryRate('');
    setEntryDisc('');
    setShowDropdown(false);
    setSelectedItemObj(null);

    // If serialized item and NO preSelectedSerial provided, prompt serials modal
    if (item['Is Serialized'] === 'Y' && showSerials && !preSelectedSerial) {
      setActiveSerialIndex(targetIndex);
      setSerialModalOpen(true);
    } else {
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 40);
    }
  };

  // Selecting an Item
  const selectItem = (item: Item, preSelectedSerial?: string, preSelectedBatch?: ItemBatch) => {
    setSelectedItemObj(item);
    
    let selectedRate: number;
    if (preSelectedBatch) {
      if (pricingMode === 'wholesale' && config.EnableWholesalePrice !== 'false' && (Number(preSelectedBatch.wholesaleRate) || 0) > 0) {
        selectedRate = Number(preSelectedBatch.wholesaleRate);
      } else {
        selectedRate = Number(preSelectedBatch.saleRate) || getItemRate(item);
      }
    } else {
      selectedRate = getItemRate(item);
    }

    if (posSettings.itemAddMode === 'direct' || preSelectedSerial || preSelectedBatch) {
      // ⚡ Direct Quick-Add Mode: Instantly add to cart with preSelectedSerial/Batch and keep focus on search
      addItemDirectlyToCart(item, 1, selectedRate, 0, preSelectedSerial, preSelectedBatch);
      setSelectedItemObj(null);
    } else {
      // 🎯 Step-by-Step Prompt Mode: Focus Qty -> Rate -> Disc -> Enter to add
      setEntrySearch(item['Item Name']);
      setEntryCode(item['Item Code']);
      setEntryRate(selectedRate);
      setEntryDisc('');
      setShowDropdown(false);
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 50);
    }
  };

  // Auto-return cursor pointer to Item Search field when mouse editing finishes or loses focus
  const handleFieldBlurReturnToSearch = () => {
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || active.tagName === 'BODY' || active === document.documentElement) {
        itemInputRef.current?.focus();
      }
    }, 70);
  };

  // Keyboard Navigation: Item Search Field
  const handleItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Alt+C: Quick Create New Item Master
    if (e.altKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      e.stopPropagation();
      if (onOpenNewItemModal) {
        setShowDropdown(false);
        onOpenNewItemModal(newItem => {
          selectItem(newItem);
          setEntrySearch('');
          setShowDropdown(false);
        });
      }
      return;
    }

    // Ctrl+P or Alt+P: Secret toggle Purchase Cost
    if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      const user = getActiveUser();
      const isAllowed = !user || user.role === 'Administrator' || user.role === 'Manager' || user.role === 'Accountant' || (user.role !== 'Cashier' && user.permissions?.some(p => p.display));
      if (isAllowed) {
        setShowPurchasePrice(prev => !prev);
      } else {
        setSecurityAlert(true);
        setTimeout(() => setSecurityAlert(false), 2500);
      }
      return;
    }

    if (e.key === 'Tab' && !entrySearch.trim()) {
      e.preventDefault();
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showDropdown && searchResults.length > 0) {
        setSelectedIndex(prev => (prev + 1 < searchResults.length ? prev + 1 : 0));
      } else if (!entrySearch.trim() && cart.length > 0) {
        // If search is empty and cart has items, jump right into cart table!
        cartQtyRefs.current[0]?.focus();
        cartQtyRefs.current[0]?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showDropdown && searchResults.length > 0) {
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : searchResults.length - 1));
      } else if (!entrySearch.trim() && cart.length > 0) {
        // Jump to last cart item
        const lastIdx = cart.length - 1;
        cartQtyRefs.current[lastIdx]?.focus();
        cartQtyRefs.current[lastIdx]?.select();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = entrySearch.trim();
      const searchLower = q.toLowerCase();

      if (!q) {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
        return;
      }

      // Check Serial Number Scan FIRST!
      try {
        const serialReport = getSerialNumbersStockReport();
        const matchedSerial = serialReport.find(s => s.serialNo.toLowerCase() === searchLower && s.status === 'In Stock');
        if (matchedSerial) {
          const item = expandedItems.find(i => i['Item Code'] === matchedSerial.itemCode);
          if (item) {
            selectItem(item, matchedSerial.serialNo);
            setEntrySearch('');
            setShowDropdown(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error scanning serial number in POS:', err);
      }

      // Check Exact Barcode, Item Code, Alias, or Batch Barcode/Batch No match
      let matchedExactItem: Item | undefined;
      let matchedExactBatch: ItemBatch | undefined;

      for (const i of expandedItems) {
        if (
          String(i.Barcode).toLowerCase() === searchLower || 
          String(i['Item Code']).toLowerCase() === searchLower ||
          (i['Alias'] && String(i['Alias']).toLowerCase() === searchLower)
        ) {
          matchedExactItem = i;
          break;
        }
        if (i.batches && i.batches.length > 0) {
          const bMatch = i.batches.find(b => 
            (b.barcode && b.barcode.toLowerCase() === searchLower) ||
            (b.batchNo && b.batchNo.toLowerCase() === searchLower)
          );
          if (bMatch) {
            matchedExactItem = i;
            matchedExactBatch = bMatch;
            break;
          }
        }
      }

      if (matchedExactItem) {
        selectItem(matchedExactItem, undefined, matchedExactBatch);
        setEntrySearch('');
        setShowDropdown(false);
        return;
      }

      // Synchronous live search for q to avoid stale async searchResults during rapid scanner typing
      const freshMatches = expandedItems.filter(item => {
        const name = (item['Item Name'] || '').toLowerCase();
        const code = (item['Item Code'] || '').toLowerCase();
        const barcode = (item['Barcode'] || '').toString().toLowerCase();
        const alias = (item['Alias'] || '').toLowerCase();
        return (
          name.includes(searchLower) ||
          code.includes(searchLower) ||
          barcode.includes(searchLower) ||
          alias.includes(searchLower)
        );
      });

      if (freshMatches.length > 0) {
        const idxToUse = (selectedIndex >= 0 && selectedIndex < freshMatches.length) ? selectedIndex : 0;
        const itemToSelect = freshMatches[idxToUse];
        selectItem(itemToSelect);
        setEntrySearch('');
        setShowDropdown(false);
      } else {
        // No item found for query q
        if (posSettings.enableSoundFeedback) playWarningTone();
        alert(`Item not found: "${q}"`);
        itemInputRef.current?.focus();
        itemInputRef.current?.select();
      }
    }
  };

  // Sequential Enter Key Handlers (Item -> Qty -> Rate -> Disc -> Add to Grid)
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      rateInputRef.current?.focus();
      rateInputRef.current?.select();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      itemInputRef.current?.focus();
    }
  };

  const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (showItemDiscount) {
        discInputRef.current?.focus();
        discInputRef.current?.select();
      } else {
        addEntryToCart();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }
  };

  const handleDiscKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEntryToCart();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      rateInputRef.current?.focus();
      rateInputRef.current?.select();
    }
  };

  // Add Item to Cart from Footer Form (Prompt Mode)
  const addEntryToCart = () => {
    const item = selectedItemObj ||
      (entryCode
        ? expandedItems.find(i => i['Item Code'] === entryCode)
        : expandedItems.find(i => i['Item Name'].toLowerCase() === entrySearch.trim().toLowerCase()));

    if (!item) {
      if (posSettings.enableSoundFeedback) playWarningTone();
      return;
    }

    const qty = (typeof entryQty === 'number' && entryQty !== 0)
      ? entryQty
      : (entryQty !== '' && entryQty !== '-' && !isNaN(Number(entryQty)) && Number(entryQty) !== 0)
        ? Number(entryQty)
        : 1;
    const rate = Number(entryRate) || 0;
    const discount = showItemDiscount ? (Number(entryDisc) || 0) : 0;

    addItemDirectlyToCart(item, qty, rate, discount);
    setSelectedItemObj(null);
  };

  // In-line Cart Table Keyboard Navigation & Manipulation
  const handleCartQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cart.length - 1) {
        cartQtyRefs.current[idx + 1]?.focus();
        cartQtyRefs.current[idx + 1]?.select();
      } else {
        itemInputRef.current?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        cartQtyRefs.current[idx - 1]?.focus();
        cartQtyRefs.current[idx - 1]?.select();
      } else {
        itemInputRef.current?.focus();
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      cartRateRefs.current[idx]?.focus();
      cartRateRefs.current[idx]?.select();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      itemInputRef.current?.focus();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const current = Number(cart[idx].qty) || 0;
      const next = current === -1 ? 1 : (current === 0 ? 1 : current + 1);
      setCartQtyText(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
      updateCartLine(idx, 'qty', next);
      if (posSettings.enableSoundFeedback) playScanBeep();
    } else if (e.key === '-') {
      const inputEl = cartQtyRefs.current[idx];
      const isAllSelected = inputEl && inputEl.selectionStart === 0 && inputEl.selectionEnd === inputEl.value.length;
      if (isAllSelected) {
        return;
      }
      if (inputEl && inputEl.selectionStart === 0 && !inputEl.value.includes('-')) {
        return;
      }
      e.preventDefault();
      const current = Number(cart[idx].qty) || 0;
      const next = current === 1 ? -1 : current - 1;
      setCartQtyText(prev => {
        const copy = { ...prev };
        delete copy[idx];
        return copy;
      });
      updateCartLine(idx, 'qty', next);
      if (posSettings.enableSoundFeedback) playScanBeep();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      removeCartLine(idx);
      if (posSettings.enableSoundFeedback) playWarningTone();
    }
  };

  const handleCartRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cartQtyRefs.current[idx]?.focus();
      cartQtyRefs.current[idx]?.select();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      if (showItemDiscount) {
        cartDiscRefs.current[idx]?.focus();
        cartDiscRefs.current[idx]?.select();
      } else {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cart.length - 1) {
        cartRateRefs.current[idx + 1]?.focus();
        cartRateRefs.current[idx + 1]?.select();
      } else {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        cartRateRefs.current[idx - 1]?.focus();
        cartRateRefs.current[idx - 1]?.select();
      } else {
        itemInputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      itemInputRef.current?.focus();
    }
  };

  const handleCartDiscKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cartRateRefs.current[idx]?.focus();
      cartRateRefs.current[idx]?.select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      itemInputRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cart.length - 1) {
        cartDiscRefs.current[idx + 1]?.focus();
        cartDiscRefs.current[idx + 1]?.select();
      } else {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        cartDiscRefs.current[idx - 1]?.focus();
        cartDiscRefs.current[idx - 1]?.select();
      } else {
        itemInputRef.current?.focus();
      }
    }
  };

  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'discount', val: number) => {
    const updated = [...cart];
    updated[index][field] = val;

    if (field === 'qty') {
      const matchingItem = items.find(i => i['Item Code'] === updated[index].itemCode);
      if (matchingItem && val > 0) {
        const schemeDate = editingInvoiceDate ? new Date(editingInvoiceDate) : new Date();
        const bestScheme = findBestItemScheme(matchingItem, val, 'pos', schemeDate)
          || findBestItemScheme(matchingItem, val, 'pos', new Date());
        if (bestScheme) {
          updated[index].appliedSchemeId = bestScheme.scheme.id;
          updated[index].appliedSchemeName = bestScheme.badgeText;
          if (bestScheme.scheme.schemeType === 'percent_discount') {
            updated[index].discount = bestScheme.discountPct;
            updated[index].discountType = 'percent';
          } else if (bestScheme.scheme.schemeType === 'flat_discount') {
            updated[index].discount = bestScheme.discountAmt;
            updated[index].discountType = 'flat';
          } else if (bestScheme.scheme.schemeType === 'special_rate' && bestScheme.specialRate) {
            if (!updated[index].originalRate) {
              updated[index].originalRate = updated[index].rate;
            }
            updated[index].rate = bestScheme.specialRate;
          }
        } else if (updated[index].appliedSchemeId) {
          updated[index].appliedSchemeId = undefined;
          updated[index].appliedSchemeName = undefined;
          updated[index].discount = 0;
          if (updated[index].originalRate) {
            updated[index].rate = updated[index].originalRate!;
            updated[index].originalRate = undefined;
          }
        }
      }
    } else if (field === 'discount') {
      updated[index].appliedSchemeId = undefined;
      updated[index].appliedSchemeName = undefined;
    }

    setCart(updated);
    if (field === 'qty' && updated[index].isSerialized === 'Y' && showSerials && val > 0) {
      setActiveSerialIndex(index);
      setSerialModalOpen(true);
    }
  };

  const removeSchemeFromLine = (index: number) => {
    const updated = [...cart];
    updated[index].appliedSchemeId = undefined;
    updated[index].appliedSchemeName = undefined;
    updated[index].discount = 0;
    if (updated[index].originalRate) {
      updated[index].rate = updated[index].originalRate!;
      updated[index].originalRate = undefined;
    }
    setCart(updated);
  };

  const removeCartLine = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
    setCartQtyText({});
    if (updated.length > 0) {
      const nextIdx = Math.min(index, updated.length - 1);
      setTimeout(() => {
        cartQtyRefs.current[nextIdx]?.focus();
        cartQtyRefs.current[nextIdx]?.select();
      }, 30);
    } else {
      setTimeout(() => itemInputRef.current?.focus(), 30);
    }
  };

  // Payment Calculation & Manual Entry
  const balance = totals.total - (Number(cash) || 0) - (Number(bank1) || 0) - (Number(bank2) || 0);

  const handleCashInput = (val: number | '') => {
    setCash(val);
    const isCashCustomer = !customerName || customerName.toLowerCase().includes('cash');
    if (isCashCustomer) {
      const c = Number(val) || 0;
      if (c < totals.total) {
        setBank1(totals.total - c);
        setBank2('');
      } else {
        setBank1('');
        setBank2('');
      }
    }
  };

  const handleBank1Input = (val: number | '') => {
    setBank1(val);
    const isCashCustomer = !customerName || customerName.toLowerCase().includes('cash');
    if (isCashCustomer) {
      const c = Number(cash) || 0;
      const b1 = Number(val) || 0;
      if (c + b1 < totals.total) {
        setBank2(totals.total - c - b1);
      } else {
        setBank2('');
      }
    }
  };

  const handleBank2Input = (val: number | '') => {
    setBank2(val);
  };

  const checkAndPromptPOSBankTxn = (field: 'bank1' | 'bank2') => {
    const amount = field === 'bank1' ? Number(bank1) : Number(bank2);
    const existingId = field === 'bank1' ? bankTxnNo : bank2TxnNo;
    const ledgerName = field === 'bank1' ? (config.Bank1Ledger || 'Bank Account 1') : (config.Bank2Ledger || 'Bank Account 2');
    if (amount > 0 && !existingId) {
      setTargetBankField(field);
      setActiveBankLedgerName(ledgerName);
      setBankTxnModalOpen(true);
      return true;
    }
    return false;
  };

  // Quick Tender Presets (e.g. Exact, +50, +100, +500, +1000, Round Up)
  const applyQuickTender = (amount: number) => {
    handleCashInput(amount);
    if (posSettings.enableSoundFeedback) playScanBeep();
  };

  const applyRoundUpTender = () => {
    const total = totals.total;
    if (total <= 0) return;
    let roundUp = Math.ceil(total / 100) * 100;
    if (roundUp === total && total % 100 === 0) {
      roundUp += 100;
    }
    applyQuickTender(roundUp);
  };

  // Hold / Resume Bill
  const handleHoldBill = () => {
    if (cart.length === 0) return;
    const name = customerName.trim() || 'Walk-in';
    holdBill(name, cart, totals.discountValue, billDiscountType);
    setCart([]);
    setCustomerName('');
    setWalkInDetails(null);
    setBillDiscount('');
    setBillDiscountType(config.BillDiscountType || 'flat');
    onDataRefresh();
    if (posSettings.enableSoundFeedback) playScanBeep();
    setTimeout(() => itemInputRef.current?.focus(), 30);
  };

  const handleResumeBill = (id: string) => {
    const res = resumeBill(id);
    if (res.ok) {
      setCart(res.cart);
      setCustomerName(res.customerName === 'Walk-in' ? '' : res.customerName);
      if (res.billDiscount && res.billDiscount > 0) {
        setBillDiscount(res.billDiscount);
      } else {
        setBillDiscount('');
      }
      setBillDiscountType(res.billDiscountType || 'flat');
      onDataRefresh();
      if (posSettings.enableSoundFeedback) playScanBeep();
      setTimeout(() => itemInputRef.current?.focus(), 30);
    }
  };

  const handleDeleteHold = (id: string) => {
    deleteHeldBill(id);
    onDataRefresh();
  };

  const [showAcceptModal, setShowAcceptModal] = useState<'print' | 'whatsapp' | 'email' | 'save_only' | 'share_pdf' | 'download_pdf' | false>(false);
  const [showOfflineRestrictedModal, setShowOfflineRestrictedModal] = useState(false);
  const [offlineRestrictedReason, setOfflineRestrictedReason] = useState('');

  // Checkout Handler
  const handleCheckout = async (
    actionType: 'print' | 'whatsapp' | 'email' | 'save_only' | 'share_pdf' | 'download_pdf' = 'print',
    bypassConfirm: boolean = false
  ) => {
    if (cart.length === 0 || isSubmitting) return;

    // Single Master Offline Billing Enforcement
    const offlineCheck = canCurrentDeviceBillOffline();
    if (!offlineCheck.allowed) {
      setOfflineRestrictedReason(offlineCheck.reason || 'Offline billing is restricted to the designated Master Counter.');
      setShowOfflineRestrictedModal(true);
      return;
    }

    if (!bypassConfirm) {
      setShowAcceptModal(actionType);
      return;
    }

    let custLedger = customerName.trim();
    let name = 'Cash Customer';
    let gstNo = '';
    let tpnNo = '';
    let address = '';
    let phone = '';
    let email = '';

    if (!custLedger && walkInDetails) {
      name = walkInDetails.name;
      gstNo = walkInDetails.gst;
      address = walkInDetails.address;
      phone = walkInDetails.phone;
      custLedger = 'Cash Customer';
    } else if (custLedger) {
      name = custLedger;
      const matched = ledgers.find(l => l['Ledger Name'] === custLedger);
      if (matched) {
        gstNo = matched['GST No'] || '';
        tpnNo = matched['TPN No'] || '';
        address = matched.Address || '';
        phone = matched['Contact No'] || '';
        email = matched.Email || '';
      }
    } else {
      custLedger = 'Cash Customer';
    }

    const payData: PaymentDetails = {
      cash: Number(cash) || 0,
      bank1: Number(bank1) || 0,
      bank2: Number(bank2) || 0,
      bank1Ledger: config.Bank1Ledger || 'BOB Account',
      bank2Ledger: config.Bank2Ledger || 'BNBL Account',
      bankTxnNo: bankTxnNo.trim() || undefined,
      bank2TxnNo: bank2TxnNo.trim() || undefined
    };

    const customer: CustomerDetails = {
      ledger: custLedger,
      name,
      gstNo,
      tpnNo,
      address,
      phone,
      email
    };

    if (balance > 0.005 && (!custLedger || custLedger.toLowerCase().includes('cash'))) {
      if (posSettings.enableSoundFeedback) playWarningTone();
      alert('Walk-in cash customer requires full settlement.');
      return;
    }

    setIsSubmitting(true);
    const result = saveSalesInvoice({
      cart,
      payment: payData,
      customer,
      billDiscount: totals.discount,
      billDiscountValue: totals.discountValue,
      appliedBillSchemeName: totals.appliedBillSchemeName,
      voucherTypeId: activeVoucherType?.id,
      voucherTypeName: activeVoucherType?.name,
      originalInvoiceNo: editingInvoiceNo || undefined,
      date: editingInvoiceDate || (posBillDate ? new Date(posBillDate + 'T12:00:00').toISOString() : undefined),
      isEdit: Boolean(editingInvoiceNo),
      isPOS: true
    });

    setIsSubmitting(false);

    if (result && (result as any).ok === false) {
      alert((result as any).error || 'Failed to save sales invoice.');
      return;
    }
    
    setEditingInvoiceNo(null);
    setEditingInvoiceDate(null);
    setPosBillDate(new Date().toISOString().split('T')[0]);
    setTimeout(() => {
      try {
        setPosBillNo(peekNextInvoiceNumber(true, activeVoucherType?.id));
      } catch {}
    }, 50);

    if (result) {
      // Audio Chime
      if (posSettings.enableSoundFeedback) {
        playSuccessChime();
      }

      const savedInv = result as unknown as SalesInvoice;
      setLastSavedInvoice(savedInv);

      // Handle Direct Actions (WhatsApp, Email, Save Only, Print)
      const showGst = String(config.EnableGST) !== 'false';
      const currency = config.CurrencySymbol || 'Nu.';

      if (actionType === 'whatsapp') {
        const lines = [
          `🧾 *TAX INVOICE: ${savedInv.invoiceNo}*`,
          `🏪 *${config.CompanyName || 'Retail Store'}*`,
          config.Address ? `📍 ${config.Address}` : '',
          showGst && config.CompanyGSTNo ? `🏛 GSTIN: ${config.CompanyGSTNo}` : '',
          `📅 Date: ${new Date(savedInv.date).toLocaleString()}`,
          `👤 Customer: ${savedInv.customer?.name || 'Walk-in Cash Customer'}`,
          savedInv.customer?.phone ? `📞 Phone: ${savedInv.customer.phone}` : '',
          '--------------------------------',
          '*ITEMS:*',
          ...savedInv.items.map(item => {
            const saleAmt = Number(
              item['Taxable Value'] !== undefined
                ? item['Taxable Value']
                : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
            ).toFixed(2);
            const gstInfo = showGst ? ` | GST: ${currency} ${Number(item['GST Amount'] || 0).toFixed(2)}` : '';
            return `• *${item['Item Name']}* (${item.Qty} ${item.Unit || 'Pcs'} @ ${currency} ${Number(item.Rate).toFixed(2)}) | Sale Amt: ${currency} ${saleAmt}${gstInfo} | Total: ${currency} ${Number(item['Line Total']).toFixed(2)}`;
          }),
          '--------------------------------',
          showGst ? `Taxable Sale: ${currency} ${savedInv.taxable.toFixed(2)}` : '',
          showGst ? `Exempted Sale: ${currency} ${savedInv.zeroRated.toFixed(2)}` : '',
          showGst ? `GST Amount: ${currency} ${savedInv.gstAmt.toFixed(2)}` : '',
          (savedInv.discount && savedInv.discount > 0) ? `Subtotal: ${currency} ${(savedInv.subtotal || (savedInv.total + savedInv.discount)).toFixed(2)}` : '',
          (savedInv.discount && savedInv.discount > 0) ? `Bill Discount: -${currency} ${savedInv.discount.toFixed(2)}` : '',
          `*GRAND TOTAL: ${currency} ${savedInv.total.toFixed(2)}*`,
          '--------------------------------',
          `Paid: Cash ${currency} ${savedInv.cash.toFixed(2)} | Bank ${currency} ${(savedInv.bank1 + savedInv.bank2).toFixed(2)}${savedInv.bankTxnNo ? ` (Txn Ref: ${savedInv.bankTxnNo})` : ''}`,
          savedInv.credit > 0 ? `⚠️ *Credit Balance Due: ${currency} ${savedInv.credit.toFixed(2)}*` : '✅ *Status: Fully Paid*',
          config.CompanyBankDetails ? `\n*Bank Details:*\n${config.CompanyBankDetails}` : '',
          `\nThank you for shopping with ${config.CompanyName || 'us'}! Visit Again.`
        ].filter(Boolean);

        const message = encodeURIComponent(lines.join('\n'));
        const cleanPhone = (savedInv.customer?.phone || '').replace(/[^0-9]/g, '');
        let url = `https://wa.me/?text=${message}`;
        if (cleanPhone && cleanPhone.length >= 7) {
          url = `https://wa.me/${cleanPhone}?text=${message}`;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
        setReceiptModalOpen(true);
      } else if (actionType === 'email') {
        const lines = [
          `TAX INVOICE: ${savedInv.invoiceNo}`,
          `${config.CompanyName || 'Retail Store'}`,
          config.Address ? `Address: ${config.Address}` : '',
          showGst && config.CompanyGSTNo ? `GSTIN: ${config.CompanyGSTNo}` : '',
          `Date: ${new Date(savedInv.date).toLocaleString()}`,
          `Customer: ${savedInv.customer?.name || 'Walk-in Cash Customer'}`,
          '--------------------------------',
          'ITEMS:',
          ...savedInv.items.map(item => {
            const saleAmt = Number(
              item['Taxable Value'] !== undefined
                ? item['Taxable Value']
                : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
            ).toFixed(2);
            const gstInfo = showGst ? ` | GST: ${currency} ${Number(item['GST Amount'] || 0).toFixed(2)}` : '';
            return `• ${item['Item Name']} (${item.Qty} ${item.Unit || 'Pcs'} @ ${currency} ${Number(item.Rate).toFixed(2)}) | Sale Amt: ${currency} ${saleAmt}${gstInfo} | Total: ${currency} ${Number(item['Line Total']).toFixed(2)}`;
          }),
          '--------------------------------',
          showGst ? `Taxable Sale: ${currency} ${savedInv.taxable.toFixed(2)}` : '',
          showGst ? `Exempted Sale: ${currency} ${savedInv.zeroRated.toFixed(2)}` : '',
          showGst ? `GST Amount: ${currency} ${savedInv.gstAmt.toFixed(2)}` : '',
          (savedInv.discount && savedInv.discount > 0) ? `Subtotal: ${currency} ${(savedInv.subtotal || (savedInv.total + savedInv.discount)).toFixed(2)}` : '',
          (savedInv.discount && savedInv.discount > 0) ? `Bill Discount: -${currency} ${savedInv.discount.toFixed(2)}` : '',
          `GRAND TOTAL: ${currency} ${savedInv.total.toFixed(2)}`,
          '--------------------------------',
          `Paid: Cash ${currency} ${savedInv.cash.toFixed(2)} | Bank ${currency} ${(savedInv.bank1 + savedInv.bank2).toFixed(2)}${savedInv.bankTxnNo ? ` (Txn Ref: ${savedInv.bankTxnNo})` : ''}`,
          savedInv.credit > 0 ? `Credit Balance Due: ${currency} ${savedInv.credit.toFixed(2)}` : 'Status: Fully Paid',
          `\nThank you for choosing ${config.CompanyName || 'us'}!`
        ].filter(Boolean);

        const email = savedInv.customer?.email || '';
        const subject = encodeURIComponent(`Tax Invoice #${savedInv.invoiceNo} - ${config.CompanyName || 'Store'}`);
        const body = encodeURIComponent(lines.join('\n'));
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        setReceiptModalOpen(true);
      } else if (actionType === 'share_pdf') {
        const doc = generateInvoicePDF(savedInv, config);
        const filename = `Invoice_${savedInv.invoiceNo}.pdf`;
        await shareOrDownloadPDF(
          doc,
          filename,
          `Tax Invoice #${savedInv.invoiceNo} - ${config.CompanyName || 'Store'}`
        );
        setReceiptModalOpen(true);
      } else if (actionType === 'download_pdf') {
        const doc = generateInvoicePDF(savedInv, config);
        doc.save(`Invoice_${savedInv.invoiceNo}.pdf`);
        setReceiptModalOpen(true);
      } else if (actionType === 'save_only') {
        // Instant save, no modal
      } else {
        // Print action (F2 / primary checkout)
        setReceiptModalOpen(true);
      }

      setCart([]);
      setCustomerName('');
      setWalkInDetails(null);
      setCash('');
      setBank1('');
      setBank2('');
      setBankTxnNo('');
      setBank2TxnNo('');
      setBillDiscount('');
      setMobileTab('cart');
      onDataRefresh();
      onDataRefresh();

      if (actionType === 'save_only' || !posSettings.autoPrintReceipt) {
        setTimeout(() => itemInputRef.current?.focus(), 50);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      {/* Active Altering Invoice Banner */}
      {editingInvoiceNo && (
        <div className="shrink-0 flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Altering Sales Invoice: <strong className="font-mono font-bold text-amber-950 text-sm">{editingInvoiceNo}</strong></span>
          </div>
          <button
            type="button"
            onClick={() => {
              loadedTargetKeyRef.current = null;
              setEditingInvoiceNo(null);
              setEditingInvoiceDate(null);
              setCart([]);
              setCustomerName('');
              setWalkInDetails(null);
              setCash('');
              setBank1('');
              setBank2('');
              setBillDiscount('');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] hover:bg-amber-100 transition cursor-pointer shadow-2xs"
          >
            <span>Discard Alteration &amp; New Sale</span>
          </button>
        </div>
      )}

      {/* Header & Quick Summary Bar */}
      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
            <ShoppingCart className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">POS Billing / Sale</h1>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded text-[10px] font-bold">
                {activeVoucherType?.name || 'Sale'}
              </span>
              {pricingMode === 'wholesale' && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-extrabold animate-pulse">
                  Wholesale Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Quick Retail Entry (Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1 py-0.2 text-[10px] font-mono font-bold">F2</kbd> to Save)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Bill No & Date Indicator */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
              <Receipt className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bill No</span>
              <span className="font-mono text-xs font-black text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                {editingInvoiceNo || posBillNo || 'Auto'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Terminal</span>
              <select
                value={deviceCounterId}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalDeviceCounterId(val);
                  setDeviceCounterId(val);
                }}
                className="bg-white border border-indigo-200 text-indigo-900 text-xs font-bold font-mono rounded px-1.5 py-0.5 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                title="Local Terminal / Counter Identifier (For offline multi-device safety without creating extra voucher types)"
              >
                {allowedTerminals.map(term => (
                  <option key={term.code || term.id} value={term.code || term.id}>
                    {term.name || `${term.tag} (${term.code})`}
                  </option>
                ))}
              </select>
              {!isSystemOnline() && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg flex items-center gap-1 border ${
                  canCurrentDeviceBillOffline().allowed
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-indigo-100 text-indigo-950 border-indigo-300'
                }`}>
                  {canCurrentDeviceBillOffline().allowed ? (
                    <span>⚡ Offline Master</span>
                  ) : (
                    <span>🔍 Price Check Only</span>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</span>
              <input
                type="date"
                value={posBillDate}
                onChange={(e) => setPosBillDate(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 cursor-pointer shadow-2xs"
                title="POS Bill Date (Click to adjust)"
              />
            </div>
          </div>

          {/* Retail / Wholesale Toggle Button */}
          {config.EnableWholesalePrice !== 'false' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handlePricingModeChange('retail')}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                  pricingMode === 'retail'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Retail
              </button>
              <button
                type="button"
                onClick={() => handlePricingModeChange('wholesale')}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg transition cursor-pointer ${
                  pricingMode === 'wholesale'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Wholesale
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOffersModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-xl bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition shadow-2xs cursor-pointer"
            title="View Active Schemes & Offers (Alt+O)"
          >
            <Tags className="h-3.5 w-3.5 text-amber-600" />
            <span>Offers</span>
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {getAllActiveSchemes('pos').length}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile-only switcher between Cart and Checkout */}
      <div className="flex sm:hidden flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs">
          <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
            <Receipt className="h-3 w-3 text-indigo-600" />
            <span>Bill: {editingInvoiceNo || posBillNo || 'Auto'}</span>
          </span>
          <span className="text-slate-600 text-[11px] font-semibold flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <span>{posBillDate}</span>
          </span>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-1 text-xs font-black rounded-lg transition ${
              mobileTab === 'cart'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Cart ({cart.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('payment')}
            className={`flex-1 py-1 text-xs font-black rounded-lg transition ${
              mobileTab === 'payment'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            Pay ({config.CurrencySymbol || 'Nu.'} {totals.total.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Sale Screen & Right Checkout Screen */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch flex-1 min-h-0 w-full overflow-hidden">
        {/* Left Workspace: Selecting Item on Top & Populated List Below */}
        <div className={`flex-1 min-w-0 flex flex-col gap-2 h-full overflow-hidden ${mobileTab === 'payment' ? 'hidden sm:flex' : 'flex'}`}>

          {/* 1. SELECTING ITEM OPTION (ON TOP) */}
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-xs relative">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Item / Barcode Search Input with scanner icon */}
              <div className="relative flex-1 min-w-[200px]">
                <div className="relative flex items-center">
                  <div className="absolute left-2.5 text-indigo-600 pointer-events-none flex items-center">
                    <Barcode className="h-4 w-4" />
                  </div>
                  <input
                    ref={itemInputRef}
                    type="text"
                    autoComplete="off"
                    value={entrySearch}
                    onChange={e => handleSearchChange(e.target.value)}
                    onKeyDown={handleItemKeyDown}
                    placeholder={
                      posSettings.itemAddMode === 'direct'
                        ? '⚡ Scan Barcode / Search (Direct Add)...'
                        : 'Scan Barcode or Search Item (F3 or /)...'
                    }
                    className="w-full h-9 pl-8 pr-14 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    {selectedItemObj && (selectedItemObj.size || selectedItemObj.color) && (
                      <div className="flex items-center gap-1 mr-1">
                        {selectedItemObj.size && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-900 border border-purple-200 shrink-0">
                            Size: {selectedItemObj.size}
                          </span>
                        )}
                        {selectedItemObj.color && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-pink-100 text-pink-900 border border-pink-200 shrink-0">
                            Color: {selectedItemObj.color}
                          </span>
                        )}
                      </div>
                    )}
                    <kbd className="hidden md:inline-block bg-slate-100 border border-slate-200 text-slate-400 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold">F3</kbd>
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(true)}
                      title="POS Settings (Alt+S)"
                      className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dropdown Results Popup (Floated Below Search Input) */}
                {showDropdown && (
                  <div className="absolute left-0 top-full mt-1 z-[999] w-[340px] sm:w-[420px] md:w-[460px] max-w-[92vw] max-h-[280px] shadow-2xl flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white animate-in fade-in zoom-in-95 duration-150">
                    <div className="shrink-0 bg-slate-800 text-white px-2.5 py-1 text-xs font-bold shadow-md z-20 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span>List of Stock Items</span>
                        <span className="text-[10px] text-slate-300 font-normal bg-slate-700/80 px-1.5 py-0.2 rounded border border-slate-600">
                          Ctrl+P: Cost
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Select (Enter)</span>
                    </div>

                    {securityAlert && (
                      <div className="shrink-0 bg-rose-600 text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between animate-in fade-in">
                        <span>🔒 Access Denied: Only Admin/Manager can view purchase cost</span>
                      </div>
                    )}

                    {!entrySearch.trim() && (
                      <div
                        onClick={() => {
                          setShowDropdown(false);
                          setEntrySearch('');
                          cashInputRef.current?.focus();
                          cashInputRef.current?.select();
                        }}
                        className="shrink-0 z-20 flex items-center px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 transition cursor-pointer border-b border-amber-300 shadow-2xs select-none"
                      >
                        <div className="flex-1 text-center uppercase tracking-wide">
                          -- End of List --
                        </div>
                      </div>
                    )}

                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                      {onOpenNewItemModal && (
                        <div
                          onClick={() => {
                            onOpenNewItemModal(item => {
                              selectItem(item);
                              setEntrySearch('');
                              setShowDropdown(false);
                            });
                          }}
                          className="flex items-center gap-2 px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 transition cursor-pointer border-b border-indigo-100"
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" />
                          <span>+ Create New Item Master</span>
                          <kbd className="ml-auto rounded bg-white px-1.5 py-0.5 text-[9px] font-mono border border-indigo-200 text-indigo-700">Alt+C</kbd>
                        </div>
                      )}
                      {searchResults.map((item, idx) => {
                        const isZeroStk = item['Maintain Stock'] !== 'N' && Number(item['Current Stock']) <= 0;
                        const matchedSn = (item as any).matchedSerial;
                        const partNo = getItemPartNumber(item);
                        const rackLoc = getItemRackLocation(item);
                        const compat = getItemCompatibility(item);

                        return (
                          <div
                            key={item['Item Code']}
                            onClick={() => selectItem(item, matchedSn)}
                            className={`px-2.5 py-1 text-xs cursor-pointer flex justify-between items-center transition ${
                              idx === selectedIndex ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                          <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5 pr-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold truncate">{item['Item Name']}</span>
                              {item.size && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                  idx === selectedIndex ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 text-purple-800 border border-purple-200'
                                }`}>
                                  Size: {item.size}
                                </span>
                              )}
                              {item.color && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                  idx === selectedIndex ? 'bg-pink-800 text-pink-100' : 'bg-pink-100 text-pink-800 border border-pink-200'
                                }`}>
                                  Color: {item.color}
                                </span>
                              )}
                              {matchedSn && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold shrink-0 ${
                                  idx === selectedIndex ? 'bg-indigo-800 text-indigo-100' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  SN: {matchedSn}
                                </span>
                              )}
                              {item.Unit && (
                                <span className={`text-[10px] font-normal shrink-0 ${idx === selectedIndex ? 'text-indigo-200' : 'text-slate-400'}`}>
                                  ({item.Unit})
                                </span>
                              )}
                              {isZeroStk && (
                                <span className={`text-[9px] px-1 py-0.2 rounded font-semibold shrink-0 ${
                                  idx === selectedIndex ? 'bg-rose-800 text-rose-100' : 'bg-rose-100 text-rose-700'
                                }`}>
                                  Low
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            {showPurchasePrice && (
                              <span className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded border ${
                                idx === selectedIndex
                                  ? 'bg-amber-800 border-amber-600 text-amber-100'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}>
                                P.Cost: {config.CurrencySymbol || 'Nu.'} {Number(item['Purchase Rate'] || 0).toFixed(2)}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              idx === selectedIndex
                                ? 'bg-indigo-700 text-indigo-100'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              Stk: {item['Maintain Stock'] === 'N' ? 'N/A' : item['Current Stock']}
                            </span>
                            <span className="font-extrabold whitespace-nowrap text-xs">
                              {config.CurrencySymbol || 'Nu.'} {Number(item['Sale Rate'] || 0).toFixed(2)}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItemForInfo(item);
                              }}
                              className={`p-1 rounded transition cursor-pointer flex items-center gap-0.5 text-[10px] font-bold ml-1 ${
                                idx === selectedIndex
                                  ? 'bg-white/20 text-white hover:bg-white/30'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                              }`}
                              title="View Full Item Details, Prices & Bin/Rack Info"
                            >
                              <Info className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Info</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>

              {/* Numeric Controls Row */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Qty Input */}
                <div className="w-16">
                  <input
                    ref={qtyInputRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Qty"
                    value={entryQty === 0 ? '' : entryQty}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                        setEntryQty(val);
                      }
                    }}
                    onFocus={e => e.target.select()}
                    onBlur={() => {
                      handleFieldBlurReturnToSearch();
                      if (entryQty === '' || entryQty === '-' || isNaN(Number(entryQty))) {
                        setEntryQty(1);
                      }
                    }}
                    onKeyDown={handleQtyKeyDown}
                    title="Quantity (type '-' for return item, Enter to advance)"
                    className={`w-full text-center h-9 rounded-xl border px-1 text-xs font-bold outline-none shadow-2xs transition ${
                      Number(entryQty) < 0
                        ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  />
                </div>

                {/* Rate Input */}
                <div className="w-20 sm:w-22">
                  <input
                    ref={rateInputRef}
                    type="number"
                    step="any"
                    placeholder="Rate"
                    value={entryRate === 0 ? '' : entryRate}
                    onChange={e => setEntryRate(e.target.value === '' ? '' : Number(e.target.value) === 0 ? '' : Number(e.target.value))}
                    onFocus={e => e.target.select()}
                    onBlur={handleFieldBlurReturnToSearch}
                    onKeyDown={handleRateKeyDown}
                    title="Rate (Enter to advance)"
                    className="w-full text-right h-9 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                  />
                </div>

                {/* Disc Input (Rendered if showItemDiscount is true) */}
                {showItemDiscount && (
                  <div className="w-16">
                    <input
                      ref={discInputRef}
                      type="number"
                      step="any"
                      placeholder="Disc"
                      value={entryDisc === 0 ? '' : entryDisc}
                      onChange={e => setEntryDisc(e.target.value === '' ? '' : Number(e.target.value) === 0 ? '' : Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      onBlur={handleFieldBlurReturnToSearch}
                      onKeyDown={handleDiscKeyDown}
                      title="Item Discount (Enter to advance)"
                      className="w-full text-right h-9 rounded-xl border border-slate-300 bg-white px-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
                    />
                  </div>
                )}

                {/* Line Amount Preview */}
                <div className="min-w-[65px] text-right px-1 font-black text-slate-800 text-xs sm:text-sm font-mono">
                  {(((Number(entryQty) || 0) * (Number(entryRate) || 0)) - (showItemDiscount ? (Number(entryDisc) || 0) : 0)).toFixed(2)}
                </div>

                {/* Add Button */}
                <button
                  type="button"
                  onClick={addEntryToCart}
                  title="Add to Grid (Enter)"
                  className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Add</span>
                  <span className="font-mono text-[10px] opacity-80">⏎</span>
                </button>
              </div>
            </div>
          </div>

          {/* Held Bills Bar (if any) */}
          {heldBills.length > 0 && (
            <div className="shrink-0 flex items-center gap-2 overflow-x-auto py-0.5">
              <span className="text-xs font-bold text-amber-700 whitespace-nowrap">Held Bills (F9):</span>
              {heldBills.map(h => (
                <div
                  key={h.holdId}
                  onClick={() => handleResumeBill(h.holdId)}
                  className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-full px-3 py-0.5 text-xs font-semibold text-amber-800 cursor-pointer hover:bg-amber-100 transition whitespace-nowrap shadow-2xs"
                >
                  <Pause className="h-3 w-3 text-amber-600" />
                  <span>{h.customerName}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeleteHold(h.holdId);
                    }}
                    className="ml-1 text-rose-600 hover:text-rose-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 2. POPULATED ITEM LIST (BELOW SELECTION) */}
          <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full border-collapse text-xs sm:text-sm table-fixed">
                <colgroup>
                  {showItemDiscount ? (
                    <>
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: '32%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  )}
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 text-slate-200 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-1.5 px-2.5 text-left">Item Name</th>
                    <th className="py-1.5 px-1 text-center">QTY</th>
                    <th className="py-1.5 px-1 text-center">UNIT</th>
                    <th className="py-1.5 px-1 text-right">Rate</th>
                    {showItemDiscount && <th className="py-1.5 px-1 text-right">Disc</th>}
                    <th className="py-1.5 px-2 text-right">GST</th>
                    <th className="py-1.5 px-2.5 text-right">Amount</th>
                    <th className="py-1.5 px-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={showItemDiscount ? 7 : 6} className="py-10 text-center text-slate-400 italic">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-1.5 text-slate-300 stroke-1" />
                        Cart is empty. Select or scan items above to add.
                        <div className="mt-1 text-[10px] text-slate-500 font-medium">
                          Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1 py-0.2 font-mono">F3</kbd> or <kbd className="bg-slate-100 border border-slate-300 rounded px-1 py-0.2 font-mono">/</kbd> to focus barcode search.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((line, idx) => {
                                            let lineDisc = 0;
                      if (showItemDiscount) {
                        const rawDisc = Number(line.discount) || 0;
                        lineDisc = config.ItemDiscountType === 'percent' ? ((line.qty * line.rate) * rawDisc / 100) : rawDisc;
                      }
                      const lineGross = (line.qty * line.rate) - lineDisc;
                      const isZero = isCustomerGstExempted || line.zeroRated === 'Y';
                      const lineTax = isZero ? 0 : round2(lineGross * line.gstPct / 100);
                      const lineTotal = lineGross + lineTax;
                      const itemData = items.find(i => i['Item Code'] === line.itemCode);
                      const isLowStock = posSettings.warnLowStock && itemData && itemData['Maintain Stock'] !== 'N' && Number(itemData['Current Stock']) <= 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition group">
                          {/* Item Name */}
                          <td className="py-0.5 px-2 align-middle font-medium text-slate-800 break-words">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{line.itemName}</span>
                                {line.qty < 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const posQty = Math.abs(line.qty) || 1;
                                      updateCartLine(idx, 'qty', posQty);
                                      setCartQtyText(prev => {
                                        const c = { ...prev };
                                        delete c[idx];
                                        return c;
                                      });
                                    }}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200 transition cursor-pointer"
                                    title="Returned Item (Click to toggle back to Sale)"
                                  >
                                    ↩ RETURN
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const negQty = -Math.abs(line.qty) || -1;
                                      updateCartLine(idx, 'qty', negQty);
                                      setCartQtyText(prev => {
                                        const c = { ...prev };
                                        delete c[idx];
                                        return c;
                                      });
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-[9px] font-semibold text-rose-600 hover:bg-rose-50 px-1 py-0.2 rounded border border-rose-200 transition cursor-pointer"
                                    title="Click to mark as Customer Return (- Qty)"
                                  >
                                    Mark Return
                                  </button>
                                )}
                                {line.selectedSize && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] font-bold rounded bg-purple-100 text-purple-900 border border-purple-200">
                                    Size: {line.selectedSize}
                                  </span>
                                )}
                                {line.selectedColor && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] font-bold rounded bg-pink-100 text-pink-900 border border-pink-200">
                                    Color: {line.selectedColor}
                                  </span>
                                )}
                                {(line.selectedBatchNo || (itemData && (itemData.isPharmacy === 'Y' || itemData.maintainBatch === 'Y' || (itemData.batches && itemData.batches.length > 0)))) && (
                                  <button
                                    type="button"
                                    onClick={() => setBatchSelectModalIdx(idx)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition cursor-pointer"
                                    title="Click to Switch Batch"
                                  >
                                    💊 {line.selectedBatchNo ? `Batch: ${line.selectedBatchNo}` : 'Select Batch'}
                                    {line.selectedBatchExp && <span className="font-mono text-emerald-800">| Exp: {line.selectedBatchExp}</span>}
                                  </button>
                                )}
                                {posSettings.showPurchasePrice && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0 text-[8px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200" title="Latest Purchase Price">
                                    Cost: {config.CurrencySymbol || 'Nu.'} {Number(line.purchaseRate || 0).toFixed(2)}
                                  </span>
                                )}
                                {line.appliedSchemeName && (
                                  <span 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.2 text-[9px] font-extrabold rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs" 
                                    title={`Applied Promotion: ${line.appliedSchemeName}`}
                                  >
                                    <Tag className="h-2.5 w-2.5 text-amber-700" />
                                    <span>{line.appliedSchemeName}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeSchemeFromLine(idx)}
                                      className="text-amber-700 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                                      title="Remove offer from this line"
                                    >
                                      ✕
                                    </button>
                                  </span>
                                )}
                              </div>
                              {(posSettings.enableItemDescription && String(config.EnableItemDescription) !== 'false') && (
                                <ItemNoteButton
                                  hasNote={Boolean(line.description && line.description.trim())}
                                  onClick={() => setActiveNoteIdx(activeNoteIdx === idx ? null : idx)}
                                  accentColor="indigo"
                                />
                              )}
                            </div>
                            {(posSettings.enableItemDescription && String(config.EnableItemDescription) !== 'false') && (Boolean(line.description && line.description.trim()) || activeNoteIdx === idx) && (
                              <ItemNoteInput
                                value={line.description || ''}
                                onChange={val => setCart(prev => prev.map((l, i) => i === idx ? { ...l, description: val } : l))}
                                onClose={() => setActiveNoteIdx(null)}
                                accentColor="indigo"
                              />
                            )}
                          </td>

                                                     {/* QTY */}
                          <td className="py-0.5 px-1 align-middle text-center">
                            <input
                              ref={el => { cartQtyRefs.current[idx] = el; }}
                              type="text"
                              inputMode="decimal"
                              value={cartQtyText[idx] !== undefined ? cartQtyText[idx] : (line.qty === 0 ? '' : String(line.qty))}
                              onChange={e => {
                                const raw = e.target.value;
                                if (raw === '' || raw === '-') {
                                  setCartQtyText(prev => ({ ...prev, [idx]: raw }));
                                  if (raw === '') updateCartLine(idx, 'qty', 0);
                                  return;
                                }
                                if (/^-?\d*\.?\d*$/.test(raw)) {
                                  setCartQtyText(prev => ({ ...prev, [idx]: raw }));
                                  const num = Number(raw);
                                  if (!isNaN(num)) {
                                    updateCartLine(idx, 'qty', num);
                                  }
                                }
                              }}
                              onFocus={e => e.target.select()}
                              onBlur={() => {
                                handleFieldBlurReturnToSearch();
                                setCartQtyText(prev => {
                                  const copy = { ...prev };
                                  delete copy[idx];
                                  return copy;
                                });
                                if (cart[idx] && (cart[idx].qty === 0 || isNaN(cart[idx].qty))) {
                                  updateCartLine(idx, 'qty', 1);
                                }
                              }}
                              onKeyDown={e => handleCartQtyKeyDown(e, idx)}
                              title="Edit quantity (type '-' for return, +/- to increment/decrement, Del to delete)"
                              className={`w-full text-center h-6 rounded-md border text-xs font-bold focus:ring-1 outline-none py-0 transition ${
                                line.qty < 0
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 font-extrabold focus:border-rose-500 focus:ring-rose-200'
                                  : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-indigo-100 hover:border-slate-400'
                              }`}
                            />
                          </td>
                          {/* UNIT */}
                          <td className="py-0.5 px-1 align-middle text-center">
                            {(() => {
                              const lineItem = items.find(i => (i['Item Code'] && i['Item Code'] === line.itemCode) || i['Item Name'] === line.itemName);
                              const primaryUnit = lineItem?.Unit || line.unit || 'Pcs';
                              const altUnits = (lineItem?.multiUnits || []).map(m => m.unit).filter(Boolean);
                              const allowedUnits = Array.from(new Set([primaryUnit, ...altUnits]));

                              if (allowedUnits.length <= 1) {
                                return (
                                  <span className="text-xs font-bold text-slate-700 px-1">
                                    {allowedUnits[0] || line.unit || 'Pcs'}
                                  </span>
                                );
                              }

                              return (
                                <select
                                  value={line.unit || allowedUnits[0]}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const updated = [...cart];
                                    updated[idx].unit = val;
                                    if (lineItem) {
                                      if (val === lineItem.Unit) {
                                        updated[idx].rate = lineItem['Sale Rate'] || 0;
                                      } else if (lineItem.multiUnits) {
                                        const mu = lineItem.multiUnits.find(m => m.unit === val);
                                        if (mu && mu.saleRate) {
                                          updated[idx].rate = mu.saleRate;
                                        }
                                      }
                                    }
                                    setCart(updated);
                                  }}
                                  className="w-full text-center h-6 rounded-md border border-slate-300 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                                >
                                  {allowedUnits.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>

                          {/* Rate */}
                          <td className="py-0.5 px-1 align-middle text-right">
                            <input
                              ref={el => { cartRateRefs.current[idx] = el; }}
                              type="number"
                              step="any"
                              value={line.rate === 0 ? '' : line.rate}
                              onChange={e => updateCartLine(idx, 'rate', e.target.value === '' ? 0 : Number(e.target.value))}
                              onFocus={e => e.target.select()}
                              onBlur={handleFieldBlurReturnToSearch}
                              onKeyDown={e => handleCartRateKeyDown(e, idx)}
                              className="w-full text-right h-6 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                            />
                          </td>

                          {/* Disc (if enabled) */}
                          {showItemDiscount && (
                            <td className="py-0.5 px-1 align-middle text-right">
                              <input
                                ref={el => { cartDiscRefs.current[idx] = el; }}
                                type="number"
                                step="any"
                                value={line.discount === 0 ? '' : line.discount}
                                onChange={e => updateCartLine(idx, 'discount', e.target.value === '' ? 0 : Number(e.target.value))}
                                onFocus={e => e.target.select()}
                                onBlur={handleFieldBlurReturnToSearch}
                                onKeyDown={e => handleCartDiscKeyDown(e, idx)}
                                className="w-full text-right h-6 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                              />
                            </td>
                          )}

                          {/* GST */}
                          <td className="py-0.5 px-2 align-middle text-right font-mono font-bold text-slate-800 text-xs">
                            {lineTax.toFixed(2)}
                          </td>

                          {/* Amount */}
                          <td className={`py-0.5 px-2.5 align-middle text-right font-black font-mono text-xs ${line.qty < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {lineTotal.toFixed(2)}
                          </td>

                          {/* Delete */}
                          <td className="py-0.5 px-1 align-middle text-center">
                            <button
                              type="button"
                              onClick={() => removeCartLine(idx)}
                              title="Delete Item (Del)"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Cart Action Toolbar */}
            <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-600 disabled:opacity-50 transition cursor-pointer"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Hold (F8)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length > 0 && confirm('Clear entire cart?')) {
                      setCart([]);
                      setCustomerName('');
                      setWalkInDetails(null);
                      setEditingInvoiceNo(null);
                      setEditingInvoiceDate(null);
                      itemInputRef.current?.focus();
                    }
                  }}
                  disabled={cart.length === 0}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Clear (F10)</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-2">
                <span>Items: <strong className="text-slate-800 font-bold">{cart.length}</strong></span>
                <span>•</span>
                <span>Qty: <strong className="text-slate-800 font-bold">{cart.reduce((acc, c) => acc + (Number(c.qty) || 0), 0)}</strong></span>
                {cart.some(c => c.qty < 0) && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      Returns: {cart.filter(c => c.qty < 0).length} items ({cart.filter(c => c.qty < 0).reduce((acc, c) => acc + Math.abs(c.qty), 0)} pcs)
                    </span>
                  </>
                )}
                <span>•</span>
                <span><kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-mono">F3</kbd> Scan | <kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-mono">F4</kbd> Cust | <kbd className="bg-white border border-slate-300 rounded px-1 text-[10px] font-mono">F2</kbd> Pay</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Workspace: Balanced, Compact Checkout & Customer Panel */}
        <div className={`w-full lg:w-[340px] xl:w-[360px] shrink-0 h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col space-y-2.5 ${mobileTab === 'cart' ? 'hidden sm:flex' : 'flex'}`}>
          {/* Customer Selection Header & Controls */}
          <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="customer-ledger-select" className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <span>Customer / Ledger</span>
              <span className="text-[10px] font-semibold text-slate-400 normal-case tracking-normal">(Optional for Cash)</span>
              <kbd className="bg-slate-100 border border-slate-300 text-slate-500 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold">F4</kbd>
            </label>

            {customerName && (
              <button
                type="button"
                onClick={() => {
                  setCustomerName('');
                  setCash(totals.total);
                  setBank1('');
                  setBank2('');
                }}
                className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold cursor-pointer flex items-center gap-0.5 transition"
                title="Clear selected customer (Return to Walk-in Cash)"
              >
                <span>Clear</span>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Full-width Searchable Ledger Select (Spacious & Readable) */}
          <SearchableLedgerSelect
            id="customer-ledger-select"
            ledgers={ledgers}
            prioritizeGroups={['Sundry Debtors']}
            value={customerName}
            onChange={(val) => {
              setCustomerName(val);
              if (val && walkInDetails) setWalkInDetails(null);
              if (val) {
                // Customer selected: automatically show full amount in Due (100% credit default)
                setCash('');
                setBank1('');
                setBank2('');
              } else {
                // Walk-in Cash customer
                setCash(totals.total);
                setBank1('');
                setBank2('');
              }
            }}
            placeholder="Walk-in / Cash Customer (or select F4)..."
            filterGroups={['Sundry Debtors', 'Sundry Creditors']}
            onCreateNew={openCreateCustomerModal}
            onEditLedger={openEditCustomerModal}
          />

          {/* GST Exemption Banner for Party */}
          {isCustomerGstExempted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold shadow-2xs">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>GST Exempted Party — 0% Tax Applied</span>
            </div>
          )}

          {/* Row Below: Walk-in Button + Active Walk-in Tag */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setShowWalkInModal(true)}
              className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Walk-in Customer Details (F7)"
            >
              <span>+ Walk-in</span>
              <span className="text-[9px] opacity-75 font-mono font-bold">(F7)</span>
            </button>

            {walkInDetails && (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px]">
                <div className="truncate font-semibold">
                  <span className="text-emerald-900 font-bold">Walk-in:</span> {walkInDetails.name}
                  {walkInDetails.isGSTExempted && <span className="ml-1 text-[10px] bg-emerald-200 text-emerald-900 px-1 rounded font-bold">Exempted</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setWalkInDetails(null)}
                  className="text-emerald-700 hover:text-rose-600 p-0.5 cursor-pointer shrink-0"
                  title="Remove Walk-in details"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Single-Row Compact Bill / Lumpsum Discount (controlled by POS Settings) */}
        {showBillDiscount && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
              <Percent className="h-3.5 w-3.5 text-rose-500" />
              <span>Discount</span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 max-w-[210px] justify-end">
              {/* Flat / % Toggle Segment */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-[11px] font-bold shrink-0">
                <button
                  type="button"

                  className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                    billDiscountType === 'flat'
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Flat discount amount"
                  onClick={() => setBillDiscountType('flat')}
                >
                  {config.CurrencySymbol || 'Nu.'}
                </button>
                <button
                  type="button"

                  className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                    billDiscountType === 'percent'
                      ? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Percentage discount (%)"
                  onClick={() => setBillDiscountType('percent')}
                >
                  %
                </button>
              </div>

              {/* Direct Value Input */}
              <div className="relative flex-1 min-w-[80px]">
                <input
                  ref={billDiscountInputRef}
                  type="number"
                  step="any"
                  min="0"
                  value={billDiscount === 0 ? '' : billDiscount}
                  placeholder=""
                  onChange={e => {
                    const v = e.target.value;
                    setBillDiscount(v === '' ? '' : Math.max(0, Number(v)));
                  }}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      cashInputRef.current?.focus();
                      cashInputRef.current?.select();
                    }
                  }}
                  className="w-full h-7.5 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold text-right text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-slate-50/50 focus:bg-white"
                />
                {billDiscount !== '' && Number(billDiscount) > 0 && (
                  <button
                    type="button"
                    onClick={() => setBillDiscount('')}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                    title="Clear discount"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bill Breakdown Header: Taxable Sale, Exempted Sale, GST & Total Invoice Amount */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 text-white p-3.5 shadow-md space-y-2.5">
          {/* Header Row: Label & Cart Summary Badge */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-200">
              <Receipt className="h-4 w-4 text-indigo-400" />
              <span>Invoice Breakdown</span>
            </div>
            <div className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5">
              <span>Items: <strong className="text-white font-bold">{cart.length}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Qty: <strong className="text-white font-bold">{cart.reduce((acc, c) => acc + (Number(c.qty) || 0), 0)}</strong></span>
              {cart.some(c => c.qty < 0) && (
                <span className="text-[10px] text-rose-400 font-bold bg-rose-950/80 px-1 py-0.2 rounded border border-rose-800">
                  (-{cart.filter(c => c.qty < 0).reduce((acc, c) => acc + Math.abs(c.qty), 0)} ret)
                </span>
              )}
            </div>
          </div>

          {/* Line-by-Line Breakdown Table: Perfectly Aligned, No Truncation */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400">Taxable Sale</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                <span className="text-[11px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                {totals.taxable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400">Exempted Sale</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                <span className="text-[11px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                {totals.zeroRated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-indigo-300">GST (Tax)</span>
              <span className="font-mono font-bold text-indigo-200 text-sm">
                <span className="text-[11px] text-indigo-400 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                {totals.gstAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {totals.itemDiscountTotal > 0 && (
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>Itemwise Discount</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">
                  -<span className="text-[11px] font-normal mr-0.5">{config.CurrencySymbol || 'Nu.'}</span>
                  {totals.itemDiscountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {totals.discount > 0 && (
              <>
                <div className="flex items-center justify-between text-slate-400 pt-1.5 border-t border-slate-800/80">
                  <span className="font-medium">Gross Subtotal</span>
                  <span className="font-mono font-semibold text-slate-300">
                    <span className="text-[10px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                    {totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-rose-400 font-bold">
                  <span className="flex items-center gap-1">
                    <span>{totals.appliedBillSchemeName ? `Offer: ${totals.appliedBillSchemeName}` : 'Lumpsum Discount'}</span>
                    {billDiscountType === 'percent' && !totals.appliedBillSchemeName && (
                      <span className="text-[10px] bg-rose-950/80 text-rose-300 px-1 rounded border border-rose-800 font-mono">
                        {totals.discountValue}%
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-rose-300 text-sm">
                    -<span className="text-[11px] font-normal mr-0.5">{config.CurrencySymbol || 'Nu.'}</span>
                    {totals.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Grand Total Invoice Amount: Clean, Unbroken Single Line */}
          <div className="bg-indigo-900/60 border border-indigo-700/60 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-200 whitespace-nowrap">
              Total Amount
            </span>
            <div className="font-black font-mono tracking-tight text-white flex items-baseline gap-1 text-xl sm:text-2xl">
              <span className="text-xs font-bold text-indigo-300">{config.CurrencySymbol || 'Nu.'}</span>
              <span>{totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Payment Modes */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Payment Breakdown & Due (Alt+P)</span>
            {customerName && <span className="text-indigo-600 font-bold text-[10px]">Party Selected (Default 100% Credit)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-slate-600">Cash Paid</label>
                {Number(cash) > totals.total && totals.total > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                    Change: {(Number(cash) - totals.total).toFixed(2)}
                  </span>
                )}
              </div>
              <input
                ref={cashInputRef}
                type="number"
                step="any"
                value={cash === 0 ? '' : cash}
                placeholder=""
                onChange={e => handleCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={handleFieldBlurReturnToSearch}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleCheckout();
                  }
                }}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-slate-600 truncate" title={config.Bank1Ledger || 'Bank 1'}>
                  {config.Bank1Ledger || 'Bank 1'}
                </label>
                {bankTxnNo && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetBankField('bank1');
                      setActiveBankLedgerName(config.Bank1Ledger || 'Bank Account 1');
                      setBankTxnModalOpen(true);
                    }}
                    className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1 py-0.2 rounded border border-indigo-200 truncate max-w-[80px]"
                    title={`Txn ID: ${bankTxnNo} (Click to edit)`}
                  >
                    #{bankTxnNo}
                  </button>
                )}
              </div>
              <input
                ref={bank1InputRef}
                type="number"
                step="any"
                value={bank1 === 0 ? '' : bank1}
                placeholder=""
                onChange={e => handleBank1Input(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={() => {
                  handleFieldBlurReturnToSearch();
                  checkAndPromptPOSBankTxn('bank1');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const prompted = checkAndPromptPOSBankTxn('bank1');
                    if (!prompted) handleCheckout();
                  }
                }}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-slate-600 truncate" title={config.Bank2Ledger || 'Bank 2'}>
                  {config.Bank2Ledger || 'Bank 2'}
                </label>
                {bank2TxnNo && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetBankField('bank2');
                      setActiveBankLedgerName(config.Bank2Ledger || 'Bank Account 2');
                      setBankTxnModalOpen(true);
                    }}
                    className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1 py-0.2 rounded border border-indigo-200 truncate max-w-[80px]"
                    title={`Txn ID: ${bank2TxnNo} (Click to edit)`}
                  >
                    #{bank2TxnNo}
                  </button>
                )}
              </div>
              <input
                ref={bank2InputRef}
                type="number"
                step="any"
                value={bank2 === 0 ? '' : bank2}
                placeholder=""
                onChange={e => handleBank2Input(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={() => {
                  handleFieldBlurReturnToSearch();
                  checkAndPromptPOSBankTxn('bank2');
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const prompted = checkAndPromptPOSBankTxn('bank2');
                    if (!prompted) handleCheckout();
                  }
                }}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Credit / Due</label>
              <div
                className={`h-8 rounded-lg px-2 flex items-center justify-center font-mono font-black text-xs truncate ${
                  balance > 0.005
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {balance > 0.005 ? `Due: ${balance.toFixed(2)}` : '✓ Settled'}
              </div>
            </div>
          </div>
        </div>

        {/* Checkout & Instant Sharing Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Primary Checkout & Print (F2) */}
          <GlowButton
            type="button"
            onClick={() => handleCheckout('print')}
            disabled={cart.length === 0 || isSubmitting}
            variant="blue"
            size="lg"
            fullWidth
            icon={Printer}
            title="Save bill to database and print receipt (F2)"
          >
            Checkout & Print [F2]
          </GlowButton>

          {/* Instant Share & Quick Save Actions */}
          <div className="grid grid-cols-3 gap-1.5">
            <GlowButton
              type="button"
              onClick={() => handleCheckout('share_pdf')}
              disabled={cart.length === 0 || isSubmitting}
              variant="purple"
              size="sm"
              icon={Share2}
              title="Save bill to database and share PDF directly via WhatsApp / Email"
            >
              Save & Share
            </GlowButton>

            <GlowButton
              type="button"
              onClick={() => handleCheckout('download_pdf')}
              disabled={cart.length === 0 || isSubmitting}
              variant="cyan"
              size="sm"
              icon={FileDown}
              title="Save bill to database and download A4 Tax Invoice PDF"
            >
              Save PDF
            </GlowButton>

            <GlowButton
              type="button"
              onClick={() => handleCheckout('save_only')}
              disabled={cart.length === 0 || isSubmitting}
              variant="emerald"
              size="sm"
              icon={Check}
              title="Save bill to database without opening print dialogue"
            >
              Save Only
            </GlowButton>
          </div>
        </div>
      </div>
      </div>

      {/* POS Preferences & Workflow Modal */}
      <POSSettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false);
          setTimeout(() => itemInputRef.current?.focus(), 30);
        }}
        settings={posSettings}
        onSaveSettings={handleSaveSettings}
      />

      {/* POS Shortcuts Modal */}
      <POSShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => {
          setShowShortcutsModal(false);
          setTimeout(() => itemInputRef.current?.focus(), 30);
        }}
      />

      {/* Walk-in Customer Details Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-3">Walk-in Customer Details</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={walkInDetails?.name || ''}
                  onChange={e => setWalkInDetails({ ...(walkInDetails || { phone: '', address: '', gst: '' }), name: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={walkInDetails?.phone || ''}
                  onChange={e => setWalkInDetails({ ...(walkInDetails || { name: '', address: '', gst: '' }), phone: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Address</label>
                <input
                  type="text"
                  value={walkInDetails?.address || ''}
                  onChange={e => setWalkInDetails({ ...(walkInDetails || { name: '', phone: '', gst: '' }), address: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-indigo-500"
                />
              </div>
              {showGst && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">GST Number</label>
                    <input
                      type="text"
                      value={walkInDetails?.gst || ''}
                      onChange={e => setWalkInDetails({ ...(walkInDetails || { name: '', phone: '', address: '' }), gst: e.target.value })}
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="walkin-gst-exempted"
                      checked={Boolean(walkInDetails?.isGSTExempted)}
                      onChange={e => setWalkInDetails({ ...(walkInDetails || { name: '', phone: '', address: '', gst: '' }), isGSTExempted: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <label htmlFor="walkin-gst-exempted" className="font-bold text-slate-700 cursor-pointer">
                      GST Exempted (0% Tax on items)
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => {
                  setShowWalkInModal(false);
                  itemInputRef.current?.focus();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (walkInDetails?.name) {
                    setShowWalkInModal(false);
                    setCustomerName('');
                    setTimeout(() => itemInputRef.current?.focus(), 30);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                Save Walk-in Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Serial Modal */}
      {activeSerialIndex > -1 && cart[activeSerialIndex] && (
        <SerialModal
          isOpen={serialModalOpen}
          onClose={() => {
            setSerialModalOpen(false);
            setTimeout(() => itemInputRef.current?.focus(), 30);
          }}
          onConfirm={serials => {
            const updated = [...cart];
            updated[activeSerialIndex].serials = serials;
            setCart(updated);
            setSerialModalOpen(false);
            setTimeout(() => itemInputRef.current?.focus(), 30);
          }}
          requiredQty={cart[activeSerialIndex].qty}
          itemName={cart[activeSerialIndex].itemName}
          initialSerials={cart[activeSerialIndex].serials}
          mode="select"
          availableSerials={getSerialNumbersStockReport().filter(r => r.itemCode === cart[activeSerialIndex].itemCode && r.status === 'In Stock').map(r => r.serialNo)}
        />
      )}

      {/* Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setTimeout(() => {
            itemInputRef.current?.focus();
          }, 50);
        }}
        invoice={lastSavedInvoice}
        config={config}
      />

      {/* Customer Ledger Creation / Edit Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                {customerModalMode === 'create' ? 'Create New Customer Ledger' : `Edit Customer Ledger: ${customerForm.oldName}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false);
                  itemInputRef.current?.focus();
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Customer / Ledger Name *</label>
                <input
                  type="text"
                  value={customerForm['Ledger Name'] || ''}
                  onChange={e => setCustomerForm({ ...customerForm, 'Ledger Name': e.target.value })}
                  placeholder="e.g. Dorji Penjor or M/s Bhutan Trading"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Contact No</label>
                <input
                  type="text"
                  value={customerForm['Contact No'] || ''}
                  onChange={e => setCustomerForm({ ...customerForm, 'Contact No': e.target.value })}
                  placeholder="Phone number"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Group</label>
                <input
                  type="text"
                  disabled
                  value={customerForm.Group || 'Sundry Debtors'}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-100 px-3 font-semibold text-slate-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN No</label>
                <input
                  type="text"
                  value={customerForm['GST No'] || ''}
                  onChange={e => setCustomerForm({ ...customerForm, 'GST No': e.target.value })}
                  placeholder="GSTIN"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  GST Registration Type <span className="text-indigo-600 font-bold">(Debtor)</span>
                </label>
                <select
                  value={customerForm['GST Type'] || (customerForm['GST Exempted'] === 'Y' ? 'Exempted' : (customerForm['GST No'] ? 'Regular' : 'Unregistered'))}
                  onChange={e => {
                    const val = e.target.value;
                    setCustomerForm({
                      ...customerForm,
                      'GST Type': val as any,
                      'GST Exempted': val === 'Exempted' ? 'Y' : 'N'
                    });
                  }}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                >
                  <option value="Regular">Regular Taxpayer</option>
                  <option value="Exempted">Exempted Party (0% GST)</option>
                  <option value="Composition">Composition Scheme</option>
                  <option value="Unregistered">Unregistered / Consumer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">TPN No</label>
                <input
                  type="text"
                  value={customerForm['TPN No'] || ''}
                  onChange={e => setCustomerForm({ ...customerForm, 'TPN No': e.target.value })}
                  placeholder="TPN Number"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={customerForm.Address || ''}
                  onChange={e => setCustomerForm({ ...customerForm, Address: e.target.value })}
                  placeholder="Full Address"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Balance</label>
                <input
                  type="number"
                  value={customerForm['Opening Balance'] || 0}
                  onChange={e => setCustomerForm({ ...customerForm, 'Opening Balance': Number(e.target.value) || 0 })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Balance Type</label>
                <select
                  value={customerForm['Balance Type (Dr/Cr)'] || 'Dr'}
                  onChange={e => setCustomerForm({ ...customerForm, 'Balance Type (Dr/Cr)': e.target.value as 'Dr' | 'Cr' })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                >
                  <option value="Dr">Dr (Receivable)</option>
                  <option value="Cr">Cr (Payable)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false);
                  itemInputRef.current?.focus();
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel (ESC)
              </button>
              <button
                type="button"
                onClick={handleSaveCustomerModal}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm cursor-pointer"
              >
                Save Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up modal for Bank Transaction ID / UTR when Bank ledger payment is entered */}
      <BankTransactionIdModal
        isOpen={bankTxnModalOpen}
        bankLedgerName={activeBankLedgerName}
        initialValue={targetBankField === 'bank1' ? bankTxnNo : bank2TxnNo}
        onSave={(newTxnId) => {
          if (targetBankField === 'bank1') {
            setBankTxnNo(newTxnId);
          } else {
            setBank2TxnNo(newTxnId);
          }
        }}
        onClose={() => setBankTxnModalOpen(false)}
      />

      {/* Floating Modal for Cash Tendered & Change Return */}
      {changeModalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-1">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Change Return Calculator</h3>
              <p className="text-xs text-slate-500 font-medium">Customer Paid Cash Tendered</p>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Bill Total:</span>
                <span className="font-mono font-bold text-slate-900">{config.CurrencySymbol || 'Nu.'} {changeModalData.billAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cash Received:</span>
                <span className="font-mono font-bold text-slate-900">{config.CurrencySymbol || 'Nu.'} {changeModalData.cashTendered.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Change to Return</div>
              <div className="text-3xl font-black font-mono text-emerald-600">
                {config.CurrencySymbol || 'Nu.'} {changeModalData.changeReturn.toFixed(2)}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const billAmt = changeModalData.billAmount;
                  setCash(billAmt);
                  setChangeModalData(null);
                  setTimeout(() => {
                    handleCheckout('print');
                  }, 50);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-xs"
              >
                Accept & Print (Enter)
              </button>
              <button
                type="button"
                onClick={() => {
                  const billAmt = changeModalData.billAmount;
                  setCash(billAmt);
                  setChangeModalData(null);
                  setTimeout(() => {
                    cashInputRef.current?.focus();
                    cashInputRef.current?.select();
                  }, 50);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
              >
                Adjust Cash (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      <AcceptModal
        isOpen={Boolean(showAcceptModal)}
        title={editingInvoiceNo ? `Save changes to ${editingInvoiceNo}?` : "Save Sales Invoice?"}
        onConfirm={() => {
          const act = showAcceptModal;
          setShowAcceptModal(false);
          if (act) handleCheckout(act, true);
        }}
        onCancel={() => setShowAcceptModal(false)}
      />

      {/* Single Master Offline Restriction Modal */}
      {showOfflineRestrictedModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Offline Billing Restricted</h3>
                <p className="text-xs text-slate-500 font-medium">Single Master Counter Policy</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                During offline operations, only the designated <strong>Master Counter ({canCurrentDeviceBillOffline().designatedCounterName || getDesignatedOfflineCounter()})</strong> is permitted to finalize sales. This ensures a 100% continuous invoice series without numbering gaps or DRC audit flags.
              </p>
              <p className="font-semibold text-indigo-700">
                🔍 This terminal remains fully active for:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                <li>Barcode scanning & instant price check</li>
                <li>Item stock quantity & rack/bin verification</li>
                <li>Customer & wholesale discount calculation</li>
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOfflineRestrictedModal(false)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer text-xs"
              >
                Understood (Continue Price Check)
              </button>
            </div>
          </div>
        </div>
      )}

      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="POS Billing"
        onConfirm={() => {
          setShowQuitModal(false);
          resetPosForm();
          if (onBack) {
            onBack(true);
          } else {
            window.dispatchEvent(new CustomEvent('app:navigate-back-direct'));
          }
        }}
        onCancel={() => setShowQuitModal(false)}
      />

      <ItemInfoModal
        isOpen={!!selectedItemForInfo}
        onClose={() => setSelectedItemForInfo(null)}
        item={selectedItemForInfo}
        customerPartyName={customerName}
        onEditInMaster={(itemToEdit) => {
          if (onOpenNewItemModal) {
            onOpenNewItemModal(newItem => {
              selectItem(newItem);
            }, itemToEdit);
          }
        }}
        currencySymbol={config.CurrencySymbol || 'Nu.'}
      />

      {/* Batch Switcher Modal */}
      {batchSelectModalIdx !== null && cart[batchSelectModalIdx] && (() => {
        const line = cart[batchSelectModalIdx];
        const itemObj = items.find(i => i['Item Code'] === line.itemCode);
        const itemBatches = itemObj?.batches || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-4 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span className="text-base">💊</span> Switch Batch for "{line.itemName}"
                  </h3>
                  <p className="text-[11px] text-slate-500">Select a specific physical batch to override auto-selected FEFO batch</p>
                </div>
                <button
                  onClick={() => setBatchSelectModalIdx(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {itemBatches.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No batches recorded for this item. You can add batches in Item Master.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-emerald-50 text-emerald-950 font-bold border-b border-emerald-100 text-[11px]">
                          <th className="p-2 text-left">Batch No</th>
                          <th className="p-2 text-left">Expiry Date</th>
                          <th className="p-2 text-center">In Stock</th>
                          <th className="p-2 text-right">Sale Rate</th>
                          {config.EnableWholesalePrice !== 'false' && <th className="p-2 text-right">Wholesale Rate</th>}
                          <th className="p-2 text-right">MRP</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemBatches.map(b => {
                          const isSelected = line.selectedBatchNo === b.batchNo || line.selectedBatchId === b.id;
                          const expTime = b.expDate ? new Date(b.expDate).getTime() : 0;
                          const daysToExp = expTime ? Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
                          const isExpired = daysToExp <= 0;
                          const isNearExp = daysToExp > 0 && daysToExp <= 60;

                          return (
                            <tr key={b.id} className={`hover:bg-emerald-50/50 transition ${isSelected ? 'bg-emerald-50 font-bold' : ''}`}>
                              <td className="p-2 font-mono font-bold text-slate-900">
                                {b.batchNo}
                                {isSelected && <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded font-bold">Selected</span>}
                              </td>
                              <td className="p-2 font-mono">
                                {b.expDate || '-'}
                                {isExpired && <span className="ml-1 text-[9px] bg-rose-100 text-rose-800 px-1 py-0.2 rounded font-bold">Expired</span>}
                                {isNearExp && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">Expiring Soon ({daysToExp}d)</span>}
                              </td>
                              <td className="p-2 text-center font-bold text-slate-800">
                                {b.currentStock ?? b.openingStock ?? 0}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-indigo-900">
                                {config.CurrencySymbol || 'Nu.'} {Number(b.saleRate || 0).toFixed(2)}
                              </td>
                              {config.EnableWholesalePrice !== 'false' && (
                                <td className="p-2 text-right font-mono text-emerald-800">
                                  {config.CurrencySymbol || 'Nu.'} {Number(b.wholesaleRate || 0).toFixed(2)}
                                </td>
                              )}
                              <td className="p-2 text-right font-mono text-slate-600">
                                {config.CurrencySymbol || 'Nu.'} {Number(b.mrp || 0).toFixed(2)}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    let newRate = line.rate;
                                    if (pricingMode === 'wholesale' && config.EnableWholesalePrice !== 'false' && (Number(b.wholesaleRate) || 0) > 0) {
                                      newRate = Number(b.wholesaleRate);
                                    } else if ((Number(b.saleRate) || 0) > 0) {
                                      newRate = Number(b.saleRate);
                                    }

                                    const updatedCart = [...cart];
                                    updatedCart[batchSelectModalIdx] = {
                                      ...line,
                                      selectedBatchNo: b.batchNo,
                                      selectedBatchExp: b.expDate,
                                      selectedBatchId: b.id,
                                      rate: newRate,
                                      purchaseRate: Number(b.purchaseRate) || line.purchaseRate,
                                      barcode: b.barcode || line.barcode
                                    };
                                    setCart(updatedCart);
                                    setBatchSelectModalIdx(null);
                                  }}
                                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs ${
                                    isSelected 
                                      ? 'bg-emerald-700 text-white hover:bg-emerald-800' 
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  {isSelected ? 'Active' : 'Select This Batch'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setBatchSelectModalIdx(null)}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Active Offers / Schemes Quick View Modal */}
      {showOffersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-5 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Active Promotions & Offers</h3>
                  <p className="text-[11px] text-slate-500">Running promotional schemes applicable to POS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOffersModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {getAllActiveSchemes('pos').length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Tags className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-1" />
                  <p className="text-xs font-semibold">No promotional schemes are currently running for POS sales.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Configure discounts, BOGO, or happy hours under Schemes & Offers (Alt+O).</p>
                </div>
              ) : (
                getAllActiveSchemes('pos').map(sch => (
                  <div key={sch.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{sch.name}</span>
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                          {sch.schemeType.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          Applies: {sch.targetType.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {sch.schemeType === 'percent_discount' && `Get ${sch.discountValue}% discount`}
                        {sch.schemeType === 'flat_discount' && `Get ${config.CurrencySymbol || 'Nu.'} ${sch.discountValue} off per unit`}
                        {sch.schemeType === 'special_rate' && `Special Promo Price: ${config.CurrencySymbol || 'Nu.'} ${sch.specialRate}`}
                        {sch.schemeType === 'bogo' && `Buy ${sch.buyQty}, Get ${sch.freeQty} Free`}
                        {sch.minQty && sch.minQty > 1 ? ` (Min Qty: ${sch.minQty})` : ''}
                        {sch.schemeType === 'bill_discount' && sch.minBillAmount ? ` on orders above ${config.CurrencySymbol || 'Nu.'} ${sch.minBillAmount}` : ''}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>Valid: {sch.startDate || 'Anytime'} to {sch.endDate || 'Ongoing'}</span>
                        {sch.startTime && sch.endTime && (
                          <span>• Happy Hours: {sch.startTime} - {sch.endTime}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOffersModal(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
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
