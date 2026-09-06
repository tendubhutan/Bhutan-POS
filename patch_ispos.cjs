const fs = require('fs');
const file = 'src/services/storageService.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  const invoice: SalesInvoice = {
    invoiceNo: iNo,
    date: invoiceDate,
    customer: { ...customer, ledger: sLg, isGSTExempted: isCustomerGstExempted },
    subtotal: rawTot,
    discount: appliedDiscount,
    discountType: billDiscountType,
    discountValue: billDiscountValue !== undefined ? billDiscountValue : appliedDiscount,
    taxable: tax,
    zeroRated: zro,
    gstAmt: gst,
    total: finalTot,
    cash,
    bank1: b1,
    bank2: b2,
    credit: cr,
    status: st,
    additionalExpenses,
    termsAndConditions: finalTerms || (cfg.FooterTerms || ''),
    voucherTypeId: matchedVt?.id || voucherTypeId,
    voucherTypeName: matchedVt?.name || voucherTypeName,
    config: cfg,
    narration: notes,
    bankTxnNo: payment.bankTxnNo || '',
    bank2TxnNo: payment.bank2TxnNo || '',
    isPOS: isPOS,
    items: itemsRows
  };
`;

content = content.replace(
  /const invoice: SalesInvoice = \{[\s\S]*?items: itemsRows\n  \};/,
  replacement.trim()
);

fs.writeFileSync(file, content, 'utf8');
