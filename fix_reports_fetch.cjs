const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

const badBlockRegex = /      \} else if \(mainCategory === 'gst_input_dom'\) \{\n      reportTitle = 'GST Input - Domestic Purchase & Expenses';[\s\S]*?\} else if \(mainCategory === 'inv'\) \{/m;

code = code.replace(badBlockRegex, `      } else if (mainCategory === 'inv') {`);

fs.writeFileSync('src/components/Reports.tsx', code);
