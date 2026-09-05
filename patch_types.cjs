const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('CompanyLogo?: string;')) {
  content = content.replace(
    /BarcodePrefix: string;/,
    'BarcodePrefix: string;\n  CompanyLogo?: string;'
  );
  fs.writeFileSync('src/types.ts', content);
}
