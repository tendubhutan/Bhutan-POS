const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /mainCategory === 'gst' \? 'gst' :/g,
  `mainCategory === 'gst' ? 'gst' : mainCategory === 'gst_input_dom' ? 'gst_input_dom' : mainCategory === 'gst_input_imp' ? 'gst_input_imp' :`
);

code = code.replace(
  /\} else if \(val === 'gst'\) \{\n\s*setMainCategory\('gst'\);\n\s*\}/,
  `} else if (val === 'gst' || val === 'gst_input_dom' || val === 'gst_input_imp') {
                  setMainCategory(val as any);
                }`
);

fs.writeFileSync('src/components/Reports.tsx', code);
