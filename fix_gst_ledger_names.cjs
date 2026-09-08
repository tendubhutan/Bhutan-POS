const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

// In savePurchaseInvoice (around line 6380)
code = code.replace(
  /if \(gst > 0\) adjustLedgerBalance\('Duties & Taxes', gst, 'Dr', bNo, 'GST ' \+ bNo, 'Purchase'\);/g,
  `if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'GST Payable', gst, 'Dr', bNo, 'GST ' + bNo, 'Purchase');`
);

// In savePurchaseInvoice editing block (around line 2798)
code = code.replace(
  /if \(gst > 0\) adjustLedgerBalance\('Duties & Taxes', gst, 'Dr', bNo, 'GST ' \+ bNo, 'Purchase'\);/g,
  `if (gst > 0) adjustLedgerBalance(cfg.EnableGSTInputTax === 'true' ? 'GST Input' : 'GST Payable', gst, 'Dr', bNo, 'GST ' + bNo, 'Purchase');`
);

// In saveVoucher (around line 3280)
code = code.replace(
  /adjustLedgerBalance\('Duties & Taxes', Number\(v\.gstAmount\), 'Dr', no, narrWithTxn \+ ' \(GST Input\)', t, txnId\);/g,
  `adjustLedgerBalance('GST Input', Number(v.gstAmount), 'Dr', no, narrWithTxn + ' (GST Input)', t, txnId);`
);

fs.writeFileSync('src/services/storageService.ts', code);
