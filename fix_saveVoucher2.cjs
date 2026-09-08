const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /const newV: Voucher = \{([\s\S]*?)billAllocations: v.billAllocations\n  \};/,
  `const newV: Voucher = {$1billAllocations: v.billAllocations,
    gstInputType: v.gstInputType,
    supplierName: v.supplierName,
    supplierGstNo: v.supplierGstNo,
    supplierCountry: v.supplierCountry,
    invoiceNo: v.invoiceNo,
    invoiceDate: v.invoiceDate,
    referenceNo: v.referenceNo,
    declarationNo: v.declarationNo,
    declarationDate: v.declarationDate,
    taxableAmount: v.taxableAmount,
    exemptedAmount: v.exemptedAmount,
    gstAmount: v.gstAmount,
    totalImportAmount: v.totalImportAmount
  };`
);

code = code.replace(
  /let dr = '', cr = '';\n  if \(t === 'P'\) \{ dr = v.ledger \|\| ''; cr = v.mode \|\| 'Cash'; \}/,
  `let dr = '', cr = '';\n  if (t === 'P') { dr = v.debitLedger || v.ledger || ''; cr = v.creditLedger || v.mode || 'Cash'; }`
);
code = code.replace(
  /else if \(t === 'R'\) \{ dr = v.mode \|\| 'Cash'; cr = v.ledger \|\| ''; \}/,
  `else if (t === 'R') { dr = v.debitLedger || v.mode || 'Cash'; cr = v.creditLedger || v.ledger || ''; }`
);

fs.writeFileSync('src/services/storageService.ts', code);
