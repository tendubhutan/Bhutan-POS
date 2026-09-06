const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const newFallback = `
  // Normal Local Regex Search Mode
  // Simulate slight thinking delay for UI polish
  await new Promise(r => setTimeout(r, 600));

  const itemsFallback = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  const qLowerFallback = query.toLowerCase();
  const numbersInQueryFallback = query.match(/\\d+(\\.\\d+)?/g) || [];
  
  const itemMatchesFallback = itemsFallback.filter(it => 
    it['Item Name'].toLowerCase().includes(qLowerFallback) || 
    it['Item Code'].toLowerCase().includes(qLowerFallback) ||
    it['Barcode'].toLowerCase().includes(qLowerFallback) ||
    (it.Category && it.Category.toLowerCase().includes(qLowerFallback)) ||
    numbersInQueryFallback.includes(it['Sale Rate'].toString()) ||
    numbersInQueryFallback.includes(it['Purchase Rate'].toString()) ||
    numbersInQueryFallback.includes(it['MRP'].toString())
  ).slice(0, 6);

  const entryMatches = searchAllEntries(query);
  if (entryMatches.length > 0 || itemMatchesFallback.length > 0) {
    let msg = \`🔍 **Found \${entryMatches.length + itemMatchesFallback.length} matching record\${(entryMatches.length + itemMatchesFallback.length) > 1 ? 's' : ''} for "\${query}"**:\\n\\n\`;
    
    if (itemMatchesFallback.length > 0) {
      msg += \`**Items:**\\n\`;
      itemMatchesFallback.forEach(it => {
        msg += \`• **\${it['Item Name']}** (Code: \${it['Item Code']})\\n  Sale Rate: Nu. \${it['Sale Rate']} | MRP: Nu. \${it['MRP']} | Stock: \${it['Current Stock']}\\n\\n\`;
      });
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
`;

content = content.replace(
  /\/\/ Normal Local Regex Search Mode[\s\S]*?return msg;\n  }/,
  newFallback.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched local fallback for items');
