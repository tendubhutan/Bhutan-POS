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
  recalculateLedgerBalances,
  rebuildAccountingLogs
} from './storageService';
import { syncLedgerToSupabase, syncItemToSupabase, syncVoucherToSupabase } from './supabaseSyncService';

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
  salesVoucherSeries?: string[];
  stats: MigrationStats;
  warnings: string[];
  errors: string[];
}

export interface MigrationOptions {
  mergeOrReplace: 'merge' | 'replace';
  createMissingGroups: boolean;
  createOpeningBillsAsPending: boolean;
  salesTypeMappings?: Record<string, 'normalsale' | 'pos'>;
  defaultSalesType?: 'normalsale' | 'pos';
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

// -------------------------------------------------------------
// HELPER: Sanitize Tally / Busy XML String
// Fixes invalid XML character references (e.g. &#4;), control bytes, unescaped &
// -------------------------------------------------------------
export function sanitizeXmlString(rawXml: string): string {
  if (!rawXml) return '';

  let clean = rawXml;

  // 1. Remove BOM (Byte Order Mark) if present
  if (clean.charCodeAt(0) === 0xFEFF) {
    clean = clean.slice(1);
  }

  // 2. Strip invalid XML 1.0 character references (0-8, 11-12, 14-31, surrogates)
  clean = clean.replace(/&#x?([0-9a-fA-F]+);?/gi, (match, hexOrDec) => {
    const isHex = match.toLowerCase().startsWith('&#x');
    const code = parseInt(hexOrDec, isHex ? 16 : 10);
    if (isNaN(code)) return '';
    if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || (code >= 55296 && code <= 57343) || code === 65534 || code === 65535) {
      return ''; // Strip illegal XML 1.0 character
    }
    return `&#${code};`;
  });

  // 3. Strip raw control characters (ASCII 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F)
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 4. Escape standalone & that are not part of valid XML entities
  clean = clean.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9a-fA-F]+;)/gi, '&amp;');

  return clean;
}

// Case-tolerant tag queries for DOM trees (supports text/xml, text/html parsers, and tag names containing dots like ALLLEDGERENTRIES.LIST)
export function findAllElements(parent: ParentNode | Element, tagName: string): Element[] {
  if (!parent) return [];
  const upper = tagName.toUpperCase();
  const lower = tagName.toLowerCase();

  // 1. Try getElementsByTagName (fast, exact match for tag names with dots)
  if ('getElementsByTagName' in parent && typeof (parent as any).getElementsByTagName === 'function') {
    const set = new Set<Element>();
    const list1 = (parent as any).getElementsByTagName(upper);
    if (list1) for (let i = 0; i < list1.length; i++) set.add(list1[i]);
    const list2 = (parent as any).getElementsByTagName(lower);
    if (list2) for (let i = 0; i < list2.length; i++) set.add(list2[i]);
    const list3 = (parent as any).getElementsByTagName(tagName);
    if (list3) for (let i = 0; i < list3.length; i++) set.add(list3[i]);
    if (set.size > 0) return Array.from(set);
  }

  // 2. Fallback: querySelectorAll with CSS-escaped dot selector
  try {
    const escapedTag = tagName.replace(/\./g, '\\.');
    const escapedUpper = upper.replace(/\./g, '\\.');
    const escapedLower = lower.replace(/\./g, '\\.');
    const list = parent.querySelectorAll(`${escapedUpper}, ${escapedLower}, ${escapedTag}`);
    if (list && list.length > 0) return Array.from(list);
  } catch (e) {
    // ignore
  }

  // 3. Wildcard iteration fallback
  const results: Element[] = [];
  const all = parent.querySelectorAll ? parent.querySelectorAll('*') : [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tName = el.tagName ? el.tagName.toUpperCase() : '';
    if (tName === upper || tName === lower || tName === tagName.toUpperCase()) {
      results.push(el);
    }
  }
  return results;
}

export function findSingleElement(parent: ParentNode | Element, tagName: string): Element | null {
  const list = findAllElements(parent, tagName);
  return list.length > 0 ? list[0] : null;
}

export function getTagText(parent: ParentNode | Element, tagName: string): string {
  const el = findSingleElement(parent, tagName);
  return el?.textContent?.trim() || '';
}

function querySelectorAllTags(parent: ParentNode | Element, tag: string): Element[] {
  return findAllElements(parent, tag);
}

function querySelectorTag(parent: ParentNode | Element, selector: string): Element | null {
  return findSingleElement(parent, selector);
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
// REGEX FALLBACK PARSER FOR TALLY XML
// -------------------------------------------------------------
function parseTallyXmlRegexFallback(xmlString: string, mode: MigrationMode, fileName: string): MigrationParsedData {
  const ledgers: Ledger[] = [];
  const items: Item[] = [];
  const openingBills: MigrationOpeningBill[] = [];
  const vouchers: Voucher[] = [];

  // Regex for <LEDGER NAME="...">...</LEDGER>
  const ledgerRegex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match: RegExpExecArray | null;

  while ((match = ledgerRegex.exec(xmlString)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const nameAttrMatch = attrs.match(/NAME="([^"]+)"/i) || body.match(/<NAME>([^<]+)<\/NAME>/i);
    const name = nameAttrMatch ? nameAttrMatch[1].trim() : '';
    if (!name) continue;

    const parentMatch = body.match(/<PARENT>([^<]+)<\/PARENT>/i);
    const rawParent = parentMatch ? parentMatch[1].trim() : 'Sundry Debtors';
    const mappedGroup = normalizeAccountGroup(rawParent);

    const opBalMatch = body.match(/<OPENINGBALANCE>([^<]+)<\/OPENINGBALANCE>/i);
    const opBalText = opBalMatch ? opBalMatch[1].trim() : '0';
    let opBalNum = parseFloat(opBalText.replace(/[^0-9.-]/g, '')) || 0;

    let balType: 'Dr' | 'Cr' = 'Dr';
    if (opBalText.toUpperCase().includes('CR')) balType = 'Cr';
    else if (opBalText.toUpperCase().includes('DR')) balType = 'Dr';
    else if (opBalNum > 0) balType = 'Cr';

    opBalNum = Math.abs(opBalNum);

    const gstinMatch = body.match(/<(?:PARTYGSTIN|GSTREGISTRATIONNUMBER|INCOMETAXNUMBER)>([^<]+)<\//i);
    const phoneMatch = body.match(/<(?:LEDGERPHONE|LEDGERMOBILE|PHONE)>([^<]+)<\//i);
    const emailMatch = body.match(/<EMAIL>([^<]+)<\/EMAIL>/i);

    ledgers.push({
      'Ledger Name': name,
      Group: mappedGroup,
      'Opening Balance': opBalNum,
      'Balance Type (Dr/Cr)': balType,
      'Current Balance': opBalNum,
      'GST No': gstinMatch ? gstinMatch[1].trim() : undefined,
      'TPN No': gstinMatch ? gstinMatch[1].trim() : undefined,
      'Contact No': phoneMatch ? phoneMatch[1].trim() : undefined,
      Email: emailMatch ? emailMatch[1].trim() : undefined
    });

    const isDebtor = mappedGroup.toLowerCase().includes('debtor');
    const isCreditor = mappedGroup.toLowerCase().includes('creditor');
    if (opBalNum > 0 && (isDebtor || isCreditor)) {
      openingBills.push({
        partyName: name,
        partyType: isDebtor ? 'debtor' : 'creditor',
        billNo: `OB-${name.slice(0, 10).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`,
        billDate: new Date().toISOString().split('T')[0],
        amount: opBalNum
      });
    }
  }

  // Regex for <STOCKITEM NAME="...">...</STOCKITEM>
  const itemRegex = /<STOCKITEM\b([^>]*)>([\s\S]*?)<\/STOCKITEM>/gi;
  let itemIdx = 0;
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const nameAttrMatch = attrs.match(/NAME="([^"]+)"/i) || body.match(/<NAME>([^<]+)<\/NAME>/i);
    const name = nameAttrMatch ? nameAttrMatch[1].trim() : '';
    if (!name) continue;

    itemIdx++;
    const parentMatch = body.match(/<PARENT>([^<]+)<\/PARENT>/i);
    const parentGroup = parentMatch ? parentMatch[1].trim() : 'General';

    const unitMatch = body.match(/<BASEUNITS>([^<]+)<\/BASEUNITS>/i);
    const baseUnits = unitMatch ? unitMatch[1].trim() : 'Pcs';

    const hsnMatch = body.match(/<HSNCODE>([^<]+)<\/HSNCODE>/i);
    const hsn = hsnMatch ? hsnMatch[1].trim() : '';

    const opBalMatch = body.match(/<OPENINGBALANCE>([^<]+)<\/OPENINGBALANCE>/i);
    const opQtyMatch = opBalMatch ? opBalMatch[1].match(/([0-9.-]+)/) : null;
    const opQty = opQtyMatch ? Math.abs(parseFloat(opQtyMatch[1])) || 0 : 0;

    const opValMatch = body.match(/<OPENINGVALUE>([^<]+)<\/OPENINGVALUE>/i);
    const opVal = opValMatch ? Math.abs(parseFloat(opValMatch[1].replace(/[^0-9.-]/g, ''))) || 0 : 0;

    let purchaseRate = 0;
    const stdCostMatch = body.match(/<(?:STANDARDCOSTLIST\.LIST|STANDARDCOST\.LIST|STANDARDCOSTDETAILS\.LIST)[\s\S]*?<RATE>([^<]+)<\/RATE>/i)
      || body.match(/<(?:OPENINGRATE|PURCHASERATE|COST)>([^<]+)<\//i);
    if (stdCostMatch) {
      const match = stdCostMatch[1].match(/([0-9.-]+)/);
      if (match) purchaseRate = parseFloat(match[1]) || 0;
    }
    if (purchaseRate === 0 && opQty > 0 && opVal > 0) {
      purchaseRate = Math.round((opVal / opQty) * 100) / 100;
    }

    let saleRate = 0;
    const stdSellingRateMatch = body.match(/<(?:STANDARDRATES\.LIST|STANDARDSELLINGPRICES\.LIST|STANDARDPRICELIST\.LIST|STANDARDPRICES\.LIST|SELLINGPRICELIST\.LIST|SELLINGRATEDETAILS\.LIST|FULLPRICELIST\.LIST|PRICELIST\.LIST)[\s\S]*?<(?:RATE|BASICPRICE|PRICE)>([^<]+)<\/(?:RATE|BASICPRICE|PRICE)>/i)
      || body.match(/<(?:STDRATE|STANDARDRATE|SELLINGRATE|SALESRATE|BASICPRICE|OPENINGRATE)>([^<]+)<\//i);

    if (stdSellingRateMatch) {
      const match = stdSellingRateMatch[1].match(/([0-9.-]+)/);
      if (match) saleRate = parseFloat(match[1]) || 0;
    }

    if (saleRate === 0 && purchaseRate > 0) {
      saleRate = purchaseRate;
    }

    const gstMatch = body.match(/<(?:GSTRATE|IGSTRATE|TAXPERCENTAGE)>([^<]+)<\//i);
    let gstPct = 5;
    if (gstMatch) {
      const parsedGst = parseFloat(gstMatch[1]);
      if (!isNaN(parsedGst) && parsedGst > 0) gstPct = parsedGst;
    }

    items.push({
      'Item Code': `ITEM-${itemIdx.toString().padStart(4, '0')}`,
      Barcode: `ITEM-${itemIdx.toString().padStart(4, '0')}`,
      'Item Name': name,
      'Print Name': name,
      Group: parentGroup,
      Unit: baseUnits,
      'Purchase Rate': purchaseRate,
      'Sale Rate': saleRate,
      MRP: Math.round(saleRate * 1.1 * 100) / 100,
      'GST %': gstPct,
      'Zero Rated (Y/N)': gstPct === 0 ? 'Y' : 'N',
      'Is Serialized': 'N',
      'HSN/SAC': hsn,
      'Opening Stock': opQty,
      'Opening Amount': opVal,
      'Current Stock': opQty,
      'Reorder Level': 5
    });
  }

  // Regex for <VOUCHER\b[^>]*>...</VOUCHER>
  const salesSeriesSet = new Set<string>();
  const voucherRegex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let vIdx = 0;
  while ((match = voucherRegex.exec(xmlString)) !== null) {
    const attrs = match[1];
    const body = match[2];

    vIdx++;
    const vTypeMatch = attrs.match(/VCHTYPE="([^"]+)"/i) || body.match(/<VOUCHERTYPENAME>([^<]+)<\/VOUCHERTYPENAME>/i);
    const vTypeName = vTypeMatch ? vTypeMatch[1].trim() : 'Journal';

    const dateMatch = body.match(/<DATE>([^<]+)<\/DATE>/i);
    const vDate = parseTallyDate(dateMatch ? dateMatch[1].trim() : '');

    const vNoMatch = body.match(/<VOUCHERNUMBER>([^<]+)<\/VOUCHERNUMBER>/i);
    const rawVNo = vNoMatch ? vNoMatch[1].trim() : '';
    const vNo = rawVNo !== '' ? rawVNo : `VCH-${vIdx}`;

    const narrationMatch = body.match(/<NARRATION>([^<]+)<\/NARRATION>/i);
    const narration = narrationMatch ? narrationMatch[1].trim() : '';

    const partyMatch = body.match(/<PARTYLEDGERNAME>([^<]+)<\/PARTYLEDGERNAME>/i) || body.match(/<PARTYNAME>([^<]+)<\/PARTYNAME>/i);
    const partyName = partyMatch ? partyMatch[1].trim() : '';

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

    if (grpType === 'S') {
      salesSeriesSet.add(vTypeName);
    }

    const entryRegex = /<(?:ALLLEDGERENTRIES\.LIST|LEDGERENTRIES\.LIST|ALLINVENTORYENTRIES\.LIST|INVENTORYENTRIES\.LIST|LEDGERENTRIES)\b[^>]*>([\s\S]*?)<\/(?:ALLLEDGERENTRIES\.LIST|LEDGERENTRIES\.LIST|ALLINVENTORYENTRIES\.LIST|INVENTORYENTRIES\.LIST|LEDGERENTRIES)>/gi;
    let entryMatch: RegExpExecArray | null;
    const lines: any[] = [];
    let totalAmt = 0;
    let lIdx = 0;

    while ((entryMatch = entryRegex.exec(body)) !== null) {
      const entryBody = entryMatch[1];
      const lNameMatch = entryBody.match(/<(?:LEDGERNAME|STOCKITEMNAME|NAME)>([^<]+)<\//i);
      if (!lNameMatch) continue;
      const lName = lNameMatch[1].trim();

      const amtMatch = entryBody.match(/<AMOUNT>([^<]+)<\/AMOUNT>/i);
      const amtText = amtMatch ? amtMatch[1].trim() : '0';
      const numAmt = parseFloat(amtText.replace(/[^0-9.-]/g, '')) || 0;
      const isDeemedPos = /<ISDEEMEDPOSITIVE>\s*yes\s*<\/ISDEEMEDPOSITIVE>/i.test(entryBody);

      const isDr = numAmt < 0 || isDeemedPos;
      const absAmt = Math.abs(numAmt);
      lIdx++;

      if (isDr) {
        lines.push({ id: String(lIdx), type: 'Dr', ledger: lName, debit: absAmt, credit: '', amount: absAmt });
      } else {
        lines.push({ id: String(lIdx), type: 'Cr', ledger: lName, debit: '', credit: absAmt, amount: absAmt });
      }
      totalAmt = Math.max(totalAmt, absAmt);
    }

    if (lines.length === 0 && partyName) {
      lines.push({ id: '1', type: 'Dr', ledger: partyName, debit: 0, credit: '', amount: 0 });
    }

    if (lines.length > 0) {
      vouchers.push({
        id: `vch-reg-${vIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        transactionId: `vch-reg-${vIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        voucherNo: vNo,
        type: grpType,
        date: vDate,
        party: partyName || (lines[0] ? lines[0].ledger : 'Party'),
        amount: totalAmt,
        status: 'Active',
        narration,
        lines
      } as any);
    }
  }

  // Calculate summary stats
  const totalOpeningDr = ledgers.filter(l => l['Balance Type (Dr/Cr)'] === 'Dr').reduce((s, l) => s + l['Opening Balance'], 0);
  const totalOpeningCr = ledgers.filter(l => l['Balance Type (Dr/Cr)'] === 'Cr').reduce((s, l) => s + l['Opening Balance'], 0);
  const totalStockQty = items.reduce((s, i) => s + i['Opening Stock'], 0);
  const totalStockValue = items.reduce((s, i) => s + i['Opening Amount'], 0);
  const totalBillsAmt = openingBills.reduce((s, b) => s + b.amount, 0);

  return {
    source: 'tally',
    mode,
    sourceFileName: fileName,
    ledgers,
    ledgerGroups: [],
    items,
    itemGroups: [],
    units: [],
    openingBills,
    vouchers,
    salesVoucherSeries: Array.from(salesSeriesSet),
    stats: {
      totalLedgers: ledgers.length,
      totalDebtors: ledgers.filter(l => l.Group === 'Sundry Debtors').length,
      totalCreditors: ledgers.filter(l => l.Group === 'Sundry Creditors').length,
      totalOpeningDr: Math.round(totalOpeningDr * 100) / 100,
      totalOpeningCr: Math.round(totalOpeningCr * 100) / 100,
      drCrDifference: Math.round(Math.abs(totalOpeningDr - totalOpeningCr) * 100) / 100,
      totalItems: items.length,
      totalStockQty,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      totalPendingBills: openingBills.length,
      totalPendingBillsAmount: Math.round(totalBillsAmt * 100) / 100,
      totalHistoricalVouchers: vouchers.length,
      serialNumbersCount: 0
    },
    warnings: [],
    errors: []
  };
}

// -------------------------------------------------------------
// 1. TALLY XML PARSER
// -------------------------------------------------------------
export function parseTallyXml(rawXmlString: string, mode: MigrationMode = 'cutoff_opening', fileName: string = 'TallyExport.xml'): MigrationParsedData {
  const xmlString = sanitizeXmlString(rawXmlString);
  const parser = new DOMParser();

  let xmlDoc: ParentNode;
  let parseError: Element | null = null;

  // First pass: strict XML parsing
  try {
    const doc = parser.parseFromString(xmlString, 'text/xml');
    parseError = doc.querySelector('parsererror');
    xmlDoc = doc;
  } catch (err) {
    parseError = { textContent: String(err) } as any;
    xmlDoc = document.createElement('div');
  }

  // Second pass: if strict XML parsing reported an error, aggressively strip non-standard entities & retry
  if (parseError) {
    try {
      const aggressiveXml = xmlString.replace(/&#\d+;/g, '').replace(/&#x[0-9a-fA-F]+;/g, '');
      const doc = parser.parseFromString(aggressiveXml, 'text/xml');
      const err = doc.querySelector('parsererror');
      if (!err) {
        xmlDoc = doc;
        parseError = null;
      }
    } catch (err) {
      // ignore
    }
  }

  // Third pass: tolerant HTML parser fallback (parses custom XML tags into DOM nodes without throwing XML syntax errors)
  if (parseError) {
    try {
      const doc = parser.parseFromString(xmlString, 'text/html');
      xmlDoc = doc;
      parseError = null;
    } catch (err) {
      throw new Error(`XML parsing error: ${parseError?.textContent?.slice(0, 200) || String(err)}`);
    }
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
  const companyNode = querySelectorTag(xmlDoc, 'COMPANY') || querySelectorTag(xmlDoc, 'SVCCOMPANY');
  if (companyNode) {
    companyName = companyNode.getAttribute('NAME') || getTagText(companyNode, 'NAME') || undefined;
  }

  // 1. Parse Groups <GROUP>
  const groupNodes = querySelectorAllTags(xmlDoc, 'GROUP');
  groupNodes.forEach(node => {
    const name = node.getAttribute('NAME') || getTagText(node, 'NAME');
    if (!name) return;
    const parent = getTagText(node, 'PARENT');
    const isDeemedPositive = getTagText(node, 'ISDEEMEDPOSITIVE').toLowerCase() === 'yes';
    
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
  const unitNodes = querySelectorAllTags(xmlDoc, 'UNIT');
  unitNodes.forEach(node => {
    const name = node.getAttribute('NAME') || getTagText(node, 'NAME');
    if (!name) return;
    const symbol = getTagText(node, 'ORIGINALNAME') || name;
    units.push({
      'Unit Name': name,
      Symbol: symbol,
      Group: 'General',
      'Conversion Factor': 1
    });
  });

  // 3. Parse Stock Groups <STOCKGROUP>
  const stockGroupNodes = querySelectorAllTags(xmlDoc, 'STOCKGROUP');
  stockGroupNodes.forEach(node => {
    const name = node.getAttribute('NAME') || getTagText(node, 'NAME');
    if (!name) return;
    const parent = getTagText(node, 'PARENT');
    itemGroups.push({
      'Group Name': name,
      'Parent Group': parent || undefined
    });
  });

  // 4. Parse Ledgers <LEDGER>
  const ledgerNodes = querySelectorAllTags(xmlDoc, 'LEDGER');
  ledgerNodes.forEach(node => {
    const name = node.getAttribute('NAME') || 
      querySelectorTag(node, 'NAME.LIST > NAME')?.textContent?.trim() || 
      getTagText(node, 'NAME');
    
    if (!name || name.trim() === '') return;

    const rawParent = getTagText(node, 'PARENT');
    const mappedGroup = normalizeAccountGroup(rawParent);

    const opBalText = getTagText(node, 'OPENINGBALANCE') || '0';
    let opBalNum = parseFloat(opBalText.replace(/[^0-9.-]/g, '')) || 0;
    
    let balType: 'Dr' | 'Cr' = 'Dr';
    if (opBalText.toUpperCase().includes('CR')) {
      balType = 'Cr';
      opBalNum = Math.abs(opBalNum);
    } else if (opBalText.toUpperCase().includes('DR')) {
      balType = 'Dr';
      opBalNum = Math.abs(opBalNum);
    } else {
      if (opBalNum < 0) {
        balType = 'Dr';
        opBalNum = Math.abs(opBalNum);
      } else if (opBalNum > 0) {
        balType = 'Cr';
      }
    }

    const gstin = getTagText(node, 'PARTYGSTIN') || 
      getTagText(node, 'GSTREGISTRATIONNUMBER') || 
      getTagText(node, 'INCOMETAXNUMBER');

    const phone = getTagText(node, 'LEDGERPHONE') || 
      getTagText(node, 'LEDGERMOBILE') || 
      getTagText(node, 'PHONE');

    const email = getTagText(node, 'EMAIL');

    let address = '';
    const addressNodes = node.querySelectorAll('ADDRESS.LIST > ADDRESS, ADDRESS, address.list > address, address');
    if (addressNodes.length > 0) {
      address = Array.from(addressNodes).map(a => a.textContent?.trim()).filter(Boolean).join(', ');
    }

    const bankName = getTagText(node, 'BANKNAME');
    const accNo = getTagText(node, 'BANKACCOUNTNUMBER');
    const branch = getTagText(node, 'BANKBRANCH');

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
    const billNodes = querySelectorAllTags(node, 'BILLALLOCATIONS.LIST');
    const isDebtor = mappedGroup.toLowerCase().includes('debtor');
    const isCreditor = mappedGroup.toLowerCase().includes('creditor');

    if (billNodes.length > 0 && (isDebtor || isCreditor)) {
      billNodes.forEach(bNode => {
        const bName = getTagText(bNode, 'NAME');
        if (!bName) return;
        const bDate = parseTallyDate(getTagText(bNode, 'BILLDATE'));
        const bAmtText = getTagText(bNode, 'AMOUNT') || '0';
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
  const itemNodes = querySelectorAllTags(xmlDoc, 'STOCKITEM');
  itemNodes.forEach((node, idx) => {
    const name = node.getAttribute('NAME') || 
      querySelectorTag(node, 'NAME.LIST > NAME')?.textContent?.trim() || 
      getTagText(node, 'NAME');

    if (!name || name.trim() === '') return;

    const parentGroup = getTagText(node, 'PARENT') || 'General';
    const baseUnits = getTagText(node, 'BASEUNITS') || 'Pcs';
    const hsn = getTagText(node, 'HSNCODE') || 
      querySelectorTag(node, 'HSNDETAILS.LIST > HSNCODE')?.textContent?.trim() || '';

    const opStockText = getTagText(node, 'OPENINGBALANCE') || '0';
    const opQtyMatch = opStockText.match(/([0-9.-]+)/);
    const opQty = opQtyMatch ? Math.abs(parseFloat(opQtyMatch[1])) || 0 : 0;

    const opValText = getTagText(node, 'OPENINGVALUE') || '0';
    const opVal = Math.abs(parseFloat(opValText.replace(/[^0-9.-]/g, '')) || 0);

    let purchaseRate = 0;
    const stdCostNodes = querySelectorAllTags(node, 'STANDARDCOSTLIST.LIST')
      .concat(querySelectorAllTags(node, 'STANDARDCOST.LIST'))
      .concat(querySelectorAllTags(node, 'STANDARDCOSTDETAILS.LIST'));

    let stdCostText = '';
    if (stdCostNodes.length > 0) {
      for (const scNode of stdCostNodes) {
        const rateVal = getTagText(scNode, 'RATE');
        if (rateVal) { stdCostText = rateVal; break; }
      }
    }
    if (!stdCostText) {
      stdCostText = getTagText(node, 'OPENINGRATE') || getTagText(node, 'PURCHASERATE') || getTagText(node, 'COST');
    }
    if (stdCostText) {
      const match = stdCostText.match(/([0-9.-]+)/);
      if (match) purchaseRate = parseFloat(match[1]) || 0;
    }
    if (purchaseRate === 0 && opQty > 0 && opVal > 0) {
      purchaseRate = Math.round((opVal / opQty) * 100) / 100;
    }

    let saleRate = 0;
    const stdRateNodes = querySelectorAllTags(node, 'STANDARDRATES.LIST')
      .concat(querySelectorAllTags(node, 'STANDARDSELLINGPRICES.LIST'))
      .concat(querySelectorAllTags(node, 'STANDARDPRICELIST.LIST'))
      .concat(querySelectorAllTags(node, 'STANDARDPRICES.LIST'))
      .concat(querySelectorAllTags(node, 'SELLINGPRICELIST.LIST'))
      .concat(querySelectorAllTags(node, 'SELLINGRATEDETAILS.LIST'))
      .concat(querySelectorAllTags(node, 'FULLPRICELIST.LIST'))
      .concat(querySelectorAllTags(node, 'PRICELEVELLIST.LIST'))
      .concat(querySelectorAllTags(node, 'PRICELEVELEDITEDLIST.LIST'))
      .concat(querySelectorAllTags(node, 'PRICELIST.LIST'))
      .concat(querySelectorAllTags(node, 'RATEDETAILS.LIST'));

    let stdPriceText = '';
    if (stdRateNodes.length > 0) {
      for (const srNode of stdRateNodes) {
        const rateEl = srNode.querySelector('RATE, BASICPRICE, PRICE, rate, basicprice, price');
        if (rateEl && rateEl.textContent?.trim()) {
          stdPriceText = rateEl.textContent.trim();
          break;
        }
        const rateVal = getTagText(srNode, 'RATE') || getTagText(srNode, 'BASICPRICE') || getTagText(srNode, 'PRICE');
        if (rateVal) { stdPriceText = rateVal; break; }
      }
    }

    if (!stdPriceText) {
      const deepRateEl = node.querySelector('STANDARDRATES RATE, STANDARDPRICELIST RATE, FULLPRICELIST RATE, PRICELEVELLIST RATE, RATEDETAILS RATE, STDRATE, STANDARDRATE, SELLINGRATE, SALESRATE, BASICPRICE');
      if (deepRateEl && deepRateEl.textContent?.trim()) {
        stdPriceText = deepRateEl.textContent.trim();
      }
    }

    if (!stdPriceText) {
      stdPriceText = getTagText(node, 'STDRATE') || 
                     getTagText(node, 'STANDARDRATE') || 
                     getTagText(node, 'SELLINGRATE') || 
                     getTagText(node, 'SALESRATE') || 
                     getTagText(node, 'BASICPRICE') || 
                     getTagText(node, 'OPENINGRATE');
    }

    if (stdPriceText) {
      const match = stdPriceText.match(/([0-9.-]+)/);
      if (match) saleRate = parseFloat(match[1]) || 0;
    }

    if (saleRate === 0 && purchaseRate > 0) {
      saleRate = purchaseRate;
    }

    let gstPct = 5;
    const gstRateText = querySelectorTag(node, 'GSTRATEDETAILS.LIST > GSTRATE, IGSTRATE, GSTRATE, TAXPERCENTAGE')?.textContent?.trim() || '';
    if (gstRateText) {
      const parsedGst = parseFloat(gstRateText);
      if (!isNaN(parsedGst) && parsedGst > 0) {
        gstPct = parsedGst;
      }
    }

    const partNo = getTagText(node, 'PARTNUMBER');
    const itemCode = partNo || `ITEM-${(idx + 1).toString().padStart(4, '0')}`;

    const batches: ItemBatch[] = [];
    const serialList: string[] = [];
    const batchNodes = querySelectorAllTags(node, 'BATCHALLOCATIONS.LIST');

    batchNodes.forEach((bNode, bIdx) => {
      const bName = getTagText(bNode, 'BATCHNAME');
      if (!bName || bName === 'Primary Batch' || bName === 'Not Applicable') return;

      const bQtyText = getTagText(bNode, 'OPENINGBALANCE') || '1';
      const bQtyMatch = bQtyText.match(/([0-9.-]+)/);
      const bQty = bQtyMatch ? Math.abs(parseFloat(bQtyMatch[1])) || 1 : 1;

      const expDate = parseTallyDate(getTagText(bNode, 'EXPIRYDATE'));
      const mfgDate = parseTallyDate(getTagText(bNode, 'MFGDATE'));

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

  // 6. Parse Historical Vouchers / DayBook
  const salesSeriesSet = new Set<string>();
  const voucherNodes = querySelectorAllTags(xmlDoc, 'VOUCHER');
  voucherNodes.forEach((node, vIdx) => {
    const vTypeName = getTagText(node, 'VOUCHERTYPENAME') || 
      node.getAttribute('VCHTYPE') || 'Sales';
    
    const vDate = parseTallyDate(getTagText(node, 'DATE'));
    const rawVNo = getTagText(node, 'VOUCHERNUMBER');
    const vNo = (rawVNo && rawVNo.trim() !== '') ? rawVNo.trim() : `VCH-${vIdx + 1}`;
    const narration = getTagText(node, 'NARRATION');

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

    if (grpType === 'S') {
      salesSeriesSet.add(vTypeName);
    }

    const ledgerNodes = querySelectorAllTags(node, 'ALLLEDGERENTRIES.LIST')
      .concat(querySelectorAllTags(node, 'LEDGERENTRIES.LIST'))
      .concat(querySelectorAllTags(node, 'ALLLEDGERENTRIES'))
      .concat(querySelectorAllTags(node, 'LEDGERENTRIES'));

    const inventoryNodes = querySelectorAllTags(node, 'ALLINVENTORYENTRIES.LIST')
      .concat(querySelectorAllTags(node, 'INVENTORYENTRIES.LIST'))
      .concat(querySelectorAllTags(node, 'ALLINVENTORYENTRIES'))
      .concat(querySelectorAllTags(node, 'INVENTORYENTRIES'));

    let totalVoucherAmt = 0;
    let debitParty = '';
    let creditParty = '';

    const lines: any[] = [];
    ledgerNodes.forEach((lNode, lIdx) => {
      const lName = getTagText(lNode, 'LEDGERNAME') || getTagText(lNode, 'NAME');
      if (!lName) return;
      const amtText = getTagText(lNode, 'AMOUNT') || '0';
      const numAmt = parseFloat(amtText.replace(/[^0-9.-]/g, '')) || 0;
      const isDeemedPos = getTagText(lNode, 'ISDEEMEDPOSITIVE').toLowerCase() === 'yes';

      const isDr = numAmt < 0 || isDeemedPos;
      const absAmt = Math.abs(numAmt);

      if (isDr) {
        if (!debitParty) debitParty = lName;
        lines.push({
          id: String(lIdx + 1),
          type: 'Dr',
          ledger: lName,
          debit: absAmt,
          credit: '',
          amount: absAmt
        });
      } else {
        if (!creditParty) creditParty = lName;
        lines.push({
          id: String(lIdx + 1),
          type: 'Cr',
          ledger: lName,
          debit: '',
          credit: absAmt,
          amount: absAmt
        });
      }
      totalVoucherAmt = Math.max(totalVoucherAmt, absAmt);
    });

    const vItems: any[] = [];
    inventoryNodes.forEach((iNode) => {
      const iName = getTagText(iNode, 'STOCKITEMNAME') || getTagText(iNode, 'NAME');
      if (!iName) return;

      const rateText = getTagText(iNode, 'RATE');
      const qtyText = getTagText(iNode, 'ACTUALQTY') || getTagText(iNode, 'BILLEDQTY') || getTagText(iNode, 'QTY');
      const amtText = getTagText(iNode, 'AMOUNT') || '0';
      const discText = getTagText(iNode, 'DISCOUNT') || '0';

      const numAmt = Math.abs(parseFloat(amtText.replace(/[^0-9.-]/g, '')) || 0);
      const qtyNum = Math.abs(parseFloat(qtyText.replace(/[^0-9.-]/g, ''))) || 1;
      const rateNum = rateText ? Math.abs(parseFloat(rateText.replace(/[^0-9.-]/g, ''))) : (qtyNum > 0 ? numAmt / qtyNum : 0);
      const discNum = Math.abs(parseFloat(discText.replace(/[^0-9.-]/g, ''))) || 0;

      let unitStr = 'Pcs';
      const unitMatch = qtyText.match(/[a-zA-Z]+/);
      if (unitMatch) unitStr = unitMatch[0];

      vItems.push({
        itemCode: iName,
        code: iName,
        name: iName,
        itemName: iName,
        qty: qtyNum,
        rate: rateNum || (qtyNum > 0 ? numAmt / qtyNum : 0),
        amount: numAmt,
        total: numAmt,
        discount: discNum,
        unit: unitStr
      });

      if (numAmt > 0) {
        totalVoucherAmt = Math.max(totalVoucherAmt, numAmt);
      }
    });

    if (lines.length === 0) {
      const partyName = getTagText(node, 'PARTYLEDGERNAME') || getTagText(node, 'PARTYNAME') || getTagText(node, 'BASICBUYERNAME');
      if (partyName) {
        const vAmtText = getTagText(node, 'AMOUNT') || getTagText(node, 'NETAMOUNT') || '0';
        const vAmt = Math.abs(parseFloat(vAmtText.replace(/[^0-9.-]/g, '')) || 0);
        lines.push({
          id: '1',
          type: 'Dr',
          ledger: partyName,
          debit: vAmt,
          credit: ''
        });
        totalVoucherAmt = Math.max(totalVoucherAmt, vAmt);
      }
    }

    if (lines.length > 0 || vItems.length > 0) {
      const rawParty = getTagText(node, 'PARTYLEDGERNAME') || getTagText(node, 'PARTYNAME') || getTagText(node, 'BASICBUYERNAME');
      const party = rawParty || (grpType === 'S' || grpType === 'DEL_NOTE' ? debitParty : (grpType === 'PUR' ? creditParty : (debitParty || creditParty || 'Party')));

      vouchers.push({
        id: `vch-tally-${vIdx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        transactionId: `vch-tally-${vIdx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        voucherNo: vNo,
        invoiceNo: vNo,
        billNo: vNo,
        voucherTypeName: vTypeName,
        type: grpType,
        date: vDate,
        party: party,
        partyLedger: party,
        customer: { name: party, ledger: party, phone: '', address: '' },
        supplier: { name: party, ledger: party, phone: '', address: '' },
        amount: totalVoucherAmt,
        subtotal: totalVoucherAmt,
        total: totalVoucherAmt,
        status: 'Active',
        narration: narration,
        notes: narration,
        lines: lines,
        items: vItems,
        cart: vItems
      } as any);
    }
  });

  // If DOM parsing yielded 0 ledgers, items and vouchers, run regex fallback parser
  if (ledgers.length === 0 && items.length === 0 && vouchers.length === 0) {
    const fallbackParsed = parseTallyXmlRegexFallback(xmlString, mode, fileName);
    if (fallbackParsed.ledgers.length > 0 || fallbackParsed.items.length > 0 || fallbackParsed.vouchers.length > 0) {
      return fallbackParsed;
    }
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
    salesVoucherSeries: Array.from(salesSeriesSet),
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
        const rawGst = parseFloat(String(r['GST %'] || r['Tax Rate'] || r['GST Rate'] || 0).replace(/[^0-9.-]/g, '')) || 0;
        const gstPct = rawGst > 0 ? rawGst : 5;
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

    // 5. Historical Vouchers / Daybook Vouchers
    let importedVouchersCount = 0;
    if (parsed.vouchers && parsed.vouchers.length > 0) {
      const existingVouchers = mergeOrReplace === 'replace'
        ? []
        : loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], targetCompanyId);

      const existingSales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], targetCompanyId);
      const existingPurchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], targetCompanyId);

      const existingSaleNos = new Set(existingSales.map(s => (s.invoiceNo || '').toLowerCase()));
      const existingPurchNos = new Set(existingPurchases.map(p => (p.billNo || p.invoiceNo || '').toLowerCase()));

      const existingSet = new Set(
        existingVouchers.map(v =>
          `${(v.type || '').toLowerCase()}_${(v.voucherNo || '').toLowerCase()}_${v.date || ''}_${v.amount || 0}_${((v as any).party || v.debitLedger || '').toLowerCase()}`
        )
      );

      parsed.vouchers.forEach((v, idx) => {
        const vNo = (v.voucherNo || '').trim() || `VCH-MIG-${idx + 1}`;
        const key = `${(v.type || '').toLowerCase()}_${vNo.toLowerCase()}_${v.date || ''}_${v.amount || 0}_${((v as any).party || v.debitLedger || '').toLowerCase()}`;

        if (mergeOrReplace === 'replace' || !existingSet.has(key)) {
          const seriesName = (v as any).voucherTypeName || 'Sales';
          const mappedType = (options.salesTypeMappings && options.salesTypeMappings[seriesName])
            || options.defaultSalesType
            || 'normalsale';
          const isPOS = mappedType === 'pos';

          const vchToSave: Voucher = {
            ...v,
            voucherNo: vNo,
            invoiceNo: vNo,
            billNo: vNo,
            isPOS: isPOS,
            importTargetType: mappedType,
            transactionId: v.transactionId || `vch-mig-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`
          } as any;
          existingVouchers.push(vchToSave);
          existingSet.add(key);
          importedVouchersCount++;

          // Mirror Sales Vouchers to Sales Invoices so Sales Entry & Sales Reports are fully loaded
          if ((v.type === 'S' || (v.type as string) === 'INV') && !existingSaleNos.has(vNo.toLowerCase())) {
            const partyName = (v as any).party || (v as any).partyLedger || 'Customer';
            const itemsList = (v as any).items && (v as any).items.length > 0 ? (v as any).items : ((v as any).cart && (v as any).cart.length > 0 ? (v as any).cart : []);
            existingSales.push({
              invoiceNo: vNo,
              voucherNo: vNo,
              voucherTypeName: seriesName,
              isPOS: isPOS,
              voucherTypeId: isPOS ? 'VT-SALE-POS' : 'VT-SALE-NORMAL',
              importTargetType: mappedType,
              date: v.date || new Date().toISOString(),
              dueDate: v.date,
              customer: {
                name: partyName,
                ledger: partyName,
                phone: '',
                address: ''
              },
              items: itemsList,
              cart: itemsList,
              subtotal: v.amount || 0,
              taxable: v.amount || 0,
              zeroRated: 0,
              gstAmt: 0,
              discount: 0,
              total: v.amount || 0,
              credit: isPOS ? 0 : (v.amount || 0),
              cash: isPOS ? (v.amount || 0) : 0,
              paymentMode: isPOS ? 'Cash' : 'Credit',
              status: isPOS ? ('Paid' as any) : ('Credit' as any),
              notes: v.narration || `Migrated Sales Voucher ${vNo} (${seriesName}) from ${parsed.source.toUpperCase()}`
            } as any);
            existingSaleNos.add(vNo.toLowerCase());
          }

          // Mirror Purchase Vouchers to Purchase Invoices
          if (v.type === 'PUR' && !existingPurchNos.has(vNo.toLowerCase())) {
            const partyName = (v as any).party || (v as any).partyLedger || 'Supplier';
            const itemsList = (v as any).items && (v as any).items.length > 0 ? (v as any).items : ((v as any).cart && (v as any).cart.length > 0 ? (v as any).cart : []);
            existingPurchases.push({
              id: (v as any).id || `pur-vch-${idx + 1}`,
              billNo: vNo,
              invoiceNo: vNo,
              supplierBillNo: vNo,
              date: v.date || new Date().toISOString(),
              dueDate: v.date,
              supplier: {
                name: partyName,
                ledger: partyName,
                phone: '',
                address: ''
              },
              items: itemsList,
              subtotal: v.amount || 0,
              taxable: v.amount || 0,
              total: v.amount || 0,
              credit: v.amount || 0,
              paymentMode: 'Credit',
              status: 'Credit' as any,
              notes: v.narration || `Migrated Purchase Voucher ${vNo} from ${parsed.source.toUpperCase()}`
            } as any);
            existingPurchNos.add(vNo.toLowerCase());
          }

          try {
            syncVoucherToSupabase(vchToSave);
          } catch (e) {
            // silent sync fallback
          }
        }
      });
      saveJson(STORAGE_KEYS.VOUCHERS, existingVouchers, targetCompanyId);
      saveJson(STORAGE_KEYS.SALES_INVOICES, existingSales, targetCompanyId);
      saveJson(STORAGE_KEYS.PURCHASE_INVOICES, existingPurchases, targetCompanyId);
    }

    // 6. Recalculate all balances & trial balance
    if (mergeOrReplace === 'replace') {
      rebuildAccountingLogs();
    } else {
      recalculateLedgerBalances();
    }

    // Broadcast system events
    window.dispatchEvent(new CustomEvent('ledgers_updated'));
    window.dispatchEvent(new CustomEvent('items_updated'));
    window.dispatchEvent(new CustomEvent('vouchers_updated'));
    window.dispatchEvent(new CustomEvent('deep_pos_vouchers_updated', { detail: { companyId: targetCompanyId } }));
    window.dispatchEvent(new CustomEvent('app:dataLoaded'));
    window.dispatchEvent(new CustomEvent('app:refresh-data'));

    const summaryParts: string[] = [];
    if (parsed.ledgers.length > 0) summaryParts.push(`${parsed.ledgers.length} ledgers`);
    if (parsed.items.length > 0) summaryParts.push(`${parsed.items.length} items`);
    if (importedBillsCount > 0) summaryParts.push(`${importedBillsCount} pending bills`);
    if (importedVouchersCount > 0) summaryParts.push(`${importedVouchersCount} vouchers`);

    const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') : '0 records';

    return {
      success: true,
      importedLedgers: parsed.ledgers.length,
      importedItems: parsed.items.length,
      importedOpeningBills: importedBillsCount,
      importedVouchers: importedVouchersCount,
      message: `Successfully migrated ${summaryText} from ${parsed.source === 'tally' ? 'TallyPrime' : 'Busy Accounting'}.`,
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
