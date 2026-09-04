const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`  const handleCancelOrResetEntry = () => {
    if (entryMode === 'multi') {
      const cashOrBank = ledgers.find(l => l.Group === 'Cash-in-Hand' || l.Group === 'Bank Accounts')?.['Ledger Name'] || 'Cash';
      const defaultParty = ledgers[0]?.['Ledger Name'] || '';
      setLines([
        { id: '1', type: 'Dr', ledger: defaultParty, debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: cashOrBank, debit: 0, credit: '', narration: '' }
      ]);
    } else {
      setAmount('');
      if (ledgers.length > 0) {
        setPartyLedger(ledgers[0]['Ledger Name']);
        setModeLedger('Cash');
        setDebitLedger(ledgers[0]['Ledger Name']);
        setCreditLedger('Cash');
        setFromAccount(ledgers[0]['Ledger Name']);
        setToAccount('Cash');
      }
    }`,
`  const handleCancelOrResetEntry = () => {
    if (entryMode === 'multi') {
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else {
      setAmount('');
      setPartyLedger('');
      setModeLedger('');
      setDebitLedger('');
      setCreditLedger('');
      setFromAccount('');
      setToAccount('');
    }`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
