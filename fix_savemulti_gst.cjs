const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /billAllocations\?: BillAllocation\[\];\n\s*lines: Array<\{/g,
  `billAllocations?: BillAllocation[];
  gstInputType?: 'Local Purchase' | 'Local Expenses' | 'Bank Charges' | 'Import Customs GST Payment' | 'Import Purchase' | 'None';
  supplierName?: string;
  supplierGstNo?: string;
  supplierCountry?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  referenceNo?: string;
  declarationNo?: string;
  declarationDate?: string;
  taxableAmount?: number;
  exemptedAmount?: number;
  gstAmount?: number;
  totalImportAmount?: number;
  lines: Array<{`
);

code = code.replace(
  /voucherNo: no,\n\s*date: dateIso,\n\s*type: payload.type,/g,
  `voucherNo: no,
    date: dateIso,
    type: payload.type,
    gstInputType: payload.gstInputType,
    supplierName: payload.supplierName,
    supplierGstNo: payload.supplierGstNo,
    supplierCountry: payload.supplierCountry,
    invoiceNo: payload.invoiceNo,
    invoiceDate: payload.invoiceDate,
    referenceNo: payload.referenceNo,
    declarationNo: payload.declarationNo,
    declarationDate: payload.declarationDate,
    taxableAmount: payload.taxableAmount,
    exemptedAmount: payload.exemptedAmount,
    gstAmount: payload.gstAmount,
    totalImportAmount: payload.totalImportAmount,`
);

fs.writeFileSync('src/services/storageService.ts', code);
