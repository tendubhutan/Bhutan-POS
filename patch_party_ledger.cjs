const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`  // Sync initial ledgers into fields
  useEffect(() => {
    if (ledgers.length > 0) {
      if (!partyLedger) setPartyLedger(ledgers[0]['Ledger Name']);
      if (!debitLedger) setDebitLedger(ledgers[0]['Ledger Name']);
      if (!creditLedger) setCreditLedger(ledgers[0]['Ledger Name']);
      if (!fromAccount) setFromAccount(ledgers[0]['Ledger Name']);
      if (!toAccount) setToAccount(ledgers[0]['Ledger Name']);

      // Pre-fill multi-line empty ledgers removed to keep fields blank
    }
  }, [ledgers]);`,
`  // Sync initial ledgers into fields
  useEffect(() => {
    // Intentionally left blank to avoid auto-filling ledgers
  }, [ledgers]);`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
