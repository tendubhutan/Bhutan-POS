const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /transactionType: v\.gstInputType,/g,
  `transactionType: effectiveType,`
);

fs.writeFileSync('src/services/storageService.ts', code);
