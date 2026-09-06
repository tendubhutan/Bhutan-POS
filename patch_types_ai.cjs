const fs = require('fs');
const file = 'src/types.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "  EnableBillWiseDetails?: string; // \"true\" | \"false\"\n}",
  "  EnableBillWiseDetails?: string; // \"true\" | \"false\"\n  EnableAdvancedAI?: string; // \"true\" | \"false\"\n}"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched types.ts');
