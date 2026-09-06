const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const data = getItemStockLedger(active.targetId);",
  "const data = getItemStockLedger(active.targetId, localFrom, localTo);"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched DrillModal stock ledger dates');
