const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /const \[mainCategory, setMainCategory\] = useState<'daily' \| 'gst' \| 'inv' \| 'fin' \| 'reg' \| 'audit'>\('daily'\);/,
  `const [mainCategory, setMainCategory] = useState<'daily' | 'gst' | 'gst_input_dom' | 'gst_input_imp' | 'inv' | 'fin' | 'reg' | 'audit'>('daily');`
);

fs.writeFileSync('src/components/Reports.tsx', code);
