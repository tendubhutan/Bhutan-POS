const fs = require('fs');

let content = fs.readFileSync('src/utils/pdfExport.ts', 'utf8');

// Fix generateReportPDF signature
content = content.replace(
  /export function generateReportPDF\([\s\S]*?\): jsPDF \{[\s\S]*?const startY = drawReportHeaderBox\([\s\S]*?\);/,
  `export function generateReportPDF(
  doc: jsPDF,
  reportData: any[],
  columns: { header: string; dataKey: string; format?: 'currency' | 'number' | 'text' | 'date'; align?: 'left' | 'right' | 'center'; width?: number }[],
  config: Config,
  reportTitle: string,
  fromDate: string,
  toDate: string,
  depth: 'summary' | 'detailed' | 'super_detailed' = 'detailed',
  reportType?: 'TB' | 'PNL' | 'BS' | null,
  totals?: Record<string, number>,
  additionalMeta?: any
): jsPDF {
  const startY = drawReportHeaderBox(doc, config, reportTitle, fromDate, toDate, depth, reportType);`
);

// Fix options usage in generateReportPDF
content = content.replace(/options\?\.totals/g, 'totals');
content = content.replace(/options\.totals/g, 'totals');

// Fix Quotation types
content = content.replace(/quote\.customerName/g, 'quote.customer?.name');
content = content.replace(/quote\.address/g, 'quote.customer?.address');
content = content.replace(/quote\.gstin/g, '(quote.customer?.gstNo || quote.customer?.tpnNo)');

// Fix DeliveryNote types
content = content.replace(/note\.customerName/g, 'note.customer?.name');
content = content.replace(/note\.destination/g, 'note.customer?.address');
content = content.replace(/note\.customer\?\.address \? \`Destination: \$\{note\.customer\?\.address\}\` : ''/g, 'note.customer?.address ? `Destination / Address: ${note.customer?.address}` : \'\'');

// Fix Credit/Debit Note types
content = content.replace(/note\.customerName/g, 'note.customer?.name');
content = content.replace(/note\.supplierName/g, 'note.supplier?.name');

fs.writeFileSync('src/utils/pdfExport.ts', content);
