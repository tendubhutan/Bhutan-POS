import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Config, Item, Ledger } from '../types';
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
  getVoucherDetails
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
  Ban,
  Eye,
  Check,
  Copy,
  MessageSquare
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { SearchableLedgerSelect } from './SearchableLedgerSelect';
import { AcceptModal } from './AcceptModal';
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
import { QuotationEntry } from './vouchers/QuotationEntry';
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
  onOpenNewItemModal?: (onSelect?: (item: Item) => void) => void;
  onNavigateTo?: (view: string) => void;
  initialVoucherTarget?: { voucherNo: string; timestamp: number } | null;
  onDrillVoucher?: (refNo: string) => void;
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
  onDrillVoucher
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

  // Method to load an existing voucher or report record directly into Entry screen
  const loadVoucherIntoEntry = (v: any) => {
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
      v.voucherNo?.startsWith('PS-') ? 'PHYSICAL_STOCK' : ''
    );

    let vType = rawType;
    if (rawType === 'DLV') vType = 'DEL_NOTE';
    if (rawType === 'PHY') vType = 'PHYSICAL_STOCK';
    if (rawType === 'QTN') vType = 'QUOTATION';

    if (['P', 'R', 'J', 'C'].includes(vType)) {
      setMainTab('entry');
      setActiveCategory('financial');
      setActiveVType(vType as any);
      setEditingVoucherNo(v.voucherNo || null);
      setVoucherNo(v.voucherNo || '');
      if (v.date) {
        setDate(new Date(v.date).toISOString().split('T')[0]);
      }
      setNarration(v.narration || '');

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
    } else if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION'].includes(vType)) {
      setMainTab('entry');
      handleVTypeChange(vType as any);
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

  // Listen to incoming initialVoucherTarget from reports or drilldown
  useEffect(() => {
    if (initialVoucherTarget && initialVoucherTarget.voucherNo) {
      const details = getVoucherDetails(initialVoucherTarget.voucherNo);
      if (details) {
        loadVoucherIntoEntry(details.header || details);
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

  // Single mode state
  const [amount, setAmount] = useState<number | ''>('');
  const [partyLedger, setPartyLedger] = useState('');
  const [modeLedger, setModeLedger] = useState('');
  const [debitLedger, setDebitLedger] = useState('');
  const [creditLedger, setCreditLedger] = useState('');
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transactionId, setTransactionId] = useState('');
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
  const [showAcceptModal, setShowAcceptModal] = useState<'save' | 'share' | false>(false);
  const [billModalParty, setBillModalParty] = useState('');
  const [billModalTargetLineId, setBillModalTargetLineId] = useState<string | null>(null);

  const partyOutstandingBills = useMemo(() => {
    if (config.EnableBillWiseDetails === 'false') return [];
    if (!partyLedger || (activeVType !== 'P' && activeVType !== 'R')) return [];
    return getPartyOutstandingBills(partyLedger, activeVType === 'P' ? 'creditor' : 'debtor');
  }, [partyLedger, activeVType, config.EnableBillWiseDetails]);

  const checkAndPromptBankLedger = (ledgerName: string, focusNextElementId?: string) => {
    if (isBankLedger(ledgerName, ledgers, config)) {
      setBankTxnModal({
        isOpen: true,
        bankLedgerName: ledgerName,
        focusNextElementId
      });
    }
  };

  // Multi mode grid state
  const [lines, setLines] = useState<VoucherGridLine[]>([
    { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
    { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
  ]);

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

  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

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

  const currencySymbol = config?.CurrencySymbol || 'Nu.';

  // Refresh recent vouchers list
  const loadRecentVouchers = () => {
    const list = getVouchers();
    setRecentVouchers(list);
  };

  useEffect(() => {
    loadRecentVouchers();
  }, []);

  // Sync initial ledgers into fields
  useEffect(() => {
    // Intentionally left blank to avoid auto-filling ledgers
  }, [ledgers]);

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

    const cashOrBank = ledgers.find(l => l.Group === 'Cash-in-Hand' || l.Group === 'Bank Accounts')?.['Ledger Name'] || 'Cash';
    const expenseOrParty = ledgers.find(l => l.Group === 'Indirect Expenses' || l.Group === 'Sundry Creditors')?.['Ledger Name'] || (ledgers[0]?.['Ledger Name'] || '');
    const incomeOrParty = ledgers.find(l => l.Group === 'Sales Account' || l.Group === 'Sundry Debtors')?.['Ledger Name'] || (ledgers[0]?.['Ledger Name'] || '');

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

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleVoucherBack = () => {
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
    // If inside non-financial sub-vouchers (Quotation, Delivery Note, Credit Note, Debit Note, Physical Stock)
    if (['CN', 'DN', 'DEL_NOTE', 'PHYSICAL_STOCK', 'QUOTATION'].includes(activeVType)) {
      setActiveVType('P');
      setActiveCategory('financial');
      setVoucherTypeHistory(['P']);
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
    // If in entry mode with dirty inputs or draft form
    if (mainTab === 'entry') {
      const isDirty = (Number(amount) > 0) || Boolean(narration.trim()) || (lines.length > 0 && lines.some(l => (Number(l.debit) > 0) || (Number(l.credit) > 0)));
      if (isDirty) {
        setAmount('');
        setNarration('');
        handleVTypeChange(activeVType, false);
        return true;
      }
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
    if (activeVType !== 'P') {
      handleVTypeChange('P', false);
      return true;
    }
    return false;
  };

  // Global Keyboard Shortcuts (F4, F5, F6, F7, F8, F9, F10, F2, Alt+C, Alt+A, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        const handled = handleVoucherBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          return;
        }
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
    const handleBackEvent = (e: CustomEvent) => {
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

      return newLines;
    });
  };

  // Calculations for Multi-Line Grid
  const totalDr = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const difference = Math.abs(totalDr - totalCr);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;

  // Submit Financial Voucher
  const handleSubmit = (e?: React.FormEvent, action: 'save' | 'share' = 'save') => {
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
        isEdit: isEditingThis,
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        narration: narration.trim(),
        totalAmount: totalDr,
        transactionId: transactionId.trim() || undefined,
        bankTxnNo: transactionId.trim() || undefined,
        billAllocations: allBillAllocations.length > 0 ? allBillAllocations : undefined,
        billNo: allBillAllocations.length > 0 ? allBillAllocations.map(b => b.billNo).join(', ') : undefined,
        lines: formattedLines
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
        
        if (action === 'share') {
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
        isEdit: isEditingThis,
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        amount: amt,
        debitLedger: debL,
        creditLedger: credL,
        narration: narration.trim(),
        transactionId: transactionId.trim() || undefined,
        bankTxnNo: transactionId.trim() || undefined,
        billAllocations: billAllocations.length > 0 ? billAllocations : undefined,
        billNo: billAllocations.length > 0 ? billAllocations.map(b => b.billNo).join(', ') : undefined
      };

      const result = saveVoucher(activeVType as any, vPayload);
      if (result.ok) {
        playSaveSound();
        setEditingVoucherNo(null);
        showToast(`Voucher ${result.voucherNo} recorded successfully!`, 'success');
        onDataRefresh();
        loadRecentVouchers();
        setBillAllocations([]);

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
        
        if (action === 'share') {
          setViewVoucher(savedObj);
        }
      } else {
        alert(result.error || 'Failed to save voucher');
      }
    }
  };

  // Helper to Reset / Cancel current voucher entry form
  const handleCancelOrResetEntry = () => {
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
    if (isAutoMode && activeVType && ['P', 'R', 'J', 'C'].includes(activeVType)) {
      setVoucherNo(peekNextVoucherNo(activeVType as any, config));
    }
    showToast('Voucher entry cancelled / reset to blank.', 'success');
  };

  // Preview current voucher entry as printable slip before or after saving
  const handlePreviewSlip = () => {
    let previewVoucherObj: any = null;
    if (entryMode === 'multi') {
      const formattedLines = lines.map(l => ({
        type: l.type,
        ledger: l.ledger,
        amount: l.type === 'Dr' ? Number(l.debit) || 0 : Number(l.credit) || 0,
        narration: l.narration
      }));
      previewVoucherObj = {
        voucherNo: voucherNo.trim() || 'DRAFT-PREVIEW',
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        narration: narration.trim(),
        totalAmount: totalDr || 0,
        amount: totalDr || 0,
        lines: formattedLines,
        status: 'Active'
      };
    } else {
      let debL = '';
      let credL = '';
      if (activeVType === 'P') { debL = partyLedger; credL = modeLedger; }
      else if (activeVType === 'R') { debL = modeLedger; credL = partyLedger; }
      else if (activeVType === 'J') { debL = debitLedger; credL = creditLedger; }
      else if (activeVType === 'C') { debL = toAccount; credL = fromAccount; }

      previewVoucherObj = {
        voucherNo: voucherNo.trim() || 'DRAFT-PREVIEW',
        type: activeVType as 'P' | 'R' | 'J' | 'C',
        date: new Date(date).toISOString(),
        amount: Number(amount) || 0,
        totalAmount: Number(amount) || 0,
        debitLedger: debL,
        creditLedger: credL,
        narration: narration.trim(),
        status: 'Active'
      };
    }
    setViewVoucher(previewVoucherObj);
  };

  // Save and immediately open share dialog
  const handleSaveAndShare = () => {
    handleSubmit(undefined, 'share');
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
          new Date(v.date).toLocaleDateString('en-GB'),
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

      {/* Universal Prominent Dual-Tab Voucher Navigation Header */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left Section: Back Button + Segmented Dual Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateTo && (
            <button
              type="button"
              onClick={() => {
                const handled = handleVoucherBack();
                if (!handled && onNavigateTo) {
                  onNavigateTo('dashboard');
                }
              }}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs border border-slate-300 shadow-2xs transition active:scale-95 cursor-pointer"
              title="Return to Previous Screen"
            >
              <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Back</span>
            </button>
          )}

          {/* DUAL TABS: Voucher Entry vs Voucher Register */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setMainTab('entry')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-black text-xs transition cursor-pointer ${
                mainTab === 'entry'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Voucher Entry</span>
              {activeVType && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    mainTab === 'entry' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {activeVType === 'P'
                    ? 'F5'
                    : activeVType === 'R'
                    ? 'F6'
                    : activeVType === 'J'
                    ? 'F7'
                    : activeVType === 'C'
                    ? 'F4'
                    : activeVType === 'CN'
                    ? 'Credit Note'
                    : activeVType === 'DN'
                    ? 'Debit Note'
                    : activeVType === 'DEL_NOTE'
                    ? 'Delivery'
                    : activeVType}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab('register');
                loadRecentVouchers();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-black text-xs transition cursor-pointer ${
                mainTab === 'register'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Voucher Register</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                  mainTab === 'register' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {recentVouchers.length}
              </span>
            </button>
          </div>
        </div>

        {/* Right Section: Mode Controls & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {mainTab === 'entry' ? (
            <>
              {/* Voucher Type Dropdown */}
              <div className="relative">
                <select
                  value={activeVType}
                  onChange={e => handleVTypeChange(e.target.value as VoucherActionType | '')}
                  className="h-10 rounded-xl border-2 border-indigo-500 bg-indigo-50 pl-3 pr-8 font-black text-indigo-700 text-sm shadow-md outline-none hover:bg-indigo-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 appearance-none cursor-pointer transition-all"
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
                <ChevronDown className="absolute right-2.5 top-3 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
              </div>

              

              {/* Single / Double Mode toggle for financial vouchers */}
              {activeVType && ['P', 'R', 'J', 'C'].includes(activeVType) && (
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEntryMode('single')}
                    className={`rounded-lg px-2.5 py-1 font-bold text-xs transition cursor-pointer ${
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
                    className={`rounded-lg px-2.5 py-1 font-bold text-xs transition cursor-pointer ${
                      entryMode === 'multi'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Double Entry Grid
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMainTab('entry');
                if (!activeVType) handleVTypeChange('P');
              }}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Voucher Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Catalog Modal */}
      <VoucherCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectVoucher={handleVTypeChange}
        activeType={activeVType as VoucherActionType}
      />

      {/* Render Active View: Voucher Register or Voucher Entry Forms */}
      {mainTab === 'register' ? (
        /* Voucher Register / History Table */
        <div className="space-y-4 text-xs">
          {/* Main Filter & Search Control Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Accounting Voucher Register
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Click any row to drill down into voucher details, cancel/void, print, share, or edit.
                  </p>
                </div>
              </div>

              {/* Top Global Register Actions + Stats Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Records:</span>
                  <span className="font-bold text-slate-900 font-mono">{filteredRecent.length}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-1.5">
                  <span className="text-indigo-700 font-semibold">Total:</span>
                  <span className="font-black text-indigo-950 font-mono">
                    {currencySymbol} {totalFilteredAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Print Whole Register */}
                <button
                  type="button"
                  onClick={printWholeRegister}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Print Entire Voucher Register Report (A4 Landscape PDF)"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>Print Register</span>
                </button>

                {/* Share Whole Register */}
                <button
                  type="button"
                  onClick={() => setShowShareRegisterModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Share Whole Voucher Register (WhatsApp, Text, PDF)"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Register</span>
                </button>

                {/* Export to Excel */}
                <button
                  type="button"
                  onClick={exportRegisterToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Export Filtered Voucher Register to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export Excel</span>
                </button>

                {/* Trash Bin */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('app:openTrash'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Open Trash & Recycle Bin"
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                  <span>Trash</span>
                </button>

                {/* Bulk Delete */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('app:openBulkDelete'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Bulk Delete Data (Ctrl+Alt+D)"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  <span>Bulk Delete</span>
                </button>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {/* Date From */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">From Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">To Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Voucher Type */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Voucher Type</label>
                <select
                  value={filterVType}
                  onChange={e => setFilterVType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                >
                  <option value="ALL">All Types</option>
                  <option value="P">Payment (F5)</option>
                  <option value="R">Receipt (F6)</option>
                  <option value="J">Journal (F7)</option>
                  <option value="C">Contra (F4)</option>
                  <option value="CN">Credit Note / Return</option>
                  <option value="DN">Debit Note / Return</option>
                  <option value="DEL_NOTE">Delivery Note</option>
                  <option value="QUOTATION">Quotation</option>
                  <option value="PHYSICAL_STOCK">Physical Stock</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-900 outline-none focus:border-indigo-600"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="CANCELLED">Cancelled (Void) Only</option>
                </select>
              </div>

              {/* Bill / Voucher No Filter */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Voucher / Bill No.</label>
                <input
                  type="text"
                  placeholder="e.g. PV-0001"
                  value={filterBillNo}
                  onChange={e => setFilterBillNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Ledger Name Filter */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Ledger Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bank, Cash, Party..."
                  value={filterLedger}
                  onChange={e => setFilterLedger(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>

              {/* Narration Filter */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 text-[11px]">Narration Keyword</label>
                <input
                  type="text"
                  placeholder="e.g. Rent, Transfer..."
                  value={filterNarration}
                  onChange={e => setFilterNarration(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Quick Action bar & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 font-bold text-[11px] mr-1">Quick Date:</span>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setFilterStartDate(today);
                    setFilterEndDate(today);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const today = now.toISOString().split('T')[0];
                    setFilterStartDate(firstDay);
                    setFilterEndDate(today);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition"
                >
                  All Dates
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(searchTerm || filterStartDate || filterEndDate || filterVType !== 'ALL' || filterStatus !== 'ALL' || filterBillNo || filterLedger || filterNarration) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setFilterVType('ALL');
                      setFilterStatus('ALL');
                      setFilterBillNo('');
                      setFilterLedger('');
                      setFilterNarration('');
                    }}
                    className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs border border-rose-200 transition"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold text-[11px]">
                    <th className="py-2.5 px-3 w-28">Date</th>
                    <th className="py-2.5 px-3 w-32">Voucher No</th>
                    <th className="py-2.5 px-3 w-28">Type</th>
                    <th className="py-2.5 px-3 w-24">Status</th>
                    <th className="py-2.5 px-3">Debit / Particulars</th>
                    <th className="py-2.5 px-3">Credit / Account</th>
                    <th className="py-2.5 px-3">Narration</th>
                    <th className="py-2.5 px-3 text-right w-36">Amount ({currencySymbol})</th>
                    <th className="py-2.5 px-3 text-right w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecent.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-semibold">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        No vouchers match your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecent.map((v: any, idx: number) => {
                      const isCancelled = v.status === 'Cancelled';
                      return (
                        <tr
                          key={v.id ? `v-${v.id}-${idx}` : `v-${v.voucherNo || 'rec'}-${idx}`}
                          onClick={() => handleRowClick(v)}
                          className={`cursor-pointer transition-all duration-150 group border-b border-slate-100/80 ${
                            isCancelled
                              ? 'bg-rose-50/30 hover:bg-rose-100/60'
                              : 'hover:bg-indigo-50/80 hover:shadow-xs'
                          }`}
                          title="Click row to drill down into full voucher details, cancel/void, print, share, or edit"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {new Date(v.date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                            <span className={isCancelled ? 'line-through text-slate-400' : 'group-hover:underline'}>
                              {v.voucherNo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`rounded-md px-2 py-0.5 font-bold text-[10px] ${
                                v.type === 'P'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : v.type === 'R'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : v.type === 'J'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {v.type === 'P'
                                ? 'Payment (F5)'
                                : v.type === 'R'
                                ? 'Receipt (F6)'
                                : v.type === 'J'
                                ? 'Journal (F7)'
                                : v.type === 'C'
                                ? 'Contra (F4)'
                                : v.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isCancelled ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 font-bold text-[10px] text-rose-700"
                                title={v.cancellationReason || 'Voucher has been voided'}
                              >
                                <Ban className="h-3 w-3" />
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-bold text-[10px] text-emerald-700">
                                <Check className="h-3 w-3" />
                                Active
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {v.lines ? (
                              <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                {v.lines.length} Line Split
                              </span>
                            ) : (
                              v.debitLedger
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {v.lines ? 'Multi-account' : v.creditLedger}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate" title={v.narration}>
                            {v.narration || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {isCancelled ? (
                              <span className="text-red-600 font-bold font-mono text-xs">
                                {currencySymbol} 0.00
                              </span>
                            ) : (
                              <span className="text-slate-900 font-mono">
                                {currencySymbol} {(v.totalAmount || v.total || 0).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end text-slate-400 group-hover:text-indigo-600 font-semibold text-[11px] gap-1 transition">
                              <span className="hidden sm:inline opacity-0 group-hover:opacity-100 transition duration-150">
                                View
                              </span>
                              <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition" />
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
        </div>
      ) : activeVType === 'CN' ? (
        <CreditNoteEntry
          config={config}
          items={items}
          ledgers={ledgers}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenQuickLedger={grp => openCreateLedgerModal(undefined, undefined, grp)}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={() => {
            setActiveVType('P');
            setActiveCategory('financial');
          }}
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
          onNavigateBack={() => {
            setActiveVType('P');
            setActiveCategory('financial');
          }}
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
          onNavigateBack={() => {
            setActiveVType('P');
            setActiveCategory('financial');
          }}
        />
      ) : activeVType === 'PHYSICAL_STOCK' ? (
        <PhysicalStockEntry
          config={config}
          items={items}
          onDataRefresh={onDataRefresh}
          initialVoucherTarget={initialVoucherTarget}
          onOpenNewItemModal={onOpenNewItemModal}
          onNavigateBack={() => {
            setActiveVType('P');
            setActiveCategory('financial');
          }}
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
          onNavigateBack={() => {
            setActiveVType('P');
            setActiveCategory('financial');
          }}
        />
      ) : activeVType && ['P', 'R', 'J', 'C'].includes(activeVType) ? (
        /* Financial Vouchers (Payment, Receipt, Journal, Contra) */
        <div className="flex-1 min-h-0 flex flex-col space-y-2">
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

          {/* Form Header Info with Voucher Type selector in 3rd column */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Voucher Number</label>
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
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono font-bold text-slate-900 outline-none text-xs ${
                    (isAutoMode || editingVoucherNo) ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-300 focus:border-indigo-600'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Voucher Date</label>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-0.5 text-[11px]">Voucher Type</label>
                <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 font-extrabold text-indigo-950 flex items-center justify-between text-xs">
                  <span className="truncate">
                    {activeVType === 'P'
                      ? 'Payment Voucher'
                      : activeVType === 'R'
                      ? 'Receipt Voucher'
                      : activeVType === 'J'
                      ? 'Journal Voucher'
                      : activeVType === 'C'
                      ? 'Contra Voucher'
                      : activeVType}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-white px-1.5 py-0.2 rounded border border-indigo-100 text-indigo-600 shrink-0 ml-2">
                    {activeVType === 'P'
                      ? 'F5'
                      : activeVType === 'R'
                      ? 'F6'
                      : activeVType === 'J'
                      ? 'F7'
                      : activeVType === 'C'
                      ? 'F4'
                      : activeVType}
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                                onChange={val => updateGridLine(line.id, 'ledger', val)}
                                onCreateNew={() => openCreateLedgerModal(line.id)}
                                onEnterNext={() => focusGridField(index, line.type === 'Dr' ? 'debit' : 'credit')}
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
                    value={
                      activeVType === 'P' || activeVType === 'R'
                        ? partyLedger
                        : activeVType === 'J'
                        ? debitLedger
                        : toAccount
                    }
                    onChange={val => {
                      if (activeVType === 'P' || activeVType === 'R') {
                        setPartyLedger(val);
                        setBillAllocations([]);
                      }
                      else if (activeVType === 'J') setDebitLedger(val);
                      else setToAccount(val);
                      checkAndPromptBankLedger(val, 'single-ledger-2');
                    }}
                    onCreateNew={() => openCreateLedgerModal(undefined, 'single-1')}
                    onEnterNext={() => focusElement('single-ledger-2')}
                    onArrowRight={() => focusElement('single-ledger-2')}
                    onArrowDown={() => focusElement('single-ledger-2')}
                    placeholder="Select Ledger Account"
                  />

                  {/* Bill-wise Details (Pending Invoices Settlement) Info */}
                  {config.EnableBillWiseDetails !== 'false' && (activeVType === 'P' || activeVType === 'R') && partyLedger && (
                    <div className="mt-1.5 space-y-1">
                      {partyOutstandingBills.length > 0 && (
                        <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-200 rounded-lg px-2.5 py-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span className="text-slate-700 font-medium">
                              {partyOutstandingBills.length} Bill{partyOutstandingBills.length > 1 ? 's' : ''} Due:
                            </span>
                            <span className="font-mono font-bold text-indigo-950">
                              {currencySymbol}{partyOutstandingBills.reduce((s, b) => s + b.pendingAmount, 0).toLocaleString()}
                            </span>
                          </div>
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
                    value={
                      activeVType === 'P' || activeVType === 'R'
                        ? modeLedger
                        : activeVType === 'J'
                        ? creditLedger
                        : fromAccount
                    }
                    onChange={val => {
                      if (activeVType === 'P' || activeVType === 'R') setModeLedger(val);
                      else if (activeVType === 'J') setCreditLedger(val);
                      else setFromAccount(val);
                      checkAndPromptBankLedger(val, 'single-amount');
                    }}
                    onCreateNew={() => openCreateLedgerModal(undefined, 'single-2')}
                    onEnterNext={() => focusElement('single-amount')}
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

          {/* Overall Narration at bottom of voucher entry */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs text-xs shrink-0">
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 text-[11px]">Overall Narration</label>
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
              placeholder="e.g. Paid office rent for the month"
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

          {/* Action Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
            <div className="text-slate-500 font-semibold text-[11px] flex items-center gap-2">
              <span>Shortcuts:</span>
              <span><kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">F2</kbd> Save</span>
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

              {/* Preview & Print Slip */}
              <button
                type="button"
                onClick={handlePreviewSlip}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 px-3.5 py-1.5 font-bold text-slate-700 text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                title="Preview printable voucher slip"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Preview &amp; Print</span>
              </button>

              {/* Save & Share */}
              <button
                type="button"
                onClick={handleSaveAndShare}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-4 py-1.5 font-extrabold text-indigo-700 text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                title="Save voucher and open WhatsApp / PDF Share"
              >
                <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>Save &amp; Share</span>
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
                  {new Date(viewVoucher.date).toLocaleDateString('en-GB')}
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
                <button
                  type="button"
                  onClick={() => {
                    const targetVoucher = viewVoucher;
                    setViewVoucher(null);
                    loadVoucherIntoEntry(targetVoucher);
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
    </div>
  );
};

export default Vouchers;
