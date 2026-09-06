const fs = require('fs');
const file = 'src/services/storageService.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /const agg: Record<string, \{ name: string; qty: number; sAmt: number; cAmt: number; code: string \}> = \{\};\n  inPeriodInvs\.forEach\(inv => \{\n    inv\.items\.forEach\(r => \{\n      const c = r\['Item Code'\];\n      if \(!agg\[c\]\) agg\[c\] = \{ name: r\['Item Name'\], qty: 0, sAmt: 0, cAmt: 0, code: c \};\n      const q = Number\(r\.Qty\) \|\| 0;\n      const lTot = \(q \* \(Number\(r\.Rate\) \|\| 0\)\) - \(Number\(r\.Discount\) \|\| 0\);\n      agg\[c\]\.qty \+= q;\n      agg\[c\]\.sAmt \+= lTot;\n      const i = items\.find\(x => x\['Item Code'\] === c\);\n      agg\[c\]\.cAmt \+= \(q \* \(i \? \(Number\(i\['Purchase Rate'\]\) \|\| 0\) : 0\)\);\n    \}\);\n  \}\);\n\n  const pList = Object\.values\(agg\)\.map\(k => \(\{\n    name: k\.name,\n    code: k\.code,\n    qty: k\.qty,\n    saleAmt: k\.sAmt,\n    costAmt: k\.cAmt,\n    profit: k\.sAmt - k\.cAmt\n  \}\)\);/,
  `const agg: Record<string, { name: string; qty: number; sAmt: number; cAmt: number; code: string; group: string; category: string }> = {};
  inPeriodInvs.forEach(inv => {
    inv.items.forEach(r => {
      const c = r['Item Code'];
      const i = items.find(x => x['Item Code'] === c);
      if (!agg[c]) agg[c] = { name: r['Item Name'], qty: 0, sAmt: 0, cAmt: 0, code: c, group: i?.Group || '', category: i?.Category || '' };
      const q = Number(r.Qty) || 0;
      const lTot = (q * (Number(r.Rate) || 0)) - (Number(r.Discount) || 0);
      agg[c].qty += q;
      agg[c].sAmt += lTot;
      agg[c].cAmt += (q * (i ? (Number(i['Purchase Rate']) || 0) : 0));
    });
  });

  const pList = Object.values(agg).map(k => ({
    name: k.name,
    code: k.code,
    qty: k.qty,
    saleAmt: k.sAmt,
    costAmt: k.cAmt,
    profit: k.sAmt - k.cAmt,
    group: k.group,
    category: k.category
  }));`
);
fs.writeFileSync(file, content, 'utf8');
