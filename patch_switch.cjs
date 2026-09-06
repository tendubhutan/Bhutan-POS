const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
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
        let resMsg = '🏆 **Top Selling Items:**\\n\\n';
        sorted.forEach((s, idx) => {
           resMsg += \`\${idx + 1}. **\${s[0]}** (\${s[1]} units sold)\\n\`;
        });
        return resMsg;
      }
      
      case 'outstanding': {
        const ledgersData = loadJson(STORAGE_KEYS.LEDGERS, []);
        let receivables = 0;
        let payables = 0;
        let resMsg = '📊 **Outstanding Balances:**\\n\\n';
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
        resMsg += \`**Total Receivables (Customers owe you):** \${formatNu(receivables)}\\n\`;
        resMsg += \`**Total Payables (You owe suppliers):** \${formatNu(payables)}\\n\\n\`;
        resMsg += '[View Balance Sheet: ' + dateTag + ']';
        return resMsg;
      }

      case 'sales': {
`;

content = content.replace(
  "switch (intent) {\n      case 'sales': {",
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
