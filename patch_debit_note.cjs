const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/DebitNoteEntry.tsx', 'utf8');

content = content.replace(
`  // Set default supplier
  useEffect(() => {
    if (!supplierLedger && ledgers.length > 0) {
      const creditor = ledgers.find(l => l.Group === 'Sundry Creditors')?.['Ledger Name'] || ledgers[0]['Ledger Name'];
      setSupplierLedger(creditor);
    }
    if (ledgers.some(l => l['Ledger Name'] === 'Purchase Return')) {
      setPurchaseReturnLedger('Purchase Return');
    }
  }, [ledgers]);`,
`  // Set default supplier
  useEffect(() => {
    if (ledgers.some(l => l['Ledger Name'] === 'Purchase Return')) {
      setPurchaseReturnLedger('Purchase Return');
    }
  }, [ledgers]);`
);

fs.writeFileSync('src/components/vouchers/DebitNoteEntry.tsx', content);
