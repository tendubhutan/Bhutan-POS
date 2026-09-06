const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { getInitialData, getVoucherTypes, saveLedger, getVoucherDetails, migrateExistingItemsOpeningAmount } from './services/storageService';",
  "import { getInitialData, getVoucherTypes, saveLedger, getVoucherDetails, migrateExistingItemsOpeningAmount, saveConfig } from './services/storageService';"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched App.tsx import correctly');
