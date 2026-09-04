const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`    if (type === 'P') { // Payment
      setLines([
        { id: '1', type: 'Dr', ledger: expenseOrParty, debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: cashOrBank, debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'R') { // Receipt
      setLines([
        { id: '1', type: 'Cr', ledger: incomeOrParty, debit: 0, credit: '', narration: '' },
        { id: '2', type: 'Dr', ledger: cashOrBank, debit: '', credit: 0, narration: '' }
      ]);
    } else if (type === 'J') { // Journal
      setLines([
        { id: '1', type: 'Dr', ledger: expenseOrParty, debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: incomeOrParty, debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'C') { // Contra
      const bankLedger = ledgers.find(l => l.Group === 'Bank Accounts')?.['Ledger Name'] || 'BOB Account';
      setLines([
        { id: '1', type: 'Dr', ledger: bankLedger, debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: 'Cash', debit: 0, credit: '', narration: '' }
      ]);
    }`,
`    if (type === 'P') { // Payment
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'R') { // Receipt
      setLines([
        { id: '1', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' },
        { id: '2', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' }
      ]);
    } else if (type === 'J') { // Journal
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    } else if (type === 'C') { // Contra
      setLines([
        { id: '1', type: 'Dr', ledger: '', debit: '', credit: 0, narration: '' },
        { id: '2', type: 'Cr', ledger: '', debit: 0, credit: '', narration: '' }
      ]);
    }`
);

// We should also look for the `Pre-fill multi-line empty ledgers` which I apparently failed to match properly last time.
content = content.replace(
`      // Pre-fill multi-line empty ledgers
      setLines(prev =>
        prev.map((l, idx) => {
          if (!l.ledger) {
            if (idx === 0) return { ...l, ledger: ledgers[0]['Ledger Name'] };
            if (idx === 1) return { ...l, ledger: 'Cash' };
          }
          return l;
        })
      );`,
`      // Pre-fill multi-line empty ledgers removed to keep fields blank`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
