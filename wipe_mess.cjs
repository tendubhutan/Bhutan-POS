const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

const regex = /      \} else if \(mainCategory === 'gst_input_imp'\) \{\n        const data = getGSTInputImpReport\(fromDate, toDate\);\n        setReportData\(data\);\n([\s\S]*?)\} else if \(mainCategory === 'inv'\) \{/m;

const match = code.match(regex);
if (match) {
  code = code.replace(match[1], "      ");
  fs.writeFileSync('src/components/Reports.tsx', code);
  console.log("Success");
} else {
  console.log("No match");
}
