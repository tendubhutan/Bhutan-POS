const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/CreditNoteEntry.tsx', 'utf8');

content = content.replace(
`  // Set default customer
  useEffect(() => {
    if (!partyLedger && ledgers.length > 0) {
      const debtor = ledgers.find(l => l.Group === 'Sundry Debtors')?.['Ledger Name'] || ledgers[0]['Ledger Name'];
      setPartyLedger(debtor);
    }
    if (ledgers.some(l => l['Ledger Name'] === 'Sales Return')) {
      setSalesReturnLedger('Sales Return');
    }
  }, [ledgers]);`,
`  // Set default customer
  useEffect(() => {
    if (ledgers.some(l => l['Ledger Name'] === 'Sales Return')) {
      setSalesReturnLedger('Sales Return');
    }
  }, [ledgers]);`
);

fs.writeFileSync('src/components/vouchers/CreditNoteEntry.tsx', content);
