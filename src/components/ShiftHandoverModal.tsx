import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Printer, CheckCircle2, AlertCircle, Clock, Calendar, 
  UserCheck, ArrowRightLeft, DollarSign, FileText, Check, 
  RotateCcw, ShieldCheck, History, Sparkles, Building2
} from 'lucide-react';
import { Config, SalesInvoice, ShiftHandoverRecord } from '../types';
import { 
  getDeduplicatedSales, 
  getActiveUser, 
  getUsers, 
  getDeviceCounterId,
  saveShiftHandoverRecord,
  getShiftHandoverRecords,
  addAuditLog,
  getVouchers
} from '../services/storageService';
import { formatDateDMY } from '../utils/dateUtils';
import { playSuccessChime } from '../utils/audio';

interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  fromDate?: string;
  toDate?: string;
  initialCashier?: string;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  config,
  fromDate,
  toDate,
  initialCashier
}) => {
  const activeUser = getActiveUser();
  const allUsers = useMemo(() => {
    try {
      return getUsers();
    } catch {
      return [];
    }
  }, []);

  const allSales = useMemo(() => {
    if (!isOpen) return [];
    return getDeduplicatedSales();
  }, [isOpen]);

  const allVouchers = useMemo(() => {
    if (!isOpen) return [];
    try {
      return getVouchers();
    } catch {
      return [];
    }
  }, [isOpen]);

  const counterId = getDeviceCounterId() || 'C1';
  const todayStr = new Date().toISOString().split('T')[0];

  const [shiftDate, setShiftDate] = useState<string>(fromDate || todayStr);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Selected Outgoing & Incoming Cashiers
  const [outgoingCashier, setOutgoingCashier] = useState<string>(() => {
    return initialCashier || activeUser?.fullName || activeUser?.username || 'Store Cashier';
  });
  const [incomingCashier, setIncomingCashier] = useState<string>('');
  const [shiftName, setShiftName] = useState<string>('Day Shift / Handover');
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  // Cash Float & Denominations
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '1000': 0,
    '500': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '1': 0
  });
  const [useManualCash, setUseManualCash] = useState<boolean>(false);
  const [manualCountedCash, setManualCountedCash] = useState<string>('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Past Shift History
  const [pastRecords, setPastRecords] = useState<ShiftHandoverRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      try {
        setPastRecords(getShiftHandoverRecords() || []);
      } catch {
        setPastRecords([]);
      }
      setSavedSuccessMsg(null);
      if (initialCashier) {
        setOutgoingCashier(initialCashier);
      }
      if (fromDate) {
        setShiftDate(fromDate);
      }
    }
  }, [isOpen, initialCashier, fromDate]);

  // Extract all cashiers from users + sales
  const availableCashierOptions = useMemo(() => {
    const fromUsers = allUsers.map(u => (u.fullName || u.username || '').trim()).filter(Boolean);
    const fromSales = allSales.map(s => (s.userName || s.cashierName || (s as any).createdBy || '').trim()).filter(Boolean);
    return Array.from(new Set([...fromUsers, ...fromSales, 'Store Cashier'])).sort();
  }, [allUsers, allSales]);

  // Filter sales for the selected date and cashier
  const shiftSales = useMemo(() => {
    const fr = new Date(shiftDate).setHours(0, 0, 0, 0);
    const toDt = new Date(shiftDate).setHours(23, 59, 59, 999);
    const targetUser = outgoingCashier.trim().toLowerCase();

    return allSales.filter(s => {
      const d = new Date(s.date).getTime();
      if (d < fr || d > toDt) return false;
      if (s.status === 'Cancelled') return false;

      if (outgoingCashier && outgoingCashier !== 'ALL') {
        const u = (s.userName || s.cashierName || (s as any).waiterName || (s as any).createdBy || 'Store Cashier').trim().toLowerCase();
        return u === targetUser;
      }
      return true;
    });
  }, [allSales, shiftDate, outgoingCashier]);

  // Cash Returns (Credit Notes) for the shift
  const cashReturns = useMemo(() => {
    const fr = new Date(shiftDate).setHours(0, 0, 0, 0);
    const toDt = new Date(shiftDate).setHours(23, 59, 59, 999);
    const targetUser = outgoingCashier.trim().toLowerCase();

    let retSum = 0;
    allVouchers.forEach((v: any) => {
      const vType = v.type as any;
      if (vType !== 'CN' && vType !== 'Credit Note' && v.voucherTypeName !== 'Credit Note' && vType !== 'Sales Return') return;
      if (v.status === 'Cancelled') return;
      const rawDate = v.DateIso || v.date || v.Date;
      if (!rawDate) return;
      const d = new Date(rawDate).getTime();
      if (isNaN(d) || d < fr || d > toDt) return;

      if (outgoingCashier && outgoingCashier !== 'ALL') {
        const u = (v.userName || v.createdBy || 'Store Cashier').trim().toLowerCase();
        if (u !== targetUser) return;
      }

      const party = (v.partyName || v.debitLedger || v.creditLedger || '').toLowerCase();
      if (party.includes('cash')) {
        retSum += Number(v.amount || v.totalAmount || 0);
      }
    });

    return Math.round(retSum * 100) / 100;
  }, [allVouchers, shiftDate, outgoingCashier]);

  // Aggregate Metrics for this shift
  const metrics = useMemo(() => {
    let totalCash = 0;
    let totalBank1 = 0;
    let totalBank2 = 0;
    let totalCredit = 0;
    let totalSales = 0;

    shiftSales.forEach(s => {
      totalCash += Number(s.cash || 0);
      totalBank1 += Number(s.bank1 || 0);
      totalBank2 += Number(s.bank2 || 0);
      totalCredit += Number(s.credit || 0);
      totalSales += Number(s.total || 0);
    });

    const firstInvoice = shiftSales.length > 0 ? shiftSales[0].invoiceNo : '-';
    const lastInvoice = shiftSales.length > 0 ? shiftSales[shiftSales.length - 1].invoiceNo : '-';

    return {
      billCount: shiftSales.length,
      firstInvoice,
      lastInvoice,
      cash: Math.round(totalCash * 100) / 100,
      bank1: Math.round(totalBank1 * 100) / 100,
      bank2: Math.round(totalBank2 * 100) / 100,
      credit: Math.round(totalCredit * 100) / 100,
      total: Math.round(totalSales * 100) / 100
    };
  }, [shiftSales]);

  // Calculate actual cash from denominations
  const calculatedDenomCash = useMemo(() => {
    let sum = 0;
    sum += (denominations['1000'] || 0) * 1000;
    sum += (denominations['500'] || 0) * 500;
    sum += (denominations['100'] || 0) * 100;
    sum += (denominations['50'] || 0) * 50;
    sum += (denominations['20'] || 0) * 20;
    sum += (denominations['10'] || 0) * 10;
    sum += (denominations['5'] || 0) * 5;
    sum += (denominations['1'] || 0) * 1;
    return sum;
  }, [denominations]);

  const actualCountedCash = useMemo(() => {
    if (useManualCash) {
      return Number(manualCountedCash) || 0;
    }
    return calculatedDenomCash;
  }, [useManualCash, manualCountedCash, calculatedDenomCash]);

  // Net expected cash in physical drawer
  const expectedCashInDrawer = useMemo(() => {
    return Math.round((openingFloat + metrics.cash - cashReturns) * 100) / 100;
  }, [openingFloat, metrics.cash, cashReturns]);

  // Variance / Difference
  const cashDifference = useMemo(() => {
    return Math.round((actualCountedCash - expectedCashInDrawer) * 100) / 100;
  }, [actualCountedCash, expectedCashInDrawer]);

  const handleDenomChange = (valStr: string, noteKey: string) => {
    const qty = parseInt(valStr, 10);
    setDenominations(prev => ({
      ...prev,
      [noteKey]: isNaN(qty) || qty < 0 ? 0 : qty
    }));
  };

  const handleSaveHandover = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const record: ShiftHandoverRecord = {
      id: `SH-${Date.now()}`,
      companyId: config.CompanyName || undefined,
      timestamp: now.toISOString(),
      date: shiftDate,
      time: timeStr,
      terminalId: counterId,
      outgoingCashierName: outgoingCashier,
      incomingCashierName: incomingCashier || 'Next Shift Cashier',
      shiftName,
      openingCashFloat: openingFloat,
      cashSales: metrics.cash,
      bank1Sales: metrics.bank1,
      bank2Sales: metrics.bank2,
      creditSales: metrics.credit,
      totalSales: metrics.total,
      cashReturns,
      netCashExpected: expectedCashInDrawer,
      actualCashCounted: actualCountedCash,
      cashDifference,
      denominations,
      totalBills: metrics.billCount,
      firstInvoiceNo: metrics.firstInvoice,
      lastInvoiceNo: metrics.lastInvoice,
      remarks: handoverNotes
    };

    saveShiftHandoverRecord(record);
    try {
      addAuditLog({
        action: 'ENTERED',
        module: 'Shift Handover' as any,
        recordId: record.id,
        amount: metrics.total,
        details: `Shift Handover by ${outgoingCashier} to ${record.incomingCashierName}. Expected: Nu. ${expectedCashInDrawer}, Counted: Nu. ${actualCountedCash}, Variance: Nu. ${cashDifference}`
      });
    } catch {
      // ignore
    }

    playSuccessChime();
    setSavedSuccessMsg('Shift Handover & Day-End Closing recorded successfully!');
    setPastRecords(getShiftHandoverRecords());
    setTimeout(() => setSavedSuccessMsg(null), 4000);
  };

  const printThermalHandover = (rec?: ShiftHandoverRecord) => {
    const r = rec || {
      id: `SH-${Date.now()}`,
      date: shiftDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      terminalId: counterId,
      outgoingCashierName: outgoingCashier,
      incomingCashierName: incomingCashier || 'Next Shift Cashier',
      shiftName,
      openingCashFloat: openingFloat,
      cashSales: metrics.cash,
      bank1Sales: metrics.bank1,
      bank2Sales: metrics.bank2,
      creditSales: metrics.credit,
      totalSales: metrics.total,
      cashReturns,
      netCashExpected: expectedCashInDrawer,
      actualCashCounted: actualCountedCash,
      cashDifference,
      denominations,
      totalBills: metrics.billCount,
      firstInvoiceNo: metrics.firstInvoice,
      lastInvoiceNo: metrics.lastInvoice,
      remarks: handoverNotes
    };

    const diffText = r.cashDifference === 0 
      ? '0.00 (EXACT)' 
      : r.cashDifference > 0 
      ? `+${r.cashDifference.toFixed(2)} (SURPLUS)` 
      : `${r.cashDifference.toFixed(2)} (SHORTAGE)`;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shift Handover - ${r.id}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: monospace, Courier, sans-serif; font-size: 11px; margin: 0; padding: 2mm; width: 72mm; color: #000; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .line { border-top: 1px dashed #000; margin: 4px 0; }
          .double-line { border-top: 2px solid #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 13px;">${config.CompanyName || 'RETAIL POS'}</div>
        <div class="center" style="font-size: 10px;">${config.CompanyAddress || ''}</div>
        <div class="line"></div>
        <div class="center bold" style="font-size: 12px;">CASHIER SHIFT HANDOVER / DAY END</div>
        <div class="line"></div>
        <div class="row"><span>Date:</span><span>${formatDateDMY(r.date)}</span></div>
        <div class="row"><span>Time:</span><span>${r.time}</span></div>
        <div class="row"><span>Terminal:</span><span>${r.terminalId}</span></div>
        <div class="row"><span>Shift:</span><span>${r.shiftName || 'Day Shift'}</span></div>
        <div class="row"><span>Outgoing:</span><span class="bold">${r.outgoingCashierName}</span></div>
        <div class="row"><span>Incoming:</span><span class="bold">${r.incomingCashierName}</span></div>
        <div class="line"></div>
        <div class="row"><span>Total Bills:</span><span class="bold">${r.totalBills}</span></div>
        <div class="row"><span>First Bill:</span><span>${r.firstInvoiceNo || '-'}</span></div>
        <div class="row"><span>Last Bill:</span><span>${r.lastInvoiceNo || '-'}</span></div>
        <div class="line"></div>
        <div class="row"><span>Opening Float:</span><span>${r.openingCashFloat.toFixed(2)}</span></div>
        <div class="row"><span>Cash Sales:</span><span>${r.cashSales.toFixed(2)}</span></div>
        <div class="row"><span>${config.Bank1Ledger || 'Bank 1'}:</span><span>${r.bank1Sales.toFixed(2)}</span></div>
        <div class="row"><span>${config.Bank2Ledger || 'Bank 2'}:</span><span>${r.bank2Sales.toFixed(2)}</span></div>
        <div class="row"><span>Credit Sales:</span><span>${r.creditSales.toFixed(2)}</span></div>
        <div class="row bold"><span>Total Sales:</span><span>${r.totalSales.toFixed(2)}</span></div>
        ${r.cashReturns > 0 ? `<div class="row"><span>Less Returns:</span><span>-${r.cashReturns.toFixed(2)}</span></div>` : ''}
        <div class="line"></div>
        <div class="row bold"><span>Expected Cash:</span><span>Nu. ${r.netCashExpected.toFixed(2)}</span></div>
        <div class="row bold"><span>Counted Cash:</span><span>Nu. ${r.actualCashCounted.toFixed(2)}</span></div>
        <div class="row bold"><span>Variance:</span><span>Nu. ${diffText}</span></div>
        <div class="line"></div>
        <div class="bold">Denominations:</div>
        ${Object.entries(r.denominations || {})
          .filter(([_, count]) => count > 0)
          .map(([note, count]) => `<div class="row"><span>Nu. ${note} x ${count}</span><span>${(Number(note) * count).toFixed(2)}</span></div>`)
          .join('')}
        ${r.remarks ? `<div class="line"></div><div>Notes: ${r.remarks}</div>` : ''}
        <div class="double-line"></div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 45%;">
            <div>_________________</div>
            <div style="font-size: 9px;">Outgoing Signature</div>
          </div>
          <div style="text-align: center; width: 45%;">
            <div>_________________</div>
            <div style="font-size: 9px;">Incoming Signature</div>
          </div>
        </div>
        <div class="center" style="margin-top: 15px; font-size: 9px;">Powered by Enterprise POS &amp; Accounting</div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=350,height=550');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 300);
    }
  };

  const printA4Statement = (rec?: ShiftHandoverRecord) => {
    const r = rec || {
      id: `SH-${Date.now()}`,
      date: shiftDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      terminalId: counterId,
      outgoingCashierName: outgoingCashier,
      incomingCashierName: incomingCashier || 'Next Shift Cashier',
      shiftName,
      openingCashFloat: openingFloat,
      cashSales: metrics.cash,
      bank1Sales: metrics.bank1,
      bank2Sales: metrics.bank2,
      creditSales: metrics.credit,
      totalSales: metrics.total,
      cashReturns,
      netCashExpected: expectedCashInDrawer,
      actualCashCounted: actualCountedCash,
      cashDifference,
      denominations,
      totalBills: metrics.billCount,
      firstInvoiceNo: metrics.firstInvoice,
      lastInvoiceNo: metrics.lastInvoice,
      remarks: handoverNotes
    };

    const diffBadge = r.cashDifference === 0 
      ? '<span style="color: green; font-weight: bold;">Nu. 0.00 (Balanced / Exact Match)</span>'
      : r.cashDifference > 0 
      ? `<span style="color: blue; font-weight: bold;">+Nu. ${r.cashDifference.toFixed(2)} (Cash Surplus)</span>`
      : `<span style="color: red; font-weight: bold;">-Nu. ${Math.abs(r.cashDifference).toFixed(2)} (Cash Shortage)</span>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shift Handover & Day End Report - ${r.date}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 15px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
          .subtitle { font-size: 13px; font-weight: 700; color: #475569; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px; }
          .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
          .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .table th, .table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          .table th { background: #e2e8f0; font-weight: 700; font-size: 11px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { width: 45%; text-align: center; }
          .sig-line { border-top: 1px solid #000; margin-top: 30px; padding-top: 5px; font-weight: 700; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${config.CompanyName || 'BUSINESS ENTERPRISE'}</div>
          <div>${config.CompanyAddress || ''} | Phone: ${config.CompanyPhone || '-'}</div>
          <div class="subtitle" style="margin-top: 5px;">CASHIER SHIFT HANDOVER &amp; DAY-END CLOSING STATEMENT</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Shift &amp; Terminal Details</div>
            <div class="row"><span>Handover ID:</span><strong>${r.id}</strong></div>
            <div class="row"><span>Date &amp; Time:</span><span>${formatDateDMY(r.date)} at ${r.time}</span></div>
            <div class="row"><span>Terminal / Counter:</span><span>${r.terminalId}</span></div>
            <div class="row"><span>Shift Name:</span><span>${r.shiftName || 'Day Shift'}</span></div>
            <div class="row"><span>Outgoing Cashier:</span><strong>${r.outgoingCashierName}</strong></div>
            <div class="row"><span>Incoming Cashier:</span><strong>${r.incomingCashierName}</strong></div>
          </div>
          <div class="card">
            <div class="card-title">Billing &amp; Invoice Summary</div>
            <div class="row"><span>Total Invoices Billed:</span><strong>${r.totalBills}</strong></div>
            <div class="row"><span>First Invoice No:</span><span>${r.firstInvoiceNo || '-'}</span></div>
            <div class="row"><span>Last Invoice No:</span><span>${r.lastInvoiceNo || '-'}</span></div>
            <div class="row"><span>Cash Sales:</span><span>Nu. ${r.cashSales.toFixed(2)}</span></div>
            <div class="row"><span>${config.Bank1Ledger || 'Bank 1'}:</span><span>Nu. ${r.bank1Sales.toFixed(2)}</span></div>
            <div class="row"><span>${config.Bank2Ledger || 'Bank 2'}:</span><span>Nu. ${r.bank2Sales.toFixed(2)}</span></div>
            <div class="row"><span>Credit / Ledger:</span><span>Nu. ${r.creditSales.toFixed(2)}</span></div>
            <div class="row" style="font-weight: 800; border-top: 1px solid #cbd5e1; padding-top: 4px;">
              <span>Total Shift Revenue:</span><span>Nu. ${r.totalSales.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 15px;">
          <div class="card-title">Cash Drawer Reconciliation</div>
          <table class="table">
            <tbody>
              <tr><td>Opening Cash Float (Initial Drawer Cash)</td><td style="text-align: right; font-weight: 700;">Nu. ${r.openingCashFloat.toFixed(2)}</td></tr>
              <tr><td>(+) Cash Sales Collected</td><td style="text-align: right; font-weight: 700;">+ Nu. ${r.cashSales.toFixed(2)}</td></tr>
              ${r.cashReturns > 0 ? `<tr><td>(-) Cash Returns / Credit Note Refunds</td><td style="text-align: right; color: red;">- Nu. ${r.cashReturns.toFixed(2)}</td></tr>` : ''}
              <tr style="background: #f1f5f9; font-weight: 800;">
                <td>(=) Net Physical Cash Expected in Drawer</td>
                <td style="text-align: right; font-size: 13px;">Nu. ${r.netCashExpected.toFixed(2)}</td>
              </tr>
              <tr style="background: #e2e8f0; font-weight: 800;">
                <td>Actual Physical Cash Counted</td>
                <td style="text-align: right; font-size: 13px;">Nu. ${r.actualCashCounted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cash Reconciliation Variance</td>
                <td style="text-align: right; font-size: 13px;">${diffBadge}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-bottom: 15px;">
          <div class="card-title">Physical Cash Denomination Breakdown</div>
          <table class="table">
            <thead>
              <tr><th>Denomination</th><th>Count / Pieces</th><th style="text-align: right;">Total Amount (Nu.)</th></tr>
            </thead>
            <tbody>
              ${['1000', '500', '100', '50', '20', '10', '5', '1'].map(note => {
                const count = r.denominations?.[note] || 0;
                return `
                  <tr>
                    <td>Nu. ${note}</td>
                    <td>${count}</td>
                    <td style="text-align: right;">Nu. ${(Number(note) * count).toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background: #f1f5f9; font-weight: 800;">
                <td colspan="2">TOTAL PHYSICAL COUNT</td>
                <td style="text-align: right;">Nu. ${r.actualCashCounted.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${r.remarks ? `<div class="card"><div class="card-title">Handover Remarks</div><p>${r.remarks}</p></div>` : ''}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">Outgoing Cashier: ${r.outgoingCashierName}</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Incoming Cashier: ${r.incomingCashierName}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 350);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs">
      <div className="flex h-full max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
              <ArrowRightLeft className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">Cashier Shift Handover &amp; Day-End Closing</h2>
                <span className="rounded-lg bg-indigo-500/30 border border-indigo-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  Terminal {counterId}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconcile physical cash, verify payment mode collections, and record cashier drawer handover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'current'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Active Shift Closing &amp; Reconciliation</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Past Handover History ({pastRecords.length})</span>
          </button>
        </div>

        {savedSuccessMsg && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === 'current' ? (
            <>
              {/* Parameters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Shift Date</span>
                  </label>
                  <input
                    type="date"
                    value={shiftDate}
                    onChange={e => setShiftDate(e.target.value)}
                    className="w-full h-8.5 rounded-xl border border-slate-300 bg-white px-2.5 font-semibold text-slate-800 text-xs outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Outgoing Cashier</span>
                  </label>
                  <select
                    value={outgoingCashier}
                    onChange={e => setOutgoingCashier(e.target.value)}
                    className="w-full h-8.5 rounded-xl border border-slate-300 bg-white px-2.5 font-bold text-slate-800 text-xs outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="ALL">All Cashiers Combined (Store Day-End)</option>
                    {availableCashierOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Incoming Cashier</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Next Cashier Name"
                    value={incomingCashier}
                    onChange={e => setIncomingCashier(e.target.value)}
                    className="w-full h-8.5 rounded-xl border border-slate-300 bg-white px-2.5 font-semibold text-slate-800 text-xs outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Shift Type</span>
                  </label>
                  <select
                    value={shiftName}
                    onChange={e => setShiftName(e.target.value)}
                    className="w-full h-8.5 rounded-xl border border-slate-300 bg-white px-2.5 font-semibold text-slate-800 text-xs outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="Day Shift / Handover">Day Shift / Handover</option>
                    <option value="Morning Shift (Shift 1)">Morning Shift (Shift 1)</option>
                    <option value="Evening Shift (Shift 2)">Evening Shift (Shift 2)</option>
                    <option value="Night Shift (Shift 3)">Night Shift (Shift 3)</option>
                    <option value="Full Day Closing">Full Day Closing</option>
                  </select>
                </div>
              </div>

              {/* KPI Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500">Total Bills</div>
                  <div className="text-base font-extrabold text-slate-900 mt-0.5">{metrics.billCount}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{metrics.firstInvoice} → {metrics.lastInvoice}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-emerald-800">Cash Sales</div>
                  <div className="text-base font-extrabold text-emerald-950 mt-0.5">Nu. {metrics.cash.toFixed(2)}</div>
                  <div className="text-[10px] text-emerald-600 mt-0.5 font-semibold">Physical Cash</div>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-800 truncate">{config.Bank1Ledger || 'Bank 1'}</div>
                  <div className="text-base font-extrabold text-indigo-950 mt-0.5">Nu. {metrics.bank1.toFixed(2)}</div>
                  <div className="text-[10px] text-indigo-600 mt-0.5 font-semibold">Digital / QR</div>
                </div>
                <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-2xs">
                  <div className="text-[11px] font-bold text-purple-800 truncate">{config.Bank2Ledger || 'Bank 2'}</div>
                  <div className="text-base font-extrabold text-purple-950 mt-0.5">Nu. {metrics.bank2.toFixed(2)}</div>
                  <div className="text-[10px] text-purple-600 mt-0.5 font-semibold">Bank Transfer</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-xs col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-bold text-slate-300">Total Revenue</div>
                  <div className="text-base font-extrabold text-white mt-0.5">Nu. {metrics.total.toFixed(2)}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Credit: Nu. {metrics.credit.toFixed(2)}</div>
                </div>
              </div>

              {/* Cash Reconciliation & Denominations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Reconciliation Math */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Drawer Cash Reconciliation
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">Currency: Nu. / BTN</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Opening Cash Float:</span>
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-slate-400 font-mono text-xs">Nu.</span>
                        <input
                          type="number"
                          step="any"
                          value={openingFloat || ''}
                          onChange={e => setOpeningFloat(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full h-7 rounded-lg border border-slate-300 px-2 text-right font-mono font-bold text-slate-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-700">
                      <span>(+) Shift Cash Sales Collected:</span>
                      <span className="font-mono font-bold text-emerald-700">+ Nu. {metrics.cash.toFixed(2)}</span>
                    </div>

                    {cashReturns > 0 && (
                      <div className="flex items-center justify-between text-rose-700">
                        <span>(-) Cash Returns / Refunds:</span>
                        <span className="font-mono font-bold">- Nu. {cashReturns.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-900">(=) Expected Cash in Drawer:</span>
                      <span className="font-mono font-black text-slate-900 text-sm">
                        Nu. {expectedCashInDrawer.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-bold text-indigo-900">Actual Counted Physical Cash:</span>
                      <span className="font-mono font-black text-indigo-700 text-sm">
                        Nu. {actualCountedCash.toFixed(2)}
                      </span>
                    </div>

                    {/* Variance Banner */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      cashDifference === 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : cashDifference > 0
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      <div>
                        <div className="font-extrabold text-xs">
                          {cashDifference === 0 ? 'Exact Match (Balanced)' : cashDifference > 0 ? 'Cash Surplus (Excess)' : 'Cash Shortage (Deficit)'}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {cashDifference === 0 ? 'Counted cash equals expected cash' : 'Verify physical bills and float amount'}
                        </div>
                      </div>
                      <div className="font-mono font-black text-sm">
                        {cashDifference > 0 ? `+Nu. ${cashDifference.toFixed(2)}` : `Nu. ${cashDifference.toFixed(2)}`}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Handover Remarks / Notes
                    </label>
                    <textarea
                      rows={2}
                      value={handoverNotes}
                      onChange={e => setHandoverNotes(e.target.value)}
                      placeholder="e.g. Drawer keys handed over, petty cash receipt attached..."
                      className="w-full rounded-xl border border-slate-300 p-2 font-medium text-slate-800 text-xs outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Right Card: Denomination Counter */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-indigo-600" />
                      Physical Denomination Breakdown
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseManualCash(!useManualCash)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {useManualCash ? 'Use Bill Counter' : 'Enter Total Directly'}
                    </button>
                  </div>

                  {useManualCash ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-700">Total Counted Cash (Nu.)</label>
                      <input
                        type="number"
                        step="any"
                        value={manualCountedCash}
                        onChange={e => setManualCountedCash(e.target.value)}
                        placeholder="Enter total physical cash"
                        className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-sm text-slate-900 outline-none focus:border-indigo-600"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {['1000', '500', '100', '50', '20', '10', '5', '1'].map(note => {
                        const count = denominations[note] || 0;
                        const sub = Number(note) * count;
                        return (
                          <div key={note} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/70 transition">
                            <span className="font-bold text-slate-700 w-16">Nu. {note}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 text-[10px]">×</span>
                              <input
                                type="number"
                                min="0"
                                value={count || ''}
                                onChange={e => handleDenomChange(e.target.value, note)}
                                placeholder="0"
                                className="w-16 h-6.5 rounded-md border border-slate-300 text-center font-mono font-bold text-slate-800 text-xs outline-none focus:border-indigo-600 bg-white"
                              />
                            </div>
                            <span className="font-mono font-semibold text-slate-900 text-right w-24">
                              Nu. {sub.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-extrabold text-slate-900">
                    <span>Total Denominations Count:</span>
                    <span className="font-mono text-sm text-indigo-700">
                      Nu. {calculatedDenomCash.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {pastRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <History className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold">No past handover records found.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Complete your active shift handover to save an audit record.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date &amp; Time</th>
                        <th className="py-2.5 px-3">Outgoing Cashier</th>
                        <th className="py-2.5 px-3">Incoming Cashier</th>
                        <th className="py-2.5 px-3 text-center">Bills</th>
                        <th className="py-2.5 px-3 text-right">Total Sales</th>
                        <th className="py-2.5 px-3 text-right">Expected</th>
                        <th className="py-2.5 px-3 text-right">Counted</th>
                        <th className="py-2.5 px-3 text-right">Variance</th>
                        <th className="py-2.5 px-3 text-center">Print</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pastRecords.map((r, idx) => {
                        const diff = Number(r.cashDifference) || 0;
                        return (
                          <tr key={r.id || idx} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 font-mono text-slate-600">
                              <div>{formatDateDMY(r.date)}</div>
                              <div className="text-[10px] text-slate-400">{r.time}</div>
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">{r.outgoingCashierName}</td>
                            <td className="py-2 px-3 font-medium text-slate-700">{r.incomingCashierName}</td>
                            <td className="py-2 px-3 text-center font-mono">{r.totalBills}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              Nu. {Number(r.totalSales || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              Nu. {Number(r.netCashExpected || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                              Nu. {Number(r.actualCashCounted || 0).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {diff === 0 ? (
                                <span className="text-emerald-700">0.00</span>
                              ) : diff > 0 ? (
                                <span className="text-blue-700">+{diff.toFixed(2)}</span>
                              ) : (
                                <span className="text-rose-700">{diff.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => printThermalHandover(r)}
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title="Print Thermal Slip"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => printA4Statement(r)}
                                  className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                                  title="Print A4 Statement"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => printThermalHandover()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-bold text-xs text-slate-700 transition shadow-2xs cursor-pointer"
              title="Print 80mm / 58mm Thermal Slip for POS receipt printers"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Thermal Slip (80mm)</span>
            </button>
            <button
              type="button"
              onClick={() => printA4Statement()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 font-bold text-xs text-indigo-700 transition shadow-2xs cursor-pointer"
              title="Print standard A4 / PDF Shift Closing Report"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
              <span>A4 Statement</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-bold text-xs text-slate-700 transition cursor-pointer"
            >
              Close (Esc)
            </button>
            {activeTab === 'current' && (
              <button
                type="button"
                onClick={handleSaveHandover}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white transition shadow-md active:scale-95 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Save &amp; Record Shift Handover</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
