const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

// 1. Add drawVoucherHeader at the top (after imports)
const headerFunc = `
export function drawVoucherHeader(doc: jsPDF, config: Config, title: string, meta: {label: string, value: string}[], margin: number = 14): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let startX = margin;
  let textStartY = 20;
  
  if (config.CompanyLogo) {
    try {
      const imgProps = doc.getImageProperties(config.CompanyLogo);
      const maxLogoHeight = 16;
      const logoWidth = (imgProps.width * maxLogoHeight) / imgProps.height;
      doc.addImage(config.CompanyLogo, startX, 10, logoWidth, maxLogoHeight);
      startX += logoWidth + 5;
      textStartY = 16;
    } catch (e) {
      console.warn('Failed to draw print logo', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(config.CompanyName || 'RETAIL STORE', startX, textStartY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  
  let currentY = textStartY + 5;
  const addr = config.Address || (config as any).CompanyAddress;
  if (addr) {
    doc.text(addr, startX, currentY);
    currentY += 4.5;
  }
  
  const gst = config.CompanyGSTNo || config.CompanyTPNNo || (config as any).GSTIN;
  const showGst = String(config.EnableGST) !== 'false';
  if (showGst && gst) {
    doc.text(\`GSTIN / TPN: \${gst}\`, startX, currentY);
    currentY += 4.5;
  }
  if (config.CompanyPhone) {
    doc.text(\`Phone: \${config.CompanyPhone}\`, startX, currentY);
    currentY += 4.5;
  }

  // Draw Right Side (Title & Meta)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(title, pageWidth - margin, 20, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  let metaY = 26;
  for (const m of meta) {
    if (m.value) {
      doc.text(\`\${m.label}: \${m.value}\`, pageWidth - margin, metaY, { align: 'right' });
      metaY += 4.5;
    }
  }

  const dividerY = Math.max(currentY + 2, metaY + 2, config.CompanyLogo ? 30 : 0, 42);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);
  
  return dividerY;
}
`;

if (!content.includes('export function drawVoucherHeader')) {
  content = content.replace(
    /export function resolveBankDetailsForPrint/,
    headerFunc + '\nexport function resolveBankDetailsForPrint'
  );
}

// Write it back temporarily so we can test the next edits
fs.writeFileSync('src/utils/pdfExport.ts', content);
