import React, { useState, useEffect, useMemo } from 'react';
import { Config, Item, Ledger } from '../types';
import {
  getDailyColumnarReport, getGSTReport, getAdvancedReports, getFinancialReports, getFullLedgerStatement
} from '../services/storageService';
import XLSX from 'xlsx-js-style';
import {
  Printer, Calendar, FileSpreadsheet, Receipt, Package, CircleDollarSign, TrendingUp, Scale, Search, CheckCircle2, AlertCircle, ShieldCheck, Building2, PieChart, Layers, BookOpen, Wallet, CreditCard, ArrowRightLeft, LayoutGrid, ChevronDown, X, SlidersHorizontal, MessageCircle, Mail, FileDown, Share2, ChevronUp } from 'lucide-react';
import { PrintReportModal } from './PrintReportModal';
import { generateReportPDF, shareOrDownloadPDF } from '../utils/pdfExport';

export interface ReportTarget {
  category: 'daily' | 'gst' | 'inv' | 'fin' | 'reg';
  finSubTab?: 'TB' | 'PNL' | 'BS' | 'REC' | 'PAY' | 'LED';
  invSubTab?: 'summary' | 'mov' | 'prof' | 'top' | 'serials';
  ledgerName?: string;
  itemWise?: boolean;
  fromDate?: string;
  toDate?: string;
  timestamp?: number;
}

interface ReportsProps {
  config: Config;
  items: Item[];
  ledgers: Ledger[];
  onDrillVoucher: (refNo: string) => void;
  onDrillLedger: (name: string) => void;
  onDrillStock: (code: string) => void;
  onDrillGroup?: (category: string, fromDate?: string, toDate?: string) => void;
  initialReportTarget?: ReportTarget | null;
}

export const Reports: React.FC<ReportsProps> = ({
  config,
  items,
  ledgers,
  onDrillVoucher,
  onDrillLedger,
  onDrillStock,
  onDrillGroup,
  initialReportTarget
}) => {
  const [mainCategory, setMainCategory] = useState<'daily' | 'gst' | 'inv' | 'fin' | 'reg'>('daily');
  const [invSubTab, setInvSubTab] = useState<'summary' | 'mov' | 'prof' | 'top' | 'serials'>('summary');
  const [finSubTab, setFinSubTab] = useState<'TB' | 'PNL' | 'BS' | 'REC' | 'PAY' | 'LED'>('TB');
  const [regSubTab, setRegSubTab] = useState<'sales' | 'purchases'>('sales');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');

  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  const [itemWise, setItemWise] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [gstOnly, setGstOnly] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [tbSearch, setTbSearch] = useState('');
  const [tbViewMode, setTbViewMode] = useState<'ledger' | 'group'>('ledger');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPartyFilter, setLedgerPartyFilter] = useState('ALL');
  const [ledgerModeFilter, setLedgerModeFilter] = useState('ALL');
  const [recSearch, setRecSearch] = useState('');
  const [paySearch, setPaySearch] = useState('');
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
    if (isPrintModalOpen) {
      setIsPrintModalOpen(false);
      return true;
    }
    if (showReportCatalog) {
      setShowReportCatalog(false);
      return true;
    }
    if (mainCategory !== 'daily') {
      setMainCategory('daily');
      return true;
    }
    return false;
  };

  // Keyboard navigation and shortcuts (Escape, Alt+Left / Alt+Right)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
      setMainCategory(initialReportTarget.category);
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
          if (!selectedLedger && ledgers.length > 0) {
            setSelectedLedger(ledgers[0]['Ledger Name']);
          }
          if (selectedLedger) {
            const data = getFullLedgerStatement(selectedLedger);
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
          if (stockFilters.item && !i.itemName?.toLowerCase().includes(stockFilters.item.toLowerCase())) return false;
          
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
        headers = ['Item Name', 'Item Code', 'Opening Qty', 'Qty In', 'Qty Out', 'Closing Qty'];
        reportData.movement.forEach((m: any) => {
          rows.push([m.name, m.code, Number(m.opQty) || 0, Number(m.inQty) || 0, Number(m.outQty) || 0, Number(m.clQty) || 0]);
        });
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
      if (finSubTab === 'TB' && reportData?.tb) {
        reportTitle = 'Trial Balance Statement';
        headers = ['Ledger Account', 'Parent Group / Classification', 'Nature', 'Debit Amount (Dr) (Nu.)', 'Credit Amount (Cr) (Nu.)'];
        let totDr = 0;
        let totCr = 0;
        reportData.tb.forEach((l: any) => {
          totDr += Number(l.dr) || 0;
          totCr += Number(l.cr) || 0;
          rows.push([l.name, l.grp || '-', l.nat || '-', l.dr ? fmt(l.dr) : '', l.cr ? fmt(l.cr) : '']);
        });
        totalsRow = ['TOTAL TRIAL BALANCE', '', '', fmt(totDr), fmt(totCr)];
        const diff = Math.abs(totDr - totCr);
        summaryCards = [
          { label: 'Total Debits (Dr)', value: `Nu. ${fmt(totDr)}` },
          { label: 'Total Credits (Cr)', value: `Nu. ${fmt(totCr)}` },
          { label: 'Balance Status', value: diff < 0.01 ? 'Balanced (Dr = Cr)' : `Unbalanced Diff: Nu. ${fmt(diff)}` }
        ];
      } else if (finSubTab === 'PNL' && reportData?.pnl) {
        reportTitle = 'Trading & Profit & Loss Statement';
        headers = ['Particulars / Accounting Schedule', 'Category Type', 'Amount (Nu.)'];
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

        rows = [
          ['--- TRADING ACCOUNT ---', '', ''],
          ['Revenue from Operations (Sales)', 'Direct Revenue', fmt(s)],
          ['Direct Incomes', 'Direct Revenue', fmt(di)],
          ['Opening Stock Valuation', 'COGS Component', fmt(os)],
          ['Cost of Purchases', 'COGS Component', fmt(pur)],
          ['Direct Expenses', 'COGS Component', fmt(de)],
          ['Less: Closing Stock Valuation', 'COGS Component', `-${fmt(cs)}`],
          ['Total Cost of Goods Sold (COGS)', 'Cost Subtotal', fmt(cogs)],
          ['GROSS PROFIT / (GROSS LOSS)', 'Gross Margin', fmt(grossProfit)],
          ['', '', ''],
          ['--- PROFIT & LOSS ACCOUNT ---', '', ''],
          ['Gross Profit b/d', 'Gross Margin', fmt(grossProfit)],
          ['Indirect Income', 'Other Income', fmt(ii)],
          ['Indirect Expenses', 'Operating Expense', `-${fmt(ie)}`],
          ['NET PROFIT / (NET LOSS) FOR PERIOD', 'Net Operating Result', fmt(netProfit)]
        ];
        totalsRow = ['NET PROFIT / (LOSS) TRANSFERRED TO EQUITY', '', fmt(netProfit)];
        summaryCards = [
          { label: 'Total Revenue', value: `Nu. ${fmt(s + di + ii)}` },
          { label: 'Gross Profit', value: `Nu. ${fmt(grossProfit)}` },
          { label: 'Net Profit / (Loss)', value: `Nu. ${fmt(netProfit)}` }
        ];
      } else if (finSubTab === 'BS' && reportData?.bs && reportData?.pnl) {
        reportTitle = 'Balance Sheet Statement';
        headers = ['Capital & Liabilities', 'Amount (Nu.)', 'Assets & Properties', 'Amount (Nu.)'];
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
        const netEquity = cap + netProfit;
        const loans = Number(reportData.bs.ln) || 0;
        const cl = Number(reportData.bs.cl) || 0;

        const fa = Number(reportData.bs.fa) || 0;
        const ca = Number(reportData.bs.ca) || 0;
        const stockVal = Number(reportData.bs.cs) || 0;

        const totLiabBeforeDiff = netEquity + loans + cl;
        const totAssetBeforeDiff = fa + ca + stockVal;
        const diff = totAssetBeforeDiff - totLiabBeforeDiff;

        const finalTotal = Math.max(totLiabBeforeDiff, totAssetBeforeDiff);

        rows = [
          ['Owner\'s Capital Account (Opening)', fmt(cap), 'Fixed Assets (Properties/Equip)', fmt(fa)],
          ['Add: Net Profit / (Loss) for Period', fmt(netProfit), 'Current Assets (Cash/Bank/Debtors)', fmt(ca)],
          ['Total Owner\'s Equity', fmt(netEquity), 'Closing Stock Valuation', fmt(stockVal)],
          ['Loans & Borrowings (Liabilities)', fmt(loans), '', ''],
          ['Current Liabilities & Payables', fmt(cl), '', '']
        ];

        if (Math.abs(diff) > 0.01) {
          rows.push([
            diff > 0 ? 'Unadjusted Opening Mismatch' : '',
            diff > 0 ? fmt(diff) : '',
            diff < 0 ? 'Unadjusted Opening Mismatch' : '',
            diff < 0 ? fmt(Math.abs(diff)) : ''
          ]);
        }

        totalsRow = ['TOTAL CAPITAL & LIABILITIES', fmt(finalTotal), 'TOTAL ASSETS', fmt(finalTotal)];
        summaryCards = [
          { label: 'Total Owner\'s Equity', value: `Nu. ${fmt(netEquity)}` },
          { label: 'Total Liabilities & Capital', value: `Nu. ${fmt(finalTotal)}` },
          { label: 'Total Assets & Stock', value: `Nu. ${fmt(finalTotal)}` }
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
        row.forEach((val, cIdx) => {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: cIdx });
          if (ws[cellRef]) {
            const isNum = typeof val === 'number' || (!isNaN(Number(val)) && String(val).includes('.') && !isNaN(parseFloat(val)));
            ws[cellRef].s = {
              font: { name: 'Calibri', sz: 10, color: { rgb: '0F172A' } },
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
              fill: { fgColor: { rgb: 'E2E8F0' } },
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
    const doc = generateReportPDF(p.reportTitle, config, fromDate, toDate, p.headers, p.rows, p.totalsRow, p.summaryCards);
    const safeTitle = p.reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`${safeTitle}_${fromDate}_to_${toDate}.pdf`);
  };

  const handleDirectSharePDF = async () => {
    const p = getReportDataExportPayload();
    if (!p) return;
    const doc = generateReportPDF(p.reportTitle, config, fromDate, toDate, p.headers, p.rows, p.totalsRow, p.summaryCards);
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
        {/* Left Section: Report Switcher & Direct Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
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
                <select
                  value={selectedLedger}
                  onChange={e => setSelectedLedger(e.target.value)}
                  className="h-8 rounded-xl border border-slate-300 bg-white px-2 font-bold text-slate-800 outline-none w-[120px] sm:w-[160px] truncate"
                >
                  {ledgers.map(l => (
                    <option key={l['Ledger Name']} value={l['Ledger Name']}>
                      {l['Ledger Name']}
                    </option>
                  ))}
                </select>

                {uniqueParties.length > 0 && (
                  <select
                    value={ledgerPartyFilter}
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
                    value={ledgerSearch}
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
        </div>

        {/* Right Section: Date Controls & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
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

          <button
            onClick={() => {
              setFromDate(todayStr);
              setToDate(todayStr);
            }}
            className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
            title="Set date range to today"
          >
            Today
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
          <div className="px-4 sm:px-6 py-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
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
                          <td className="py-2 px-3 text-right font-mono">{fmt(r.cash)}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(r.bank1)}</td>
                          <td className="py-2 px-3 text-right font-mono">{fmt(r.bank2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-amber-600">{fmt(r.credit)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">{fmt(r.total)}</td>
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
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.taxable)}</td>
                      <td className="py-2 px-3 text-right font-mono">{fmt(r.zeroRated)}</td>
                      <td className="py-2 px-3 text-right font-mono text-indigo-700">{fmt(r.gstAmount)}</td>
                      <td className="py-2 px-3 text-right font-bold font-mono">{fmt(r.total)}</td>
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
                          value={stockFilters.item}
                          onChange={e => setStockFilters({ ...stockFilters, item: e.target.value })}
                          className="bg-transparent text-xs w-full focus:outline-none"
                        />
                      </div>
                      <select
                        value={stockFilters.group}
                        onChange={e => setStockFilters({ ...stockFilters, group: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2"
                      >
                        <option value="ALL">All Groups</option>
                        {Array.from(new Set(reportData.map((d:any) => d.group).filter(Boolean))).sort().map((g:any) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <select
                        value={stockFilters.category}
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
                        value={stockFilters.supplier}
                        onChange={e => setStockFilters({ ...stockFilters, supplier: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2 w-24"
                      />
                      <input
                        type="text"
                        placeholder="Serial No..."
                        value={stockFilters.serial}
                        onChange={e => setStockFilters({ ...stockFilters, serial: e.target.value })}
                        className="bg-white border border-slate-200 rounded-md text-xs py-1 px-2 w-24"
                      />
                      <input
                        type="text"
                        placeholder="User..."
                        value={stockFilters.user}
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
                        if (stockFilters.item && !i.itemName?.toLowerCase().includes(stockFilters.item.toLowerCase())) return false;
                        
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

                {invSubTab === 'mov' && reportData?.movement && (
                  <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                    <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                      <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Item Name</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Opening Qty</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Qty In</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Qty Out</th>
                        <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Closing Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.movement.map((m: any, idx: number) => (
                        <tr key={idx} onClick={() => onDrillStock(m.code)} className="hover:bg-slate-50 cursor-pointer">
                          <td className="py-2 px-3 font-semibold text-slate-800">{m.name}</td>
                          <td className="py-2 px-3 text-right font-mono">{m.opQty}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-600">+{m.inQty}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-600">-{m.outQty}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{m.clQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

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
                          value={stockFilters.group}
                          onChange={e => setStockFilters({ ...stockFilters, group: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[120px] truncate"
                        >
                          <option value="ALL">All Groups</option>
                          {Array.from(new Set(reportData.map((d:any) => d.group).filter(Boolean))).sort().map((g:any) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <select
                          value={stockFilters.category}
                          onChange={e => setStockFilters({ ...stockFilters, category: e.target.value })}
                          className="h-8 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800 outline-none w-[120px] truncate"
                        >
                          <option value="ALL">All Brands</option>
                          {Array.from(new Set(reportData.map((d:any) => d.category).filter(Boolean))).sort().map((c:any) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          value={stockFilters.status}
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
                          value={stockFilters.serial}
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

            {/* Financial Statements */}
            {mainCategory === 'fin' && (
              <div className="p-2 space-y-4">
                {/* Trial Balance */}
                
                {mainCategory === 'reg' && regSubTab === 'sales' && Array.isArray(reportData) && (
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
                        <tr key={i} className={`hover:bg-slate-50/80 transition cursor-pointer ${inv.isCancelled ? 'opacity-60 bg-red-50/20' : ''}`} onClick={() => {
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
                          <td className="py-3 px-4 text-right text-slate-900 font-bold">{fmt(inv.totalAmount)}</td>
                        </tr>
                      ))}
                      {reportData.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">No sales found in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {mainCategory === 'reg' && regSubTab === 'purchases' && Array.isArray(reportData) && (
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
                        <tr key={i} className={`hover:bg-slate-50/80 transition cursor-pointer ${inv.isCancelled ? 'opacity-60 bg-red-50/20' : ''}`} onClick={() => {
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
                          <td className="py-3 px-4 text-right text-slate-900 font-bold">{fmt(inv.totalAmount)}</td>
                        </tr>
                      ))}
                      {reportData.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500 italic">No purchases found in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {finSubTab === 'TB' && reportData?.tb && (() => {
                  let totDr = 0;
                  let totCr = 0;
                  (reportData.tb || []).forEach((l: any) => {
                    totDr += Number(l.dr) || 0;
                    totCr += Number(l.cr) || 0;
                  });
                  const diff = Math.abs(totDr - totCr);
                  const isBalanced = diff < 0.01;

                  // Filter by search term
                  const filteredTb = (reportData.tb || []).filter((l: any) =>
                    l.name.toLowerCase().includes(tbSearch.toLowerCase()) ||
                    (l.grp && l.grp.toLowerCase().includes(tbSearch.toLowerCase())) ||
                    (l.nat && l.nat.toLowerCase().includes(tbSearch.toLowerCase()))
                  );

                  // Group summary aggregation if view mode is 'group'
                  const groupAgg: { [key: string]: { grp: string; nat: string; dr: number; cr: number } } = {};
                  if (tbViewMode === 'group') {
                    filteredTb.forEach((l: any) => {
                      const key = l.grp || 'Unassigned';
                      if (!groupAgg[key]) {
                        groupAgg[key] = { grp: key, nat: l.nat || 'Asset', dr: 0, cr: 0 };
                      }
                      groupAgg[key].dr += Number(l.dr) || 0;
                      groupAgg[key].cr += Number(l.cr) || 0;
                    });
                  }

                  return (
                    <div className="space-y-4">
                      {/* Summary Header Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Total Debits (Dr)</span>
                            <div className="text-lg font-bold font-mono text-emerald-900">Nu. {fmt(totDr)}</div>
                          </div>
                          <CircleDollarSign className="h-6 w-6 text-emerald-500 opacity-60" />
                        </div>

                        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">Total Credits (Cr)</span>
                            <div className="text-lg font-bold font-mono text-rose-900">Nu. {fmt(totCr)}</div>
                          </div>
                          <CircleDollarSign className="h-6 w-6 text-rose-500 opacity-60" />
                        </div>

                        <div className={`border rounded-xl p-3 flex justify-between items-center ${isBalanced ? 'bg-indigo-50/80 border-indigo-200' : 'bg-amber-50/80 border-amber-200'}`}>
                          <div>
                            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Trial Balance Status</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isBalanced ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  <span className="font-bold text-sm text-emerald-800">Balanced (Dr = Cr)</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                  <span className="font-bold text-sm text-amber-900">Diff: Nu. {fmt(diff)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Scale className={`h-6 w-6 opacity-60 ${isBalanced ? 'text-indigo-500' : 'text-amber-500'}`} />
                        </div>
                      </div>

                      {/* Controls: Search and View Mode */}
                      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={tbSearch}
                            onChange={(e) => setTbSearch(e.target.value)}
                            placeholder="Filter ledger account or group..."
                            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
                          <button
                            onClick={() => setTbViewMode('ledger')}
                            className={`px-3 py-1 rounded-md transition ${tbViewMode === 'ledger' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Detailed Ledgers
                          </button>
                          <button
                            onClick={() => setTbViewMode('group')}
                            className={`px-3 py-1 rounded-md transition ${tbViewMode === 'group' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Group Summary
                          </button>
                        </div>
                      </div>

                      {/* Trial Balance Table */}
                      <div className="rounded-xl border border-slate-200 bg-white">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">
                                {tbViewMode === 'ledger' ? 'Ledger Account' : 'Parent Group'}
                              </th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">
                                {tbViewMode === 'ledger' ? 'Group / Classification' : 'Nature'}
                              </th>
                              {tbViewMode === 'ledger' && <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Nature</th>}
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Debit Balance (Dr)</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Credit Balance (Cr)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tbViewMode === 'ledger' ? (
                              filteredTb.map((l: any, idx: number) => (
                                <tr
                                  key={idx}
                                  onClick={() => onDrillLedger(l.name)}
                                  className="hover:bg-slate-50 cursor-pointer transition"
                                >
                                  <td className="py-2 px-3 font-semibold text-slate-800">{l.name}</td>
                                  <td className="py-2 px-3 text-slate-600 text-xs">{l.grp || '-'}</td>
                                  <td className="py-2 px-3 text-center text-xs">
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                                      {l.nat}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">{l.dr ? fmt(l.dr) : ''}</td>
                                  <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">{l.cr ? fmt(l.cr) : ''}</td>
                                </tr>
                              ))
                            ) : (
                              Object.values(groupAgg).map((g: any, idx: number) => (
                                <tr
                                  key={idx}
                                  onClick={() => onDrillGroup && onDrillGroup(g.grp, fromDate, toDate)}
                                  className="hover:bg-indigo-50/60 cursor-pointer transition"
                                >
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{g.grp}</td>
                                  <td className="py-2.5 px-3 text-slate-600 text-xs">{g.nat}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">{g.dr ? fmt(g.dr) : ''}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">{g.cr ? fmt(g.cr) : ''}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td colSpan={tbViewMode === 'ledger' ? 3 : 2} className="bg-slate-100 bg-clip-padding py-3 px-3 text-left">
                                TOTAL TRIAL BALANCE
                              </td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-emerald-800 text-sm">{fmt(totDr)}</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-rose-800 text-sm">{fmt(totCr)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Trading & Profit & Loss Statement */}
                {finSubTab === 'PNL' && reportData?.pnl && (() => {
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
                  const grossProfit = (s + di) - cogs;
                  const netProfit = grossProfit + ii - ie;

                  return (
                    <div className="space-y-5 text-xs sm:text-sm max-w-4xl mx-auto">
                      {/* Section 1: TRADING ACCOUNT */}
                      <div className="border border-slate-200 rounded-2xl bg-white shadow-xs">
                        <div className="bg-slate-800 text-white p-3 font-bold flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-300" />
                            <span>1. TRADING ACCOUNT (Gross Margin Analysis)</span>
                          </div>
                          <span className="text-[10px] bg-slate-700 text-indigo-200 px-2.5 py-0.5 rounded-full font-medium">
                            COGS = Opening Stock + Purchases + Direct Exp - Closing Stock
                          </span>
                        </div>

                        <div className="p-4 space-y-2">
                          <div
                            onClick={() => onDrillGroup && onDrillGroup('Sales Revenue', fromDate, toDate)}
                            className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition"
                          >
                            <span className="font-semibold text-slate-800">Revenue from Operations (Sales Accounts)</span>
                            <span className="font-mono font-bold text-emerald-700">Nu. {fmt(s)}</span>
                          </div>

                          {di > 0 && (
                            <div
                              onClick={() => onDrillGroup && onDrillGroup('Direct Income', fromDate, toDate)}
                              className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition"
                            >
                              <span className="font-semibold text-slate-800">Direct Incomes</span>
                              <span className="font-mono font-bold text-emerald-700">Nu. {fmt(di)}</span>
                            </div>
                          )}

                          <div className="pl-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Less: Cost of Goods Sold (COGS)
                          </div>

                          <div className="pl-6 space-y-1 text-slate-600">
                            <div
                              onClick={() => onDrillGroup && onDrillGroup('Stock Valuation', fromDate, toDate)}
                              className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Opening Stock Valuation</span>
                              <span className="font-mono">Nu. {fmt(os)}</span>
                            </div>
                            <div
                              onClick={() => onDrillGroup && onDrillGroup('Cost of Purchases', fromDate, toDate)}
                              className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                              <span>Cost of Purchases</span>
                              <span className="font-mono">Nu. {fmt(pur)}</span>
                            </div>
                            {de > 0 && (
                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Direct Expenses', fromDate, toDate)}
                                className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                              >
                                <span>Direct Expenses</span>
                                <span className="font-mono">Nu. {fmt(de)}</span>
                              </div>
                            )}
                            <div
                              onClick={() => onDrillGroup && onDrillGroup('Stock Valuation', fromDate, toDate)}
                              className="flex justify-between items-center py-1.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer text-rose-700 font-medium"
                            >
                              <span>Less: Closing Stock Valuation</span>
                              <span className="font-mono">- Nu. {fmt(cs)}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded-xl font-bold text-slate-900 mt-2">
                            <span>Total Cost of Goods Sold (COGS)</span>
                            <span className="font-mono">Nu. {fmt(cogs)}</span>
                          </div>

                          <div className={`flex justify-between items-center py-3 px-4 rounded-xl font-bold text-sm border-2 ${grossProfit >= 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                            <span className="flex items-center gap-2">
                              <TrendingUp className={`h-5 w-5 ${grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
                              {grossProfit >= 0 ? 'GROSS PROFIT' : 'GROSS LOSS'}
                            </span>
                            <span className="font-mono text-base font-extrabold">Nu. {fmt(grossProfit)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: PROFIT & LOSS ACCOUNT */}
                      <div className="border border-slate-200 rounded-2xl bg-white shadow-xs">
                        <div className="bg-slate-800 text-white p-3 font-bold flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-emerald-300" />
                            <span>2. PROFIT & LOSS ACCOUNT (Net Result)</span>
                          </div>
                          <span className="text-[10px] bg-slate-700 text-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                            Net Profit = Gross Profit + Indirect Income - Indirect Expenses
                          </span>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl font-semibold text-slate-800 border border-slate-200">
                            <span>Gross Profit b/d (Transferred from Trading Acc)</span>
                            <span className={`font-mono font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              Nu. {fmt(grossProfit)}
                            </span>
                          </div>

                          <div
                            onClick={() => onDrillGroup && onDrillGroup('Indirect Income', fromDate, toDate)}
                            className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition"
                          >
                            <span className="font-semibold text-slate-800">Add: Indirect Income</span>
                            <span className="font-mono font-bold text-emerald-700">+ Nu. {fmt(ii)}</span>
                          </div>

                          <div
                            onClick={() => onDrillGroup && onDrillGroup('Indirect Expenses', fromDate, toDate)}
                            className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-slate-50 cursor-pointer border-b border-slate-100 transition"
                          >
                            <span className="font-semibold text-slate-800">Less: Indirect Expenses</span>
                            <span className="font-mono font-bold text-rose-700">- Nu. {fmt(ie)}</span>
                          </div>

                          <div className={`flex justify-between items-center py-3.5 px-4 rounded-xl font-extrabold text-base border-2 mt-4 shadow-xs ${netProfit >= 0 ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-rose-600 border-rose-700 text-white'}`}>
                            <span className="flex items-center gap-2">
                              <ShieldCheck className="h-5 w-5" />
                              {netProfit >= 0 ? 'NET PROFIT (TRANSFERRED TO CAPITAL)' : 'NET LOSS (DEDUCTED FROM CAPITAL)'}
                            </span>
                            <span className="font-mono text-lg">Nu. {fmt(netProfit)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Balance Sheet */}
                {finSubTab === 'BS' && reportData?.bs && reportData?.pnl && (() => {
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
                  const netEquity = cap + netProfit;
                  const loans = Number(reportData.bs.ln) || 0;
                  const cl = Number(reportData.bs.cl) || 0;

                  const fa = Number(reportData.bs.fa) || 0;
                  const ca = Number(reportData.bs.ca) || 0;
                  const stockVal = Number(reportData.bs.cs) || 0;

                  const totLiabBeforeDiff = netEquity + loans + cl;
                  const totAssetBeforeDiff = fa + ca + stockVal;
                  const diff = totAssetBeforeDiff - totLiabBeforeDiff;

                  const finalTotal = Math.max(totLiabBeforeDiff, totAssetBeforeDiff);
                  const isBalanced = Math.abs(diff) < 0.01;

                  return (
                    <div className="space-y-4 text-xs sm:text-sm">
                      {/* Statement Header Status */}
                      <div className="bg-slate-800 text-white p-3 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-indigo-400" />
                          <div>
                            <span className="font-bold text-sm block">Balance Sheet Statement</span>
                            <span className="text-[11px] text-slate-300">Statement of Financial Position as on {toDate}</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${isBalanced ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                          {isBalanced ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Statement Balanced (Assets = Liabilities)</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4" />
                              <span>Opening Mismatch: Nu. {fmt(Math.abs(diff))}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* T-Account Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* LIABILITIES & CAPITAL */}
                        <div className="border border-slate-200 rounded-2xl bg-slate-50 flex flex-col justify-between shadow-xs">
                          <div>
                            <div className="bg-slate-200 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
                              <span>CAPITAL & LIABILITIES</span>
                              <span className="text-[10px] text-slate-600 uppercase font-semibold">Amount (Nu.)</span>
                            </div>

                            <div className="p-3 space-y-1">
                              {/* Owner's Equity Block */}
                              <div className="border border-slate-200 rounded-xl p-2.5 bg-white space-y-1">
                                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                                  Owner's Equity & Capital
                                </div>
                                <div
                                  onClick={() => onDrillGroup && onDrillGroup('Capital Account', fromDate, toDate)}
                                  className="flex justify-between items-center py-1 px-2 hover:bg-slate-50 rounded cursor-pointer"
                                >
                                  <span className="font-semibold text-slate-700">Opening Capital Account</span>
                                  <span className="font-mono">{fmt(cap)}</span>
                                </div>
                                <div
                                  onClick={() => onDrillGroup && onDrillGroup('Indirect Expenses', fromDate, toDate)}
                                  className={`flex justify-between items-center py-1 px-2 hover:bg-slate-50 rounded cursor-pointer ${netProfit >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}`}
                                >
                                  <span>Add: Net Profit / (Loss) for Period</span>
                                  <span className="font-mono">{netProfit >= 0 ? '+' : ''}{fmt(netProfit)}</span>
                                </div>
                                <div className="flex justify-between items-center py-1 px-2 bg-slate-100 rounded font-bold text-slate-900 border-t border-slate-200 mt-1">
                                  <span>Total Owner's Equity</span>
                                  <span className="font-mono text-indigo-700">{fmt(netEquity)}</span>
                                </div>
                              </div>

                              {/* Liabilities */}
                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Loans & Liabilities', fromDate, toDate)}
                                className="flex justify-between items-center p-2.5 rounded-xl hover:bg-indigo-50/80 cursor-pointer bg-white border border-slate-200 transition"
                              >
                                <span className="font-semibold text-slate-700">Non-Current Loans & Borrowings</span>
                                <span className="font-mono font-bold text-slate-900">{fmt(loans)}</span>
                              </div>

                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Current Liabilities', fromDate, toDate)}
                                className="flex justify-between items-center p-2.5 rounded-xl hover:bg-indigo-50/80 cursor-pointer bg-white border border-slate-200 transition"
                              >
                                <span className="font-semibold text-slate-700">Current Liabilities & Sundry Creditors</span>
                                <span className="font-mono font-bold text-slate-900">{fmt(cl)}</span>
                              </div>

                              {diff > 0.01 && (
                                <div className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                                  <span>Unadjusted Opening Difference</span>
                                  <span className="font-mono">{fmt(diff)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-800 text-white p-3 font-bold text-sm flex justify-between items-center border-t border-slate-900 mt-2">
                            <span>TOTAL CAPITAL & LIABILITIES</span>
                            <span className="font-mono text-base text-emerald-400">Nu. {fmt(finalTotal)}</span>
                          </div>
                        </div>

                        {/* ASSETS */}
                        <div className="border border-slate-200 rounded-2xl bg-slate-50 flex flex-col justify-between shadow-xs">
                          <div>
                            <div className="bg-slate-200 px-4 py-2.5 font-bold text-slate-800 border-b border-slate-300 flex justify-between items-center">
                              <span>ASSETS & PROPERTIES</span>
                              <span className="text-[10px] text-slate-600 uppercase font-semibold">Amount (Nu.)</span>
                            </div>

                            <div className="p-3 space-y-1">
                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Fixed Assets', fromDate, toDate)}
                                className="flex justify-between items-center p-2.5 rounded-xl hover:bg-indigo-50/80 cursor-pointer bg-white border border-slate-200 transition"
                              >
                                <span className="font-semibold text-slate-700">Fixed Assets (Properties & Equipment)</span>
                                <span className="font-mono font-bold text-slate-900">{fmt(fa)}</span>
                              </div>

                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Current Assets', fromDate, toDate)}
                                className="flex justify-between items-center p-2.5 rounded-xl hover:bg-indigo-50/80 cursor-pointer bg-white border border-slate-200 transition"
                              >
                                <span className="font-semibold text-slate-700">Current Assets (Bank, Cash & Sundry Debtors)</span>
                                <span className="font-mono font-bold text-slate-900">{fmt(ca)}</span>
                              </div>

                              <div
                                onClick={() => onDrillGroup && onDrillGroup('Stock Valuation', fromDate, toDate)}
                                className="flex justify-between items-center p-2.5 rounded-xl hover:bg-indigo-50/80 cursor-pointer bg-white border border-slate-200 transition"
                              >
                                <span className="font-semibold text-slate-700">Closing Stock Valuation</span>
                                <span className="font-mono font-bold text-slate-900">{fmt(stockVal)}</span>
                              </div>

                              {diff < -0.01 && (
                                <div className="flex justify-between items-center p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                                  <span>Unadjusted Opening Difference</span>
                                  <span className="font-mono">{fmt(Math.abs(diff))}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-800 text-white p-3 font-bold text-sm flex justify-between items-center border-t border-slate-900 mt-2">
                            <span>TOTAL ASSETS</span>
                            <span className="font-mono text-base text-emerald-400">Nu. {fmt(finalTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {finSubTab === 'REC' && reportData?.rec && (() => {
                  const filteredRec = reportData.rec.filter((r: any) =>
                    (r.name || '').toLowerCase().includes(recSearch.toLowerCase())
                  );
                  const totalRec = reportData.rec.reduce((sum: number, r: any) => sum + (Number(r.amt) || 0), 0);

                  return (
                    <div className="space-y-2.5">
                      {/* Compact Header Strip */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wallet className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-sm text-white">Outstanding Receivables (Sundry Debtors)</span>
                          <span className="text-[11px] text-slate-400">({reportData.rec.length} accounts as of {toDate})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-bold text-slate-400">Total:</span>
                          <span className="text-sm font-extrabold font-mono text-emerald-300">Nu. {fmt(totalRec)}</span>
                        </div>
                      </div>

                      {/* Search & Counter */}
                      <div className="flex items-center justify-between gap-4">
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
                        <span className="text-xs font-semibold text-slate-500">
                          Showing {filteredRec.length} of {reportData.rec.length} accounts
                        </span>
                      </div>

                      {/* Receivables Table */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Debtor / Customer Name</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Outstanding Amount (Nu.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredRec.map((r: any, idx: number) => (
                              <tr
                                key={idx}
                                onClick={() => onDrillLedger(r.name)}
                                className="hover:bg-emerald-50/50 cursor-pointer transition"
                              >
                                <td className="py-2.5 px-3 font-semibold text-slate-800 hover:text-indigo-600 transition">
                                  {r.name}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                                  {fmt(r.amt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-left font-bold uppercase tracking-wider text-xs">TOTAL RECEIVABLES</td>
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
                    <div className="space-y-2.5">
                      {/* Compact Header Strip */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CreditCard className="h-4 w-4 text-rose-400 shrink-0" />
                          <span className="font-bold text-sm text-white">Outstanding Payables (Sundry Creditors)</span>
                          <span className="text-[11px] text-slate-400">({reportData.pay.length} accounts as of {toDate})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-bold text-slate-400">Total:</span>
                          <span className="text-sm font-extrabold font-mono text-rose-400">Nu. {fmt(totalPay)}</span>
                        </div>
                      </div>

                      {/* Search & Counter */}
                      <div className="flex items-center justify-between gap-4">
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
                        <span className="text-xs font-semibold text-slate-500">
                          Showing {filteredPay.length} of {reportData.pay.length} accounts
                        </span>
                      </div>

                      {/* Payables Table */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
                        <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                          <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                            <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Creditor / Supplier Name</th>
                              <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Outstanding Amount (Nu.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredPay.map((p: any, idx: number) => (
                              <tr
                                key={idx}
                                onClick={() => onDrillLedger(p.name)}
                                className="hover:bg-rose-50/50 cursor-pointer transition"
                              >
                                <td className="py-2.5 px-3 font-semibold text-slate-800 hover:text-indigo-600 transition">
                                  {p.name}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 text-sm">
                                  {fmt(p.amt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-30 bg-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200">
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-left font-bold uppercase tracking-wider text-xs">TOTAL PAYABLES</td>
                              <td className="bg-slate-100 bg-clip-padding py-3 px-3 text-right font-mono text-rose-800 text-base font-extrabold">
                                Nu. {fmt(totalPay)}
                              </td>
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
                    const dr = Number(r.Debit) || 0;
                    const cr = Number(r.Credit) || 0;
                    totalDr += dr;
                    totalCr += cr;
                    runningBal = runningBal + dr - cr;
                    return {
                      ...r,
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
                                className="hover:bg-indigo-50/50 cursor-pointer transition"
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
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium">{r.Narration || '-'}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                                  {r.dr ? fmt(r.dr) : ''}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700">
                                  {r.cr ? fmt(r.cr) : ''}
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
      </div>
    </div>
  );
};
