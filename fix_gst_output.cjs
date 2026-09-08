const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /if \(gst > 0\) adjustLedgerBalance\('GST Payable', gst, 'Cr', iNo, 'GST ' \+ iNo, 'Sale'\);/g,
  `if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gst, 'Cr', iNo, 'GST ' + iNo, 'Sale');`
);

fs.writeFileSync('src/services/storageService.ts', code);
