const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /\.\.\.\(showGst \? \[\{ cat: 'gst', label: 'GST Summary Report' \}\] : \[\]\)/,
  `...(showGst ? [
      { cat: 'gst', label: 'GST Output (Sales)' },
      ...(config.EnableGSTInputTax === 'true' ? [
        { cat: 'gst_input_dom', label: 'GST Input (Domestic Purchase & Expenses)' },
        { cat: 'gst_input_imp', label: 'GST Input (Import Purchase)' }
      ] : [])
    ] : [])`
);

code = code.replace(
  /mainCategory === 'gst' \|\| mainCategory === 'inv' \|\| mainCategory === 'fin'/,
  `(mainCategory === 'gst' || mainCategory === 'gst_input_dom' || mainCategory === 'gst_input_imp' || mainCategory === 'inv' || mainCategory === 'fin')`
);

fs.writeFileSync('src/components/Reports.tsx', code);
