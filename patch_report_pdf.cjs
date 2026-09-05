const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

const regex = /export function generateReportPDF[\s\S]*?return doc;\n\}/;

const newFunc = `export function generateReportPDF(
  reportTitle: string,
  config: Config,
  fromDate: string,
  toDate: string,
  headers: string[],
  rows: string[][],
  totals: string[],
  summaryCards: {title: string, value: string}[] = [],
  reportType: string = '',
  reportData: any = null,
  depth: 'summary' | 'detailed' | 'super_detailed' = 'detailed'
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = drawReportHeaderBox(doc, config, reportTitle, fromDate, toDate, depth, reportType as any);
  
  let currentY = startY;

  // Add summary cards if present
  if (summaryCards && summaryCards.length > 0) {
    const cardWidth = 45;
    let cardX = 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    summaryCards.forEach(card => {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cardX, currentY, cardWidth, 14, 2, 2, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.text(card.title, cardX + 4, currentY + 5);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(card.value, cardX + 4, currentY + 11);
      
      doc.setFont('helvetica', 'normal');
      cardX += cardWidth + 5;
    });
    currentY += 18;
  }

  const headData = [headers];
  const footData = totals && totals.length > 0 ? [totals] : [];

  autoTable(doc, {
    startY: currentY,
    head: headData,
    body: rows,
    foot: footData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
    styles: { cellPadding: 2 }
  });

  return doc;
}`;

content = content.replace(regex, newFunc);
fs.writeFileSync('src/utils/pdfExport.ts', content);
