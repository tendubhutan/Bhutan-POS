const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/PhysicalStockEntry.tsx', 'utf8');

content = content.replace(
  '<SearchableItemSelect\n                    valueCode={quickSearchCode}',
  '<SearchableItemSelect\n                    id="ps-fast-item-picker"\n                    valueCode={quickSearchCode}'
);

content = content.replace(
  'onEndOfList={(id) => id && focusNextOutsideGrid(id)}',
  `onEndOfList={() => document.getElementById('ps-save-btn')?.focus()}`
);

fs.writeFileSync('src/components/vouchers/PhysicalStockEntry.tsx', content);
