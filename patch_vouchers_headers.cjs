const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

function replaceHeader(content, functionName, replaceRegex, replacement) {
  return content.replace(replaceRegex, replacement);
}

// 1. generateInvoicePDF
content = content.replace(
  /\/\/ --- Header ---[\s\S]*?\/\/ --- Bill To Section ---/,
  `// --- Header ---
  const dividerY = drawVoucherHeader(doc, config, 'TAX INVOICE', [
    { label: 'Invoice No', value: invoice.invoiceNo },
    { label: 'Date', value: new Date(invoice.date).toLocaleDateString() },
    { label: 'Time', value: new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);

  // --- Bill To Section ---`
);

// 2. generateDeliveryNotePDF
content = content.replace(
  /\/\/ Header[\s\S]*?\/\/ Bill To/,
  `// Header
  const dividerY = drawVoucherHeader(doc, config, 'DELIVERY CHALLAN', [
    { label: 'Note No', value: note.noteNo },
    { label: 'Date', value: new Date(note.date).toLocaleDateString() }
  ]);

  // Bill To`
);

// 3. generateQuotationPDF
content = content.replace(
  /\/\/ --- Header ---[\s\S]*?\/\/ --- Bill To Section ---/,
  `// --- Header ---
  const dividerY = drawVoucherHeader(doc, config, 'QUOTATION', [
    { label: 'Quote No', value: quote.quotationNo },
    { label: 'Date', value: new Date(quote.date).toLocaleDateString() }
  ]);

  // --- Bill To Section ---`
);

// 4. generateVoucherSlipPDF (Accounting Vouchers)
content = content.replace(
  /\/\/ --- Header ---[\s\S]*?\/\/ --- Voucher Info ---/,
  `// --- Header ---
  const dividerY = drawVoucherHeader(doc, config, voucher.type.toUpperCase() + ' VOUCHER', [
    { label: 'Voucher No', value: voucher.voucherNo },
    { label: 'Date', value: new Date(voucher.date).toLocaleDateString() }
  ]);

  // --- Voucher Info ---`
);
content = content.replace(/const infoY = dividerY \+ 6;/g, "const infoY = dividerY + 6;");

// 5. generateCreditNotePDF
content = content.replace(
  /\/\/ Header[\s\S]*?\/\/ Meta info/,
  `// Header
  const dividerY = drawVoucherHeader(doc, config, 'CREDIT NOTE', [
    { label: 'Note No', value: creditNote.noteNo },
    { label: 'Date', value: new Date(creditNote.date).toLocaleDateString() }
  ]);

  // Meta info`
);

// 6. generateDebitNotePDF
content = content.replace(
  /\/\/ Header[\s\S]*?\/\/ Meta info/,
  `// Header
  const dividerY = drawVoucherHeader(doc, config, 'DEBIT NOTE', [
    { label: 'Note No', value: debitNote.noteNo },
    { label: 'Date', value: new Date(debitNote.date).toLocaleDateString() }
  ]);

  // Meta info`
);

// 7. generatePhysicalStockPDF
content = content.replace(
  /\/\/ Header[\s\S]*?\/\/ --- Main Table ---/,
  `// Header
  const dividerY = drawVoucherHeader(doc, config, 'PHYSICAL STOCK VOUCHER', [
    { label: 'Voucher No', value: voucher.voucherNo },
    { label: 'Date', value: new Date(voucher.date).toLocaleDateString() }
  ]);

  // --- Main Table ---`
);

// 8. generatePurchaseBillPDF
content = content.replace(
  /\/\/ --- Header ---[\s\S]*?\/\/ --- Supplier Section ---/,
  `// --- Header ---
  const dividerY = drawVoucherHeader(doc, config, 'PURCHASE BILL', [
    { label: 'Bill No', value: purchase.billNo },
    { label: 'Date', value: new Date(purchase.date).toLocaleDateString() },
    { label: 'Supplier Ref', value: purchase.supplierInvoiceNo || '' }
  ]);

  // --- Supplier Section ---`
);

fs.writeFileSync('src/utils/pdfExport.ts', content);
