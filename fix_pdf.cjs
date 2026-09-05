const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

// Fix the map index
content = content.replace(/body: items\.map\(item => columns\.map\(c => c\.getValue\(item\)\)\),/g, "body: items.map((item, index) => columns.map(c => c.getValue(item, index))),");

// Fix generateInvoicePDF getValue
content = content.replace(/\{ header: 'Item Description', align: 'left', getValue: \(it:any\) => it\.itemName \},/, "{ header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || '' },");
content = content.replace(/\{ header: 'Qty', align: 'center', width: 18, getValue: \(it:any\) => `\$\{it\.qty\} \$\{it\.unit \|\| ''\}` \},/, "{ header: 'Qty', align: 'center', width: 18, getValue: (it:any) => `${it.qty ?? it.Qty ?? ''} ${it.unit || it.Unit || ''}`.trim() },");
content = content.replace(/\{ header: 'Rate', align: 'right', width: 22, getValue: \(it:any\) => Number\(it\.rate\)\.toFixed\(2\) \},/, "{ header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2) },");
content = content.replace(/\{ header: 'Tax %', align: 'right', width: 15, getValue: \(it:any\) => it\.taxRate \? `\$\{it\.taxRate\}%` : '-' \},/, "{ header: 'Tax %', align: 'right', width: 15, getValue: (it:any) => (it.taxRate ?? it['GST %']) ? `${it.taxRate ?? it['GST %']}%` : '-' },");
content = content.replace(/\{ header: 'Amount', align: 'right', width: 28, getValue: \(it:any\) => Number\(it\.amount\)\.toFixed\(2\) \}/, "{ header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? 0).toFixed(2) }");

// Fix generatePurchaseBillPDF getValue
content = content.replace(/\{ header: 'Item Description', align: 'left', getValue: \(it:any\) => it\.itemName \},/, "{ header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || '' },");
content = content.replace(/\{ header: 'Qty', align: 'center', width: 18, getValue: \(it:any\) => `\$\{it\.qty\} \$\{it\.unit \|\| ''\}` \},/, "{ header: 'Qty', align: 'center', width: 18, getValue: (it:any) => `${it.qty ?? it.Qty ?? ''} ${it.unit || it.Unit || ''}`.trim() },");
content = content.replace(/\{ header: 'Rate', align: 'right', width: 22, getValue: \(it:any\) => Number\(it\.rate\)\.toFixed\(2\) \},/, "{ header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2) },");
content = content.replace(/\{ header: 'Amount', align: 'right', width: 28, getValue: \(it:any\) => Number\(it\.amount\)\.toFixed\(2\) \}/, "{ header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? 0).toFixed(2) }");

fs.writeFileSync('src/utils/pdfExport.ts', content);
