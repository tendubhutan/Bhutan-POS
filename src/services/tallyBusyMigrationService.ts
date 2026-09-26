import * as XLSX from 'xlsx';
import { 
  Ledger, 
  Item, 
  ItemGroup, 
  Unit, 
  LedgerGroup, 
  Voucher, 
  ItemBatch, 
  SalesInvoice, 
  PurchaseInvoice 
} from '../types';
import { 
  loadJson, 
  saveJson, 
  STORAGE_KEYS, 
  recalculateLedgerBalances 
} from './storageService';
import { syncLedgerToSupabase, syncItemToSupabase } from './supabaseSyncService';

export type MigrationSource = 'tally' | 'busy';
export type MigrationMode = 'cutoff_opening' | 'full_historical';

export interface MigrationOpeningBill {
  partyName: string;
  partyType: 'debtor' | 'creditor';
  billNo: string;
  billDate: string;
  dueDate?: string;
  amount: number;
}

export interface MigrationStats {
  totalLedgers: number;
  totalDebtors: number;
  totalCreditors: number;
  totalOpeningDr: number;
  totalOpeningCr: number;
  drCrDifference: number;
  totalItems: number;
  totalStockQty: number;
  totalStockValue: number;
  totalPendingBills: number;
  totalPendingBillsAmount: number;
  totalHistoricalVouchers: number;
  serialNumbersCount: number;
}

export interface MigrationParsedData {
  source: MigrationSource;
  mode: MigrationMode;
  sourceFileName: string;
  companyName?: string;
  booksBeginningFrom?: string;
  ledgers: Ledger[];
  ledgerGroups: LedgerGroup[];
  items: Item[];
  itemGroups: ItemGroup[];
  units: Unit[];
  openingBills: MigrationOpeningBill[];
  vouchers: Voucher[];
  stats: MigrationStats;
  warnings: string[];
  errors: string[];
}

export interface MigrationOptions {
  mergeOrReplace: 'merge' | 'replace';
  createMissingGroups: boolean;
  createOpeningBillsAsPending: boolean;
  targetCompanyId?: string;
}

export interface MigrationResult {
  success: boolean;
  importedLedgers: number;
  importedItems: number;
  importedOpeningBills: number;
  importedVouchers: number;
  message: string;
  warnings: string[];
}

// -------------------------------------------------------------
// HELPER: Map Tally / Busy Groups to Standard Master Groups
// -------------------------------------------------------------
export function normalizeAccountGroup(rawGroup: string): string {
  if (!rawGroup || !rawGroup.trim()) return 'Sundry Debtors';
  const g = rawGroup.trim().toLowerCase();

  if (g.includes('debtor') || g.includes('customer') || g.includes('receivable')) {
    return 'Sundry Debtors';
  }
  if (g.includes('creditor') || g.includes('supplier') || g.includes('vendor') || g.includes('payable')) {
    return 'Sundry Creditors';
  }
  if (g.includes('bank') && (g.includes('od') || g.includes('occ') || g.includes('overdraft'))) {
    return 'Bank OD/OCC A/c';
  }
  if (g.includes('bank')) {
    return 'Bank Accounts';
  }
  if (g.includes('cash')) {
    return 'Cash-in-Hand';
  }
  if (g.includes('sale return')) {
    return 'Sales Return';
  }
  if (g.includes('purchase return')) {
    return 'Purchase Return';
  }
  if (g.includes('sales')) {
    return 'Sales Accounts';
  }
  if (g.includes('purchase')) {
    return 'Purchase Accounts';
  }
  if (g.includes('direct exp') || g.includes('manufacturing exp') || g.includes('wages') || g.includes('carriage inward')) {
    return 'Direct Expenses';
  }
  if (g.includes('indirect exp') || g.includes('office exp') || g.includes('admin') || g.includes('salary') || g.includes('rent')) {
    return 'Indirect Expenses';
  }
  if (g.includes('direct inc')) {
    return 'Direct Incomes';
  }
  if (g.includes('indirect inc') || g.includes('discount received') || g.includes('interest rec')) {
    return 'Indirect Incomes';
  }
  if (g.includes('fixed asset') || g.includes('machinery') || g.includes('furniture') || g.includes('vehicle') || g.includes('computer')) {
    return 'Fixed Assets';
  }
  if (g.includes('current asset') || g.includes('deposit') || g.includes('loan & advance')) {
    return 'Current Assets';
  }
  if (g.includes('current liab') || g.includes('duties') || g.includes('taxes') || g.includes('gst')) {
    return 'Duties & Taxes';
  }
  if (g.includes('capital') || g.includes('partner') || g.includes('proprietor') || g.includes('drawing')) {
    return 'Capital Account';
  }
  if (g.includes('loan') || g.includes('secured') || g.includes('unsecured')) {
    return 'Loans (Liability)';
  }
  if (g.includes('investment')) {
    return 'Investments';
  }

  // Preserve exact group if already exists or capitalized
  return rawGroup.trim();
}

export function parseTallyDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const clean = dateStr.trim();
  // YYYYMMDD e.g. 20240401
  if (/^\d{8}$/.test(clean)) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return `${y}-${m}-${d}`;
  }
  // DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  // Try Date parse
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// -------------------------------------------------------------
// 1. TALLY XML PARSER
// -------------------------------------------------------------
export function parseTallyXml(xmlString: string, mode: MigrationMode = 'cutoff_opening', fileName: string = 'TallyExport.xml'): MigrationParsedData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parsing error: ${parseError.textContent?.slice(0, 200)}`);
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  const ledgers: Ledger[] = [];
  const ledgerGroups: LedgerGroup[] = [];
  const items: Item[] = [];
  const itemGroups: ItemGroup[] = [];
  const units: Unit[] = [];
  const openingBills: MigrationOpeningBill[] = [];
  const vouchers: Voucher[] = [];

  // Check company info if present
  let companyName: string | undefined;
  const companyNode = xmlDoc.querySelector('COMPANY, SVCCOMPANY');
  if (companyNode) {
    companyName = companyNode.getAttribute('NAME') || companyNode.querySelector('NAME')?.textContent?.trim() || undefined;
  }

  // 1. Parse Groups <GROUP>
  const groupNodes = xmlDoc.querySelectorAll('GROUP');
  groupNodes.forEach(node => {
    const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent?.trim();
    if (!name) return;
    const parent = node.querySelector('PARENT')?.textContent?.trim() || '';
    const isDeemedPositive = node.querySelector('ISDEEMEDPOSITIVE')?.textContent?.trim().toLowerCase() === 'yes';
    
    let nature: LedgerGroup['Nature'] = 'Asset';
    const lower = name.toLowerCase();
    if (lower.includes('income') || lower.includes('sales')) nature = 'Income';
    else if (lower.includes('expens') || lower.includes('purchase')) nature = 'Expense';
    else if (lower.includes('liabilit') || lower.includes('creditor') || lower.includes('capital')) nature = 'Liability';
    else if (lower.includes('capital')) nature = 'Capital';

    ledgerGroups.push({
      'Group Name': name,
      'Parent Group': parent || undefined,
      Nature: nature
    });
  });

  // 2. Parse Units <UNIT>
  const unitNodes = xmlDoc.querySelectorAll('UNIT');
  unitNodes.forEach(node => {
    const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent?.trim();
    if (!name) return;
    const symbol = node.querySelector('ORIGINALNAME')?.textContent?.trim() || name;
    units.push({
      'Unit Name': name,
      Symbol: symbol,
      Group: 'General',
      'Conversion Factor': 1
    });
  });

  // 3. Parse Stock Groups <STOCKGROUP>
  const stockGroupNodes = xmlDoc.querySelectorAll('STOCKGROUP');
  stockGroupNodes.forEach(node => {
    const name = node.getAttribute('NAME') || node.querySelector('NAME')?.textContent?.trim();
    if (!name) return;
    const parent = node.querySelector('PARENT')?.textContent?.trim();
    itemGroups.push({
      'Group Name': name,
      'Parent Group': parent || undefined
    });
  });

  // 4. Parse Ledgers <LEDGER>
  const ledgerNodes = xmlDoc.querySelectorAll('LEDGER');
  ledgerNodes.forEach(node => {
    const name = node.getAttribute('NAME') || 
      node.querySelector('NAME.LIST > NAME')?.textContent?.trim() || 
      node.querySelector('NAME')?.textContent?.trim();
    
    if (!name || name.trim() === '') return;

    const rawParent = node.querySelector('PARENT')?.textContent?.trim() || '';
    const mappedGroup = normalizeAccountGroup(rawParent);

    // Tally Opening Balance convention:
    // In Tally: Negative value means Debit (Dr) for Assets/Debtors, Positive means Credit (Cr) for Liabilities/Creditors
    // Sometimes Tally outputs raw numeric strings like "-5000.00" or "5000.00 Dr"
    const opBalText = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0';
    let opBalNum = parseFloat(opBalText.replace(/[^0-9.-]/g, '')) || 0;
    
    let balType: 'Dr' | 'Cr' = 'Dr';
    if (opBalText.toUpperCase().includes('CR')) {
      balType = 'Cr';
      opBalNum = Math.abs(opBalNum);
    } else if (opBalText.toUpperCase().includes('DR')) {
      balType = 'Dr';
      opBalNum = Math.abs(opBalNum);
    } else {
      // Standard Tally XML logic:
      if (opBalNum < 0) {
        balType = 'Dr';
        opBalNum = Math.abs(opBalNum);
      } else if (opBalNum > 0) {
        // Positive number in Tally XML represents Credit (Liability/Equity/Income)
        balType = 'Cr';
      }
    }

    const gstin = node.querySelector('PARTYGSTIN')?.textContent?.trim() || 
      node.querySelector('GSTREGISTRATIONNUMBER')?.textContent?.trim() || 
      node.querySelector('INCOMETAXNUMBER')?.textContent?.trim() || '';

    const phone = node.querySelector('LEDGERPHONE')?.textContent?.trim() || 
      node.querySelector('LEDGERMOBILE')?.textContent?.trim() || 
      node.querySelector('PHONE')?.textContent?.trim() || '';

    const email = node.querySelector('EMAIL')?.textContent?.trim() || '';

    let address = '';
    const addressNodes = node.querySelectorAll('ADDRESS.LIST > ADDRESS, ADDRESS');
    if (addressNodes.length > 0) {
      address = Array.from(addressNodes).map(a => a.textContent?.trim()).filter(Boolean).join(', ');
    }

    const bankName = node.querySelector('BANKNAME')?.textContent?.trim() || '';
    const accNo = node.querySelector('BANKACCOUNTNUMBER')?.textContent?.trim() || '';
    const branch = node.querySelector('BANKBRANCH')?.textContent?.trim() || '';

    const ledgerObj: Ledger = {
      'Ledger Name': name,
      Group: mappedGroup,
      'Opening Balance': opBalNum,
      'Balance Type (Dr/Cr)': balType,
      'Current Balance': opBalNum,
      'GST No': gstin || undefined,
      'TPN No': gstin || undefined,
      'Contact No': phone || undefined,
      Email: email || undefined,
      Address: address || undefined,
      'Bank Name': bankName || undefined,
      'Account No': accNo || undefined,
      Branch: branch || undefined
    };

    ledgers.push(ledgerObj);

    // Parse Bill Allocations inside Ledger <BILLALLOCATIONS.LIST>
    const billNodes = node.querySelectorAll('BILLALLOCATIONS.LIST');
    const isDebtor = mappedGroup.toLowerCase().includes('debtor');
    const isCreditor = mappedGroup.toLowerCase().includes('creditor');

    if (billNodes.length > 0 && (isDebtor || isCreditor)) {
      billNodes.forEach(bNode => {
        const bName = bNode.querySelector('NAME')?.textContent?.trim();
        if (!bName) return;
        const bDate = parseTallyDate(bNode.querySelector('BILLDATE')?.textContent?.trim() || '');
        const bAmtText = bNode.querySelector('AMOUNT')?.textContent?.trim() || '0';
        const bAmt = Math.abs(parseFloat(bAmtText.replace(/[^0-9.-]/g, '')) || 0);

        if (bAmt > 0) {
          openingBills.push({
            partyName: name,
            partyType: isDebtor ? 'debtor' : 'creditor',
            billNo: bName,
            billDate: bDate,
            amount: bAmt
          });
        }
      });
    } else if (opBalNum > 0 && (isDebtor || isCreditor)) {
      // If no itemized bills but has opening balance, create single OB bill
      openingBills.push({
        partyName: name,
        partyType: isDebtor ? 'debtor' : 'creditor',
        billNo: `OB-${name.slice(0, 10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
        billDate: new Date().toISOString().split('T')[0],
        amount: opBalNum
      });
    }
  });

  // 5. Parse Stock Items <STOCKITEM>
  const itemNodes = xmlDoc.querySelectorAll('STOCKITEM');
  itemNodes.forEach((node, idx) => {
    const name = node.getAttribute('NAME') || 
      node.querySelector('NAME.LIST > NAME')?.textContent?.trim() || 
      node.querySelector('NAME')?.textContent?.trim();

    if (!name || name.trim() === '') return;

    const parentGroup = node.querySelector('PARENT')?.textContent?.trim() || 'General';
    const baseUnits = node.querySelector('BASEUNITS')?.textContent?.trim() || 'Pcs';
    const hsn = node.querySelector('HSNCODE')?.textContent?.trim() || 
      node.querySelector('HSNDETAILS.LIST > HSNCODE')?.textContent?.trim() || '';

    // Opening Stock & Value
    const opStockText = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0';
    const opQtyMatch = opStockText.match(/([0-9.-]+)/);
    const opQty = opQtyMatch ? Math.abs(parseFloat(opQtyMatch[1])) || 0 : 0;

    const opValText = node.querySelector('OPENINGVALUE')?.textContent?.trim() || '0';
    const opVal = Math.abs(parseFloat(opValText.replace(/[^0-9.-]/g, '')) || 0);

    // Standard Cost / Purchase Rate
    let purchaseRate = 0;
    const stdCostText = node.querySelector('STANDARDCOSTLIST.LIST > RATE, OPENINGRATE')?.textContent?.trim() || '';
    if (stdCostText) {
      const match = stdCostText.match(/([0-9.-]+)/);
      if (match) purchaseRate = parseFloat(match[1]) || 0;
    }
    if (purchaseRate === 0 && opQty > 0 && opVal > 0) {
      purchaseRate = Math.round((opVal / opQty) * 100) / 100;
    }

    // Standard Selling Price / Sale Rate
    let saleRate = purchaseRate;
    const stdPriceText = node.querySelector('STANDARDPRICELIST.LIST > RATE, BASICPRICE')?.textContent?.trim() || '';
    if (stdPriceText) {
      const match = stdPriceText.match(/([0-9.-]+)/);
      if (match) saleRate = parseFloat(match[1]) || 0;
    }
    if (saleRate === 0) {
      saleRate = Math.round(purchaseRate * 1.25 * 100) / 100;
    }

    // GST %
    let gstPct = 0;
    const gstRateText = node.querySelector('GSTRATEDETAILS.LIST > GSTRATE, IGSTRATE')?.textContent?.trim() || '';
    if (gstRateText) {
      gstPct = parseFloat(gstRateText) || 0;
    }

    // Part Number / Code
    const partNo = node.querySelector('PARTNUMBER')?.textContent?.trim() || '';
    const itemCode = partNo || `ITEM-${(idx + 1).toString().padStart(4, '0')}`;

    // Batches / Serial Numbers <BATCHALLOCATIONS.LIST>
    const batches: ItemBatch[] = [];
    const serialList: string[] = [];
    const batchNodes = node.querySelectorAll('BATCHALLOCATIONS.LIST');

    batchNodes.forEach((bNode, bIdx) => {
      const bName = bNode.querySelector('BATCHNAME')?.textContent?.trim();
      if (!bName || bName === 'Primary Batch' || bName === 'Not Applicable') return;

      const bQtyText = bNode.querySelector('OPENINGBALANCE')?.textContent?.trim() || '1';
      const bQtyMatch = bQtyText.match(/([0-9.-]+)/);
      const bQty = bQtyMatch ? Math.abs(parseFloat(bQtyMatch[1])) || 1 : 1;

      const expDate = parseTallyDate(bNode.querySelector('EXPIRYDATE')?.textContent?.trim() || '');
      const mfgDate = parseTallyDate(bNode.querySelector('MFGDATE')?.textContent?.trim() || '');

      batches.push({
        id: `batch-${idx}-${bIdx}`,
        batchNo: bName,
        currentStock: bQty,
        openingStock: bQty,
        purchaseRate: purchaseRate,
        saleRate: saleRate,
        expDate: expDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        mfgDate: mfgDate || undefined
      });

      // If batch appears to be a unique serial number
      if (bQty === 1 || bName.length > 5) {
        serialList.push(bName);
      }
    });

    const isSerialized = serialList.length > 0 ? 'Y' : 'N';

    const itemObj: Item = {
      'Item Code': itemCode,
      Barcode: itemCode,
      'Item Name': name,
      'Print Name': name,
      Group: parentGroup,
      Unit: baseUnits,
      'Purchase Rate': purchaseRate,
      'Sale Rate': saleRate,
      MRP: Math.round(saleRate * 1.1 * 100) / 100,
      'GST %': gstPct,
      'Zero Rated (Y/N)': gstPct === 0 ? 'Y' : 'N',
      'Is Serialized': isSerialized,
      'HSN/SAC': hsn,
      'Opening Stock': opQty,
      'Opening Amount': opVal,
      'Current Stock': opQty,
      'Reorder Level': 5,
      partNumber: partNo || undefined,
      batches: batches.length > 0 ? batches : undefined,
      'Opening Serials': serialList.length > 0 ? serialList.join(', ') : undefined
    };

    items.push(itemObj);
  });

  // 6. Parse Historical Vouchers if in full_historical mode
  if (mode === 'full_historical') {
    const voucherNodes = xmlDoc.querySelectorAll('VOUCHER');
    voucherNodes.forEach((node, vIdx) => {
      const vTypeName = node.querySelector('VOUCHERTYPENAME')?.textContent?.trim() || 
        node.getAttribute('VCHTYPE') || 'Journal';
      
      const vDate = parseTallyDate(node.querySelector('DATE')?.textContent?.trim() || '');
      const vNo = node.querySelector('VOUCHERNUMBER')?.textContent?.trim() || `VCH-${vIdx + 1}`;
      const narration = node.querySelector('NARRATION')?.textContent?.trim() || '';

      // Map Tally voucher type to ERP group type
      let grpType: Voucher['type'] = 'P';
      const vTypeLower = vTypeName.toLowerCase();
      if (vTypeLower.includes('receipt')) grpType = 'R';
      else if (vTypeLower.includes('payment')) grpType = 'P';
      else if (vTypeLower.includes('contra')) grpType = 'C';
      else if (vTypeLower.includes('sales return') || vTypeLower.includes('credit note')) grpType = 'CN';
      else if (vTypeLower.includes('purchase return') || vTypeLower.includes('debit note')) grpType = 'DN';
      else if (vTypeLower.includes('sales')) grpType = 'S';
      else if (vTypeLower.includes('purchase')) grpType = 'PUR';
      else if (vTypeLower.includes('delivery')) grpType = 'DEL_NOTE';
      else grpType = 'J';

      // Parse ledger entries
      const lineNodes = node.querySelectorAll('ALLLEDGERENTRIES.LIST, LEDGERENTRIES.LIST');
      let totalVoucherAmt = 0;
      let debitParty = '';
      let creditParty = '';

      const lines: any[] = [];
      lineNodes.forEach((lNode, lIdx) => {
        const lName = lNode.querySelector('LEDGERNAME')?.textContent?.trim();
        if (!lName) return;
        const amtText = lNode.querySelector('AMOUNT')?.textContent?.trim() || '0';
        const numAmt = parseFloat(amtText.replace(/[^0-9.-]/g, '')) || 0;
        const isDeemedPos = lNode.querySelector('ISDEEMEDPOSITIVE')?.textContent?.trim().toLowerCase() === 'yes';

        // Tally convention: Negative amount or isDeemedPositive is Debit
        const isDr = numAmt < 0 || isDeemedPos;
        const absAmt = Math.abs(numAmt);

        if (isDr) {
          if (!debitParty) debitParty = lName;
          lines.push({
            id: String(lIdx + 1),
            type: 'Dr',
            ledger: lName,
            debit: absAmt,
            credit: ''
          });
        } else {
          if (!creditParty) creditParty = lName;
          lines.push({
            id: String(lIdx + 1),
            type: 'Cr',
            ledger: lName,
            debit: '',
            credit: absAmt
          });
        }
        totalVoucherAmt = Math.max(totalVoucherAmt, absAmt);
      });

      if (lines.length > 0) {
        vouchers.push({
          voucherNo: vNo,
          type: grpType,
          date: vDate,
          party: debitParty || creditParty || 'Party',
          amount: totalVoucherAmt,
          status: 'Active',
          narration: narration,
          lines: lines
        } as any);
      }
    });
  }

  // Calculate Summary Statistics
  const totalOpeningDr = ledgers
    .filter(l => l['Balance Type (Dr/Cr)'] === 'Dr')
    .reduce((sum, l) => sum + (l['Opening Balance'] || 0), 0);

  const totalOpeningCr = ledgers
    .filter(l => l['Balance Type (Dr/Cr)'] === 'Cr')
    .reduce((sum, l) => sum + (l['Opening Balance'] || 0), 0);

  const totalStockQty = items.reduce((sum, i) => sum + (i['Opening Stock'] || 0), 0);
  const totalStockValue = items.reduce((sum, i) => sum + (i['Opening Amount'] || ((i['Opening Stock'] || 0) * (i['Purchase Rate'] || 0))), 0);
  const totalBillsAmt = openingBills.reduce((sum, b) => sum + b.amount, 0);

  const stats: MigrationStats = {
    totalLedgers: ledgers.length,
    totalDebtors: ledgers.filter(l => l.Group === 'Sundry Debtors').length,
    totalCreditors: ledgers.filter(l => l.Group === 'Sundry Creditors').length,
    totalOpeningDr: Math.round(totalOpeningDr * 100) / 100,
    totalOpeningCr: Math.round(totalOpeningCr * 100) / 100,
    drCrDifference: Math.round(Math.abs(totalOpeningDr - totalOpeningCr) * 100) / 100,
    totalItems: items.length,
    totalStockQty: totalStockQty,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    totalPendingBills: openingBills.length,
    totalPendingBillsAmount: Math.round(totalBillsAmt * 100) / 100,
    totalHistoricalVouchers: vouchers.length,
    serialNumbersCount: items.filter(i => i['Is Serialized'] === 'Y').length
  };

  return {
    source: 'tally',
    mode,
    sourceFileName: fileName,
    companyName,
    ledgers,
    ledgerGroups,
    items,
    itemGroups,
    units,
    openingBills,
    vouchers,
    stats,
    warnings,
    errors
  };
}

// -------------------------------------------------------------
// 2. BUSY ACCOUNTING EXCEL & XML PARSER
// -------------------------------------------------------------
export async function parseBusyExcel(file: File, mode: MigrationMode = 'cutoff_opening'): Promise<MigrationParsedData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const warnings: string[] = [];
  const errors: string[] = [];

  const ledgers: Ledger[] = [];
  const ledgerGroups: LedgerGroup[] = [];
  const items: Item[] = [];
  const openingBills: MigrationOpeningBill[] = [];
  const units: Unit[] = [];
  const itemGroups: ItemGroup[] = [];
  const vouchers: Voucher[] = [];

  // Inspect each sheet in the Excel file
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return;

    // Check first row keys to detect data type
    const sample = rows[0];
    const keys = Object.keys(sample).map(k => k.trim().toLowerCase());

    const isAccountSheet = keys.some(k => k.includes('account name') || k.includes('party name') || (k.includes('ledger') && !k.includes('stock')));
    const isItemSheet = keys.some(k => k.includes('item name') || k.includes('product') || k.includes('stock item') || k.includes('item code'));
    const isBillSheet = keys.some(k => (k.includes('bill no') || k.includes('ref no') || k.includes('pending')) && (k.includes('party') || k.includes('account')));

    // 1. Process Accounts
    if (isAccountSheet && !isBillSheet) {
      rows.forEach(r => {
        const name = r['Account Name'] || r['Party Name'] || r['Ledger Name'] || r['Name'] || r['ACCOUNT'] || '';
        if (!name || String(name).trim() === '') return;

        const rawGroup = r['Group'] || r['Account Group'] || r['Primary Group'] || 'Sundry Debtors';
        const mappedGroup = normalizeAccountGroup(String(rawGroup));

        const opBalRaw = r['Op. Bal.'] || r['Opening Bal'] || r['Opening Balance'] || r['Balance'] || 0;
        const opBalNum = Math.abs(parseFloat(String(opBalRaw).replace(/[^0-9.-]/g, '')) || 0);

        let drCr: 'Dr' | 'Cr' = 'Dr';
        const drCrRaw = String(r['Dr/Cr'] || r['Type'] || r['Balance Type'] || '').toUpperCase();
        if (drCrRaw.includes('CR')) drCr = 'Cr';
        else if (drCrRaw.includes('DR')) drCr = 'Dr';
        else {
          drCr = mappedGroup.toLowerCase().includes('creditor') || mappedGroup.toLowerCase().includes('liabilit') || mappedGroup.toLowerCase().includes('capital') ? 'Cr' : 'Dr';
        }

        const gstin = r['GSTIN'] || r['GST No'] || r['TPN'] || r['GST No.'] || '';
        const mobile = r['Mobile'] || r['Phone'] || r['Contact'] || r['Mobile No.'] || '';
        const address = r['Address'] || r['Address 1'] || r['City'] || '';
        const email = r['Email'] || r['E-Mail'] || '';

        ledgers.push({
          'Ledger Name': String(name).trim(),
          Group: mappedGroup,
          'Opening Balance': opBalNum,
          'Balance Type (Dr/Cr)': drCr,
          'Current Balance': opBalNum,
          'GST No': gstin ? String(gstin).trim() : undefined,
          'TPN No': gstin ? String(gstin).trim() : undefined,
          'Contact No': mobile ? String(mobile).trim() : undefined,
          Address: address ? String(address).trim() : undefined,
          Email: email ? String(email).trim() : undefined
        });

        // Add bill-wise opening balance if outstanding
        const isDebtor = mappedGroup.toLowerCase().includes('debtor');
        const isCreditor = mappedGroup.toLowerCase().includes('creditor');
        if (opBalNum > 0 && (isDebtor || isCreditor)) {
          openingBills.push({
            partyName: String(name).trim(),
            partyType: isDebtor ? 'debtor' : 'creditor',
            billNo: `OB-${String(name).trim().slice(0, 10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
            billDate: new Date().toISOString().split('T')[0],
            amount: opBalNum
          });
        }
      });
    }

    // 2. Process Bill-by-Bill Outstanding
    if (isBillSheet) {
      rows.forEach(r => {
        const party = r['Party Name'] || r['Account Name'] || r['Party'] || r['Customer/Vendor'] || '';
        const billNo = r['Bill No'] || r['Ref No'] || r['Invoice No'] || r['Bill No.'] || '';
        const amtRaw = r['Pending Amount'] || r['Balance Amount'] || r['Amount'] || r['Bill Amount'] || 0;
        const amt = Math.abs(parseFloat(String(amtRaw).replace(/[^0-9.-]/g, '')) || 0);

        if (!party || !billNo || amt <= 0) return;

        const dateRaw = r['Bill Date'] || r['Date'] || new Date().toISOString().split('T')[0];
        const dueDateRaw = r['Due Date'] || undefined;

        // Check if party exists in ledgers to determine debtor vs creditor
        const found = ledgers.find(l => l['Ledger Name'].toLowerCase() === String(party).trim().toLowerCase());
        const isCred = found ? found.Group.toLowerCase().includes('creditor') : false;

        openingBills.push({
          partyName: String(party).trim(),
          partyType: isCred ? 'creditor' : 'debtor',
          billNo: String(billNo).trim(),
          billDate: parseTallyDate(String(dateRaw)),
          dueDate: dueDateRaw ? parseTallyDate(String(dueDateRaw)) : undefined,
          amount: amt
        });
      });
    }

    // 3. Process Items
    if (isItemSheet) {
      rows.forEach((r, idx) => {
        const name = r['Item Name'] || r['Product Name'] || r['Description'] || r['ITEM'] || '';
        if (!name || String(name).trim() === '') return;

        const code = r['Item Code'] || r['Alias'] || r['Barcode'] || r['Part No'] || `BUSY-${(idx + 1).toString().padStart(4, '0')}`;
        const group = r['Group'] || r['Category'] || r['Item Group'] || 'General';
        const unit = r['Unit'] || r['UOM'] || r['Base Unit'] || 'Pcs';
        const purchaseRate = Math.abs(parseFloat(String(r['Purchase Price'] || r['Cost Price'] || r['Pur. Rate'] || 0).replace(/[^0-9.-]/g, '')) || 0);
        const saleRate = Math.abs(parseFloat(String(r['Sale Price'] || r['Selling Price'] || r['Sale Rate'] || purchaseRate * 1.25).replace(/[^0-9.-]/g, '')) || purchaseRate);
        const mrp = Math.abs(parseFloat(String(r['MRP'] || r['M.R.P'] || saleRate * 1.1).replace(/[^0-9.-]/g, '')) || saleRate);
        const gstPct = parseFloat(String(r['GST %'] || r['Tax Rate'] || r['GST Rate'] || 0).replace(/[^0-9.-]/g, '')) || 0;
        const hsn = r['HSN'] || r['HSN Code'] || r['HSN/SAC'] || '';
        const opStock = Math.abs(parseFloat(String(r['Opening Qty'] || r['Op. Stock'] || r['Stock'] || 0).replace(/[^0-9.-]/g, '')) || 0);
        const opAmt = Math.abs(parseFloat(String(r['Opening Value'] || r['Op. Value'] || opStock * purchaseRate).replace(/[^0-9.-]/g, '')) || (opStock * purchaseRate));

        // Serial numbers or batches in Busy
        const serialsRaw = r['Serial Numbers'] || r['Serial Nos'] || r['Serial No'] || '';
        const serialsList = serialsRaw ? String(serialsRaw).split(/[,;\n]/).map(s => s.trim()).filter(Boolean) : [];

        items.push({
          'Item Code': String(code).trim(),
          Barcode: String(code).trim(),
          'Item Name': String(name).trim(),
          'Print Name': String(name).trim(),
          Group: String(group).trim(),
          Unit: String(unit).trim(),
          'Purchase Rate': purchaseRate,
          'Sale Rate': saleRate,
          MRP: mrp,
          'GST %': gstPct,
          'Zero Rated (Y/N)': gstPct === 0 ? 'Y' : 'N',
          'Is Serialized': serialsList.length > 0 ? 'Y' : 'N',
          'HSN/SAC': hsn ? String(hsn).trim() : '',
          'Opening Stock': opStock,
          'Opening Amount': opAmt,
          'Current Stock': opStock,
          'Reorder Level': 5,
          'Opening Serials': serialsList.length > 0 ? serialsList.join(', ') : undefined
        });
      });
    }
  });

  // Calculate Summary Statistics
  const totalOpeningDr = ledgers
    .filter(l => l['Balance Type (Dr/Cr)'] === 'Dr')
    .reduce((sum, l) => sum + (l['Opening Balance'] || 0), 0);

  const totalOpeningCr = ledgers
    .filter(l => l['Balance Type (Dr/Cr)'] === 'Cr')
    .reduce((sum, l) => sum + (l['Opening Balance'] || 0), 0);

  const totalStockQty = items.reduce((sum, i) => sum + (i['Opening Stock'] || 0), 0);
  const totalStockValue = items.reduce((sum, i) => sum + (i['Opening Amount'] || ((i['Opening Stock'] || 0) * (i['Purchase Rate'] || 0))), 0);
  const totalBillsAmt = openingBills.reduce((sum, b) => sum + b.amount, 0);

  const stats: MigrationStats = {
    totalLedgers: ledgers.length,
    totalDebtors: ledgers.filter(l => l.Group === 'Sundry Debtors').length,
    totalCreditors: ledgers.filter(l => l.Group === 'Sundry Creditors').length,
    totalOpeningDr: Math.round(totalOpeningDr * 100) / 100,
    totalOpeningCr: Math.round(totalOpeningCr * 100) / 100,
    drCrDifference: Math.round(Math.abs(totalOpeningDr - totalOpeningCr) * 100) / 100,
    totalItems: items.length,
    totalStockQty: totalStockQty,
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    totalPendingBills: openingBills.length,
    totalPendingBillsAmount: Math.round(totalBillsAmt * 100) / 100,
    totalHistoricalVouchers: vouchers.length,
    serialNumbersCount: items.filter(i => i['Is Serialized'] === 'Y').length
  };

  return {
    source: 'busy',
    mode,
    sourceFileName: file.name,
    ledgers,
    ledgerGroups,
    items,
    itemGroups,
    units,
    openingBills,
    vouchers,
    stats,
    warnings,
    errors
  };
}

// -------------------------------------------------------------
// 3. EXECUTE 1-CLICK MIGRATION INTO ERP
// -------------------------------------------------------------
export async function execute1ClickMigration(
  parsed: MigrationParsedData, 
  options: MigrationOptions
): Promise<MigrationResult> {
  const { mergeOrReplace, createMissingGroups, createOpeningBillsAsPending, targetCompanyId } = options;

  try {
    // 1. Groups & Units
    if (createMissingGroups) {
      if (parsed.units && parsed.units.length > 0) {
        const existingUnits = loadJson<Unit[]>(STORAGE_KEYS.UNITS, [], targetCompanyId);
        const unitMap = new Map(existingUnits.map(u => [u['Unit Name'].toLowerCase(), u]));
        parsed.units.forEach(u => {
          if (!unitMap.has(u['Unit Name'].toLowerCase())) {
            existingUnits.push(u);
          }
        });
        saveJson(STORAGE_KEYS.UNITS, existingUnits, targetCompanyId);
      }

      if (parsed.itemGroups && parsed.itemGroups.length > 0) {
        const existingItemGroups = loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, [], targetCompanyId);
        const groupMap = new Map(existingItemGroups.map(g => [g['Group Name'].toLowerCase(), g]));
        parsed.itemGroups.forEach(g => {
          if (!groupMap.has(g['Group Name'].toLowerCase())) {
            existingItemGroups.push(g);
          }
        });
        saveJson(STORAGE_KEYS.ITEM_GROUPS, existingItemGroups, targetCompanyId);
      }
    }

    // 2. Ledgers
    let finalLedgers: Ledger[] = [];
    if (mergeOrReplace === 'replace') {
      finalLedgers = [...parsed.ledgers];
    } else {
      // Merge
      const existingLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, [], targetCompanyId);
      const ledgerMap = new Map(existingLedgers.map(l => [l['Ledger Name'].toLowerCase(), l]));
      parsed.ledgers.forEach(newL => {
        ledgerMap.set(newL['Ledger Name'].toLowerCase(), newL);
      });
      finalLedgers = Array.from(ledgerMap.values());
    }
    saveJson(STORAGE_KEYS.LEDGERS, finalLedgers, targetCompanyId);

    // Sync ledgers to cloud if online
    parsed.ledgers.forEach(l => {
      try {
        syncLedgerToSupabase(l);
      } catch (e) {
        // silent offline fallback
      }
    });

    // 3. Stock Items
    let finalItems: Item[] = [];
    if (mergeOrReplace === 'replace') {
      finalItems = [...parsed.items];
    } else {
      // Merge
      const existingItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, [], targetCompanyId);
      const itemMap = new Map(existingItems.map(i => [i['Item Code'].toLowerCase(), i]));
      parsed.items.forEach(newI => {
        itemMap.set(newI['Item Code'].toLowerCase(), newI);
      });
      finalItems = Array.from(itemMap.values());
    }
    saveJson(STORAGE_KEYS.ITEMS, finalItems, targetCompanyId);

    // Sync items to cloud if online
    parsed.items.forEach(i => {
      try {
        syncItemToSupabase(i);
      } catch (e) {
        // silent offline fallback
      }
    });

    // 4. Pending Bill-by-Bill Details for Debtors & Creditors
    let importedBillsCount = 0;
    if (createOpeningBillsAsPending && parsed.openingBills && parsed.openingBills.length > 0) {
      const existingSales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], targetCompanyId);
      const existingPurchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], targetCompanyId);

      const existingSaleNos = new Set(existingSales.map(s => s.invoiceNo.toLowerCase()));
      const existingPurchNos = new Set(existingPurchases.map(p => (p.billNo || p.invoiceNo || '').toLowerCase()));

      parsed.openingBills.forEach((b, bIdx) => {
        if (b.partyType === 'debtor') {
          if (!existingSaleNos.has(b.billNo.toLowerCase())) {
            existingSales.push({
              invoiceNo: b.billNo,
              date: b.billDate || new Date().toISOString(),
              dueDate: b.dueDate || b.billDate,
              customer: {
                name: b.partyName,
                ledger: b.partyName,
                phone: '',
                address: ''
              },
              cart: [],
              subtotal: b.amount,
              taxable: b.amount,
              zeroRated: 0,
              gstAmt: 0,
              discount: 0,
              total: b.amount,
              credit: b.amount,
              paymentMode: 'Credit',
              status: 'Credit' as any,
              notes: `Migrated Opening Balance Bill from ${parsed.source.toUpperCase()}`
            } as any);
            existingSaleNos.add(b.billNo.toLowerCase());
            importedBillsCount++;
          }
        } else {
          // Creditor Purchase Bill
          if (!existingPurchNos.has(b.billNo.toLowerCase())) {
            existingPurchases.push({
              id: `pur-ob-${bIdx + 1}`,
              billNo: b.billNo,
              invoiceNo: b.billNo,
              supplierBillNo: b.billNo,
              date: b.billDate || new Date().toISOString(),
              dueDate: b.dueDate || b.billDate,
              supplier: {
                name: b.partyName,
                ledger: b.partyName,
                phone: '',
                address: ''
              },
              items: [],
              subtotal: b.amount,
              taxable: b.amount,
              total: b.amount,
              credit: b.amount,
              paymentMode: 'Credit',
              status: 'Credit' as any,
              notes: `Migrated Opening Balance Bill from ${parsed.source.toUpperCase()}`
            } as any);
            existingPurchNos.add(b.billNo.toLowerCase());
            importedBillsCount++;
          }
        }
      });

      saveJson(STORAGE_KEYS.SALES_INVOICES, existingSales, targetCompanyId);
      saveJson(STORAGE_KEYS.PURCHASE_INVOICES, existingPurchases, targetCompanyId);
    }

    // 5. Historical Vouchers
    let importedVouchersCount = 0;
    if (parsed.mode === 'full_historical' && parsed.vouchers && parsed.vouchers.length > 0) {
      const existingVouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], targetCompanyId);
      const vchNoSet = new Set(existingVouchers.map(v => (v.voucherNo || '').toLowerCase()));

      parsed.vouchers.forEach(v => {
        if (!vchNoSet.has((v.voucherNo || '').toLowerCase())) {
          existingVouchers.push(v);
          vchNoSet.add((v.voucherNo || '').toLowerCase());
          importedVouchersCount++;
        }
      });
      saveJson(STORAGE_KEYS.VOUCHERS, existingVouchers, targetCompanyId);
    }

    // 6. Recalculate all balances & trial balance
    recalculateLedgerBalances();

    // Broadcast system events
    window.dispatchEvent(new CustomEvent('ledgers_updated'));
    window.dispatchEvent(new CustomEvent('items_updated'));
    window.dispatchEvent(new CustomEvent('vouchers_updated'));

    return {
      success: true,
      importedLedgers: parsed.ledgers.length,
      importedItems: parsed.items.length,
      importedOpeningBills: importedBillsCount,
      importedVouchers: importedVouchersCount,
      message: `Successfully migrated ${parsed.ledgers.length} ledgers, ${parsed.items.length} items, and ${importedBillsCount} pending bills from ${parsed.source === 'tally' ? 'TallyPrime' : 'Busy Accounting'}.`,
      warnings: parsed.warnings
    };
  } catch (err: any) {
    return {
      success: false,
      importedLedgers: 0,
      importedItems: 0,
      importedOpeningBills: 0,
      importedVouchers: 0,
      message: err.message || 'Migration execution failed',
      warnings: [err.message]
    };
  }
}
