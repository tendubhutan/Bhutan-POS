const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "      fromDate || '',\n      toDate || '',",
  "      localFrom || '',\n      localTo || '',"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched dates for PDF');
