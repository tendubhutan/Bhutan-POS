const fs = require('fs');

const missingCode = `
export function resolveBankDetailsForPrint(config: Config): string {
  if (config.PrintBankDetailsOnInvoice === 'false') return '';
  if (config.SelectedBankLedgerForPrint) {
    try {
      const ledgers = getLedgers();
      const bLedger = ledgers.find((l: any) => l['Ledger Name'] === config.SelectedBankLedgerForPrint);
      if (bLedger && (bLedger['Bank Name'] || bLedger['Account No'])) {
        const parts: string[] = [];
        if (bLedger['Bank Name']) parts.push(\`Bank: \${bLedger['Bank Name']}\`);
        if (bLedger['Account No']) parts.push(\`A/C No: \${bLedger['Account No']}\`);
        if (bLedger.Branch) parts.push(\`Branch: \${bLedger.Branch}\`);
        if (parts.length > 0) return parts.join('\\n');
      }
    } catch (e) {
      console.error('Error resolving bank ledger for print:', e);
    }
  }
  return config.CompanyBankDetails || '';
}

export function resolveTermsForPrint(config: Config, option?: string): string {
  if (option === 'none') return '';
  if (option === 'primary') return config.FooterTerms || '';
  if (option === 'secondary') return (config as any).SecondaryFooterTerms || '';
  return config.FooterTerms || '';
}

export function addSignatureToPdf(doc: jsPDF, config: Config, xRight: number, yFooterLine: number) {
  if (config.ReceiptSignatureImage) {
    const width = 35;
    const height = 15;
    try {
      const imgX = xRight - width;
      const imgY = yFooterLine - height - 1;
      const format = config.ReceiptSignatureImage.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(config.ReceiptSignatureImage, format, imgX, imgY, width, height);
    } catch (err) {
      console.error('Failed to render signature image on PDF:', err);
    }
  }
}

export function printPdfDoc(doc: jsPDF) {
  try {
    doc.autoPrint();
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const oldIframe = document.getElementById('print-pdf-iframe');
    if (oldIframe) oldIframe.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'print-pdf-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Iframe print failed, opening fallback window:', e);
          const win = window.open(blobUrl, '_blank');
          if (win) {
            win.focus();
            win.print();
          }
        }
      }, 300);
    };
  } catch (err) {
    console.error('Error in printPdfDoc:', err);
  }
}

function drawCancelledWatermark(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.setTextColor(220, 38, 38);
  doc.text('CANCELLED', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45
  });
  doc.restoreGraphicsState();
}

function drawReportHeaderBox(
  doc: jsPDF,
  config: Config,
  reportTitle: string,
  fromDate: string,
  toDate: string,
  depth: 'summary' | 'detailed' | 'super_detailed' = 'detailed',
  reportType?: 'TB' | 'PNL' | 'BS' | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const headerWidth = pageWidth - margin * 2;
  const headerHeight = 28;
  const startY = 10;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, headerWidth, headerHeight, 3, 3, 'FD');

  let textCenterX = pageWidth / 2;
  let textStartY = startY + 8.5;

  if (config.CompanyLogo) {
    try {
      const imgProps = doc.getImageProperties(config.CompanyLogo);
      const maxLogoHeight = headerHeight - 6;
      const logoWidth = (imgProps.width * maxLogoHeight) / imgProps.height;
      doc.addImage(config.CompanyLogo, margin + 4, startY + 3, logoWidth, maxLogoHeight);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(config.CompanyName || 'Store Name', textCenterX, textStartY, { align: 'center' });
  
  const addr = config.Address || (config as any).CompanyAddress || '';
  const gstin = config.CompanyGSTNo || (config as any).GSTIN || '';
  const metaStr = [addr, gstin ? \`GSTIN: \${gstin}\` : ''].filter(Boolean).join(' • ');
  if (metaStr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(metaStr, textCenterX, textStartY + 4.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text(reportTitle.toUpperCase(), textCenterX, textStartY + 9.5, { align: 'center' });

  const periodStr = reportType === 'BS' ? \`As at: \${toDate}\` : \`Period: \${fromDate} to \${toDate}\`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const periodWidth = doc.getTextWidth(periodStr) + 8;
  const periodX = (pageWidth - periodWidth) / 2;
  doc.setFillColor(224, 231, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(periodX, startY + 20.5, periodWidth, 4.5, 2.25, 2.25, 'FD');
  doc.setTextColor(55, 48, 163);
  doc.text(periodStr, textCenterX, startY + 23.8, { align: 'center' });

  return startY + headerHeight + 5;
}

export function generateReportPDF(
  reportData: any[],
  columns: { header: string; dataKey: string; format?: 'currency' | 'number' | 'text' | 'date'; align?: 'left' | 'right' | 'center'; width?: number }[],
  config: Config,
  reportTitle: string,
  fromDate: string,
  toDate: string,
  options?: {
    depth?: 'summary' | 'detailed' | 'super_detailed';
    reportType?: 'TB' | 'PNL' | 'BS' | null;
    totals?: Record<string, number>;
  }
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = drawReportHeaderBox(doc, config, reportTitle, fromDate, toDate, options?.depth, options?.reportType);
  
  const formattedData = reportData.map(row => {
    const newRow: any = {};
    columns.forEach(col => {
      let val = row[col.dataKey];
      if (col.format === 'currency') {
        val = Number(val || 0).toFixed(2);
      }
      newRow[col.dataKey] = val;
    });
    return newRow;
  });

  const bodyData = formattedData.map(row => columns.map(c => row[c.dataKey] || ''));
  const headData = [columns.map(c => c.header)];
  
  let footData: string[][] = [];
  if (options?.totals) {
    const footRow = columns.map(c => {
      if (c.dataKey === columns[0].dataKey) return 'Total';
      if (options.totals && options.totals[c.dataKey] !== undefined) {
        return Number(options.totals[c.dataKey]).toFixed(2);
      }
      return '';
    });
    footData = [footRow];
  }

  autoTable(doc, {
    startY,
    head: headData,
    body: bodyData,
    foot: footData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
    styles: { cellPadding: 2 },
    columnStyles: columns.reduce((acc: any, col, i) => {
      acc[i] = { halign: col.align || (col.format === 'currency' || col.format === 'number' ? 'right' : 'left') };
      if (col.width) acc[i].cellWidth = col.width;
      return acc;
    }, {})
  });

  return doc;
}

function buildGenericVoucherPdf(
  voucher: any,
  config: Config,
  title: string,
  meta: {label: string, value: string}[],
  entityTitle: string,
  entityName: string,
  entityDetails: string[],
  items: any[],
  columns: any[],
  summaryBlock: (doc: jsPDF, finalY: number, currency: string, margin: number, pageWidth: number) => number
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  if (voucher.status === 'Cancelled') drawCancelledWatermark(doc, pageWidth, pageHeight);

  const dividerY = drawVoucherHeader(doc, config, title, meta);
  
  const entityY = dividerY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(entityTitle, margin, entityY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  let currY = entityY + 5;
  doc.setFont('helvetica', 'bold');
  doc.text(entityName, margin, currY);
  doc.setFont('helvetica', 'normal');
  currY += 4.5;
  
  entityDetails.forEach(d => {
    if (d) {
      doc.text(d, margin, currY);
      currY += 4.5;
    }
  });

  const startTableY = Math.max(currY + 3, dividerY + 22);

  autoTable(doc, {
    startY: startTableY,
    head: [columns.map(c => c.header)],
    body: items.map(item => columns.map(c => c.getValue(item))),
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85], cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: columns.reduce((acc: any, col, i) => {
      acc[i] = { halign: col.align || 'left' };
      if (col.width) acc[i].cellWidth = col.width;
      return acc;
    }, {})
  });

  let finalY = (doc as any).lastAutoTable.finalY + 5;
  
  finalY = summaryBlock(doc, finalY, currency, margin, pageWidth);

  // Footer terms
  if (voucher.narration || voucher.remarks || voucher.paymentTerms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Notes / Remarks:', margin, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(voucher.narration || voucher.remarks || voucher.paymentTerms || '', pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 9);
  }

  const footerY = pageHeight - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  addSignatureToPdf(doc, config, pageWidth - margin, footerY);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(\`\${title} • \${config.CompanyName || 'POS'}\`, margin, footerY);
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });
  
  return doc;
}

export function generateInvoicePDF(invoice: SalesInvoice, config: Config, options?: any): jsPDF {
  const meta = [
    { label: 'Invoice No', value: invoice.invoiceNo },
    { label: 'Date', value: new Date(invoice.date).toLocaleDateString() },
    { label: 'Time', value: new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ];
  const entName = invoice.customer?.name || 'Walk-in Customer';
  const entDetails = [
    invoice.customer?.phone ? \`Contact: \${invoice.customer.phone}\` : '',
    invoice.customer?.address ? \`Address: \${invoice.customer.address}\` : '',
    invoice.customer?.gstNo ? \`GSTIN: \${invoice.customer.gstNo}\` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 10, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName },
    { header: 'Qty', align: 'center', width: 18, getValue: (it:any) => \`\${it.qty} \${it.unit || ''}\` },
    { header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate).toFixed(2) },
    { header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount).toFixed(2) }
  ];

  return buildGenericVoucherPdf(invoice, config, 'TAX INVOICE', meta, 'BILL TO:', entName, entDetails, invoice.items, cols, (doc, finalY, curr, margin, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(\`Grand Total: \${curr} \${Number(invoice.total).toFixed(2)}\`, pw - margin, finalY, { align: 'right' });
    return finalY + 10;
  });
}

export function generateQuotationPDF(quote: Quotation, config: Config): jsPDF {
  const meta = [
    { label: 'Quote No', value: quote.quotationNo },
    { label: 'Date', value: new Date(quote.date).toLocaleDateString() },
    { label: 'Valid Until', value: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '' }
  ];
  const entName = quote.customerName || 'Customer';
  const entDetails = [
    quote.address ? \`Address: \${quote.address}\` : '',
    quote.gstin ? \`GSTIN: \${quote.gstin}\` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 10, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName },
    { header: 'Qty', align: 'center', width: 18, getValue: (it:any) => \`\${it.qty} \${it.unit || ''}\` },
    { header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate).toFixed(2) },
    { header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount).toFixed(2) }
  ];

  return buildGenericVoucherPdf(quote, config, 'QUOTATION', meta, 'QUOTATION TO:', entName, entDetails, quote.items, cols, (doc, finalY, curr, margin, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(\`Grand Total: \${curr} \${Number(quote.total).toFixed(2)}\`, pw - margin, finalY, { align: 'right' });
    return finalY + 10;
  });
}

export function generateDeliveryNotePDF(note: DeliveryNote, config: Config): jsPDF {
  const meta = [
    { label: 'Note No', value: note.noteNo },
    { label: 'Date', value: new Date(note.date).toLocaleDateString() },
    { label: 'Order Ref', value: note.orderRefNo || '' }
  ];
  const entName = note.customerName || 'Customer';
  const entDetails = [
    note.destination ? \`Destination: \${note.destination}\` : '',
    note.dispatchThrough ? \`Dispatch: \${note.dispatchThrough}\` : '',
    note.vehicleNo ? \`Vehicle: \${note.vehicleNo}\` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 12, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName },
    { header: 'Quantity Delivered', align: 'center', width: 35, getValue: (it:any) => \`\${it.qty} \${it.unit || ''}\` }
  ];

  return buildGenericVoucherPdf(note, config, 'DELIVERY CHALLAN', meta, 'DELIVER TO:', entName, entDetails, note.items, cols, (doc, finalY, curr, margin, pw) => {
    return finalY + 5;
  });
}

export function generateVoucherSlipPDF(voucher: any, config: Config): jsPDF {
  const title = (voucher.type === 'P' ? 'PAYMENT' : voucher.type === 'R' ? 'RECEIPT' : voucher.type === 'C' ? 'CONTRA' : 'JOURNAL') + ' VOUCHER';
  const meta = [
    { label: 'Voucher No', value: voucher.voucherNo },
    { label: 'Date', value: new Date(voucher.date).toLocaleDateString() }
  ];
  const entName = voucher.type === 'P' || voucher.type === 'C' ? (voucher.creditLedger || 'Account') : (voucher.debitLedger || 'Account');
  
  let items = voucher.lines || [];
  if (items.length === 0) {
    items = [{ account: voucher.type === 'P' || voucher.type === 'C' ? voucher.debitLedger : voucher.creditLedger, amount: voucher.amount, type: voucher.type === 'P' || voucher.type === 'C' ? 'Dr' : 'Cr' }];
  }
  
  const cols = [
    { header: 'Sl', align: 'center', width: 12, getValue: (_:any, i:number) => i + 1 },
    { header: 'Particulars', align: 'left', getValue: (it:any) => it.account || it.ledger },
    { header: 'Amount', align: 'right', width: 35, getValue: (it:any) => Number(it.amount || it.debit || it.credit).toFixed(2) }
  ];

  return buildGenericVoucherPdf(voucher, config, title, meta, 'PRIMARY ACCOUNT:', entName, [], items, cols, (doc, finalY, curr, margin, pw) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const tAmt = voucher.totalAmount || voucher.amount;
    doc.text(\`Total Amount: \${curr} \${Number(tAmt).toFixed(2)}\`, pw - margin, finalY, { align: 'right' });
    return finalY + 10;
  });
}

export function generateCreditNotePDF(note: any, config: Config): jsPDF {
  return buildGenericVoucherPdf(note, config, 'CREDIT NOTE', [{ label: 'Note No', value: note.noteNo }, { label: 'Date', value: new Date(note.date).toLocaleDateString() }], 'ISSUED TO:', note.customerName, [], note.items || [], 
    [
      { header: 'Item', align: 'left', getValue: (it:any) => it.itemName },
      { header: 'Qty', align: 'center', width: 20, getValue: (it:any) => it.qty },
      { header: 'Amount', align: 'right', width: 30, getValue: (it:any) => Number(it.amount).toFixed(2) }
    ], 
    (doc, finalY, curr, margin, pw) => {
      doc.setFont('helvetica', 'bold'); doc.text(\`Total: \${curr} \${Number(note.total).toFixed(2)}\`, pw - margin, finalY, { align: 'right' }); return finalY + 10;
  });
}

export function generateDebitNotePDF(note: any, config: Config): jsPDF {
  return buildGenericVoucherPdf(note, config, 'DEBIT NOTE', [{ label: 'Note No', value: note.noteNo }, { label: 'Date', value: new Date(note.date).toLocaleDateString() }], 'ISSUED TO:', note.supplierName, [], note.items || [], 
    [
      { header: 'Item', align: 'left', getValue: (it:any) => it.itemName },
      { header: 'Qty', align: 'center', width: 20, getValue: (it:any) => it.qty },
      { header: 'Amount', align: 'right', width: 30, getValue: (it:any) => Number(it.amount).toFixed(2) }
    ], 
    (doc, finalY, curr, margin, pw) => {
      doc.setFont('helvetica', 'bold'); doc.text(\`Total: \${curr} \${Number(note.total).toFixed(2)}\`, pw - margin, finalY, { align: 'right' }); return finalY + 10;
  });
}

export function generatePhysicalStockPDF(voucher: any, config: Config): jsPDF {
  return buildGenericVoucherPdf(voucher, config, 'PHYSICAL STOCK VOUCHER', [{ label: 'Voucher No', value: voucher.voucherNo }, { label: 'Date', value: new Date(voucher.date).toLocaleDateString() }], 'LOCATION / REMARKS:', voucher.remarks || 'Main Location', [], voucher.items || [], 
    [
      { header: 'Item Code', align: 'left', width: 30, getValue: (it:any) => it.itemCode },
      { header: 'Item Name', align: 'left', getValue: (it:any) => it.itemName },
      { header: 'System Qty', align: 'center', width: 25, getValue: (it:any) => it.systemQty },
      { header: 'Physical Qty', align: 'center', width: 25, getValue: (it:any) => it.physicalQty },
      { header: 'Diff', align: 'center', width: 20, getValue: (it:any) => it.difference }
    ], 
    (doc, finalY) => finalY + 5
  );
}

`;

let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

const anchor = 'export function drawVoucherHeader';
const anchorIdx = content.indexOf(anchor);

if (anchorIdx !== -1) {
  content = content.slice(0, anchorIdx + anchor.length) + content.slice(anchorIdx + anchor.length);
  // Actually, we can just prepend missingCode right after the drawVoucherHeader block.
  // Wait, let's just prepend missingCode after imports and before drawVoucherHeader.
  const beforeAnchor = content.slice(0, anchorIdx);
  const afterAnchor = content.slice(anchorIdx);
  content = beforeAnchor + missingCode + '\\n' + afterAnchor;
}

fs.writeFileSync('src/utils/pdfExport.ts', content);
