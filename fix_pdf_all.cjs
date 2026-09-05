const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

content = content.replace(/getValue: \(it:any\) => it\.itemName/g, "getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || ''");
content = content.replace(/getValue: \(it:any\) => `\$\{it\.qty\} \$\{it\.unit \|\| ''\}`/g, "getValue: (it:any) => `${it.qty ?? it.Qty ?? it.systemQty ?? ''} ${it.unit || it.Unit || ''}`.trim()");
content = content.replace(/getValue: \(it:any\) => Number\(it\.rate\)\.toFixed\(2\)/g, "getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2)");
content = content.replace(/getValue: \(it:any\) => Number\(it\.amount\)\.toFixed\(2\)/g, "getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.taxableValue ?? 0).toFixed(2)");
content = content.replace(/getValue: \(it:any\) => it\.qty/g, "getValue: (it:any) => it.qty ?? it.Qty ?? ''");

fs.writeFileSync('src/utils/pdfExport.ts', content);
