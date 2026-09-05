const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', 'utf8');

content = content.replace(
`  // Set default customer
  useEffect(() => {
    if (!customerName && ledgers.length > 0) {
      const debtor = ledgers.find(l => l.Group === 'Sundry Debtors')?.['Ledger Name'] || ledgers[0]['Ledger Name'];
      setCustomerName(debtor);
    }
  }, [ledgers]);`,
`  // Set default customer
  useEffect(() => {
    // Disabled auto-fill to keep ledger fields empty by default
  }, [ledgers]);`
);

fs.writeFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', content);
