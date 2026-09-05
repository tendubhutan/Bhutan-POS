const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

// clean up itemName
content = content.replace(/it\.itemName \|\| it\['Item Name'\] \|\| it\.itemDescription \|\| it\['Item Description'\] \|\| '' \|\| it\['Item Name'\] \|\| it\.itemDescription \|\| it\['Item Description'\] \|\| ''/g, "it.itemName || it['Item Name'] || ''");

// fix amount -> lineTotal
content = content.replace(/it\.amount \?\? it\['Line Total'\] \?\? 0/g, "it.amount ?? it['Line Total'] ?? it.lineTotal ?? 0");

// Also there was one `Amount` where my replacement might not have applied because it didn't match the exact string:
content = content.replace(/getValue: \(it:any\) => Number\(it\.amount\)\.toFixed\(2\)/g, "getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.lineTotal ?? 0).toFixed(2)");
content = content.replace(/getValue: \(it:any\) => it\.itemName/g, "getValue: (it:any) => it.itemName || it['Item Name'] || ''");

fs.writeFileSync('src/utils/pdfExport.ts', content);
