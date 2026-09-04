const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

// Replace Single mode default
content = content.replace(
`  const [modeLedger, setModeLedger] = useState('Cash');`,
`  const [modeLedger, setModeLedger] = useState('');`
);

// Replace Multi mode grid default
content = content.replace(
`  const [lines, setLines] = useState<VoucherGridLine[]>([
    { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
    { id: '2', type: 'Cr', ledger: 'Cash', debit: 0, credit: '', narration: '' }
  ]);`,
`  const [lines, setLines] = useState<VoucherGridLine[]>([
    { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
    { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
  ]);`
);

// Remove the Sync initial ledgers into fields block
content = content.replace(
`  // Sync initial ledgers into fields
  useEffect(() => {
    if (ledgers.length > 0) {
      if (!partyLedger) setPartyLedger(ledgers[0]['Ledger Name']);
      if (!debitLedger) setDebitLedger(ledgers[0]['Ledger Name']);
      if (!creditLedger) setCreditLedger(ledgers[0]['Ledger Name']);
      if (!fromAccount) setFromAccount(ledgers[0]['Ledger Name']);
      if (!toAccount) setToAccount(ledgers[0]['Ledger Name']);

      // Pre-fill multi-line empty ledgers
      setLines(prev =>
        prev.map((l, idx) => {
          if (!l.ledger) {
            if (idx === 0) return { ...l, ledger: ledgers[0]['Ledger Name'] };
            if (idx === 1) {
              const cashOrBank = ledgers.find(lg => lg.Group === 'Cash-in-Hand' || lg.Group === 'Bank Accounts')?.['Ledger Name'] || 'Cash';
              return { ...l, ledger: cashOrBank };
            }
          }
          return l;
        })
      );
    }
  }, [ledgers]);`,
`  // Sync initial ledgers into fields
  useEffect(() => {
    // Disabled auto-fill to keep ledger fields empty by default
  }, [ledgers]);`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
