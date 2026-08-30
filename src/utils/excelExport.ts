import * as XLSX from 'xlsx';
import { SalesInvoice, Config } from '../types';

export function exportInvoiceToExcel(invoice: SalesInvoice, config: Config) {
  const wb = XLSX.utils.book_new();
  
  // Sheet Name
  const ws_name = "Invoice";
  
  // Company Info
  const header = [
    [config.CompanyName || "RETAIL STORE"],
    [config.Address || ""],
    [(config.CompanyGSTNo || config.CompanyTPNNo) ? `GSTIN / TPN: ${config.CompanyGSTNo || config.CompanyTPNNo}` : ""],
    [""],
    ["TAX INVOICE"],
    [""],
    ["Bill To:", invoice.customer?.name || "Cash Customer"],
    ["Contact:", invoice.customer?.phone || ""],
    ["Address:", invoice.customer?.address || ""],
    ["GSTIN / TPN:", invoice.customer?.gstNo || invoice.customer?.tpnNo || ""],
    [""],
    ["Invoice No:", invoice.invoiceNo, "Date:", new Date(invoice.date).toLocaleDateString()],
    [""]
  ];

  if (invoice.narration) {
    header.push(["Narration:", invoice.narration]);
    header.push([""]);
  }

  // Define columns
  const tableHeader = [
    "SN",
    "Item Description",
    "Qty",
    "Unit",
    "Rate",
    "Discount",
    "GST Amount",
    "Taxable Value",
    "Line Total"
  ];

  const tableData = invoice.items.map((item, idx) => [
    idx + 1,
    item['Item Name'] + (item['Item Description'] ? ` - ${item['Item Description']}` : ''),
    item.Qty,
    item.Unit,
    item.Rate,
    item.Discount || 0,
    item['GST Amount'] || 0,
    item['Taxable Value'] || 0,
    item['Line Total'] || 0
  ]);

  const footerData = [
    ["", "", "", "", "", "", "", "Taxable Sale:", invoice.taxable],
    ["", "", "", "", "", "", "", "Exempted Sale:", invoice.zeroRated],
    ["", "", "", "", "", "", "", "GST Amount:", invoice.gstAmt],
    ["", "", "", "", "", "", "", "Subtotal:", invoice.subtotal || (invoice.total + (invoice.discount || 0))],
    ["", "", "", "", "", "", "", "Bill Discount:", invoice.discount || 0],
    ["", "", "", "", "", "", "", "Grand Total:", invoice.total]
  ];

  const ws_data = [...header, tableHeader, ...tableData, ["", "", "", "", "", "", "", "", ""], ...footerData];
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // Auto-size columns loosely
  ws['!cols'] = [
    { wch: 5 },  // SN
    { wch: 40 }, // Item Description
    { wch: 10 }, // Qty
    { wch: 10 }, // Unit
    { wch: 12 }, // Rate
    { wch: 12 }, // Discount
    { wch: 12 }, // GST Amount
    { wch: 15 }, // Taxable Value
    { wch: 15 }  // Line Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, ws_name);
  
  XLSX.writeFile(wb, `Invoice_${invoice.invoiceNo}.xlsx`);
}
