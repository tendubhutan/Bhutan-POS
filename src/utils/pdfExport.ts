import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Config, SalesInvoice, PurchaseInvoice, DeliveryNote, Quotation, Voucher } from '../types';
import { getLedgers } from '../services/storageService';

export function resolveBankDetailsForPrint(config: Config): string {
  if (config.PrintBankDetailsOnInvoice === 'false') {
    return '';
  }
  if (config.SelectedBankLedgerForPrint) {
    try {
      const ledgers = getLedgers();
      const bLedger = ledgers.find(l => l['Ledger Name'] === config.SelectedBankLedgerForPrint);
      if (bLedger && (bLedger['Bank Name'] || bLedger['Account No'])) {
        const parts: string[] = [];
        if (bLedger['Bank Name']) parts.push(`Bank: ${bLedger['Bank Name']}`);
        if (bLedger['Account No']) parts.push(`A/C No: ${bLedger['Account No']}`);
        if (bLedger.Branch) parts.push(`Branch: ${bLedger.Branch}`);
        if (parts.length > 0) return parts.join('\n');
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
  if (option === 'secondary') return config.SecondaryTerms || '';
  if (option === 'both') {
    return [config.FooterTerms, config.SecondaryTerms].filter(Boolean).join('\n\n');
  }
  return [config.FooterTerms, config.SecondaryTerms].filter(Boolean).join('\n\n');
}

export function addSignatureToPdf(
  doc: jsPDF,
  config: Config,
  xRight: number,
  yFooterLine: number,
  width: number = 32,
  height: number = 12
) {
  if (config.ReceiptSignatureImage && config.ReceiptSignatureImage.trim()) {
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
  doc.setTextColor(220, 38, 38); // red-600
  
  // Draw diagonal text
  doc.text('CANCELLED', pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45
  });
  
  doc.restoreGraphicsState();
}

/**
 * Generate a professional A4 Tax Invoice PDF
 */
export function generateInvoicePDF(
  invoice: SalesInvoice,
  config: Config,
  options?: { customTerms?: string; customBankDetails?: string }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';
  const showGst = String(config.EnableGST) !== 'false';

  if (invoice.status === 'Cancelled') {
    drawCancelledWatermark(doc, pageWidth, pageHeight);
  }

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(config.CompanyName || 'RETAIL STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500

  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (showGst && (config.CompanyGSTNo || config.CompanyTPNNo)) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // --- Right side: Invoice Title & Meta ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text('TAX INVOICE', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Invoice No: ${invoice.invoiceNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  doc.text(`Time: ${new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, 36, { align: 'right' });

  // Divider line
  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // --- Bill To Section ---
  const billToY = dividerY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('BILL TO:', margin, billToY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  let custY = billToY + 5;
  const custName = invoice.customer?.name || 'Walk-in Cash Customer';
  doc.setFont('helvetica', 'bold');
  doc.text(custName, margin, custY);
  doc.setFont('helvetica', 'normal');
  custY += 4.5;

  if (invoice.customer?.phone) {
    doc.text(`Contact: ${invoice.customer.phone}`, margin, custY);
    custY += 4.5;
  }
  if (invoice.customer?.address) {
    doc.text(`Address: ${invoice.customer.address}`, margin, custY);
    custY += 4.5;
  }
  if (invoice.customer?.gstNo || invoice.customer?.tpnNo) {
    doc.text(`GSTIN / TPN: ${invoice.customer.gstNo || invoice.customer.tpnNo}`, margin, custY);
    custY += 4.5;
  }

  // --- Items Table ---
  const tableStartY = Math.max(custY + 3, billToY + 22);

  const tableHeaders = [
    '#',
    'Item',
    'Qty',
    'Unit',
    `Rate (${currency})`,
    `Sale Amt (${currency})`,
    showGst ? 'GST' : '',
    `Total Amt (${currency})`
  ].filter(Boolean);

  const tableRows = invoice.items.map((item, idx) => {
    const saleAmt = Number(
      item['Taxable Value'] !== undefined
        ? item['Taxable Value']
        : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
    ).toFixed(2);

    const gstAmount = Number(
      item['GST Amount'] !== undefined
        ? item['GST Amount']
        : (item['Zero Rated (Y/N)'] === 'Y' ? 0 : ((Number(item['Taxable Value'] || 0) * (Number(item['GST %']) || 0)) / 100))
    ).toFixed(2);

    const itemDesc = (item as any)['Item Description'] || (item as any).description || (item as any).Description;
    const itemDescPart = itemDesc ? `\nDesc: ${itemDesc}` : '';
    const itemSerialPart = item['Serial Numbers'] ? `\nSN: ${item['Serial Numbers']}` : '';
    const itemNameFormatted = item['Item Name'] + itemDescPart + itemSerialPart;

    const row = [
      String(idx + 1),
      itemNameFormatted,
      String(item.Qty),
      item.Unit || 'Pcs',
      Number(item.Rate).toFixed(2),
      saleAmt,
      showGst ? gstAmount : '',
      Number(item['Line Total']).toFixed(2)
    ].filter((val, i) => showGst || i !== 6);
    return row;
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [tableHeaders],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // indigo-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    columnStyles: showGst
      ? {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 14, halign: 'center' },
          3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 24, halign: 'right' },
          6: { cellWidth: 24, halign: 'right' },
          7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
        }
      : {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 26, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
        },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    }
  });

  // Calculate position after table
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // --- Summary & Tax Breakdown Box ---
  const summaryBoxWidth = 80;
  const summaryBoxX = pageWidth - margin - summaryBoxWidth;
  let summaryY = finalY;

  doc.setFontSize(8.5);

  if (showGst) {
    // Taxable Sale
    doc.setTextColor(100, 116, 139);
    doc.text('Taxable Sale:', summaryBoxX, summaryY);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currency} ${invoice.taxable.toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 5;

    // Exempted Sale
    doc.setTextColor(100, 116, 139);
    doc.text('Exempted Sale:', summaryBoxX, summaryY);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currency} ${invoice.zeroRated.toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 5;

    // GST Amount
    doc.setTextColor(100, 116, 139);
    doc.text('GST Amount:', summaryBoxX, summaryY);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currency} ${invoice.gstAmt.toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 5;
  }

  if (invoice.additionalExpenses && invoice.additionalExpenses.length > 0) {
    invoice.additionalExpenses.forEach((exp: any) => {
      doc.setTextColor(100, 116, 139);
      doc.text(`Addl (${exp.ledger}):`, summaryBoxX, summaryY);
      doc.setTextColor(30, 41, 59);
      doc.text(`${currency} ${Number(exp.amount).toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
      summaryY += 5;
    });
  }

  if (invoice.discount && invoice.discount > 0) {
    // Gross Subtotal
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', summaryBoxX, summaryY);
    doc.setTextColor(30, 41, 59);
    doc.text(`${currency} ${(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 5;

    // Bill Discount
    doc.setTextColor(220, 38, 38); // red-600
    doc.text('Bill Discount:', summaryBoxX, summaryY);
    doc.text(`-${currency} ${invoice.discount.toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
    summaryY += 5;
  }

  // Divider inside summary
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryBoxX, summaryY, pageWidth - margin, summaryY);
  summaryY += 4.5;

  // Grand Total Highlight
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text('Grand Total:', summaryBoxX, summaryY);
  doc.text(`${currency} ${invoice.total.toFixed(2)}`, pageWidth - margin, summaryY, { align: 'right' });
  summaryY += 6;

  // Payment Breakdown
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const paidParts: string[] = [];
  if (invoice.cash > 0) paidParts.push(`Cash: ${currency} ${invoice.cash.toFixed(2)}`);
  if (invoice.bank1 + invoice.bank2 > 0) paidParts.push(`Bank: ${currency} ${(invoice.bank1 + invoice.bank2).toFixed(2)}`);
  if (invoice.credit > 0) paidParts.push(`Due: ${currency} ${invoice.credit.toFixed(2)}`);
  
  if (paidParts.length > 0) {
    doc.text(paidParts.join('  |  '), summaryBoxX, summaryY);
  }

  // --- Left Box: Bank Details & Notes ---
  let notesY = finalY;
  if (invoice.narration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Narration:', margin, notesY);
    notesY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const narrationLines = doc.splitTextToSize(invoice.narration, summaryBoxWidth - 10);
    doc.text(narrationLines, margin, notesY);
    notesY += (narrationLines.length * 4) + 2;
  }

  const bankDetailsToPrint = options?.customBankDetails !== undefined
    ? options.customBankDetails
    : resolveBankDetailsForPrint(config);

  if (bankDetailsToPrint && bankDetailsToPrint.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Bank & Payment Details:', margin, notesY);
    notesY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const bankLines = doc.splitTextToSize(bankDetailsToPrint, 85);
    doc.text(bankLines, margin, notesY);
    notesY += (bankLines.length * 3.8) + 3;
  }

  const termsToDisplay = options?.customTerms !== undefined
    ? options.customTerms
    : (invoice.termsAndConditions || resolveTermsForPrint(config));

  if (termsToDisplay && termsToDisplay.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Terms & Conditions:', margin, notesY);
    notesY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    const termsLines = doc.splitTextToSize(termsToDisplay, 85);
    doc.text(termsLines, margin, notesY);
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  addSignatureToPdf(doc, config, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Thank you for doing business with ${config.CompanyName || 'us'}!`,
    margin,
    footerY
  );
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
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

  // Outer Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, headerWidth, headerHeight, 3, 3, 'FD');

  // Company Name (Centered)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(config.CompanyName || 'Store Name', pageWidth / 2, startY + 8.5, { align: 'center' });

  // Address & GSTIN (Centered)
  const addr = config.Address || (config as any).CompanyAddress || '';
  const gstin = config.CompanyGSTNo || (config as any).GSTIN || '';
  const metaStr = [addr, gstin ? `GSTIN: ${gstin}` : ''].filter(Boolean).join(' • ');

  if (metaStr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(metaStr, pageWidth / 2, startY + 13, { align: 'center' });
  }

  // Report Title (Centered, Dark Navy Uppercase)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text(reportTitle.toUpperCase(), pageWidth / 2, startY + 18, { align: 'center' });

  // Period Badge Pill (Centered)
  const periodStr = reportType === 'BS' ? `As at: ${toDate}` : `Period: ${fromDate} to ${toDate}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const periodWidth = doc.getTextWidth(periodStr) + 8;
  const periodX = (pageWidth - periodWidth) / 2;
  doc.setFillColor(224, 231, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(periodX, startY + 20.5, periodWidth, 4.5, 2.25, 2.25, 'FD');
  doc.setTextColor(55, 48, 163);
  doc.text(periodStr, pageWidth / 2, startY + 23.8, { align: 'center' });

  return startY + headerHeight + 5;
}

/**
 * Generate a clean PDF for any Report
 */
export function generateReportPDF(
  reportTitle: string,
  config: Config,
  fromDate: string,
  toDate: string,
  headers: string[],
  rows: any[][],
  totals?: any[],
  summaryCards?: { label: string; value: string | number }[],
  reportType?: 'TB' | 'PNL' | 'BS' | null,
  reportData?: any,
  depth: 'summary' | 'detailed' | 'super_detailed' = 'detailed'
): jsPDF {
  const currency = config.CurrencySymbol || 'Nu.';
  const fmtNum = (val: number) => (Number(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 1. FINANCIAL REPORT: PROFIT & LOSS ACCOUNT
  if (reportType === 'PNL' && reportData?.pnl) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;

    const p = reportData.pnl;
    const s = Number(p.s) || 0;
    const di = Number(p.di) || 0;
    const os = Number(p.os) || 0;
    const pur = Number(p.p) || 0;
    const de = Number(p.de) || 0;
    const cs = Number(p.cs) || 0;
    const ii = Number(p.ii) || 0;
    const ie = Number(p.ie) || 0;

    const cogs = os + pur + de - cs;
    const grossProfit = s + di - cogs;
    const netProfit = grossProfit + ii - ie;

    const rawTb = reportData.tb || [];

    const getPnlAmt = (l: any, isIncome: boolean) => {
      if (l.periodAmount !== undefined) return l.periodAmount;
      const pDr = Number(l.periodDr) || 0;
      const pCr = Number(l.periodCr) || 0;
      if (pDr > 0 || pCr > 0) {
        return isIncome ? Math.abs(pCr - pDr) : Math.max(0, pDr - pCr);
      }
      return isIncome ? Math.abs((Number(l.cr) || 0) - (Number(l.dr) || 0)) : Math.max(0, (Number(l.dr) || 0) - (Number(l.cr) || 0));
    };

    const mapPnlLedger = (l: any, isIncome: boolean) => ({
      ...l,
      amount: getPnlAmt(l, isIncome)
    });

    const filterPnlLedgers = (ledgers: any[], isIncome: boolean) => {
      const mapped = ledgers.map(l => mapPnlLedger(l, isIncome));
      if (depth === 'detailed') {
        return mapped.filter(l => l.amount > 0);
      }
      return mapped;
    };

    const salesLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Sales')), true);
    const purchLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Purchase')), false);
    const directExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Direct Expense')), false);
    const indirectExpLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Expense')), false);
    const indirectIncLedgers = filterPnlLedgers(rawTb.filter((l: any) => (l.grp || '').includes('Indirect Income')), true);

    const totalTradingLeft = os + pur + de + Math.max(0, grossProfit);
    const totalTradingRight = s + di + cs;

    // Header Banner
    let startY = drawReportHeaderBox(doc, config, 'PROFIT & LOSS ACCOUNT', fromDate, toDate, depth, 'PNL');

    // Trading Account Section Header
    doc.setFillColor(224, 231, 255);
    doc.rect(margin, startY, pageWidth - margin * 2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 48, 163);
    doc.text('TRADING ACCOUNT', margin + 3, startY + 4);

    startY += 5.5;

    const tradingRows: any[] = [];
    tradingRows.push(['Opening Stock', fmtNum(os), 'Sales Accounts', fmtNum(s)]);
    if (depth !== 'summary') {
      salesLedgers.forEach((l: any) => tradingRows.push(['', '', `  ${l.name}`, fmtNum(l.amount)]));
    }
    tradingRows.push(['Purchase Accounts', fmtNum(pur), 'Closing Stock Valuation', fmtNum(cs)]);
    if (depth !== 'summary') {
      purchLedgers.forEach((l: any) => tradingRows.push([`  ${l.name}`, fmtNum(l.amount), '', '']));
    }
    if (de > 0) {
      tradingRows.push(['Direct Expenses', fmtNum(de), '', '']);
      if (depth !== 'summary') {
        directExpLedgers.forEach((l: any) => tradingRows.push([`  ${l.name}`, fmtNum(l.amount), '', '']));
      }
    }
    if (grossProfit >= 0) {
      tradingRows.push(['Gross Profit c/o', fmtNum(grossProfit), '', '']);
    } else {
      tradingRows.push(['', '', 'Gross Loss c/o', fmtNum(Math.abs(grossProfit))]);
    }

    autoTable(doc, {
      startY: startY,
      head: [['Particulars (Debit)', `Amount (${currency})`, 'Particulars (Credit)', `Amount (${currency})`]],
      body: tradingRows,
      foot: [['TOTAL', fmtNum(totalTradingLeft), 'TOTAL', fmtNum(totalTradingRight)]],
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        1: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' },
        2: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        3: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' }
      }
    });

    startY = (doc as any).lastAutoTable.finalY + 5;

    // P&L Section Header
    doc.setFillColor(224, 231, 255);
    doc.rect(margin, startY, pageWidth - margin * 2, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 48, 163);
    doc.text('PROFIT & LOSS ACCOUNT', margin + 3, startY + 4);

    startY += 5.5;

    const pnlRows: any[] = [];
    if (grossProfit < 0) {
      pnlRows.push(['Gross Loss b/f', fmtNum(Math.abs(grossProfit)), '', '']);
    } else {
      pnlRows.push(['', '', 'Gross Profit b/f', fmtNum(grossProfit)]);
    }

    pnlRows.push(['Indirect Expenses', fmtNum(ie), 'Indirect Incomes', fmtNum(ii)]);
    if (depth !== 'summary') {
      indirectExpLedgers.forEach((l: any) => pnlRows.push([`  ${l.name}`, fmtNum(l.amount), '', '']));
      indirectIncLedgers.forEach((l: any) => pnlRows.push(['', '', `  ${l.name}`, fmtNum(l.amount)]));
    }

    if (netProfit >= 0) {
      pnlRows.push(['Nett Profit', fmtNum(netProfit), '', '']);
    } else {
      pnlRows.push(['', '', 'Nett Loss', fmtNum(Math.abs(netProfit))]);
    }

    const totalPnlLeft = ie + (grossProfit < 0 ? Math.abs(grossProfit) : 0) + Math.max(0, netProfit);
    const totalPnlRight = ii + (grossProfit >= 0 ? grossProfit : 0) + (netProfit < 0 ? Math.abs(netProfit) : 0);

    autoTable(doc, {
      startY: startY,
      head: [['Particulars (Debit)', `Amount (${currency})`, 'Particulars (Credit)', `Amount (${currency})`]],
      body: pnlRows,
      foot: [['TOTAL', fmtNum(totalPnlLeft), 'TOTAL', fmtNum(totalPnlRight)]],
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        1: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' },
        2: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        3: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' }
      }
    });

    return doc;
  }

  // 2. FINANCIAL REPORT: BALANCE SHEET
  if (reportType === 'BS' && reportData?.bs && reportData?.pnl) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;

    const p = reportData.pnl;
    const netProfit = (Number(p.s) || 0) + (Number(p.di) || 0) - ((Number(p.os) || 0) + (Number(p.p) || 0) + (Number(p.de) || 0) - (Number(p.cs) || 0)) + (Number(p.ii) || 0) - (Number(p.ie) || 0);

    const cap = Number(reportData.bs.cap) || 0;
    const netEquity = cap + netProfit;
    const loans = Number(reportData.bs.ln) || 0;
    const cl = Number(reportData.bs.cl) || 0;
    const fa = Number(reportData.bs.fa) || 0;
    const ca = Number(reportData.bs.ca) || 0;
    const stockVal = Number(reportData.bs.cs) || 0;

    const rawTb = reportData.tb || [];
    const capitalLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Capital'));
    const loanLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Loan'));
    const currentLiabLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Liabilit') || (l.grp || '').includes('Creditor') || (l.grp || '').includes('Dut'));
    const fixedAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Fixed Asset'));
    const currentAssetLedgers = rawTb.filter((l: any) => (l.grp || '').includes('Current Asset') || (l.grp || '').includes('Debtor') || (l.grp || '').includes('Bank') || (l.grp || '').includes('Cash'));

    const totalLiab = netEquity + loans + cl;
    const totalAssets = fa + ca + stockVal;

    // Header Banner
    const startY = drawReportHeaderBox(doc, config, 'BALANCE SHEET', fromDate, toDate, depth, 'BS');

    const bsRows: any[] = [];
    bsRows.push(['Capital Account', fmtNum(cap), 'Fixed Assets', fmtNum(fa)]);
    if (depth !== 'summary') {
      capitalLedgers.forEach((l: any) => bsRows.push([`  ${l.name}`, fmtNum(l.cr || l.dr), '', '']));
      fixedAssetLedgers.forEach((l: any) => bsRows.push(['', '', `  ${l.name}`, fmtNum(l.dr || l.cr)]));
    }
    bsRows.push(['  Add: Nett Profit / (Loss)', fmtNum(netProfit), 'Current Assets', fmtNum(ca)]);
    if (depth !== 'summary') {
      currentAssetLedgers.forEach((l: any) => bsRows.push(['', '', `  ${l.name}`, fmtNum(l.dr || l.cr)]));
    }
    bsRows.push(['Loans (Liability)', fmtNum(loans), 'Closing Stock Valuation', fmtNum(stockVal)]);
    if (depth !== 'summary') {
      loanLedgers.forEach((l: any) => bsRows.push([`  ${l.name}`, fmtNum(l.cr || l.dr), '', '']));
    }
    bsRows.push(['Current Liabilities & Payables', fmtNum(cl), '', '']);
    if (depth !== 'summary') {
      currentLiabLedgers.forEach((l: any) => bsRows.push([`  ${l.name}`, fmtNum(l.cr || l.dr), '', '']));
    }

    autoTable(doc, {
      startY: startY,
      head: [['LIABILITIES & EQUITY', `Amount (${currency})`, 'ASSETS & PROPERTIES', `Amount (${currency})`]],
      body: bsRows,
      foot: [['TOTAL LIABILITIES', fmtNum(totalLiab), 'TOTAL ASSETS', fmtNum(totalAssets)]],
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        1: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' },
        2: { cellWidth: (pageWidth - margin * 2) * 0.35 },
        3: { cellWidth: (pageWidth - margin * 2) * 0.15, halign: 'right' }
      }
    });

    return doc;
  }

  // 3. FINANCIAL REPORT: TRIAL BALANCE
  if (reportType === 'TB' && reportData?.tb) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;

    const rawTb = reportData.tb || [];
    let totalDr = 0;
    let totalCr = 0;

    const tbRows: any[] = [];
    rawTb.forEach((l: any) => {
      const dr = Number(l.dr) || 0;
      const cr = Number(l.cr) || 0;
      totalDr += dr;
      totalCr += cr;
      tbRows.push([l.name || l.grp || 'Ledger Account', dr > 0 ? fmtNum(dr) : '-', cr > 0 ? fmtNum(cr) : '-']);
    });

    // Header Banner
    const startY = drawReportHeaderBox(doc, config, 'TRIAL BALANCE', fromDate, toDate, depth, 'TB');

    autoTable(doc, {
      startY: startY,
      head: [['Particulars / Account Groups', `Closing Debit (${currency})`, `Closing Credit (${currency})`]],
      body: tbRows,
      foot: [['CARRIED OVER / GRAND TOTAL', fmtNum(totalDr), fmtNum(totalCr)]],
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [55, 48, 163], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: (pageWidth - margin * 2) * 0.6 },
        1: { cellWidth: (pageWidth - margin * 2) * 0.2, halign: 'right' },
        2: { cellWidth: (pageWidth - margin * 2) * 0.2, halign: 'right' }
      }
    });

    return doc;
  }

  // 4. FALLBACK GENERAL REPORT TABLE EXPORT
  const isWide = headers.length > 6;
  const doc = new jsPDF({
    orientation: isWide ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const nowStr = new Date().toLocaleString();

  // --- Title & Header ---
  const currentY = drawReportHeaderBox(doc, config, reportTitle, fromDate, toDate, depth, reportType);

  // --- Data Table ---
  const bodyData = rows.map(r => r.map(c => (c !== undefined && c !== null ? String(c) : '')));

  if (totals && totals.length > 0) {
    const totalsFormatted = totals.map(t => (t !== undefined && t !== null ? String(t) : ''));
    bodyData.push(totalsFormatted);
  }

  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: bodyData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didParseCell: function (data) {
      // Highlight the totals row if present
      if (totals && totals.length > 0 && data.row.index === bodyData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [30, 41, 59];
      }
    }
  });

  // Footer page numbers
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} • ${config.CompanyName || 'POS'}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Generate a professional Delivery Note / Outward Challan PDF
 */
export function generateDeliveryNotePDF(note: DeliveryNote, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'RETAIL STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (config.CompanyGSTNo || config.CompanyTPNNo) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // Right side Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(14, 116, 144); // cyan-700
  doc.text('DELIVERY CHALLAN / NOTE', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Challan No: ${note.noteNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Date: ${new Date(note.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  if (note.orderRefNo) {
    doc.text(`Order Ref: ${note.orderRefNo}`, pageWidth - margin, 36, { align: 'right' });
  }

  // Divider line
  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(207, 250, 254);
  doc.setLineWidth(0.6);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Consignee / Transport Details Section
  const infoY = dividerY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CONSIGNEE / DELIVER TO:', margin, infoY);
  doc.text('TRANSPORT & DISPATCH:', pageWidth / 2 + 10, infoY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let custY = infoY + 5;
  const custName = note.customer?.name || (note.customer as any)?.ledger || 'Customer';
  doc.setFont('helvetica', 'bold');
  doc.text(custName, margin, custY);
  doc.setFont('helvetica', 'normal');
  custY += 4.5;

  if (note.customer?.phone) {
    doc.text(`Contact: ${note.customer.phone}`, margin, custY);
    custY += 4.5;
  }
  if (note.customer?.address) {
    doc.text(`Address: ${note.customer.address}`, margin, custY);
    custY += 4.5;
  }
  if (note.destination && note.destination !== note.customer?.address) {
    doc.text(`Destination: ${note.destination}`, margin, custY);
    custY += 4.5;
  }

  // Transport details
  let transY = infoY + 5;
  if (note.vehicleNo) {
    doc.text(`Vehicle No: ${note.vehicleNo}`, pageWidth / 2 + 10, transY);
    transY += 4.5;
  }
  if (note.dispatchThrough) {
    doc.text(`Dispatched via: ${note.dispatchThrough}`, pageWidth / 2 + 10, transY);
    transY += 4.5;
  }
  doc.text(`Status: ${note.status || 'Dispatched'}`, pageWidth / 2 + 10, transY);

  // Items Table
  const tableStartY = Math.max(custY, transY) + 4;
  const tableHeaders = ['#', 'Item Code', 'Description of Goods', 'Quantity', 'Unit', `Valuation (${currency})`];

  let totalQty = 0;
  let totalVal = 0;

  const tableBody = (note.items || []).map((it, idx) => {
    const qty = Number(it.qty) || 0;
    const amt = Number(it.amount) || qty * (Number(it.rate) || 0);
    totalQty += qty;
    totalVal += amt;
    return [
      idx + 1,
      it.itemCode || '-',
      it.itemName || '',
      qty,
      it.unit || 'Pcs',
      amt > 0 ? amt.toFixed(2) : '-'
    ];
  });

  // Append totals row
  tableBody.push(['', '', 'Total Goods Dispatched', `${totalQty} units`, '', totalVal > 0 ? totalVal.toFixed(2) : '-']);

  autoTable(doc, {
    startY: tableStartY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [14, 116, 144], // cyan-700
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.8
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function (data) {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [236, 254, 255];
        data.cell.styles.textColor = [14, 116, 144];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  if (note.remarks) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Remarks / Instructions:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(note.remarks, margin, finalY + 4.5);
  }

  // Footer Signatures
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  addSignatureToPdf(doc, config, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Receiver's Signature & Seal", margin, footerY);
  doc.text("Carrier / Driver's Signature", pageWidth / 2, footerY, { align: 'center' });
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional Quotation / Price Estimate PDF
 */
export function generateQuotationPDF(quote: Quotation, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'RETAIL STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (config.CompanyGSTNo || config.CompanyTPNNo) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // Right side Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(109, 40, 217); // violet-700
  doc.text('COMMERCIAL QUOTATION', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Quotation No: ${quote.quotationNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Date: ${new Date(quote.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  if (quote.validUntil) {
    doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`, pageWidth - margin, 36, { align: 'right' });
  }

  // Divider line
  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(237, 233, 254);
  doc.setLineWidth(0.6);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Client Details
  const billToY = dividerY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PROPOSAL PREPARED FOR:', margin, billToY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let custY = billToY + 5;
  const custName = quote.customer?.name || (quote.customer as any)?.ledger || 'Prospective Client';
  doc.setFont('helvetica', 'bold');
  doc.text(custName, margin, custY);
  doc.setFont('helvetica', 'normal');
  custY += 4.5;

  if (quote.customer?.phone) {
    doc.text(`Contact: ${quote.customer.phone}`, margin, custY);
    custY += 4.5;
  }
  if (quote.customer?.address) {
    doc.text(`Address: ${quote.customer.address}`, margin, custY);
    custY += 4.5;
  }

  // Table
  const tableStartY = custY + 3;
  const tableHeaders = ['#', 'Item / Service', 'Qty', 'Unit', `Rate (${currency})`, 'Disc', `Net Total (${currency})`];

  const tableBody = (quote.items || []).map((it, idx) => [
    idx + 1,
    it.itemName || it.itemCode || '',
    it.qty,
    it.unit || 'Pcs',
    (Number(it.rate) || 0).toFixed(2),
    it.discount > 0 ? `${it.discount.toFixed(2)}` : '-',
    (Number(it.lineTotal) || 0).toFixed(2)
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.6
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Grand Total Box
  const summaryBoxX = pageWidth - margin - 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(109, 40, 217);
  doc.text('Grand Quotation Total:', summaryBoxX, finalY + 4);
  doc.text(`${currency} ${Number(quote.total).toFixed(2)}`, pageWidth - margin, finalY + 4, { align: 'right' });

  let termsY = finalY + 12;
  if (quote.paymentTerms || quote.remarks) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Terms & Conditions:', margin, termsY);
    termsY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const terms = quote.paymentTerms || quote.remarks || '';
    const splitTerms = doc.splitTextToSize(terms, 120);
    doc.text(splitTerms, margin, termsY);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  addSignatureToPdf(doc, config, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('This is a commercial quotation, not a tax invoice.', margin, footerY);
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional Financial Voucher Slip PDF (Payment, Receipt, Journal, Contra)
 */
export function generateVoucherSlipPDF(voucher: any, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5' // A5 is perfect for accounting voucher slips
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const currency = config.CurrencySymbol || 'Nu.';

  const vTypeLabel =
    voucher.type === 'P'
      ? 'PAYMENT VOUCHER'
      : voucher.type === 'R'
      ? 'RECEIPT VOUCHER'
      : voucher.type === 'J'
      ? 'JOURNAL VOUCHER'
      : voucher.type === 'C'
      ? 'CONTRA VOUCHER'
      : 'ACCOUNTING VOUCHER';

  // Company Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'BUSINESS ACCOUNTING', margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (config.Address) {
    doc.text(config.Address, margin, 21);
  }

  // Right Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text(vTypeLabel, pageWidth - margin, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Voucher No: ${voucher.voucherNo}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(`Date: ${new Date(voucher.date).toLocaleDateString()}`, pageWidth - margin, 26, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 30, pageWidth - margin, 30);

  // Table of entries
  let tableHeaders = ['Type', 'Ledger Account', `Debit (${currency})`, `Credit (${currency})`];
  let tableBody: any[] = [];
  let totalDr = 0;
  let totalCr = 0;

  if (voucher.lines && voucher.lines.length > 0) {
    voucher.lines.forEach((l: any) => {
      const isDr = l.type === 'Dr';
      const amt = Number(l.amount) || 0;
      if (isDr) totalDr += amt;
      else totalCr += amt;
      tableBody.push([
        l.type,
        l.ledger,
        isDr ? amt.toFixed(2) : '-',
        !isDr ? amt.toFixed(2) : '-'
      ]);
    });
  } else {
    const amt = Number(voucher.amount) || 0;
    totalDr = amt;
    totalCr = amt;
    tableBody = [
      ['Dr', voucher.debitLedger || 'Debit Account', amt.toFixed(2), '-'],
      ['Cr', voucher.creditLedger || 'Credit Account', '-', amt.toFixed(2)]
    ];
  }

  // Totals row
  tableBody.push(['', 'Total Amount', totalDr.toFixed(2), totalCr.toFixed(2)]);

  autoTable(doc, {
    startY: 34,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2.2
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'right' },
      3: { cellWidth: 26, halign: 'right' }
    },
    didParseCell: function (data) {
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  if (voucher.narration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Narration:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const narr = doc.splitTextToSize(voucher.narration, pageWidth - margin * 2);
    doc.text(narr, margin, finalY + 4);
  }

  // Signatures
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By', margin, footerY);
  doc.text('Checked / Verified', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional Credit Note PDF
 */
export function generateCreditNotePDF(creditNote: any, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'BUSINESS STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (config.CompanyGSTNo || config.CompanyTPNNo) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // Right Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(126, 34, 206); // purple-700
  doc.text('CREDIT NOTE', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Doc No: ${creditNote.voucherNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Date: ${new Date(creditNote.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  if (creditNote.originalInvoiceRef) {
    doc.text(`Orig Invoice: ${creditNote.originalInvoiceRef}`, pageWidth - margin, 36, { align: 'right' });
  }

  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(243, 232, 255);
  doc.setLineWidth(0.6);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Customer info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('CREDIT ISSUED TO (CUSTOMER):', margin, dividerY + 6);
  
  let cnY = dividerY + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(creditNote.partyLedger || 'Customer Account', margin, cnY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  cnY += 4.5;

  if (creditNote.partyPhone) {
    doc.text(`Contact: ${creditNote.partyPhone}`, margin, cnY);
    cnY += 4.5;
  }
  if (creditNote.partyAddress) {
    doc.text(`Address: ${creditNote.partyAddress}`, margin, cnY);
    cnY += 4.5;
  }
  if (creditNote.partyGstNo) {
    doc.text(`GSTIN / TPN: ${creditNote.partyGstNo}`, margin, cnY);
    cnY += 4.5;
  }

  // Items or lines
  let tableHeaders = ['#', 'Item / Particulars', 'Qty', `Rate (${currency})`, `Amount (${currency})`];
  let tableBody: any[] = [];
  if (creditNote.items && creditNote.items.length > 0) {
    tableBody = creditNote.items.map((it: any, idx: number) => [
      idx + 1,
      it.itemName || it.itemCode,
      it.qty,
      (Number(it.rate) || 0).toFixed(2),
      (Number(it.amount) || 0).toFixed(2)
    ]);
  } else {
    tableBody = [[1, 'Sales Return / Credit Adjustment', 1, (Number(creditNote.amount) || 0).toFixed(2), (Number(creditNote.amount) || 0).toFixed(2)]];
  }

  autoTable(doc, {
    startY: Math.max(cnY + 2, dividerY + 16),
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [126, 34, 206],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const grandTotal = Number(creditNote.totalAmount || creditNote.amount || 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(126, 34, 206);
  doc.text(`Total Credited: ${currency} ${grandTotal.toFixed(2)}`, pageWidth - margin, finalY + 4, { align: 'right' });

  if (creditNote.narration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Narration / Reason:', margin, finalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(creditNote.narration, margin, finalY + 17);
  }

  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By', margin, footerY);
  doc.text('Approved By', pageWidth / 2, footerY, { align: 'center' });
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional Debit Note PDF
 */
export function generateDebitNotePDF(debitNote: any, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'BUSINESS STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (config.CompanyGSTNo || config.CompanyTPNNo) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // Right Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(194, 65, 12); // orange-700
  doc.text('DEBIT NOTE', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Doc No: ${debitNote.voucherNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Date: ${new Date(debitNote.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  if (debitNote.originalBillRef) {
    doc.text(`Orig Bill: ${debitNote.originalBillRef}`, pageWidth - margin, 36, { align: 'right' });
  }

  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(255, 237, 213);
  doc.setLineWidth(0.6);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // Supplier info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('DEBIT ISSUED TO (SUPPLIER):', margin, dividerY + 6);

  let dnY = dividerY + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(debitNote.supplierLedger || debitNote.partyLedger || 'Supplier Account', margin, dnY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  dnY += 4.5;

  const suppPhone = debitNote.supplierPhone || debitNote.partyPhone;
  const suppAddr = debitNote.supplierAddress || debitNote.partyAddress;
  const suppGst = debitNote.supplierGstNo || debitNote.partyGstNo;

  if (suppPhone) {
    doc.text(`Contact: ${suppPhone}`, margin, dnY);
    dnY += 4.5;
  }
  if (suppAddr) {
    doc.text(`Address: ${suppAddr}`, margin, dnY);
    dnY += 4.5;
  }
  if (suppGst) {
    doc.text(`GSTIN / TPN: ${suppGst}`, margin, dnY);
    dnY += 4.5;
  }

  // Items or lines
  let tableHeaders = ['#', 'Item / Particulars', 'Qty', `Rate (${currency})`, `Amount (${currency})`];
  let tableBody: any[] = [];
  if (debitNote.items && debitNote.items.length > 0) {
    tableBody = debitNote.items.map((it: any, idx: number) => [
      idx + 1,
      it.itemName || it.itemCode,
      it.qty,
      (Number(it.rate) || 0).toFixed(2),
      (Number(it.amount) || 0).toFixed(2)
    ]);
  } else {
    tableBody = [[1, 'Purchase Return / Debit Adjustment', 1, (Number(debitNote.amount) || 0).toFixed(2), (Number(debitNote.amount) || 0).toFixed(2)]];
  }

  autoTable(doc, {
    startY: Math.max(dnY + 2, dividerY + 16),
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [194, 65, 12],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const grandTotal = Number(debitNote.totalAmount || debitNote.amount || 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(194, 65, 12);
  doc.text(`Total Debited: ${currency} ${grandTotal.toFixed(2)}`, pageWidth - margin, finalY + 4, { align: 'right' });

  if (debitNote.narration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Narration / Reason:', margin, finalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(debitNote.narration, margin, finalY + 17);
  }

  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Prepared By', margin, footerY);
  doc.text('Approved By', pageWidth / 2, footerY, { align: 'center' });
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional Physical Stock Audit Report PDF
 */
export function generatePhysicalStockPDF(voucher: any, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'BUSINESS STORE', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }

  // Right Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(13, 148, 136); // teal-600
  doc.text('PHYSICAL STOCK AUDIT', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Audit Ref: ${voucher.voucherNo}`, pageWidth - margin, 26, { align: 'right' });
  doc.text(`Audit Date: ${new Date(voucher.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  if (voucher.verifiedBy) {
    doc.text(`Auditor: ${voucher.verifiedBy}`, pageWidth - margin, 36, { align: 'right' });
  }

  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.6);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  const tableHeaders = ['#', 'Item Name', 'Book Qty', 'Counted Qty', 'Difference', `Variance (${currency})`];
  const tableBody = (voucher.items || []).map((it: any, idx: number) => {
    const diff = Number(it.differenceQty) || 0;
    const diffStr = diff > 0 ? `+${diff}` : String(diff);
    return [
      idx + 1,
      it.itemName || it.itemCode,
      it.bookQty,
      it.physicalQty,
      diffStr,
      (Number(it.varianceValue) || 0).toFixed(2)
    ];
  });

  autoTable(doc, {
    startY: dividerY + 6,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.4
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 28, halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  if (voucher.remarks) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Audit Remarks / Location:', margin, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(voucher.remarks, margin, finalY + 4.5);
  }

  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Audited By', margin, footerY);
  doc.text('Store Manager Signature', pageWidth / 2, footerY, { align: 'center' });
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional A4 Purchase Bill / Purchase Invoice PDF
 */
export function generatePurchaseBillPDF(purchase: PurchaseInvoice | any, config: Config): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const currency = config.CurrencySymbol || 'Nu.';
  const showGst = String(config.EnableGST) !== 'false';

  if (purchase.status === 'Cancelled') {
    drawCancelledWatermark(doc, pageWidth, pageHeight);
  }

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'BUSINESS ACCOUNTING', margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  let headerY = 25;
  if (config.Address) {
    doc.text(config.Address, margin, headerY);
    headerY += 4.5;
  }
  if (showGst && (config.CompanyGSTNo || config.CompanyTPNNo)) {
    doc.text(`GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}`, margin, headerY);
    headerY += 4.5;
  }

  // --- Right side: Title & Meta ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('PURCHASE BILL', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Bill Ref: ${purchase.billNo || purchase.invoiceNo || 'PUR'}`, pageWidth - margin, 26, { align: 'right' });
  if (purchase.supplierBillNo) {
    doc.text(`Supplier Inv #: ${purchase.supplierBillNo}`, pageWidth - margin, 31, { align: 'right' });
    doc.text(`Date: ${new Date(purchase.date).toLocaleDateString()}`, pageWidth - margin, 36, { align: 'right' });
  } else {
    doc.text(`Date: ${new Date(purchase.date).toLocaleDateString()}`, pageWidth - margin, 31, { align: 'right' });
  }

  // Divider line
  const dividerY = Math.max(headerY + 2, 42);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // --- Supplier Section ---
  const suppY = dividerY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('SUPPLIER (VENDOR):', margin, suppY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  let detailY = suppY + 5;
  const suppName = typeof purchase.supplier === 'object' ? (purchase.supplier?.name || purchase.supplier?.ledger || 'Vendor') : (purchase.supplier || 'Vendor');
  doc.setFont('helvetica', 'bold');
  doc.text(suppName, margin, detailY);
  doc.setFont('helvetica', 'normal');
  detailY += 4.5;

  if (typeof purchase.supplier === 'object' && (purchase.supplier?.contactNo || purchase.supplier?.phone)) {
    doc.text(`Contact: ${purchase.supplier.contactNo || purchase.supplier.phone}`, margin, detailY);
    detailY += 4.5;
  }
  if (typeof purchase.supplier === 'object' && (purchase.supplier?.address || purchase.supplier?.Address)) {
    doc.text(`Address: ${purchase.supplier.address || purchase.supplier.Address}`, margin, detailY);
    detailY += 4.5;
  }
  if (typeof purchase.supplier === 'object' && (purchase.supplier?.gstNo || purchase.supplier?.tpnNo)) {
    doc.text(`Supplier GSTIN/TPN: ${purchase.supplier.gstNo || purchase.supplier.tpnNo}`, margin, detailY);
    detailY += 4.5;
  }

  // --- Items Table ---
  const startTableY = Math.max(detailY + 3, dividerY + 22);

  const tableHeaders = showGst
    ? ['#', 'Item Name', 'Qty', 'Unit', 'Rate', 'Dis', 'Taxable', 'GST%', 'GST Amt', 'Total']
    : ['#', 'Item Name', 'Qty', 'Unit', 'Rate', 'Dis', 'Total'];

  const tableBody = (purchase.items || []).map((item: any, index: number) => {
    const qty = Number(item.Qty) || 0;
    const rate = Number(item.Rate) || 0;
    const discount = Number(item.Discount) || 0;
    const taxable = Number(item['Taxable Value'] ?? item.taxable ?? (qty * rate - discount)) || 0;
    const gstPct = Number(item['GST %'] ?? item.gstPct) || 0;
    const gstAmt = Number(item['GST Amount'] ?? item.gstAmt) || 0;
    const lineTotal = Number(item['Line Total'] ?? item.lineTotal ?? (taxable + gstAmt)) || 0;

    let itemDisplayName = item['Item Name'] || item.itemName || 'Item';
    if (item['Serial Numbers']) {
      itemDisplayName += `\nSN: ${item['Serial Numbers']}`;
    }

    if (showGst) {
      return [
        index + 1,
        itemDisplayName,
        qty,
        item.Unit || item.unit || 'pcs',
        rate.toFixed(2),
        discount > 0 ? discount.toFixed(2) : '-',
        taxable.toFixed(2),
        gstPct > 0 ? `${gstPct}%` : '0%',
        gstAmt > 0 ? gstAmt.toFixed(2) : '-',
        lineTotal.toFixed(2)
      ];
    } else {
      return [
        index + 1,
        itemDisplayName,
        qty,
        item.Unit || item.unit || 'pcs',
        rate.toFixed(2),
        discount > 0 ? discount.toFixed(2) : '-',
        lineTotal.toFixed(2)
      ];
    }
  });

  autoTable(doc, {
    startY: startTableY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199], // sky-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2.2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 14, halign: 'right' },
      ...(showGst
        ? {
            6: { cellWidth: 18, halign: 'right' },
            7: { cellWidth: 13, halign: 'center' },
            8: { cellWidth: 16, halign: 'right' },
            9: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
          }
        : {
            6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
          })
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 6;

  // --- Summary Box on Right ---
  const summaryBoxWidth = 80;
  const summaryX = pageWidth - margin - summaryBoxWidth;

  const totalTaxable = Number(purchase.taxable) || 0;
  const totalZeroRated = Number(purchase.zeroRated) || 0;
  const totalGst = Number(purchase.gstAmt) || 0;
  const grandTotal = Number(purchase.total) || 0;

  const summaryData: string[][] = [];
  if (showGst) {
    if (totalTaxable > 0) summaryData.push(['Taxable Value:', `${currency} ${totalTaxable.toFixed(2)}`]);
    if (totalZeroRated > 0) summaryData.push(['Zero Rated / Exempt:', `${currency} ${totalZeroRated.toFixed(2)}`]);
    if (totalGst > 0) summaryData.push(['Total Input GST:', `${currency} ${totalGst.toFixed(2)}`]);
  }

  if (purchase.additionalExpenses && purchase.additionalExpenses.length > 0) {
    purchase.additionalExpenses.forEach((exp: any) => {
      summaryData.push([`Expense (${exp.ledger}):`, `${currency} ${Number(exp.amount).toFixed(2)}`]);
    });
  }

  summaryData.push(['Grand Total:', `${currency} ${grandTotal.toFixed(2)}`]);

  autoTable(doc, {
    startY: finalY,
    margin: { left: summaryX },
    tableWidth: summaryBoxWidth,
    body: summaryData,
    theme: 'plain',
    styles: {
      fontSize: 8.5,
      cellPadding: 1.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: function (data) {
      if (data.row.index === summaryData.length - 1) {
        data.cell.styles.fontSize = 10;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [2, 132, 199];
      }
    }
  });

  // --- Payment Breakdown ---
  const cash = Number(purchase.cash) || 0;
  const b1 = Number(purchase.bank1) || 0;
  const b2 = Number(purchase.bank2) || 0;
  const cr = Number(purchase.credit) || 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Payment Settlement Details:', margin, finalY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  let payY = finalY + 9;

  if (cash > 0) {
    doc.text(`• Cash Paid: ${currency} ${cash.toFixed(2)}`, margin, payY);
    payY += 4;
  }
  if (b1 > 0) {
    const b1Name = purchase.paymentDetails?.bank1Ledger || 'Bank 1';
    doc.text(`• Bank (${b1Name}): ${currency} ${b1.toFixed(2)}`, margin, payY);
    payY += 4;
  }
  if (b2 > 0) {
    const b2Name = purchase.paymentDetails?.bank2Ledger || 'Bank 2';
    doc.text(`• Bank (${b2Name}): ${currency} ${b2.toFixed(2)}`, margin, payY);
    payY += 4;
  }
  if (cr > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`• Credit / Balance Due: ${currency} ${cr.toFixed(2)}`, margin, payY);
  }

  // Footer Signatures
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  addSignatureToPdf(doc, config, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Purchase Record • ${config.CompanyName || 'POS'}`, margin, footerY);
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Generate a professional landscape A4 Voucher Register Report PDF
 */
export function generateVoucherRegisterPDF(
  vouchers: any[],
  config: Config,
  filters?: {
    startDate?: string;
    endDate?: string;
    vType?: string;
    status?: string;
    ledger?: string;
    searchTerm?: string;
  }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const currency = config.CurrencySymbol || 'Nu.';

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'RETAIL STORE', margin, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229);
  doc.text('ACCOUNTING VOUCHER REGISTER', margin, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  const filterParts = [];
  if (filters?.startDate || filters?.endDate) {
    filterParts.push(`Period: ${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`);
  }
  if (filters?.vType && filters.vType !== 'ALL') filterParts.push(`Type: ${filters.vType}`);
  if (filters?.status && filters.status !== 'ALL') filterParts.push(`Status: ${filters.status}`);
  if (filters?.ledger) filterParts.push(`Ledger: ${filters.ledger}`);
  if (filters?.searchTerm) filterParts.push(`Search: "${filters.searchTerm}"`);

  const filterStr = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Transactions';
  doc.text(filterStr, margin, 26);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 26, { align: 'right' });

  // Table Data
  const tableData = vouchers.map(v => {
    const isCancelled = v.status === 'Cancelled';
    const vTypeLabel =
      v.type === 'P'
        ? 'Payment (F5)'
        : v.type === 'R'
        ? 'Receipt (F6)'
        : v.type === 'J'
        ? 'Journal (F7)'
        : v.type === 'C'
        ? 'Contra (F4)'
        : v.type || '-';
    const particulars = v.lines ? `${v.lines.length} Line Split` : v.debitLedger || '-';
    const account = v.lines ? 'Multi-Account' : v.creditLedger || '-';
    const amt = Number(v.totalAmount || v.amount || 0);

    return [
      new Date(v.date).toLocaleDateString('en-GB'),
      v.voucherNo || '-',
      vTypeLabel,
      isCancelled ? 'Cancelled' : 'Active',
      particulars,
      account,
      v.narration || '-',
      `${currency} ${amt.toFixed(2)}`
    ];
  });

  const totalAmount = vouchers.reduce((acc, v) => acc + Number(v.totalAmount || v.amount || 0), 0);
  const activeCount = vouchers.filter(v => v.status !== 'Cancelled').length;
  const cancelledCount = vouchers.filter(v => v.status === 'Cancelled').length;

  autoTable(doc, {
    startY: 29,
    margin: { left: margin, right: margin },
    head: [['Date', 'Voucher No', 'Type', 'Status', 'Debit / Particulars', 'Credit / Account', 'Narration', 'Amount']],
    body: tableData,
    foot: [
      [
        `Total: ${vouchers.length} (${activeCount} Active, ${cancelledCount} Void)`,
        '',
        '',
        '',
        '',
        '',
        'TOTAL REGISTER:',
        `${currency} ${totalAmount.toFixed(2)}`
      ]
    ],
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 24 },
      3: { cellWidth: 20 },
      4: { cellWidth: 48 },
      5: { cellWidth: 48 },
      6: { cellWidth: 'auto' },
      7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalPageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Voucher Register • ${config.CompanyName || 'POS'}`, margin, finalPageHeight - 6);

  return doc;
}

/**
 * Universal Share or Download Helper
 * Uses Web Share API (native share with PDF file on mobile/tablets/compatible OS)
 * Falls back to automatic PDF download.
 */
export async function shareOrDownloadPDF(
  doc: jsPDF,
  filename: string,
  title: string,
  fallbackText?: string
): Promise<{ success: boolean; method: 'shared' | 'downloaded' }> {
  try {
    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        files: [pdfFile],
        title: title,
        text: fallbackText || title
      });
      return { success: true, method: 'shared' };
    } else {
      // Direct PDF download
      doc.save(filename);
      return { success: true, method: 'downloaded' };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: true, method: 'shared' };
    }
    // Fallback: trigger download
    doc.save(filename);
    return { success: true, method: 'downloaded' };
  }
}
