import { 
  getFinancialReports, 
  getAdvancedReports, 
  getGSTReport, 
  getFullLedgerStatement, 
  getDeduplicatedSales,
  getDeduplicatedPurchases,
  loadJson, 
  STORAGE_KEYS
} from './storageService';
import { Voucher, LedgerLogEntry } from '../types';

export interface SearchResult {
  refNo: string;
  typeLabel: string;
  date: string;
  party: string;
  amount: number;
  matchedField: string;
  matchedText: string;
  score: number;
}

export function searchAllEntries(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  // Remove common prefix tokens like "search", "find", "show", "voucher", "entry", "check", "number", "no", "#"
  const cleanQuery = q.replace(/\b(search|find|show|voucher|entry|check|for|the|number|no|#)\b/gi, '').trim();
  const searchTerm = cleanQuery || q;
  const terms = searchTerm.split(/[\s,]+/).filter(t => t.length >= 2);

  const resultsMap = new Map<string, SearchResult>();

  const addResult = (res: SearchResult) => {
    const existing = resultsMap.get(res.refNo);
    if (!existing || res.score > existing.score) {
      resultsMap.set(res.refNo, res);
    }
  };

  // 1. Sales Invoices
  const sales = getDeduplicatedSales();
  for (const s of sales) {
    if (s.status === 'Cancelled') continue;
    const refNo = s.invoiceNo || '';
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-GB') : '-';
    const party = typeof s.customer === 'object' ? (s.customer.name || s.customer.ledger || 'Cash Customer') : String(s.customer || 'Cash Customer');
    const amount = Number(s.total) || 0;
    const narration = (s.narration || '').toString();
    const payDetails = s.paymentDetails as any;
    const bankTxn1 = (s.bankTxnNo || payDetails?.bank1TxnId || payDetails?.bankTxnNo || '').toString();
    const bankTxn2 = (s.bank2TxnNo || payDetails?.bank2TxnId || '').toString();
    const cheque1 = (payDetails?.bank1ChequeNo || payDetails?.chequeNo || '').toString();
    const cheque2 = (payDetails?.bank2ChequeNo || '').toString();

    if (refNo.toLowerCase() === searchTerm || refNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Invoice No', matchedText: refNo, score: 100 });
      continue;
    }
    if ((bankTxn1 && bankTxn1.toLowerCase().includes(searchTerm)) || (bankTxn1 && terms.some(t => bankTxn1.toLowerCase().includes(t)))) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Bank Txn ID', matchedText: bankTxn1, score: 95 });
      continue;
    }
    if ((bankTxn2 && bankTxn2.toLowerCase().includes(searchTerm)) || (bankTxn2 && terms.some(t => bankTxn2.toLowerCase().includes(t)))) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Bank Txn ID', matchedText: bankTxn2, score: 95 });
      continue;
    }
    if ((cheque1 && cheque1.toLowerCase().includes(searchTerm)) || (cheque2 && cheque2.toLowerCase().includes(searchTerm))) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Cheque No', matchedText: cheque1 || cheque2, score: 90 });
      continue;
    }
    if (narration.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Narration', matchedText: narration, score: 85 });
      continue;
    }
    const matchedItem = (s.items || []).find(it => 
      (it['Item Name'] || '').toLowerCase().includes(searchTerm) ||
      (it.description || it.lineDescription || it['Item Description'] || '').toLowerCase().includes(searchTerm) ||
      (it['Serial Numbers'] || '').toLowerCase().includes(searchTerm)
    );
    if (matchedItem) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Item / Serial', matchedText: matchedItem['Item Name'] || matchedItem['Serial Numbers'], score: 75 });
      continue;
    }
    if (terms.length > 0 && terms.every(t => narration.toLowerCase().includes(t) || party.toLowerCase().includes(t))) {
      addResult({ refNo, typeLabel: 'Sales Invoice', date: dateStr, party, amount, matchedField: 'Narration / Party', matchedText: narration || party, score: 70 });
    }
  }

  // 2. Purchase Invoices
  const purchases = getDeduplicatedPurchases();
  for (const p of purchases) {
    if ((p.status as string) === 'Cancelled') continue;
    const refNo = p.billNo || p.invoiceNo || '';
    const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-GB') : '-';
    const party = typeof p.supplier === 'object' ? (p.supplier.name || p.supplier.ledger || 'Supplier') : String(p.supplier || 'Supplier');
    const amount = Number(p.total) || 0;
    const supplierBillNo = (p.supplierBillNo || '').toString();
    const narration = ((p as any).narration || (p as any).notes || '').toString();
    const payDetails = p.paymentDetails as any;
    const bankTxn1 = (p.bankTxnNo || payDetails?.bank1TxnId || '').toString();
    const bankTxn2 = (p.bank2TxnNo || payDetails?.bank2TxnId || '').toString();

    if (refNo.toLowerCase() === searchTerm || refNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Purchase Bill', date: dateStr, party, amount, matchedField: 'Bill No', matchedText: refNo, score: 100 });
      continue;
    }
    if (supplierBillNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Purchase Bill', date: dateStr, party, amount, matchedField: 'Supplier Bill No', matchedText: supplierBillNo, score: 95 });
      continue;
    }
    if (bankTxn1.toLowerCase().includes(searchTerm) || bankTxn2.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Purchase Bill', date: dateStr, party, amount, matchedField: 'Bank Txn ID', matchedText: bankTxn1 || bankTxn2, score: 90 });
      continue;
    }
    if (narration.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: 'Purchase Bill', date: dateStr, party, amount, matchedField: 'Narration', matchedText: narration, score: 85 });
      continue;
    }
    const matchedItem = (p.items || []).find(it => 
      (it['Item Name'] || '').toLowerCase().includes(searchTerm) ||
      (it['Serial Numbers'] || '').toLowerCase().includes(searchTerm)
    );
    if (matchedItem) {
      addResult({ refNo, typeLabel: 'Purchase Bill', date: dateStr, party, amount, matchedField: 'Item / Serial', matchedText: matchedItem['Item Name'] || matchedItem['Serial Numbers'], score: 75 });
    }
  }

  // 3. Financial Vouchers
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  for (const v of vouchers) {
    if (v.status === 'Cancelled' || (v as any).isCancelled) continue;
    const refNo = v.voucherNo || (v as any).refNo || '';
    const dateStr = v.date ? new Date(v.date).toLocaleDateString('en-GB') : '-';
    const party = v.partyName || v.debitLedger || v.creditLedger || 'Voucher Entry';
    const amount = Number(v.totalAmount || v.amount) || 0;
    const narration = (v.narration || '').toString();
    const txnId = (v.transactionId || v.bankTxnNo || (v as any).referenceNo || (v as any).utrNo || '').toString();
    const chequeNo = (v.chequeNo || '').toString();
    const typeLabel = v.type === 'P' ? 'Payment Voucher' : v.type === 'R' ? 'Receipt Voucher' : v.type === 'J' ? 'Journal Voucher' : v.type === 'C' ? 'Contra Voucher' : v.type === 'CN' ? 'Credit Note' : v.type === 'DN' ? 'Debit Note' : 'Voucher';

    if (refNo.toLowerCase() === searchTerm || refNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel, date: dateStr, party, amount, matchedField: 'Voucher No', matchedText: refNo, score: 100 });
      continue;
    }
    if (txnId && txnId.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel, date: dateStr, party, amount, matchedField: 'Txn / Ref ID', matchedText: txnId, score: 95 });
      continue;
    }
    if (chequeNo && chequeNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel, date: dateStr, party, amount, matchedField: 'Cheque No', matchedText: chequeNo, score: 95 });
      continue;
    }
    if (narration && narration.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel, date: dateStr, party, amount, matchedField: 'Narration', matchedText: narration, score: 85 });
      continue;
    }
    const matchedLine = (v.lines || []).find(l => 
      (l.narration || '').toLowerCase().includes(searchTerm) ||
      (l.transactionId || (l as any).bankTxnId || '').toLowerCase().includes(searchTerm) ||
      ((l as any).chequeNo || '').toLowerCase().includes(searchTerm)
    );
    if (matchedLine) {
      addResult({ refNo, typeLabel, date: dateStr, party, amount, matchedField: 'Line Detail', matchedText: matchedLine.narration || matchedLine.transactionId || (matchedLine as any).chequeNo || '', score: 80 });
      continue;
    }
  }

  // 4. Ledger Log fallback
  const logs = loadJson<LedgerLogEntry[]>(STORAGE_KEYS.LEDGER_LOG, []);
  for (const l of logs) {
    const refNo = l['Ref No'];
    if (!refNo || resultsMap.has(refNo)) continue;
    const narration = (l.Narration || '').toString();
    const chequeNo = ((l as any)['Cheque No'] || '').toString();
    const txnId = (l.transactionId || l['Transaction ID'] || (l as any)['Txn ID'] || '').toString();
    const dateStr = l.DateIso ? new Date(l.DateIso).toLocaleDateString('en-GB') : '-';
    const amount = Number(l.Debit) > 0 ? Number(l.Debit) : Number(l.Credit) || 0;

    if (refNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: l.Type || 'Entry', date: dateStr, party: l['Ledger Name'], amount, matchedField: 'Ref No', matchedText: refNo, score: 90 });
    } else if (txnId && txnId.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: l.Type || 'Entry', date: dateStr, party: l['Ledger Name'], amount, matchedField: 'Txn ID', matchedText: txnId, score: 85 });
    } else if (chequeNo && chequeNo.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: l.Type || 'Entry', date: dateStr, party: l['Ledger Name'], amount, matchedField: 'Cheque No', matchedText: chequeNo, score: 85 });
    } else if (narration && narration.toLowerCase().includes(searchTerm)) {
      addResult({ refNo, typeLabel: l.Type || 'Entry', date: dateStr, party: l['Ledger Name'], amount, matchedField: 'Narration', matchedText: narration, score: 75 });
    }
  }

  return Array.from(resultsMap.values()).sort((a, b) => b.score - a.score);
}

// Basic fuzzy match / synonym checking
const synonyms = {
  top_items: ['top', 'best', 'highest', 'most sold', 'trending'],
  outstanding: ['outstanding', 'receivable', 'payable', 'due', 'owe'],
  sales: ['sale', 'sales', 'revenue', 'sold', 'income', 'earning'],
  purchases: ['purchase', 'purchases', 'bought', 'buy', 'expense', 'spent'],
  stock: ['stock balance', 'stock', 'inventory', 'item', 'items', 'qty', 'quantity', 'product', 'products', 'low stock'],
  gst: ['gst', 'tax', 'vat', 'taxes', 'duties'],
  ledger: ['ledger', 'account', 'statement', 'transaction', 'transactions', 'balance', 'party', 'customer', 'supplier'],
  profit: ['profit', 'loss', 'pnl', 'margin', 'earnings', 'net income'],
  bs: ['balance sheet', 'assets', 'liabilities', 'bs', 'capital', 'equity'],
  tb: ['trial balance', 'tb'],
  payroll: ['payroll', 'salary', 'wages', 'pay', 'employee']
};

function parseDateRange(query: string) {
  const q = query.toLowerCase();
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);
  let label = "today";

  if (q.includes('yesterday')) {
    from.setDate(now.getDate() - 1);
    to.setDate(now.getDate() - 1);
    label = "yesterday";
  } else if (q.includes('this week')) {
    from.setDate(now.getDate() - now.getDay());
    label = "this week";
  } else if (q.includes('last week')) {
    from.setDate(now.getDate() - now.getDay() - 7);
    to.setDate(now.getDate() - now.getDay() - 1);
    label = "last week";
  } else if (q.includes('this month')) {
    from.setDate(1);
    label = "this month";
  } else if (q.includes('last month')) {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
    label = "last month";
  } else if (q.includes('this year')) {
    from = new Date(now.getFullYear(), 0, 1);
    label = "this year";
  } else {
    // Check for specific months
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    for (let i = 0; i < months.length; i++) {
      if (q.includes(months[i]) || q.includes(` ${shortMonths[i]} `)) {
        let year = now.getFullYear();
        // Check if year is mentioned (e.g. "august 2025")
        const yearMatch = q.match(/\b(20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1]);
        
        from = new Date(year, i, 1);
        to = new Date(year, i + 1, 0); // Last day of that month
        label = months[i];
        break;
      }
    }
  }

  return {
    fromStr: from.toISOString().split('T')[0],
    toStr: to.toISOString().split('T')[0],
    label
  };
}

function findEntity(query: string, ledgers: any[], items: any[]) {
  const q = query.toLowerCase();
  const qTokens = q.split(/[\s,.-]+/).filter(t => t.length > 2);
  
  // Stop words that shouldn't trigger a fuzzy match on their own
  const stopWords = ['ledger', 'account', 'balance', 'report', 'show', 'tell', 'what', 'the', 'for', 'of', 'and', 'stock', 'item', 'sales', 'gst', 'purchase'];
  const meaningfulTokens = qTokens.filter(t => !stopWords.includes(t));
  
  let bestLedger = null;
  let maxLedgerScore = 0;
  
  for (const l of ledgers) {
    const originalName = l['Ledger Name'] || '';
    const ln = originalName.toLowerCase();
    if (!ln) continue;

    if (q.includes(ln)) {
      const score = ln.length + 100;
      if (score > maxLedgerScore) {
        bestLedger = originalName;
        maxLedgerScore = score;
      }
      continue;
    }

    const lnTokens = ln.split(/[\s,.-]+/).filter(t => t.length > 2);
    let matchCount = 0;
    for (const qt of meaningfulTokens) {
      if (lnTokens.some(lt => lt === qt || lt.includes(qt) || qt.includes(lt))) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const score = matchCount * 10;
      if (score > maxLedgerScore) {
        bestLedger = originalName;
        maxLedgerScore = score;
      }
    }
  }

  let bestItem = null;
  let maxItemScore = 0;
  
  for (const i of items) {
    const originalName = i['Item Name'] || i.name || '';
    const iname = originalName.toLowerCase();
    if (!iname) continue;

    if (q.includes(iname)) {
      const score = iname.length + 100;
      if (score > maxItemScore) {
        bestItem = originalName;
        maxItemScore = score;
      }
      continue;
    }

    const inameTokens = iname.split(/[\s,.-]+/).filter(t => t.length > 2);
    let matchCount = 0;
    for (const qt of meaningfulTokens) {
      if (inameTokens.some(it => it === qt || it.includes(qt) || qt.includes(it))) {
         matchCount++;
      }
    }

    if (matchCount > 0) {
      const score = matchCount * 10;
      if (score > maxItemScore) {
        bestItem = originalName;
        maxItemScore = score;
      }
    }
  }

  return { ledger: bestLedger, item: bestItem };
}

function determineIntent(query: string, entity: any) {
  const q = query.toLowerCase();
  
  // If a ledger is found, prioritize ledger statement unless specific other intent is strong
  if (entity.ledger && !q.includes('profit') && !q.includes('gst') && !q.includes('stock')) {
    return 'ledger';
  }

  let bestIntent = 'unknown';
  let maxScore = 0;

  for (const [intent, words] of Object.entries(synonyms)) {
    let score = 0;
    for (const word of words) {
      if (q.includes(word)) score += word.length; // Longer word matches give higher score
    }
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}


function getItemHistoryContext(searchWords: string[], qLower: string): string {
  const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  
  const itemMatches = items.filter(it => {
    const nameLower = (it['Item Name'] || '').toLowerCase();
    const codeLower = (it['Item Code'] || '').toLowerCase();
    
    // Very basic match
    return (searchWords.length > 0 && searchWords.some(w => (nameLower.includes(w) || codeLower.includes(w)))) ||
           nameLower.includes(qLower) || codeLower.includes(qLower);
  }).slice(0, 3); // top 3 items to avoid huge context

  if (itemMatches.length === 0) return '';

  const sales = loadJson<any[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const purchases = loadJson<any[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);

  let ctx = "\n\nDetailed Item History:\n";

  for (const it of itemMatches) {
    const itemName = it['Item Name'];
    ctx += `- Item: ${itemName} (Code: ${it['Item Code']})\n`;
    ctx += `  Current Master Sale Rate: ${it['Sale Rate'] || 0}, Master Purchase Rate: ${it['Purchase Rate'] || 0}, MRP: ${it['MRP'] || 0}, Stock: ${it['Current Stock'] || 0}\n`;

    // Find latest sales
    const itemSales = sales
      .filter(s => s.status !== 'Cancelled' && s.items && s.items.some((si: any) => si.itemName === itemName))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3); // last 3 sales

    if (itemSales.length > 0) {
      ctx += `  Last 3 Sales:\n`;
      for (const s of itemSales) {
        const lineItem = s.items.find((si: any) => si.itemName === itemName);
        const party = typeof s.customer === 'object' ? (s.customer.name || 'Cash') : (s.customer || 'Cash');
        const discStr = lineItem.discount ? (lineItem.discountType === 'percent' ? `${lineItem.discount}%` : `Nu. ${lineItem.discount}`) : '0';
        ctx += `    * Date: ${s.date}, Invoice: ${s.invoiceNo}, Party: ${party}, Qty: ${lineItem.qty}, Rate: Nu. ${lineItem.rate}, Discount Given: ${discStr}, Net Amount: Nu. ${lineItem.amount}\n`;
      }
    } else {
      ctx += `  No recent sales found.\n`;
    }

    // Find latest purchases
    const itemPurchases = purchases
      .filter(p => p.items && p.items.some((pi: any) => pi.itemName === itemName))
      .sort((a, b) => new Date(b.date || b.billDate).getTime() - new Date(a.date || a.billDate).getTime())
      .slice(0, 3); // last 3 purchases

    if (itemPurchases.length > 0) {
      ctx += `  Last 3 Purchases:\n`;
      for (const p of itemPurchases) {
        const lineItem = p.items.find((pi: any) => pi.itemName === itemName);
        const party = p.partyName || p.supplier || 'Unknown Supplier';
        const discStr = lineItem.discount ? (lineItem.discountType === 'percent' ? `${lineItem.discount}%` : `Nu. ${lineItem.discount}`) : '0';
        ctx += `    * Date: ${p.date || p.billDate}, Bill: ${p.billNumber || p.invoiceNo}, Supplier: ${party}, Qty: ${lineItem.qty}, Rate: Nu. ${lineItem.rate}, Discount: ${discStr}\n`;
      }
    } else {
      ctx += `  No recent purchases found.\n`;
    }
  }

  return ctx;
}

export async function processLocalQuery(query: string, history: any[] = []): Promise<string> {
  // Simulate slight thinking delay for UI polish
  await new Promise(r => setTimeout(r, 600));

  const qLower = query.toLowerCase();

  // 1. Navigation Commands & Settings Commands
  const navs = [
    { words: ['pos', 'billing', 'point of sale', 'register'], view: 'pos' },
    { words: ['normal sale', 'invoice'], view: 'normalsale' },
    { words: ['purchase entry', 'buy entry'], view: 'purchase' },
    { words: ['dashboard', 'home', 'main'], view: 'dashboard' },
    { words: ['masters', 'items master', 'ledger master'], view: 'masters' },
    { words: ['vouchers', 'all entries', 'daybook'], view: 'vouchers' },
    { words: ['settings', 'configuration'], view: 'settings' },
  ];
  
  if (qLower.includes('go to') || qLower.includes('open') || qLower.includes('navigate') || qLower.includes('show me the') || qLower.includes('take me to')) {
      for (const n of navs) {
          if (n.words.some(w => qLower.includes(w))) {
              let msg = `Navigating to ${n.view.toUpperCase()}...`;
              msg += `

\`\`\`json
{
  "action": "NAVIGATE",
  "payload": {
    "view": "${n.view}"
  }
}
\`\`\``;
              return msg;
          }
      }
      
      // Check for specific reports
      const reports = [
         { words: ['itemwise profit', 'item profit'], target: 'item-profit' },
         { words: ['sales'], target: 'sales' },
         { words: ['stock', 'inventory'], target: 'stock' },
         { words: ['gst', 'tax'], target: 'gst' },
         { words: ['trial balance'], target: 'trial balance' },
         { words: ['profit & loss', 'profit and loss', 'pnl'], target: 'profit & loss' },
         { words: ['balance sheet'], target: 'balance sheet' },
      ];
      for (const r of reports) {
          if (r.words.some(w => qLower.includes(w))) {
              let msg = `Opening the ${r.target} report...`;
              msg += `

\`\`\`json
{
  "action": "NAVIGATE",
  "payload": {
    "view": "reports",
    "report": "${r.target}"
  }
}
\`\`\``;
              return msg;
          }
      }
  }

  
  
  // 2. Settings changes
  if (qLower.includes('enable item discount') || (qLower.includes('turn on') && qLower.includes('item discount'))) {
      return 'Enabling Item Discount in POS settings.\n\n```json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableItemDiscount": true }\n}\n```';
  }
  if (qLower.includes('disable item discount') || (qLower.includes('turn off') && qLower.includes('item discount'))) {
      return 'Disabling Item Discount in POS settings.\n\n```json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableItemDiscount": false }\n}\n```';
  }
  if (qLower.includes('enable bill discount') || (qLower.includes('turn on') && qLower.includes('bill discount'))) {
      return 'Enabling Bill Discount in POS settings.\n\n```json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableBillDiscount": true }\n}\n```';
  }
  if (qLower.includes('disable bill discount') || (qLower.includes('turn off') && qLower.includes('bill discount'))) {
      return 'Disabling Bill Discount in POS settings.\n\n```json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableBillDiscount": false }\n}\n```';
  }
  
  if (qLower.includes('enable asset management') || (qLower.includes('turn on') && qLower.includes('asset management'))) {
      return 'Enabling Asset Management module.\n\n```json\n{\n  "action": "UPDATE_CONFIG",\n  "payload": { "EnableAssetManagement": "true" }\n}\n```';
  }
  if (qLower.includes('disable asset management') || (qLower.includes('turn off') && qLower.includes('asset management'))) {
      return 'Disabling Asset Management module.\n\n```json\n{\n  "action": "UPDATE_CONFIG",\n  "payload": { "EnableAssetManagement": "false" }\n}\n```';
  }
  
  if (qLower.includes('enable payroll') || (qLower.includes('turn on') && qLower.includes('payroll'))) {
      return 'Enabling Payroll module.\n\n```json\n{\n  "action": "UPDATE_CONFIG",\n  "payload": { "EnablePayroll": "true" }\n}\n```';
  }
  if (qLower.includes('disable payroll') || (qLower.includes('turn off') && qLower.includes('payroll'))) {
      return 'Disabling Payroll module.\n\n```json\n{\n  "action": "UPDATE_CONFIG",\n  "payload": { "EnablePayroll": "false" }\n}\n```';
  }

  // 3. Search exact vouchers/entries or items



  const itemsFallback = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  const numbersInQueryFallback: string[] = query.match(/\d+(\.\d+)?/g) || [];
  const stopWords = ['what', 'is', 'the', 'purchase', 'price', 'of', 'sale', 'how', 'much', 'does', 'cost', 'find', 'out', 'search', 'item', 'with', 'selling', 'rate', 'latest', 'last', 'first', 'show', 'me', 'tell', 'about', 'for', 'any'];
  const searchWordsFallback = (qLower.match(/[a-z0-9]+/gi) || []).filter(w => w.length > 1 && !stopWords.includes(w));
  
  const itemMatchesFallback = itemsFallback.filter(it => {
    const nameLower = (it['Item Name'] || '').toLowerCase();
    const codeLower = (it['Item Code'] || '').toLowerCase();
    const catLower = (it.Category || '').toLowerCase();
    
    const matchesWord = searchWordsFallback.length > 0 && searchWordsFallback.some(w => (nameLower.includes(w) || codeLower.includes(w) || catLower.includes(w)));
    const matchesQuery = nameLower.includes(qLower) || codeLower.includes(qLower);
    
    return matchesWord || matchesQuery ||
    numbersInQueryFallback.includes(it['Sale Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['Purchase Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['MRP']?.toString());
  }).slice(0, 6);

  const entryMatches = searchAllEntries(query);

  if (entryMatches.length > 0 || itemMatchesFallback.length > 0) {
    let msg = `🔍 **Found ${entryMatches.length + itemMatchesFallback.length} matching record${(entryMatches.length + itemMatchesFallback.length) > 1 ? 's' : ''} for "${query}"**:\n\n`;
    
    if (itemMatchesFallback.length > 0) {
      msg += `**Items:**\n`;
      itemMatchesFallback.forEach(it => {
        msg += `• **${it['Item Name']}** (Code: ${it['Item Code']})\n  Sale Rate: Nu. ${it['Sale Rate']} | Purchase Rate: Nu. ${it['Purchase Rate']} | MRP: Nu. ${it['MRP']} | Stock: ${it['Current Stock']}\n\n`;
      });
      // Add historical context for the first item matched!
      const historyCtx = getItemHistoryContext(searchWordsFallback, qLower);
      if (historyCtx) {
          msg += `**Recent Activity:**\n${historyCtx}\n`;
      }
    }

    if (entryMatches.length > 0) {
      msg += `**Vouchers & Transactions:**\n`;
      entryMatches.slice(0, 6).forEach(m => {
        msg += `• **${m.typeLabel} ${m.refNo}** (${m.date}) - **Nu. ${m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`;
        msg += `  Party/Account: ${m.party}\n`;
        if (m.matchedField && m.matchedText) {
          msg += `  Matched ${m.matchedField}: _"${m.matchedText}"_\n`;
        }
        msg += `  [View Voucher: ${m.refNo}]\n\n`;
      });
    }
    
    return msg;
  }

  // 4. Fall back to Report Intent Analysis
  const ledgers = loadJson<any[]>(STORAGE_KEYS.LEDGERS, []);
  const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  const { fromStr, toStr, label } = parseDateRange(query);
  const entity = findEntity(query, ledgers, items);
  const intent = determineIntent(query, entity);

  const formatNu = (val: number) => `Nu. ${val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const dateTag = `${fromStr}_${toStr}`;

  try {
    switch (intent) {
      case 'top_items': {
        const sales = loadJson(STORAGE_KEYS.SALES_INVOICES, []);
        const itemCounts = {};
        sales.forEach(s => {
          if (s.status !== 'Cancelled' && s.items) {
             s.items.forEach(i => {
                itemCounts[i.itemName] = (itemCounts[i.itemName] || 0) + (Number(i.qty) || 0);
             });
          }
        });
        const sorted = Object.entries(itemCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
        if (sorted.length === 0) return 'No sales data found to determine top items.';
        let resMsg = '🏆 **Top Selling Items:**\n\n';
        sorted.forEach((s, idx) => {
           resMsg += `${idx + 1}. **${s[0]}** (${s[1]} units sold)\n`;
        });
        return resMsg;
      }
      
      case 'outstanding': {
        const ledgersData = loadJson(STORAGE_KEYS.LEDGERS, []);
        let receivables = 0;
        let payables = 0;
        let resMsg = '📊 **Outstanding Balances:**\n\n';
        ledgersData.forEach(l => {
           const grp = (l.Group || '').toLowerCase();
           if (grp.includes('sundry debtor') || grp.includes('customer')) {
              const stmt = getFullLedgerStatement(l['Ledger Name']);
              let bal = stmt.openingBalance;
              stmt.rows.forEach(r => bal += (Number(r.Debit)||0) - (Number(r.Credit)||0));
              if (bal > 0) receivables += bal;
           }
           if (grp.includes('sundry creditor') || grp.includes('supplier')) {
              const stmt = getFullLedgerStatement(l['Ledger Name']);
              let bal = stmt.openingBalance;
              stmt.rows.forEach(r => bal += (Number(r.Debit)||0) - (Number(r.Credit)||0));
              if (bal < 0) payables += Math.abs(bal);
           }
        });
        resMsg += `**Total Receivables (Customers owe you):** ${formatNu(receivables)}\n`;
        resMsg += `**Total Payables (You owe suppliers):** ${formatNu(payables)}\n\n`;
        resMsg += '[View Balance Sheet: ' + dateTag + ']';
        return resMsg;
      }

      case 'sales': {
        const { pnl } = getFinancialReports('', fromStr, toStr);
        return `Your total sales revenue for ${label} is ${formatNu(pnl.s)}. \n\n[View Sales Report: ${dateTag}]`;
      }
      
      case 'purchases': {
        const { pnl } = getFinancialReports('', fromStr, toStr);
        return `Your total purchases for ${label} amount to ${formatNu(pnl.p)}. \n\n[View Profit & Loss: ${dateTag}]`;
      }

      case 'profit': {
        const pnlRep = getAdvancedReports('pnl', fromStr, toStr) as any;
        const grossProfit = (pnlRep.s + pnlRep.di + pnlRep.cs) - (pnlRep.p + pnlRep.de + pnlRep.os);
        const netProfit = grossProfit + pnlRep.ii - pnlRep.ie;
        return `For ${label}, your Gross Profit is ${formatNu(grossProfit)} and your Net Profit is ${formatNu(netProfit)}. \n\n[View Profit & Loss: ${dateTag}]`;
      }

      case 'gst': {
        const gst = getGSTReport(fromStr, toStr);
        return `GST Summary for ${label}:\nTotal Taxable: ${formatNu(gst.totals.taxable)}\nTotal GST Amount: ${formatNu(gst.totals.gstAmount)}\nNet Total: ${formatNu(gst.totals.total)}\n\n[View GST Report: ${dateTag}]`;
      }

      case 'ledger': {
        if (entity.ledger) {
          const stmt = getFullLedgerStatement(entity.ledger);
          
          let bal = stmt.openingBalance;
          stmt.rows.forEach(r => {
             const d = new Date(r.DateIso).getTime();
             const fd = new Date(fromStr).getTime();
             const td = new Date(toStr).setHours(23, 59, 59, 999);
             if (d <= td) {
               bal += (Number(r.Debit) || 0) - (Number(r.Credit) || 0);
             }
          });
          
          const type = bal >= 0 ? 'Dr' : 'Cr';
          return `The current balance for **${entity.ledger}** is ${formatNu(Math.abs(bal))} (${type}). \n\n[View Ledger Report: ${entity.ledger}: ${dateTag}]`;
        }
        return `Please specify which ledger or account you want to view. For example, "Show me the ledger for Cash-in-Hand". \n\n[View Ledger Report: ${dateTag}]`;
      }

      case 'tb': {
        return `You can view your complete Trial Balance here: \n\n[View Trial Balance: ${dateTag}]`;
      }

      case 'bs': {
        return `You can view your Balance Sheet here: \n\n[View Balance Sheet: ${dateTag}]`;
      }

      case 'stock': {
        if (entity.item) {
           return `I found the item **${entity.item}**. You can view detailed inventory reports here: \n\n[View Stock Report: ${dateTag}]`;
        }
        return `You can view your inventory summary and low stock alerts here: \n\n[View Stock Report: ${dateTag}]`;
      }

      default:
        // Try a conversational fallback
        if (qLower.includes('hello') || qLower.includes('hi ')) {
           return "Hello! I am your local smart assistant. I can help you find items, look up vouchers, analyze profits, and navigate around the app without needing the internet. What can I help you with?";
        }
        if (qLower.includes('help')) {
           return "I can help you analyze your data entirely locally! Try asking:\n- 'What is my total sales for today?'\n- 'What is the stock and last purchase price of [item]?'\n- 'Go to POS'\n- 'Show me the GST report for this month'\n- 'Enable item discount'";
        }
        return `I'm your Offline Smart Assistant. I can understand keywords related to Sales, Purchases, Profit, GST, Stock, and Ledgers. Try asking things like "August GST", "Sales today", or "Ledger for Cash-in-Hand".`;
    }
  } catch (error) {
    console.error("Local AI Error:", error);
    return "Sorry, I ran into a local data error while trying to generate that report.";
  }
}
