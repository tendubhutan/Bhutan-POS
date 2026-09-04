const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`    const newIndex = lines.length;
    setLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: nextType,
        ledger: defaultLedger,
        debit: defaultDebit,
        credit: defaultCredit,
        narration: ''
      }
    ]);`,
`    const newIndex = lines.length;
    setLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        type: nextType,
        ledger: '',
        debit: defaultDebit,
        credit: defaultCredit,
        narration: ''
      }
    ]);`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
