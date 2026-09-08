const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /v\.type === 'P' && d >= fr && d <= toDt && v\.status !== 'Cancelled'/g,
  `(v.type === 'P' || v.type === 'J') && d >= fr && d <= toDt && v.status !== 'Cancelled'`
);

code = code.replace(
  /if \(v\.gstInputType === 'Local Expenses' \|\| v\.gstInputType === 'Bank Charges' \|\| v\.gstInputType === 'Local Purchase'\) \{/g,
  `
      // Auto-infer if gstInputType is not set but GST is present in lines
      let effectiveType = v.gstInputType;
      let inferredGstAmt = 0;
      let inferredTaxable = 0;
      
      if (!effectiveType || effectiveType === 'None') {
        const hasGst = (v.lines || []).some(l => l.type === 'Dr' && (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax')));
        if (hasGst || (v.gstAmount && v.gstAmount > 0)) {
          effectiveType = 'Local Expenses';
          if ((v.lines || []).some(l => l.ledger.toLowerCase().includes('bank charge'))) {
            effectiveType = 'Bank Charges';
          }
          if (v.lines) {
            inferredGstAmt = v.lines.filter(l => l.type === 'Dr' && (l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
            inferredTaxable = v.lines.filter(l => l.type === 'Dr' && !(l.ledger.toLowerCase().includes('gst') || l.ledger.toLowerCase().includes('tax'))).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
          } else if (v.amount && v.gstAmount) {
            inferredGstAmt = Number(v.gstAmount);
            inferredTaxable = Number(v.taxableAmount) || (Number(v.amount) - inferredGstAmt);
          }
        }
      }

      if (effectiveType === 'Local Expenses' || effectiveType === 'Bank Charges' || effectiveType === 'Local Purchase') {
        const finalTaxable = v.taxableAmount ? Number(v.taxableAmount) : inferredTaxable;
        const finalGst = v.gstAmount ? Number(v.gstAmount) : inferredGstAmt;
        if (finalGst > 0 || finalTaxable > 0) {`
);

code = code.replace(
  /taxable: Number\(v\.taxableAmount\) \|\| 0,\n\s*exempted: Number\(v\.exemptedAmount\) \|\| 0,\n\s*gstAmount: Number\(v\.gstAmount\) \|\| 0/g,
  `taxable: finalTaxable || 0,
          exempted: Number(v.exemptedAmount) || 0,
          gstAmount: finalGst || 0`
);

// We need to make sure the replacement didn't mess up brackets
fs.writeFileSync('src/services/storageService.ts', code);
