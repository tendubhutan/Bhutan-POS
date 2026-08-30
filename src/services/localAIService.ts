import { 
  getFinancialReports, 
  getAdvancedReports, 
  getGSTReport, 
  getFullLedgerStatement, 
  loadJson, 
  STORAGE_KEYS
} from './storageService';

// Basic fuzzy match / synonym checking
const synonyms = {
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

export async function processLocalQuery(query: string, history: any[] = []): Promise<string> {
  // Simulate slight thinking delay for UI polish
  await new Promise(r => setTimeout(r, 600));

  const ledgers = loadJson<any[]>(STORAGE_KEYS.LEDGERS, []);
  const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);

  const { fromStr, toStr, label } = parseDateRange(query);
  const entity = findEntity(query, ledgers, items);
  const intent = determineIntent(query, entity);

  const formatNu = (val: number) => `Nu. ${val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const dateTag = `${fromStr}_${toStr}`;

  try {
    switch (intent) {
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
        return `I'm an offline Smart Assistant. I understand keywords related to Sales, Purchases, Profit, GST, Stock, and specific Ledgers. Try asking things like "August GST", "Sales today", or "Ledger for Cash-in-Hand".`;
    }
  } catch (error) {
    console.error("Local AI Error:", error);
    return "Sorry, I ran into a local data error while trying to generate that report.";
  }
}
