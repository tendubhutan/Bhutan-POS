const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

const newFunctions = `

export function getGSTInputDomReport(from: string, to: string) {
  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  
  const purchases = getDeduplicatedPurchases();
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  
  const results: any[] = [];
  
  // 1. Domestic Purchases from Purchase Vouchers
  purchases.forEach(p => {
    const d = new Date(p.date).getTime();
    if (d >= fr && d <= toDt && p.status !== 'Cancelled') {
      results.push({
        transactionType: 'Local Purchase',
        supplierName: typeof p.supplier === 'object' ? p.supplier.name : String(p.supplier || ''),
        supplierGstNo: typeof p.supplier === 'object' ? (p.supplier.gstNo || '') : '',
        invoiceDate: p.date,
        invoiceNo: p.invoiceNo,
        referenceNo: '',
        taxable: Number(p.taxable) || 0,
        exempted: Number(p.zeroRated) || 0,
        gstAmount: Number(p.gstAmt) || 0
      });
    }
  });

  // 2. Local Expenses & Bank Charges from Payment Vouchers
  vouchers.forEach(v => {
    const d = new Date(v.date).getTime();
    if (v.type === 'P' && d >= fr && d <= toDt && v.status !== 'Cancelled') {
      if (v.gstInputType === 'Local Expenses' || v.gstInputType === 'Bank Charges' || v.gstInputType === 'Local Purchase') {
        results.push({
          transactionType: v.gstInputType,
          supplierName: v.supplierName || '',
          supplierGstNo: v.supplierGstNo || '',
          invoiceDate: v.invoiceDate || '',
          invoiceNo: v.invoiceNo || '',
          referenceNo: v.referenceNo || '',
          taxable: Number(v.taxableAmount) || 0,
          exempted: Number(v.exemptedAmount) || 0,
          gstAmount: Number(v.gstAmount) || 0
        });
      }
    }
  });

  // Sort by invoiceDate or transactionType
  results.sort((a, b) => new Date(a.invoiceDate || 0).getTime() - new Date(b.invoiceDate || 0).getTime());

  const totals = results.reduce((a, r) => {
    a.taxable += r.taxable;
    a.exempted += r.exempted;
    a.gstAmount += r.gstAmount;
    return a;
  }, { taxable: 0, exempted: 0, gstAmount: 0 });

  return { mode: 'gst_input_dom', rows: results, totals };
}

export function getGSTInputImpReport(from: string, to: string) {
  const fr = new Date(from).setHours(0, 0, 0, 0);
  const toDt = new Date(to).setHours(23, 59, 59, 999);
  
  const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
  const results: any[] = [];
  
  // Import Customs GST Payment from Payment Vouchers
  vouchers.forEach(v => {
    const d = new Date(v.date).getTime();
    if (v.type === 'P' && d >= fr && d <= toDt && v.status !== 'Cancelled') {
      if (v.gstInputType === 'Import Customs GST Payment') {
        results.push({
          supplierCountry: v.supplierCountry || '',
          declarationDate: v.declarationDate || '',
          declarationNo: v.declarationNo || '',
          totalImportAmount: Number(v.totalImportAmount) || 0,
          gstAmount: Number(v.gstAmount) || 0
        });
      }
    }
  });

  results.sort((a, b) => new Date(a.declarationDate || 0).getTime() - new Date(b.declarationDate || 0).getTime());

  const totals = results.reduce((a, r) => {
    a.totalImportAmount += r.totalImportAmount;
    a.gstAmount += r.gstAmount;
    return a;
  }, { totalImportAmount: 0, gstAmount: 0 });

  return { mode: 'gst_input_imp', rows: results, totals };
}
`;

code += newFunctions;
fs.writeFileSync('src/services/storageService.ts', code);
