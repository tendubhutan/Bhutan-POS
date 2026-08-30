const fs = require('fs');

// 1. Update storageService.ts saveSalesInvoice
let storage = fs.readFileSync('src/services/storageService.ts', 'utf8');

// Ensure expensesTotal is calculated and added to rawTot & adjustLedgerBalance called for expenses
const oldStorageTarget = `  tax = round2(tax); zro = round2(zro); gst = round2(gst); rawTot = round2(rawTot);`;
const newStorageReplacement = `  let expensesTotal = 0;
  additionalExpenses.forEach(exp => {
    expensesTotal += Number(exp.amount) || 0;
  });
  rawTot += expensesTotal;
  tax = round2(tax); zro = round2(zro); gst = round2(gst); rawTot = round2(rawTot);`;

if (storage.includes(oldStorageTarget)) {
  storage = storage.replace(oldStorageTarget, newStorageReplacement);
}

// Add ledger adjustment for sales additionalExpenses if not already present
const ledgerAdjustTarget = `  if (cash > 0) adjustLedgerBalance('Cash', cash, 'Dr', iNo, 'Cash sale ' + iNo, 'Sale');`;
const ledgerAdjustReplacement = `  additionalExpenses.forEach(exp => {
    if (exp.ledger && Number(exp.amount) > 0) {
      adjustLedgerBalance(exp.ledger, Number(exp.amount), 'Cr', iNo, 'Sales Expense ' + iNo, 'Sale');
    }
  });
  if (cash > 0) adjustLedgerBalance('Cash', cash, 'Dr', iNo, 'Cash sale ' + iNo, 'Sale');`;

if (storage.includes(ledgerAdjustTarget) && !storage.includes("'Sales Expense ' + iNo")) {
  storage = storage.replace(ledgerAdjustTarget, ledgerAdjustReplacement);
}

fs.writeFileSync('src/services/storageService.ts', storage);
console.log('Updated storageService.ts');
