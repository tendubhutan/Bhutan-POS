const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
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
              let msg = \`Navigating to \${n.view.toUpperCase()}...\`;
              msg += \`\n\n\\\`\\\`\\\`json\n{\n  "action": "NAVIGATE",\n  "payload": {\n    "view": "\${n.view}"\n  }\n}\n\\\`\\\`\\\`\`;
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
              let msg = \`Opening the \${r.target} report...\`;
              msg += \`\n\n\\\`\\\`\\\`json\n{\n  "action": "NAVIGATE",\n  "payload": {\n    "view": "reports",\n    "report": "\${r.target}"\n  }\n}\n\\\`\\\`\\\`\`;
              return msg;
          }
      }
  }

  // 2. Settings changes
  if (qLower.includes('enable item discount') || (qLower.includes('turn on') && qLower.includes('item discount'))) {
      return 'Enabling Item Discount in POS settings.\n\n\`\`\`json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableItemDiscount": true }\n}\n\`\`\`';
  }
  if (qLower.includes('disable item discount') || (qLower.includes('turn off') && qLower.includes('item discount'))) {
      return 'Disabling Item Discount in POS settings.\n\n\`\`\`json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableItemDiscount": false }\n}\n\`\`\`';
  }
  if (qLower.includes('enable bill discount') || (qLower.includes('turn on') && qLower.includes('bill discount'))) {
      return 'Enabling Bill Discount in POS settings.\n\n\`\`\`json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableBillDiscount": true }\n}\n\`\`\`';
  }
  if (qLower.includes('disable bill discount') || (qLower.includes('turn off') && qLower.includes('bill discount'))) {
      return 'Disabling Bill Discount in POS settings.\n\n\`\`\`json\n{\n  "action": "UPDATE_POS_SETTINGS",\n  "payload": { "enableBillDiscount": false }\n}\n\`\`\`';
  }

  // 3. Search exact vouchers/entries or items
  const itemsFallback = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  const numbersInQueryFallback: string[] = query.match(/\\d+(\\.\\d+)?/g) || [];
  const searchWordsFallback = qLower.replace(/\\b(what|is|the|purchase|price|of|sale|how|much|does|cost|find|search|item|with|selling|rate)\\b/gi, '').match(/[a-z0-9]+/gi) || [];
  
  const itemMatchesFallback = itemsFallback.filter(it => {
    const nameLower = (it['Item Name'] || '').toLowerCase();
    const codeLower = (it['Item Code'] || '').toLowerCase();
    const catLower = (it.Category || '').toLowerCase();
    
    const matchesWord = searchWordsFallback.length > 0 && searchWordsFallback.some(w => w.length > 2 && (nameLower.includes(w) || codeLower.includes(w) || catLower.includes(w)));
    const matchesQuery = nameLower.includes(qLower) || codeLower.includes(qLower);
    
    return matchesWord || matchesQuery ||
    numbersInQueryFallback.includes(it['Sale Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['Purchase Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['MRP']?.toString());
  }).slice(0, 6);

  const entryMatches = searchAllEntries(query);

  if (entryMatches.length > 0 || itemMatchesFallback.length > 0) {
    let msg = \`🔍 **Found \${entryMatches.length + itemMatchesFallback.length} matching record\${(entryMatches.length + itemMatchesFallback.length) > 1 ? 's' : ''} for "\${query}"**:\\n\\n\`;
    
    if (itemMatchesFallback.length > 0) {
      msg += \`**Items:**\\n\`;
      itemMatchesFallback.forEach(it => {
        msg += \`• **\${it['Item Name']}** (Code: \${it['Item Code']})\\n  Sale Rate: Nu. \${it['Sale Rate']} | Purchase Rate: Nu. \${it['Purchase Rate']} | MRP: Nu. \${it['MRP']} | Stock: \${it['Current Stock']}\\n\\n\`;
      });
      // Add historical context for the first item matched!
      const historyCtx = getItemHistoryContext(searchWordsFallback, qLower);
      if (historyCtx) {
          msg += \`**Recent Activity:**\\n\${historyCtx}\\n\`;
      }
    }

    if (entryMatches.length > 0) {
      msg += \`**Vouchers & Transactions:**\\n\`;
      entryMatches.slice(0, 6).forEach(m => {
        msg += \`• **\${m.typeLabel} \${m.refNo}** (\${m.date}) - **Nu. \${m.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\\n\`;
        msg += \`  Party/Account: \${m.party}\\n\`;
        if (m.matchedField && m.matchedText) {
          msg += \`  Matched \${m.matchedField}: _"\${m.matchedText}"_\\n\`;
        }
        msg += \`  [View Voucher: \${m.refNo}]\\n\\n\`;
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

  const formatNu = (val: number) => \`Nu. \${val.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}\`;
  const dateTag = \`\${fromStr}_\${toStr}\`;

  try {
    switch (intent) {
      case 'sales': {
        const { pnl } = getFinancialReports('', fromStr, toStr);
        return \`Your total sales revenue for \${label} is \${formatNu(pnl.s)}. \\n\\n[View Sales Report: \${dateTag}]\`;
      }
      
      case 'purchases': {
        const { pnl } = getFinancialReports('', fromStr, toStr);
        return \`Your total purchases for \${label} amount to \${formatNu(pnl.p)}. \\n\\n[View Profit & Loss: \${dateTag}]\`;
      }

      case 'profit': {
        const pnlRep = getAdvancedReports('pnl', fromStr, toStr) as any;
        const grossProfit = (pnlRep.s + pnlRep.di + pnlRep.cs) - (pnlRep.p + pnlRep.de + pnlRep.os);
        const netProfit = grossProfit + pnlRep.ii - pnlRep.ie;
        return \`For \${label}, your Gross Profit is \${formatNu(grossProfit)} and your Net Profit is \${formatNu(netProfit)}. \\n\\n[View Profit & Loss: \${dateTag}]\`;
      }

      case 'gst': {
        const gst = getGSTReport(fromStr, toStr);
        return \`GST Summary for \${label}:\\nTotal Taxable: \${formatNu(gst.totals.taxable)}\\nTotal GST Amount: \${formatNu(gst.totals.gstAmount)}\\nNet Total: \${formatNu(gst.totals.total)}\\n\\n[View GST Report: \${dateTag}]\`;
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
          return \`The current balance for **\${entity.ledger}** is \${formatNu(Math.abs(bal))} (\${type}). \\n\\n[View Ledger Report: \${entity.ledger}: \${dateTag}]\`;
        }
        return \`Please specify which ledger or account you want to view. For example, "Show me the ledger for Cash-in-Hand". \\n\\n[View Ledger Report: \${dateTag}]\`;
      }

      case 'tb': {
        return \`You can view your complete Trial Balance here: \\n\\n[View Trial Balance: \${dateTag}]\`;
      }

      case 'bs': {
        return \`You can view your Balance Sheet here: \\n\\n[View Balance Sheet: \${dateTag}]\`;
      }

      case 'stock': {
        if (entity.item) {
           return \`I found the item **\${entity.item}**. You can view detailed inventory reports here: \\n\\n[View Stock Report: \${dateTag}]\`;
        }
        return \`You can view your inventory summary and low stock alerts here: \\n\\n[View Stock Report: \${dateTag}]\`;
      }

      default:
        // Try a conversational fallback
        if (qLower.includes('hello') || qLower.includes('hi ')) {
           return "Hello! I am your local smart assistant. I can help you find items, look up vouchers, analyze profits, and navigate around the app without needing the internet. What can I help you with?";
        }
        if (qLower.includes('help')) {
           return "I can help you analyze your data entirely locally! Try asking:\\n- 'What is my total sales for today?'\\n- 'What is the stock and last purchase price of [item]?'\\n- 'Go to POS'\\n- 'Show me the GST report for this month'\\n- 'Enable item discount'";
        }
        return \`I'm your Offline Smart Assistant. I can understand keywords related to Sales, Purchases, Profit, GST, Stock, and Ledgers. Try asking things like "August GST", "Sales today", or "Ledger for Cash-in-Hand".\`;
    }
  } catch (error) {
    console.error("Local AI Error:", error);
    return "Sorry, I ran into a local data error while trying to generate that report.";
  }
}
`;

content = content.replace(
  /export async function processLocalQuery[\s\S]*?\} catch \(error\) \{\s*console\.error\("Local AI Error:", error\);\s*return "Sorry, I ran into a local data error while trying to generate that report\.";\s*\}\s*\}/,
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService with completely independent local engine.');
