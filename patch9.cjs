const fs = require('fs');
const file = 'src/services/storageService.ts';
let content = fs.readFileSync(file, 'utf8');

const updatedStockLedger = `
export function getItemStockLedger(code: string, fromDate?: string, toDate?: string): StockLedgerEntry[] {
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const cleanCode = (code || '').trim().toLowerCase();
  const it = items.find(i => String(i['Item Code'] || '').trim().toLowerCase() === cleanCode || String(i['Item Name'] || '').trim().toLowerCase() === cleanCode);
  if (it && it['Maintain Stock'] === 'N') return [];

  const baseOpening = it ? (Number(it['Opening Stock']) || 0) : 0;
  const rawLogs = loadJson<StockLedgerEntry[]>(STORAGE_KEYS.STOCK_LEDGER, []);
  
  // Sort everything chronologically
  const itemLogs = rawLogs
    .filter(r => String(r['Item Code'] || '').trim().toLowerCase() === cleanCode || String(r['Item Name'] || '').trim().toLowerCase() === cleanCode)
    .sort((a, b) => new Date(a.DateIso).getTime() - new Date(b.DateIso).getTime());

  // Check if there is an explicit Opening log entry
  const hasOpeningEntry = itemLogs.some(r => r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING')));

  const finalLogs: StockLedgerEntry[] = [];
  
  const fromMs = fromDate ? new Date(fromDate).setHours(0,0,0,0) : 0;
  const toMs = toDate ? new Date(toDate).setHours(23,59,59,999) : 9999999999999;
  
  let runningBalance = hasOpeningEntry ? 0 : baseOpening;
  let openingBalAtFromDate = runningBalance;
  
  // First pass: Calculate running balance and find opening balance at fromDate
  itemLogs.forEach(r => {
    const qIn = Number(r['Qty In']) || 0;
    const qOut = Number(r['Qty Out']) || 0;
    const logTime = new Date(r.DateIso).getTime();
    
    if (r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING'))) {
      runningBalance = qIn || baseOpening;
      if (logTime < fromMs) openingBalAtFromDate = runningBalance;
    } else {
      runningBalance += (qIn - qOut);
      if (logTime < fromMs) openingBalAtFromDate = runningBalance;
    }
  });

  // Reset and build final logs in period
  runningBalance = openingBalAtFromDate;
  
  if (fromDate) {
    finalLogs.push({
      DateIso: new Date(fromDate).toISOString(),
      'Item Code': it ? it['Item Code'] : code,
      'Item Name': it ? it['Item Name'] : code,
      Type: 'Opening Balance',
      'Qty In': openingBalAtFromDate >= 0 ? openingBalAtFromDate : 0,
      'Qty Out': openingBalAtFromDate < 0 ? Math.abs(openingBalAtFromDate) : 0,
      Balance: openingBalAtFromDate,
      'Ref No': 'OPENING'
    });
  } else if (!hasOpeningEntry && it) {
    finalLogs.push({
      DateIso: new Date(2025, 0, 1).toISOString(),
      'Item Code': it['Item Code'],
      'Item Name': it['Item Name'],
      Type: 'Opening Balance',
      'Qty In': baseOpening,
      'Qty Out': 0,
      Balance: baseOpening,
      'Ref No': it['Opening Serials'] && it['Opening Serials'].trim() ? \`OPENING (\${it['Opening Serials']})\` : 'OPENING'
    });
  }

  itemLogs.forEach(r => {
    const logTime = new Date(r.DateIso).getTime();
    if (logTime >= fromMs && logTime <= toMs) {
      const qIn = Number(r['Qty In']) || 0;
      const qOut = Number(r['Qty Out']) || 0;
      
      if (r.Type === 'Opening' || (r['Ref No'] && r['Ref No'].startsWith('OPENING'))) {
        runningBalance = qIn || baseOpening;
      } else {
        runningBalance += (qIn - qOut);
      }
      
      finalLogs.push({
        ...r,
        Balance: runningBalance
      });
    }
  });

  return finalLogs;
}
`;

content = content.replace(/export function getItemStockLedger\([\s\S]*?return finalLogs;\n}/, updatedStockLedger.trim());

fs.writeFileSync(file, content, 'utf8');
console.log('Patched getItemStockLedger');
