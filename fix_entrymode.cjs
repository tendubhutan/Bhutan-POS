const fs = require('fs');
let code = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

code = code.replace(
  /if \(entryMode === 'double'\) \{/g,
  `if (entryMode === 'multi') {`
);

fs.writeFileSync('src/components/Vouchers.tsx', code);
