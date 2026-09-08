const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /r\.invoiceNo, fmt\(r\.taxable\)/g,
  `r.invoiceNo || r.referenceNo, fmt(r.taxable)`
);

fs.writeFileSync('src/components/Reports.tsx', code);
