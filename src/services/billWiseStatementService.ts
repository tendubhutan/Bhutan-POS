import { 
  Ledger, 
  Voucher, 
  SalesInvoice, 
  PurchaseInvoice 
} from '../types';
import { 
  loadJson, 
  STORAGE_KEYS, 
  DEFAULT_LEDGERS 
} from './storageService';

export interface BillSettlementRecord {
  voucherNo: string;
  voucherType: string;
  date: string;
  amount: number;
  narration?: string;
}

export interface BillWiseItem {
  id: string;
  billNo: string;
  billDate: string;
  dueDate?: string;
  billType: 'Sales Invoice' | 'Purchase Bill' | 'Opening Balance' | 'Debit Note' | 'Credit Note' | 'Journal Adjustment';
  originalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'Fully Settled' | 'Partially Paid' | 'Unpaid';
  settlements: BillSettlementRecord[];
  daysOverdue: number;
  isOverdue: boolean;
  notes?: string;
}

export interface PartyBillWiseStatement {
  partyName: string;
  group: string;
  partyType: 'debtor' | 'creditor' | 'other';
  contactNo?: string;
  address?: string;
  gstNo?: string;
  totalBilledAmount: number;
  totalSettledAmount: number;
  totalPendingAmount: number;
  totalBillsCount: number;
  settledBillsCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  bills: BillWiseItem[];
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function isPartyLedger(ledgerName: string): boolean {
  if (!ledgerName) return false;
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  const l = ledgers.find(item => item['Ledger Name']?.trim().toLowerCase() === ledgerName.trim().toLowerCase());
  if (!l) return false;
  const g = (l.Group || '').toLowerCase();
  return (
    g.includes('debtor') || 
    g.includes('creditor') || 
    g.includes('customer') || 
    g.includes('supplier') || 
    g.includes('vendor') || 
    g.includes('client') ||
    g.includes('payable') ||
    g.includes('receivable')
  );
}

export function getPartyBillWiseStatement(
  partyLedgerName: string,
  filterStatus?: 'ALL' | 'PENDING' | 'SETTLED'
): PartyBillWiseStatement | null {
  if (!partyLedgerName || !partyLedgerName.trim()) return null;

  const cleanParty = partyLedgerName.trim().toLowerCase();
  const ledgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, DEFAULT_LEDGERS);
  const partyLedger = ledgers.find(l => l['Ledger Name']?.trim().toLowerCase() === cleanParty);

  const groupName = partyLedger?.Group || 'Sundry Debtors';
  const groupLower = groupName.toLowerCase();

  const isDebtor = groupLower.includes('debtor') || groupLower.includes('customer') || groupLower.includes('receivable');
  const isCreditor = groupLower.includes('creditor') || groupLower.includes('supplier') || groupLower.includes('vendor') || groupLower.includes('payable');
  const partyType: 'debtor' | 'creditor' | 'other' = isDebtor ? 'debtor' : isCreditor ? 'creditor' : 'other';

  const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []).filter(s => (s.status as string) !== 'Cancelled');
  const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []).filter(p => (p.status as string) !== 'Cancelled');
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []).filter(v => v.status !== 'Cancelled');

  // Map of settlements: billKey -> Array<BillSettlementRecord>
  const settlementMap = new Map<string, BillSettlementRecord[]>();

  const registerSettlement = (billNo: string, settlement: BillSettlementRecord) => {
    if (!billNo || !billNo.trim() || settlement.amount <= 0) return;
    const key = billNo.trim().toLowerCase();
    const list = settlementMap.get(key) || [];
    list.push(settlement);
    settlementMap.set(key, list);
  };

  // 1. Gather settlements from Vouchers
  vouchers.forEach(v => {
    // Check if this voucher belongs to or affects this party
    const vParty = ((v as any).party || '').trim().toLowerCase();
    const affectsParty = vParty === cleanParty || (v.lines && v.lines.some(l => (l.ledger || '').trim().toLowerCase() === cleanParty));

    if (v.billAllocations && Array.isArray(v.billAllocations)) {
      v.billAllocations.forEach(alloc => {
        if (alloc.billNo && Number(alloc.amount) > 0) {
          registerSettlement(alloc.billNo, {
            voucherNo: v.voucherNo || 'VCH',
            voucherType: v.type === 'R' ? 'Receipt Voucher' : v.type === 'P' ? 'Payment Voucher' : v.type === 'C' ? 'Contra Voucher' : 'Journal Voucher',
            date: v.date || '',
            amount: Number(alloc.amount),
            narration: v.narration
          });
        }
      });
    } else if (v.billNo && Number(v.amount) > 0 && affectsParty) {
      registerSettlement(v.billNo, {
        voucherNo: v.voucherNo || 'VCH',
        voucherType: v.type === 'R' ? 'Receipt Voucher' : v.type === 'P' ? 'Payment Voucher' : 'Voucher',
        date: v.date || '',
        amount: Number(v.amount),
        narration: v.narration
      });
    }
  });

  const rawBills: BillWiseItem[] = [];
  const processedBillKeys = new Set<string>();

  const today = new Date().toISOString().split('T')[0];

  const calcDaysOverdue = (billDateStr: string, dueDateStr?: string): { days: number; isOverdue: boolean } => {
    const targetDateStr = dueDateStr || billDateStr;
    if (!targetDateStr) return { days: 0, isOverdue: false };
    const targetTime = new Date(targetDateStr).getTime();
    const nowTime = new Date(today).getTime();
    if (isNaN(targetTime)) return { days: 0, isOverdue: false };
    const diffDays = Math.floor((nowTime - targetTime) / (1000 * 60 * 60 * 24));
    return {
      days: Math.max(0, diffDays),
      isOverdue: diffDays > 0
    };
  };

  // 2. Process Debtor Bills (Sales Invoices & Opening Balance)
  if (partyType === 'debtor' || partyType === 'other') {
    sales.forEach(s => {
      const cName = (s.customer?.name || '').trim().toLowerCase();
      const cLedger = (s.customer?.ledger || '').trim().toLowerCase();

      if (cName === cleanParty || cLedger === cleanParty) {
        const billNo = s.invoiceNo;
        const key = billNo.trim().toLowerCase();
        processedBillKeys.add(key);

        const originalAmt = Number(s.credit) > 0 
          ? Number(s.credit) 
          : (s.status === 'Credit' || s.status === 'Partial Credit' || ((s as any).paymentMode && (s as any).paymentMode !== 'Cash') ? Number(s.total) : Number(s.total));

        const settlements = settlementMap.get(key) || [];
        const paidAmount = round2(settlements.reduce((sum, item) => sum + item.amount, 0));
        const pendingAmount = Math.max(0, round2(originalAmt - paidAmount));

        let status: BillWiseItem['status'] = 'Unpaid';
        if (pendingAmount <= 0.005) {
          status = 'Fully Settled';
        } else if (paidAmount > 0.005) {
          status = 'Partially Paid';
        }

        const overdueInfo = calcDaysOverdue(s.date, (s as any).dueDate);

        rawBills.push({
          id: `sale-${s.invoiceNo}`,
          billNo: s.invoiceNo,
          billDate: s.date,
          dueDate: (s as any).dueDate,
          billType: 'Sales Invoice',
          originalAmount: round2(originalAmt),
          paidAmount: paidAmount,
          pendingAmount: pendingAmount,
          status,
          settlements,
          daysOverdue: overdueInfo.days,
          isOverdue: overdueInfo.isOverdue && status !== 'Fully Settled',
          notes: (s as any).notes || s.narration
        });
      }
    });
  }

  // 3. Process Creditor Bills (Purchase Invoices & Opening Balance)
  if (partyType === 'creditor' || partyType === 'other') {
    purchases.forEach(p => {
      const sName = (p.supplier?.name || '').trim().toLowerCase();
      const sLedger = (p.supplier?.ledger || '').trim().toLowerCase();

      if (sName === cleanParty || sLedger === cleanParty) {
        const billNo = p.billNo || p.invoiceNo || 'PUR-BILL';
        const key = billNo.trim().toLowerCase();
        processedBillKeys.add(key);

        const originalAmt = Number(p.credit) > 0 
          ? Number(p.credit) 
          : (p.status === 'Credit' || ((p as any).paymentMode && (p as any).paymentMode !== 'Cash') ? Number(p.total) : Number(p.total));

        const settlements = settlementMap.get(key) || [];
        const paidAmount = round2(settlements.reduce((sum, item) => sum + item.amount, 0));
        const pendingAmount = Math.max(0, round2(originalAmt - paidAmount));

        let status: BillWiseItem['status'] = 'Unpaid';
        if (pendingAmount <= 0.005) {
          status = 'Fully Settled';
        } else if (paidAmount > 0.005) {
          status = 'Partially Paid';
        }

        const overdueInfo = calcDaysOverdue(p.date, (p as any).dueDate);

        rawBills.push({
          id: `pur-${billNo}`,
          billNo: billNo,
          billDate: p.date,
          dueDate: (p as any).dueDate,
          billType: 'Purchase Bill',
          originalAmount: round2(originalAmt),
          paidAmount: paidAmount,
          pendingAmount: pendingAmount,
          status,
          settlements,
          daysOverdue: overdueInfo.days,
          isOverdue: overdueInfo.isOverdue && status !== 'Fully Settled',
          notes: (p as any).notes || (p as any).narration
        });
      }
    });
  }

  // 4. Check Ledger Opening Balance if not covered by individual bills
  const opBal = Number(partyLedger?.['Opening Balance']) || 0;
  if (opBal > 0) {
    const obKey = `ob-${cleanParty.slice(0, 10).replace(/[^a-z0-9]/g, '')}`;
    const hasObBill = Array.from(processedBillKeys).some(k => k.startsWith('ob-') || k.includes('opening'));
    
    if (!hasObBill) {
      const settlements = settlementMap.get(obKey) || [];
      const paidAmount = round2(settlements.reduce((sum, item) => sum + item.amount, 0));
      const pendingAmount = Math.max(0, round2(opBal - paidAmount));

      let status: BillWiseItem['status'] = 'Unpaid';
      if (pendingAmount <= 0.005) {
        status = 'Fully Settled';
      } else if (paidAmount > 0.005) {
        status = 'Partially Paid';
      }

      rawBills.unshift({
        id: `ob-${partyLedger?.['Ledger Name']}`,
        billNo: `OB-${partyLedger?.['Ledger Name'].replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`,
        billDate: '2024-04-01',
        billType: 'Opening Balance',
        originalAmount: round2(opBal),
        paidAmount: paidAmount,
        pendingAmount: pendingAmount,
        status,
        settlements,
        daysOverdue: calcDaysOverdue('2024-04-01').days,
        isOverdue: status !== 'Fully Settled',
        notes: 'Opening balance brought forward'
      });
    }
  }

  // Sort bills chronologically descending (newest first)
  rawBills.sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());

  // Aggregate totals
  const totalBilledAmount = round2(rawBills.reduce((sum, b) => sum + b.originalAmount, 0));
  const totalSettledAmount = round2(rawBills.reduce((sum, b) => sum + b.paidAmount, 0));
  const totalPendingAmount = round2(rawBills.reduce((sum, b) => sum + b.pendingAmount, 0));

  const settledBillsCount = rawBills.filter(b => b.status === 'Fully Settled').length;
  const partiallyPaidCount = rawBills.filter(b => b.status === 'Partially Paid').length;
  const unpaidCount = rawBills.filter(b => b.status === 'Unpaid').length;

  let filteredBills = rawBills;
  if (filterStatus === 'PENDING') {
    filteredBills = rawBills.filter(b => b.status !== 'Fully Settled');
  } else if (filterStatus === 'SETTLED') {
    filteredBills = rawBills.filter(b => b.status === 'Fully Settled');
  }

  return {
    partyName: partyLedger?.['Ledger Name'] || partyLedgerName,
    group: groupName,
    partyType,
    contactNo: partyLedger?.['Contact No'],
    address: partyLedger?.Address,
    gstNo: partyLedger?.['GST No'] || partyLedger?.['TPN No'],
    totalBilledAmount,
    totalSettledAmount,
    totalPendingAmount,
    totalBillsCount: rawBills.length,
    settledBillsCount,
    partiallyPaidCount,
    unpaidCount,
    bills: filteredBills
  };
}
