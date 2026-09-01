import React, { useState, useEffect, useRef } from 'react';
import {
  Config,
  Item,
  Ledger,
  CartLine,
  HeldBill,
  CustomerDetails,
  PaymentDetails,
  SalesInvoice,
  VoucherType
} from '../types';
import {
  loadPOSSettings,
  savePOSSettings,
  POSSettings
} from '../types/posSettings';
import {
  holdBill,
  resumeBill,
  deleteHeldBill,
  saveSalesInvoice, deleteSalesInvoice,
  saveLedger,
  round2,
  getVoucherTypes,
  getSerialNumbersStockReport,
  getActiveUser
} from '../services/storageService';
import {
  playScanBeep,
  playSuccessChime,
  playWarningTone
} from '../utils/audio';
import {
  Plus,
  Trash2,
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
  FileText
} from 'lucide-react';
import { SerialModal } from './SerialModal';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { POSSettingsModal } from './pos/POSSettingsModal';
import { POSShortcutsModal } from './pos/POSShortcutsModal';
import { generateInvoicePDF, shareOrDownloadPDF } from '../utils/pdfExport';

interface POSBillingProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  heldBills: HeldBill[];
  selectedVoucherType?: VoucherType | null;
  onOpenVoucherTypeModal?: () => void;
  onDataRefresh: () => void;
  onOpenNewItemModal: (onSelect?: (item: Item) => void) => void;
  onOpenNewLedgerModal: (group?: string, onSelect?: (name: string) => void) => void;
  onEditLedger: (name: string) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
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
  initialVoucherTarget
}) => {
  // POS Preferences & Workflow Settings
  const [posSettings, setPosSettings] = useState<POSSettings>(() => loadPOSSettings());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

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

  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      import('../services/storageService').then(m => {
        const details = m.getVoucherDetails(initialVoucherTarget.voucherNo);
        if (details && details.type === 'INV') {
          const inv = details.header as any;
          const newCart = (inv.items || []).map((it) => ({
            itemCode: it['Item Code'],
            itemName: it['Item Name'],
            description: it.description || it['Item Description'] || '',
            qty: it.Qty || 1,
            rate: it.Rate || 0,
            discount: it.Discount || 0,
            unit: it.Unit || 'Pcs',
            gstPct: it['GST %'] || 0,
            gstAmt: it['GST Amount'] || 0,
            zeroRated: it['Zero Rated (Y/N)'] === 'Y',
            serials: it['Serial Numbers'] ? it['Serial Numbers'].split(',').map(s=>s.trim()).filter(Boolean) : []
          }));
          setCart(newCart);
          
          if (inv.customer) {
            if (typeof inv.customer === 'object') {
              setCustomerName(inv.customer.ledger || inv.customer.name);
              setWalkInDetails(inv.customer);
            } else {
              setCustomerName(inv.customer);
            }
          }

          setCash(inv.cash > 0 ? inv.cash : '');
          setBank1(inv.bank1 > 0 ? inv.bank1 : '');
          setBank2(inv.bank2 > 0 ? inv.bank2 : '');
          setBankTxnNo(inv.bankTxnNo || '');
          setBank2TxnNo(inv.bank2TxnNo || '');
          setBillDiscount(inv.discount || '');
          
          setEditingInvoiceNo(inv.invoiceNo);
        }
      });
    }
  }, [initialVoucherTarget]);

  // Cart & Customer State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [walkInDetails, setWalkInDetails] = useState<{ name: string; phone: string; address: string; gst: string; isGSTExempted?: boolean } | null>(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);

  // Grid Entry State
  const [entrySearch, setEntrySearch] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryQty, setEntryQty] = useState<number | ''>(1);
  const [entryRate, setEntryRate] = useState<number | ''>('');
  const [entryDisc, setEntryDisc] = useState<number | ''>('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Customer Modal State (Create & Edit Ledger)
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<'create' | 'edit'>('create');
  const [customerForm, setCustomerForm] = useState<Partial<Ledger>>({
    'Ledger Name': '',
    Group: 'Sundry Debtors',
    'GST Registration Type': 'Regular',
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

  // Bill-level / Lumpsum Discount State (e.g. customer requests 10 discount on 110 bill)
  const [billDiscount, setBillDiscount] = useState<number | ''>('');
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>(config.BillDiscountType || 'flat');
  
  // Modals & Mobile Tabs
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [activeSerialIndex, setActiveSerialIndex] = useState<number>(-1);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<SalesInvoice | null>(null);
  const [mobileTab, setMobileTab] = useState<'cart' | 'payment'>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPurchasePrice, setShowPurchasePrice] = useState(false);
  const [securityAlert, setSecurityAlert] = useState(false);

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
    walkInDetails?.gstType === 'Exempted' ||
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
    saveLedger(customerForm as Ledger);
    setCustomerName(customerForm['Ledger Name']!.trim());
    setShowCustomerModal(false);
    onDataRefresh();
    setTimeout(() => itemInputRef.current?.focus(), 50);
  };

  // ESC and Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC closes open modals
      if (e.key === 'Escape') {
        if (showSettingsModal) {
          e.preventDefault();
          setShowSettingsModal(false);
          itemInputRef.current?.focus();
          return;
        }
        if (showShortcutsModal) {
          e.preventDefault();
          setShowShortcutsModal(false);
          itemInputRef.current?.focus();
          return;
        }
        if (showCustomerModal) {
          e.preventDefault();
          setShowCustomerModal(false);
          itemInputRef.current?.focus();
          return;
        }
        if (showWalkInModal) {
          e.preventDefault();
          setShowWalkInModal(false);
          itemInputRef.current?.focus();
          return;
        }
        if (serialModalOpen) {
          e.preventDefault();
          setSerialModalOpen(false);
          itemInputRef.current?.focus();
          return;
        }
        if (receiptModalOpen) {
          e.preventDefault();
          setReceiptModalOpen(false);
          itemInputRef.current?.focus();
          return;
        }
        // If dropdown is open, close it
        if (showDropdown) {
          setShowDropdown(false);
          return;
        }
        // Return focus to item input
        itemInputRef.current?.focus();
        return;
      }

      // F1: Open Shortcuts Guide
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // F2: Fast Checkout
      if (e.key === 'F2') {
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

      // Alt+C: Jump directly into Cart Table
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (cart.length > 0) {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSettingsModal,
    showShortcutsModal,
    showCustomerModal,
    showWalkInModal,
    serialModalOpen,
    receiptModalOpen,
    showDropdown,
    cart,
    customerName,
    cash,
    bank1,
    bank2,
    billDiscount,
    heldBills
  ]);

  // Calculations with Lumpsum / Bill Discount support & GST Exemption
  const calculateTotals = () => {
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0, itemDiscountTotal = 0;
    cart.forEach(l => {
            let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(l.discount) || 0;
        lineDisc = config.ItemDiscountType === 'percent' ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
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
    discountAmt = Math.min(subtotal, Math.max(0, discountAmt));
    const total = Math.max(0, round2(subtotal - discountAmt));

    return {
      subtotal,
      discount: discountAmt,
      discountValue: (showBillDiscount && billDiscount !== '') ? Number(billDiscount) : 0,
      taxable: round2(taxable),
      zeroRated: round2(zeroRated),
      gstAmt: round2(gstAmt),
      itemDiscountTotal: round2(itemDiscountTotal),
      total
    };
  };

  const totals = calculateTotals();

  const prevTotalRef = useRef(totals.total);

  // Auto set payment defaults:
  // - If customer is selected, default to 100% Due (Cash and Bank remain 0 unless entered manually)
  // - If no customer selected (Cash Sale), default cash to full total
  useEffect(() => {
    if (editingInvoiceNo) {
      prevTotalRef.current = totals.total;
      return; // Prevent overwriting existing payment data when editing a voucher
    }

    if (cart.length === 0) {
      setCash('');
      setBank1('');
      setBank2('');
      prevTotalRef.current = totals.total;
      return;
    }

    if (customerName) {
      // If customer is selected and cash was set to exact total automatically, clear it so it shows in Due
      if ((cash === totals.total || cash === prevTotalRef.current) && bank1 === '' && bank2 === '') {
        setCash('');
      }
    } else {
      // Walk-in / Cash customer
      if ((cash === '' || cash === prevTotalRef.current) && bank1 === '' && bank2 === '') {
        setCash(totals.total);
      }
    }
    
    prevTotalRef.current = totals.total;
  }, [customerName, totals.total, cart.length, cash, bank1, bank2, editingInvoiceNo]);

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
    const searchLower = q.toLowerCase();
    const matched = items
      .filter(item => {
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
      })
      .sort((a, b) => {
        const aName = (a['Item Name'] || '').toLowerCase();
        const bName = (b['Item Name'] || '').toLowerCase();
        const aCode = (a['Item Code'] || '').toLowerCase();
        const bCode = (b['Item Code'] || '').toLowerCase();
        const aBarcode = (a['Barcode'] || '').toString().toLowerCase();
        const bBarcode = (b['Barcode'] || '').toString().toLowerCase();
        const aAlias = (a['Alias'] || '').toLowerCase();
        const bAlias = (b['Alias'] || '').toLowerCase();

        // Exact barcode match first
        if (aBarcode === searchLower && bBarcode !== searchLower) return -1;
        if (bBarcode === searchLower && aBarcode !== searchLower) return 1;

        // Exact code match second
        if (aCode === searchLower && bCode !== searchLower) return -1;
        if (bCode === searchLower && aCode !== searchLower) return 1;

        // Exact name match third
        if (aName === searchLower && bName !== searchLower) return -1;
        if (bName === searchLower && aName !== searchLower) return 1;

        // Exact alias match fourth
        if (aAlias === searchLower && bAlias !== searchLower) return -1;
        if (bAlias === searchLower && aAlias !== searchLower) return 1;

        // Starts with name
        const aStartsName = aName.startsWith(searchLower);
        const bStartsName = bName.startsWith(searchLower);
        if (aStartsName && !bStartsName) return -1;
        if (!aStartsName && bStartsName) return 1;

        return 0;
      })
      .slice(0, 10);

    setSearchResults(matched);
    setShowDropdown(matched.length > 0);
  };

  // Add Item to Cart (Direct or Step-by-Step, matching B2B rate & GST logic)
  const addItemDirectlyToCart = (item: Item, customQty = 1, customRate?: number, customDisc = 0) => {
    const qty = customQty > 0 ? customQty : 1;
    const rate = customRate !== undefined ? customRate : Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0);
    const discount = showItemDiscount ? customDisc : 0;

    const isZ = isCustomerGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
    const lineDisc = config.ItemDiscountType === 'percent' ? ((qty * rate) * discount / 100) : discount;
    const computedGstAmt = isZ ? 0 : round2(((qty * rate - lineDisc) * (Number(item['GST %']) || 0)) / 100);

    const existingIdx = cart.findIndex(l => l.itemCode === item['Item Code']);
    let updatedCart = [...cart];
    let targetIndex = existingIdx;

    if (existingIdx > -1 && posSettings.autoIncrementQty) {
      const newQty = updatedCart[existingIdx].qty + qty;
      const newRate = customRate !== undefined ? rate : updatedCart[existingIdx].rate;
      const newDisc = customDisc > 0 ? updatedCart[existingIdx].discount + discount : updatedCart[existingIdx].discount;
      const newIsZ = isCustomerGstExempted || String(updatedCart[existingIdx].zeroRated).toUpperCase() === 'Y';
      const newGrossDisc = config.ItemDiscountType === 'percent' ? ((newQty * newRate) * newDisc / 100) : newDisc;
      const newGstAmt = newIsZ ? 0 : round2(((newQty * newRate - newGrossDisc) * (Number(updatedCart[existingIdx].gstPct) || 0)) / 100);

      updatedCart[existingIdx] = {
        ...updatedCart[existingIdx],
        qty: newQty,
        rate: newRate,
        discount: newDisc,
        gstAmt: newGstAmt
      };
    } else {
      const newLine: CartLine = {
        itemCode: item['Item Code'],
        itemName: item['Item Name'],
        unit: item.Unit || 'Pcs',
        qty,
        rate,
        discount,
        gstPct: Number(item['GST %']) || 0,
        zeroRated: item['Zero Rated (Y/N)'] || 'N',
        purchaseRate: Number(item['Purchase Rate']) || 0,
        isSerialized: item['Is Serialized'],
        serials: [],
        gstAmt: computedGstAmt
      };
      updatedCart.push(newLine);
      targetIndex = updatedCart.length - 1;
    }

    setCart(updatedCart);

    // Audio Feedback
    if (posSettings.enableSoundFeedback) {
      playScanBeep();
    }

    // Stock Warning Tone if item <= 0 stock
    if (posSettings.warnLowStock && item['Maintain Stock'] !== 'N' && (Number(item['Current Stock']) <= 0)) {
      playWarningTone();
    }

    // Reset Entry Fields
    setEntrySearch('');
    setEntryCode('');
    setEntryQty(1);
    setEntryRate('');
    setEntryDisc('');
    setShowDropdown(false);

    // If serialized item, prompt serials
    if (item['Is Serialized'] === 'Y' && showSerials) {
      setActiveSerialIndex(targetIndex);
      setSerialModalOpen(true);
    } else {
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 40);
    }
  };

  // Selecting an Item
  const selectItem = (item: Item) => {
    if (posSettings.itemAddMode === 'direct') {
      // ⚡ Direct Quick-Add Mode: Instantly add to cart and keep focus on search
      addItemDirectlyToCart(item, 1);
    } else {
      // 🎯 Step-by-Step Prompt Mode: Focus Qty -> Rate -> Disc -> Enter to add
      setEntrySearch(item['Item Name']);
      setEntryCode(item['Item Code']);
      setEntryRate(Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0));
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
      if (showDropdown && selectedIndex > -1 && searchResults[selectedIndex]) {
        selectItem(searchResults[selectedIndex]);
      } else if (entryCode && posSettings.itemAddMode === 'prompt') {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      } else {
        const q = entrySearch.trim();
        if (!q) return;
        const searchLower = q.toLowerCase();
        const matchedExact = items.filter(i => 
          String(i.Barcode).toLowerCase() === searchLower || 
          String(i['Item Code']).toLowerCase() === searchLower ||
          (i['Alias'] && String(i['Alias']).toLowerCase() === searchLower)
        );
        if (matchedExact.length >= 1) {
          selectItem(matchedExact[0]);
        } else if (searchResults.length > 0) {
          selectItem(searchResults[0]);
        } else {
          // If no match found, warn
          if (posSettings.enableSoundFeedback) playWarningTone();
        }
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
    const item = entryCode
      ? items.find(i => i['Item Code'] === entryCode)
      : items.find(i => i['Item Name'].toLowerCase() === entrySearch.trim().toLowerCase());

    if (!item) {
      if (posSettings.enableSoundFeedback) playWarningTone();
      return;
    }

    const qty = Number(entryQty) || 1;
    const rate = Number(entryRate) || 0;
    const discount = showItemDiscount ? (Number(entryDisc) || 0) : 0;

    addItemDirectlyToCart(item, qty, rate, discount);
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
      updateCartLine(idx, 'qty', cart[idx].qty + 1);
      if (posSettings.enableSoundFeedback) playScanBeep();
    } else if (e.key === '-') {
      e.preventDefault();
      if (cart[idx].qty > 1) {
        updateCartLine(idx, 'qty', cart[idx].qty - 1);
        if (posSettings.enableSoundFeedback) playScanBeep();
      }
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
        itemInputRef.current?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cart.length - 1) {
        cartRateRefs.current[idx + 1]?.focus();
        cartRateRefs.current[idx + 1]?.select();
      } else {
        itemInputRef.current?.focus();
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
    } else if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      itemInputRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < cart.length - 1) {
        cartDiscRefs.current[idx + 1]?.focus();
        cartDiscRefs.current[idx + 1]?.select();
      } else {
        itemInputRef.current?.focus();
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
    setCart(updated);
    if (field === 'qty' && updated[index].isSerialized === 'Y' && showSerials) {
      setActiveSerialIndex(index);
      setSerialModalOpen(true);
    }
  };

  const removeCartLine = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
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
    if (!customerName) {
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
    if (!customerName) {
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

  // Checkout Handler
  const handleCheckout = async (actionType: 'print' | 'whatsapp' | 'email' | 'save_only' | 'share_pdf' | 'download_pdf' = 'print') => {
    if (cart.length === 0 || isSubmitting) return;

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

    if (balance > 0.005 && (custLedger === 'Cash' || custLedger === 'Cash Customer')) {
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
      voucherTypeId: activeVoucherType?.id,
      voucherTypeName: activeVoucherType?.name,
      invoiceNo: editingInvoiceNo || undefined,
      isPOS: true
    });

    setIsSubmitting(false);

    if (result && (result as any).ok === false) {
      alert((result as any).error || 'Failed to save sales invoice.');
      return;
    }
    
    setEditingInvoiceNo(null);

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
                {activeVoucherType?.voucherTypeName || 'Sale'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Quick Retail Entry (Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1 py-0.2 text-[10px] font-mono font-bold">F2</kbd> to Save)
            </p>
          </div>
        </div>
      </div>

      {/* Mobile-only switcher between Cart and Checkout */}
      <div className="flex sm:hidden rounded-xl bg-slate-100 p-0.5 border border-slate-200 shrink-0">
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
                  <div className="absolute left-0 top-full mt-1 z-[999] w-[340px] sm:w-[420px] md:w-[460px] max-w-[92vw] max-h-[280px] shadow-2xl overflow-y-auto rounded-xl border border-slate-300 bg-white divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    <div className="sticky top-0 bg-slate-800 text-white px-2.5 py-1 text-xs font-bold shadow-md z-20 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span>List of Stock Items</span>
                        <span className="text-[10px] text-slate-300 font-normal bg-slate-700/80 px-1.5 py-0.2 rounded border border-slate-600">
                          Ctrl+P: Cost
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">Select (Enter)</span>
                    </div>

                    {securityAlert && (
                      <div className="bg-rose-600 text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between animate-in fade-in">
                        <span>🔒 Access Denied: Only Admin/Manager can view purchase cost</span>
                      </div>
                    )}

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
                      return (
                        <div
                          key={item['Item Code']}
                          onClick={() => selectItem(item)}
                          className={`px-2.5 py-1 text-xs cursor-pointer flex justify-between items-center transition ${
                            idx === selectedIndex ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-1.5 pr-2">
                            <span className="font-bold truncate">{item['Item Name']}</span>
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
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Numeric Controls Row */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Qty Input */}
                <div className="w-16">
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Qty"
                    value={entryQty === 0 ? '' : entryQty}
                    onChange={e => setEntryQty(e.target.value === '' ? '' : Number(e.target.value) === 0 ? '' : Number(e.target.value))}
                    onFocus={e => e.target.select()}
                    onBlur={handleFieldBlurReturnToSearch}
                    onKeyDown={handleQtyKeyDown}
                    title="Quantity (Enter to advance)"
                    className="w-full text-center h-9 rounded-xl border border-slate-300 bg-white px-1 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-2xs"
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
                      <col style={{ width: '36%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: '42%' }} />
                      <col style={{ width: '12%' }} />
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
                          <td className="py-1 px-2.5 align-middle font-medium text-slate-800 break-words">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{line.itemName}</span>
                              {posSettings.showPurchasePrice && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0 text-[8px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200" title="Latest Purchase Price">
                                  Cost: {config.CurrencySymbol || 'Nu.'} {Number(line.purchaseRate || 0).toFixed(2)}
                                </span>
                              )}
                              {isLowStock && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0 text-[8px] font-bold rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="h-2 w-2" /> 0 Stock
                                </span>
                              )}
                              {line.isSerialized === 'Y' && showSerials && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSerialIndex(idx);
                                    setSerialModalOpen(true);
                                  }}
                                  className="inline-flex items-center rounded-md bg-amber-100 px-1 py-0 text-[9px] font-bold text-amber-800 hover:bg-amber-200"
                                >
                                  Serials: {line.serials?.length || 0}/{line.qty}
                                </button>
                              )}
                            </div>
                            {(posSettings.enableItemDescription || config.EnableItemDescription) && (
                              <input
                                type="text"
                                placeholder="Item description / specification..."
                                value={line.description || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCart(prev => prev.map((l, i) => i === idx ? { ...l, description: val } : l));
                                }}
                                className="w-full mt-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] outline-none focus:border-indigo-500 text-slate-700 bg-white"
                              />
                            )}
                          </td>

                          {/* QTY */}
                          <td className="py-1 px-1 align-middle text-center">
                            <input
                              ref={el => { cartQtyRefs.current[idx] = el; }}
                              type="number"
                              min="0.01"
                              step="any"
                              value={line.qty === 0 ? '' : line.qty}
                              onChange={e => updateCartLine(idx, 'qty', e.target.value === '' ? 0 : Number(e.target.value))}
                              onFocus={e => e.target.select()}
                              onBlur={handleFieldBlurReturnToSearch}
                              onKeyDown={e => handleCartQtyKeyDown(e, idx)}
                              title="Edit quantity (+/- keys increment/decrement, Del to delete, Enter to save)"
                              className="w-full text-center h-7 rounded-md border border-slate-300 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                            />
                          </td>

                          {/* Rate */}
                          <td className="py-1 px-1 align-middle text-right">
                            <input
                              ref={el => { cartRateRefs.current[idx] = el; }}
                              type="number"
                              step="any"
                              value={line.rate === 0 ? '' : line.rate}
                              onChange={e => updateCartLine(idx, 'rate', e.target.value === '' ? 0 : Number(e.target.value))}
                              onFocus={e => e.target.select()}
                              onBlur={handleFieldBlurReturnToSearch}
                              onKeyDown={e => handleCartRateKeyDown(e, idx)}
                              className="w-full text-right h-7 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                            />
                          </td>

                          {/* Disc (if enabled) */}
                          {showItemDiscount && (
                            <td className="py-1 px-1 align-middle text-right">
                              <input
                                ref={el => { cartDiscRefs.current[idx] = el; }}
                                type="number"
                                step="any"
                                value={line.discount === 0 ? '' : line.discount}
                                onChange={e => updateCartLine(idx, 'discount', e.target.value === '' ? 0 : Number(e.target.value))}
                                onFocus={e => e.target.select()}
                                onBlur={handleFieldBlurReturnToSearch}
                                onKeyDown={e => handleCartDiscKeyDown(e, idx)}
                                className="w-full text-right h-7 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                              />
                            </td>
                          )}

                          {/* GST */}
                          <td className="py-1 px-2 align-middle text-right font-mono font-bold text-slate-800 text-xs">
                            {lineTax.toFixed(2)}
                          </td>

                          {/* Amount */}
                          <td className="py-1 px-2.5 align-middle text-right font-black text-slate-900 font-mono text-xs">
                            {lineTotal.toFixed(2)}
                          </td>

                          {/* Delete */}
                          <td className="py-1 px-1 align-middle text-center">
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
                  value={billDiscount === 0 || billDiscount === '0' ? '' : billDiscount}
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
                    <span>Lumpsum Discount</span>
                    {billDiscountType === 'percent' && (
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
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Cash Paid</label>
              <input
                ref={cashInputRef}
                type="number"
                step="any"
                value={cash === 0 || cash === '0' ? '' : cash}
                placeholder=""
                onChange={e => handleCashInput(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={handleFieldBlurReturnToSearch}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCheckout();
                }}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5 truncate" title={config.Bank1Ledger || 'Bank 1'}>
                {config.Bank1Ledger || 'Bank 1'}
              </label>
              <input
                ref={bank1InputRef}
                type="number"
                step="any"
                value={bank1 === 0 || bank1 === '0' ? '' : bank1}
                placeholder=""
                onChange={e => handleBank1Input(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={handleFieldBlurReturnToSearch}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCheckout();
                }}
                className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-0.5 truncate" title={config.Bank2Ledger || 'Bank 2'}>
                {config.Bank2Ledger || 'Bank 2'}
              </label>
              <input
                ref={bank2InputRef}
                type="number"
                step="any"
                value={bank2 === 0 || bank2 === '0' ? '' : bank2}
                placeholder=""
                onChange={e => handleBank2Input(e.target.value === '' ? '' : Number(e.target.value))}
                onFocus={e => e.target.select()}
                onBlur={handleFieldBlurReturnToSearch}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCheckout();
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
                    : balance < -0.005
                    ? 'bg-blue-100 text-blue-900 border border-blue-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                {balance > 0.005 ? `Due: ${balance.toFixed(2)}` : balance < -0.005 ? `Change: ${Math.abs(balance).toFixed(2)}` : '✓ Settled'}
              </div>
            </div>
          </div>

          {/* Bank Transfer / Journal Ref No (Traces payment if customer paid via mBOB/BNB/Transfer) */}
          {((typeof bank1 === 'number' && bank1 > 0) || (typeof bank2 === 'number' && bank2 > 0)) && (
            <div className="pt-1 animate-in fade-in duration-150">
              <label className="block text-[11px] font-bold text-indigo-900 mb-0.5 flex items-center justify-between">
                <span>Bank Txn / Transfer Journal #</span>
                <span className="text-[10px] font-normal text-slate-500">For tracing</span>
              </label>
              <input
                type="text"
                value={bankTxnNo}
                placeholder="e.g. mBOB Ref / BNB Journal #"
                onChange={e => setBankTxnNo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCheckout();
                }}
                className="w-full h-8 rounded-lg border border-indigo-200 bg-indigo-50/40 px-2.5 font-mono text-xs font-bold text-indigo-950 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>
          )}
        </div>

        {/* Checkout & Instant Sharing Action Buttons */}
        <div className="space-y-1.5 pt-0.5">
          {/* Primary Checkout & Print (F2) */}
          <button
            type="button"
            onClick={() => handleCheckout('print')}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full py-2.5 sm:py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="h-4.5 w-4.5" />
            <span>Checkout & Print</span>
            <kbd className="bg-indigo-700/90 border border-indigo-400/50 text-indigo-100 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold">
              F2
            </kbd>
          </button>

          {/* Instant Share & Quick Save Actions (Available right before print) */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleCheckout('share_pdf')}
              disabled={cart.length === 0 || isSubmitting}
              className="py-2 px-1 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-300 font-bold text-xs transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Save bill and share PDF directly via WhatsApp / Email"
            >
              <Share2 className="h-3.5 w-3.5 text-violet-600 shrink-0" />
              <span className="truncate">Share PDF</span>
            </button>

            <button
              type="button"
              onClick={() => handleCheckout('download_pdf')}
              disabled={cart.length === 0 || isSubmitting}
              className="py-2 px-1 rounded-xl bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Save bill and download A4 Tax Invoice PDF"
            >
              <FileDown className="h-3.5 w-3.5 text-slate-200 shrink-0" />
              <span className="truncate">Save PDF</span>
            </button>

            <button
              type="button"
              onClick={() => handleCheckout('save_only')}
              disabled={cart.length === 0 || isSubmitting}
              className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Save bill to database without opening print dialogue"
            >
              <Check className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              <span className="truncate">Save Only</span>
            </button>
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
                      onChange={e => setWalkInDetails({ ...(walkInDetails || { name: '', phone: '', address: '' }), isGSTExempted: e.target.checked })}
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
    </div>
  );
};
