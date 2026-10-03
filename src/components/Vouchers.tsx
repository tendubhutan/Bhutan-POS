import { QuitConfirmModal } from './QuitConfirmModal';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Config, Item, Ledger } from '../types';
import { getGstFieldsForType, evaluateGstFormula } from '../utils/gstConfigUtils';
import {
  saveVoucher,
  saveMultiLineVoucher,
  getVouchers,
  deleteVoucher,
  cancelVoucher,
  deleteVoucherPermanent,
  saveLedger,
  peekNextVoucherNo,
  getVoucherPrefix,
  getVoucherDetails,
  getQuotations,
  loadJson,
  STORAGE_KEYS,
  DEFAULT_ITEMS
} from '../services/storageService';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  X,
  Search,
  BookOpen,
  ArrowRightLeft,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Pencil,
  LayoutGrid,
  RotateCcw,
  Receipt,
  Undo2,
  Truck,
  Boxes,
  FileCheck2,
  FileSpreadsheet,
  Share2,
  Download,
  ArrowLeft,
  ArrowRight,
  Ban,
  Eye,
  Check,
  Copy,
  MessageSquare,
  Repeat,
  Zap,
  Package
} from 'lucide-react';
import { RecurringVouchersModal } from './vouchers/RecurringVouchersModal';
import {
  getPendingDueRecurringVouchers,
  processDueRecurringVouchers
} from '../services/recurringVoucherService';
import XLSX from 'xlsx-js-style';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { AcceptModal } from './AcceptModal';
import { formatDateDMY } from '../utils/dateUtils';
import {
  VoucherCatalogModal,
  VoucherActionType,
  VoucherCategoryKey
} from './vouchers/VoucherCatalogModal';
import { VoucherSuccessActionModal, VoucherSuccessDetails } from './vouchers/VoucherSuccessActionModal';
import { VoucherShareModal, VoucherShareData } from './vouchers/VoucherShareModal';
import { RegisterShareModal } from './vouchers/RegisterShareModal';
import { BankTransactionIdModal } from './BankTransactionIdModal';
import { isBankLedger } from '../utils/ledgerUtils';
import { CreditNoteEntry } from './vouchers/CreditNoteEntry';
import { DebitNoteEntry } from './vouchers/DebitNoteEntry';
import { DeliveryNoteEntry } from './vouchers/DeliveryNoteEntry';
import { PhysicalStockEntry } from './vouchers/PhysicalStockEntry';
import { StockTransferEntry } from './vouchers/StockTransferEntry';
import { QuotationEntry } from './vouchers/QuotationEntry';
import { SalesOrderEntry } from './vouchers/SalesOrderEntry';
import { PurchaseOrderEntry } from './vouchers/PurchaseOrderEntry';
import { ReceiptNoteEntry } from './vouchers/ReceiptNoteEntry';
import {
  generateVoucherSlipPDF,
  generateVoucherRegisterPDF,
  shareOrDownloadPDF,
  printPdfDoc
} from '../utils/pdfExport';
import { playSaveSound } from '../utils/audio';
import { BillWiseModal } from './BillWiseModal';
import { BillAllocation } from '../types';
import { getPartyOutstandingBills } from '../services/storageService';

interface VouchersProps {
  config: Config;
  items?: Item[];
  ledgers: Ledger[];
  onDataRefresh: () => void;
  onOpenNewLedgerModal?: (group?: string, onSelect?: (name: string) => void) => void;
  onOpenNewItemModal?: (onSelect?: (item: Item) => void, itemToEdit?: Item | null) => void;
  onNavigateTo?: (view: string, reportTarget?: any) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onDrillVoucher?: (refNo: string) => void;
  onBack?: (forceDirect?: boolean) => void;
  isActive?: boolean;
}

interface VoucherGridLine {
  id: string;
  type: 'Dr' | 'Cr';
  ledger: string;
  debit: number | '';
  credit: number | '';
  narration: string;
  billAllocations?: BillAllocation[];
}

const DEFAULT_GROUPS = [
  'Cash-in-Hand',
  'Bank Accounts',
  'Sundry Debtors',
  'Sundry Creditors',
  'Direct Expenses',
  'Indirect Expenses',
  'Sales Account',
  'Purchase Account',
  'Duties & Taxes',
  'Current Assets',
  'Current Liabilities',
  'Capital Account'
];

export const Vouchers: React.FC<VouchersProps> = ({
  config,
  items = [],
  ledgers,
  onDataRefresh,
  onOpenNewLedgerModal,
  onOpenNewItemModal,
  onNavigateTo,
  initialVoucherTarget,
  onDrillVoucher,
  onBack,
  isActive = true
}) => {
  // Navigation & Category states
  const [mainTab, setMainTab] = useState<'entry' | 'register'>('entry');
  const [activeCategory, setActiveCategory] = useState<VoucherCategoryKey | 'register'>('financial');
  const [activeVType, setActiveVType] = useState<VoucherActionType | ''>('P');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // Financial Voucher Form States
  const [entryMode, setEntryMode] = useState<'single' | 'multi'>('multi');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');

  // Voucher Numbering State (Auto in sequence from settings vs Manual Entry)
  const isAutoMode = (config?.VoucherNumberingMode || 'auto') === 'auto';
  const [editingVoucherNo, setEditingVoucherNo] = useState<string | null>(null);
  const [voucherNo, setVoucherNo] = useState(() => (isAutoMode ? peekNextVoucherNo('P', config) : ''));
  const [quotationTab, setQuotationTab] = useState<'create' | 'register'>('create');
  const [salesOrderTab, setSalesOrderTab] = useState<'create' | 'register'>('create');
  const [purchaseOrderTab, setPurchaseOrderTab] = useState<'create' | 'register'>('create');
  const [receiptNoteTab, setReceiptNoteTab] = useState<'create' | 'register'>('create');
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // Single mode state
  const [amount, setAmount] = useState<number | ''>('');
  const [partyLedger, setPartyLedger] = useState('');
  const [modeLedger, setModeLedger] = useState('');
  const [debitLedger, setDebitLedger] = useState('');
  const [creditLedger, setCreditLedger] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  
  // GST Input Tracking State
  const [gstInputType, setGstInputType] = useState<'Local Purchase' | 'Local Expenses' | 'Bank Charges' | 'Import Customs GST Payment' | 'Import Purchase' | 'None'>('None');
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstNo, setSupplierGstNo] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [declarationNo, setDeclarationNo] = useState('');
  const [declarationDate, setDeclarationDate] = useState('');
  const [taxableAmount, setTaxableAmount] = useState<number | ''>('');
  const [exemptedAmount, setExemptedAmount] = useState<number | ''>('');
  const [gstAmount, setGstAmount] = useState<number | ''>('');
  const [totalImportAmount, setTotalImportAmount] = useState<number | ''>('');
  const [customGstData, setCustomGstData] = useState<Record<string, any>>({});

  // TDS 2% (Liability) Form IT-7(B) Tracking State
  const [isTdsApplicable, setIsTdsApplicable] = useState(false);
  const [tdsTpn, setTdsTpn] = useState('');
  const [tdsContractorNameAndAddress, setTdsContractorNameAndAddress] = useState('');
  const [tdsWorkDescription, setTdsWorkDescription] = useState('');
  const [tdsInvoiceNo, setTdsInvoiceNo] = useState('');
  const [tdsInvoiceDate, setTdsInvoiceDate] = useState('');
  const [tdsBillAmount, setTdsBillAmount] = useState<number | ''>('');
  const [tdsRate, setTdsRate] = useState<number | ''>(2);
  const [tdsAmount, setTdsAmount] = useState<number | ''>('');

  // Supplier Bill / Invoice Details (for Journal & Financial vouchers)
  const [supplierBillNo, setSupplierBillNo] = useState('');
  const [supplierBillDate, setSupplierBillDate] = useState(new Date().toISOString().split('T')[0]);

  // Journal Consumables / Stock Items Details (for stock purchased for internal consumption)
  const [showJournalItems, setShowJournalItems] = useState(false);
  const [journalItems, setJournalItems] = useState<Array<{
    id: string;
    itemCode: string;
    itemName: string;
    unit: string;
    qty: number | '';
    rate: number | '';
    amount: number | '';
    description?: string;
  }>>([]);

  const inventoryItems = useMemo(() => {
    if (items && items.length > 0) return items;
    return loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  }, [items]);

  const totalJournalItemsAmount = useMemo(() => {
    return journalItems.reduce((acc, it) => acc + (Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0))), 0);
  }, [journalItems]);

  const handleAddJournalItemRow = () => {
    setJournalItems(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        itemCode: '',
        itemName: '',
        unit: 'Pcs',
        qty: 1,
        rate: '',
        amount: '',
        description: ''
      }
    ]);
  };

  const handleUpdateJournalItem = (id: string, field: string, value: any) => {
    setJournalItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const updated = { ...it, [field]: value };
          if (field === 'itemName') {
            const match = inventoryItems.find(
              x => x['Item Name'].toLowerCase() === String(value).toLowerCase() ||
                   x['Item Code'].toLowerCase() === String(value).toLowerCase()
            );
            if (match) {
              updated.itemCode = match['Item Code'] || match['Item Name'];
              updated.unit = match.Unit || 'Pcs';
              if (match['Purchase Rate'] && (!updated.rate || Number(updated.rate) === 0)) {
                updated.rate = match['Purchase Rate'];
              }
            }
          }
          if (field === 'qty' || field === 'rate') {
            const q = field === 'qty' ? (value === '' ? 0 : Number(value)) : (updated.qty === '' ? 0 : Number(updated.qty));
            const r = field === 'rate' ? (value === '' ? 0 : Number(value)) : (updated.rate === '' ? 0 : Number(updated.rate));
            if (q > 0 && r > 0) {
              updated.amount = Math.round(q * r * 100) / 100;
            }
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleRemoveJournalItem = (id: string) => {
    setJournalItems(prev => prev.filter(it => it.id !== id));
  };

  // Multi mode grid state
  const [lines, setLines] = useState<VoucherGridLine[]>([
    { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
    { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
  ]);

  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const [bankTxnModal, setBankTxnModal] = useState<{
    isOpen: boolean;
    bankLedgerName: string;
    focusNextElementId?: string;
  }>({
    isOpen: false,
    bankLedgerName: '',
    focusNextElementId: undefined
  });

  // Bill-wise Allocation State
  const [billAllocations, setBillAllocations] = useState<BillAllocation[]>([]);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState<'save' | 'share' | 'print' | false>(false);
  const [billModalParty, setBillModalParty] = useState('');
  const [billModalTargetLineId, setBillModalTargetLineId] = useState<string | null>(null);

  // Quick Ledger Modal State (Create & Edit Mode)
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [isEditingLedger, setIsEditingLedger] = useState(false);
  const [editingOldName, setEditingOldName] = useState<string | null>(null);
  const [targetLineId, setTargetLineId] = useState<string | null>(null);
  const [targetSingleField, setTargetSingleField] = useState<string | null>(null);

  const [newLedgerName, setNewLedgerName] = useState('');
  const [newLedgerGroup, setNewLedgerGroup] = useState('Indirect Expenses');
  const [newOpBalance, setNewOpBalance] = useState<number | ''>(0);
  const [newBalanceType, setNewBalanceType] = useState<'Dr' | 'Cr'>('Dr');
  const [newGstNo, setNewGstNo] = useState('');
  const [newTpnNo, setNewTpnNo] = useState('');
  const [newContactNo, setNewContactNo] = useState('');

  // Voucher Register & View Modal
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterVType, setFilterVType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [filterBillNo, setFilterBillNo] = useState('');
  const [filterLedger, setFilterLedger] = useState('');
  const [filterNarration, setFilterNarration] = useState('');
  const [viewVoucher, setViewVoucher] = useState<any | null>(null);
  const [successModalDetails, setSuccessModalDetails] = useState<VoucherSuccessDetails | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [mismatchModal, setMismatchModal] = useState<{ totalDr: number; totalCr: number; diff: number } | null>(null);

  // Cancellation and Sharing Modals State
  const [cancelModalVoucher, setCancelModalVoucher] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteConfirmVoucher, setDeleteConfirmVoucher] = useState<any | null>(null);
  const [shareModalVoucher, setShareModalVoucher] = useState<VoucherShareData | null>(null);
  const [showShareRegisterModal, setShowShareRegisterModal] = useState(false);
  const [voucherTypeHistory, setVoucherTypeHistory] = useState<VoucherActionType[]>(['P']);
  const [pendingRecurringCount, setPendingRecurringCount] = useState<number>(0);

  // Prompt & Detail Modals for TDS 2% and GST Input
  const [tdsPromptOpen, setTdsPromptOpen] = useState(false);
  const [showTdsDetailModal, setShowTdsDetailModal] = useState(false);
  const [gstPromptOpen, setGstPromptOpen] = useState(false);
  const [showGstDetailModal, setShowGstDetailModal] = useState(false);
  const promptNextFocusRef = useRef<{ isMulti: boolean; lineIndex?: number; field?: 'debit' | 'credit' | 'ledger'; elementId?: string } | null>(null);

  const resumeBackgroundFocus = () => {
    const target = promptNextFocusRef.current;
    if (!target) return;
    promptNextFocusRef.current = null;
    setTimeout(() => {
      if (target.isMulti && target.lineIndex !== undefined && target.field) {
        focusGridField(target.lineIndex, target.field);
      } else if (target.elementId) {
        focusElement(target.elementId);
      }
    }, 60);
  };

  const loadedTargetKeyRef = useRef<string | null>(null);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const lastDerivedGst = useRef({
    supplierName: '',
    taxableAmount: '',
    gstAmount: '',
    referenceNo: '',
    invoiceDate: ''
  });

  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const isTdsLedger = (name: string): boolean => {
    if (!name || config.EnableTDS2Tracking === 'false') return false;
    const clean = name.toLowerCase().trim();
    return (
      clean === 'tds 2% (liability)' ||
      clean === 'tds 2%' ||
      clean === 'tds liability' ||
      clean.includes('tds 2%') ||
      clean.includes('tds 2') ||
      (clean.includes('tds') && clean.includes('liability')) ||
      (clean.includes('tds') && clean.includes('contract'))
    );
  };

  const isGstInputLedger = (name: string): boolean => {
    if (!name || config.EnableGSTInputTax === 'false') return false;
    const clean = name.toLowerCase().trim();
    return (
      clean === 'gst input' ||
      clean === 'gst input tax' ||
      clean.includes('gst input') ||
      clean.includes('gst-input')
    );
  };

  const prepareTdsDefaults = (context?: { isMulti?: boolean; lineId?: string; type?: 'Dr' | 'Cr'; lineAmt?: number }) => {
    setIsTdsApplicable(true);
    const party = partyLedger || (lines.find(l => l.ledger && !isTdsLedger(l.ledger) && !l.ledger.toLowerCase().includes('cash') && !l.ledger.toLowerCase().includes('bank'))?.ledger) || '';
    if (party) {
      if (!tdsContractorNameAndAddress) {
        setTdsContractorNameAndAddress(party);
        const matched = ledgers.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === party.trim().toLowerCase());
        if (matched) {
          const lTpn = matched['TPN No'] || matched['GST No'] || (matched as any).TPN || (matched as any).GSTIN || '';
          if (lTpn && !tdsTpn) setTdsTpn(lTpn);
          if (matched.Address && !tdsContractorNameAndAddress.includes(matched.Address)) {
            setTdsContractorNameAndAddress(`${party}, ${matched.Address}`);
          }
        }
      }
    }
    const effectiveInvoiceNo = (supplierBillNo || referenceNo || invoiceNo || '').trim();
    const effectiveInvoiceDate = (supplierBillDate || invoiceDate || date || '').trim();
    if (effectiveInvoiceDate && !tdsInvoiceDate) setTdsInvoiceDate(effectiveInvoiceDate);
    if (effectiveInvoiceNo && !tdsInvoiceNo) setTdsInvoiceNo(effectiveInvoiceNo);

    if (!tdsWorkDescription) {
      const expLine = lines.find(l => {
        const lname = (l.ledger || '').toLowerCase();
        return (l.type === 'Dr' || Number(l.debit) > 0) && !isTdsLedger(l.ledger) && !lname.includes('cash') && !lname.includes('bank');
      });
      const desc = expLine?.narration?.trim() || narration?.trim() || expLine?.ledger?.trim() || debitLedger?.trim() || '';
      if (desc) setTdsWorkDescription(desc);
    }

    if (context?.lineAmt && context.lineAmt > 0) {
      setTdsAmount(context.lineAmt);
      setTdsBillAmount(Math.round((context.lineAmt / 0.02) * 100) / 100);
    } else if (!tdsBillAmount || Number(tdsBillAmount) === 0) {
      const otherDr = lines.find(l => l.type === 'Dr' && !isTdsLedger(l.ledger));
      let gross = 0;
      if (otherDr && Number(otherDr.debit) > 0) gross = Number(otherDr.debit);
      else if (Number(amount) > 0) gross = Number(amount);
      else if (totalDr > 0) gross = totalDr;
      if (gross > 0) {
        setTdsBillAmount(gross);
        const rate = Number(tdsRate) || 2;
        setTdsAmount(Math.round((gross * (rate / 100)) * 100) / 100);
      }
    }
  };

  const prepareGstDefaults = (context?: { isMulti?: boolean; lineId?: string; type?: 'Dr' | 'Cr'; lineAmt?: number }) => {
    if (gstInputType === 'None') {
      setGstInputType('Local Purchase');
    }
    const party = partyLedger || (lines.find(l => l.ledger && !isGstInputLedger(l.ledger) && !l.ledger.toLowerCase().includes('cash') && !l.ledger.toLowerCase().includes('bank'))?.ledger) || '';
    if (party && !supplierName) {
      setSupplierName(party);
      const matched = ledgers.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === party.trim().toLowerCase());
      if (matched) {
        const lGst = matched['GST No'] || matched['TPN No'] || '';
        if (lGst) setSupplierGstNo(lGst);
      }
    }
    if (date && !invoiceDate) setInvoiceDate(date);
    if (invoiceNo && !invoiceNo) setInvoiceNo(invoiceNo);

    let expAmt = 0;
    const otherDr = lines.find(l => l.type === 'Dr' && !isGstInputLedger(l.ledger));
    if (otherDr && Number(otherDr.debit) > 0) expAmt = Number(otherDr.debit);
    else if (Number(amount) > 0) expAmt = Number(amount);

    if (expAmt > 0 && (!taxableAmount || Number(taxableAmount) === 0)) {
      setTaxableAmount(expAmt);
      if (!gstAmount || Number(gstAmount) === 0) {
        setGstAmount(Math.round((expAmt * 0.05) * 100) / 100);
      }
    }
  };

  const handleLedgerSelected = (
    selectedName: string,
    context?: { isMulti?: boolean; lineId?: string; lineIndex?: number; type?: 'Dr' | 'Cr'; lineAmt?: number; nextElementId?: string }
  ) => {
    if (isTdsLedger(selectedName)) {
      if (context?.isMulti && context.lineIndex !== undefined) {
        promptNextFocusRef.current = {
          isMulti: true,
          lineIndex: context.lineIndex,
          field: context.type === 'Dr' ? 'debit' : 'credit'
        };
      } else {
        promptNextFocusRef.current = {
          isMulti: false,
          elementId: context?.nextElementId || 'single-amount'
        };
      }
      prepareTdsDefaults(context);
      setTdsPromptOpen(true);
    } else if (isGstInputLedger(selectedName) && activeVType === 'P') {
      if (context?.isMulti && context.lineIndex !== undefined) {
        promptNextFocusRef.current = {
          isMulti: true,
          lineIndex: context.lineIndex,
          field: context.type === 'Dr' ? 'debit' : 'credit'
        };
      } else {
        promptNextFocusRef.current = {
          isMulti: false,
          elementId: context?.nextElementId || 'single-amount'
        };
      }
      prepareGstDefaults(context);
      setGstPromptOpen(true);
    }
  };

  // Keyboard navigation & focus trapper for TDS and GST prompt modals
  useEffect(() => {
    if (!tdsPromptOpen && !gstPromptOpen) return;

    const timer = setTimeout(() => {
      const yesBtn = document.getElementById('v-prompt-yes-btn');
      if (yesBtn) {
        yesBtn.focus();
      }
    }, 40);

    const handlePromptKeys = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
        if (tdsPromptOpen) {
          setTdsPromptOpen(false);
          setShowTdsDetailModal(true);
        } else if (gstPromptOpen) {
          setGstPromptOpen(false);
          setShowGstDetailModal(true);
        }
      } else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
        if (tdsPromptOpen) {
          setTdsPromptOpen(false);
          setIsTdsApplicable(false);
          resumeBackgroundFocus();
        } else if (gstPromptOpen) {
          setGstPromptOpen(false);
          setGstInputType('None');
          resumeBackgroundFocus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab') {
        const yesBtn = document.getElementById('v-prompt-yes-btn');
        const noBtn = document.getElementById('v-prompt-no-btn');
        if (document.activeElement === yesBtn && noBtn) {
          e.preventDefault();
          noBtn.focus();
        } else if (document.activeElement === noBtn && yesBtn) {
          e.preventDefault();
          yesBtn.focus();
        }
      }
    };

    window.addEventListener('keydown', handlePromptKeys, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handlePromptKeys, true);
    };
  }, [tdsPromptOpen, gstPromptOpen]);

  // Handle voucher type switch
  const handleVTypeChange = (type: VoucherActionType | '', pushHistory = true) => {
    if (!type) {
      setActiveVType('');
      return;
    }
    if (type === 'S') {
      if (onNavigateTo) onNavigateTo('pos');
      return;
    }
    if (type === 'PUR') {
      if (onNavigateTo) onNavigateTo('purchase');
      return;
    }

    setMainTab('entry');
    setActiveVType(type);

    if (pushHistory) {
      setVoucherTypeHistory(prev => (prev[prev.length - 1] === type ? prev : [...prev, type]));
    }

    // Auto update category
    if (['P', 'R', 'J', 'C'].includes(type)) {
      setActiveCategory('financial');
    } else if (['CN', 'DN'].includes(type)) {
      setActiveCategory('invoicing');
    } else if (['DEL_NOTE', 'PHYSICAL_STOCK'].includes(type)) {
      setActiveCategory('inventory');
    } else if (type === 'QUOTATION') {
      setActiveCategory('orders');
    }

    if (isAutoMode && ['P', 'R', 'J', 'C'].includes(type)) {
      setVoucherNo(peekNextVoucherNo(type as any, config));
    }

    if (type === 'P') { // Payment
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'R') { // Receipt
      setLines([
        { id: '1', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' },
        { id: '2', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' }
      ]);
    } else if (type === 'J') { // Journal
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'C') { // Contra
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    }
  };

  // Method to load an existing voucher or report record directly into Entry screen (supports duplication / cloning)
  const loadVoucherIntoEntry = (v: any, isDuplicate: boolean = false) => {
    if (!v) return;
    const rawType = v.type || (
      v.voucherNo?.startsWith('PV-') ? 'P' :
      v.voucherNo?.startsWith('RV-') ? 'R' :
      v.voucherNo?.startsWith('JV-') ? 'J' :
      v.voucherNo?.startsWith('CV-') ? 'C' :
      v.voucherNo?.startsWith('CN-') ? 'CN' :
      v.voucherNo?.startsWith('DN-') ? 'DN' :
      v.voucherNo?.startsWith('DLV-') || v.noteNo ? 'DEL_NOTE' :
      v.voucherNo?.startsWith('QT-') || v.quotationNo ? 'QUOTATION' :
      v.voucherNo?.startsWith('SO-') || v.orderNo ? 'SALES_ORDER' :
      v.voucherNo?.startsWith('PO-') || v.poNo ? 'PURCHASE_ORDER' :
      v.voucherNo?.startsWith('GRN-') || v.noteNo ? 'RECEIPT_NOTE' :
      v.voucherNo?.startsWith('PS-') ? 'PHYSICAL_STOCK' : ''
    );

    let vType = rawType;
    if (rawType === 'DLV') vType = 'DEL_NOTE';
    if (rawType === 'PHY') vType = 'PHYSICAL_STOCK';
    if (rawType === 'QTN') vType = 'QUOTATION';
    if (rawType === 'SO') vType = 'SALES_ORDER';
    if (rawType === 'PO') vType = 'PURCHASE_ORDER';
    if (rawType === 'GRN') vType = 'RECEIPT_NOTE';

    if (['P', 'R', 'J', 'C'].includes(vType)) {
      setMainTab('entry');
      setActiveCategory('financial');
      setActiveVType(vType as any);
      setVoucherTypeHistory([vType as any]);

      if (isDuplicate) {
        setEditingVoucherNo(null);
        setVoucherNo(isAutoMode ? peekNextVoucherNo(vType as any, config) : '');
        setDate(new Date().toISOString().split('T')[0]);
        setNarration(v.narration ? `${v.narration} (Copy of ${v.voucherNo || v.refNo})` : `Copy of ${v.voucherNo || v.refNo}`);
        setBillAllocations([]);
      } else {
        setEditingVoucherNo(v.voucherNo || null);
        setVoucherNo(v.voucherNo || '');
        if (v.date) {
          setDate(new Date(v.date).toISOString().split('T')[0]);
        }
        setNarration(v.narration || '');
      }

      if (v.lines && Array.isArray(v.lines) && v.lines.length > 0) {
        setEntryMode('multi');
        setLines(
          v.lines.map((l: any, idx: number) => {
            const isDr = l.type ? (l.type === 'Dr') : (Number(l.debit) > 0 || !l.credit);
            const rawAmt = l.amount !== undefined ? l.amount : (isDr ? (l.debit ?? l.total) : (l.credit ?? l.total));
            return {
              id: String(idx + 1),
              type: isDr ? 'Dr' : 'Cr',
              ledger: l.ledger || '',
              debit: isDr ? (rawAmt !== undefined && rawAmt !== null && rawAmt !== '' ? Number(rawAmt) : '') : '',
              credit: !isDr ? (rawAmt !== undefined && rawAmt !== null && rawAmt !== '' ? Number(rawAmt) : '') : '',
              narration: l.narration || ''
            };
          })
        );
      } else {
        setEntryMode('single');
        const totalVal = v.amount ?? v.total ?? v.totalAmount ?? '';
        setAmount(totalVal !== '' ? Number(totalVal) : '');

        if (vType === 'P') { // Payment: Debit Expense/Party, Credit Mode (Cash/Bank)
          setPartyLedger(v.partyLedger || v.debitLedger || '');
          setModeLedger(v.modeLedger || v.creditLedger || 'Cash');
        } else if (vType === 'R') { // Receipt: Credit Customer/Income, Debit Mode (Cash/Bank)
          setPartyLedger(v.partyLedger || v.creditLedger || '');
          setModeLedger(v.modeLedger || v.debitLedger || 'Cash');
        } else if (vType === 'J') { // Journal
          setDebitLedger(v.debitLedger || '');
          setCreditLedger(v.creditLedger || '');
        } else if (vType === 'C') { // Contra
          setFromAccount(v.fromAccount || v.creditLedger || '');
          setToAccount(v.toAccount || v.debitLedger || '');
        }
      }

      // Load Supplier Bill / Invoice Details
      setSupplierBillNo(isDuplicate ? '' : (v.supplierBillNo || v.refNo || v.billNo || ''));
      setSupplierBillDate(isDuplicate ? new Date().toISOString().split('T')[0] : (v.supplierBillDate || v.billDate || v.invoiceDate || (v.date ? new Date(v.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])));

      // Load GST Input Tracking Fields
      setGstInputType(v.gstInputType || 'None');
      setSupplierName(v.supplierName || '');
      setSupplierGstNo(v.supplierGstNo || '');
      setSupplierCountry(v.supplierCountry || '');
      setInvoiceNo(isDuplicate ? '' : (v.invoiceNo || ''));
      setInvoiceDate(v.invoiceDate || '');
      setReferenceNo(isDuplicate ? '' : (v.referenceNo || ''));
      setDeclarationNo(isDuplicate ? '' : (v.declarationNo || ''));
      setDeclarationDate(v.declarationDate || '');
      setTaxableAmount(v.taxableAmount !== undefined ? v.taxableAmount : '');
      setExemptedAmount(v.exemptedAmount !== undefined ? v.exemptedAmount : '');
      setGstAmount(v.gstAmount !== undefined ? v.gstAmount : '');
      setTotalImportAmount(v.totalImportAmount !== undefined ? v.totalImportAmount : '');
      setCustomGstData(v.customGstData || {});

      // Load TDS 2% (Liability) Form IT-7(B) Tracking Fields
      setIsTdsApplicable(Boolean(v.isTdsApplicable));
      setTdsTpn(v.tdsTpn || '');
      setTdsContractorNameAndAddress(v.tdsContractorNameAndAddress || '');
      setTdsWorkDescription(v.tdsWorkDescription || '');
      setTdsInvoiceNo(isDuplicate ? '' : (v.tdsInvoiceNo || ''));
      setTdsInvoiceDate(v.tdsInvoiceDate || '');
      setTdsBillAmount(v.tdsBillAmount !== undefined ? v.tdsBillAmount : '');
      setTdsRate(v.tdsRate !== undefined ? v.tdsRate : 2);
      setTdsAmount(v.tdsAmount !== undefined ? v.tdsAmount : '');

      // Load Consumable / Stock Items (for Journal vouchers)
      if (v.items && Array.isArray(v.items) && v.items.length > 0) {
        setShowJournalItems(true);
        setJournalItems(v.items.map((it: any, idx: number) => ({
          id: String(idx + 1),
          itemCode: it.itemCode || it['Item Code'] || '',
          itemName: it.itemName || it['Item Name'] || '',
          unit: it.unit || it.Unit || 'Pcs',
          qty: it.qty !== undefined ? it.qty : (it.Qty !== undefined ? it.Qty : ''),
          rate: it.rate !== undefined ? it.rate : (it.Rate !== undefined ? it.Rate : ''),
          amount: it.amount !== undefined ? it.amount : (it['Line Total'] || it.total || ''),
          description: it.description || it.lineDescription || ''
        })));
      } else {
        setShowJournalItems(false);
        setJournalItems([]);
      }

      if (isDuplicate) {
        showToast(`Voucher duplicated from ${v.voucherNo || v.refNo}! Review and press Save.`, 'success');
      }

    } else if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'RECEIPT_NOTE'].includes(vType)) {
      setMainTab('entry');
      handleVTypeChange(vType as any, false);
      setVoucherTypeHistory([vType as any]);
    } else if (vType === 'INV' || vType === 'S') {
      const details = getVoucherDetails(v.voucherNo || v.invoiceNo);
      const inv = details?.header || v;
      const isNormalSale = inv && (
        inv.isPOS === false || 
        inv.voucherTypeId === 'VT-SALE-NORMAL' || 
        inv.invoiceNo?.startsWith('SAL-') || 
        inv.invoiceNo?.startsWith('INV-B2B-') || 
        Boolean(inv.orderNo) || 
        Boolean(inv.deliveryNoteNo) || 
        Boolean(inv.termsAndConditions)
      );
      if (isNormalSale && onNavigateTo) {
        onNavigateTo('normalsale');
      } else if (onNavigateTo) {
        onNavigateTo('pos');
      }
    } else if (vType === 'PUR') {
      if (onNavigateTo) onNavigateTo('purchase');
    }
  };

  // Refresh recent vouchers list
  const loadRecentVouchers = () => {
    const list = getVouchers();
    setRecentVouchers(list);
    // Refresh pending recurring count
    const pending = getPendingDueRecurringVouchers();
    setPendingRecurringCount(pending.length);
  };

  const partyOutstandingBills = useMemo(() => {
    if (config.EnableBillWiseDetails === 'false') return [];
    if (!partyLedger || (activeVType !== 'P' && activeVType !== 'R')) return [];
    return getPartyOutstandingBills(partyLedger, activeVType === 'P' ? 'creditor' : 'debtor');
  }, [partyLedger, activeVType, config.EnableBillWiseDetails]);

  // Intelligent Accounting Narration Auto-Generator looking at Debit & Credit fields
  const getSuggestedNarration = (
    vType: string,
    debitLedgerName: string,
    creditLedgerName: string,
    allocs: BillAllocation[] = [],
    amt?: number | string
  ): string => {
    const dr = (debitLedgerName || '').trim();
    const cr = (creditLedgerName || '').trim();

    if (!dr && !cr) return '';

    const getGroup = (name: string): string => {
      const lObj = ledgers.find(l => l['Ledger Name'].toLowerCase() === name.toLowerCase());
      return (lObj?.Group || '').toLowerCase().trim();
    };

    const isBankOrCash = (name: string): boolean => {
      if (!name) return false;
      const n = name.toLowerCase();
      if (n === 'cash' || n.includes('cash-in-hand')) return true;
      if (isBankLedger(name, ledgers, config)) return true;
      const g = getGroup(name);
      return g === 'bank accounts' || g === 'bank od a/c' || g === 'bank occ a/c' || g === 'cash-in-hand';
    };

    const isParty = (name: string): boolean => {
      if (!name) return false;
      if (isBankOrCash(name)) return false;
      const g = getGroup(name);
      return (
        g.includes('creditor') ||
        g.includes('debtor') ||
        g.includes('supplier') ||
        g.includes('customer') ||
        g === 'sundry creditors' ||
        g === 'sundry debtors'
      );
    };

    const isExpenseOrAsset = (name: string): boolean => {
      if (!name) return false;
      if (isBankOrCash(name) || isParty(name)) return false;
      const g = getGroup(name);
      const n = name.toLowerCase();
      return (
        g.includes('expense') ||
        g.includes('direct expenses') ||
        g.includes('indirect expenses') ||
        g.includes('fixed asset') ||
        g.includes('current asset') ||
        g.includes('asset') ||
        g.includes('purchase') ||
        g.includes('cost of goods') ||
        g.includes('administrative') ||
        g.includes('selling') ||
        g.includes('duties') ||
        n.includes('stationery') ||
        n.includes('printing') ||
        n.includes('rent') ||
        n.includes('salary') ||
        n.includes('wage') ||
        n.includes('fuel') ||
        n.includes('repair') ||
        n.includes('maintenance') ||
        n.includes('consumable') ||
        n.includes('electricity') ||
        n.includes('office') ||
        n.includes('supplies') ||
        n.includes('tea') ||
        n.includes('refreshment') ||
        n.includes('travel') ||
        n.includes('vehicle') ||
        n.includes('freight') ||
        n.includes('carriage')
      );
    };

    const isPhysicalItemOrConsumable = (name: string): boolean => {
      const n = name.toLowerCase();
      return (
        n.includes('stationery') ||
        n.includes('printing') ||
        n.includes('supplies') ||
        n.includes('consumable') ||
        n.includes('goods') ||
        n.includes('purchase') ||
        n.includes('stock') ||
        n.includes('item') ||
        n.includes('computer') ||
        n.includes('hardware') ||
        n.includes('equipment') ||
        n.includes('furniture') ||
        n.includes('tools') ||
        n.includes('materials') ||
        n.includes('books')
      );
    };

    const formatCleanName = (name: string): string => {
      let clean = name.trim();
      clean = clean.replace(/\s+(a\/c|account|expenses?|dr|cr|\(dr\)|\(cr\))$/i, '');
      clean = clean.replace(/\s+(a\/c|account|expenses?)$/i, '');
      return clean.toLowerCase();
    };

    const billsText = allocs.length > 0 ? ` against Bill #${allocs.map(a => a.billNo).join(', ')}` : '';

    // CASE 1: Debit is Expense / Asset / Consumables (e.g. Printing and Stationery)
    if (dr && isExpenseOrAsset(dr)) {
      const expName = formatCleanName(dr);
      const isPurchase = isPhysicalItemOrConsumable(dr);

      if (cr && isParty(cr)) {
        // e.g. Debit: Stationery, Credit: Bhutan Retail Enterprise -> "Being stationery purchased from Bhutan Retail Enterprise"
        if (isPurchase) {
          return `Being ${expName} purchased from ${cr}${billsText}`;
        }
        return `Being ${expName} provided by ${cr}${billsText}`;
      }

      if (cr && isBankOrCash(cr)) {
        // e.g. Debit: Stationery, Credit: Bank -> "Being stationery purchased"
        if (isPurchase) {
          return `Being ${expName} purchased`;
        }
        return `Being payment made for ${expName}`;
      }

      if (cr) {
        return `Being ${expName} adjusted against ${cr}`;
      }

      return isPurchase ? `Being ${expName} purchased` : `Being payment made for ${expName}`;
    }

    // CASE 2: Debit is a Party (Supplier / Creditor payment)
    if (dr && isParty(dr)) {
      if (cr && isBankOrCash(cr)) {
        return `Being payment made to ${dr}${billsText}`;
      }
      if (cr) {
        return `Being journal adjustment passed for ${dr} and ${cr}`;
      }
      return `Being payment made to ${dr}${billsText}`;
    }

    // CASE 3: Credit is a Party (Customer / Debtor receipt or sales)
    if (cr && isParty(cr)) {
      if (dr && isBankOrCash(dr)) {
        return `Being payment received from ${cr}${billsText}`;
      }
      if (dr) {
        return `Being journal adjustment passed for ${cr} and ${dr}`;
      }
      return `Being payment received from ${cr}${billsText}`;
    }

    // CASE 4: Contra (Bank / Cash to Bank / Cash)
    if (isBankOrCash(dr) && isBankOrCash(cr)) {
      if (dr.toLowerCase().includes('cash') && isBankLedger(cr, ledgers, config)) {
        return `Being cash withdrawn from ${cr}`;
      }
      if (isBankLedger(dr, ledgers, config) && cr.toLowerCase().includes('cash')) {
        return `Being cash deposited into ${dr}`;
      }
      return `Being funds transferred from ${cr} to ${dr}`;
    }

    // CASE 5: General Journal Fallbacks
    if (vType === 'J') {
      if (dr && cr) return `Being journal entry passed for ${dr} and ${cr}`;
      if (dr || cr) return `Being journal entry passed for ${dr || cr}`;
      return 'Being journal adjustment entry passed';
    }

    if (vType === 'P') {
      if (dr) return `Being payment made for ${dr}${billsText}`;
      return 'Being payment made for expenses';
    }

    if (vType === 'R') {
      if (cr) return `Being payment received from ${cr}${billsText}`;
      return 'Being amount received';
    }

    if (vType === 'C') {
      return 'Being cash/bank contra transfer';
    }

    return '';
  };

  const checkAndPromptBankLedger = (ledgerName: string, focusNextElementId?: string) => {
    if (isBankLedger(ledgerName, ledgers, config)) {
      setBankTxnModal({
        isOpen: true,
        bankLedgerName: ledgerName,
        focusNextElementId
      });
    }
  };

  // Check if bank account is involved in the current voucher
  const isBankInvolved = useMemo(() => {
    const bankLedgersSet = new Set(
      ledgers
        .filter(l => l.Group === 'Bank Accounts' || l.Group === 'Bank OCC A/c' || l.Group === 'Bank OD A/c' || l['Ledger Name'].toLowerCase().includes('bank') || l['Ledger Name'].toLowerCase().includes('account') || l['Ledger Name'].toLowerCase().includes('bob') || l['Ledger Name'].toLowerCase().includes('bnb'))
        .map(l => l['Ledger Name'].toLowerCase())
    );
    if (entryMode === 'multi') {
      return lines.some(l => bankLedgersSet.has((l.ledger || '').toLowerCase()));
    } else {
      const activeAccounts = [partyLedger, modeLedger, debitLedger, creditLedger, fromAccount, toAccount];
      return activeAccounts.some(name => bankLedgersSet.has((name || '').toLowerCase()));
    }
  }, [ledgers, entryMode, lines, partyLedger, modeLedger, debitLedger, creditLedger, fromAccount, toAccount]);

  // Listen to incoming initialVoucherTarget from reports or drilldown
  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const key = `${initialVoucherTarget.voucherNo}_${initialVoucherTarget.timestamp}`;
      if (loadedTargetKeyRef.current !== key) {
        loadedTargetKeyRef.current = key;
        const details = getVoucherDetails(initialVoucherTarget.voucherNo);
        if (details) {
          loadVoucherIntoEntry(details.header || details, Boolean((initialVoucherTarget as any)?.isDuplicate));
        }
      }
    } else {
      if (loadedTargetKeyRef.current !== null) {
        loadedTargetKeyRef.current = null;
        setEditingVoucherNo(null);
        setAmount('');
        setPartyLedger('');
        setModeLedger('');
        setDebitLedger('');
        setCreditLedger('');
        setFromAccount('');
        setToAccount('');
        setTransactionId('');
        setLines([
          { id: '1', type: 'Dr', ledger: '', debit: '', credit: '', narration: '' },
          { id: '2', type: 'Cr', ledger: '', debit: '', credit: '', narration: '' }
        ]);
        if (isAutoMode && activeVType && ['P', 'R', 'J', 'C'].includes(activeVType)) {
          setVoucherNo(peekNextVoucherNo(activeVType as any, config));
        }
      }
    }
  }, [initialVoucherTarget]);

  // Sync voucher number with type / config if auto mode
  useEffect(() => {
    if (editingVoucherNo) return; // Do not overwrite voucher number while editing an existing voucher
    if (isAutoMode && activeVType && ['P', 'R', 'J', 'C'].includes(activeVType)) {
      setVoucherNo(peekNextVoucherNo(activeVType as any, config));
    }
  }, [activeVType, config, isAutoMode, editingVoucherNo]);

  // Auto-detect & auto-populate TDS 2% (Liability) Form IT-7(B) fields when TDS 2% is entered/debited
  useEffect(() => {
    if (config.EnableTDS2Tracking === 'false') return;

    let detectedTds = false;
    let detectedTdsAmount: number | '' = '';
    let detectedGrossAmount: number | '' = '';
    let detectedPartyName = '';

    if (entryMode === 'multi') {
      const tdsLine = lines.find(l => {
        const name = (l.ledger || '').toLowerCase();
        return name.includes('tds 2%') || name.includes('tds 2') || (name.includes('tds') && name.includes('liability')) || (name.includes('tds') && name.includes('contract'));
      });

      if (tdsLine) {
        detectedTds = true;
        const lineAmt = tdsLine.type === 'Dr' ? Number(tdsLine.debit) : Number(tdsLine.credit);
        if (lineAmt > 0) {
          detectedTdsAmount = lineAmt;
        }
        // Look for contractor / expense line (non-cash/non-bank/non-TDS)
        const partyLine = lines.find(l => {
          if (l === tdsLine) return false;
          const lname = (l.ledger || '').toLowerCase();
          return !lname.includes('cash') && !lname.includes('bank');
        }) || lines.find(l => l !== tdsLine);

        if (partyLine) {
          detectedPartyName = partyLine.ledger;
          const pAmt = partyLine.type === 'Dr' ? Number(partyLine.debit) : Number(partyLine.credit);
          if (pAmt > (Number(detectedTdsAmount) || 0)) {
            detectedGrossAmount = pAmt;
          }
        }
      }
    } else {
      // Single mode
      const hasTdsSingle = [partyLedger, debitLedger, creditLedger, modeLedger].some(l => {
        const name = (l || '').toLowerCase();
        return name.includes('tds 2%') || name.includes('tds 2') || (name.includes('tds') && name.includes('liability')) || (name.includes('tds') && name.includes('contract'));
      });
      if (hasTdsSingle) {
        detectedTds = true;
        if (amount && Number(amount) > 0) {
          detectedTdsAmount = Number(amount);
        }
        const nonTds = [partyLedger, debitLedger, creditLedger, modeLedger].find(l => {
          const name = (l || '').toLowerCase();
          return l && !name.includes('tds') && !name.includes('cash') && !name.includes('bank');
        }) || partyLedger || debitLedger || creditLedger;
        if (nonTds) detectedPartyName = nonTds;
      }
    }

    if (detectedTds) {
      setIsTdsApplicable(true);
      if (detectedTdsAmount !== '') {
        setTdsAmount(detectedTdsAmount);
        const curRate = Number(tdsRate) || 2;
        if (detectedGrossAmount !== '') {
          setTdsBillAmount(detectedGrossAmount);
        } else {
          setTdsBillAmount(Math.round((Number(detectedTdsAmount) / (curRate / 100)) * 100) / 100);
        }
      } else if (detectedGrossAmount !== '') {
        setTdsBillAmount(detectedGrossAmount);
        const curRate = Number(tdsRate) || 2;
        setTdsAmount(Math.round((Number(detectedGrossAmount) * (curRate / 100)) * 100) / 100);
      }

      if (detectedPartyName) {
        setTdsContractorNameAndAddress(prev => prev || detectedPartyName);
        const matchedLedger = ledgers.find(l => (l['Ledger Name'] || '').trim().toLowerCase() === detectedPartyName.trim().toLowerCase());
        if (matchedLedger) {
          const lTpn = matchedLedger['TPN No'] || matchedLedger['GST No'] || (matchedLedger as any).TPN || (matchedLedger as any).GSTIN || '';
          if (lTpn) setTdsTpn(prev => prev || lTpn);
          if (matchedLedger.Address && !tdsContractorNameAndAddress.includes(matchedLedger.Address)) {
            setTdsContractorNameAndAddress(prev => prev ? `${prev}, ${matchedLedger.Address}` : `${detectedPartyName}, ${matchedLedger.Address}`);
          }
        }
      }

      const effectiveBillNo = (supplierBillNo || referenceNo || invoiceNo || '').trim();
      const effectiveBillDate = (supplierBillDate || invoiceDate || date || '').trim();

      if (effectiveBillNo) setTdsInvoiceNo(prev => prev || effectiveBillNo);
      if (effectiveBillDate) setTdsInvoiceDate(prev => prev || effectiveBillDate);

      const expLine = lines.find(l => {
        const lname = (l.ledger || '').toLowerCase();
        return (l.type === 'Dr' || Number(l.debit) > 0) && !isTdsLedger(l.ledger) && !lname.includes('cash') && !lname.includes('bank');
      });
      const desc = expLine?.narration?.trim() || narration?.trim() || expLine?.ledger?.trim() || debitLedger?.trim() || '';
      if (desc) setTdsWorkDescription(prev => prev || desc);
    }
  }, [lines, entryMode, partyLedger, debitLedger, creditLedger, modeLedger, amount, date, invoiceNo, invoiceDate, supplierBillNo, supplierBillDate, referenceNo, narration, config.EnableTDS2Tracking]);

  useEffect(() => {
    if (activeVType === 'P' && config.EnableGSTInputTax === 'true' && gstInputType !== 'None') {
      let bankLg = '';
      let expenseAmt = 0;
      let gstAmt = 0;
      
      if (entryMode === 'multi') {
        lines.forEach(l => {
          if (!l.ledger || !l.type) return;
          const lgObj = ledgers.find(lg => lg['Ledger Name'] === l.ledger);
          const grp = lgObj?.Group || '';
          const amt = Number(l.debit) || Number(l.credit) || 0;
          if (l.type === 'Cr' && (grp === 'Bank Accounts' || grp === 'Cash-in-Hand')) {
            bankLg = l.ledger;
          }
          if (l.type === 'Dr') {
            if (grp === 'Duties & Taxes' || l.ledger.toLowerCase().includes('gst')) {
              gstAmt += amt;
            } else {
              expenseAmt += amt;
            }
          }
        });
      } else {
        const lgObj = ledgers.find(lg => lg['Ledger Name'] === modeLedger);
        if (lgObj && (lgObj.Group === 'Bank Accounts' || lgObj.Group === 'Cash-in-Hand')) {
          bankLg = modeLedger;
        }
        expenseAmt = Number(amount) || 0;
      }

      const derivedSupplier = (gstInputType === 'Bank Charges' && bankLg) ? bankLg : '';
      let derivedTaxable = expenseAmt > 0 ? expenseAmt.toString() : '';
      let derivedGst = gstAmt > 0 ? gstAmt.toString() : (expenseAmt > 0 && gstInputType !== 'Import Customs GST Payment' ? (expenseAmt * 0.05).toFixed(2) : '');
      
      if (gstInputType === 'Import Customs GST Payment') {
        const currentGst = gstAmt > 0 ? gstAmt : (Number(amount) || (typeof gstAmount === 'number' && gstAmount > 0 ? gstAmount : 0));
        derivedGst = currentGst > 0 ? currentGst.toString() : '';
        const fields = getGstFieldsForType(config.gstInputConfigs, gstInputType);
        const taxField = fields.find(f => f.id === 'taxableAmount');
        if (taxField && taxField.sourceType === 'formula' && taxField.sourceValue) {
          const calc = evaluateGstFormula(taxField.sourceValue, { gstAmount: currentGst, amount: Number(amount) || expenseAmt || 0 });
          derivedTaxable = currentGst > 0 ? (Math.round((calc + Number.EPSILON) * 100) / 100).toString() : '';
        } else {
          derivedTaxable = currentGst > 0 ? (Math.round((currentGst * 20 + Number.EPSILON) * 100) / 100).toString() : '';
        }
      }
      
      const derivedRef = transactionId || '';
      const derivedDate = date || '';

      if (derivedSupplier && (!supplierName || supplierName === lastDerivedGst.current.supplierName)) {
        setSupplierName(derivedSupplier);
        lastDerivedGst.current.supplierName = derivedSupplier;
      }
      if (derivedTaxable && (!taxableAmount || taxableAmount.toString() === lastDerivedGst.current.taxableAmount)) {
        setTaxableAmount(Number(derivedTaxable));
        lastDerivedGst.current.taxableAmount = derivedTaxable;
      }
      if (derivedGst && (!gstAmount || gstAmount.toString() === lastDerivedGst.current.gstAmount)) {
        setGstAmount(Number(derivedGst));
        lastDerivedGst.current.gstAmount = derivedGst;
      }
      if (derivedRef && (!referenceNo || referenceNo === lastDerivedGst.current.referenceNo)) {
        setReferenceNo(derivedRef);
        lastDerivedGst.current.referenceNo = derivedRef;
      }
      if (derivedDate && (!invoiceDate || invoiceDate === lastDerivedGst.current.invoiceDate)) {
        setInvoiceDate(derivedDate);
        lastDerivedGst.current.invoiceDate = derivedDate;
      }
    }
  }, [gstInputType, lines, amount, partyLedger, modeLedger, transactionId, date, entryMode, ledgers, config.EnableGSTInputTax, activeVType]);

  useEffect(() => {
    loadRecentVouchers();
    // Check if any auto-vouchers are due for auto-posting
    try {
      const due = getPendingDueRecurringVouchers();
      if (due.length > 0) {
        const autoDue = due.filter(d => d.autoPostMode === 'automatic');
        if (autoDue.length > 0) {
          const res = processDueRecurringVouchers();
          if (res.postedCount > 0) {
            showToast(`⚡ Auto-posted ${res.postedCount} scheduled recurring voucher(s) (Rent, Bills, Salaries)`, 'success');
            loadRecentVouchers();
            onDataRefresh();
          }
        }
      }
    } catch (e) {
      console.warn('Auto recurring check error:', e);
    }
  }, []);

  // Sync initial ledgers into fields
  useEffect(() => {
    // Intentionally left blank to avoid auto-filling ledgers
  }, [ledgers]);

  const handleVoucherBack = () => {
    if (tdsPromptOpen) {
      setTdsPromptOpen(false);
      setIsTdsApplicable(false);
      return true;
    }
    if (showTdsDetailModal) {
      setShowTdsDetailModal(false);
      return true;
    }
    if (gstPromptOpen) {
      setGstPromptOpen(false);
      setGstInputType('None');
      return true;
    }
    if (showGstDetailModal) {
      setShowGstDetailModal(false);
      return true;
    }
    if (showQuitModal) {
      setShowQuitModal(false);
      return true;
    }
    if (billModalOpen) {
      setBillModalOpen(false);
      setBillModalTargetLineId(null);
      return true;
    }
    if (showShareRegisterModal) {
      setShowShareRegisterModal(false);
      return true;
    }
    if (shareModalVoucher) {
      setShareModalVoucher(null);
      return true;
    }
    if (showShareRegisterModal) {
      setShowShareRegisterModal(false);
      return true;
    }
    if (cancelModalVoucher) {
      setCancelModalVoucher(null);
      return true;
    }
    if (deleteConfirmVoucher) {
      setDeleteConfirmVoucher(null);
      return true;
    }
    if (showCatalogModal) {
      setShowCatalogModal(false);
      return true;
    }
    if (showLedgerModal) {
      setShowLedgerModal(false);
      return true;
    }
    if (viewVoucher) {
      setViewVoucher(null);
      return true;
    }
    if (mismatchModal) {
      setMismatchModal(null);
      return true;
    }
    if (successModalDetails) {
      setSuccessModalDetails(null);
      return true;
    }
    // If in register tab
    if (mainTab === 'register') {
      const hasActiveFilters = Boolean(
        searchTerm ||
        filterStartDate ||
        filterEndDate ||
        filterVType !== 'ALL' ||
        filterStatus !== 'ALL' ||
        filterBillNo ||
        filterLedger ||
        filterNarration
      );
      if (hasActiveFilters) {
        setSearchTerm('');
        setFilterStartDate('');
        setFilterEndDate('');
        setFilterVType('ALL');
        setFilterStatus('ALL');
        setFilterBillNo('');
        setFilterLedger('');
        setFilterNarration('');
        return true;
      }
      setMainTab('entry');
      return true;
    }
    // If in entry mode with dirty inputs, party/account selected, or editing existing voucher
    if (mainTab === 'entry') {
      const isDirty = (Number(amount) > 0) || Boolean(narration.trim()) || !!partyLedger || !!debitLedger || !!creditLedger || !!fromAccount || !!toAccount || !!editingVoucherNo || (lines.length > 0 && lines.some(l => (Number(l.debit) > 0) || (Number(l.credit) > 0) || !!l.ledger));
      if (isDirty) {
        setShowQuitModal(true);
        return true;
      }
    }
    // If inside non-financial sub-vouchers (Quotation, Delivery Note, Credit Note, Debit Note, Physical Stock, Orders, GRN)
    if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'RECEIPT_NOTE'].includes(activeVType)) {
      // Let the active sub-component handle its own back/quit confirmation
      return false;
    }
    // If in entry mode with voucher type history
    if (voucherTypeHistory.length > 1) {
      const updated = [...voucherTypeHistory];
      updated.pop();
      const prevType = updated[updated.length - 1] || 'P';
      setVoucherTypeHistory(updated);
      handleVTypeChange(prevType, false);
      return true;
    }

    // Clean entry screen at root voucher: return false to signal that the screen has reached its root
    return false;
  };

  const handleSubVoucherBack = () => {
    handleCancelOrResetEntry();
    if (voucherTypeHistory.length > 1) {
      const updated = [...voucherTypeHistory];
      updated.pop();
      const prevType = updated[updated.length - 1] || 'P';
      setVoucherTypeHistory(updated);
      handleVTypeChange(prevType, false);
    } else {
      setVoucherTypeHistory(['P']);
      handleVTypeChange('P', false);
    }
  };

  // Global Keyboard Shortcuts (F4, F5, F6, F7, F8, F9, F10, F2, Alt+C, Alt+A, Escape)
  useEffect(() => {
    if (isActive === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If currently on a sub-voucher component, let the sub-component handle F keys etc.
      if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'RECEIPT_NOTE'].includes(activeVType)) {
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        setShowCatalogModal(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleVTypeChange('C');
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleVTypeChange('P');
      } else if (e.key === 'F6') {
        e.preventDefault();
        handleVTypeChange('R');
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleVTypeChange('J');
      } else if (e.ctrlKey && e.key === 'F8') {
        e.preventDefault();
        handleVTypeChange('CN');
      } else if (e.ctrlKey && e.key === 'F9') {
        e.preventDefault();
        handleVTypeChange('DN');
      } else if (e.altKey && e.key === 'F8') {
        e.preventDefault();
        handleVTypeChange('DEL_NOTE');
      } else if (e.altKey && e.key === 'F7') {
        e.preventDefault();
        handleVTypeChange('STOCK_TRANSFER');
      } else if (e.altKey && e.key === 'F10') {
        e.preventDefault();
        handleVTypeChange('PHYSICAL_STOCK');
      } else if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        handleVTypeChange('QUOTATION');
      } else if (e.key === 'F2' || e.code === 'F2' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (['P', 'R', 'J', 'C'].includes(activeVType)) {
          handleSubmit();
        }
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        openCreateLedgerModal();
      } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (entryMode === 'multi' && ['P', 'R', 'J', 'C'].includes(activeVType)) {
          addGridRow();
        }
      } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        setMainTab(prev => (prev === 'entry' ? 'register' : 'entry'));
        if (mainTab === 'entry') loadRecentVouchers();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isActive,
    mainTab,
    activeVType,
    date,
    amount,
    narration,
    partyLedger,
    modeLedger,
    debitLedger,
    creditLedger,
    lines,
    entryMode,
    showLedgerModal,
    showCatalogModal,
    viewVoucher,
    mismatchModal,
    successModalDetails,
    cancelModalVoucher,
    deleteConfirmVoucher,
    shareModalVoucher,
    showShareRegisterModal,
    voucherTypeHistory,
    searchTerm,
    filterStartDate,
    filterEndDate,
    filterVType,
    filterStatus,
    filterBillNo,
    filterLedger,
    filterNarration
  ]);

  // Intercept app:back and app:save events from Header/App navigation
  useEffect(() => {
    if (isActive === false) return;

    const handleBackEvent = (e: CustomEvent) => {
      if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION', 'SALES_ORDER', 'PURCHASE_ORDER', 'RECEIPT_NOTE'].includes(activeVType)) {
        return;
      }
      const handled = handleVoucherBack();
      if (handled) {
        e.preventDefault();
      }
    };
    const handleSaveEvent = (e: CustomEvent) => {
      if (['P', 'R', 'J', 'C'].includes(activeVType)) {
        handleSubmit();
        e.preventDefault();
      }
    };
    window.addEventListener('app:back' as any, handleBackEvent);
    window.addEventListener('app:save' as any, handleSaveEvent);
    return () => {
      window.removeEventListener('app:back' as any, handleBackEvent);
      window.removeEventListener('app:save' as any, handleSaveEvent);
    };
  }, [
    isActive,
    activeVType,
    amount,
    partyLedger,
    toAccount,
    modeLedger,
    debitLedger,
    creditLedger,
    lines,
    entryMode,
    showLedgerModal,
    showCatalogModal,
    viewVoucher,
    mismatchModal,
    successModalDetails,
    cancelModalVoucher,
    deleteConfirmVoucher,
    shareModalVoucher,
    showShareRegisterModal,
    voucherTypeHistory
  ]);

  // Register active voucher type provider for Alt+V shortcut
  useEffect(() => {
    const handleGetActiveType = () => {
      const filterType = 
        activeVType === 'P' ? 'Payment' :
        activeVType === 'R' ? 'Receipt' :
        activeVType === 'C' ? 'Contra' :
        activeVType === 'J' ? 'Journal' :
        activeVType === 'S' ? 'Sales' :
        activeVType === 'PUR' ? 'Purchase' :
        activeVType === 'CN' ? 'Credit Note' :
        activeVType === 'DN' ? 'Debit Note' :
        activeVType === 'DEL_NOTE' ? 'Stock Journal' :
        activeVType === 'PHYSICAL_STOCK' ? 'Physical Stock' :
        'ALL';
      (window as any).__lastActiveVoucherType = filterType;
    };
    window.addEventListener('app:get-active-voucher-type', handleGetActiveType);
    return () => window.removeEventListener('app:get-active-voucher-type', handleGetActiveType);
  }, [activeVType]);

  // Open Quick Ledger Modal for Creating
  const openCreateLedgerModal = (lineId?: string, singleField?: string, initialGroup?: string) => {
    if (onOpenNewLedgerModal) {
      onOpenNewLedgerModal(initialGroup || 'Indirect Expenses', (name) => {
        if (singleField === 'single-1') {
          if (['P', 'R'].includes(activeVType)) setPartyLedger(name);
          else if (activeVType === 'J') setDebitLedger(name);
          else setToAccount(name);
        } else if (singleField === 'single-2') {
          if (['P', 'R'].includes(activeVType)) setModeLedger(name);
          else if (activeVType === 'J') setCreditLedger(name);
          else setFromAccount(name);
        } else if (lineId) {
          const idx = lines.findIndex(l => l.id === lineId);
          if (idx !== -1) {
            const arr = [...lines];
            arr[idx].ledger = name;
            setLines(arr);
          }
        }
      });
    }
  };

  // Open Quick Ledger Modal for Editing
  const openEditLedgerModal = (ledgerName: string, lineId?: string, singleField?: string) => {
    const existing = ledgers.find(l => l['Ledger Name'] === ledgerName);
    if (!existing) return;
    setIsEditingLedger(true);
    setEditingOldName(ledgerName);
    setTargetLineId(lineId || null);
    setTargetSingleField(singleField || null);
    setNewLedgerName(existing['Ledger Name']);
    setNewLedgerGroup(existing.Group || 'Indirect Expenses');
    setNewOpBalance(existing['Opening Balance'] || 0);
    setNewBalanceType(existing['Balance Type (Dr/Cr)'] || 'Dr');
    setNewGstNo(existing['GST No'] || '');
    setNewTpnNo(existing['TPN No'] || '');
    setNewContactNo(existing['Contact No'] || '');
    setShowLedgerModal(true);
  };

  // Save Quick Ledger (Create or Edit)
  const handleSaveQuickLedger = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newLedgerName.trim();
    if (!trimmedName) {
      showToast('Please enter a valid Ledger Name.', 'error');
      return;
    }

    if (isEditingLedger) {
      if (
        editingOldName &&
        trimmedName.toLowerCase() !== editingOldName.toLowerCase() &&
        ledgers.some(l => l['Ledger Name'].toLowerCase() === trimmedName.toLowerCase())
      ) {
        showToast('A ledger with this name already exists.', 'error');
        return;
      }

      const existing = ledgers.find(l => l['Ledger Name'] === editingOldName);
      const updatedL: Ledger = {
        'Ledger Name': trimmedName,
        Group: newLedgerGroup,
        'Opening Balance': Number(newOpBalance) || 0,
        'Balance Type (Dr/Cr)': newBalanceType,
        'Current Balance': existing ? existing['Current Balance'] : Number(newOpBalance) || 0,
        'GST No': newGstNo.trim() || undefined,
        'TPN No': newTpnNo.trim() || undefined,
        'Contact No': newContactNo.trim() || undefined,
        oldName: editingOldName || undefined
      };
      saveLedger(updatedL);
      showToast(`Ledger "${trimmedName}" updated successfully.`, 'success');
    } else {
      if (ledgers.some(l => l['Ledger Name'].toLowerCase() === trimmedName.toLowerCase())) {
        showToast('A ledger with this name already exists.', 'error');
        return;
      }

      const newL: Ledger = {
        'Ledger Name': trimmedName,
        Group: newLedgerGroup,
        'Opening Balance': Number(newOpBalance) || 0,
        'Balance Type (Dr/Cr)': newBalanceType,
        'Current Balance': Number(newOpBalance) || 0,
        'GST No': newGstNo.trim() || undefined,
        'TPN No': newTpnNo.trim() || undefined,
        'Contact No': newContactNo.trim() || undefined
      };
      saveLedger(newL);
      showToast(`Ledger "${trimmedName}" created successfully.`, 'success');
    }

    onDataRefresh();
    setShowLedgerModal(false);

    // Auto select this ledger into target line or field
    if (targetLineId) {
      setLines(prev =>
        prev.map(l => (l.id === targetLineId ? { ...l, ledger: trimmedName } : l))
      );
    } else if (targetSingleField) {
      if (targetSingleField === 'party') setPartyLedger(trimmedName);
      else if (targetSingleField === 'debit') setDebitLedger(trimmedName);
      else if (targetSingleField === 'credit') setCreditLedger(trimmedName);
      else if (targetSingleField === 'from') setFromAccount(trimmedName);
      else if (targetSingleField === 'to') setToAccount(trimmedName);
    }
  };

  // Keyboard sequence and navigation helpers
  const focusElement = (id: string, selectText = true) => {
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLElement | null;
      if (el) {
        el.focus();
        if (selectText && el instanceof HTMLInputElement) {
          el.select();
        }
      }
    }, 20);
  };

  const focusGridField = (rowIndex: number, field: 'type' | 'ledger' | 'debit' | 'credit' | 'narration') => {
    if (rowIndex < 0 || rowIndex >= lines.length) return;
    const targetLine = lines[rowIndex];
    let actualField = field;
    if (field === 'debit' && targetLine.type === 'Cr') actualField = 'credit';
    if (field === 'credit' && targetLine.type === 'Dr') actualField = 'debit';
    focusElement(`grid-${actualField}-${rowIndex}`, true);
  };

  const checkBillWiseSettlement = (ledgerName: string | undefined, amt: number | string | undefined, lineId?: string): boolean => {
    if (config.EnableBillWiseDetails === 'false') return false;
    if (!ledgerName || !amt || Number(amt) <= 0) return false;
    
    // Only trigger in Payment or Receipt for simplicity, or Journal if needed
    if (!['P', 'R', 'J'].includes(activeVType)) return false;

    // Prevent re-triggering if the modal is already open
    if (billModalOpen) return true;

    const lObj = ledgers.find(l => l['Ledger Name'] === ledgerName);
    if (!lObj) return false;
    
    const g = (lObj.Group || '').toLowerCase().trim();
    if (g === 'sundry creditors' || g === 'sundry debtors' || g.includes('creditor') || g.includes('debtor') || g.includes('supplier') || g.includes('customer')) {
      setBillModalParty(ledgerName);
      setBillModalTargetLineId(lineId || null);
      setBillModalOpen(true);
      return true;
    }
    return false;
  };

  // Multi-line Grid Helpers
  const addGridRow = () => {
    const defaultLedger = ledgers[0]?.['Ledger Name'] || '';
    const currentTotalDr = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
    const currentTotalCr = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
    const diff = Math.abs(currentTotalDr - currentTotalCr);

    let nextType: 'Dr' | 'Cr' = 'Cr';
    let defaultDebit: number | '' = 0;
    let defaultCredit: number | '' = '';

    if (currentTotalDr > currentTotalCr) {
      nextType = 'Cr';
      defaultCredit = diff > 0 ? Number(diff.toFixed(2)) : '';
      defaultDebit = 0;
    } else if (currentTotalCr > currentTotalDr) {
      nextType = 'Dr';
      defaultDebit = diff > 0 ? Number(diff.toFixed(2)) : '';
      defaultCredit = 0;
    }

    const newIndex = lines.length;
    setLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: nextType,
        ledger: '',
        debit: defaultDebit,
        credit: defaultCredit,
        narration: ''
      }
    ]);

    setTimeout(() => {
      focusElement(`grid-ledger-${newIndex}`, true);
    }, 40);
  };

  const removeGridRow = (id: string) => {
    if (lines.length <= 2) {
      showToast('A double-entry voucher requires at least 2 lines.', 'error');
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateGridLine = (id: string, field: keyof VoucherGridLine, value: any) => {
    if (field === 'ledger' && typeof value === 'string') {
      const idx = lines.findIndex(l => l.id === id);
      const line = idx >= 0 ? lines[idx] : undefined;
      const targetId = idx >= 0 ? (line?.type === 'Dr' ? `grid-debit-${idx}` : `grid-credit-${idx}`) : undefined;
      checkAndPromptBankLedger(value, targetId);
      handleLedgerSelected(value, { isMulti: true, lineId: id, lineIndex: idx, type: line?.type, lineAmt: Number(line?.type === 'Dr' ? line?.debit : line?.credit) });
    }
    setLines(prev => {
      const newLines = prev.map(l => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          if (field === 'ledger' && l.ledger !== value) {
            updated.billAllocations = [];
          }
          if (field === 'type') {
            if (value === 'Dr') {
              updated.credit = 0;
              if (!updated.debit) updated.debit = '';
            } else {
              updated.debit = 0;
              if (!updated.credit) updated.credit = '';
            }
          }
          return updated;
        }
        return l;
      });

      // Auto-catch figure in Dr/Cr if there are exactly 2 lines
      if (newLines.length === 2 && (field === 'debit' || field === 'credit')) {
        const editedIdx = newLines.findIndex(l => l.id === id);
        const otherIdx = editedIdx === 0 ? 1 : 0;
        const editedLine = newLines[editedIdx];
        const otherLine = newLines[otherIdx];

        // If the other line's amount is zero or empty, we auto-fill it
        const otherAmt = otherLine.type === 'Dr' ? Number(otherLine.debit) || 0 : Number(otherLine.credit) || 0;
        
        // Also auto-update if the other amount was exactly matching the OLD amount of the edited line
        const oldEditedAmt = prev[editedIdx].type === 'Dr' ? Number(prev[editedIdx].debit) || 0 : Number(prev[editedIdx].credit) || 0;
        
        const newEditedAmt = editedLine.type === 'Dr' ? Number(editedLine.debit) || 0 : Number(editedLine.credit) || 0;

        if (otherAmt === 0 || (otherAmt === oldEditedAmt && oldEditedAmt !== 0)) {
           if (otherLine.type === 'Cr') {
             otherLine.credit = newEditedAmt || '';
           } else {
             otherLine.debit = newEditedAmt || '';
           }
        }
      }

      // Smart auto-narration on ledger update
      if (field === 'ledger') {
        const drL = newLines.find(l => l.type === 'Dr' && l.ledger)?.ledger || '';
        const crL = newLines.find(l => l.type === 'Cr' && l.ledger)?.ledger || '';
        if (drL || crL) {
          const smart = getSuggestedNarration(activeVType, drL, crL, []);
          if (smart && (!narration || narration.startsWith('Being '))) {
            setNarration(smart);
          }
        }
      }

      return newLines;
    });
  };

  // Calculations for Multi-Line Grid
  const totalDr = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDr - totalCr);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;

  // Submit Financial Voucher
  const handleSubmit = (e?: React.FormEvent, action: 'save' | 'share' | 'print' = 'save') => {
    if (e) e.preventDefault();
    if (billModalOpen) return;
    
    // Quick validation before showing accept modal
    if (entryMode === 'multi') {
      if (lines.length < 2) {
        showToast('Please add at least 2 ledger entries.', 'error');
        return;
      }
      if (!isBalanced) {
        setMismatchModal({ totalDr, totalCr, diff: difference });
        return;
      }
    } else {
      if (!amount || amount <= 0) {
        showToast('Please enter a valid amount.', 'error');
        return;
      }
      if (!partyLedger) {
        showToast('Please select the party / income ledger.', 'error');
        return;
      }
      if (!modeLedger) {
        showToast('Please select the cash / bank ledger.', 'error');
        return;
      }
    }

    setShowAcceptModal(action);
  };

  const proceedSubmit = () => {
    const action = showAcceptModal;
    setShowAcceptModal(false);
    
    if (entryMode === 'multi') {
      if (lines.length < 2) {
        showToast('Please add at least 2 ledger entries.', 'error');
        return;
      }

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].ledger.trim()) {
          showToast(`Row #${i + 1} has no Ledger account selected.`, 'error');
          return;
        }
        const amt = lines[i].type === 'Dr' ? Number(lines[i].debit) : Number(lines[i].credit);
        if (!amt || amt <= 0) {
          showToast(`Row #${i + 1} has an invalid or empty amount.`, 'error');
          return;
        }
      }

      if (!isBalanced) {
        setMismatchModal({ totalDr, totalCr, diff: difference });
        return;
      }

      const formattedLines = lines.map(l => ({
        type: l.type,
        ledger: l.ledger,
        amount: l.type === 'Dr' ? Number(l.debit) : Number(l.credit),
        narration: l.narration,
        billAllocations: l.billAllocations
      }));

      const allBillAllocations: BillAllocation[] = [];
      lines.forEach(l => {
        if (l.billAllocations && l.billAllocations.length > 0) {
          allBillAllocations.push(...l.billAllocations);
        }
      });

      const isEditingThis = Boolean(editingVoucherNo && voucherNo.trim() && editingVoucherNo.toLowerCase() === voucherNo.trim().toLowerCase());
      const vPayload: any = {
        voucherNo: voucherNo.trim() || undefined,
        originalVoucherNo: editingVoucherNo || undefined,
        isEdit: isEditingThis || Boolean(editingVoucherNo),
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        narration: narration.trim(),
        totalAmount: totalDr,
        transactionId: transactionId.trim() || undefined,
        bankTxnNo: transactionId.trim() || undefined,
        billAllocations: allBillAllocations.length > 0 ? allBillAllocations : undefined,
        billNo: allBillAllocations.length > 0 ? allBillAllocations.map(b => b.billNo).join(', ') : undefined,
        supplierBillNo: supplierBillNo.trim() || undefined,
        supplierBillDate: supplierBillDate || undefined,
        referenceNo: supplierBillNo.trim() || referenceNo.trim() || undefined,
        lines: formattedLines,
        
        // GST Input Tracking Fields
        ...(activeVType === 'P' && config.EnableGSTInputTax === 'true' && gstInputType !== 'None' ? {
          gstInputType,
          supplierName,
          supplierGstNo,
          supplierCountry,
          invoiceNo,
          invoiceDate,
          referenceNo: supplierBillNo.trim() || referenceNo.trim() || undefined,
          declarationNo,
          declarationDate,
          taxableAmount: Number(taxableAmount) || undefined,
          exemptedAmount: Number(exemptedAmount) || undefined,
          gstAmount: Number(gstAmount) || undefined,
          totalImportAmount: Number(totalImportAmount) || undefined,
          customGstData
        } : {}),

        // TDS 2% Form IT-7(B) Contract Tracking Fields
        ...(isTdsApplicable ? {
          isTdsApplicable: true,
          tdsTpn: tdsTpn.trim() || undefined,
          tdsContractorNameAndAddress: tdsContractorNameAndAddress.trim() || undefined,
          tdsWorkDescription: (tdsWorkDescription.trim() || narration.trim()) || undefined,
          tdsInvoiceNo: (tdsInvoiceNo.trim() || supplierBillNo.trim()) || undefined,
          tdsInvoiceDate: tdsInvoiceDate || supplierBillDate || undefined,
          tdsBillAmount: tdsBillAmount !== '' ? Number(tdsBillAmount) : undefined,
          tdsRate: tdsRate !== '' ? Number(tdsRate) : 2,
          tdsAmount: tdsAmount !== '' ? Number(tdsAmount) : undefined
        } : {}),

        // Consumables / Items Breakdown for Journal Vouchers
        items: activeVType === 'J' && journalItems.length > 0 ? journalItems.filter(it => it.itemName && (Number(it.qty) > 0 || Number(it.amount) > 0)).map(it => ({
          itemCode: it.itemCode || it.itemName,
          itemName: it.itemName,
          unit: it.unit || 'Pcs',
          qty: Number(it.qty) || 0,
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)),
          description: it.description || undefined
        })) : undefined
      };

      const result = saveMultiLineVoucher(vPayload);
      if (result.ok) {
        playSaveSound();
        setEditingVoucherNo(null);
        showToast(`Voucher ${result.voucherNo} posted successfully!`, 'success');
        onDataRefresh();
        loadRecentVouchers();

        const vTypeLabel =
          activeVType === 'P'
            ? 'Payment Voucher'
            : activeVType === 'R'
            ? 'Receipt Voucher'
            : activeVType === 'J'
            ? 'Journal Voucher'
            : activeVType === 'C'
            ? 'Contra Voucher'
            : 'Financial Voucher';

        const savedObj = {
          ...vPayload,
          voucherNo: result.voucherNo
        };

        setSuccessModalDetails({
          voucherNo: result.voucherNo,
          voucherType: vTypeLabel,
          date: vPayload.date,
          partyName: formattedLines[0]?.ledger || '',
          totalAmount: totalDr,
          totalItems: formattedLines.length,
          currencySymbol,
          onPrint: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            printPdfDoc(doc);
          },
          onShare: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            shareOrDownloadPDF(doc, `Voucher_${result.voucherNo}.pdf`, `${vTypeLabel} ${result.voucherNo}`);
          },
          onDownload: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            doc.save(`Voucher_${result.voucherNo}.pdf`);
          },
          onNewVoucher: () => {
            if (isAutoMode) {
              setVoucherNo(peekNextVoucherNo(activeVType as any, config));
            }
          }
        });

        if (isAutoMode) {
          setVoucherNo(peekNextVoucherNo(activeVType as any, config));
        }
        setNarration('');
        handleVTypeChange(activeVType);
        
        if (action === 'print') {
          const doc = generateVoucherSlipPDF(savedObj, config);
          printPdfDoc(doc);
        } else if (action === 'share') {
          setViewVoucher(savedObj);
        }
      }
    } else {
      // Single Mode Submit
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        showToast('Please enter a valid amount greater than zero.', 'error');
        return;
      }

      let debL = '';
      let credL = '';

      if (activeVType === 'P') {
        debL = partyLedger;
        credL = modeLedger;
      } else if (activeVType === 'R') {
        debL = modeLedger;
        credL = partyLedger;
      } else if (activeVType === 'J') {
        debL = debitLedger;
        credL = creditLedger;
      } else if (activeVType === 'C') {
        debL = toAccount;
        credL = fromAccount;
      }

      if (!debL || !credL) {
        showToast('Please specify both Debit and Credit ledgers.', 'error');
        return;
      }

      if (debL === credL) {
        showToast('Debit and Credit ledgers cannot be identical.', 'error');
        return;
      }

      const isEditingThis = Boolean(editingVoucherNo && voucherNo.trim() && editingVoucherNo.toLowerCase() === voucherNo.trim().toLowerCase());
      const vPayload: any = {
        voucherNo: voucherNo.trim() || undefined,
        originalVoucherNo: editingVoucherNo || undefined,
        isEdit: isEditingThis || Boolean(editingVoucherNo),
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        amount: amt,
        debitLedger: debL,
        creditLedger: credL,
        narration: narration.trim(),
        transactionId: transactionId.trim() || undefined,
        bankTxnNo: transactionId.trim() || undefined,
        billAllocations: billAllocations.length > 0 ? billAllocations : undefined,
        billNo: billAllocations.length > 0 ? billAllocations.map(b => b.billNo).join(', ') : undefined,
        supplierBillNo: supplierBillNo.trim() || undefined,
        supplierBillDate: supplierBillDate || undefined,
        referenceNo: supplierBillNo.trim() || referenceNo.trim() || undefined,
        
        // GST Input Tracking Fields
        ...(activeVType === 'P' && config.EnableGSTInputTax === 'true' && gstInputType !== 'None' ? {
          gstInputType,
          supplierName,
          supplierGstNo,
          supplierCountry,
          invoiceNo,
          invoiceDate,
          referenceNo: supplierBillNo.trim() || referenceNo.trim() || undefined,
          declarationNo,
          declarationDate,
          taxableAmount: Number(taxableAmount) || undefined,
          exemptedAmount: Number(exemptedAmount) || undefined,
          gstAmount: Number(gstAmount) || undefined,
          totalImportAmount: Number(totalImportAmount) || undefined,
          customGstData
        } : {}),

        // TDS 2% Form IT-7(B) Contract Tracking Fields
        ...(isTdsApplicable ? {
          isTdsApplicable: true,
          tdsTpn: tdsTpn.trim() || undefined,
          tdsContractorNameAndAddress: tdsContractorNameAndAddress.trim() || undefined,
          tdsWorkDescription: (tdsWorkDescription.trim() || narration.trim()) || undefined,
          tdsInvoiceNo: (tdsInvoiceNo.trim() || supplierBillNo.trim() || referenceNo.trim()) || undefined,
          tdsInvoiceDate: tdsInvoiceDate || supplierBillDate || undefined,
          tdsBillAmount: tdsBillAmount !== '' ? Number(tdsBillAmount) : undefined,
          tdsRate: tdsRate !== '' ? Number(tdsRate) : 2,
          tdsAmount: tdsAmount !== '' ? Number(tdsAmount) : undefined
        } : {}),

        // Consumables / Items Breakdown for Journal Vouchers
        items: activeVType === 'J' && journalItems.length > 0 ? journalItems.filter(it => it.itemName && (Number(it.qty) > 0 || Number(it.amount) > 0)).map(it => ({
          itemCode: it.itemCode || it.itemName,
          itemName: it.itemName,
          unit: it.unit || 'Pcs',
          qty: Number(it.qty) || 0,
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || ((Number(it.qty) || 0) * (Number(it.rate) || 0)),
          description: it.description || undefined
        })) : undefined
      };

      const result = saveVoucher(activeVType as any, vPayload);
      if (result.ok) {
        playSaveSound();
        setEditingVoucherNo(null);
        showToast(`Voucher ${result.voucherNo} recorded successfully!`, 'success');
        onDataRefresh();
        loadRecentVouchers();
        setBillAllocations([]);
        setJournalItems([]);
        setShowJournalItems(false);

        const vTypeLabel =
          activeVType === 'P'
            ? 'Payment Voucher'
            : activeVType === 'R'
            ? 'Receipt Voucher'
            : activeVType === 'J'
            ? 'Journal Voucher'
            : activeVType === 'C'
            ? 'Contra Voucher'
            : 'Financial Voucher';

        const savedObj = {
          ...vPayload,
          voucherNo: result.voucherNo
        };

        setSuccessModalDetails({
          voucherNo: result.voucherNo,
          voucherType: vTypeLabel,
          date: vPayload.date,
          partyName: partyLedger || debL || credL,
          totalAmount: amt,
          totalItems: 2,
          currencySymbol,
          onPrint: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            printPdfDoc(doc);
          },
          onShare: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            shareOrDownloadPDF(doc, `Voucher_${result.voucherNo}.pdf`, `${vTypeLabel} ${result.voucherNo}`);
          },
          onDownload: () => {
            const doc = generateVoucherSlipPDF(savedObj, config);
            doc.save(`Voucher_${result.voucherNo}.pdf`);
          },
          onNewVoucher: () => {
            if (isAutoMode) {
              setVoucherNo(peekNextVoucherNo(activeVType as any, config));
            }
          }
        });

        if (isAutoMode) {
          setVoucherNo(peekNextVoucherNo(activeVType as any, config));
        }
        setAmount('');
        setNarration('');
        setTransactionId('');
        handleVTypeChange(activeVType);
        
        if (action === 'print') {
          const doc = generateVoucherSlipPDF(savedObj, config);
          printPdfDoc(doc);
        } else if (action === 'share') {
          setViewVoucher(savedObj);
        }
      } else {
        alert(result.error || 'Failed to save voucher');
      }
    }
  };

  // Helper to Reset / Cancel current voucher entry form
  const handleCancelOrResetEntry = () => {
    setEditingVoucherNo(null);
    loadedTargetKeyRef.current = null;
    if (entryMode === 'multi') {
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else {
      setAmount('');
      setPartyLedger('');
      setModeLedger('');
      setDebitLedger('');
      setCreditLedger('');
      setFromAccount('');
      setToAccount('');
    }
    setNarration('');
    setTransactionId('');
    setSupplierBillNo('');
    setSupplierBillDate(new Date().toISOString().split('T')[0]);
    setIsTdsApplicable(false);
    setTdsTpn('');
    setTdsContractorNameAndAddress('');
    setTdsWorkDescription('');
    setTdsInvoiceNo('');
    setTdsInvoiceDate('');
    setTdsBillAmount('');
    setTdsRate(2);
    setTdsAmount('');
    setBillAllocations([]);
    setJournalItems([]);
    setShowJournalItems(false);
    if (isAutoMode && activeVType && ['P', 'R', 'J', 'C'].includes(activeVType)) {
      setVoucherNo(peekNextVoucherNo(activeVType as any, config));
    }
    showToast('Voucher entry cancelled / reset to blank.', 'success');
  };

  // Helper for opening respective register for current financial voucher type
  const registerLabel =
    activeVType === 'P' ? 'Payment Register' :
    activeVType === 'R' ? 'Receipt Register' :
    activeVType === 'J' ? 'Journal Register' :
    activeVType === 'C' ? 'Contra Register' :
    'Voucher Register';

  const handleOpenRespectiveRegister = () => {
    const filterType =
      activeVType === 'P' ? 'Payment' :
      activeVType === 'R' ? 'Receipt' :
      activeVType === 'C' ? 'Contra' :
      activeVType === 'J' ? 'Journal' :
      'ALL';

    const target = {
      category: 'reg' as const,
      regSubTab: 'vouchers' as const,
      voucherTypeFilter: filterType,
      timestamp: Date.now()
    };

    if (onNavigateTo) {
      onNavigateTo('reports', target);
    } else {
      window.dispatchEvent(new CustomEvent('app:navigate', {
        detail: { view: 'reports', target }
      }));
    }
  };

  // Cancel Voucher (Void with ledger reversal and audit reason)
  const handleConfirmCancelVoucher = (vNo?: string, reason?: string) => {
    const targetNo = vNo || cancelModalVoucher?.voucherNo;
    if (!targetNo) return;
    const finalReason = reason || cancelReason || 'Cancelled by user';
    const res = cancelVoucher(targetNo, finalReason);
    if (res.ok) {
      showToast(`Voucher ${targetNo} cancelled successfully. Ledger entries reversed.`, 'success');
      if (viewVoucher && viewVoucher.voucherNo === targetNo) {
        setViewVoucher({
          ...viewVoucher,
          status: 'Cancelled',
          cancellationReason: finalReason
        });
      }
      setCancelModalVoucher(null);
      setCancelReason('');
      onDataRefresh();
      loadRecentVouchers();
    } else {
      showToast(res.error || 'Failed to cancel voucher', 'error');
    }
  };

  // Permanently Delete Voucher
  const handleConfirmPermanentDelete = (vNo?: string) => {
    const targetNo = vNo || deleteConfirmVoucher?.voucherNo;
    if (!targetNo) return;
    const res = deleteVoucherPermanent(targetNo);
    if (res.ok) {
      showToast(`Voucher ${targetNo} deleted permanently.`, 'success');
      if (viewVoucher && viewVoucher.voucherNo === targetNo) {
        setViewVoucher(null);
      }
      setDeleteConfirmVoucher(null);
      onDataRefresh();
      loadRecentVouchers();
    } else {
      showToast(res.error || 'Failed to delete voucher', 'error');
    }
  };

  const filteredRecent = recentVouchers.filter(v => {
    // 1. General search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        (v.voucherNo || '').toLowerCase().includes(q) ||
        (v.narration || '').toLowerCase().includes(q) ||
        (v.debitLedger || '').toLowerCase().includes(q) ||
        (v.creditLedger || '').toLowerCase().includes(q) ||
        (v.status || '').toLowerCase().includes(q) ||
        (v.lines && v.lines.some((l: any) => (l.ledger || '').toLowerCase().includes(q)));
      if (!match) return false;
    }

    // 2. Specific Voucher / Bill No filter
    if (filterBillNo.trim()) {
      const bq = filterBillNo.toLowerCase();
      if (!(v.voucherNo || '').toLowerCase().includes(bq)) return false;
    }

    // 3. Voucher Type filter
    if (filterVType !== 'ALL') {
      if (v.type !== filterVType) return false;
    }

    // 3b. Voucher Status Filter (All, Active, Cancelled)
    if (filterStatus !== 'ALL') {
      const isCancelled = v.status === 'Cancelled';
      if (filterStatus === 'ACTIVE' && isCancelled) return false;
      if (filterStatus === 'CANCELLED' && !isCancelled) return false;
    }

    // 4. Specific Ledger Name filter
    if (filterLedger.trim()) {
      const lq = filterLedger.toLowerCase();
      const matchesLedger =
        (v.debitLedger || '').toLowerCase().includes(lq) ||
        (v.creditLedger || '').toLowerCase().includes(lq) ||
        (v.lines && v.lines.some((l: any) => (l.ledger || '').toLowerCase().includes(lq)));
      if (!matchesLedger) return false;
    }

    // 5. Narration filter
    if (filterNarration.trim()) {
      const nq = filterNarration.toLowerCase();
      if (!(v.narration || '').toLowerCase().includes(nq)) return false;
    }

    // 6. Date Range filter
    if (filterStartDate) {
      const vDate = new Date(v.date).toISOString().split('T')[0];
      if (vDate < filterStartDate) return false;
    }
    if (filterEndDate) {
      const vDate = new Date(v.date).toISOString().split('T')[0];
      if (vDate > filterEndDate) return false;
    }

    return true;
  });

  const totalFilteredAmount = filteredRecent.reduce(
    (acc, v) => acc + (v.status === 'Cancelled' ? 0 : (Number(v.totalAmount || v.total) || 0)),
    0
  );

  const handleRowClick = (v: any) => {
    if (onDrillVoucher && v.voucherNo) {
      onDrillVoucher(v.voucherNo);
    } else {
      setViewVoucher(v);
    }
  };

  const printWholeRegister = () => {
    try {
      if (filteredRecent.length === 0) {
        showToast('No voucher records to print', 'error');
        return;
      }
      const doc = generateVoucherRegisterPDF(filteredRecent, config, {
        startDate: filterStartDate,
        endDate: filterEndDate,
        vType: filterVType,
        status: filterStatus,
        ledger: filterLedger,
        searchTerm: searchTerm
      });

      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const printWin = window.open(blobUrl, '_blank');
      if (!printWin) {
        doc.save(`Voucher_Register_${Date.now()}.pdf`);
        showToast('PDF downloaded. Please open and print.', 'success');
      }
    } catch (err: any) {
      console.error('Print register error:', err);
      showToast('Failed to generate register print preview', 'error');
    }
  };

  const exportRegisterToExcel = () => {
    try {
      if (filteredRecent.length === 0) {
        showToast('No voucher records to export', 'error');
        return;
      }
      const aoa: any[][] = [
        [config.CompanyName || 'Retail Business Store'],
        ['ACCOUNTING VOUCHER REGISTER REPORT'],
        [`Period: ${filterStartDate || 'All Time'} to ${filterEndDate || 'Present'} | Type: ${filterVType} | Status: ${filterStatus} | Generated: ${new Date().toLocaleString()}`],
        [],
        ['Date', 'Voucher No', 'Type', 'Status', 'Debit / Particulars', 'Credit / Account', 'Narration', `Amount (${currencySymbol})`]
      ];

      filteredRecent.forEach((v: any) => {
        const isCancelled = v.status === 'Cancelled';
        const vTypeLabel =
          v.type === 'P'
            ? 'Payment (F5)'
            : v.type === 'R'
            ? 'Receipt (F6)'
            : v.type === 'J'
            ? 'Journal (F7)'
            : v.type === 'C'
            ? 'Contra (F4)'
            : v.type === 'CN'
            ? 'Credit Note'
            : v.type === 'DN'
            ? 'Debit Note'
            : v.type === 'DEL_NOTE'
            ? 'Delivery Note'
            : v.type === 'QUOTATION'
            ? 'Quotation'
            : v.type === 'PHYSICAL_STOCK'
            ? 'Physical Stock'
            : v.type || '-';

        const particulars = v.lines ? `${v.lines.length} Lines Split` : v.debitLedger || '-';
        const account = v.lines ? 'Multi-Account' : v.creditLedger || '-';
        const amt = Number(v.totalAmount || v.total || 0);

        aoa.push([
          formatDateDMY(v.date),
          v.voucherNo || '-',
          vTypeLabel,
          isCancelled ? 'Cancelled' : 'Active',
          particulars,
          account,
          v.narration || '',
          amt
        ]);
      });

      aoa.push([]);
      aoa.push([
        'TOTAL SUMMARY',
        `Total Vouchers: ${filteredRecent.length}`,
        '',
        '',
        '',
        '',
        'GRAND TOTAL:',
        totalFilteredAmount
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!cols'] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 30 },
        { wch: 30 },
        { wch: 35 },
        { wch: 18 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Voucher Register');
      const filename = `Voucher_Register_${filterStartDate || 'All'}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('Voucher register exported to Excel successfully!', 'success');
    } catch (err: any) {
      console.error('Export error:', err);
      showToast('Failed to export to Excel', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2">
      <AcceptModal 
        isOpen={!!showAcceptModal} 
        title={editingVoucherNo ? `Save changes to ${editingVoucherNo}?` : `Save ${activeVType === 'P' ? 'Payment' : activeVType === 'R' ? 'Receipt' : activeVType === 'J' ? 'Journal' : activeVType === 'C' ? 'Contra' : 'Voucher'}?`}
        onConfirm={proceedSubmit} 
        onCancel={() => setShowAcceptModal(false)} 
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all ${
            toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Universal Prominent Voucher Header (hidden for forms that incorporate selector inline) */}
      {!['DEL_NOTE', 'QUOTATION', 'CN', 'DN', 'PHYSICAL_STOCK', 'SALES_ORDER', 'PURCHASE_ORDER', 'RECEIPT_NOTE'].includes(activeVType) && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left Section: Voucher Type Selector + (for Financial Vouchers) Voucher Number & Date */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Voucher Type Dropdown */}
            <div className="relative">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-8.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2.5 pr-7 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                  <option value="SALES_ORDER">Sales Order (Alt+F5)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (Alt+F6)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="RECEIPT_NOTE">Receipt Note / GRN (Alt+F9)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>

            {/* If Financial Voucher (P, R, J, C): show Voucher Number & Date right next to Voucher Type */}
            {activeVType && ['P', 'R', 'J', 'C'].includes(activeVType) && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Voucher Number */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <label htmlFor="v-voucher-no" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Voucher Number</label>
                  <input
                    id="v-voucher-no"
                    type="text"
                    value={voucherNo || ''}
                    onChange={e => setVoucherNo(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        focusElement('v-date');
                      }
                    }}
                    disabled={Boolean(isAutoMode || editingVoucherNo)}
                    className={`h-6.5 w-28 rounded-md border px-2 font-mono font-bold text-slate-900 outline-none text-xs ${
                      (isAutoMode || editingVoucherNo) ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white border-slate-300 focus:border-indigo-600'
                    }`}
                  />
                </div>

                {/* Voucher Date */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <label htmlFor="v-date" className="font-bold text-slate-700 text-[11px] whitespace-nowrap">Voucher Date</label>
                  <input
                    id="v-date"
                    type="date"
                    value={date || ''}
                    onChange={e => setDate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (entryMode === 'multi') {
                          focusGridField(0, 'type');
                        } else {
                          focusElement('single-ledger-1');
                        }
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        focusElement('v-voucher-no');
                      }
                    }}
                    className="h-6.5 rounded-md border border-slate-300 bg-white px-2 font-semibold text-slate-900 outline-none focus:border-indigo-600 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Section: Auto / Recurring button + Single / Double Mode toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto / Recurring Vouchers Schedule Button */}
            <button
              type="button"
              onClick={() => setShowRecurringModal(true)}
              className="h-7.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2.5 font-bold text-purple-700 text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
              title="Configure and manage automated recurring vouchers (Rent, Salaries, EMIs)"
            >
              <Repeat className="h-3.5 w-3.5 text-purple-600" />
              <span>Auto Vouchers</span>
              {pendingRecurringCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full animate-pulse">
                  {pendingRecurringCount}
                </span>
              )}
            </button>

            {activeVType && ['P', 'R', 'J', 'C'].includes(activeVType) && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setEntryMode('single')}
                  className={`rounded-md px-2.5 py-1 font-bold text-xs transition cursor-pointer ${
                    entryMode === 'single'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Mode
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('multi')}
                  className={`rounded-md px-2.5 py-1 font-bold text-xs transition cursor-pointer ${
                    entryMode === 'multi'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Double Entry Grid
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catalog Modal */}
      <VoucherCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectVoucher={handleVTypeChange}
        activeType={activeVType as VoucherActionType}
      />

      {/* Render Active View: Voucher Entry Forms */}
      {activeVType === 'CN' ? (
        <CreditNoteEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-8 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2.5 pr-7 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
        />
      ) : activeVType === 'DN' ? (
        <DebitNoteEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-8 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2.5 pr-7 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
        />
      ) : activeVType === 'DEL_NOTE' ? (
        <DeliveryNoteEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-7.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2 pr-6 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
        />
      ) : activeVType === 'STOCK_TRANSFER' ? (
        <StockTransferEntry
          config={config}
          items={items}
          onDataRefresh={onDataRefresh}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-8 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2.5 pr-7 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                  <option value="SALES_ORDER">Sales Order (Alt+F5)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (Alt+F6)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="STOCK_TRANSFER">Stock Transfer / Challan (Alt+F7)</option>
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="RECEIPT_NOTE">Receipt Note / GRN (Alt+F9)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
        />
      ) : activeVType === 'PHYSICAL_STOCK' ? (
        <PhysicalStockEntry
          config={config}
          items={items}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-8 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2.5 pr-7 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
        />
      ) : activeVType === 'QUOTATION' ? (
        <QuotationEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-7.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2 pr-6 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
          activeTab={quotationTab}
          onTabChange={setQuotationTab}
        />
      ) : activeVType === 'SALES_ORDER' ? (
        <SalesOrderEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-7.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2 pr-6 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                  <option value="SALES_ORDER">Sales Order (Alt+F5)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (Alt+F6)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="RECEIPT_NOTE">Receipt Note / GRN (Alt+F9)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
          activeTab={salesOrderTab}
          onTabChange={setSalesOrderTab}
        />
      ) : activeVType === 'PURCHASE_ORDER' ? (
        <PurchaseOrderEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-7.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2 pr-6 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                  <option value="SALES_ORDER">Sales Order (Alt+F5)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (Alt+F6)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="RECEIPT_NOTE">Receipt Note / GRN (Alt+F9)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
          activeTab={purchaseOrderTab}
          onTabChange={setPurchaseOrderTab}
        />
      ) : activeVType === 'RECEIPT_NOTE' ? (
        <ReceiptNoteEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={handleSubVoucherBack}
          voucherTypeSelector={
            <div className="relative shrink-0">
              <select
                value={activeVType}
                onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                className="h-7.5 rounded-lg border-2 border-indigo-500 bg-indigo-50 pl-2 pr-6 font-black text-indigo-700 text-xs shadow-xs outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
              >
                <option value="" disabled>Select Voucher Form...</option>
                <optgroup label="Financial & Accounting">
                  <option value="P">Payment Voucher (F5)</option>
                  <option value="R">Receipt Voucher (F6)</option>
                  <option value="J">Journal Voucher (F7)</option>
                  <option value="C">Contra Voucher (F4)</option>
                </optgroup>
                <optgroup label="Invoicing & Returns">
                  <option value="CN">Credit Note / Sales Return (Ctrl+F8)</option>
                  <option value="DN">Debit Note / Purchase Return (Ctrl+F9)</option>
                  <option value="S">Sales Invoice / POS (F8)</option>
                  <option value="PUR">Purchase Invoice (F9)</option>
                </optgroup>
                <optgroup label="Orders & Quotations">
                  <option value="QUOTATION">Quotation / Estimate (Alt+F4)</option>
                  <option value="SALES_ORDER">Sales Order (Alt+F5)</option>
                  <option value="PURCHASE_ORDER">Purchase Order (Alt+F6)</option>
                </optgroup>
                <optgroup label="Inventory & Stock">
                  <option value="DEL_NOTE">Delivery Note / Challan (Alt+F8)</option>
                  <option value="RECEIPT_NOTE">Receipt Note / GRN (Alt+F9)</option>
                  <option value="PHYSICAL_STOCK">Physical Stock Audit (Alt+F10)</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-2 top-2 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
            </div>
          }
          activeTab={receiptNoteTab}
          onTabChange={setReceiptNoteTab}
        />
      ) : activeVType && ['P', 'R', 'J', 'C'].includes(activeVType) ? (
        /* Financial Vouchers (Payment, Receipt, Journal, Contra) */
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {/* Editing Voucher Indicator */}
          {editingVoucherNo && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-300/80 rounded-xl text-amber-900 text-xs shadow-2xs">
              <div className="flex items-center gap-2 font-medium">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Editing Voucher: <strong className="font-mono font-bold text-amber-950 text-sm">{editingVoucherNo}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVoucherNo(null);
                  if (isAutoMode) {
                    setVoucherNo(peekNextVoucherNo(activeVType as any, config));
                  } else {
                    setVoucherNo('');
                  }
                  handleCancelOrResetEntry();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] hover:bg-amber-100 transition cursor-pointer shadow-2xs"
              >
                <span>Discard Edit &amp; New Voucher</span>
              </button>
            </div>
          )}



          {/* Double-Entry Grid or Single Mode Fields */}
          {entryMode === 'multi' ? (
            <div className="flex-1 min-h-[220px] flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto min-h-[160px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                    <tr>
                      <th className="py-2 px-2.5 w-16 text-center">Dr / Cr</th>
                      <th className="py-2 px-3">Ledger Account</th>
                      <th className="py-2 px-2.5 w-28 sm:w-32 text-right">Debit ({currencySymbol})</th>
                      <th className="py-2 px-2.5 w-28 sm:w-32 text-right">Credit ({currencySymbol})</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, index) => (
                      <tr key={line.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2 px-2 text-center w-16">
                          <select
                            id={`grid-type-${index}`}
                            value={line.type}
                            onChange={e => updateGridLine(line.id, 'type', e.target.value as 'Dr' | 'Cr')}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                focusGridField(index, 'ledger');
                              } else if (e.key === 'ArrowUp' && index > 0) {
                                e.preventDefault();
                                focusGridField(index - 1, 'type');
                              } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
                                e.preventDefault();
                                focusGridField(index + 1, 'type');
                              }
                            }}
                            className={`w-full rounded-lg border px-1.5 py-1 font-black text-xs outline-none focus:ring-2 focus:ring-indigo-200 ${
                              line.type === 'Dr'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <option value="Dr">Dr</option>
                            <option value="Cr">Cr</option>
                          </select>
                        </td>

                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 w-full">
                            <div className="flex-1 min-w-0">
                              <SearchableLedgerSelect
                                id={`grid-ledger-${index}`}
                                ledgers={ledgers}
                                value={line.ledger}
                                restrictToGroups={activeVType === 'C' ? ['Bank Accounts', 'Cash-in-Hand'] : undefined}
                                prioritizeGroups={
                                  // Receipt Voucher: Dr -> Bank + Cash, Cr -> Sundry Debtors + Incomes
                                  activeVType === 'R' && line.type === 'Cr'
                                    ? ['Sundry Debtors', 'Debtors', 'Direct Incomes', 'Indirect Incomes', 'Sales Accounts', 'Sales Account']
                                    : activeVType === 'R' && line.type === 'Dr'
                                    ? ['Bank Accounts', 'Cash-in-Hand', 'Bank OD/OCC A/c', 'Cash']
                                    // Payment Voucher: Cr -> Bank + Cash, Dr -> Expenses + Sundry Creditors
                                    : activeVType === 'P' && line.type === 'Cr'
                                    ? ['Bank Accounts', 'Cash-in-Hand', 'Bank OD/OCC A/c', 'Cash']
                                    : activeVType === 'P' && line.type === 'Dr'
                                    ? [
                                        'Direct Expenses',
                                        'Indirect Expenses',
                                        'Administrative Expenses',
                                        'Selling & Distribution Expenses',
                                        'Financial Expenses',
                                        'Wages & Factory Expenses',
                                        'Freight & Carriage Inwards',
                                        'Expenses',
                                        'Sundry Creditors',
                                        'Creditors'
                                      ]
                                    // Contra Voucher: Bank + Cash both sides
                                    : activeVType === 'C'
                                    ? ['Bank Accounts', 'Cash-in-Hand', 'Bank OD/OCC A/c', 'Cash']
                                    // Journal Voucher: Dr -> Expenses, Assets, Debtors; Cr -> Creditors, Capital, Incomes
                                    : activeVType === 'J' && line.type === 'Dr'
                                    ? ['Direct Expenses', 'Indirect Expenses', 'Expenses', 'Fixed Assets', 'Sundry Debtors', 'Debtors', 'Current Assets']
                                    : activeVType === 'J' && line.type === 'Cr'
                                    ? ['Sundry Creditors', 'Creditors', 'Capital Account', 'Direct Incomes', 'Indirect Incomes', 'Current Liabilities']
                                    // Sales / Quotation / Delivery Note: Dr -> Debtors, Cr -> Sales
                                    : (activeVType as string) === 'S' || (activeVType as string) === 'SL' || (activeVType as string) === 'Q' || (activeVType as string) === 'DN'
                                    ? (line.type === 'Dr' ? ['Sundry Debtors', 'Debtors'] : ['Sales Accounts', 'Direct Incomes'])
                                    // Purchase / Credit Note: Cr -> Creditors, Dr -> Purchases
                                    : (activeVType as string) === 'PU' || (activeVType as string) === 'CN'
                                    ? (line.type === 'Cr' ? ['Sundry Creditors', 'Creditors'] : ['Purchase Accounts', 'Direct Expenses'])
                                    : undefined
                                }
                                onChange={val => updateGridLine(line.id, 'ledger', val)}
                                onCreateNew={() => openCreateLedgerModal(line.id)}
                                onEnterNext={() => {
                                  if (isTdsLedger(line.ledger) || (isGstInputLedger(line.ledger) && activeVType === 'P')) {
                                    return;
                                  }
                                  focusGridField(index, line.type === 'Dr' ? 'debit' : 'credit');
                                }}
                                onArrowLeft={() => focusGridField(index, 'type')}
                                onArrowRight={() => focusGridField(index, line.type === 'Dr' ? 'debit' : 'credit')}
                                onArrowUp={() => index > 0 && focusGridField(index - 1, 'ledger')}
                                onArrowDown={() => index < lines.length - 1 && focusGridField(index + 1, 'ledger')}
                                placeholder="Select Ledger Account"
                              />
                              {config.EnableBillWiseDetails !== 'false' && line.billAllocations && line.billAllocations.length > 0 && (
                                <div className="mt-0.5 flex items-center gap-1 text-[9px] font-mono text-emerald-800">
                                  <span className="font-bold">✓ Bills:</span>
                                  <span className="truncate max-w-[200px]" title={line.billAllocations.map(a => `${a.billNo} (${a.amount})`).join(', ')}>
                                    {line.billAllocations.map(a => a.billNo).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            {isTdsLedger(line.ledger) && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  prepareTdsDefaults({ isMulti: true, lineId: line.id, type: line.type, lineAmt: Number(line.type === 'Dr' ? line.debit : line.credit) });
                                  setShowTdsDetailModal(true);
                                }}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-black shrink-0 flex items-center gap-1 transition cursor-pointer ${
                                  isTdsApplicable
                                    ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-2xs'
                                    : 'border-amber-200 bg-amber-50/80 text-amber-700 hover:bg-amber-100'
                                }`}
                                title="Click to view/edit TDS 2% (Form IT-7B) statutory details"
                              >
                                <FileText className="h-3 w-3 text-amber-600" />
                                <span>{isTdsApplicable ? 'TDS Details (✓)' : '+ TDS'}</span>
                              </button>
                            )}
                            {isGstInputLedger(line.ledger) && activeVType === 'P' && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  prepareGstDefaults({ isMulti: true, lineId: line.id, type: line.type, lineAmt: Number(line.type === 'Dr' ? line.debit : line.credit) });
                                  setShowGstDetailModal(true);
                                }}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-black shrink-0 flex items-center gap-1 transition cursor-pointer ${
                                  gstInputType !== 'None'
                                    ? 'bg-indigo-100 border-indigo-400 text-indigo-950 shadow-2xs'
                                    : 'border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100'
                                }`}
                                title="Click to view/edit GST Input Tax claim details"
                              >
                                <Receipt className="h-3 w-3 text-indigo-600" />
                                <span>{gstInputType !== 'None' ? 'GST Details (✓)' : '+ GST'}</span>
                              </button>
                            )}
                            {config.EnableBillWiseDetails !== 'false' && line.ledger && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => {
                                  setBillModalParty(line.ledger);
                                  setBillModalTargetLineId(line.id);
                                  setBillModalOpen(true);
                                }}
                                className={`p-1.5 rounded-lg border text-xs shrink-0 flex items-center gap-1 transition ${
                                  line.billAllocations && line.billAllocations.length > 0
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-indigo-600'
                                }`}
                                title={line.billAllocations && line.billAllocations.length > 0 ? `${line.billAllocations.length} bill(s) allocated` : 'Allocate against Bills (Agst Ref)'}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {line.billAllocations && line.billAllocations.length > 0 && (
                                  <span className="text-[10px]">{line.billAllocations.length}</span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => openEditLedgerModal(line.ledger, line.id)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 shrink-0"
                              title="Edit Ledger (Alt+E)"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2 px-2 w-28 sm:w-32">
                          <input
                            id={`grid-debit-${index}`}
                            type="number"
                            min="0"
                            step="any"
                            disabled={line.type === 'Cr'}
                            value={line.type === 'Dr' ? (line.debit !== undefined && line.debit !== null ? line.debit : '') : ''}
                            onFocus={e => e.target.select()}
                            onChange={e =>
                              updateGridLine(
                                line.id,
                                'debit',
                                e.target.value === '' ? '' : parseFloat(e.target.value)
                              )
                            }
                            onBlur={() => {
                              if (line.type === 'Dr' && line.debit && line.debit > 0) {
                                checkBillWiseSettlement(line.ledger, line.debit, line.id);
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                if (!checkBillWiseSettlement(line.ledger, line.debit, line.id)) {
                                  if (index < lines.length - 1) {
                                    focusGridField(index + 1, 'ledger');
                                  } else if (!isBalanced) {
                                    addGridRow();
                                  } else {
                                    focusElement('v-overall-narration');
                                  }
                                }
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                focusGridField(index, 'ledger');
                              } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                if (index < lines.length - 1) {
                                  focusGridField(index + 1, 'ledger');
                                } else {
                                  focusElement('v-overall-narration');
                                }
                              } else if (e.key === 'ArrowUp' && index > 0) {
                                e.preventDefault();
                                focusGridField(index - 1, 'debit');
                              } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
                                e.preventDefault();
                                focusGridField(index + 1, 'debit');
                              }
                            }}
                            className={`w-full text-right rounded-lg border px-2 py-1 font-bold outline-none transition focus:ring-2 focus:ring-blue-200 ${
                              line.type === 'Dr'
                                ? 'bg-white border-slate-300 text-blue-700 focus:border-blue-600'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          />
                        </td>

                        <td className="py-2 px-2 w-28 sm:w-32">
                          <input
                            id={`grid-credit-${index}`}
                            type="number"
                            min="0"
                            step="any"
                            disabled={line.type === 'Dr'}
                            value={line.type === 'Cr' ? (line.credit !== undefined && line.credit !== null ? line.credit : '') : ''}
                            onFocus={e => e.target.select()}
                            onChange={e =>
                              updateGridLine(
                                line.id,
                                'credit',
                                e.target.value === '' ? '' : parseFloat(e.target.value)
                              )
                            }
                            onBlur={() => {
                              if (line.type === 'Cr' && line.credit && line.credit > 0) {
                                checkBillWiseSettlement(line.ledger, line.credit, line.id);
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                if (!checkBillWiseSettlement(line.ledger, line.credit, line.id)) {
                                  if (index < lines.length - 1) {
                                    focusGridField(index + 1, 'ledger');
                                  } else if (!isBalanced) {
                                    addGridRow();
                                  } else {
                                    focusElement('v-overall-narration');
                                  }
                                }
                              } else if (e.key === 'ArrowLeft') {
                                e.preventDefault();
                                focusGridField(index, 'ledger');
                              } else if (e.key === 'ArrowRight') {
                                e.preventDefault();
                                if (index < lines.length - 1) {
                                  focusGridField(index + 1, 'ledger');
                                } else {
                                  focusElement('v-overall-narration');
                                }
                              } else if (e.key === 'ArrowUp' && index > 0) {
                                e.preventDefault();
                                focusGridField(index - 1, 'credit');
                              } else if (e.key === 'ArrowDown' && index < lines.length - 1) {
                                e.preventDefault();
                                focusGridField(index + 1, 'credit');
                              }
                            }}
                            className={`w-full text-right rounded-lg border px-2 py-1 font-bold outline-none transition focus:ring-2 focus:ring-emerald-200 ${
                              line.type === 'Cr'
                                ? 'bg-white border-slate-300 text-emerald-700 focus:border-emerald-600'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          />
                        </td>

                        <td className="py-2 px-3 text-center w-12">
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => removeGridRow(line.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Row */}
              <div className="rounded-b-xl bg-slate-50 border-t border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 font-bold text-xs shrink-0">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-500">Total Dr: </span>
                    <span className="text-blue-700 font-extrabold font-mono">
                      {currencySymbol} {totalDr.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Cr: </span>
                    <span className="text-emerald-700 font-extrabold font-mono">
                      {currencySymbol} {totalCr.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800 font-extrabold text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      Perfect Balance
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-rose-800 font-extrabold text-[10px]">
                      <AlertCircle className="h-3 w-3" />
                      Diff: {currencySymbol} {difference.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Single Entry Mode Form */
            <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5">
                  <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">
                    {activeVType === 'P'
                      ? 'Payment Account (Expense / Party)'
                      : activeVType === 'R'
                      ? 'Receipt From (Party / Income)'
                      : activeVType === 'J'
                      ? 'Debit Ledger (Dr)'
                      : 'Transfer To Account (Dr)'}
                  </label>
                  <SearchableLedgerSelect
                    id="single-ledger-1"
                    ledgers={ledgers}
                    restrictToGroups={activeVType === 'C' ? ['Bank Accounts', 'Cash-in-Hand'] : undefined}
                    prioritizeGroups={
                      activeVType === 'P'
                        ? [
                            'Direct Expenses',
                            'Indirect Expenses',
                            'Administrative Expenses',
                            'Selling & Distribution Expenses',
                            'Financial Expenses',
                            'Wages & Factory Expenses',
                            'Freight & Carriage Inwards',
                            'Expenses',
                            'Sundry Creditors',
                            'Creditors'
                          ]
                        : activeVType === 'R'
                        ? ['Sundry Debtors', 'Debtors', 'Direct Incomes', 'Indirect Incomes', 'Sales Accounts', 'Sales Account']
                        : activeVType === 'J'
                        ? ['Direct Expenses', 'Indirect Expenses', 'Expenses', 'Fixed Assets', 'Sundry Debtors', 'Debtors', 'Current Assets']
                        : activeVType === 'C'
                        ? ['Bank Accounts', 'Cash-in-Hand', 'Bank OD/OCC A/c', 'Cash']
                        : undefined
                    }
                    value={
                      activeVType === 'P' || activeVType === 'R'
                        ? partyLedger
                        : activeVType === 'J'
                        ? debitLedger
                        : toAccount
                    }
                    onChange={val => {
                      if (activeVType === 'P') {
                        setPartyLedger(val);
                        setBillAllocations([]);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, val, modeLedger, []);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else if (activeVType === 'R') {
                        setPartyLedger(val);
                        setBillAllocations([]);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, modeLedger, val, []);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else if (activeVType === 'J') {
                        setDebitLedger(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, val, creditLedger, []);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else {
                        setToAccount(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, val, fromAccount, []);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      checkAndPromptBankLedger(val, 'single-ledger-2');
                      handleLedgerSelected(val, { isMulti: false, nextElementId: 'single-ledger-2' });
                    }}
                    onCreateNew={() => openCreateLedgerModal(undefined, 'single-1')}
                    onEnterNext={() => {
                      if (isTdsLedger(partyLedger) || (isGstInputLedger(partyLedger) && activeVType === 'P')) {
                        return;
                      }
                      focusElement('single-ledger-2');
                    }}
                    onArrowRight={() => focusElement('single-ledger-2')}
                    onArrowDown={() => focusElement('single-ledger-2')}
                    placeholder="Select Ledger Account"
                  />

                  {/* Bill-wise Details (Pending Invoices Settlement) Info */}
                  {config.EnableBillWiseDetails !== 'false' && (activeVType === 'P' || activeVType === 'R') && partyLedger && (
                    <div className="mt-1.5 space-y-1">
                      {partyOutstandingBills.length > 0 && (
                        <div 
                          onClick={() => {
                            setBillModalParty(partyLedger);
                            setBillModalOpen(true);
                          }}
                          className="flex items-center justify-between bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer transition shadow-2xs group"
                          title="Click to view and settle pending bills"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span className="text-slate-700 font-medium">
                              {partyOutstandingBills.length} Bill{partyOutstandingBills.length > 1 ? 's' : ''} Due:
                            </span>
                            <span className="font-mono font-bold text-indigo-950">
                              {currencySymbol}{partyOutstandingBills.reduce((s, b) => s + b.pendingAmount, 0).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                            <span>Settle Bills</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      )}

                      {partyOutstandingBills.length === 0 && (
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] text-slate-400">No unpaid credit invoices pending</span>
                        </div>
                      )}

                      {billAllocations.length > 0 && (
                        <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-900 flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Allocated against {billAllocations.length} bill{billAllocations.length > 1 ? 's' : ''}:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setBillAllocations([])}
                              className="text-slate-400 hover:text-rose-600 text-[10px] font-semibold cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {billAllocations.map(a => (
                              <span key={a.billNo} className="px-1.5 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded font-mono text-[10px] font-bold shadow-2xs">
                                {a.billNo}: {currencySymbol}{a.amount.toLocaleString()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-5">
                  <label className="block font-bold text-slate-700 mb-1">
                    {activeVType === 'P'
                      ? 'Paid Via (Cash / Bank)'
                      : activeVType === 'R'
                      ? 'Received In (Cash / Bank)'
                      : activeVType === 'J'
                      ? 'Credit Ledger (Cr)'
                      : 'Transfer From Account (Cr)'}
                  </label>
                  <SearchableLedgerSelect
                    id="single-ledger-2"
                    ledgers={ledgers}
                    restrictToGroups={activeVType === 'C' ? ['Bank Accounts', 'Cash-in-Hand'] : undefined}
                    prioritizeGroups={
                      activeVType === 'P' || activeVType === 'R' || activeVType === 'C'
                        ? ['Bank Accounts', 'Cash-in-Hand', 'Bank OD/OCC A/c', 'Cash']
                        : activeVType === 'J'
                        ? ['Sundry Creditors', 'Creditors', 'Capital Account', 'Direct Incomes', 'Indirect Incomes', 'Current Liabilities']
                        : undefined
                    }
                    value={
                      activeVType === 'P' || activeVType === 'R'
                        ? modeLedger
                        : activeVType === 'J'
                        ? creditLedger
                        : fromAccount
                    }
                    onChange={val => {
                      if (activeVType === 'P') {
                        setModeLedger(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, partyLedger, val, billAllocations, amount);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else if (activeVType === 'R') {
                        setModeLedger(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, val, partyLedger, billAllocations, amount);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else if (activeVType === 'J') {
                        setCreditLedger(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, debitLedger, val, billAllocations, amount);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      else {
                        setFromAccount(val);
                        if (!narration || narration.startsWith('Being ')) {
                          const suggested = getSuggestedNarration(activeVType, toAccount, val, billAllocations, amount);
                          if (suggested) setNarration(suggested);
                        }
                      }
                      checkAndPromptBankLedger(val, 'single-amount');
                      handleLedgerSelected(val, { isMulti: false, nextElementId: 'single-amount' });
                    }}
                    onCreateNew={() => openCreateLedgerModal(undefined, 'single-2')}
                    onEnterNext={() => {
                      const currentVal = activeVType === 'P' || activeVType === 'R' ? modeLedger : activeVType === 'J' ? creditLedger : fromAccount;
                      if (isTdsLedger(currentVal) || (isGstInputLedger(currentVal) && activeVType === 'P')) {
                        return;
                      }
                      focusElement('single-amount');
                    }}
                    onArrowLeft={() => focusElement('single-ledger-1')}
                    onArrowRight={() => focusElement('single-amount')}
                    onArrowUp={() => focusElement('single-ledger-1')}
                    onArrowDown={() => focusElement('single-amount')}
                    placeholder="Select Cash / Bank Account"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Amount ({currencySymbol})</label>
                  <input
                    id="single-amount"
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="0.00"
                    value={amount !== undefined && amount !== null ? amount : ''}
                    onFocus={e => e.target.select()}
                    onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={(e) => {
                      if (amount && amount > 0) {
                        checkBillWiseSettlement(partyLedger, amount);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        if (!checkBillWiseSettlement(partyLedger, amount)) {
                          focusElement('v-overall-narration');
                        }
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        focusElement('single-ledger-2');
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        focusElement('single-ledger-1');
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        focusElement('v-overall-narration');
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-black text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Statutory TDS 2% and GST Input Active Details Badge Row */}
          {(isTdsApplicable || (activeVType === 'P' && config.EnableGSTInputTax !== 'false' && gstInputType !== 'None')) && (
            <div className="flex items-center flex-wrap gap-2 px-1 py-0.5">
              {isTdsApplicable && (
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-amber-950 shadow-2xs">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-amber-900">TDS 2% (IT-7B):</span>
                    <span className="font-mono font-bold text-amber-950">
                      Nu. {Number(tdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {tdsContractorNameAndAddress && (
                      <span className="text-[11px] text-slate-500 font-medium truncate max-w-[140px]">
                        ({tdsContractorNameAndAddress})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTdsDetailModal(true)}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer px-1 py-0.5 rounded hover:bg-amber-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTdsApplicable(false);
                      showToast('TDS details removed', 'success');
                    }}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition"
                    title="Remove TDS Details"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {activeVType === 'P' && config.EnableGSTInputTax !== 'false' && gstInputType !== 'None' && (
                <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-300 rounded-xl px-3 py-1.5 text-xs text-indigo-950 shadow-2xs">
                  <Receipt className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-indigo-900">GST Input ({gstInputType}):</span>
                    <span className="font-mono font-bold text-indigo-950">
                      Nu. {Number(gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGstDetailModal(true)}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer px-1 py-0.5 rounded hover:bg-indigo-100 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGstInputType('None');
                      showToast('GST Input details removed', 'success');
                    }}
                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition"
                    title="Remove GST Input Details"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Item-wise Stock / Consumables Breakdown for Journal Vouchers */}
          {activeVType === 'J' && (
            <div className="rounded-xl border border-indigo-200 bg-linear-to-r from-indigo-50/50 via-white to-indigo-50/30 p-3 shadow-xs text-xs space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-indigo-950 text-xs">
                        Item-wise Details / Stock for Internal Consumption
                      </span>
                      {journalItems.length > 0 && (
                        <span className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                          {journalItems.length} {journalItems.length === 1 ? 'item' : 'items'} (Nu. {totalJournalItemsAmount.toFixed(2)})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Purchased stationery / consumables to keep in stock and consume as needed. (Resale stock is handled in Purchase vouchers).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {journalItems.length > 0 && totalJournalItemsAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (entryMode === 'single') {
                          setAmount(totalJournalItemsAmount);
                        } else {
                          setLines(prev => {
                            const updated = [...prev];
                            if (updated[0]) updated[0].debit = totalJournalItemsAmount;
                            if (updated[1]) updated[1].credit = totalJournalItemsAmount;
                            return updated;
                          });
                        }
                        showToast(`Voucher amount set to Nu. ${totalJournalItemsAmount.toFixed(2)}`, 'success');
                      }}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-2xs"
                      title="Set voucher amount to match the total item value"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Sync Total (Nu. {totalJournalItemsAmount.toFixed(2)})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!showJournalItems) {
                        setShowJournalItems(true);
                        if (journalItems.length === 0) handleAddJournalItemRow();
                      } else {
                        setShowJournalItems(false);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      showJournalItems
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {showJournalItems ? (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Hide Item Details</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Item-wise Details</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {showJournalItems && (
                <div className="space-y-2 pt-1">
                  <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white shadow-2xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-indigo-50/80 text-indigo-950 font-bold border-b border-indigo-100 text-[11px]">
                        <tr>
                          <th className="py-2 px-2.5 w-10 text-center">#</th>
                          <th className="py-2 px-2.5 min-w-[200px]">Item Name / Description</th>
                          <th className="py-2 px-2 w-20">Unit</th>
                          <th className="py-2 px-2 w-24 text-right">Qty</th>
                          <th className="py-2 px-2 w-28 text-right">Rate ({currencySymbol})</th>
                          <th className="py-2 px-2.5 w-32 text-right">Amount ({currencySymbol})</th>
                          <th className="py-2 px-2.5 min-w-[150px]">Purpose / Notes</th>
                          <th className="py-2 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {journalItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  list={`journal-item-list-${item.id}`}
                                  value={item.itemName}
                                  onChange={e => handleUpdateJournalItem(item.id, 'itemName', e.target.value)}
                                  placeholder="e.g. A4 Paper, Ball Pens, Office Files..."
                                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                                />
                                <datalist id={`journal-item-list-${item.id}`}>
                                  {inventoryItems.map((inv, i) => (
                                    <option key={i} value={inv['Item Name']}>
                                      {inv['Item Code'] ? `[${inv['Item Code']}] ` : ''}{inv.Unit ? `(${inv.Unit})` : ''}
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={e => handleUpdateJournalItem(item.id, 'unit', e.target.value)}
                                placeholder="Pcs"
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.qty !== undefined && item.qty !== null ? item.qty : ''}
                                onChange={e => handleUpdateJournalItem(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="1"
                                className="w-full text-right rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.rate !== undefined && item.rate !== null ? item.rate : ''}
                                onChange={e => handleUpdateJournalItem(item.id, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="0.00"
                                className="w-full text-right rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                              />
                            </td>
                            <td className="py-1.5 px-2.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.amount !== undefined && item.amount !== null ? item.amount : ''}
                                onChange={e => handleUpdateJournalItem(item.id, 'amount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                placeholder="0.00"
                                className="w-full text-right rounded-md border border-indigo-200 bg-indigo-50/40 px-2 py-1 text-xs text-indigo-950 font-black outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                              />
                            </td>
                            <td className="py-1.5 px-2.5">
                              <input
                                type="text"
                                value={item.description || ''}
                                onChange={e => handleUpdateJournalItem(item.id, 'description', e.target.value)}
                                placeholder="e.g. Accounts Dept use"
                                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveJournalItem(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddJournalItemRow}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Item</span>
                    </button>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500 font-medium">
                        Total Items Value:
                      </span>
                      <span className="font-mono font-black text-indigo-950 text-sm">
                        {currencySymbol} {totalJournalItemsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Overall Narration at bottom of voucher entry */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs text-xs shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <label className="block font-bold text-slate-700 text-[11px]">Overall Narration</label>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const activeDr = entryMode === 'multi'
                      ? (lines.find(l => l.type === 'Dr' && l.ledger)?.ledger || '')
                      : (activeVType === 'P' ? partyLedger : activeVType === 'R' ? modeLedger : activeVType === 'J' ? debitLedger : toAccount);
                    const activeCr = entryMode === 'multi'
                      ? (lines.find(l => l.type === 'Cr' && l.ledger)?.ledger || '')
                      : (activeVType === 'P' ? modeLedger : activeVType === 'R' ? partyLedger : activeVType === 'J' ? creditLedger : fromAccount);
                    const generated = getSuggestedNarration(activeVType, activeDr, activeCr, billAllocations, amount);
                    if (generated) setNarration(generated);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 transition cursor-pointer"
                  title="Auto-generate standard accounting narration based on party, bills and payment mode"
                >
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Auto-Suggest</span>
                </button>
              </div>

              {isBankInvolved && transactionId && (
                <div 
                  onClick={() => {
                    const activeBank = (lines.find(l => isBankLedger(l.ledger, ledgers, config))?.ledger) || partyLedger || modeLedger || 'Bank Account';
                    setBankTxnModal({ isOpen: true, bankLedgerName: activeBank });
                  }}
                  className="cursor-pointer text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1 transition"
                  title="Click to edit Bank Transaction ID"
                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Bank Txn Ref:</span>
                  <span className="font-mono">{transactionId}</span>
                </div>
              )}
            </div>
            <input
              id="v-overall-narration"
              type="text"
              placeholder={
                activeVType === 'R'
                  ? (partyLedger ? `e.g. Being payment received from ${partyLedger} against bill` : "e.g. Being payment received from customer against Invoice")
                  : activeVType === 'P'
                  ? (partyLedger ? `e.g. Being payment made to ${partyLedger} against bill` : "e.g. Being payment made to vendor / expense")
                  : activeVType === 'C'
                  ? "e.g. Being cash deposited into bank / cash withdrawal"
                  : "e.g. Being journal adjustment entry passed"
              }
              value={narration || ''}
              onFocus={e => e.target.select()}
              onChange={e => setNarration(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  focusElement('v-save-btn');
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (entryMode === 'multi') {
                    focusGridField(lines.length - 1, 'narration');
                  } else {
                    focusElement('single-amount');
                  }
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-1.5 font-medium text-slate-900 outline-none focus:border-indigo-600 focus:bg-white text-xs transition"
            />
          </div>
        </div>

          {/* Action Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="text-slate-500 font-semibold text-[11px] flex items-center gap-2">
              <span>Shortcuts:</span>
              <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">F2</kbd> Save</span>
              <span>•</span>
              <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">Alt+V</kbd> Register</span>
              <span>•</span>
              <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">Esc</kbd> Cancel</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Cancel / Reset Button */}
              <button
                type="button"
                onClick={handleCancelOrResetEntry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3.5 py-1.5 font-bold text-slate-700 text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                title="Discard changes and clear form (Esc)"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>Cancel / Clear</span>
              </button>

              {/* Respective Register Button (situated just left to Save Voucher) */}
              <button
                type="button"
                onClick={handleOpenRespectiveRegister}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 px-3.5 py-1.5 font-bold text-slate-700 text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                title={`Open ${registerLabel} (Alt+V)`}
              >
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span>{registerLabel}</span>
                <span className="font-mono text-[10px] text-slate-400 font-normal ml-0.5">(Alt+V)</span>
              </button>

              {/* Save Voucher */}
              <button
                id="v-save-btn"
                type="button"
                onClick={() => handleSubmit()}
                onKeyDown={e => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusElement('v-overall-narration');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-2 focus:ring-indigo-300 outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Voucher (F2)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Default State: Select Voucher Type Dashboard Launcher */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6 text-xs">
          <div className="max-w-xl">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1">
              Select Voucher Type
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Please choose a voucher type from the dropdown above or click on one of the standard voucher options below to start recording transactions:
            </p>
          </div>

          <div className="space-y-5">
            {/* Financial Vouchers */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                Financial & Accounting Vouchers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => handleVTypeChange('P')}
                  className="group flex flex-col justify-between rounded-xl border border-rose-200 bg-rose-50/40 p-4 text-left hover:bg-rose-50 hover:border-rose-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-extrabold text-slate-900 text-sm group-hover:text-rose-700 transition">Payment Voucher</span>
                    <span className="rounded-md bg-white border border-rose-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700">F5</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">Vendor payouts, expense payments & cash/bank outflows</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('R')}
                  className="group flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-left hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-700 transition">Receipt Voucher</span>
                    <span className="rounded-md bg-white border border-emerald-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">F6</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">Customer collections, income receipts & money received</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('J')}
                  className="group flex flex-col justify-between rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-left hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-extrabold text-slate-900 text-sm group-hover:text-indigo-700 transition">Journal Voucher</span>
                    <span className="rounded-md bg-white border border-indigo-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">F7</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">Depreciation, ledger adjustments & non-cash transfers</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('C')}
                  className="group flex flex-col justify-between rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-left hover:bg-amber-50 hover:border-amber-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-extrabold text-slate-900 text-sm group-hover:text-amber-700 transition">Contra Voucher</span>
                    <span className="rounded-md bg-white border border-amber-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-700">F4</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 font-medium">Bank deposits, cash withdrawals & inter-account transfers</p>
                </button>
              </div>
            </div>

            {/* Invoicing, Orders & Inventory */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-indigo-600" />
                Returns, Orders & Inventory Vouchers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => handleVTypeChange('CN')}
                  className="group flex flex-col justify-between rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 text-left hover:bg-purple-50 hover:border-purple-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-purple-700 transition">Credit Note</span>
                    <span className="rounded bg-white border border-purple-200 px-1 py-0.5 font-mono text-[9px] font-bold text-purple-700">Ctrl+F8</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Sales return / client credit adjustment</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('DN')}
                  className="group flex flex-col justify-between rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 text-left hover:bg-orange-50 hover:border-orange-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-orange-700 transition">Debit Note</span>
                    <span className="rounded bg-white border border-orange-200 px-1 py-0.5 font-mono text-[9px] font-bold text-orange-700">Ctrl+F9</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Purchase return / supplier debit adjustment</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('DEL_NOTE')}
                  className="group flex flex-col justify-between rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 text-left hover:bg-sky-50 hover:border-sky-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-sky-700 transition">Delivery Note</span>
                    <span className="rounded bg-white border border-sky-200 px-1 py-0.5 font-mono text-[9px] font-bold text-sky-700">Alt+F8</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Dispatch goods with Delivery Challan</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('PHYSICAL_STOCK')}
                  className="group flex flex-col justify-between rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 text-left hover:bg-teal-50 hover:border-teal-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-teal-700 transition">Physical Stock</span>
                    <span className="rounded bg-white border border-teal-200 px-1 py-0.5 font-mono text-[9px] font-bold text-teal-700">Alt+F10</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Stock audit & inventory variance entry</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleVTypeChange('QUOTATION')}
                  className="group flex flex-col justify-between rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 text-left hover:bg-violet-50 hover:border-violet-300 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-slate-900 text-xs group-hover:text-violet-700 transition">Quotation</span>
                    <span className="rounded bg-white border border-violet-200 px-1 py-0.5 font-mono text-[9px] font-bold text-violet-700">Alt+F4</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">Commercial price estimate proposals</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CREATE / EDIT LEDGER MODAL */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                {isEditingLedger ? `Edit Ledger: ${editingOldName}` : 'Create Quick Ledger (Alt+C)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickLedger} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ledger Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karma Office Supplies"
                  value={newLedgerName || ''}
                  onChange={e => setNewLedgerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Account Group *</label>
                <select
                  value={newLedgerGroup || ''}
                  onChange={e => setNewLedgerGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                >
                  {DEFAULT_GROUPS.map(g => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    step="any"
                    value={newOpBalance !== undefined && newOpBalance !== null ? newOpBalance : ''}
                    onChange={e =>
                      setNewOpBalance(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={newBalanceType || 'Dr'}
                    onChange={e => setNewBalanceType(e.target.value as 'Dr' | 'Cr')}
                    className="w-full rounded-xl border border-slate-300 p-2.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                  >
                    <option value="Dr">Dr (Debit)</option>
                    <option value="Cr">Cr (Credit)</option>
                  </select>
                </div>
              </div>

              {((newLedgerGroup || '').toLowerCase().includes('debtor') || 
                (newLedgerGroup || '').toLowerCase().includes('customer') || 
                (newLedgerGroup || '').toLowerCase().includes('creditor') || 
                (newLedgerGroup || '').toLowerCase().includes('supplier')) && (
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        placeholder="Phone number"
                        value={newContactNo || ''}
                        onChange={e => setNewContactNo(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 bg-white outline-none focus:border-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">GSTIN / TPN</label>
                      <input
                        type="text"
                        placeholder="Tax ID / TPN"
                        value={newTpnNo || ''}
                        onChange={e => setNewTpnNo(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 p-2 text-slate-900 bg-white outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-black text-white hover:bg-indigo-700 shadow-sm"
                >
                  {isEditingLedger ? 'Update Ledger' : 'Create & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW VOUCHER SLIP MODAL */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  {config.CompanyName || 'Accounting System'}
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-lg">Accounting Voucher Slip</h3>
                  {viewVoucher.status === 'Cancelled' && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 border border-rose-300 px-2 py-0.5 font-black text-xs text-rose-700">
                      <Ban className="h-3.5 w-3.5" />
                      CANCELLED (VOID)
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewVoucher(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cancelled Notice Banner if cancelled */}
            {viewVoucher.status === 'Cancelled' && (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs space-y-1 text-rose-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>This voucher has been voided &amp; cancelled.</span>
                </div>
                {viewVoucher.cancellationReason && (
                  <p className="text-[11px] text-rose-700 font-medium pl-5.5">
                    <strong>Reason:</strong> {viewVoucher.cancellationReason}
                  </p>
                )}
                {viewVoucher.cancelledAt && (
                  <p className="text-[10px] text-rose-500 font-mono pl-5.5">
                    Cancelled on: {new Date(viewVoucher.cancelledAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Voucher Number:</span>
                <span className="font-mono font-bold text-indigo-600">{viewVoucher.voucherNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Date:</span>
                <span className="font-semibold text-slate-900">
                  {formatDateDMY(viewVoucher.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Voucher Type:</span>
                <span className="font-bold text-slate-900">
                  {viewVoucher.type === 'P'
                    ? 'Payment Out'
                    : viewVoucher.type === 'R'
                    ? 'Receipt In'
                    : viewVoucher.type === 'J'
                    ? 'Journal Entry'
                    : 'Contra Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Total Amount:</span>
                <span className="font-black text-indigo-950 font-mono">
                  {currencySymbol} {Number(viewVoucher.totalAmount || viewVoucher.total || 0).toFixed(2)}
                </span>
              </div>
              {(viewVoucher.billAllocations && viewVoucher.billAllocations.length > 0) || viewVoucher.billNo ? (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold">Settled Bills / Ref:</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {viewVoucher.billAllocations && viewVoucher.billAllocations.length > 0 ? (
                      viewVoucher.billAllocations.map((ba: any) => (
                        <span key={ba.billNo} className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-mono text-[10px] font-bold text-indigo-900">
                          {ba.billNo} ({currencySymbol}{Number(ba.amount).toFixed(2)})
                        </span>
                      ))
                    ) : (
                      <span className="font-mono font-bold text-indigo-700">{viewVoucher.billNo}</span>
                    )}
                  </div>
                </div>
              ) : null}
              {viewVoucher.narration && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold">Narration:</span>
                  <p className="font-medium text-slate-800 italic mt-0.5">{viewVoucher.narration}</p>
                </div>
              )}
            </div>

            {/* Dr / Cr breakdown */}
            <div className="space-y-2 text-xs">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">
                Ledger Entries
              </h4>
              {viewVoucher.lines && viewVoucher.lines.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2 w-16">Type</th>
                        <th className="p-2">Ledger Account</th>
                        <th className="p-2 text-right">Debit ({currencySymbol})</th>
                        <th className="p-2 text-right">Credit ({currencySymbol})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {viewVoucher.lines.map((l: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2 font-black text-[10px] uppercase">
                            <span className={l.type === 'Dr' ? 'text-blue-600' : 'text-emerald-600'}>
                              {l.type}
                            </span>
                          </td>
                          <td className="p-2 font-semibold">{l.ledger}</td>
                          <td className="p-2 text-right font-bold">
                            {l.type === 'Dr' ? (Number(l.total || l.debit) || 0).toFixed(2) : '-'}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {l.type === 'Cr' ? (Number(l.total || l.credit) || 0).toFixed(2) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-1.5 bg-white p-3 border border-slate-200 rounded-xl">
                  <div className="flex justify-between">
                    <span className="font-semibold text-blue-700">By (Debit): {viewVoucher.debitLedger}</span>
                    <span className="font-bold">
                      {currencySymbol} {Number(viewVoucher.total).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-emerald-700">To (Credit): {viewVoucher.creditLedger}</span>
                    <span className="font-bold">
                      {currencySymbol} {Number(viewVoucher.total).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar inside View Slip Modal */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Share Voucher via WhatsApp / PDF */}
                <button
                  type="button"
                  onClick={() => {
                    setShareModalVoucher(viewVoucher);
                  }}
                  className="px-3.5 h-9 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 border border-indigo-200 cursor-pointer shadow-2xs"
                  title="Share voucher with WhatsApp, PDF, or Summary"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Share Voucher</span>
                </button>

                {/* Save PDF */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = generateVoucherSlipPDF(viewVoucher, config);
                    doc.save(`Voucher_${viewVoucher.voucherNo}.pdf`);
                  }}
                  className="px-3.5 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
                >
                  <Download className="h-4 w-4" />
                  <span>Save PDF</span>
                </button>

                {/* Print Slip */}
                <button
                  type="button"
                  onClick={() => {
                    const doc = generateVoucherSlipPDF(viewVoucher, config);
                    printPdfDoc(doc);
                  }}
                  className="px-3.5 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Slip</span>
                </button>

                {/* Cancel Voucher Button (if not already cancelled) */}
                {viewVoucher.status !== 'Cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalVoucher(viewVoucher);
                      setCancelReason('');
                    }}
                    className="px-3.5 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-rose-200 cursor-pointer shadow-2xs"
                    title="Cancel voucher (reverses ledger entries)"
                  >
                    <Ban className="h-4 w-4 text-rose-600" />
                    <span>Cancel Voucher</span>
                  </button>
                )}

                {/* Delete Voucher Button */}
                <button
                  type="button"
                  onClick={() => {
                    const target = viewVoucher;
                    setViewVoucher(null);
                    setDeleteConfirmVoucher(target);
                  }}
                  className="px-3.5 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-slate-200 hover:border-rose-200 cursor-pointer shadow-2xs"
                  title="Permanently delete voucher"
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                  <span>Delete</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Duplicate / Copy Voucher */}
                <button
                  type="button"
                  onClick={() => {
                    const targetVoucher = viewVoucher;
                    setViewVoucher(null);
                    loadVoucherIntoEntry(targetVoucher, true);
                  }}
                  className="px-3.5 h-9 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center gap-1.5 border border-purple-200 cursor-pointer shadow-2xs transition active:scale-95"
                  title="Duplicate / Copy voucher into a new editable entry"
                >
                  <Copy className="h-4 w-4 text-purple-600" />
                  <span>Duplicate / Copy</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetVoucher = viewVoucher;
                    setViewVoucher(null);
                    loadVoucherIntoEntry(targetVoucher, false);
                  }}
                  className="px-4 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Open in Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewVoucher(null)}
                  className="px-5 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Close (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL VOUCHER CONFIRMATION MODAL */}
      {cancelModalVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-600 shrink-0">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Cancel Voucher #{cancelModalVoucher.voucherNo}?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Cancelling this voucher will <strong>reverse all corresponding ledger balance adjustments</strong> and mark the voucher status as Cancelled. The voucher number is kept for sequential audit trail.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Voucher Type:</span>
                <span className="font-bold text-slate-800">{cancelModalVoucher.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Amount:</span>
                <span className="font-mono font-black text-slate-900">
                  {currencySymbol} {Number(cancelModalVoucher.totalAmount || cancelModalVoucher.total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-bold text-slate-700">Cancellation Reason (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Customer requested revision, duplicate entry, incorrect amount"
                value={cancelReason || ''}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-medium text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setCancelModalVoucher(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => handleConfirmCancelVoucher()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Ban className="h-4 w-4" />
                <span>Confirm &amp; Void Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONFIRMATION MODAL */}
      {deleteConfirmVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Delete Voucher #{deleteConfirmVoucher.voucherNo}?
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                  Are you sure you want to permanently delete this voucher record? If active, all ledger balance postings will be automatically reversed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setDeleteConfirmVoucher(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmPermanentDelete()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DR / CR MISMATCH WARNING POPUP MODAL (Triggered on Save) */}
      {mismatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Voucher Dr &amp; Cr Mismatch
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Double entry vouchers must be strictly balanced before posting. Total Debit must equal Total Credit.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs font-semibold">
              <div className="flex justify-between items-center text-slate-700">
                <span>Total Debit (Dr):</span>
                <span className="font-extrabold text-blue-700">
                  {currencySymbol} {mismatchModal.totalDr.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>Total Credit (Cr):</span>
                <span className="font-extrabold text-emerald-700">
                  {currencySymbol} {mismatchModal.totalCr.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-rose-700 font-extrabold text-sm">
                <span>Difference:</span>
                <span>
                  {currencySymbol} {mismatchModal.diff.toFixed(2)} (
                  {mismatchModal.totalDr > mismatchModal.totalCr ? 'Cr is short' : 'Dr is short'})
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  addGridRow();
                  setMismatchModal(null);
                }}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Auto-Add Balancing Line</span>
              </button>
              <button
                type="button"
                onClick={() => setMismatchModal(null)}
                className="px-4 h-10 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition"
              >
                Adjust Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Save Universal Print / Share Action Modal */}
      <VoucherSuccessActionModal
        isOpen={!!successModalDetails}
        onClose={() => setSuccessModalDetails(null)}
        details={successModalDetails}
      />

      {/* Unified Voucher Share Modal (WhatsApp, PDF, Print, Copy) */}
      <VoucherShareModal
        isOpen={!!shareModalVoucher}
        onClose={() => setShareModalVoucher(null)}
        voucher={shareModalVoucher}
        config={config}
        onPrint={() => {
          if (shareModalVoucher) {
            setViewVoucher(shareModalVoucher);
          }
          setShareModalVoucher(null);
        }}
      />

      {/* Whole Voucher Register Share Modal */}
      <RegisterShareModal
        isOpen={showShareRegisterModal}
        onClose={() => setShowShareRegisterModal(false)}
        vouchers={filteredRecent}
        config={config}
        filters={{
          startDate: filterStartDate,
          endDate: filterEndDate,
          vType: filterVType,
          status: filterStatus,
          ledger: filterLedger,
          searchTerm: searchTerm
        }}
        totalAmount={totalFilteredAmount}
        onPrint={printWholeRegister}
        onExportExcel={exportRegisterToExcel}
      />

      {/* Pop-up modal for Bank Transaction ID / UTR as soon as Bank Ledger is selected */}
      <BankTransactionIdModal
        isOpen={bankTxnModal.isOpen}
        bankLedgerName={bankTxnModal.bankLedgerName}
        initialValue={transactionId}
        onSave={(newTxnId) => {
          setTransactionId(newTxnId);
          const targetId = bankTxnModal.focusNextElementId || (entryMode === 'single' ? 'single-amount' : undefined);
          setBankTxnModal({ isOpen: false, bankLedgerName: '', focusNextElementId: undefined });
          if (targetId) {
            focusElement(targetId);
          }
        }}
        onClose={() => {
          const targetId = bankTxnModal.focusNextElementId || (entryMode === 'single' ? 'single-amount' : undefined);
          setBankTxnModal({ isOpen: false, bankLedgerName: '', focusNextElementId: undefined });
          if (targetId) {
            focusElement(targetId);
          }
        }}
      />

      {/* Bill-wise Details Allocation Modal (Agst Ref) */}
      <BillWiseModal
        isOpen={billModalOpen}
        partyName={billModalParty}
        voucherType={activeVType}
        voucherAmount={
          billModalTargetLineId
            ? (lines.find(l => l.id === billModalTargetLineId)?.type === 'Dr'
                ? lines.find(l => l.id === billModalTargetLineId)?.debit || ''
                : lines.find(l => l.id === billModalTargetLineId)?.credit || '')
            : amount
        }
        currencySymbol={currencySymbol}
        defaultBillNo={supplierBillNo || undefined}
        defaultBillDate={supplierBillDate || date || undefined}
        initialAllocations={
          billModalTargetLineId
            ? lines.find(l => l.id === billModalTargetLineId)?.billAllocations
            : billAllocations
        }
        onConfirm={(allocs, totalAllocated) => {
          if (billModalTargetLineId) {
            setLines(prev =>
              prev.map(l => {
                if (l.id === billModalTargetLineId) {
                  const updatedLine = { ...l, billAllocations: allocs };
                  if (totalAllocated > 0) {
                    if (l.type === 'Dr') {
                      updatedLine.debit = totalAllocated;
                    } else {
                      updatedLine.credit = totalAllocated;
                    }
                  }
                  return updatedLine;
                }
                return l;
              })
            );
          } else {
            setBillAllocations(allocs);
            if ((!amount || Number(amount) === 0) && totalAllocated > 0) {
              setAmount(totalAllocated);
            }
          }

          // If a new reference was allocated, sync supplierBillNo & supplierBillDate
          const newRefAlloc = allocs.find(a => a.refType === 'New Ref');
          if (newRefAlloc) {
            if (newRefAlloc.billNo && (!supplierBillNo || supplierBillNo.startsWith('REF-'))) {
              setSupplierBillNo(newRefAlloc.billNo);
            }
            if (newRefAlloc.billDate) {
              setSupplierBillDate(newRefAlloc.billDate);
            }
          }

          // Intelligent Auto-Narration Generation upon bill allocation
          const activeDr = billModalTargetLineId
            ? (lines.find(l => l.id === billModalTargetLineId)?.type === 'Dr' ? billModalParty : (lines.find(l => l.type === 'Dr')?.ledger || ''))
            : (activeVType === 'P' ? (partyLedger || billModalParty) : activeVType === 'R' ? (modeLedger || '') : activeVType === 'J' ? debitLedger : toAccount);
          const activeCr = billModalTargetLineId
            ? (lines.find(l => l.id === billModalTargetLineId)?.type === 'Cr' ? billModalParty : (lines.find(l => l.type === 'Cr')?.ledger || ''))
            : (activeVType === 'P' ? (modeLedger || '') : activeVType === 'R' ? (partyLedger || billModalParty) : activeVType === 'J' ? (creditLedger || billModalParty) : fromAccount);
          const smartNarration = getSuggestedNarration(activeVType, activeDr, activeCr, allocs, totalAllocated);

          if (smartNarration) {
            setNarration(prev => (!prev || prev.startsWith('Being ') ? smartNarration : prev));
          }
        }}
        onClose={() => {
          setBillModalOpen(false);
          const wasMulti = !!billModalTargetLineId;
          const targetId = billModalTargetLineId;
          setBillModalTargetLineId(null);
          
          setTimeout(() => {
            if (entryMode === 'single') {
              focusElement('v-overall-narration');
            } else if (wasMulti) {
              const idx = lines.findIndex(l => l.id === targetId);
              if (idx < lines.length - 1) {
                focusGridField(idx + 1, 'ledger');
              } else if (!isBalanced) {
                addGridRow();
              } else {
                focusElement('v-overall-narration');
              }
            }
          }, 50);
        }}
      />

      <QuitConfirmModal
        isOpen={showQuitModal}
        viewName="Voucher Entry"
        onConfirm={() => {
          setShowQuitModal(false);
          handleCancelOrResetEntry();
          if (onBack) {
            onBack(true);
          } else {
            window.dispatchEvent(new CustomEvent('app:navigate-back-direct'));
          }
        }}
        onCancel={() => setShowQuitModal(false)}
      />

      {/* Auto & Recurring Vouchers Configuration & Execution Modal */}
      <RecurringVouchersModal
        isOpen={showRecurringModal}
        onClose={() => {
          setShowRecurringModal(false);
          loadRecentVouchers();
        }}
        config={config}
        ledgers={ledgers}
        onDataRefresh={() => {
          onDataRefresh();
          loadRecentVouchers();
        }}
        onOpenVoucherDetail={(vNo) => {
          setShowRecurringModal(false);
          const details = getVoucherDetails(vNo);
          if (details) {
            setViewVoucher(details.header || details);
          }
        }}
      />

      {/* TDS 2% Statutory Details Prompt Modal (Yes / No) */}
      {tdsPromptOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-amber-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 mb-1">
                  Statutory Compliance
                </div>
                <h3 className="text-base font-black text-slate-900">
                  TDS 2% (Liability) Selected
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Do you want to provide statutory <strong>TDS 2% Form IT-7(B)</strong> contractor &amp; bill details for this transaction?
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-950 space-y-1">
              <p className="font-semibold">
                • <strong>Yes (Enter)</strong>: Opens detailed contractor, TPN, invoice &amp; tax deduction form.
              </p>
              <p className="text-slate-600">
                • <strong>No (Esc)</strong>: Continues standard voucher entry without statutory report linkage.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                id="v-prompt-no-btn"
                type="button"
                onClick={() => {
                  setTdsPromptOpen(false);
                  setIsTdsApplicable(false);
                  resumeBackgroundFocus();
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                No, Skip
              </button>
              <button
                id="v-prompt-yes-btn"
                type="button"
                autoFocus
                onClick={() => {
                  setTdsPromptOpen(false);
                  setShowTdsDetailModal(true);
                }}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 ring-2 ring-amber-300"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Provide Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TDS 2% Form IT-7(B) Details Modal */}
      {showTdsDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-amber-300 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    TDS 2% Statutory Details (Form IT-7B)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Department of Revenue &amp; Customs (DRC) Statutory Withholding Tax
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTdsDetailModal(false);
                  resumeBackgroundFocus();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Contractor / Payee Name &amp; Address</label>
                <input
                  type="text"
                  placeholder="e.g. Karma Builders Pvt Ltd, Thimphu"
                  value={tdsContractorNameAndAddress}
                  onChange={e => setTdsContractorNameAndAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tax Payer Number (TPN) / CID</label>
                <input
                  type="text"
                  placeholder="e.g. TPN-1029384 / 1150100..."
                  value={tdsTpn}
                  onChange={e => setTdsTpn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice / Bill Ref No.</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-001"
                  value={tdsInvoiceNo}
                  onChange={e => setTdsInvoiceNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice / Bill Date</label>
                <input
                  type="date"
                  value={tdsInvoiceDate}
                  onChange={e => setTdsInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nature of Work / Supply</label>
                <input
                  type="text"
                  placeholder="e.g. Civil Construction / Renovation Works"
                  value={tdsWorkDescription}
                  onChange={e => setTdsWorkDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Gross Bill Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={tdsBillAmount || ''}
                  onChange={e => {
                    const gross = parseFloat(e.target.value) || 0;
                    setTdsBillAmount(gross);
                    const rate = parseFloat(String(tdsRate)) || 2;
                    setTdsAmount(Math.round((gross * (rate / 100)) * 100) / 100);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-black outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">TDS Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={tdsRate}
                  onChange={e => {
                    const r = parseFloat(e.target.value) || 0;
                    setTdsRate(r);
                    const gross = parseFloat(String(tdsBillAmount)) || 0;
                    setTdsAmount(Math.round((gross * (r / 100)) * 100) / 100);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-black outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">TDS Deducted Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  value={tdsAmount || ''}
                  onChange={e => setTdsAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50/50 px-3 py-2 text-amber-950 font-black outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 font-mono"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="block text-[11px] text-slate-500 font-semibold">Net Payable to Contractor</span>
                  <span className="font-mono font-black text-sm text-emerald-700">
                    {currencySymbol} {((parseFloat(String(tdsBillAmount)) || 0) - (parseFloat(String(tdsAmount)) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Auto-Calculated</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsTdsApplicable(false);
                  setShowTdsDetailModal(false);
                  resumeBackgroundFocus();
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                Clear &amp; Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsTdsApplicable(true);
                  setShowTdsDetailModal(false);
                  resumeBackgroundFocus();
                  showToast('TDS statutory details saved', 'success');
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done &amp; Save Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GST Input Tax Details Prompt Modal (Yes / No) */}
      {gstPromptOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-indigo-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 mb-1">
                  Tax Credit &amp; Reporting
                </div>
                <h3 className="text-base font-black text-slate-900">
                  GST Input Selected
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Do you want to provide <strong>GST Input Tax details</strong> (Supplier GSTIN, Invoice/Customs info, and Taxable Base) for this voucher?
                </p>
              </div>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 text-[11px] text-indigo-950 space-y-1">
              <p className="font-semibold">
                • <strong>Yes (Enter)</strong>: Opens supplier invoice, Bill of Entry, and taxable input calculation.
              </p>
              <p className="text-slate-600">
                • <strong>No (Esc)</strong>: Continues standard voucher entry without input tax schedule tracking.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                id="v-prompt-no-btn"
                type="button"
                onClick={() => {
                  setGstPromptOpen(false);
                  setGstInputType('None');
                  resumeBackgroundFocus();
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                No, Skip
              </button>
              <button
                id="v-prompt-yes-btn"
                type="button"
                autoFocus
                onClick={() => {
                  setGstPromptOpen(false);
                  setShowGstDetailModal(true);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 ring-2 ring-indigo-300"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Provide Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GST Input Tax Details Modal */}
      {showGstDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-indigo-300 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    GST Input Tax Details
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Input Tax Credit &amp; Bhutan GST Purchase / Import Schedule
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGstDetailModal(false);
                  resumeBackgroundFocus();
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Transaction Category</label>
                <select
                  value={gstInputType}
                  onChange={e => setGstInputType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-bold outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Local Purchase">Local Purchase (Domestic Supplier)</option>
                  <option value="Local Expenses">Local Expenses</option>
                  <option value="Bank Charges">Bank Charges &amp; Financial Fees</option>
                  <option value="Import Customs GST Payment">Import Customs GST Payment</option>
                  <option value="Import Purchase">Import Purchase</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier / Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Karma Enterprise"
                  value={supplierName}
                  onChange={e => setSupplierName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier GSTIN / TPN</label>
                <input
                  type="text"
                  placeholder="e.g. 30BBBBB1111B1Z2 / TPN-..."
                  value={supplierGstNo}
                  onChange={e => setSupplierGstNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Invoice No.</label>
                <input
                  type="text"
                  placeholder="e.g. SUP-INV-001"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Supplier Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {(gstInputType === 'Import Customs GST Payment' || gstInputType === 'Import Purchase') && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Customs Declaration / BOE No.</label>
                    <input
                      type="text"
                      placeholder="e.g. DEC-2026-0099"
                      value={declarationNo}
                      onChange={e => setDeclarationNo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Declaration Date</label>
                    <input
                      type="date"
                      value={declarationDate}
                      onChange={e => setDeclarationDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Taxable Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={taxableAmount || ''}
                  onChange={e => {
                    const amt = parseFloat(e.target.value) || 0;
                    setTaxableAmount(amt);
                    if (!gstAmount || Number(gstAmount) === 0) {
                      setGstAmount(Math.round((amt * 0.05) * 100) / 100);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-black outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GST Input Tax Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={gstAmount || ''}
                  onChange={e => setGstAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-indigo-300 bg-indigo-50/50 px-3 py-2 text-indigo-950 font-black outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600">Quick 5% GST Helper:</span>
                <button
                  type="button"
                  onClick={() => {
                    const tax = Number(taxableAmount) || 0;
                    if (tax > 0) {
                      setGstAmount(Math.round((tax * 0.05) * 100) / 100);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold text-[11px] transition shadow-2xs cursor-pointer"
                >
                  Recalculate 5% (Nu. {((Number(taxableAmount) || 0) * 0.05).toFixed(2)})
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setGstInputType('None');
                  setShowGstDetailModal(false);
                  resumeBackgroundFocus();
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
              >
                Clear &amp; Remove
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGstDetailModal(false);
                  resumeBackgroundFocus();
                  showToast('GST Input details saved', 'success');
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done &amp; Save Details</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;
