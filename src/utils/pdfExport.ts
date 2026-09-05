
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Config, SalesInvoice, PurchaseInvoice, DeliveryNote, Quotation, Voucher } from '../types';
import { getLedgers } from '../services/storageService';

export function resolveBankDetailsForPrint(config: Config): string {
  if (config.PrintBankDetailsOnInvoice === 'false') return '';
  if (config.SelectedBankLedgerForPrint) {
    try {
      const ledgers = getLedgers();
      const bLedger = ledgers.find((l: any) => l['Ledger Name'] === config.SelectedBankLedgerForPrint);
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
        title: title
      });
      return { success: true, method: 'shared' };
    } else {
      doc.save(filename);
      return { success: true, method: 'downloaded' };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: true, method: 'shared' };
    }
    doc.save(filename);
    return { success: true, method: 'downloaded' };
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
  const headerHeight = 31;
  const startY = 10;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startY, headerWidth, headerHeight, 3, 3, 'FD');

  let textCenterX = pageWidth / 2;
  let textStartY = startY + 9.5;

  const logo = config.CompanyLogo || config.ReceiptHeaderImage;
  if (logo) {
    try {
      const imgProps = doc.getImageProperties(logo);
      const maxLogoHeight = headerHeight - 9;
      const logoWidth = (imgProps.width * maxLogoHeight) / imgProps.height;
      doc.addImage(logo, logo.includes('png') ? 'PNG' : 'JPEG', margin + 4, startY + 4.5, logoWidth, maxLogoHeight);
    } catch (e) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(config.CompanyName || 'Store Name', textCenterX, textStartY, { align: 'center' });
  
  const addr = config.Address || (config as any).CompanyAddress || '';
  const gstin = config.CompanyGSTNo || (config as any).GSTIN || '';
  const metaStr = [addr, gstin ? `GSTIN: ${gstin}` : ''].filter(Boolean).join(' • ');
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

  const periodStr = reportType === 'BS' ? `As at: ${toDate}` : `Period: ${fromDate} to ${toDate}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const periodWidth = doc.getTextWidth(periodStr) + 8;
  const periodX = (pageWidth - periodWidth) / 2;
  doc.setFillColor(224, 231, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(periodX, startY + 22.5, periodWidth, 5, 2.5, 2.5, 'FD');
  doc.setTextColor(55, 48, 163);
  doc.text(periodStr, textCenterX, startY + 26, { align: 'center' });

  return startY + headerHeight + 6;
}

export function drawVoucherHeader(doc: jsPDF, config: Config, title: string, meta: {label: string, value: string}[], margin: number = 14): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let startX = margin;
  let textStartY = 16;
  
  const logo = config.CompanyLogo || config.ReceiptHeaderImage;
  if (logo) {
    try {
      const imgProps = doc.getImageProperties(logo);
      const maxLogoHeight = 18;
      const logoWidth = (imgProps.width * maxLogoHeight) / imgProps.height;
      doc.addImage(logo, logo.includes('png') ? 'PNG' : 'JPEG', startX, 10, logoWidth, maxLogoHeight);
      startX += logoWidth + 7;
      textStartY = 15;
    } catch (e) {
      console.warn('Failed to draw print logo', e);
    }
  }

  // Company / Store Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(config.CompanyName || 'RETAIL STORE', startX, textStartY);
  
  // Store Details & Subtitles
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  
  let currentY = textStartY + 4.8;
  const addr = config.Address || (config as any).CompanyAddress;
  if (addr) {
    doc.text(addr, startX, currentY);
    currentY += 4.2;
  }
  
  const gst = config.CompanyGSTNo || config.CompanyTPNNo || (config as any).GSTIN;
  const showGst = String(config.EnableGST) !== 'false';
  if (showGst && gst) {
    doc.text(`GSTIN / TPN: ${gst}`, startX, currentY);
    currentY += 4.2;
  }
  if (config.CompanyPhone) {
    doc.text(`Phone: ${config.CompanyPhone}`, startX, currentY);
    currentY += 4.2;
  }

  // Draw Right Side (Title & Meta)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235); // Vibrant Royal Blue (#2563EB)
  doc.text(title.toUpperCase(), pageWidth - margin, 15, { align: 'right' });
  
  let metaY = 21;
  for (const m of meta) {
    if (m.value) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(m.value, pageWidth - margin, metaY, { align: 'right' });
      
      const valWidth = doc.getTextWidth(m.value);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${m.label}: `, pageWidth - margin - valWidth, metaY, { align: 'right' });
      metaY += 4.5;
    }
  }

  const hasLogo = Boolean(config.CompanyLogo || config.ReceiptHeaderImage);
  const dividerY = Math.max(currentY + 3, metaY + 2, hasLogo ? 32 : 0, 38);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);
  
  return dividerY;
}

export function generateReportPDF(
  reportTitle: string,
  config: Config,
  fromDate: string,
  toDate: string,
  headers: string[],
  rows: string[][],
  totals: string[],
  summaryCards: Array<{ title?: string; label?: string; value: string | number; color?: string }> = [],
  reportType: string = '',
  reportData: any = null,
  depth: 'summary' | 'detailed' | 'super_detailed' = 'detailed'
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const currency = config.CurrencySymbol || 'Nu.';
  const startY = drawReportHeaderBox(doc, config, reportTitle, fromDate, toDate, depth, reportType as any);
  
  let currentY = startY;
  const isFinancialReport = reportType === 'PNL' || reportType === 'BS' || reportType === 'TB';

  const fmt = (val: number) => (Number(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 1. Specialized rendering for Profit & Loss Statement (PNL)
  if (reportType === 'PNL' && reportData?.pnl) {
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

    const filterPnlLedgers = (ledgers: any[], isIncome: boolean) => {
      const mapped = ledgers.map(l => ({ ...l, amount: getPnlAmt(l, isIncome) }));
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
    const totalTradingRight = s + di + cs + (grossProfit < 0 ? Math.abs(grossProfit) : 0);

    // TRADING ACCOUNT Section Header
    doc.setFillColor(224, 231, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(14, currentY, pageWidth - 28, 6.5, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 48, 163);
    doc.text('TRADING ACCOUNT', 18, currentY + 4.5);
    currentY += 8;

    const leftTrading: { label: string; amt: string }[] = [];
    const rightTrading: { label: string; amt: string }[] = [];

    leftTrading.push({ label: 'Opening Stock', amt: fmt(os) });
    leftTrading.push({ label: 'Purchase Accounts', amt: fmt(pur) });
    if (depth !== 'summary') {
      purchLedgers.forEach(l => leftTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
    }
    if (de > 0) {
      leftTrading.push({ label: 'Direct Expenses', amt: fmt(de) });
      if (depth !== 'summary') {
        directExpLedgers.forEach(l => leftTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
      }
    }
    if (grossProfit >= 0) {
      leftTrading.push({ label: 'Gross Profit c/o', amt: fmt(grossProfit) });
    }

    rightTrading.push({ label: 'Sales Accounts', amt: fmt(s) });
    if (depth !== 'summary') {
      salesLedgers.forEach(l => rightTrading.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
    }
    if (di > 0) {
      rightTrading.push({ label: 'Direct Incomes', amt: fmt(di) });
    }
    rightTrading.push({ label: 'Closing Stock Valuation', amt: fmt(cs) });
    if (grossProfit < 0) {
      rightTrading.push({ label: 'Gross Loss c/o', amt: fmt(Math.abs(grossProfit)) });
    }

    const tradingRows: any[][] = [];
    const maxTradingRows = Math.max(leftTrading.length, rightTrading.length);
    for (let i = 0; i < maxTradingRows; i++) {
      const l = leftTrading[i] || { label: '', amt: '' };
      const r = rightTrading[i] || { label: '', amt: '' };
      tradingRows.push([l.label, l.amt, r.label, r.amt]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [ ['P a r t i c u l a r s', `Amount (${currency})`, 'P a r t i c u l a r s', `Amount (${currency})`] ],
      body: tradingRows,
      foot: [ ['TOTAL', fmt(totalTradingLeft), 'TOTAL', fmt(totalTradingRight)] ],
      theme: 'plain',
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5, halign: 'left' },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 63 },
        3: { cellWidth: 28, halign: 'right' }
      },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 1.8 },
      footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.2, lineWidth: { top: 0.5, bottom: 1.5 }, lineColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 1 || data.column.index === 3)) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'body') {
          const row = tradingRows[data.row.index];
          if (!row) return;
          const isLeftSub = (row[0] || '').startsWith('  ');
          const isRightSub = (row[2] || '').startsWith('  ');
          if (data.column.index === 0 || data.column.index === 1) {
            if ((row[0] || '').includes('Gross Profit')) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [22, 101, 52];
            } else if (isLeftSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[0] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 1 && row[1]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
          if (data.column.index === 2 || data.column.index === 3) {
            if ((row[2] || '').includes('Gross Profit')) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [22, 101, 52];
            } else if (isRightSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[2] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 3 && row[3]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const tradingStart = currentY - 8;
    const tradingEnd = (doc as any).lastAutoTable.finalY;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.rect(14, tradingStart, pageWidth - 28, tradingEnd - tradingStart);
    doc.setLineWidth(0.3);
    doc.line(14 + (pageWidth - 28) / 2, tradingStart, 14 + (pageWidth - 28) / 2, tradingEnd);

    currentY = tradingEnd + 6;

    // PROFIT & LOSS ACCOUNT Section Header
    doc.setFillColor(224, 231, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(14, currentY, pageWidth - 28, 6.5, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 48, 163);
    doc.text('PROFIT & LOSS ACCOUNT', 18, currentY + 4.5);
    currentY += 8;

    const leftPnl: { label: string; amt: string }[] = [];
    const rightPnl: { label: string; amt: string }[] = [];

    if (grossProfit < 0) {
      leftPnl.push({ label: 'Gross Loss b/f', amt: fmt(Math.abs(grossProfit)) });
    }
    leftPnl.push({ label: 'Indirect Expenses', amt: fmt(ie) });
    if (depth !== 'summary') {
      indirectExpLedgers.forEach(l => leftPnl.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
    }
    if (netProfit >= 0) {
      leftPnl.push({ label: 'Nett Profit', amt: fmt(netProfit) });
    }

    if (grossProfit >= 0) {
      rightPnl.push({ label: 'Gross Profit b/f', amt: fmt(grossProfit) });
    }
    if (ii > 0) {
      rightPnl.push({ label: 'Indirect Incomes', amt: fmt(ii) });
      if (depth !== 'summary') {
        indirectIncLedgers.forEach(l => rightPnl.push({ label: `  ${l.name}`, amt: fmt(l.amount) }));
      }
    }
    if (netProfit < 0) {
      rightPnl.push({ label: 'Nett Loss', amt: fmt(Math.abs(netProfit)) });
    }

    const pnlRows: any[][] = [];
    const maxPnlRows = Math.max(leftPnl.length, rightPnl.length);
    for (let i = 0; i < maxPnlRows; i++) {
      const l = leftPnl[i] || { label: '', amt: '' };
      const r = rightPnl[i] || { label: '', amt: '' };
      pnlRows.push([l.label, l.amt, r.label, r.amt]);
    }

    const totalPnlLeft = ie + (grossProfit < 0 ? Math.abs(grossProfit) : 0) + Math.max(0, netProfit);
    const totalPnlRight = Math.max(0, grossProfit) + ii + (netProfit < 0 ? Math.abs(netProfit) : 0);

    autoTable(doc, {
      startY: currentY,
      head: [ ['P a r t i c u l a r s', `Amount (${currency})`, 'P a r t i c u l a r s', `Amount (${currency})`] ],
      body: pnlRows,
      foot: [ ['TOTAL', fmt(totalPnlLeft), 'TOTAL', fmt(totalPnlRight)] ],
      theme: 'plain',
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5, halign: 'left' },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 63 },
        3: { cellWidth: 28, halign: 'right' }
      },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 1.8 },
      footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.2, lineWidth: { top: 0.5, bottom: 1.5 }, lineColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 1 || data.column.index === 3)) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'body') {
          const row = pnlRows[data.row.index];
          if (!row) return;
          const isLeftSub = (row[0] || '').startsWith('  ');
          const isRightSub = (row[2] || '').startsWith('  ');
          if (data.column.index === 0 || data.column.index === 1) {
            if ((row[0] || '').includes('Nett Profit')) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [22, 101, 52];
            } else if (isLeftSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[0] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 1 && row[1]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
          if (data.column.index === 2 || data.column.index === 3) {
            if ((row[2] || '').includes('Nett Profit')) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [22, 101, 52];
            } else if (isRightSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[2] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 3 && row[3]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const pnlStart = currentY - 8;
    const pnlEnd = (doc as any).lastAutoTable.finalY;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.rect(14, pnlStart, pageWidth - 28, pnlEnd - pnlStart);
    doc.setLineWidth(0.3);
    doc.line(14 + (pageWidth - 28) / 2, pnlStart, 14 + (pageWidth - 28) / 2, pnlEnd);

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 60, finalY + 22, pageWidth - 14, finalY + 22);
    doc.text('Authorized Signatory', pageWidth - 37, finalY + 26, { align: 'center' });

    return doc;
  }

  // 2. Specialized rendering for Balance Sheet (BS)
  if (reportType === 'BS' && reportData?.bs && reportData?.pnl) {
    const p = reportData.pnl;
    const netProfit = (Number(p.s) || 0) + (Number(p.di) || 0) - ((Number(p.os) || 0) + (Number(p.p) || 0) + (Number(p.de) || 0) - (Number(p.cs) || 0)) + (Number(p.ii) || 0) - (Number(p.ie) || 0);

    const cap = Number(reportData.bs.cap) || 0;
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

    const totalLiab = cap + netProfit + loans + cl;
    const totalAssets = fa + ca + stockVal;

    const leftBs: { label: string; amt: string }[] = [];
    const rightBs: { label: string; amt: string }[] = [];

    leftBs.push({ label: 'Capital Account', amt: fmt(cap) });
    if (depth !== 'summary') {
      capitalLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));
    }
    leftBs.push({ label: '  Add: Nett Profit / (Loss)', amt: fmt(netProfit) });

    if (loans > 0) {
      leftBs.push({ label: 'Loans (Liability)', amt: fmt(loans) });
      if (depth !== 'summary') {
        loanLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));
      }
    }

    leftBs.push({ label: 'Current Liabilities & Payables', amt: fmt(cl) });
    if (depth !== 'summary') {
      currentLiabLedgers.forEach(l => leftBs.push({ label: `  ${l.name}`, amt: fmt(l.cr || l.dr) }));
    }

    rightBs.push({ label: 'Fixed Assets', amt: fmt(fa) });
    if (depth !== 'summary') {
      fixedAssetLedgers.forEach(l => rightBs.push({ label: `  ${l.name}`, amt: fmt(l.dr || l.cr) }));
    }

    rightBs.push({ label: 'Current Assets', amt: fmt(ca) });
    if (depth !== 'summary') {
      currentAssetLedgers.forEach(l => rightBs.push({ label: `  ${l.name}`, amt: fmt(l.dr || l.cr) }));
    }

    rightBs.push({ label: 'Closing Stock Valuation', amt: fmt(stockVal) });

    const bsRows: any[][] = [];
    const maxBsRows = Math.max(leftBs.length, rightBs.length);
    for (let i = 0; i < maxBsRows; i++) {
      const l = leftBs[i] || { label: '', amt: '' };
      const r = rightBs[i] || { label: '', amt: '' };
      bsRows.push([l.label, l.amt, r.label, r.amt]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [ ['L I A B I L I T I E S', `Amount (${currency})`, 'A S S E T S', `Amount (${currency})`] ],
      body: bsRows,
      foot: [ ['TOTAL LIABILITIES', fmt(totalLiab), 'TOTAL ASSETS', fmt(totalAssets)] ],
      theme: 'plain',
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5, halign: 'left' },
      columnStyles: {
        0: { cellWidth: 63 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 63 },
        3: { cellWidth: 28, halign: 'right' }
      },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 1.8 },
      footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.2, lineWidth: { top: 0.5, bottom: 1.5 }, lineColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 1 || data.column.index === 3)) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'body') {
          const row = bsRows[data.row.index];
          if (!row) return;
          const isLeftSub = (row[0] || '').startsWith('  ');
          const isRightSub = (row[2] || '').startsWith('  ');
          if (data.column.index === 0 || data.column.index === 1) {
            if ((row[0] || '').includes('Nett Profit')) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [22, 101, 52];
            } else if (isLeftSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[0] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 1 && row[1]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
          if (data.column.index === 2 || data.column.index === 3) {
            if (isRightSub) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.textColor = [51, 65, 85];
            } else if ((row[2] || '').trim().length > 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              if (data.column.index === 3 && row[3]) {
                data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
                data.cell.styles.lineColor = [100, 116, 139];
              }
            }
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const bsStart = currentY - 8;
    const bsEnd = (doc as any).lastAutoTable.finalY;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.rect(14, bsStart, pageWidth - 28, bsEnd - bsStart);
    doc.setLineWidth(0.3);
    doc.line(14 + (pageWidth - 28) / 2, bsStart, 14 + (pageWidth - 28) / 2, bsEnd);

    const finalY = bsEnd || currentY + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 60, finalY + 22, pageWidth - 14, finalY + 22);
    doc.text('Authorized Signatory', pageWidth - 37, finalY + 26, { align: 'center' });

    return doc;
  }

  // 3. Specialized rendering for Trial Balance (TB)
  if (reportType === 'TB' && reportData?.tb) {
    const rawTb: any[] = reportData.tb;
    const primaryGroupOrder = [
      'Capital Account', 'Loans (Liability)', 'Current Liabilities',
      'Fixed Assets', 'Investments', 'Current Assets', 'Branch / Divisions',
      'Sales Accounts', 'Direct Incomes', 'Indirect Incomes',
      'Purchase Accounts', 'Direct Expenses', 'Indirect Expenses'
    ];

    const grouped: Record<string, { name: string; dr: number; cr: number; ledgers: any[] }> = {};
    let totalDr = 0;
    let totalCr = 0;

    rawTb.forEach(l => {
      const grp = l.grp || 'Other Accounts';
      if (!grouped[grp]) {
        grouped[grp] = { name: grp, dr: 0, cr: 0, ledgers: [] };
      }
      const dr = Number(l.dr) || 0;
      const cr = Number(l.cr) || 0;
      grouped[grp].dr += dr;
      grouped[grp].cr += cr;
      grouped[grp].ledgers.push(l);
      totalDr += dr;
      totalCr += cr;
    });

    const groupKeys = Object.keys(grouped).sort((a, b) => {
      const idxA = primaryGroupOrder.indexOf(a);
      const idxB = primaryGroupOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const tbRows: any[][] = [];
    const isGroupRowIndex: boolean[] = [];

    groupKeys.forEach(grpKey => {
      const g = grouped[grpKey];
      const net = g.dr - g.cr;
      const isDr = net >= 0;
      const absVal = Math.abs(net);

      // Group Header Row
      isGroupRowIndex[tbRows.length] = true;
      tbRows.push([g.name, isDr && absVal > 0 ? fmt(absVal) : '', !isDr && absVal > 0 ? fmt(absVal) : '']);

      if (depth !== 'summary') {
        g.ledgers.forEach(l => {
          const lNet = (Number(l.dr) || 0) - (Number(l.cr) || 0);
          const lIsDr = lNet >= 0;
          const lAbs = Math.abs(lNet);
          isGroupRowIndex[tbRows.length] = false;
          tbRows.push([`    ${l.name}`, lIsDr && lAbs > 0 ? fmt(lAbs) : '', !lIsDr && lAbs > 0 ? fmt(lAbs) : '']);
        });
      }
    });

    autoTable(doc, {
      startY: currentY,
      head: [ ['P a r t i c u l a r s', `Closing Debit (${currency})`, `Closing Credit (${currency})`] ],
      body: tbRows,
      foot: [ ['CARRIED OVER / GRAND TOTAL', fmt(totalDr), fmt(totalCr)] ],
      theme: 'plain',
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5, halign: 'left' },
      columnStyles: {
        0: { cellWidth: 102 },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 40, halign: 'right' }
      },
      bodyStyles: { fontSize: 8, textColor: [15, 23, 42], cellPadding: 1.8 },
      footStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.2, lineWidth: { top: 0.5, bottom: 1.5 }, lineColor: [15, 23, 42] },
      didParseCell: (data) => {
        if (data.section === 'head' && (data.column.index === 1 || data.column.index === 2)) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'body') {
          const isGrp = isGroupRowIndex[data.row.index];
          if (isGrp) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontSize = 8.5;
            if (data.column.index > 0 && data.cell.text && data.cell.text[0]) {
              data.cell.styles.lineWidth = { top: 0.2, bottom: 0.2 };
              data.cell.styles.lineColor = [100, 116, 139];
            }
          } else {
            data.cell.styles.fontStyle = 'italic';
            data.cell.styles.textColor = [51, 65, 85];
            data.cell.styles.fontSize = 8;
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 60, finalY + 22, pageWidth - 14, finalY + 22);
    doc.text('Authorized Signatory', pageWidth - 37, finalY + 26, { align: 'center' });

    return doc;
  }

  // Fallback for generic non-financial reports
  const headData = [headers];
  const footData = totals && totals.length > 0 ? [totals] : [];

  autoTable(doc, {
    startY: currentY,
    head: headData,
    body: rows,
    foot: footData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, cellPadding: 2.5 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    footStyles: { fillColor: [239, 246, 255], textColor: [30, 58, 138], fontStyle: 'bold', fontSize: 8 },
    styles: { cellPadding: 2 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - 60, finalY + 22, pageWidth - 14, finalY + 22);
  doc.text('Authorized Signatory', pageWidth - 37, finalY + 26, { align: 'center' });

  return doc;
}

export function drawTotalSummaryBox(doc: jsPDF, label: string, amountStr: string, finalY: number, margin: number, pageWidth: number): number {
  const boxW = 80;
  const boxX = pageWidth - margin - boxW;
  
  doc.setFillColor(239, 246, 255); // Soft blue tint fill (#EFF6FF)
  doc.setDrawColor(191, 219, 254); // Soft blue border (#BFDBFE)
  doc.roundedRect(boxX, finalY, boxW, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138); // Deep royal blue label
  doc.text(label, boxX + 4, finalY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(29, 78, 216); // Vibrant royal blue amount
  doc.text(amountStr, boxX + boxW - 4, finalY + 7, { align: 'right' });

  return finalY + 15;
}

export function extractInvoiceTotals(invoice: any) {
  let taxable = Number(invoice.taxable ?? invoice.taxableAmount ?? invoice.taxableValue);
  let zeroRated = Number(invoice.zeroRated ?? invoice.exempted ?? invoice.zeroRatedAmount);
  let gstAmt = Number(invoice.gstAmt ?? invoice.gstAmount ?? invoice.taxAmount ?? invoice.totalGst);
  let total = Number(invoice.total ?? invoice.totalAmount ?? invoice.invoiceAmount ?? invoice.netAmount ?? invoice.amount ?? 0);
  let discount = Number(invoice.discount ?? invoice.billDiscount ?? 0);

  const items = Array.isArray(invoice.items) ? invoice.items : [];

  if (isNaN(taxable) || isNaN(zeroRated) || isNaN(gstAmt) || (!taxable && !zeroRated && items.length > 0)) {
    let calcTaxable = 0;
    let calcZero = 0;
    let calcGst = 0;
    const isCustomerExempt = Boolean(invoice.customer?.isGSTExempted);

    items.forEach((it: any) => {
      const qty = Number(it.qty ?? it.Qty ?? 0);
      const rate = Number(it.rate ?? it.Rate ?? 0);
      const rawDisc = Number(it.discount ?? it.Discount ?? 0);
      const isPercent = it.discountType === 'percent';
      const discVal = isPercent ? (qty * rate * rawDisc / 100) : rawDisc;
      const gr = (qty * rate) - discVal;

      const isZ = isCustomerExempt || it['Zero Rated (Y/N)'] === 'Y' || it.zeroRated === 'Y' || it.zeroRated === true;
      const gstPct = isZ ? 0 : Number(it['GST %'] ?? it.gstPct ?? it.taxRate ?? 0);
      const lineGst = isZ ? 0 : (gr * gstPct / 100);

      if (isZ) {
        calcZero += gr;
      } else {
        calcTaxable += gr;
      }
      calcGst += lineGst;
    });

    if (isNaN(taxable) || (!taxable && calcTaxable > 0)) taxable = calcTaxable;
    if (isNaN(zeroRated) || (!zeroRated && calcZero > 0)) zeroRated = calcZero;
    if (isNaN(gstAmt) || (!gstAmt && calcGst > 0)) gstAmt = calcGst;
  }

  taxable = isNaN(taxable) ? 0 : taxable;
  zeroRated = isNaN(zeroRated) ? 0 : zeroRated;
  gstAmt = isNaN(gstAmt) ? 0 : gstAmt;

  if (!total) {
    total = taxable + zeroRated + gstAmt - discount;
  }

  return {
    taxable: Math.max(0, taxable),
    zeroRated: Math.max(0, zeroRated),
    gstAmt: Math.max(0, gstAmt),
    discount: Math.max(0, discount),
    total: Math.max(0, total)
  };
}

export function drawDetailedBillSummaryBox(
  doc: jsPDF,
  invoice: any,
  finalY: number,
  currency: string,
  margin: number,
  pageWidth: number,
  totalLabel: string = 'Total Invoice Amount:'
): number {
  const totals = extractInvoiceTotals(invoice);
  const boxW = 92;
  const boxX = pageWidth - margin - boxW;

  const rows: { label: string; value: string; isBold?: boolean; isHighlight?: boolean }[] = [
    { label: 'Taxable Amount:', value: `${currency} ${totals.taxable.toFixed(2)}` },
    { label: 'Exempted / Zero Rated Sale:', value: `${currency} ${totals.zeroRated.toFixed(2)}` },
    { label: 'GST Amount:', value: `${currency} ${totals.gstAmt.toFixed(2)}` },
  ];

  if (totals.discount > 0) {
    rows.push({ label: 'Discount:', value: `-${currency} ${totals.discount.toFixed(2)}` });
  }

  rows.push({
    label: totalLabel,
    value: `${currency} ${totals.total.toFixed(2)}`,
    isBold: true,
    isHighlight: true
  });

  const rowHeight = 6;
  const paddingY = 4;
  const totalBoxHeight = rows.length * rowHeight + paddingY * 2;

  // Background Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, finalY, boxW, totalBoxHeight, 2, 2, 'FD');

  let currentY = finalY + paddingY + 4;

  rows.forEach(r => {
    if (r.isHighlight) {
      const hY = currentY - 4.5;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.roundedRect(boxX + 2, hY, boxW - 4, 8, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 58, 138);
      doc.text(r.label, boxX + 5, currentY + 0.8);

      doc.setFontSize(10.5);
      doc.setTextColor(29, 78, 216);
      doc.text(r.value, boxX + boxW - 5, currentY + 0.8, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(r.label, boxX + 5, currentY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(r.value, boxX + boxW - 5, currentY, { align: 'right' });
    }

    currentY += rowHeight;
  });

  return finalY + totalBoxHeight + 5;
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
  
  const entityY = dividerY + 5;
  let startTableY = dividerY + 5;

  if (entityTitle || entityName || entityDetails.length > 0) {
    const detailLines = entityDetails.filter(Boolean);
    const lineCount = (entityName ? 1 : 0) + detailLines.length;
    const boxHeight = Math.max(14, 7 + lineCount * 4.2);
    
    // Clean card container for BILL TO with left royal blue accent line
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, entityY, 95, boxHeight, 2, 2, 'FD');

    // Accent line
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin, entityY, 2.5, boxHeight, 1, 1, 'F');

    let currY = entityY + 4.5;
    if (entityTitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235);
      doc.text(entityTitle.toUpperCase(), margin + 5, currY);
      currY += 4.5;
    }

    if (entityName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(entityName, margin + 5, currY);
      currY += 4.2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    detailLines.forEach(d => {
      doc.text(d, margin + 5, currY);
      currY += 4.2;
    });

    startTableY = entityY + boxHeight + 6;
  }

  const safeItems = Array.isArray(items) ? items : [];

  autoTable(doc, {
    startY: startTableY,
    head: [columns.map(c => c.header)],
    body: safeItems.map((item, index) => columns.map(c => c.getValue(item, index))),
    theme: 'grid',
    headStyles: { 
      fillColor: [37, 99, 235], // Vibrant Royal Blue Header
      textColor: [255, 255, 255], 
      fontStyle: 'bold', 
      fontSize: 8.5, 
      cellPadding: 2.5 
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2 },
    alternateRowStyles: { fillColor: [240, 245, 255] }, // Light blue row shade background
    columnStyles: columns.reduce((acc: any, col, i) => {
      acc[i] = { halign: col.align || 'left' };
      if (col.width) acc[i].cellWidth = col.width;
      return acc;
    }, {})
  });

  let finalY = (doc as any).lastAutoTable.finalY + 5;
  
  finalY = summaryBlock(doc, finalY, currency, margin, pageWidth);

  const remarksFields = [voucher.narration, voucher.remarks, voucher.paymentTerms, voucher.deliveryTerms, voucher.terms].filter(Boolean);
  if (remarksFields.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Notes / Remarks:', margin, finalY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(remarksFields.join('\n'), pageWidth - margin * 2);
    doc.text(splitNotes, margin, finalY + 9);
  }

  const footerY = pageHeight - 14;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  addSignatureToPdf(doc, config, pageWidth - margin, footerY);
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`${title} • ${config.CompanyName || 'POS'}`, margin, footerY);
  doc.text(config.SignatoryTitle || 'Authorized Signatory', pageWidth - margin, footerY, { align: 'right' });
  
  return doc;
}

export function generateInvoicePDF(invoice: SalesInvoice | any, config: Config, options?: any): jsPDF {
  const meta = [
    { label: 'Invoice No', value: invoice.invoiceNo || invoice.billNo || 'INV' },
    { label: 'Date', value: invoice.date ? new Date(invoice.date).toLocaleDateString() : new Date().toLocaleDateString() },
    { label: 'Time', value: invoice.date ? new Date(invoice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '' }
  ];
  const entName = typeof invoice.customer === 'object'
    ? (invoice.customer?.name || invoice.customer?.ledger || 'Walk-in Customer')
    : (invoice.customer || 'Walk-in Customer');
  const entDetails = [
    (typeof invoice.customer === 'object' && invoice.customer?.phone) ? `Contact: ${invoice.customer.phone}` : '',
    (typeof invoice.customer === 'object' && invoice.customer?.address) ? `Address: ${invoice.customer.address}` : '',
    (typeof invoice.customer === 'object' && invoice.customer?.gstNo) ? `GSTIN: ${invoice.customer.gstNo}` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 10, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || it.description || '' },
    { header: 'Qty', align: 'center', width: 18, getValue: (it:any) => `${it.qty ?? it.Qty ?? ''} ${it.unit || it.Unit || ''}`.trim() },
    { header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2) },
    { header: 'Tax %', align: 'right', width: 15, getValue: (it:any) => (it.taxRate ?? it['GST %'] ?? it.gstPct) ? `${it.taxRate ?? it['GST %'] ?? it.gstPct}%` : '-' },
    { header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.lineTotal ?? 0).toFixed(2) }
  ];

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return buildGenericVoucherPdf(invoice, config, 'TAX INVOICE', meta, 'BILL TO:', entName, entDetails, items, cols, (doc, finalY, curr, margin, pw) => {
    const endY = drawDetailedBillSummaryBox(doc, invoice, finalY, curr, margin, pw, 'Total Invoice Amount:');
    
    // Bank details
    const bDetails = options?.customBankDetails || resolveBankDetailsForPrint(config);
    if (bDetails) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Bank Details:', margin, finalY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const splitB = doc.splitTextToSize(bDetails, pw / 2 - 10);
      doc.text(splitB, margin, finalY + 8);
    }
    
    return endY + 2;
  });
}

export function generatePurchaseBillPDF(purchase: PurchaseInvoice | any, config: Config): jsPDF {
  const meta = [
    { label: 'Bill No', value: purchase.billNo },
    { label: 'Date', value: new Date(purchase.date).toLocaleDateString() },
    { label: 'Supplier Ref', value: purchase.supplierInvoiceNo || '' }
  ];
  const supp = purchase.supplier || {};
  const entName = typeof supp === 'object' ? (supp.name || supp.ledger || 'Vendor') : supp;
  const entDetails = [
    supp.phone ? `Contact: ${supp.phone}` : '',
    supp.address ? `Address: ${supp.address}` : '',
    supp.gstNo ? `GSTIN: ${supp.gstNo}` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 10, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || '' },
    { header: 'Qty', align: 'center', width: 18, getValue: (it:any) => `${it.qty ?? it.Qty ?? ''} ${it.unit || it.Unit || ''}`.trim() },
    { header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2) },
    { header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.lineTotal ?? 0).toFixed(2) }
  ];

  return buildGenericVoucherPdf(purchase, config, 'PURCHASE BILL', meta, 'SUPPLIER (VENDOR):', entName, entDetails, purchase.items, cols, (doc, finalY, curr, margin, pw) => {
    return drawDetailedBillSummaryBox(doc, purchase, finalY, curr, margin, pw, 'Total Bill Amount:');
  });
}

export function generateQuotationPDF(quote: Quotation | any, config: Config): jsPDF {
  const meta = [
    { label: 'Quote No', value: quote.quotationNo || quote.quoteNo || '' },
    { label: 'Date', value: quote.date ? new Date(quote.date).toLocaleDateString() : new Date().toLocaleDateString() },
    { label: 'Valid Until', value: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '' }
  ];
  const cust = quote.customer || {};
  const entName = typeof cust === 'object' ? (cust.name || cust.ledger || 'Customer') : (cust || 'Customer');
  const entDetails = [
    (typeof cust === 'object' && cust.address) ? `Address: ${cust.address}` : '',
    (typeof cust === 'object' && (cust.gstNo || cust.tpnNo)) ? `GSTIN: ${cust.gstNo || cust.tpnNo}` : '',
    (typeof cust === 'object' && cust.phone) ? `Contact: ${cust.phone}` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 10, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || it.description || '' },
    { header: 'Qty', align: 'center', width: 18, getValue: (it:any) => `${it.qty ?? it.Qty ?? it.systemQty ?? ''} ${it.unit || it.Unit || ''}`.trim() },
    { header: 'Rate', align: 'right', width: 22, getValue: (it:any) => Number(it.rate ?? it.Rate ?? 0).toFixed(2) },
    { header: 'Amount', align: 'right', width: 28, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.taxableValue ?? it.lineTotal ?? 0).toFixed(2) }
  ];

  const items = Array.isArray(quote.items) ? quote.items : [];
  return buildGenericVoucherPdf(quote, config, 'QUOTATION', meta, 'QUOTATION TO:', entName, entDetails, items, cols, (doc, finalY, curr, margin, pw) => {
    return drawDetailedBillSummaryBox(doc, quote, finalY, curr, margin, pw, 'Total Quotation Amount:');
  });
}

export function generateDeliveryNotePDF(note: DeliveryNote | any, config: Config): jsPDF {
  const meta = [
    { label: 'Note No', value: note.noteNo || '' },
    { label: 'Date', value: note.date ? new Date(note.date).toLocaleDateString() : new Date().toLocaleDateString() },
    { label: 'Order Ref', value: note.orderRefNo || '' }
  ];
  const cust = note.customer || {};
  const entName = typeof cust === 'object' ? (cust.name || cust.ledger || 'Customer') : (cust || 'Customer');
  const entDetails = [
    (typeof cust === 'object' && cust.address) ? `Destination / Address: ${cust.address}` : '',
    note.dispatchThrough ? `Dispatch: ${note.dispatchThrough}` : '',
    note.vehicleNo ? `Vehicle: ${note.vehicleNo}` : ''
  ];
  
  const cols = [
    { header: 'Sl', align: 'center', width: 12, getValue: (_:any, i:number) => i + 1 },
    { header: 'Item Description', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || it.description || '' },
    { header: 'Quantity Delivered', align: 'center', width: 35, getValue: (it:any) => `${it.qty ?? it.Qty ?? it.systemQty ?? ''} ${it.unit || it.Unit || ''}`.trim() }
  ];

  const items = Array.isArray(note.items) ? note.items : [];
  return buildGenericVoucherPdf(note, config, 'DELIVERY CHALLAN', meta, 'DELIVER TO:', entName, entDetails, items, cols, (doc, finalY) => {
    return finalY + 5;
  });
}

export function generateVoucherSlipPDF(voucher: any, config: Config): jsPDF {
  const vType = voucher.type || (voucher.voucherNo?.startsWith('PV-') ? 'P' : voucher.voucherNo?.startsWith('RV-') ? 'R' : voucher.voucherNo?.startsWith('CV-') ? 'C' : voucher.voucherNo?.startsWith('JV-') ? 'J' : 'P');
  const typeMap: Record<string, string> = {
    P: 'PAYMENT',
    R: 'RECEIPT',
    C: 'CONTRA',
    J: 'JOURNAL',
    CN: 'CREDIT NOTE',
    DN: 'DEBIT NOTE',
    QUOTATION: 'QUOTATION',
    DEL_NOTE: 'DELIVERY CHALLAN',
    PHYSICAL_STOCK: 'PHYSICAL STOCK'
  };
  const title = (typeMap[vType] || 'ACCOUNTING') + ' VOUCHER';

  const meta = [
    { label: 'Voucher No', value: voucher.voucherNo || voucher.no || 'VOUCHER' },
    { label: 'Date', value: voucher.date ? new Date(voucher.date).toLocaleDateString() : new Date().toLocaleDateString() }
  ];
  
  const entName = voucher.partyLedger || (vType === 'P' || vType === 'C' ? voucher.creditLedger : voucher.debitLedger) || voucher.fromAccount || 'Primary Account';
  
  let items = Array.isArray(voucher.lines) && voucher.lines.length > 0 ? voucher.lines : [];
  if (items.length === 0) {
    const oppLedger = voucher.partyLedger || (vType === 'P' || vType === 'C' ? voucher.debitLedger : voucher.creditLedger) || voucher.toAccount || 'General Account';
    const oppType = vType === 'P' || vType === 'C' ? 'Dr' : 'Cr';
    items = [{ account: oppLedger, amount: voucher.amount || voucher.totalAmount || voucher.total || 0, type: oppType }];
  }
  
  const cols = [
    { header: 'Sl', align: 'center', width: 12, getValue: (_:any, i:number) => i + 1 },
    { header: 'Particulars / Account', align: 'left', getValue: (it:any) => it.ledger || it.account || it.particulars || 'Account' },
    { header: 'Type', align: 'center', width: 15, getValue: (it:any) => it.type || (it.debit ? 'Dr' : 'Cr') },
    { header: 'Amount', align: 'right', width: 35, getValue: (it:any) => Number(it.amount ?? it.debit ?? it.credit ?? 0).toFixed(2) }
  ];

  return buildGenericVoucherPdf(voucher, config, title, meta, 'PRIMARY ACCOUNT:', entName, [], items, cols, (doc, finalY, curr, margin, pw) => {
    const tAmt = voucher.totalAmount ?? voucher.amount ?? voucher.total ?? 0;
    return drawTotalSummaryBox(doc, 'Total Amount:', `${curr} ${Number(tAmt).toFixed(2)}`, finalY, margin, pw);
  });
}

export function generateCreditNotePDF(note: any, config: Config): jsPDF {
  const cust = note.customer || {};
  const entName = typeof cust === 'object' ? (cust.name || cust.ledger || 'Customer') : (cust || 'Customer');
  const items = Array.isArray(note.items) ? note.items : [];
  return buildGenericVoucherPdf(
    note,
    config,
    'CREDIT NOTE',
    [{ label: 'Note No', value: note.noteNo || '' }, { label: 'Date', value: note.date ? new Date(note.date).toLocaleDateString() : new Date().toLocaleDateString() }],
    'ISSUED TO:',
    entName,
    [],
    items, 
    [
      { header: 'Item', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || '' },
      { header: 'Qty', align: 'center', width: 20, getValue: (it:any) => it.qty ?? it.Qty ?? '' },
      { header: 'Amount', align: 'right', width: 30, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.taxableValue ?? 0).toFixed(2) }
    ], 
    (doc, finalY, curr, margin, pw) => {
      return drawDetailedBillSummaryBox(doc, note, finalY, curr, margin, pw, 'Total Credit Amount:');
    }
  );
}

export function generateDebitNotePDF(note: any, config: Config): jsPDF {
  const supp = note.supplier || {};
  const entName = typeof supp === 'object' ? (supp.name || supp.ledger || 'Supplier') : (supp || 'Supplier');
  const items = Array.isArray(note.items) ? note.items : [];
  return buildGenericVoucherPdf(
    note,
    config,
    'DEBIT NOTE',
    [{ label: 'Note No', value: note.noteNo || '' }, { label: 'Date', value: note.date ? new Date(note.date).toLocaleDateString() : new Date().toLocaleDateString() }],
    'ISSUED TO:',
    entName,
    [],
    items, 
    [
      { header: 'Item', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || '' },
      { header: 'Qty', align: 'center', width: 20, getValue: (it:any) => it.qty ?? it.Qty ?? '' },
      { header: 'Amount', align: 'right', width: 30, getValue: (it:any) => Number(it.amount ?? it['Line Total'] ?? it.taxableValue ?? 0).toFixed(2) }
    ], 
    (doc, finalY, curr, margin, pw) => {
      return drawDetailedBillSummaryBox(doc, note, finalY, curr, margin, pw, 'Total Debit Amount:');
    }
  );
}

export function generatePhysicalStockPDF(voucher: any, config: Config): jsPDF {
  const items = Array.isArray(voucher.items) ? voucher.items : [];
  return buildGenericVoucherPdf(
    voucher,
    config,
    'PHYSICAL STOCK VOUCHER',
    [{ label: 'Voucher No', value: voucher.voucherNo || '' }, { label: 'Date', value: voucher.date ? new Date(voucher.date).toLocaleDateString() : new Date().toLocaleDateString() }],
    'LOCATION / REMARKS:',
    voucher.remarks || 'Main Location',
    [],
    items, 
    [
      { header: 'Item Code', align: 'left', width: 30, getValue: (it:any) => it.itemCode || '' },
      { header: 'Item Name', align: 'left', getValue: (it:any) => it.itemName || it['Item Name'] || it.itemDescription || it['Item Description'] || '' },
      { header: 'System Qty', align: 'center', width: 25, getValue: (it:any) => it.systemQty ?? '' },
      { header: 'Physical Qty', align: 'center', width: 25, getValue: (it:any) => it.physicalQty ?? '' },
      { header: 'Diff', align: 'center', width: 20, getValue: (it:any) => it.difference ?? '' }
    ], 
    (doc, finalY) => finalY + 5
  );
}

export function generateVoucherRegisterPDF(
  vouchers: any[],
  config: Config,
  filters?: { startDate?: string; endDate?: string; vType?: string; status?: string; ledger?: string; searchTerm?: string; }
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const currency = config.CurrencySymbol || 'Nu.';

  const dividerY = drawVoucherHeader(doc, config, 'ACCOUNTING VOUCHER REGISTER', [
    { label: 'Generated', value: new Date().toLocaleString() }
  ]);

  const filterParts = [];
  if (filters?.startDate || filters?.endDate) filterParts.push(`Period: ${filters.startDate || 'Beginning'} to ${filters.endDate || 'Present'}`);
  if (filters?.vType && filters.vType !== 'ALL') filterParts.push(`Type: ${filters.vType}`);
  if (filters?.status && filters.status !== 'ALL') filterParts.push(`Status: ${filters.status}`);
  if (filters?.ledger) filterParts.push(`Ledger: ${filters.ledger}`);
  if (filters?.searchTerm) filterParts.push(`Search: "${filters.searchTerm}"`);
  const filterStr = filterParts.length > 0 ? filterParts.join('  |  ') : 'All Transactions';
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(filterStr, margin, dividerY + 5);

  const tableData = vouchers.map(v => {
    const isCancelled = v.status === 'Cancelled';
    const vTypeLabel = v.type === 'P' ? 'Payment (F5)' : v.type === 'R' ? 'Receipt (F6)' : v.type === 'J' ? 'Journal (F7)' : v.type === 'C' ? 'Contra (F4)' : v.type || '-';
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
    startY: dividerY + 8,
    margin: { left: margin, right: margin },
    head: [['Date', 'Voucher No', 'Type', 'Status', 'Debit / Particulars', 'Credit / Account', 'Narration', 'Amount']],
    body: tableData,
    foot: [
      [`Total: ${vouchers.length} (${activeCount} Active, ${cancelledCount} Void)`, '', '', '', '', '', 'TOTAL REGISTER:', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 28, fontStyle: 'bold' }, 2: { cellWidth: 24 },
      3: { cellWidth: 20 }, 4: { cellWidth: 48 }, 5: { cellWidth: 48 },
      6: { cellWidth: 'auto' }, 7: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
    }
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Voucher Register • ${config.CompanyName || 'POS'}`, margin, pageHeight - 6);
  return doc;
}
