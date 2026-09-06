const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const newItemHistoryLogic = `
function getItemHistoryContext(searchWords: string[], qLower: string): string {
  const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  
  const itemMatches = items.filter(it => {
    const nameLower = (it['Item Name'] || '').toLowerCase();
    const codeLower = (it['Item Code'] || '').toLowerCase();
    
    // Very basic match
    return (searchWords.length > 0 && searchWords.some(w => w.length > 2 && (nameLower.includes(w) || codeLower.includes(w)))) ||
           nameLower.includes(qLower) || codeLower.includes(qLower);
  }).slice(0, 3); // top 3 items to avoid huge context

  if (itemMatches.length === 0) return '';

  const sales = loadJson<any[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const purchases = loadJson<any[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);

  let ctx = "\\n\\nDetailed Item History:\\n";

  for (const it of itemMatches) {
    const itemName = it['Item Name'];
    ctx += \`- Item: \${itemName} (Code: \${it['Item Code']})\\n\`;
    ctx += \`  Current Master Sale Rate: \${it['Sale Rate'] || 0}, Master Purchase Rate: \${it['Purchase Rate'] || 0}, MRP: \${it['MRP'] || 0}, Stock: \${it['Current Stock'] || 0}\\n\`;

    // Find latest sales
    const itemSales = sales
      .filter(s => s.status !== 'Cancelled' && s.items && s.items.some((si: any) => si.itemName === itemName))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3); // last 3 sales

    if (itemSales.length > 0) {
      ctx += \`  Last 3 Sales:\\n\`;
      for (const s of itemSales) {
        const lineItem = s.items.find((si: any) => si.itemName === itemName);
        const party = typeof s.customer === 'object' ? (s.customer.name || 'Cash') : (s.customer || 'Cash');
        const discStr = lineItem.discount ? (lineItem.discountType === 'percent' ? \`\${lineItem.discount}%\` : \`Nu. \${lineItem.discount}\`) : '0';
        ctx += \`    * Date: \${s.date}, Invoice: \${s.invoiceNo}, Party: \${party}, Qty: \${lineItem.qty}, Rate: Nu. \${lineItem.rate}, Discount Given: \${discStr}, Net Amount: Nu. \${lineItem.amount}\\n\`;
      }
    } else {
      ctx += \`  No recent sales found.\\n\`;
    }

    // Find latest purchases
    const itemPurchases = purchases
      .filter(p => p.items && p.items.some((pi: any) => pi.itemName === itemName))
      .sort((a, b) => new Date(b.date || b.billDate).getTime() - new Date(a.date || a.billDate).getTime())
      .slice(0, 3); // last 3 purchases

    if (itemPurchases.length > 0) {
      ctx += \`  Last 3 Purchases:\\n\`;
      for (const p of itemPurchases) {
        const lineItem = p.items.find((pi: any) => pi.itemName === itemName);
        const party = p.partyName || p.supplier || 'Unknown Supplier';
        const discStr = lineItem.discount ? (lineItem.discountType === 'percent' ? \`\${lineItem.discount}%\` : \`Nu. \${lineItem.discount}\`) : '0';
        ctx += \`    * Date: \${p.date || p.billDate}, Bill: \${p.billNumber || p.invoiceNo}, Supplier: \${party}, Qty: \${lineItem.qty}, Rate: Nu. \${lineItem.rate}, Discount: \${discStr}\\n\`;
      }
    } else {
      ctx += \`  No recent purchases found.\\n\`;
    }
  }

  return ctx;
}
`;

content = content.replace(
  "export async function processLocalQuery",
  newItemHistoryLogic + "\nexport async function processLocalQuery"
);

// We need to inject this into dataContext
content = content.replace(
  "if (itemMatches.length > 0) {\n        dataContext += '\\n\\nMatching Items:\\n' + itemMatches.map(it => \n           `[Item: ${it['Item Name']}, Code: ${it['Item Code']}, Sale Rate: ${it['Sale Rate']}, Purchase Rate: ${it['Purchase Rate']}, MRP: ${it['MRP']}, Stock: ${it['Current Stock']}]`\n        ).join('\\n');\n      }",
  "if (itemMatches.length > 0) {\n        dataContext += '\\n\\nMatching Items:\\n' + itemMatches.map(it => \n           `[Item: ${it['Item Name']}, Code: ${it['Item Code']}, Sale Rate: ${it['Sale Rate']}, Purchase Rate: ${it['Purchase Rate']}, MRP: ${it['MRP']}, Stock: ${it['Current Stock']}]`\n        ).join('\\n');\n      }\n      dataContext += getItemHistoryContext(searchWords, qLower);"
);

// We also need to add instructions to server.ts to handle NAVIGATION
fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService.ts');
