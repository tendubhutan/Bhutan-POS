const fs = require('fs');
let code = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

code = code.replace(
  /billNo: allBillAllocations\.length > 0 \? allBillAllocations\.map\(b => b\.billNo\)\.join\(', '\) : undefined,\n\s*lines: formattedLines\n\s*\};/,
  `billNo: allBillAllocations.length > 0 ? allBillAllocations.map(b => b.billNo).join(', ') : undefined,
        lines: formattedLines,
        
        // GST Input Tracking Fields
        ...(activeVType === 'P' && config.EnableGSTInputTax === 'true' && gstInputType !== 'None' ? {
          gstInputType,
          supplierName,
          supplierGstNo,
          supplierCountry,
          invoiceNo,
          invoiceDate,
          referenceNo,
          declarationNo,
          declarationDate,
          taxableAmount: Number(taxableAmount) || undefined,
          exemptedAmount: Number(exemptedAmount) || undefined,
          gstAmount: Number(gstAmount) || undefined,
          totalImportAmount: Number(totalImportAmount) || undefined
        } : {})
      };`
);

fs.writeFileSync('src/components/Vouchers.tsx', code);
