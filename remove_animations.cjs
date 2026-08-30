const fs = require('fs');
let code = fs.readFileSync('src/components/SearchableItemSelect.tsx', 'utf8');

code = code.replace(
  /animate-in fade-in zoom-in-95 duration-100 \$\{coords\.placement === 'bottom' \? 'origin-top' : 'origin-bottom'\}/g,
  ''
);

fs.writeFileSync('src/components/SearchableItemSelect.tsx', code);
console.log('Removed animation classes');
