import React, { useState, useEffect, useMemo } from 'react';
import { Config, Item, Ledger } from '../types';
import {
  getDailyColumnarReport, getGSTReport, getAdvancedReports, getFinancialReports, getFullLedgerStatement, saveConfig,
  getPartyOutstandingBills, saveVoucher
} from '../services/storageService';
import XLSX from 'xlsx-js-style';
import {
  Printer, Calendar, FileSpreadsheet, Receipt, Package, CircleDollarSign, TrendingUp, Scale, Search, CheckCircle2, AlertCircle, ShieldCheck, Building2, PieChart, Layers, BookOpen, Wallet, CreditCard, ArrowRightLeft, LayoutGrid, ChevronDown, X, SlidersHorizontal, MessageCircle, Mail, FileDown, Share2, ChevronUp, Settings, Check, Columns, FileText, ListFilter, Sparkles, Maximize2, Minimize2, ExternalLink, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { PrintReportModal } from './PrintReportModal';
import { generateReportPDF, shareOrDownloadPDF } from '../utils/pdfExport';
import { TallyPrimeView, ReportDetailDepth } from './TallyPrimeView';
import { BillWiseModal } from './BillWiseModal';

export interface ReportTarget {
  category: 'daily' | 'gst' | 'inv' | 'fin' | 'reg';
  finSubTab?: 'TB' | 'PNL' | 'BS' | 'REC' | 'PAY' | 'LED';
  invSubTab?: 'summary' | 'mov' | 'prof' | 'top' | 'serials';
  ledgerName?: string;
  itemWise?: boolean;
  fromDate?: string;
  toDate?: string;
  openQuickLedgerSearch?: boolean;
  openChangePeriod?: boolean;
  timestamp?: number;
}

interface ReportsProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onBack?: () => void;
  onDrillVoucher: (refNo: string) => void;
  onDrillLedger: (name: string) => void;
  onDrillStock: (code: string) => void;
  onDrillGroup?: (category: string, fromDate?: string, toDate?: string) => void;
  initialReportTarget?: ReportTarget | null;
}

export function parseSmartDate(inputStr: string): string | null {
  if (!inputStr) return null;
  const trimmed = inputStr.trim();
  const currentYear = new Date().getFullYear();

  // If already standard ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle formats like "08-Aug-2026" or "8-Aug-2026"
  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const namedMatch = trimmed.match(/^(\d{1,2})[-/\s]+([a-zA-Z]{3,})[-/\s]*(\d{2,4})?$/);
  if (namedMatch) {
    const d = parseInt(namedMatch[1], 10);
    const mStr = namedMatch[2].toLowerCase().substring(0, 3);
    const m = monthNames[mStr];
    let y = namedMatch[3] ? parseInt(namedMatch[3], 10) : currentYear;
    if (y < 100) y += 2000;
    if (m && d >= 1 && d <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(m)}-${pad(d)}`;
    }
  }

  // Replace dots, slashes, dashes, spaces with /
  const clean = trimmed.replace(/[.\-\s/]+/g, '/');
  const parts = clean.split('/').filter(Boolean);

  let day: number | null = null;
  let month: number | null = null;
  let year: number = currentYear;

  if (parts.length === 1) {
    // e.g. "0808" -> 08 Aug
    if (/^\d{4}$/.test(parts[0])) {
      day = parseInt(parts[0].substring(0, 2), 10);
      month = parseInt(parts[0].substring(2, 4), 10);
    } else if (/^\d{1,2}$/.test(parts[0])) {
      day = parseInt(parts[0], 10);
      month = new Date().getMonth() + 1;
    }
  } else if (parts.length === 2) {
    // "8/8", "8.8", "8-8", "8 8" -> 8th Aug
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (parts.length >= 3) {
    // "8/8/25" or "8.8.2025"
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) {
      y = y + 2000;
    }
    year = y;
  }

  if (day !== null && month !== null && !isNaN(day) && !isNaN(month) && !isNaN(year)) {
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return null;
}

export function formatDisplayDate(isoStr: string): string {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr || '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || 'Jan';
  return `${String(d).padStart(2, '0')}-${monthName}-${y}`;
}

export const Reports: React.FC<ReportsProps> = ({
  config,
  items,
  ledgers,
  onBack,
  onDrillVoucher,
  onDrillLedger,
  onDrillStock,
  onDrillGroup,
  initialReportTarget
}) => {
  const [mainCategory, setMainCategory] = useState<'daily' | 'gst' | 'inv' | 'fin' | 'reg'>('daily');
  const [invSubTab, setInvSubTab] = useState<'summary' | 'mov' | 'prof' | 'top' | 'serials'>('summary');
  const [finSubTab, setFinSubTab] = useState<'TB' | 'PNL' | 'BS' | 'REC' | 'PAY' | 'LED'>('TB');
  const [reportDepth, setReportDepth] = useState<ReportDetailDepth>(config?.ReportDetailDepth || 'detailed');
  const [regSubTab, setRegSubTab] = useState<'sales' | 'purchases'>('sales');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');

  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  const [itemWise, setItemWise] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [gstOnly, setGstOnly] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState('');

  // Change Period Modal state (Alt+F2 / Alt+D)
  const [showChangePeriodModal, setShowChangePeriodModal] = useState(false);
  const [tempFromDate, setTempFromDate] = useState(fromDate);
  const [tempToDate, setTempToDate] = useState(toDate);
  const [fromInputText, setFromInputText] = useState(formatDisplayDate(fromDate));
  const [toInputText, setToInputText] = useState(formatDisplayDate(toDate));
  const periodFromInputRef = React.useRef<HTMLInputElement>(null);
  const periodToInputRef = React.useRef<HTMLInputElement>(null);

  const openChangePeriod = () => {
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    setFromInputText(formatDisplayDate(fromDate));
    setToInputText(formatDisplayDate(toDate));
    setShowChangePeriodModal(true);
    setTimeout(() => {
      periodFromInputRef.current?.focus();
      periodFromInputRef.current?.select();
    }, 60);
  };

  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_fy') => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let startStr = todayStr;
    let endStr = todayStr;

    if (preset === 'today') {
      startStr = formatYMD(now);
      endStr = formatYMD(now);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      startStr = formatYMD(y);
      endStr = formatYMD(y);
    } else if (preset === 'this_week') {
      const curr = new Date(now);
      const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(first));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      startStr = formatYMD(monday);
      endStr = formatYMD(sunday);
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startStr = formatYMD(start);
      endStr = formatYMD(end);
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      startStr = formatYMD(start);
      endStr = formatYMD(end);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      const end = new Date(now.getFullYear(), qMonth + 3, 0);
      startStr = formatYMD(start);
      endStr = formatYMD(end);
    } else if (preset === 'this_fy') {
      // Bhutan Financial Year: January 1 to December 31
      const year = now.getFullYear();
      startStr = `${year}-01-01`;
      endStr = `${year}-12-31`;
    }

    setFromDate(startStr);
    setToDate(endStr);
    setTempFromDate(startStr);
    setTempToDate(endStr);
    setFromInputText(formatDisplayDate(startStr));
    setToInputText(formatDisplayDate(endStr));
  };

  const shiftMonth = (delta: number) => {
    const d1 = new Date(fromDate || todayStr);
    d1.setMonth(d1.getMonth() + delta);
    const startOfMonth = new Date(d1.getFullYear(), d1.getMonth(), 1);
    const endOfMonth = new Date(d1.getFullYear(), d1.getMonth() + 1, 0);

    const formatYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    setFromDate(formatYMD(startOfMonth));
    setToDate(formatYMD(endOfMonth));
  };

  useEffect(() => {
    const handlePeriodEvent = () => openChangePeriod();
    window.addEventListener('app:open-change-period' as any, handlePeriodEvent);
    return () => window.removeEventListener('app:open-change-period' as any, handlePeriodEvent);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (initialReportTarget?.openChangePeriod) {
      openChangePeriod();
    }
  }, [initialReportTarget]);

  // Quick Search Ledger Modal state (Ctrl+L)
  const [showQuickLedgerModal, setShowQuickLedgerModal] = useState(false);
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [focusedLedgerIdx, setFocusedLedgerIdx] = useState(0);
  const quickLedgerInputRef = React.useRef<HTMLInputElement>(null);

  const openLedgerSearch = () => {
    setShowQuickLedgerModal(true);
    setLedgerSearchQuery('');
    setFocusedLedgerIdx(0);
    setTimeout(() => {
      quickLedgerInputRef.current?.focus();
      quickLedgerInputRef.current?.select();
    }, 60);
  };

  useEffect(() => {
    const handleLedgerSearchEvent = () => {
      openLedgerSearch();
    };
    window.addEventListener('app:open-ledger-search' as any, handleLedgerSearchEvent);
    return () => window.removeEventListener('app:open-ledger-search' as any, handleLedgerSearchEvent);
  }, []);

  useEffect(() => {
    if (initialReportTarget?.openQuickLedgerSearch) {
      openLedgerSearch();
    }
  }, [initialReportTarget]);

  const filteredQuickLedgers = useMemo(() => {
    const q = ledgerSearchQuery.trim().toLowerCase();
    if (!q) return ledgers;
    return ledgers.filter(l => {
      const name = (l['Ledger Name'] || '').toLowerCase();
      const grp = (l['Group'] || l['Under Group'] || '').toLowerCase();
      return name.includes(q) || grp.includes(q);
    });
  }, [ledgers, ledgerSearchQuery]);
  const [tbSearch, setTbSearch] = useState('');
  const [tbViewMode, setTbViewMode] = useState<'ledger' | 'group'>('ledger');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPartyFilter, setLedgerPartyFilter] = useState('ALL');
  const [ledgerModeFilter, setLedgerModeFilter] = useState('ALL');
  const [recSearch, setRecSearch] = useState('');
  const [paySearch, setPaySearch] = useState('');
  const [showBillWise, setShowBillWise] = useState<boolean>(false);
  const [dailySearch, setDailySearch] = useState('');
  const [gstSearch, setGstSearch] = useState('');
  const [invSearch, setInvSearch] = useState('');

  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stockFilters, setStockFilters] = useState({ group: 'ALL', category: 'ALL', supplier: '', serial: '', user: '', item: '', status: 'ALL' });
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [showReportCatalog, setShowReportCatalog] = useState(false);

  const showGst = String(config.EnableGST) !== 'false';

  const allReportsList = useMemo(() => [
    { cat: 'daily', itemWise: false, label: 'Daily Sales (Bill-wise)' },
    { cat: 'daily', itemWise: true, label: 'Daily Sales (Item-wise)' },
    ...(showGst ? [{ cat: 'gst', label: 'GST Summary Report' }] : []),
    { cat: 'inv', invSub: 'summary', label: 'Stock Summary & Valuation' },
    { cat: 'inv', invSub: 'mov', label: 'Stock Movement (In / Out)' },
    { cat: 'inv', invSub: 'prof', label: 'Item Profitability' },
    { cat: 'inv', invSub: 'top', label: 'Top 15 Sellers' },
    { cat: 'fin', finSub: 'TB', label: 'Trial Balance' },
    { cat: 'fin', finSub: 'PNL', label: 'Profit & Loss Account' },
    { cat: 'fin', finSub: 'BS', label: 'Balance Sheet' },
    { cat: 'fin', finSub: 'REC', label: 'Receivables (Debtors)' },
    { cat: 'fin', finSub: 'PAY', label: 'Payables (Creditors)' },
    { cat: 'fin', finSub: 'LED', label: 'Ledger Statement' }
  ], [showGst]);

  const handleReportsBack = () => {
    if (showChangePeriodModal) {
      setShowChangePeriodModal(false);
      return true;
    }
    if (showQuickLedgerModal) {
      setShowQuickLedgerModal(false);
      return true;
    }
    // If a drill modal or floating dialog is active, do not hijack the back/escape action
    if (document.querySelector('[data-drill-modal="true"]')) {
      return false;
    }
    if (isPrintModalOpen) {
      setIsPrintModalOpen(false);
      return true;
    }
    if (showReportCatalog) {
      setShowReportCatalog(false);
      return true;
    }
    return false;
  };

  // Keyboard navigation and shortcuts (Escape, Ctrl+L, Alt+F2, Alt+Left / Alt+Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct Alt+F2 or Alt+D shortcut for Change Period anywhere in Reports
      if (e.altKey && (e.key === 'F2' || e.code === 'F2' || e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        e.stopPropagation();
        openChangePeriod();
        return;
      }

      // Direct Ctrl+L shortcut for opening Quick Ledger Search anywhere in Reports
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L' || e.code === 'KeyL')) {
        e.preventDefault();
        e.stopPropagation();
        openLedgerSearch();
        return;
      }

      if (e.key === 'Escape') { if (e.defaultPrevented) return;
        const handled = handleReportsBack();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          return;
        }
      }

      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInputFocused && !e.altKey) {
        return;
      }

      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const currentIdx = allReportsList.findIndex(r => {
          if (r.cat === 'daily') return mainCategory === 'daily' && itemWise === r.itemWise;
          if (r.cat === 'gst') return mainCategory === 'gst';
          if (r.cat === 'inv') return mainCategory === 'inv' && invSubTab === r.invSub;
          if (r.cat === 'fin') return mainCategory === 'fin' && finSubTab === r.finSub;
          return false;
        });

        if (currentIdx === -1) return;
        const nextIdx = e.key === 'ArrowRight'
          ? (currentIdx + 1) % allReportsList.length
          : (currentIdx - 1 + allReportsList.length) % allReportsList.length;

        const target = allReportsList[nextIdx];
        setMainCategory(target.cat as any);
        if (target.cat === 'daily') setItemWise(target.itemWise || false);
        if (target.invSub) setInvSubTab(target.invSub as any);
        if (target.finSub) setFinSubTab(target.finSub as any);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allReportsList, mainCategory, itemWise, invSubTab, finSubTab, isPrintModalOpen, showReportCatalog]);

  // Intercept app:back event from Header/App navigation
  useEffect(() => {
    const handleBackEvent = (e: CustomEvent) => {
      const handled = handleReportsBack();
      if (handled) {
        e.preventDefault();
      }
    };
    window.addEventListener('app:back' as any, handleBackEvent);
    return () => window.removeEventListener('app:back' as any, handleBackEvent);
  }, [isPrintModalOpen, showReportCatalog, mainCategory]);

  // React to initial or keyboard shortcut triggered targets
  useEffect(() => {
    if (initialReportTarget) {
      setMainCategory(initialReportTarget.category || 'daily');
      if (initialReportTarget.finSubTab) {
        setFinSubTab(initialReportTarget.finSubTab);
      }
      if (initialReportTarget.invSubTab) {
        setInvSubTab(initialReportTarget.invSubTab);
      }
      if (initialReportTarget.ledgerName) {
        setSelectedLedger(initialReportTarget.ledgerName);
      }
      if (typeof initialReportTarget.itemWise === 'boolean') {
        setItemWise(initialReportTarget.itemWise);
      }
      if (initialReportTarget.fromDate) {
        setFromDate(initialReportTarget.fromDate);
      }
      if (initialReportTarget.toDate) {
        setToDate(initialReportTarget.toDate);
      }
      setShowReportCatalog(false);
    } else {
      setMainCategory('daily');
    }
  }, [initialReportTarget]);

  const formatDateStr = (d: any) => {
    if (!d) return '-';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString();
  };

  const fmt = (v: any) => (Number(v) || 0).toFixed(2);

  useEffect(() => {
    runReport();
  }, [mainCategory, invSubTab, finSubTab, regSubTab, fromDate, toDate, itemWise, gstOnly, selectedLedger]);

  const runReport = () => {
    setLoading(true);
    try {
      if (mainCategory === 'daily') {
        const data = getDailyColumnarReport(fromDate, toDate, { itemWise, gstOnly });
        setReportData(data);
      } else if (mainCategory === 'gst') {
        const data = getGSTReport(fromDate, toDate);
        setReportData(data);
      } else if (mainCategory === 'inv') {
        const data = getAdvancedReports(invSubTab, fromDate, toDate);
        setReportData(data);
      } else if (mainCategory === 'reg') {
        const data = getAdvancedReports(regSubTab, fromDate, toDate);
        setReportData(data);
      } else if (mainCategory === 'fin') {
        if (finSubTab === 'LED') {
          let activeLedger = selectedLedger;
          if (!activeLedger && ledgers.length > 0) {
            const defaultLedger = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === 'cash')?.['Ledger Name']
              || ledgers.find(l => (l.Group || '').toLowerCase() === 'cash-in-hand')?.['Ledger Name']
              || ledgers[0]['Ledger Name'];
            activeLedger = defaultLedger;
            setSelectedLedger(defaultLedger);
          }
          if (activeLedger) {
            const data = getFullLedgerStatement(activeLedger, fromDate, toDate);
            setReportData(data);
          }
        } else {
          const data = getFinancialReports(finSubTab, fromDate, toDate);
          setReportData(data);
        }
      }
    } catch (err) {
      console.error('Report execution error:', err);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  const getReportDataExportPayload = () => {
    if (!reportData) return null;

    let reportTitle = '';
    let headers: string[] = [];
    let rows: any[][] = [];
    let totalsRow: any[] | null = null;
    let summaryCards: { label: string; value: string | number }[] = [];

    if (mainCategory === 'daily') {
      if (reportData.mode === 'itemwise') {
        reportTitle = 'Daily Sales Itemwise Breakdown';
        headers = ['Item Name', 'Qty Sold', 'Taxable (Nu.)', 'GST (Nu.)', 'Total Sales (Nu.)'];
        (reportData.rows || []).forEach((r: any) => {
          rows.push([r.itemName, Number(r.qty) || 0, fmt(r.taxable), fmt(r.gst), fmt(r.total)]);
        });
        if (reportData.totals) {
          totalsRow = ['TOTAL', Number(reportData.totals.qty) || 0, fmt(reportData.totals.taxable), fmt(reportData.totals.gst), fmt(reportData.totals.total)];
          summaryCards = [
            { label: 'Total Items Sold', value: reportData.totals.qty || 0 },
            { label: 'Total Revenue', value: `Nu. ${fmt(reportData.totals.total)}` }
          ];
        }
      } else {
        reportTitle = 'Daily Sales Columnar Statement';
        headers = ['Date', 'Invoice No', 'Customer', 'Cash (Nu.)', `${config.Bank1Ledger || 'Bank 1'} (Nu.)`, `${config.Bank2Ledger || 'Bank 2'} (Nu.)`, 'Credit (Nu.)', 'Total (Nu.)'];
        (reportData.rows || []).forEach((r: any) => {
          rows.push([formatDateStr(r.date), r.invoiceNo, typeof r.customer === 'object' ? (r.customer.name || r.customer.ledger || 'Cash Customer') : r.customer, fmt(r.cash), fmt(r.bank1), fmt(r.bank2), fmt(r.credit), fmt(r.total)]);
        });
        if (reportData.totals) {
          totalsRow = ['TOTAL SUMMARY', '', '', fmt(reportData.totals.cash), fmt(reportData.totals.bank1), fmt(reportData.totals.bank2), fmt(reportData.totals.credit), fmt(reportData.totals.total)];
          summaryCards = [
            { label: 'Total Invoices', value: reportData.rows?.length || 0 },
            { label: 'Cash Collection', value: `Nu. ${fmt(reportData.totals.cash)}` },
            { label: 'Net Sales Revenue', value: `Nu. ${fmt(reportData.totals.total)}` }
          ];
        }
      }
    } else if (mainCategory === 'gst') {
      reportTitle = 'GST Summary Statement';
      headers = ['Bill Date', 'Customer Name', 'GSTIN', 'Bill No', 'Taxable (Nu.)', 'Zero-Rated (Nu.)', 'GST Amount (Nu.)', 'Total Bill (Nu.)'];
      (reportData.rows || []).forEach((r: any) => {
        rows.push([formatDateStr(r.billDate), r.customerName, r.customerGST || '-', r.billNumber, fmt(r.taxable), fmt(r.zeroRated), fmt(r.gstAmount), fmt(r.total)]);
      });
      if (reportData.totals) {
        totalsRow = ['TOTAL', '', '', '', fmt(reportData.totals.taxable), fmt(reportData.totals.zeroRated), fmt(reportData.totals.gstAmount), fmt(reportData.totals.total)];
        summaryCards = [
          { label: 'Taxable Amount', value: `Nu. ${fmt(reportData.totals.taxable)}` },
          { label: 'GST Collected', value: `Nu. ${fmt(reportData.totals.gstAmount)}` },
          { label: 'Total Gross Sales', value: `Nu. ${fmt(reportData.totals.total)}` }
        ];
      }
    } else if (mainCategory === 'inv') {
      if (invSubTab === 'summary' && Array.isArray(reportData)) {
        reportTitle = 'Stock Summary & Valuation Report';
        headers = ['Item Name', 'Group', 'Unit', 'Current Stock', 'Sale Rate (Nu.)', 'Stock Valuation (Nu.)'];
        let totalStock = 0;
        let totalValuation = 0;
        let filteredCount = 0;
        reportData.filter((i: any) => {
          if (stockFilters.group !== 'ALL' && i.group !== stockFilters.group) return false;
          if (stockFilters.category !== 'ALL' && i.category !== stockFilters.category) return false;
          if (stockFilters.item && stockFilters.item !== 'ALL' && !i.itemName?.toLowerCase().includes(stockFilters.item.toLowerCase())) return false;
          
          const itemStr = JSON.stringify(i).toLowerCase();
          if (stockFilters.supplier && !itemStr.includes(stockFilters.supplier.toLowerCase())) return false;
          if (stockFilters.serial && !itemStr.includes(stockFilters.serial.toLowerCase())) return false;
          if (stockFilters.user && !itemStr.includes(stockFilters.user.toLowerCase())) return false;
          
          return true;
        }).forEach((i: any) => {
          const val = (Number(i.currentStock) || 0) * (Number(i.purchaseRate) || 0);
          totalStock += Number(i.currentStock) || 0;
          totalValuation += val;
          filteredCount++;
          rows.push([i.itemName, i.group, i.unit, Number(i.currentStock) || 0, fmt(i.saleRate), fmt(val)]);
        });
        totalsRow = ['TOTAL', '', '', totalStock, '', fmt(totalValuation)];
        summaryCards = [
          { label: 'Total Items', value: filteredCount },
          { label: 'Total Stock Quantity', value: totalStock },
          { label: 'Stock Valuation', value: `Nu. ${fmt(totalValuation)}` }
        ];
      } else if (invSubTab === 'mov' && reportData?.movement) {
        reportTitle = 'Stock Movement Statement';
        headers = ['Item Name', 'Item Code', 'Group', 'Opening Qty', 'Qty In', 'Qty Out', 'Closing Qty'];
        let totOp = 0;
        let totIn = 0;
        let totOut = 0;
        let totCl = 0;
        reportData.movement.forEach((m: any) => {
          if (stockFilters.group !== 'ALL' && m.group && m.group !== stockFilters.group) return;
          if (stockFilters.category !== 'ALL' && m.category && m.category !== stockFilters.category) return;
          if (stockFilters.item && stockFilters.item !== 'ALL' && !m.name?.toLowerCase().includes(stockFilters.item.toLowerCase())) return;
          const op = Number(m.opQty) || 0;
          const inQ = Number(m.inQty) || 0;
          const outQ = Number(m.outQty) || 0;
          const cl = Number(m.clQty) || 0;
          totOp += op;
          totIn += inQ;
          totOut += outQ;
          totCl += cl;
          rows.push([m.name, m.code, m.group || '', op, inQ, outQ, cl]);
        });
        totalsRow = ['TOTAL', '', '', totOp, totIn, totOut, totCl];
        summaryCards = [
          { label: 'Total Opening Qty', value: totOp },
          { label: 'Total Inward Qty', value: `+${totIn}` },
          { label: 'Total Outward Qty', value: `-${totOut}` },
          { label: 'Total Closing Qty', value: totCl }
        ];
      } else if (invSubTab === 'prof' && reportData?.profit) {
        reportTitle = 'Item Profitability Analysis';
        headers = ['Item Name', 'Qty Sold', 'Sales Revenue (Nu.)', 'Cost Amount (Nu.)', 'Gross Profit (Nu.)'];
        let totSales = 0;
        let totCost = 0;
        let totProfit = 0;
        reportData.profit.forEach((p: any) => {
          totSales += Number(p.saleAmt) || 0;
          totCost += Number(p.costAmt) || 0;
          totProfit += Number(p.profit) || 0;
          rows.push([p.name, Number(p.qty) || 0, fmt(p.saleAmt), fmt(p.costAmt), fmt(p.profit)]);
        });
        totalsRow = ['TOTAL', '', fmt(totSales), fmt(totCost), fmt(totProfit)];
        summaryCards = [
          { label: 'Total Sales Revenue', value: `Nu. ${fmt(totSales)}` },
          { label: 'Total Gross Profit', value: `Nu. ${fmt(totProfit)}` }
        ];
      } else if (invSubTab === 'top' && reportData?.topQty) {
        reportTitle = 'Top Sellers Report';
        headers = ['Top Seller (Quantity)', 'Qty Sold', 'Top Seller (Revenue)', 'Revenue (Nu.)'];
        const maxLen = Math.max(reportData.topQty?.length || 0, reportData.topAmt?.length || 0);
        for (let i = 0; i < maxLen; i++) {
          const q = reportData.topQty[i];
          const a = reportData.topAmt[i];
          rows.push([
            q ? q.name : '',
            q ? Number(q.qty) || 0 : '',
            a ? a.name : '',
            a ? fmt(a.saleAmt) : ''
          ]);
        }
      } else if (invSubTab === 'serials' && Array.isArray(reportData)) {
        reportTitle = 'Serial Number Stock Status Report';
        headers = ['Serial Number', 'Item Code', 'Item Name', 'Group / Brand', 'Status', 'Acquisition Date / Ref', 'Sale Date / Ref'];
        reportData.filter((s: any) => {
          if (stockFilters.group !== 'ALL' && s.group !== stockFilters.group) return false;
          if (stockFilters.category !== 'ALL' && s.category !== stockFilters.category) return false;
                    if (stockFilters.status !== 'ALL' && s.status !== stockFilters.status) return false;
                    if (stockFilters.item && stockFilters.item !== 'ALL' && s.itemName !== stockFilters.item) return false;
          if (!stockFilters.serial) return true;
          const q = stockFilters.serial.toLowerCase();
          return (
            s.serialNo.toLowerCase().includes(q) ||
            s.itemName.toLowerCase().includes(q) ||
            s.itemCode.toLowerCase().includes(q)
          );
        }).forEach((s: any) => {
          rows.push([
            s.serialNo,
            s.itemCode,
            s.itemName,
            `${s.group || '-'} / ${s.category || '-'}`,
            s.status,
            `${s.date} (${s.refNo})`,
            s.soldDate ? `${s.soldDate} (${s.soldRefNo})` : '-'
          ]);
        });
        summaryCards = [
          { label: 'Total Serials', value: reportData.length }
        ];
      }
    } else if (mainCategory === 'fin') {
      const detailDepth = config?.ReportDetailDepth || 'detailed';

      if (finSubTab === 'TB' && reportData?.tb) {
        let totDr = 0;
        let totCr = 0;
        reportData.tb.forEach((l: any) => {
          totDr += Number(l.dr) || 0;
          totCr += Number(l.cr) || 0;
        });
        const diff = Math.abs(totDr - totCr);

        if (detailDepth === 'summary') {
          reportTitle = 'Trial Balance Statement (Grouped Summary)';
          headers = ['Primary Account Group', 'Nature', 'Debit Amount (Dr) (Nu.)', 'Credit Amount (Cr) (Nu.)'];
          const grpMap: Record<string, { nat: string; dr: number; cr: number }> = {};
          reportData.tb.forEach((l: any) => {
            const g = l.grp || 'Unassigned';
            if (!grpMap[g]) grpMap[g] = { nat: l.nat || '-', dr: 0, cr: 0 };
            grpMap[g].dr += Number(l.dr) || 0;
            grpMap[g].cr += Number(l.cr) || 0;
          });
          Object.entries(grpMap).forEach(([grp, val]) => {
            rows.push([grp, val.nat, val.dr ? fmt(val.dr) : '', val.cr ? fmt(val.cr) : '']);
          });
        } else {
          const isSuper = detailDepth === 'super_detailed';
          reportTitle = `Trial Balance Statement (${isSuper ? 'Super Detailed Master View' : 'Detailed Group View'})`;
          headers = ['Particulars (Group / Master Ledger)', 'Opening Dr/Cr', 'Period Dr (Nu.)', 'Period Cr (Nu.)', 'Closing Dr (Nu.)', 'Closing Cr (Nu.)'];

          const grpMap: Record<string, any[]> = {};
          reportData.tb.forEach((l: any) => {
            const g = l.grp || 'Unassigned';
            if (!grpMap[g]) grpMap[g] = [];
            grpMap[g].push(l);
          });

          Object.entries(grpMap).forEach(([grpName, ledgersInGrp]) => {
            let gOpDr = 0, gOpCr = 0, gPeriodDr = 0, gPeriodCr = 0, gDr = 0, gCr = 0;
            ledgersInGrp.forEach((l: any) => {
              gOpDr += l.opDr || 0;
              gOpCr += l.opCr || 0;
              gPeriodDr += l.periodDr || 0;
              gPeriodCr += l.periodCr || 0;
              gDr += l.dr || 0;
              gCr += l.cr || 0;
            });

            const opStr = gOpDr > 0 ? `${fmt(gOpDr)} Dr` : gOpCr > 0 ? `${fmt(gOpCr)} Cr` : '-';
            rows.push([grpName.toUpperCase(), opStr, fmt(gPeriodDr), fmt(gPeriodCr), gDr ? fmt(gDr) : '', gCr ? fmt(gCr) : '']);

            if (isSuper) {
              ledgersInGrp.forEach((l: any) => {
                const lOpStr = (l.opDr || 0) > 0 ? `${fmt(l.opDr)} Dr` : (l.opCr || 0) > 0 ? `${fmt(l.opCr)} Cr` : '-';
                rows.push([`   • ${l.name}`, lOpStr, fmt(l.periodDr), fmt(l.periodCr), l.dr ? fmt(l.dr) : '', l.cr ? fmt(l.cr) : '']);
              });
            }
          });
        }

        totalsRow = ['TOTAL TRIAL BALANCE', '', '', fmt(totDr), fmt(totCr)];
        summaryCards = [
          { label: 'Total Debits (Dr)', value: `Nu. ${fmt(totDr)}` },
          { label: 'Total Credits (Cr)', value: `Nu. ${fmt(totCr)}` },
          { label: 'Balance Status', value: diff < 0.01 ? 'Balanced (Dr = Cr)' : `Unbalanced Diff: Nu. ${fmt(diff)}` }
        ];
      } else if (finSubTab === 'PNL' && reportData?.pnl) {
        const p = reportData.pnl;
        const s = Number(p.s) || 0;
        const di = Number(p.di) || 0;
        const os = Number(p.os) || 0;
        const pur = Number(p.p) || 0;
        const de = Number(p.de) || 0;
        const cs = Number(p.cs) || 0;
        const ii = Number(p.ii) || 0;
        const ie = Number(p.ie) || 0;

        const cogs = os + pur + de - cs;
        const grossProfit = s + di - cogs;
        const netProfit = grossProfit + ii - ie;

        const rawTb = reportData.tb || [];
        const getPnlAmt = (l: any, isIncome: boolean) => {
          const pDr = Number(l.pDr) || 0;
          const pCr = Number(l.pCr) || 0;
          if (pDr > 0 || pCr > 0) {
            return isIncome ? Math.abs(pCr - pDr) : Math.max(0, pDr - pCr);
          }
          return isIncome ? Math.abs((Number(l.cr) || 0) - (Number(l.dr) || 0)) : Math.max(0, (Number(l.dr) || 0) - (Number(l.cr) || 0));
        };
        const filterPnlLedgers = (ledgers: any[], isIncome: boolean) => {
          const mapped = ledgers.map(l => ({ ...l, amount: getPnlAmt(l, isIncome) }));
          return mapped.filter(l => l.amount > 0);
        };

        const salesLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Sales')), true);
        const purchLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Purchase')), false);
        const directExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Direct Expense')), false);
        const indirectExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Expense')), false);
        const indirectIncLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Income')), true);

        const leftTrading: { label: string; amt: string }[] = [];
        const rightTrading: { label: string; amt: string }[] = [];

        leftTrading.push({ label: 'Opening Stock', amt: fmt(os) });
        leftTrading.push({ label: 'Purchase Accounts', amt: fmt(pur) });
        purchLedgers.forEach(l => leftTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
        if (de > 0) {
          leftTrading.push({ label: 'Direct Expenses', amt: fmt(de) });
          directExpLedgers.forEach(l => leftTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
        }
        if (grossProfit >= 0) {
          leftTrading.push({ label: 'Gross Profit c/o', amt: fmt(grossProfit) });
        }

        rightTrading.push({ label: 'Sales Accounts', amt: fmt(s) });
        salesLedgers.forEach(l => rightTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
        if (di > 0) rightTrading.push({ label: 'Direct Incomes', amt: fmt(di) });
        rightTrading.push({ label: 'Closing Stock Valuation', amt: fmt(cs) });
        if (grossProfit < 0) {
          rightTrading.push({ label: 'Gross Loss c/o', amt: fmt(Math.abs(grossProfit)) });
        }

        const totalTradingLeft = os + pur + de + Math.max(0, grossProfit);
        const totalTradingRight = s + di + cs + (grossProfit < 0 ? Math.abs(grossProfit) : 0);

        const leftPnl: { label: string; amt: string }[] = [];
        const rightPnl: { label: string; amt: string }[] = [];

        if (grossProfit < 0) leftPnl.push({ label: 'Gross Loss b/f', amt: fmt(Math.abs(grossProfit)) });
        leftPnl.push({ label: 'Indirect Expenses', amt: fmt(ie) });
        indirectExpLedgers.forEach(l => leftPnl.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
        if (netProfit >= 0) leftPnl.push({ label: 'Nett Profit', amt: fmt(netProfit) });

        if (grossProfit >= 0) rightPnl.push({ label: 'Gross Profit b/f', amt: fmt(grossProfit) });
        if (ii > 0) {
          rightPnl.push({ label: 'Indirect Incomes', amt: fmt(ii) });
          indirectIncLedgers.forEach(l => rightPnl.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
        }
        if (netProfit < 0) rightPnl.push({ label: 'Nett Loss', amt: fmt(Math.abs(netProfit)) });

        const totalPnlLeft = ie + (grossProfit < 0 ? Math.abs(grossProfit) : 0) + Math.max(0, netProfit);
        const totalPnlRight = Math.max(0, grossProfit) + ii + (netProfit < 0 ? Math.abs(netProfit) : 0);

        reportTitle = 'Profit & Loss Statement';
        headers = ['Particulars', 'Amount (Nu.)', 'Particulars', 'Amount (Nu.)'];

        rows = [
          ['TRADING ACCOUNT', '', '', ''],
          ...Array.from({ length: Math.max(leftTrading.length, rightTrading.length) }).map((_, i) => [
            leftTrading[i]?.label || '',
            leftTrading[i]?.amt || '',
            rightTrading[i]?.label || '',
            rightTrading[i]?.amt || ''
          ]),
          ['TOTAL', fmt(totalTradingLeft), 'TOTAL', fmt(totalTradingRight)],
          ['', '', '', ''],
          ['PROFIT & LOSS ACCOUNT', '', '', ''],
          ...Array.from({ length: Math.max(leftPnl.length, rightPnl.length) }).map((_, i) => [
            leftPnl[i]?.label || '',
            leftPnl[i]?.amt || '',
            rightPnl[i]?.label || '',
            rightPnl[i]?.amt || ''
          ])
        ];

        totalsRow = ['TOTAL', fmt(totalPnlLeft), 'TOTAL', fmt(totalPnlRight)];
        summaryCards = [
          { label: 'Gross Profit', value: `Nu. ${fmt(grossProfit)}` },
          { label: 'Net Profit / (Loss)', value: `Nu. ${fmt(netProfit)}` }
        ];
      } else if (finSubTab === 'BS' && reportData?.bs && reportData?.pnl) {
        const p = reportData.pnl;
        const s = Number(p.s) || 0;
        const di = Number(p.di) || 0;
        const os = Number(p.os) || 0;
        const pur = Number(p.p) || 0;
        const de = Number(p.de) || 0;
        const cs = Number(p.cs) || 0;
        const ii = Number(p.ii) || 0;
        const ie = Number(p.ie) || 0;
        const cogs = os + pur + de - cs;
        const grossProfit = s + di - cogs;
        const netProfit = grossProfit + ii - ie;

        const cap = Number(reportData.bs.cap) || 0;
        const loans = Number(reportData.bs.ln) || 0;
        const cl = Number(reportData.bs.cl) || 0;
        const fa = Number(reportData.bs.fa) || 0;
        const ca = Number(reportData.bs.ca) || 0;
        const stockVal = Number(reportData.bs.cs) || 0;

        const rawTb = reportData.tb || [];
        const capitalLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Capital'));
        const loanLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Loan'));
        const currentLiabLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Liabilit') || (l.grp || '').includes('Creditor') || (l.grp || '').includes('Dut'));
        const fixedAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Fixed Asset'));
        const currentAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Current Asset') || (l.grp || '').includes('Debtor') || (l.grp || '').includes('Bank') || (l.grp || '').includes('Cash'));

        const totalLiab = cap + netProfit + loans + cl;
        const totalAssets = fa + ca + stockVal;

        const leftBs: { label: string; amt: string }[] = [];
        const rightBs: { label: string; amt: string }[] = [];

        leftBs.push({ label: 'Capital Account', amt: fmt(cap) });
        capitalLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));
        leftBs.push({ label: '  Add: Nett Profit / (Loss)', amt: fmt(netProfit) });

        if (loans > 0) {
          leftBs.push({ label: 'Loans (Liability)', amt: fmt(loans) });
          loanLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));
        }

        leftBs.push({ label: 'Current Liabilities & Payables', amt: fmt(cl) });
        currentLiabLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));

        rightBs.push({ label: 'Fixed Assets', amt: fmt(fa) });
        fixedAssetLedgers.forEach(l => rightBs.push({ label: `  ${l.name}`, amt: fmt(l.dr || l.cr) }));

        rightBs.push({ label: 'Current Assets', amt: fmt(ca) });
        currentAssetLedgers.forEach(l => rightBs.push({ label: `  ${l.name}`, amt: fmt(l.dr || l.cr) }));

        rightBs.push({ label: 'Closing Stock Valuation', amt: fmt(stockVal) });

        reportTitle = 'Balance Sheet Statement';
        headers = ['L I A B I L I T I E S', 'Amount (Nu.)', 'A S S E T S', 'Amount (Nu.)'];

        rows = Array.from({ length: Math.max(leftBs.length, rightBs.length) }).map((_, i) => [
          leftBs[i]?.label || '',
          leftBs[i]?.amt || '',
          rightBs[i]?.label || '',
          rightBs[i]?.amt || ''
        ]);

        totalsRow = ['TOTAL LIABILITIES', fmt(totalLiab), 'TOTAL ASSETS', fmt(totalAssets)];
        summaryCards = [
          { label: 'Total Owner Equity', value: `Nu. ${fmt(cap + netProfit)}` },
          { label: 'Total Assets', value: `Nu. ${fmt(totalAssets)}` },
          { label: 'Total Liabilities', value: `Nu. ${fmt(totalLiab)}` }
        ];
      } else if (finSubTab === 'REC' && reportData?.rec) {
        reportTitle = 'Outstanding Receivables Report';
        headers = ['Debtor / Customer Ledger Name', 'Outstanding Receivable (Nu.)'];
        let tot = 0;
        reportData.rec.forEach((r: any) => {
          tot += Number(r.amt) || 0;
          rows.push([r.name, fmt(r.amt)]);
        });
        totalsRow = ['TOTAL OUTSTANDING RECEIVABLES', fmt(tot)];
        summaryCards = [
          { label: 'Total Debtors', value: reportData.rec.length },
          { label: 'Total Outstanding Receivable', value: `Nu. ${fmt(tot)}` }
        ];
      } else if (finSubTab === 'PAY' && reportData?.pay) {
        reportTitle = 'Outstanding Payables Report';
        headers = ['Creditor / Supplier Ledger Name', 'Outstanding Payable (Nu.)'];
        let tot = 0;
        reportData.pay.forEach((p: any) => {
          tot += Number(p.amt) || 0;
          rows.push([p.name, fmt(p.amt)]);
        });
        totalsRow = ['TOTAL OUTSTANDING PAYABLES', fmt(tot)];
        summaryCards = [
          { label: 'Total Creditors', value: reportData.pay.length },
          { label: 'Total Outstanding Payable', value: `Nu. ${fmt(tot)}` }
        ];
      } else if (finSubTab === 'LED' && reportData?.rows) {
        reportTitle = `Ledger Statement - ${selectedLedger}`;
        headers = ['Date', 'Type', 'Ref No', 'Narration', 'Debit (Nu.)', 'Credit (Nu.)', 'Running Balance'];
        let initialBalStr = '';
        let totDr = 0;
        let totCr = 0;
        let curBal = 0;
        reportData.rows.forEach((r: any, idx: number) => {
          if (idx === 0) {
            initialBalStr = r['Running Balance'] || '-';
            curBal = r.Balance || 0;
          }
          const dr = Number(r.Debit) || 0;
          const cr = Number(r.Credit) || 0;
          totDr += dr;
          totCr += cr;
          curBal = curBal + dr - cr;
          const runningBalStr = curBal >= 0 ? `${fmt(curBal)} Dr` : `${fmt(Math.abs(curBal))} Cr`;
          rows.push([
            formatDateStr(r.DateIso),
            r.Type || '-',
            r['Ref No'] || '-',
            r.Narration || '-',
            dr ? fmt(dr) : '',
            cr ? fmt(cr) : '',
            runningBalStr
          ]);
        });
        const finalBalStr = curBal >= 0 ? `${fmt(curBal)} Dr` : `${fmt(Math.abs(curBal))} Cr`;
        totalsRow = ['TOTAL MOVEMENT & CLOSING BALANCE', '', '', '', fmt(totDr), fmt(totCr), finalBalStr];
        summaryCards = [
          { label: 'Opening Balance', value: initialBalStr },
          { label: 'Total Debits (Dr)', value: `Nu. ${fmt(totDr)}` },
          { label: 'Total Credits (Cr)', value: `Nu. ${fmt(totCr)}` },
          { label: 'Closing Balance', value: finalBalStr }
        ];
      }
    } else if (mainCategory === 'reg') {
      if (regSubTab === 'sales' && Array.isArray(reportData)) {
        reportTitle = 'Sales Register';
        headers = ['Date', 'Invoice No', 'Customer', 'Payment Mode', 'Total Amount (Nu.)'];
        let totAmount = 0;
        reportData.forEach((inv: any) => {
          const amt = Number(inv.totalAmount) || 0;
          totAmount += amt;
          let paymentStr = [];
          if (inv.payment?.cash > 0) paymentStr.push('Cash');
          if (inv.payment?.bank1 > 0) paymentStr.push('Bank1');
          if (inv.payment?.bank2 > 0) paymentStr.push('Bank2');
          rows.push([
            formatDateStr(inv.date),
            inv.invoiceNo || '-',
            inv.customer?.name || 'CASH',
            paymentStr.join(', ') || '-',
            fmt(amt)
          ]);
        });
        totalsRow = ['TOTAL', '', '', '', fmt(totAmount)];
        summaryCards = [
          { label: 'Total Invoices', value: reportData.length },
          { label: 'Total Sales Revenue', value: `Nu. ${fmt(totAmount)}` }
        ];
      } else if (regSubTab === 'purchases' && Array.isArray(reportData)) {
        reportTitle = 'Purchase Register';
        headers = ['Date', 'Bill No', 'Supplier', 'Payment Mode', 'Total Amount (Nu.)'];
        let totAmount = 0;
        reportData.forEach((inv: any) => {
          const amt = Number(inv.totalAmount) || 0;
          totAmount += amt;
          let paymentStr = [];
          if (inv.payment?.cash > 0) paymentStr.push('Cash');
          if (inv.payment?.bank1 > 0) paymentStr.push('Bank1');
          if (inv.payment?.bank2 > 0) paymentStr.push('Bank2');
          rows.push([
            formatDateStr(inv.date),
            inv.supplierBillNo || inv.billNo || '-',
            inv.supplier?.name || 'Supplier',
            paymentStr.join(', ') || '-',
            fmt(amt)
          ]);
        });
        totalsRow = ['TOTAL', '', '', '', fmt(totAmount)];
        summaryCards = [
          { label: 'Total Bills', value: reportData.length },
          { label: 'Total Purchase Amount', value: `Nu. ${fmt(totAmount)}` }
        ];
      }
    }

    return { reportTitle, headers, rows, totalsRow, summaryCards };
  };

  const exportToExcel = () => {
    const payload = getReportDataExportPayload();
    if (!payload || !payload.headers.length) return;

    try {
      const { reportTitle, headers, rows, totalsRow } = payload;
      const aoa: any[][] = [
        [config.CompanyName || 'Business Store'],
        [reportTitle],
        [`Period: ${fromDate} to ${toDate}`],
        [],
        headers,
        ...rows
      ];
      if (totalsRow) aoa.push(totalsRow);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Company Name Style (Row 0)
      const companyRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (ws[companyRef]) {
        ws[companyRef].s = {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: '1E1B4B' } },
          alignment: { vertical: 'center' }
        };
      }

      // Report Title Style (Row 1)
      const titleRef = XLSX.utils.encode_cell({ r: 1, c: 0 });
      if (ws[titleRef]) {
        ws[titleRef].s = {
          font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: '3730A3' } },
          alignment: { vertical: 'center' }
        };
      }

      // Date Period Style (Row 2)
      const periodRef = XLSX.utils.encode_cell({ r: 2, c: 0 });
      if (ws[periodRef]) {
        ws[periodRef].s = {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '64748B' } },
          alignment: { vertical: 'center' }
        };
      }

      // Header Row Style (Row 4) - BOLD HEADERS, DARK SLATE BACKGROUND, WHITE TEXT
      const headerRowIdx = 4;
      headers.forEach((_, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E293B' } },
            alignment: { vertical: 'center', horizontal: colIdx === 0 ? 'left' : 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: '0F172A' } },
              bottom: { style: 'medium', color: { rgb: '0F172A' } },
              left: { style: 'thin', color: { rgb: '475569' } },
              right: { style: 'thin', color: { rgb: '475569' } }
            }
          };
        }
      });

      // Data Rows Style
      const startDataRowIdx = 5;
      rows.forEach((row, rIdx) => {
        const rowIdx = startDataRowIdx + rIdx;
        const isEven = rIdx % 2 === 0;
        const firstVal = String(row[0] || '').trim();
        const isBannerRow = firstVal === 'TRADING ACCOUNT' || firstVal === 'PROFIT & LOSS ACCOUNT';
        const isTotalRow = firstVal === 'TOTAL' || firstVal === 'TOTAL LIABILITIES' || firstVal === 'TOTAL ASSETS';

        row.forEach((val, cIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: cIdx });
          if (!ws[cellRef]) return;

          const strVal = String(val || '');
          const isNum = typeof val === 'number' || (!isNaN(Number(val)) && String(val).includes('.') && !isNaN(parseFloat(val)));
          const isSub = strVal.startsWith('  ');
          const isProfit = strVal.includes('Gross Profit') || strVal.includes('Nett Profit') || strVal.includes('Gross Loss') || strVal.includes('Nett Loss');

          if (isBannerRow) {
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '3730A3' } },
              fill: { fgColor: { rgb: 'E0E7FF' } },
              alignment: { vertical: 'center', horizontal: 'left' },
              border: {
                top: { style: 'thin', color: { rgb: 'A5B4FC' } },
                bottom: { style: 'thin', color: { rgb: 'A5B4FC' } }
              }
            };
          } else if (isTotalRow) {
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
              fill: { fgColor: { rgb: 'F1F5F9' } },
              alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
              border: {
                top: { style: 'thin', color: { rgb: '0F172A' } },
                bottom: { style: 'double', color: { rgb: '0F172A' } }
              }
            };
          } else {
            let textColor = '0F172A';
            if (isProfit) textColor = '166534';
            else if (isSub) textColor = '475569';

            ws[cellRef].s = {
              font: { name: 'Calibri', sz: isSub ? 10 : 10.5, italic: isSub, bold: !isSub || isProfit, color: { rgb: textColor } },
              fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F8FAFC' } },
              alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
              border: {
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'F1F5F9' } },
                right: { style: 'thin', color: { rgb: 'F1F5F9' } }
              }
            };
          }
        });
      });

      // Totals Row Style (if present)
      if (totalsRow) {
        const totalsRowIdx = startDataRowIdx + rows.length;
        totalsRow.forEach((val, cIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c: cIdx });
          if (ws[cellRef]) {
            const isNum = typeof val === 'number' || (!isNaN(Number(val)) && String(val).includes('.') && !isNaN(parseFloat(val)));
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
              fill: { fgColor: { rgb: 'F1F5F9' } },
              alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' },
              border: {
                top: { style: 'thin', color: { rgb: '0F172A' } },
                bottom: { style: 'double', color: { rgb: '0F172A' } }
              }
            };
          }
        });
      }

      // Auto-calculate generous column widths with extra padding/margin (+8 chars margin)
      const colWidths: { wch: number }[] = headers.map(() => ({ wch: 20 }));
      aoa.forEach(row => {
        row.forEach((val, colIdx) => {
          const strLen = val !== null && val !== undefined ? String(val).length : 0;
          if (!colWidths[colIdx] || strLen > colWidths[colIdx].wch) {
            colWidths[colIdx] = { wch: Math.min(Math.max(strLen + 8, 20), 65) };
          }
        });
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      const safeTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `${(config.CompanyName || 'Store').replace(/\s+/g, '_')}_${safeTitle}_${fromDate}.xlsx`);
    } catch (err) {
      console.error('Failed to export to excel:', err);
    }
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const generateReportSummaryText = () => {
    const p = getReportDataExportPayload();
    if (!p) return '';
    const nowStr = new Date().toLocaleString();
    const lines = [
      `📊 *${p.reportTitle.toUpperCase()}*`,
      `🏢 *${config.CompanyName || 'Store'}*`,
      `📅 Period: ${fromDate} to ${toDate}`,
      `⏰ Generated: ${nowStr}`,
      '--------------------------------',
      ...(p.summaryCards && p.summaryCards.length > 0
        ? [
            '*KEY METRICS:*',
            ...p.summaryCards.map(c => `• ${c.label}: *${c.value}*`),
            '--------------------------------'
          ]
        : []),
      `*TOTAL RECORDS:* ${p.rows.length}`,
      ...(p.totalsRow && p.totalsRow.length > 0
        ? [
            '*TOTALS SUMMARY:*',
            ...p.totalsRow
              .map((t, i) => (t !== undefined && t !== null && String(t).trim() !== '' ? `• ${p.headers[i] || 'Total'}: *${t}*` : ''))
              .filter(Boolean),
            '--------------------------------'
          ]
        : []),
      `Generated by ${config.CompanyName || 'Smart POS System'}`
    ];
    return lines.join('\n');
  };

  const handleDirectWhatsApp = () => {
    const text = generateReportSummaryText();
    if (!text) return;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDirectEmail = () => {
    const p = getReportDataExportPayload();
    const text = generateReportSummaryText();
    if (!text || !p) return;
    const subject = encodeURIComponent(`${p.reportTitle} (${fromDate} - ${toDate}) - ${config.CompanyName || 'Store'}`);
    const body = encodeURIComponent(text);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDirectDownloadPDF = () => {
    const p = getReportDataExportPayload();
    if (!p) return;
    const isFin = mainCategory === 'fin' && (finSubTab === 'TB' || finSubTab === 'PNL' || finSubTab === 'BS');
    const doc = generateReportPDF(
      p.reportTitle,
      config,
      fromDate,
      toDate,
      p.headers,
      p.rows,
      p.totalsRow,
      p.summaryCards,
      isFin ? (finSubTab as 'TB' | 'PNL' | 'BS') : undefined,
      reportData,
      config?.ReportDetailDepth || 'detailed'
    );
    const safeTitle = p.reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`${safeTitle}_${fromDate}_to_${toDate}.pdf`);
  };

  const handleDirectSharePDF = async () => {
    const p = getReportDataExportPayload();
    if (!p) return;
    const isFin = mainCategory === 'fin' && (finSubTab === 'TB' || finSubTab === 'PNL' || finSubTab === 'BS');
    const doc = generateReportPDF(
      p.reportTitle,
      config,
      fromDate,
      toDate,
      p.headers,
      p.rows,
      p.totalsRow,
      p.summaryCards,
      isFin ? (finSubTab as 'TB' | 'PNL' | 'BS') : undefined,
      reportData,
      config?.ReportDetailDepth || 'detailed'
    );
    const safeTitle = p.reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeTitle}_${fromDate}_to_${toDate}.pdf`;
    await shareOrDownloadPDF(doc, filename, `${p.reportTitle} - ${config.CompanyName || 'Store'}`, generateReportSummaryText());
  };

  // Keyboard shortcut: Ctrl+P on Reports page triggers clean Report Print
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        setIsPrintModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDepthChange = (depth: ReportDetailDepth) => {
    setReportDepth(depth);
    if (config) {
      saveConfig({ ...config, ReportDetailDepth: depth });
    }
  };

  const currentPayload = getReportDataExportPayload();

  return (
    <div className="space-y-4 p-3 sm:p-6 pb-6 lg:pb-8">
      {/* Print Preview Modal */}
      {currentPayload && (
        <PrintReportModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          config={config}
          reportTitle={currentPayload.reportTitle}
          fromDate={fromDate}
          toDate={toDate}
          headers={currentPayload.headers}
          rows={currentPayload.rows}
          totals={currentPayload.totalsRow || undefined}
          summaryCards={currentPayload.summaryCards}
          reportType={mainCategory === 'fin' && (finSubTab === 'TB' || finSubTab === 'PNL' || finSubTab === 'BS') ? (finSubTab as 'TB' | 'PNL' | 'BS') : undefined}
          reportData={reportData}
          depth={reportDepth}
        />
      )}

      {/* Controls Toggle Button when collapsed */}
      {isControlsCollapsed && (
        <div className="flex justify-end mb-2">
          <button 
            onClick={() => setIsControlsCollapsed(false)}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <span>Show Report Filters & Controls</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`space-y-4 transition-all duration-300 ${isControlsCollapsed ? 'hidden' : 'block'}`}>
        {/* Universal Compact Report Navigation & Filter Bar */}

      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left Section: Back Button, Report Switcher & Direct Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                const backEvent = new CustomEvent('app:back', { cancelable: true });
                window.dispatchEvent(backEvent);
              }
            }}
            className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-500 px-2.5 py-1.5 rounded-xl text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
            title="Go Back to Dashboard (Esc)"
          >
            <ChevronLeft className="h-4 w-4 stroke-[3]" />
            <span>Back</span>
          </button>

          <button
            onClick={() => setShowReportCatalog(!showReportCatalog)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-bold transition shadow-2xs ${
              showReportCatalog
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
            }`}
            title="Browse full catalog of report categories and options"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">All Reports</span>
          </button>

          {/* Direct Dropdown Switcher */}
          <div className="relative">
            <select
              value={
                mainCategory === 'daily' ? (itemWise ? 'daily-item' : 'daily-bill') :
                mainCategory === 'gst' ? 'gst' :
                mainCategory === 'inv' ? `inv-${invSubTab}` :
                `fin-${finSubTab}`
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'daily-bill') {
                  setMainCategory('daily');
                  setItemWise(false);
                } else if (val === 'daily-item') {
                  setMainCategory('daily');
                  setItemWise(true);
                } else if (val === 'gst') {
                  setMainCategory('gst');
                } else if (val.startsWith('inv-')) {
                  setMainCategory('inv');
                  setInvSubTab(val.replace('inv-', '') as any);
                } else if (val.startsWith('fin-')) {
                  setMainCategory('fin');
                  setFinSubTab(val.replace('fin-', '') as any);
                }
                setShowReportCatalog(false);
              }}
              className="h-8 rounded-xl border border-indigo-200 bg-indigo-50/70 pl-2.5 pr-8 font-extrabold text-indigo-900 text-xs shadow-2xs outline-none hover:bg-indigo-100/70 focus:border-indigo-600 appearance-none cursor-pointer"
            >
              <optgroup label="Sales & Billing">
                <option value="daily-bill">Daily Sales (Bill-wise)</option>
                <option value="daily-item">Daily Sales (Item-wise)</option>
              </optgroup>
              {showGst && (
                <optgroup label="GST & Taxation">
                  <option value="gst">GST Summary Report</option>
                </optgroup>
              )}
              <optgroup label="Inventory & Stock">
                <option value="inv-summary">Stock Summary & Valuation</option>
                <option value="inv-mov">Stock Movement (In / Out)</option>
                <option value="inv-prof">Item Profitability</option>
                <option value="inv-top">Top 15 Sellers</option>
                <option value="inv-serials">Serial Number Stock Report</option>
              </optgroup>
              <optgroup label="Financial Accounts">
                <option value="fin-LED">Ledger Statement (Ctrl+L)</option>
                <option value="fin-TB">Trial Balance</option>
                <option value="fin-PNL">Profit & Loss Account</option>
                <option value="fin-BS">Balance Sheet</option>
                <option value="fin-REC">Receivables (Debtors)</option>
                <option value="fin-PAY">Payables (Creditors)</option>
              </optgroup>
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-indigo-600 pointer-events-none" />
          </div>

          {/* Contextual Filter for Ledger Statement */}
          {mainCategory === 'fin' && finSubTab === 'LED' && (() => {
            const uniqueParties = reportData?.rows ? Array.from(new Set(reportData.rows.map((r: any) => r.Party).filter(Boolean))).sort() : [];
            return (
              <div className="flex items-center gap-1.5 pl-1">
                <span className="font-semibold text-slate-500 text-[11px] whitespace-nowrap">Ledger:</span>
                <button
                  type="button"
                  onClick={openLedgerSearch}
                  className="h-8 rounded-xl border border-indigo-300 bg-indigo-50/90 hover:bg-indigo-100 px-2.5 font-bold text-xs text-indigo-950 flex items-center gap-1.5 transition-all shadow-2xs max-w-[180px] sm:max-w-[220px] truncate cursor-pointer"
                  title="Click or press Ctrl+L to type and search ledger"
                >
                  <Search className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">{selectedLedger || 'Type / Search Ledger'}</span>
                  <kbd className="hidden sm:inline-block text-[9px] bg-white border border-indigo-200 text-indigo-700 px-1 py-0.2 rounded font-mono font-bold shrink-0">Ctrl+L</kbd>
                </button>

                <select
                  value={selectedLedger || ''}
                  onChange={e => setSelectedLedger(e.target.value)}
                  className="h-8 rounded-xl border border-slate-300 bg-white px-2 font-bold text-xs text-slate-800 outline-none w-[110px] sm:w-[150px] truncate"
                >
                  <option value="">Select Ledger</option>
                  {ledgers.map(l => (
                    <option key={l['Ledger Name']} value={l['Ledger Name']}>
                      {l['Ledger Name']}
                    </option>
                  ))}
                </select>

                {uniqueParties.length > 0 && (
                  <select
                    value={ledgerPartyFilter || 'ALL'}
                    onChange={(e) => setLedgerPartyFilter(e.target.value)}
                    className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[110px] sm:w-[140px] truncate"
                  >
                    <option value="ALL">All Parties</option>
                    {(uniqueParties as string[]).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}

                <div className="relative w-[130px] sm:w-[160px]">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    value={ledgerSearch || ''}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-8 rounded-xl border border-slate-300 bg-white pl-7 pr-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>
            );
          })()}

          {/* Contextual Filter for Daily Sales */}
          {mainCategory === 'daily' && (
            <div className="flex items-center gap-2 pl-1">
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={itemWise}
                  onChange={e => setItemWise(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Item-wise
              </label>
              {showGst && (
                <label className="flex items-center gap-1 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={gstOnly}
                    onChange={e => setGstOnly(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  GST Only
                </label>
              )}
            </div>
          )}

          {mainCategory === 'fin' && (finSubTab === 'TB' || finSubTab === 'PNL' || finSubTab === 'BS') && (
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 shadow-inner">
              <button
                onClick={() => handleDepthChange('summary')}
                className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  reportDepth === 'summary' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <ListFilter className="h-3 w-3" />
                <span className="hidden sm:inline">Summary</span>
              </button>
              <button
                onClick={() => handleDepthChange('detailed')}
                className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  reportDepth === 'detailed' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Layers className="h-3 w-3" />
                <span className="hidden sm:inline">Detailed</span>
              </button>
              <button
                onClick={() => handleDepthChange('super_detailed')}
                className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  reportDepth === 'super_detailed' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Maximize2 className="h-3 w-3" />
                <span className="hidden sm:inline">Super Detailed</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Date Controls & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Month Step Buttons */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="px-1.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition text-xs font-bold flex items-center gap-0.5 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[10px]">Prev Mth</span>
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="px-1.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition text-xs font-bold flex items-center gap-0.5 cursor-pointer"
              title="Next Month"
            >
              <span className="hidden xl:inline text-[10px]">Next Mth</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 text-[11px]">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 px-2 font-medium outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 text-[11px]">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-8 rounded-xl border border-slate-300 px-2 font-medium outline-none text-xs"
            />
          </div>

          {/* Quick Presets Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                applyPreset(e.target.value as any);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="h-8 rounded-xl border border-indigo-200 bg-indigo-50/80 px-2 font-bold text-xs text-indigo-900 outline-none cursor-pointer hover:bg-indigo-100 transition"
            title="Quick Date Range Presets"
          >
            <option value="" disabled>Presets ▾</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_fy">Financial Year (FY)</option>
          </select>

          {/* Change Period Button (Alt+F2) */}
          <button
            onClick={openChangePeriod}
            className="h-8 inline-flex items-center gap-1 rounded-xl border border-indigo-300 bg-indigo-600 px-2.5 font-bold text-xs text-white hover:bg-indigo-700 transition shadow-2xs cursor-pointer"
            title="Change Date Period (Alt+F2 / Alt+D)"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-100" />
            <span>Period</span>
            <kbd className="hidden sm:inline-block text-[9px] bg-indigo-800/80 border border-indigo-400 text-indigo-100 px-1 py-0.2 rounded font-mono font-bold">Alt+F2</kbd>
          </button>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
            <button
              onClick={handleDirectSharePDF}
              className="inline-flex items-center gap-1 rounded-xl border border-violet-300 bg-violet-50 px-2.5 py-1.5 font-bold text-violet-800 hover:bg-violet-100 transition shadow-2xs"
              title="Share PDF file directly via device share (WhatsApp / Email attachment)"
            >
              <Share2 className="h-3.5 w-3.5 text-violet-600" />
              <span>Share PDF</span>
            </button>
            <button
              onClick={handleDirectDownloadPDF}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 font-bold text-white hover:bg-slate-900 transition shadow-2xs"
              title="Save report as PDF file"
            >
              <FileDown className="h-3.5 w-3.5 text-slate-200" />
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
              title="Print Clean Report Document (Ctrl+P)"
            >
              <Printer className="h-3.5 w-3.5 text-indigo-600" />
              <span>Print</span>
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              title="Export to Excel Spreadsheet"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-slate-600" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Report Catalog Overview (Only when 'All Reports' is toggled) */}
      {showReportCatalog && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4 shadow-md space-y-3 animate-in fade-in duration-150 text-xs">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-indigo-600" />
              <span className="font-bold text-slate-900 text-sm">Select Report to View in Full Page</span>
            </div>
            <button
              onClick={() => setShowReportCatalog(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition"
              title="Close report catalog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Daily Sales Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <Receipt className="h-4 w-4 text-indigo-600" />
                <span>Daily Sales</span>
              </div>
              <p className="text-[11px] text-slate-500">Day-wise columnar billing and item-wise sales analysis.</p>
              <div className="flex flex-col gap-1 pt-1">
                <button
                  onClick={() => {
                    setMainCategory('daily');
                    setItemWise(false);
                    setShowReportCatalog(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition ${mainCategory === 'daily' && !itemWise ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}`}
                >
                  Bill-wise Columnar Sales
                </button>
                <button
                  onClick={() => {
                    setMainCategory('daily');
                    setItemWise(true);
                    setShowReportCatalog(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition ${mainCategory === 'daily' && itemWise ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}`}
                >
                  Item-wise Sales Breakdown
                </button>
              </div>
            </div>

            {/* GST Card */}
            {showGst && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                  <CircleDollarSign className="h-4 w-4 text-indigo-600" />
                  <span>GST & Tax</span>
                </div>
                <p className="text-[11px] text-slate-500">Taxable amounts, GST tax collected, zero-rated summaries.</p>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setMainCategory('gst');
                      setShowReportCatalog(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition ${mainCategory === 'gst' ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}`}
                  >
                    GST Invoices & Summary
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <Package className="h-4 w-4 text-indigo-600" />
                <span>Inventory Reports</span>
              </div>
              <p className="text-[11px] text-slate-500">Stock balances, valuations, movements, and top sellers.</p>
              <div className="flex flex-col gap-1 pt-1">
                {[
                  { id: 'summary', label: 'Stock Summary & Valuation' },
                  { id: 'mov', label: 'Stock Movement (In/Out)' },
                  { id: 'prof', label: 'Item Profitability' },
                  { id: 'top', label: 'Top 15 Sellers' },
                  { id: 'serials', label: 'Serial Number Stock Status' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setMainCategory('inv');
                      setInvSubTab(tab.id as any);
                      setShowReportCatalog(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-left transition ${mainCategory === 'inv' && invSubTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financials Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Financial Accounts</span>
              </div>
              <p className="text-[11px] text-slate-500">Ledger statements, Trial balance, P&L, Balance sheet, Debtors/Creditors.</p>
              <div className="flex flex-col gap-1 pt-1">
                {[
                  { id: 'LED', label: 'Ledger Statement (Ctrl+L)' },
                  { id: 'TB', label: 'Trial Balance' },
                  { id: 'PNL', label: 'Profit & Loss Account' },
                  { id: 'BS', label: 'Balance Sheet' },
                  { id: 'REC', label: 'Receivables (Debtors)' },
                  { id: 'PAY', label: 'Payables (Creditors)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setMainCategory('fin');
                      setFinSubTab(tab.id as any);
                      setShowReportCatalog(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-left transition ${mainCategory === 'fin' && finSubTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      
      </div>
      
      {/* Report Container */}

      <div className="bg-white border-y border-slate-200 shadow-xs -mx-3 sm:-mx-6 mb-[-1.5rem] lg:mb-[-2rem]">
        {!isControlsCollapsed && (
          <div className="px-4 sm:px-6 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
            <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
              <span>Report View</span>
            </h2>
            <button 
                onClick={() => setIsControlsCollapsed(true)}
                className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 uppercase tracking-wide flex items-center gap-1 bg-white border border-slate-300 px-2 py-1 rounded shadow-sm hover:bg-slate-50 transition-colors"
            >
                <span>Collapse Filters & Expand Table</span>
                <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="p-0">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading report data...</div>
        ) : !reportData ? (
          <div className="py-12 text-center text-slate-400">No data available for selected criteria</div>
        ) : (
          <div className="border-t border-slate-200">
            {/* Daily Sales */}
            {mainCategory === 'daily' && (
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                    {reportData.mode === 'itemwise' ? (
                      <>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Qty Sold</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Taxable</th>
                        {showGst && <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">GST</th>}
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Total</th>
                      </>
                    ) : (
                      <>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Date</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Invoice No</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Customer</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Cash</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">{config.Bank1Ledger || 'Bank 1'}</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">{config.Bank2Ledger || 'Bank 2'}</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Credit</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Total Amount</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.mode === 'itemwise'
                    ? (reportData.rows || []).map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-semibold text-slate-800 text-left">{r.itemName}</td>
                          <td className="py-2 px-3 text-center font-mono">{r.qty}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(r.taxable)}</td>
                          {showGst && <td className="py-2 px-3 text-right font-mono">{fmt(r.gst)}</td>}
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">{fmt(r.total)}</td>
                        </tr>
                      ))
                    : (reportData.rows || []).map((r: any, idx: number) => (
                        <tr
                          key={idx}
                          onClick={() => onDrillVoucher(r.invoiceNo)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-2 px-3 text-center font-mono text-slate-500">{formatDateStr(r.date)}</td>
                          <td className="py-2 px-3 font-bold text-indigo-600 text-left">{r.invoiceNo}</td>
                          <td className="py-2 px-3 font-medium text-slate-800 text-left">
                            {(() => {
                              const cName = typeof r.customer === 'object' ? (r.customer.name || r.customer.ledger || 'Cash Customer') : r.customer;
                              if (r.isCancelled && typeof cName === 'string' && cName.includes(' (Cancelled)')) {
                                return (
                                  <>
                                    {cName.replace(' (Cancelled)', '')}
                                    <span className="text-red-500 font-bold ml-1 text-[10px]">(Cancelled)</span>
                                  </>
                                );
                              }
                              return cName;
                            })()}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.cash)}</td>
                          <td className="py-2 px-3 text-right font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.bank1)}</td>
                          <td className="py-2 px-3 text-right font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.bank2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-600">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.credit)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.total)}</td>
                        </tr>
                      ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                  <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900 text-xs">
                    {reportData.mode === 'itemwise' ? (
                      <>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-left">TOTAL</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-center font-mono">{reportData.totals?.qty || 0}</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.taxable)}</td>
                        {showGst && <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.gst)}</td>}
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.total)}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={3} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left">TOTAL SUMMARY</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.cash)}</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.bank1)}</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.bank2)}</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.credit)}</td>
                        <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-sm">{fmt(reportData.totals?.total)}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            )}

            {/* GST Report */}
            {mainCategory === 'gst' && (
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Date</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Customer</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">GSTIN</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Bill No</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Taxable Amount</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Zero-Rated</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">GST Amount</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.rows || []).map((r: any, idx: number) => (
                    <tr key={idx} onClick={() => onDrillVoucher(r.billNumber)} className="hover:bg-slate-50 cursor-pointer transition">
                      <td className="py-2 px-3 text-center font-mono">{formatDateStr(r.billDate)}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {r.isCancelled && typeof r.customerName === 'string' && r.customerName.includes(' (Cancelled)') ? (
                          <>
                            {r.customerName.replace(' (Cancelled)', '')}
                            <span className="text-red-500 font-bold ml-1 text-[10px]">(Cancelled)</span>
                          </>
                        ) : r.customerName}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.customerGST || '-'}</td>
                      <td className="py-2 px-3 font-bold text-indigo-600">{r.billNumber}</td>
                      <td className="py-2 px-3 text-right font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.taxable)}</td>
                      <td className="py-2 px-3 text-right font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.zeroRated)}</td>
                      <td className="py-2 px-3 text-right font-mono text-indigo-700">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.gstAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold font-mono">{r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                  <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                    <td colSpan={4} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left">TOTAL</td>
                    <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.taxable)}</td>
                    <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.zeroRated)}</td>
                    <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono">{fmt(reportData.totals?.gstAmount)}</td>
                    <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-sm">{fmt(reportData.totals?.total)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Inventory Reports */}
            {mainCategory === 'inv' && (
              <div>
                {invSubTab === 'summary' && Array.isArray(reportData) && (
                  <div className="flex flex-col">
                    <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search Itemwise..."
                          value={stockFilters.item || ''}
                          onChange={e => setStockFilters({ ...stockFilters, item: e.target.value })}
                          className="bg-transparent text-xs w-full focus:outline-none"
                        />
                      </div>
                      <select
                        value={stockFilters.group || 'ALL'}
                        onChange={e => setStockFilters({ ...stockFilters, group: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2"
                      >
                        <option value="ALL">All Groups</option>
                        {Array.from(new Set(reportData.map((d:any) => d.group).filter(Boolean))).sort().map((g:any) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <select
                        value={stockFilters.category || 'ALL'}
                        onChange={e => setStockFilters({ ...stockFilters, category: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2"
                      >
                        <option value="ALL">All Categories</option>
                        {Array.from(new Set(reportData.map((d:any) => d.category).filter(Boolean))).sort().map((c:any) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Supplier..."
                        value={stockFilters.supplier || ''}
                        onChange={e => setStockFilters({ ...stockFilters, supplier: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2 w-24"
                      />
                      <input
                        type="text"
                        placeholder="Serial No..."
                        value={stockFilters.serial || ''}
                        onChange={e => setStockFilters({ ...stockFilters, serial: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2 w-24"
                      />
                      <input
                        type="text"
                        placeholder="User..."
                        value={stockFilters.user || ''}
                        onChange={e => setStockFilters({ ...stockFilters, user: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2 w-20"
                      />
                    </div>
                  <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                    <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                      <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Group</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Unit</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Current Stock</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Sale Rate</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Stock Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.filter((i: any) => {
                        if (stockFilters.group !== 'ALL' && i.group !== stockFilters.group) return false;
                        if (stockFilters.category !== 'ALL' && i.category !== stockFilters.category) return false;
                        if (stockFilters.item && stockFilters.item !== 'ALL' && !i.itemName?.toLowerCase().includes(stockFilters.item.toLowerCase())) return false;
                        
                        const itemStr = JSON.stringify(i).toLowerCase();
                        if (stockFilters.supplier && !itemStr.includes(stockFilters.supplier.toLowerCase())) return false;
                        if (stockFilters.serial && !itemStr.includes(stockFilters.serial.toLowerCase())) return false;
                        if (stockFilters.user && !itemStr.includes(stockFilters.user.toLowerCase())) return false;
                        
                        return true;
                      }).map((i: any) => (
                        <tr
                          key={i.itemCode}
                          onClick={() => onDrillStock(i.itemCode)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-2 px-3 font-semibold text-slate-800">{i.itemName}</td>
                          <td className="py-2 px-3 text-slate-600">{i.group}</td>
                          <td className="py-2 px-3 text-center">{i.unit}</td>
                          <td className="py-2 px-3 text-right font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                i.currentStock <= i.reorderLevel ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {i.currentStock}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(i.saleRate)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {fmt(i.currentStock * i.purchaseRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}

                {invSubTab === 'mov' && reportData?.movement && (() => {
                  const filteredMovement = reportData.movement.filter((m: any) => {
                    if (stockFilters.group !== 'ALL' && m.group && m.group !== stockFilters.group) return false;
                    if (stockFilters.category !== 'ALL' && m.category && m.category !== stockFilters.category) return false;
                    if (stockFilters.item && stockFilters.item !== 'ALL' && !m.name?.toLowerCase().includes(stockFilters.item.toLowerCase())) return false;
                    if (stockFilters.serial) {
                      const q = stockFilters.serial.toLowerCase();
                      if (!m.name?.toLowerCase().includes(q) && !m.code?.toLowerCase().includes(q)) return false;
                    }
                    return true;
                  });
                  const totOp = filteredMovement.reduce((acc: number, m: any) => acc + (Number(m.opQty) || 0), 0);
                  const totIn = filteredMovement.reduce((acc: number, m: any) => acc + (Number(m.inQty) || 0), 0);
                  const totOut = filteredMovement.reduce((acc: number, m: any) => acc + (Number(m.outQty) || 0), 0);
                  const totCl = filteredMovement.reduce((acc: number, m: any) => acc + (Number(m.clQty) || 0), 0);

                  return (
                    <div className="space-y-3">
                      <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                        <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                          <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Code</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Group</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Opening Qty</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Qty In</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Qty Out</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Closing Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredMovement.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                No stock movement records found for the selected period
                              </td>
                            </tr>
                          ) : (
                            filteredMovement.map((m: any, idx: number) => (
                              <tr key={idx} onClick={() => onDrillStock(m.code)} className="hover:bg-indigo-50/50 cursor-pointer transition">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {m.name}
                                  {m.unit && <span className="ml-1 text-[11px] text-slate-400 font-normal">({m.unit})</span>}
                                </td>
                                <td className="py-2 px-3 font-mono text-xs text-slate-500">{m.code}</td>
                                <td className="py-2 px-3 text-slate-600 text-xs">{m.group || '-'}</td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">{m.opQty}</td>
                                <td className="py-2 px-3 text-right font-mono font-medium text-emerald-600">
                                  {m.inQty > 0 ? `+${m.inQty}` : '0'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-medium text-rose-600">
                                  {m.outQty > 0 ? `-${m.outQty}` : '0'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{m.clQty}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {filteredMovement.length > 0 && (
                          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                            <tr>
                              <td className="py-2.5 px-3 uppercase text-xs text-slate-800" colSpan={3}>Total ({filteredMovement.length} Items)</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-900">{totOp}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-700">+{totIn}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-700">-{totOut}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-indigo-900">{totCl}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  );
                })()}

                {invSubTab === 'prof' && reportData?.profit && (
                  <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                    <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                      <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Qty Sold</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Sales Revenue</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Cost Price</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Gross Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.profit.map((p: any, idx: number) => (
                        <tr key={idx} onClick={() => onDrillStock(p.code)} className="hover:bg-slate-50 cursor-pointer">
                          <td className="py-2 px-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="py-2 px-3 text-center font-mono">{p.qty}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(p.saleAmt)}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(p.costAmt)}</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${p.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {fmt(p.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {invSubTab === 'top' && reportData?.topQty && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <h3 className="font-bold text-slate-800 text-xs mb-2">Top 15 Sellers by Quantity</h3>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                          <tr className="border-b border-slate-300 font-bold text-slate-600">
                            <th className="bg-slate-100 bg-clip-padding py-1 text-left">Item</th>
                            <th className="bg-slate-100 bg-clip-padding py-1 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.topQty.map((t: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-200">
                              <td className="py-1 font-medium">{t.name}</td>
                              <td className="py-1 text-right font-mono font-bold">{t.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <h3 className="font-bold text-slate-800 text-xs mb-2">Top 15 Sellers by Revenue</h3>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                          <tr className="border-b border-slate-300 font-bold text-slate-600">
                            <th className="bg-slate-100 bg-clip-padding py-1 text-left">Item</th>
                            <th className="bg-slate-100 bg-clip-padding py-1 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.topAmt.map((t: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-200">
                              <td className="py-1 font-medium">{t.name}</td>
                              <td className="py-1 text-right font-mono font-bold">{fmt(t.saleAmt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {invSubTab === 'serials' && Array.isArray(reportData) && (() => {
                  const filteredSerials = reportData.filter((s: any) => {
                    if (stockFilters.group !== 'ALL' && s.group !== stockFilters.group) return false;
                    if (stockFilters.category !== 'ALL' && s.category !== stockFilters.category) return false;
                    if (stockFilters.status !== 'ALL' && s.status !== stockFilters.status) return false;
                    if (!stockFilters.serial) return true;
                    const q = stockFilters.serial.toLowerCase();
                    return (
                      s.serialNo.toLowerCase().includes(q) ||
                      s.itemName.toLowerCase().includes(q) ||
                      s.itemCode.toLowerCase().includes(q)
                    );
                  });
                  return (
                  <div className="flex flex-col space-y-3">
                    <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 rounded-xl border">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={stockFilters.group || 'ALL'}
                          onChange={e => setStockFilters({ ...stockFilters, group: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[120px] truncate"
                        >
                          <option value="ALL">All Groups</option>
                          {Array.from(new Set(reportData.map((d:any) => d.group).filter(Boolean))).sort().map((g:any) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <select
                          value={stockFilters.category || 'ALL'}
                          onChange={e => setStockFilters({ ...stockFilters, category: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[120px] truncate"
                        >
                          <option value="ALL">All Brands</option>
                          {Array.from(new Set(reportData.map((d:any) => d.category).filter(Boolean))).sort().map((c:any) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={stockFilters.item || 'ALL'}
                          onChange={e => setStockFilters({ ...stockFilters, item: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[140px] truncate"
                        >
                          <option value="ALL">All Items</option>
                          {Array.from(new Set(reportData.map((d:any) => d.itemName).filter(Boolean))).sort().map((i:any) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                        <select
                          value={stockFilters.status || 'ALL'}
                          onChange={e => setStockFilters({ ...stockFilters, status: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[120px] truncate"
                        >
                          <option value="ALL">All Status</option>
                          <option value="In Stock">In Stock</option>
                          <option value="Sold">Sold Out</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-[180px] bg-white border border-slate-300 rounded-xl px-3 h-8">
                        <Search className="h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter by serial no, item name, or code..."
                          value={stockFilters.serial || ''}
                          onChange={e => setStockFilters({ ...stockFilters, serial: e.target.value })}
                          className="bg-transparent text-xs w-full focus:outline-none font-medium"
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-semibold text-right">
                        Showing {filteredSerials.length} serials
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
                      <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                        <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                          <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Serial Number</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Code</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Group / Brand</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Status</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Acquisition</th>
                            <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Sale / Out</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredSerials.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                                No serial numbers found matching filter.
                              </td>
                            </tr>
                          ) : (
                            filteredSerials.map((s: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onDrillStock && onDrillStock(s.itemCode)}>
                                <td className="py-2 px-3 font-mono font-bold text-indigo-700">{s.serialNo}</td>
                                <td className="py-2 px-3 font-mono text-slate-600">{s.itemCode}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">{s.itemName}</td>
                                <td className="py-2 px-3 text-slate-600">
                                  <div className="text-xs font-semibold">{s.group || '-'}</div>
                                  <div className="text-[10px] text-slate-400">{s.category || '-'}</div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'In Stock' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                                    {s.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 text-[11px]">
                                  {s.date}
                                  <br/>
                                  <span 
                                    className="text-indigo-500 font-mono font-bold hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (s.refNo && s.refNo !== 'Opening' && onDrillVoucher) onDrillVoucher(s.refNo);
                                    }}
                                  >
                                    ({s.refNo})
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 text-[11px]">
                                  {s.soldDate ? (
                                    <>
                                      {s.soldDate}
                                      <br/>
                                      <span 
                                        className="text-rose-500 font-mono font-bold hover:underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (s.soldRefNo && onDrillVoucher) onDrillVoucher(s.soldRefNo);
                                        }}
                                      >
                                        ({s.soldRefNo})
                                      </span>
                                    </>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* Register Views */}
            {mainCategory === 'reg' && (
              <div className="p-2 space-y-4">
                {regSubTab === 'sales' && Array.isArray(reportData) && (
                  <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                    <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Date</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Invoice No</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Customer</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Payment</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-right font-bold text-slate-700">Total Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.map((inv: any, i) => (
                        <tr key={i} className={`cursor-pointer transition hover:bg-indigo-50/60 ${inv.isCancelled ? 'opacity-60 bg-red-50/20' : ''}`} onClick={() => {
                           if (inv.invoiceNo) {
                             onDrillVoucher(inv.invoiceNo);
                           }
                        }}>
                          <td className="py-3 px-4 text-slate-700">{formatDateStr(inv.date)}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium flex items-center gap-2">
                            {inv.invoiceNo}
                            {inv.isCancelled && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">CANCELLED</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{inv.customer?.name || 'Walk-in'}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {inv.payment?.cash > 0 ? 'Cash ' : ''}
                            {inv.payment?.bank1 > 0 ? 'Bank1 ' : ''}
                            {inv.payment?.bank2 > 0 ? 'Bank2 ' : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-bold font-mono">
                            {inv.isCancelled ? (
                              <span className="text-red-600 font-bold">0.00</span>
                            ) : (
                              <span className="text-slate-900">{fmt(inv.totalAmount)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {reportData.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">No sales found in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {regSubTab === 'purchases' && Array.isArray(reportData) && (
                  <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                    <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Date</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Bill No</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Supplier</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-left font-bold text-slate-700">Payment</th>
                        <th className="bg-slate-100 bg-clip-padding py-3 px-4 text-right font-bold text-slate-700">Total Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.map((inv: any, i) => (
                        <tr key={i} className={`cursor-pointer transition hover:bg-indigo-50/60 ${inv.isCancelled ? 'opacity-60 bg-red-50/20' : ''}`} onClick={() => {
                           if (inv.billNo) {
                             onDrillVoucher(inv.billNo);
                           }
                        }}>
                          <td className="py-3 px-4 text-slate-700">{formatDateStr(inv.date)}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium flex items-center gap-2">
                            {inv.supplierBillNo || inv.billNo}
                            {inv.isCancelled && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">CANCELLED</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{inv.supplier?.name || 'Supplier'}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {inv.payment?.cash > 0 ? 'Cash ' : ''}
                            {inv.payment?.bank1 > 0 ? 'Bank1 ' : ''}
                            {inv.payment?.bank2 > 0 ? 'Bank2 ' : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-bold font-mono">
                            {inv.isCancelled ? (
                              <span className="text-red-600 font-bold">0.00</span>
                            ) : (
                              <span className="text-slate-900">{fmt(inv.totalAmount)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {reportData.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">No purchases found in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Financial Statements */}
            {mainCategory === 'fin' && (
              <div className="w-full">
                {/* Trial Balance */}

                {/* Trial Balance Statement */}
                {finSubTab === 'TB' && reportData?.tb && (
                  <TallyPrimeView
                    reportType="TB"
                    reportData={reportData}
                    fromDate={fromDate}
                    toDate={toDate}
                    initialDepth={reportDepth}
                    onDepthChange={handleDepthChange}
                    onDrillLedger={onDrillLedger}
                    onDrillGroup={onDrillGroup}
                    config={config}
                  />
                )}

                {/* Trading & Profit & Loss Statement */}
                {finSubTab === 'PNL' && reportData?.pnl && (
                  <TallyPrimeView
                    reportType="PNL"
                    reportData={reportData}
                    fromDate={fromDate}
                    toDate={toDate}
                    initialDepth={reportDepth}
                    onDepthChange={handleDepthChange}
                    onDrillLedger={onDrillLedger}
                    onDrillGroup={onDrillGroup}
                    config={config}
                  />
                )}

                {/* Balance Sheet */}
                {finSubTab === 'BS' && reportData?.bs && reportData?.pnl && (
                  <TallyPrimeView
                    reportType="BS"
                    reportData={reportData}
                    fromDate={fromDate}
                    toDate={toDate}
                    initialDepth={reportDepth}
                    onDepthChange={handleDepthChange}
                    onDrillLedger={onDrillLedger}
                    onDrillGroup={onDrillGroup}
                    config={config}
                  />
                )}

                {(finSubTab === 'REC' || finSubTab === 'PAY' || finSubTab === 'LED') && (
                  <div className="w-full p-2 sm:p-3 space-y-4">

                {finSubTab === 'REC' && reportData?.rec && (() => {
                  const filteredRec = reportData.rec.filter((r: any) =>
                    (r.name || '').toLowerCase().includes(recSearch.toLowerCase())
                  );
                  const totalRec = reportData.rec.reduce((sum: number, r: any) => sum + (Number(r.amt) || 0), 0);

                  return (
                    <div className="space-y-3">
                      {/* Compact Header Strip */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wallet className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-sm text-white">Outstanding Receivables (Sundry Debtors)</span>
                          <span className="text-[11px] text-slate-400">({reportData.rec.length} accounts as of {toDate})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-bold text-slate-400">Total Outstanding:</span>
                          <span className="text-sm font-extrabold font-mono text-emerald-300">Nu. {fmt(totalRec)}</span>
                        </div>
                      </div>

                      {/* Search & Actions */}
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="relative max-w-xs w-full">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={recSearch}
                            onChange={(e) => setRecSearch(e.target.value)}
                            placeholder="Search customer / debtor..."
                            className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showBillWise}
                              onChange={(e) => setShowBillWise(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="text-xs font-semibold text-slate-700">Show Bill-wise Breakdown</span>
                          </label>
                          <span className="text-xs font-semibold text-slate-500">
                            Showing {filteredRec.length} of {reportData.rec.length} accounts
                          </span>
                        </div>
                      </div>

                      {/* Receivables Table */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Debtor / Customer Name</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Unpaid Invoices</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Outstanding Balance (Nu.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredRec.map((r: any, idx: number) => {
                              const partyBills = getPartyOutstandingBills(r.name, 'debtor');

                              return (
                                <React.Fragment key={idx}>
                                  <tr
                                    className="hover:bg-emerald-50/40 transition cursor-pointer"
                                    onClick={() => onDrillLedger(r.name)}
                                  >
                                    <td className="py-2.5 px-3 font-semibold text-slate-800 hover:text-indigo-600 transition">
                                      {r.name}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        partyBills.length > 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {partyBills.length} Bill{partyBills.length !== 1 ? 's' : ''} Pending
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                                      {fmt(r.amt)}
                                    </td>
                                  </tr>

                                  {/* Expanded Bill-wise Detail Sub-table */}
                                  {showBillWise && partyBills.length > 0 && (
                                    <tr className="bg-emerald-50/20">
                                      <td colSpan={3} className="p-3">
                                        <div className="bg-white rounded-xl border border-emerald-200/80 p-3 shadow-2xs space-y-2">
                                          <div className="flex items-center justify-between text-xs font-bold text-emerald-950 pb-1 border-b border-emerald-100">
                                            <span className="flex items-center gap-1.5">
                                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                              <span>Bill-wise Outstanding Breakdown — {r.name}</span>
                                            </span>
                                            <span className="text-[11px] text-slate-500 font-normal">
                                              Showing {partyBills.length} reference(s)
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left border-collapse">
                                              <thead>
                                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                  <th className="py-1.5 px-2">Ref / Bill No</th>
                                                  <th className="py-1.5 px-2">Bill Date</th>
                                                  <th className="py-1.5 px-2">Type</th>
                                                  <th className="py-1.5 px-2 text-right">Original Amount</th>
                                                  <th className="py-1.5 px-2 text-right">Settled</th>
                                                  <th className="py-1.5 px-2 text-right">Pending Balance</th>
                                                  <th className="py-1.5 px-2 text-center">Overdue</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 font-mono">
                                                {partyBills.map((b, bIdx) => {
                                                  const bDate = b.billDate ? new Date(b.billDate) : null;
                                                  const daysOverdue = bDate ? Math.max(0, Math.floor((Date.now() - bDate.getTime()) / (86400 * 1000))) : 0;

                                                  return (
                                                    <tr key={bIdx} className="hover:bg-slate-50">
                                                      <td className="py-1.5 px-2 font-bold text-indigo-900">{b.billNo}</td>
                                                      <td className="py-1.5 px-2 font-sans text-slate-600">{bDate ? bDate.toLocaleDateString() : '-'}</td>
                                                      <td className="py-1.5 px-2 font-sans">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold border text-slate-700">
                                                          {b.billType || 'Sales Invoice'}
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 px-2 text-right text-slate-600">Nu. {fmt(b.originalAmount)}</td>
                                                      <td className="py-1.5 px-2 text-right text-emerald-700">Nu. {fmt(b.paidAmount)}</td>
                                                      <td className="py-1.5 px-2 text-right font-bold text-rose-700">Nu. {fmt(b.pendingAmount)}</td>
                                                      <td className="py-1.5 px-2 text-center font-sans">
                                                        {daysOverdue > 0 ? (
                                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                            {daysOverdue} days
                                                          </span>
                                                        ) : (
                                                          <span className="text-[10px] text-slate-400">Current</span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td colSpan={2} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left font-bold uppercase tracking-wider text-xs">TOTAL RECEIVABLES</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-emerald-800 text-base font-extrabold">
                                Nu. {fmt(totalRec)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {finSubTab === 'PAY' && reportData?.pay && (() => {
                  const filteredPay = reportData.pay.filter((p: any) =>
                    (p.name || '').toLowerCase().includes(paySearch.toLowerCase())
                  );
                  const totalPay = reportData.pay.reduce((sum: number, p: any) => sum + (Number(p.amt) || 0), 0);

                  return (
                    <div className="space-y-3">
                      {/* Compact Header Strip */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CreditCard className="h-4 w-4 text-rose-400 shrink-0" />
                          <span className="font-bold text-sm text-white">Outstanding Payables (Sundry Creditors)</span>
                          <span className="text-[11px] text-slate-400">({reportData.pay.length} accounts as of {toDate})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-bold text-slate-400">Total Outstanding:</span>
                          <span className="text-sm font-extrabold font-mono text-rose-400">Nu. {fmt(totalPay)}</span>
                        </div>
                      </div>

                      {/* Search & Actions */}
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="relative max-w-xs w-full">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={paySearch}
                            onChange={(e) => setPaySearch(e.target.value)}
                            placeholder="Search supplier / creditor..."
                            className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showBillWise}
                              onChange={(e) => setShowBillWise(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span className="text-xs font-semibold text-slate-700">Show Bill-wise Breakdown</span>
                          </label>
                          <span className="text-xs font-semibold text-slate-500">
                            Showing {filteredPay.length} of {reportData.pay.length} accounts
                          </span>
                        </div>
                      </div>

                      {/* Payables Table */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Creditor / Supplier Name</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Unpaid Bills</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Outstanding Balance (Nu.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredPay.map((p: any, idx: number) => {
                              const partyBills = getPartyOutstandingBills(p.name, 'creditor');

                              return (
                                <React.Fragment key={idx}>
                                  <tr
                                    className="hover:bg-rose-50/40 transition cursor-pointer"
                                    onClick={() => onDrillLedger(p.name)}
                                  >
                                    <td className="py-2.5 px-3 font-semibold text-slate-800 hover:text-indigo-600 transition">
                                      {p.name}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        partyBills.length > 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {partyBills.length} Bill{partyBills.length !== 1 ? 's' : ''} Pending
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 text-sm">
                                      {fmt(p.amt)}
                                    </td>
                                  </tr>
                                  {/* Expanded Bill-wise Detail Sub-table */}
                                  {showBillWise && partyBills.length > 0 && (
                                    <tr className="bg-rose-50/20">
                                      <td colSpan={3} className="p-3">
                                        <div className="bg-white rounded-xl border border-rose-200/80 p-3 shadow-2xs space-y-2">
                                          <div className="flex items-center justify-between text-xs font-bold text-rose-950 pb-1 border-b border-rose-100">
                                            <span className="flex items-center gap-1.5">
                                              <FileText className="w-3.5 h-3.5 text-rose-600" />
                                              <span>Bill-wise Outstanding Breakdown — {p.name}</span>
                                            </span>
                                            <span className="text-[11px] text-slate-500 font-normal">
                                              Showing {partyBills.length} reference(s)
                                            </span>
                                          </div>

                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left border-collapse">
                                              <thead>
                                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                  <th className="py-1.5 px-2">Ref / Bill No</th>
                                                  <th className="py-1.5 px-2">Bill Date</th>
                                                  <th className="py-1.5 px-2">Type</th>
                                                  <th className="py-1.5 px-2 text-right">Original Amount</th>
                                                  <th className="py-1.5 px-2 text-right">Paid Amount</th>
                                                  <th className="py-1.5 px-2 text-right">Pending Balance</th>
                                                  <th className="py-1.5 px-2 text-center">Overdue</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100 font-mono">
                                                {partyBills.map((b, bIdx) => {
                                                  const bDate = b.billDate ? new Date(b.billDate) : null;
                                                  const daysOverdue = bDate ? Math.max(0, Math.floor((Date.now() - bDate.getTime()) / (86400 * 1000))) : 0;

                                                  return (
                                                    <tr key={bIdx} className="hover:bg-slate-50">
                                                      <td className="py-1.5 px-2 font-bold text-indigo-900">{b.billNo}</td>
                                                      <td className="py-1.5 px-2 font-sans text-slate-600">{bDate ? bDate.toLocaleDateString() : '-'}</td>
                                                      <td className="py-1.5 px-2 font-sans">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-semibold border text-slate-700">
                                                          {b.billType || 'Purchase Bill'}
                                                        </span>
                                                      </td>
                                                      <td className="py-1.5 px-2 text-right text-slate-600">Nu. {fmt(b.originalAmount)}</td>
                                                      <td className="py-1.5 px-2 text-right text-emerald-700">Nu. {fmt(b.paidAmount)}</td>
                                                      <td className="py-1.5 px-2 text-right font-bold text-rose-700">Nu. {fmt(b.pendingAmount)}</td>
                                                      <td className="py-1.5 px-2 text-center font-sans">
                                                        {daysOverdue > 0 ? (
                                                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                            {daysOverdue} days
                                                          </span>
                                                        ) : (
                                                          <span className="text-[10px] text-slate-400">Current</span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td colSpan={3} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left font-bold uppercase tracking-wider text-xs">TOTAL PAYABLES</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-rose-800 text-base font-extrabold">
                                Nu. {fmt(totalPay)}
                              </td>
                              <td className="bg-slate-100"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {finSubTab === 'LED' && reportData?.rows && (() => {
                  const opBal = Number(reportData.openingBalance) || 0;
                  let runningBal = opBal;
                  let totalDr = 0;
                  let totalCr = 0;

                  const processedRows = (reportData.rows || []).map((r: any) => {
                    const isCancelled = r.isCancelled || r.Status === 'Cancelled';
                    const dr = isCancelled ? 0 : (Number(r.Debit) || 0);
                    const cr = isCancelled ? 0 : (Number(r.Credit) || 0);
                    totalDr += dr;
                    totalCr += cr;
                    runningBal = runningBal + dr - cr;
                    return {
                      ...r,
                      isCancelled,
                      dr,
                      cr,
                      runningBal
                    };
                  });

                  const finalBal = runningBal;
                  const curLedgerObj = ledgers.find(l => l['Ledger Name'] === selectedLedger);
                  const groupName = curLedgerObj?.Group || 'Ledger Account';

                  const filteredRows = processedRows.filter((r: any) => {
                    if (ledgerPartyFilter !== 'ALL' && r.Party !== ledgerPartyFilter) return false;
                    if (!ledgerSearch) return true;
                    const q = ledgerSearch.toLowerCase();
                    return (
                      (r.Narration || '').toLowerCase().includes(q) ||
                      (r['Ref No'] || '').toLowerCase().includes(q) ||
                      (r.Type || '').toLowerCase().includes(q) ||
                      (r.Party || '').toLowerCase().includes(q) ||
                      (r.PaymentMode || '').toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="space-y-2.5">
                      {/* Compact Header & Metrics Strip */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <BookOpen className="h-4 w-4 text-indigo-400 shrink-0" />
                          <span className="font-bold text-sm text-white">{selectedLedger}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-indigo-200 border border-slate-700">
                            {groupName}
                          </span>
                          <span className="text-[11px] text-slate-400">({processedRows.length} txns)</span>
                        </div>

                        {/* Fast inline KPI Metrics */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap font-mono text-[11px]">
                          <div className="bg-slate-800/90 px-2 py-1 rounded-md">
                            <span className="text-slate-400 mr-1 font-sans text-[10px]">Op Bal:</span>
                            <span className="font-bold text-slate-200">Nu. {fmt(Math.abs(opBal))} {opBal >= 0 ? 'Dr' : 'Cr'}</span>
                          </div>
                          <div className="bg-slate-800/90 px-2 py-1 rounded-md">
                            <span className="text-emerald-400 mr-1 font-sans text-[10px]">Dr:</span>
                            <span className="font-bold text-emerald-300">Nu. {fmt(totalDr)}</span>
                          </div>
                          <div className="bg-slate-800/90 px-2 py-1 rounded-md">
                            <span className="text-rose-400 mr-1 font-sans text-[10px]">Cr:</span>
                            <span className="font-bold text-rose-300">Nu. {fmt(totalCr)}</span>
                          </div>
                          <div className={`px-2 py-1 rounded-md font-bold ${finalBal >= 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'}`}>
                            <span className="mr-1 font-sans text-[10px]">Closing:</span>
                            <span>Nu. {fmt(Math.abs(finalBal))} {finalBal >= 0 ? 'Dr' : 'Cr'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ledger Table */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center w-24">Date</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left w-24">Type</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left w-28">Ref / Voucher</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Particulars / Narration</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right w-28">Debit (Dr)</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right w-28">Credit (Cr)</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right w-36">Running Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {/* Opening Balance Row */}
                            <tr className="bg-slate-50/80 font-semibold border-b border-slate-200">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono">-</td>
                              <td className="py-2.5 px-3 text-slate-600">
                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">OP BAL</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono">-</td>
                              <td className="py-2.5 px-3 text-slate-700 font-bold">Opening Balance Brought Forward</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{opBal >= 0 ? fmt(opBal) : ''}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-700">{opBal < 0 ? fmt(Math.abs(opBal)) : ''}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-indigo-50/30">
                                Nu. {fmt(Math.abs(opBal))} <span className="text-[10px] font-bold text-indigo-700">{opBal >= 0 ? 'Dr' : 'Cr'}</span>
                              </td>
                            </tr>

                            {/* Transaction Rows */}
                            {filteredRows.map((r: any, idx: number) => (
                              <tr
                                key={idx}
                                onClick={() => r['Ref No'] && onDrillVoucher(r['Ref No'])}
                                className={`cursor-pointer transition hover:bg-indigo-50/60 ${r.isCancelled ? 'bg-red-50/30' : ''}`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600">{formatDateStr(r.DateIso)}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {r.Type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-bold text-indigo-600 hover:underline">
                                    {r['Ref No']}
                                  </span>
                                  {r.isCancelled && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">CANCELLED</span>}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium">
                                  {r.isCancelled ? <span className="text-red-600 font-bold">Cancelled / Void</span> : (r.Narration || '-')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                                  {r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : (r.dr ? fmt(r.dr) : '')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700">
                                  {r.isCancelled ? <span className="text-red-600 font-bold">0.00</span> : (r.cr ? fmt(r.cr) : '')}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/40">
                                  Nu. {fmt(Math.abs(r.runningBal))} <span className={`text-[10px] font-bold ${r.runningBal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{r.runningBal >= 0 ? 'Dr' : 'Cr'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td colSpan={4} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left font-bold uppercase tracking-wider text-xs">
                                TOTAL MOVEMENT & CLOSING BALANCE
                              </td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-emerald-800 text-sm font-bold">{fmt(totalDr)}</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-rose-800 text-sm font-bold">{fmt(totalCr)}</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-indigo-900 text-sm font-extrabold bg-indigo-50/80">
                                Nu. {fmt(Math.abs(finalBal))} {finalBal >= 0 ? 'Dr' : 'Cr'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Quick Search Ledger Modal (Ctrl+L) */}
      {showQuickLedgerModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowQuickLedgerModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Input */}
            <div className="relative border-b border-slate-200 bg-slate-50/90 p-3 flex items-center gap-2">
              <Search className="h-5 w-5 text-indigo-600 ml-1.5 shrink-0" />
              <input
                ref={quickLedgerInputRef}
                type="text"
                value={ledgerSearchQuery}
                onChange={(e) => {
                  setLedgerSearchQuery(e.target.value);
                  setFocusedLedgerIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedLedgerIdx((prev) => Math.min(prev + 1, Math.max(0, filteredQuickLedgers.length - 1)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedLedgerIdx((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredQuickLedgers[focusedLedgerIdx]) {
                      const sel = filteredQuickLedgers[focusedLedgerIdx]['Ledger Name'];
                      setSelectedLedger(sel);
                      setMainCategory('fin');
                      setFinSubTab('LED');
                      setShowQuickLedgerModal(false);
                      setShowReportCatalog(false);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowQuickLedgerModal(false);
                  }
                }}
                placeholder="Type ledger name (e.g. Cash, Sales, Dorji Traders)..."
                className="w-full bg-transparent text-slate-900 font-bold text-base placeholder-slate-400 outline-none pr-8"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowQuickLedgerModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Subheader info */}
            <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Found <strong className="text-slate-900 font-bold">{filteredQuickLedgers.length}</strong> ledger{filteredQuickLedgers.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">↑↓</kbd> navigate</span>
                <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">↵</kbd> select</span>
                <span><kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs">ESC</kbd> close</span>
              </div>
            </div>

            {/* Results List */}
            <div className="overflow-y-auto max-h-[380px] p-2 space-y-1">
              {filteredQuickLedgers.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm font-medium">
                  No ledgers found matching "<span className="font-semibold text-slate-700">{ledgerSearchQuery}</span>"
                </div>
              ) : (
                filteredQuickLedgers.map((l: any, idx: number) => {
                  const isSelected = idx === focusedLedgerIdx;
                  const ledgerName = l['Ledger Name'] || '';
                  const groupName = l['Group'] || l['Under Group'] || 'General Ledger';
                  const isCurrentlyViewed = selectedLedger === ledgerName;

                  return (
                    <div
                      key={ledgerName || idx}
                      onClick={() => {
                        setSelectedLedger(ledgerName);
                        setMainCategory('fin');
                        setFinSubTab('LED');
                        setShowQuickLedgerModal(false);
                        setShowReportCatalog(false);
                      }}
                      onMouseEnter={() => setFocusedLedgerIdx(idx)}
                      className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : isCurrentlyViewed
                          ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${isSelected ? 'text-white font-black' : 'text-slate-900 font-bold'}`}>
                            {ledgerName}
                          </span>
                          {isCurrentlyViewed && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-100 text-indigo-700'}`}>
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <span className={`text-xs ${isSelected ? 'text-indigo-100 font-medium' : 'text-slate-500 font-medium'}`}>
                          {groupName}
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg shrink-0 ${
                        isSelected ? 'bg-indigo-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        Select ↵
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Change Period Modal (Alt+F2 / Alt+D) */}
      {showChangePeriodModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowChangePeriodModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-base">Change Report Period</h3>
                <kbd className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">Alt+F2</kbd>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePeriodModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Preset Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  1-Click Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'last_month', label: 'Last Month' },
                    { id: 'this_quarter', label: 'This Quarter' },
                    { id: 'this_fy', label: 'Financial Year (FY)' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        applyPreset(p.id as any);
                        setShowChangePeriodModal(false);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-slate-200" />

              {/* Custom Date Inputs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Custom Period Dates
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Type e.g. <strong className="text-indigo-600 font-bold">8/8</strong> or <strong className="text-indigo-600 font-bold">8.8</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* From Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">From Date</label>
                      {(() => {
                        const parsed = parseSmartDate(fromInputText);
                        return parsed ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ✓ {formatDisplayDate(parsed)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">Type 8/8 or 8.8</span>
                        );
                      })()}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        ref={periodFromInputRef}
                        type="text"
                        value={fromInputText}
                        onChange={(e) => setFromInputText(e.target.value)}
                        onBlur={() => {
                          const parsed = parseSmartDate(fromInputText);
                          if (parsed) {
                            setTempFromDate(parsed);
                            setFromInputText(formatDisplayDate(parsed));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const parsed = parseSmartDate(fromInputText);
                            if (parsed) {
                              setTempFromDate(parsed);
                              setFromInputText(formatDisplayDate(parsed));
                            }
                            periodToInputRef.current?.focus();
                            periodToInputRef.current?.select();
                          }
                        }}
                        placeholder="e.g. 8/8, 8.8"
                        className="w-full h-10 rounded-xl border border-slate-300 pl-3 pr-8 font-bold text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                      <label className="absolute right-2 text-slate-400 hover:text-indigo-600 cursor-pointer p-1" title="Pick from Calendar">
                        <Calendar className="h-4 w-4" />
                        <input
                          type="date"
                          value={tempFromDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setTempFromDate(e.target.value);
                              setFromInputText(formatDisplayDate(e.target.value));
                            }
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  {/* To Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">To Date</label>
                      {(() => {
                        const parsed = parseSmartDate(toInputText);
                        return parsed ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            ✓ {formatDisplayDate(parsed)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">Type 15/8 or 15.8</span>
                        );
                      })()}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        ref={periodToInputRef}
                        type="text"
                        value={toInputText}
                        onChange={(e) => setToInputText(e.target.value)}
                        onBlur={() => {
                          const parsed = parseSmartDate(toInputText);
                          if (parsed) {
                            setTempToDate(parsed);
                            setToInputText(formatDisplayDate(parsed));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const pFrom = parseSmartDate(fromInputText) || tempFromDate;
                            const pTo = parseSmartDate(toInputText) || tempToDate;
                            if (pFrom && pTo) {
                              setFromDate(pFrom);
                              setToDate(pTo);
                              setShowChangePeriodModal(false);
                            }
                          }
                        }}
                        placeholder="e.g. 15/8, 15.8"
                        className="w-full h-10 rounded-xl border border-slate-300 pl-3 pr-8 font-bold text-slate-900 text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                      <label className="absolute right-2 text-slate-400 hover:text-indigo-600 cursor-pointer p-1" title="Pick from Calendar">
                        <Calendar className="h-4 w-4" />
                        <input
                          type="date"
                          value={tempToDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setTempToDate(e.target.value);
                              setToInputText(formatDisplayDate(e.target.value));
                            }
                          }}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 px-5 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">Press <kbd className="bg-white border border-slate-300 rounded px-1 py-0.5 font-bold shadow-2xs text-slate-700">Enter</kbd> to Apply</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePeriodModal(false)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pFrom = parseSmartDate(fromInputText) || tempFromDate;
                    const pTo = parseSmartDate(toInputText) || tempToDate;
                    if (pFrom && pTo) {
                      setFromDate(pFrom);
                      setToDate(pTo);
                      setShowChangePeriodModal(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-md cursor-pointer"
                >
                  Apply Period ↵
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
