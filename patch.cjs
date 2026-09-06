const fs = require('fs');
const file = 'src/services/storageService.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = "const agg: Record<string, { name: string; qty: number; sAmt: number; cAmt: number; code: string }> = {};";
const repl1 = "const agg: Record<string, { name: string; qty: number; sAmt: number; cAmt: number; code: string; group: string; category: string }> = {};";

const target2 = "if (!agg[c]) agg[c] = { name: r['Item Name'], qty: 0, sAmt: 0, cAmt: 0, code: c };";
const repl2 = "const i = items.find(x => x['Item Code'] === c);\n      if (!agg[c]) agg[c] = { name: r['Item Name'], qty: 0, sAmt: 0, cAmt: 0, code: c, group: i?.Group || '', category: i?.Category || '' };";

const target3 = "const i = items.find(x => x['Item Code'] === c);\n      agg[c].cAmt += (q * (i ? (Number(i['Purchase Rate']) || 0) : 0));";
const repl3 = "agg[c].cAmt += (q * (i ? (Number(i['Purchase Rate']) || 0) : 0));";

const target4 = "profit: k.sAmt - k.cAmt\n  }));";
const repl4 = "profit: k.sAmt - k.cAmt,\n    group: k.group,\n    category: k.category\n  }));";

content = content.replace(target1, repl1);
content = content.replace(target2, repl2);
content = content.replace(target3, repl3);
content = content.replace(target4, repl4);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched');
