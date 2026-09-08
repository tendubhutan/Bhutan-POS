const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /ledger: 'Duties & Taxes', amount: gstAmt, narration: 'GST Output Reversal'/g,
  `ledger: cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', amount: gstAmt, narration: 'GST Output Reversal'`
);

code = code.replace(
  /adjustLedgerBalance\('Duties & Taxes', gstAmt, 'Dr', no, 'GST Reversal ' \+ no, 'CN'\);/g,
  `adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Output' : 'GST Payable', gstAmt, 'Dr', no, 'GST Reversal ' + no, 'CN');`
);

code = code.replace(
  /ledger: 'Duties & Taxes', amount: gstAmt, narration: 'GST Input Reversal'/g,
  `ledger: cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'Duties & Taxes', amount: gstAmt, narration: 'GST Input Reversal'`
);

code = code.replace(
  /adjustLedgerBalance\('Duties & Taxes', gstAmt, 'Cr', no, 'GST Input Reversal ' \+ no, 'DN'\);/g,
  `adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'Duties & Taxes', gstAmt, 'Cr', no, 'GST Input Reversal ' + no, 'DN');`
);

fs.writeFileSync('src/services/storageService.ts', code);
