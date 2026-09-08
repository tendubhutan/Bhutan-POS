const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /  adjustLedgerBalance\(dr, Number\(v.amount\), 'Dr', no, narrWithTxn, t, txnId\);\n  adjustLedgerBalance\(cr, Number\(v.amount\), 'Cr', no, narrWithTxn, t, txnId\);/,
  `  if (t === 'P' && v.gstAmount && v.gstAmount > 0) {
    const expenseAmt = Number(v.amount) - Number(v.gstAmount);
    if (expenseAmt > 0) {
      adjustLedgerBalance(dr, expenseAmt, 'Dr', no, narrWithTxn, t, txnId);
    }
    adjustLedgerBalance('Duties & Taxes', Number(v.gstAmount), 'Dr', no, narrWithTxn + ' (GST Input)', t, txnId);
    adjustLedgerBalance(cr, Number(v.amount), 'Cr', no, narrWithTxn, t, txnId);
  } else {
    adjustLedgerBalance(dr, Number(v.amount), 'Dr', no, narrWithTxn, t, txnId);
    adjustLedgerBalance(cr, Number(v.amount), 'Cr', no, narrWithTxn, t, txnId);
  }`
);

fs.writeFileSync('src/services/storageService.ts', code);
