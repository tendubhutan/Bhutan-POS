const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "            {(active.type === 'item-profit' || active.type === 'ledger' || active.type === 'group') && (",
  "            {(active.type === 'item-profit' || active.type === 'ledger' || active.type === 'group' || active.type === 'stock') && ("
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched DrillModal.tsx localFrom type check');
