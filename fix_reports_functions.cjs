const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /getDailyColumnarReport, getGSTReport, getAdvancedReports, getFinancialReports, getFullLedgerStatement, saveConfig,/,
  `getDailyColumnarReport, getGSTReport, getGSTInputDomReport, getGSTInputImpReport, getAdvancedReports, getFinancialReports, getFullLedgerStatement, saveConfig,`
);

const fetchLogic = `      } else if (mainCategory === 'gst') {
        const data = getGSTReport(fromDate, toDate);
        setReportData(data);
      } else if (mainCategory === 'gst_input_dom') {
        const data = getGSTInputDomReport(fromDate, toDate);
        setReportData(data);
      } else if (mainCategory === 'gst_input_imp') {
        const data = getGSTInputImpReport(fromDate, toDate);
        setReportData(data);
`;

code = code.replace(
  /      \} else if \(mainCategory === 'gst'\) \{\n        const data = getGSTReport\(fromDate, toDate\);\n        setReportData\(data\);\n/,
  fetchLogic
);

fs.writeFileSync('src/components/Reports.tsx', code);
