const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

const printCode = `    } else if (mainCategory === 'gst_input_dom') {
      reportTitle = 'GST Input - Domestic Purchase & Expenses';
      headers = ['Transaction Type', 'Supplier Name', 'Supplier GST No', 'Invoice Date', 'Invoice No', 'Taxable Value', 'Exempted Value', 'GST Amount'];
      (reportData.rows || []).forEach((r: any) => {
        rows.push([r.transactionType, r.supplierName, r.supplierGstNo, formatDateStr(r.invoiceDate), r.invoiceNo, fmt(r.taxable), fmt(r.exempted), fmt(r.gstAmount)]);
      });
      if (reportData.totals) {
        totalsRow = ['TOTAL', '', '', '', '', fmt(reportData.totals.taxable), fmt(reportData.totals.exempted), fmt(reportData.totals.gstAmount)];
        summaryCards = [
          { label: 'Taxable Amount', value: \`Nu. \${fmt(reportData.totals.taxable)}\` },
          { label: 'GST Claimable', value: \`Nu. \${fmt(reportData.totals.gstAmount)}\` }
        ];
      }
    } else if (mainCategory === 'gst_input_imp') {
      reportTitle = 'GST Input - Import Purchase';
      headers = ['Supplier Country', 'Declaration Date', 'Declaration Number', 'Total Import Amount', 'GST Amount Paid'];
      (reportData.rows || []).forEach((r: any) => {
        rows.push([r.supplierCountry, formatDateStr(r.declarationDate), r.declarationNo, fmt(r.totalImportAmount), fmt(r.gstAmount)]);
      });
      if (reportData.totals) {
        totalsRow = ['TOTAL', '', '', fmt(reportData.totals.totalImportAmount), fmt(reportData.totals.gstAmount)];
        summaryCards = [
          { label: 'Total Import Amount', value: \`Nu. \${fmt(reportData.totals.totalImportAmount)}\` },
          { label: 'GST Claimable', value: \`Nu. \${fmt(reportData.totals.gstAmount)}\` }
        ];
      }
`;

code = code.replace(
  /    \} else if \(mainCategory === 'inv'\) \{/,
  printCode + '    } else if (mainCategory === \'inv\') {'
);

fs.writeFileSync('src/components/Reports.tsx', code);
