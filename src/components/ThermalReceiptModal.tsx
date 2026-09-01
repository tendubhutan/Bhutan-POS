import React, { useState } from 'react';
import { SalesInvoice, Config } from '../types';
import { X, Printer, Share2, Mail, MessageCircle, FileText, Check, Copy, FileDown } from 'lucide-react';
import { generateInvoicePDF, shareOrDownloadPDF, resolveBankDetailsForPrint } from '../utils/pdfExport';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SalesInvoice | null;
  config: Config;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  invoice,
  config
}) => {
  const [activeTab, setActiveTab] = useState<'thermal' | 'a4' | 'a5'>('thermal');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [showPhonePrompt, setShowPhonePrompt] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [termsOption, setTermsOption] = useState<'both' | 'primary' | 'secondary' | 'none'>('both');

  React.useEffect(() => {
    if (invoice?.customer?.phone) {
      setPhoneInput(invoice.customer.phone.replace(/[^0-9+]/g, ''));
    } else {
      setPhoneInput('');
    }
  }, [invoice]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (isOpen && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const buttons = Array.from(document.querySelectorAll('#thermal-receipt-modal button:not([disabled])')) as HTMLButtonElement[];
        const currentIndex = buttons.findIndex(b => b === document.activeElement);
        if (currentIndex !== -1) {
          e.preventDefault();
          let nextIndex = currentIndex;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % buttons.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
          }
          buttons[nextIndex]?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const oldFrame = document.getElementById('print-receipt-iframe');
      if (oldFrame) {
        try { oldFrame.remove(); } catch {}
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const cleanupPrintFrame = () => {
    const oldFrame = document.getElementById('print-receipt-iframe');
    if (oldFrame) {
      try { oldFrame.remove(); } catch {}
    }
  };

  const handleModalClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    cleanupPrintFrame();
    onClose();
  };

  const showGst = String(config.EnableGST) !== 'false';
  const currency = config.CurrencySymbol || 'Nu.';

  const effectiveBankDetails = resolveBankDetailsForPrint(config);

  const getResolvedTerms = () => {
    if (termsOption === 'none') return '';
    const primaryT = config.FooterTerms || '';
    const secondaryT = config.SecondaryTerms || '';
    if (termsOption === 'primary') return primaryT;
    if (termsOption === 'secondary') return secondaryT;
    if (termsOption === 'both') {
      return [primaryT, secondaryT].filter(Boolean).join('\n\n');
    }
    return invoice.termsAndConditions || [primaryT, secondaryT].filter(Boolean).join('\n\n');
  };

  const resolvedTerms = getResolvedTerms();

  const generateInvoiceText = () => {
    const lines = [
      `🧾 *TAX INVOICE: ${invoice.invoiceNo}*`,
      `🏪 *${config.CompanyName || 'Retail Store'}*`,
      config.Address ? `📍 ${config.Address}` : '',
      showGst && config.CompanyGSTNo ? `🏛 GSTIN: ${config.CompanyGSTNo}` : '',
      `📅 Date: ${new Date(invoice.date).toLocaleString()}`,
      `👤 Customer: ${invoice.customer?.name || 'Walk-in Cash Customer'}`,
      invoice.customer?.phone ? `📞 Phone: ${invoice.customer.phone}` : '',
      '--------------------------------',
      '*ITEMS:*',
      ...invoice.items.map(item => {
        const saleAmt = Number(
          item['Taxable Value'] !== undefined
            ? item['Taxable Value']
            : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
        ).toFixed(2);
        const gstInfo = showGst ? ` | GST: ${item['GST %'] || 0}% (${currency} ${Number(item['GST Amount'] || 0).toFixed(2)})` : '';
        return `• *${item['Item Name']}* (${item.Qty} ${item.Unit || 'Pcs'} @ ${currency} ${Number(item.Rate).toFixed(2)}) | Sale Amt: ${currency} ${saleAmt}${gstInfo} | Total: ${currency} ${Number(item['Line Total']).toFixed(2)}`;
      }),
      '--------------------------------',
      showGst ? `Taxable Sale: ${currency} ${invoice.taxable.toFixed(2)}` : '',
      showGst ? `Exempted Sale: ${currency} ${invoice.zeroRated.toFixed(2)}` : '',
      showGst ? `GST Amount: ${currency} ${invoice.gstAmt.toFixed(2)}` : '',
      ...(invoice.additionalExpenses && invoice.additionalExpenses.length > 0 ? invoice.additionalExpenses.map(exp => `Addl Charge (${exp.ledger}): ${currency} ${Number(exp.amount).toFixed(2)}`) : []),
      (invoice.discount && invoice.discount > 0) ? `Subtotal: ${currency} ${(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}` : '',
      (invoice.discount && invoice.discount > 0) ? `Bill Discount: -${currency} ${invoice.discount.toFixed(2)}` : '',
      `*GRAND TOTAL: ${currency} ${invoice.total.toFixed(2)}*`,
      '--------------------------------',
      `Paid: Cash ${currency} ${invoice.cash.toFixed(2)} | Bank ${currency} ${(invoice.bank1 + invoice.bank2).toFixed(2)}`,
      invoice.credit > 0 ? `⚠️ *Credit Balance Due: ${currency} ${invoice.credit.toFixed(2)}*` : '✅ *Status: Fully Paid*',
      config.CompanyBankDetails ? `\n*Bank Details:*\n${config.CompanyBankDetails}` : '',
      `\nThank you for choosing ${config.CompanyName || 'us'}! Visit Again.`
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleWhatsAppShare = (customPhone?: string) => {
    const rawPhone = customPhone || phoneInput || invoice.customer?.phone || '';
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(generateInvoiceText());
    
    let url = `https://wa.me/?text=${message}`;
    if (cleanPhone && cleanPhone.length >= 7) {
      url = `https://wa.me/${cleanPhone}?text=${message}`;
    }
    
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowPhonePrompt(false);
  };

  const handleEmailShare = () => {
    const email = invoice.customer?.email || '';
    const subject = encodeURIComponent(`Tax Invoice #${invoice.invoiceNo} - ${config.CompanyName || 'Store'}`);
    const body = encodeURIComponent(generateInvoiceText());
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateInvoiceText()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleDownloadPDF = () => {
    if (!invoice) return;
    const doc = generateInvoicePDF(invoice, config, { customTerms: resolvedTerms, customBankDetails: effectiveBankDetails });
    doc.save(`Invoice_${invoice.invoiceNo}.pdf`);
  };

  const handleSharePDF = async () => {
    if (!invoice) return;
    const doc = generateInvoicePDF(invoice, config, { customTerms: resolvedTerms, customBankDetails: effectiveBankDetails });
    const filename = `Invoice_${invoice.invoiceNo}.pdf`;
    await shareOrDownloadPDF(
      doc,
      filename,
      `Tax Invoice #${invoice.invoiceNo} - ${config.CompanyName || 'Store'}`,
      generateInvoiceText()
    );
  };

  const printReceipt = (mode: 'thermal' | 'a4' | 'a5') => {
    const isThermal = mode === 'thermal';
    let content = '';

    if (isThermal) {
      // 3-inch Thermal Print Slip Styles & Layout
      content = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Thermal Receipt - ${invoice.invoiceNo}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 10.5px;
              line-height: 1.35;
              width: 72mm;
              margin: 0 auto;
              padding: 6px 2px;
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .bold { font-weight: bold; }
            .dashed-line {
              border-top: 1px dashed #000;
              margin: 6px 0;
            }
            .double-line {
              border-top: 2px solid #000;
              margin: 6px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 10px;
              font-family: 'Courier New', Courier, monospace;
            }
            th {
              border-bottom: 1px dashed #000;
              padding: 3px 1px;
              font-weight: bold;
              vertical-align: bottom;
            }
            td {
              padding: 3px 1px;
              vertical-align: top;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 1px 0;
              font-size: 10px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-weight: bold;
              margin-top: 4px;
              padding-top: 4px;
              border-top: 1px solid #000;
            }
            .cancelled-banner {
              text-align: center;
              font-weight: bold;
              font-size: 16px;
              border: 2px dashed #000;
              margin: 10px 0;
              padding: 5px;
              letter-spacing: 2px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            ${config.ReceiptHeaderImage ? `<div style="margin-bottom: 6px;"><img src="${config.ReceiptHeaderImage}" style="max-width: 100%; max-height: 50px; object-fit: contain;" /></div>` : ''}
            <div style="font-size: 14px; font-weight: bold; text-transform: uppercase;">${config.CompanyName || 'My Retail Store'}</div>
            <div>${config.Address || ''}</div>
            ${showGst ? `<div>GSTIN: ${config.CompanyGSTNo || '-'}</div>` : ''}
          </div>

          <div class="dashed-line"></div>

          ${invoice.status === 'Cancelled' ? '<div class="cancelled-banner">CANCELLED</div>' : ''}

          <div>
            <div><b>Inv #:</b> ${invoice.invoiceNo}</div>
            <div><b>Date:</b> ${new Date(invoice.date).toLocaleString()}</div>
            <div><b>Customer:</b> ${invoice.customer?.name || 'Cash Customer'}</div>
            ${invoice.customer?.phone ? `<div><b>Ph:</b> ${invoice.customer.phone}</div>` : ''}
            ${invoice.customer?.address ? `<div><b>Addr:</b> ${invoice.customer.address}</div>` : ''}
            ${showGst ? `<div><b>Cust GST:</b> ${invoice.customer?.gstNo || '-'}</div>` : ''}
          </div>

          <div class="dashed-line"></div>

          <table>
            <colgroup>
              <col style="width: 38%;">
              <col style="width: 12%;">
              <col style="width: 20%;">
              ${showGst ? '<col style="width: 12%;">' : ''}
              <col style="width: ${showGst ? '18%' : '30%'};">
            </colgroup>
            <thead>
              <tr>
                <th class="text-left">Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Rate</th>
                ${showGst ? '<th class="text-right">GST%</th>' : ''}
                <th class="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td class="text-left">
                    ${item['Item Name']}
                    ${item['Serial Numbers'] ? `<br><span style="font-size: 8px;">SN: ${item['Serial Numbers']}</span>` : ''}
                  </td>
                  <td class="text-center">${item.Qty}</td>
                  <td class="text-right">${Number(item.Rate).toFixed(2)}</td>
                  ${showGst ? `<td class="text-right">${item['GST %'] || 0}%</td>` : ''}
                  <td class="text-right">${Number(item['Line Total']).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="dashed-line"></div>

          ${showGst ? `
            <div class="summary-row">
              <span>Taxable Sale:</span>
              <span>${invoice.taxable.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span>Exempted Sale:</span>
              <span>${invoice.zeroRated.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span>GST Amount:</span>
              <span>${invoice.gstAmt.toFixed(2)}</span>
            </div>
          ` : ''}

          ${(invoice.additionalExpenses && invoice.additionalExpenses.length > 0) ? invoice.additionalExpenses.map(exp => `
            <div class="summary-row">
              <span>Addl (${exp.ledger}):</span>
              <span>${Number(exp.amount).toFixed(2)}</span>
            </div>
          `).join('') : ''}

          ${(invoice.discount && invoice.discount > 0) ? `
            <div class="summary-row" style="color: #475569;">
              <span>Subtotal:</span>
              <span>${(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}</span>
            </div>
            <div class="summary-row" style="font-weight: bold;">
              <span>Bill Discount:</span>
              <span>-${invoice.discount.toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="total-row">
            <span>TOTAL:</span>
            <span>${currency} ${invoice.total.toFixed(2)}</span>
          </div>

          <div class="dashed-line"></div>

          <div style="font-size: 9px;" class="text-center">
            <span>Paid: Cash ${invoice.cash.toFixed(2)} | B1 ${invoice.bank1.toFixed(2)} | B2 ${invoice.bank2.toFixed(2)}</span>
            ${invoice.bankTxnNo ? `<br><span>Txn/Journal Ref: <b>${invoice.bankTxnNo}</b></span>` : ''}
            ${invoice.credit > 0 ? `<br><span class="bold">Balance Credit: ${invoice.credit.toFixed(2)}</span>` : ''}
          </div>

          ${config.CompanyBankDetails ? `
            <div class="dashed-line"></div>
            <div style="font-size: 9px; white-space: pre-wrap;" class="text-center">
              <b>Bank Details:</b><br>${config.CompanyBankDetails}
            </div>
          ` : ''}

          ${config.ReceiptSignatureImage ? `
            <div class="dashed-line"></div>
            <div class="text-center">
              <img src="${config.ReceiptSignatureImage}" style="max-height: 35px; margin: 2px auto 0 auto; display: block;" />
              <div style="font-size: 8px; font-weight: bold; border-top: 1px solid #000; display: inline-block; padding-top: 2px; margin-top: 2px;">
                ${config.SignatoryTitle || 'Authorized Signatory'}
              </div>
            </div>
          ` : ''}
          <div class="dashed-line"></div>
          <div style="text-align: center; margin-top: 20px;">
             <div style="width: 100px; border-bottom: 1px solid #000; margin: 0 auto 5px auto;"></div>
             <div style="font-size: 9px; font-weight: bold;">Receiver's Signature</div>
          </div>

          ${resolvedTerms ? `
            <div style="font-size: 8px; margin-top: 4px; text-align: center; color: #333; white-space: pre-wrap;">
              <b>Terms & Conditions:</b><br>${resolvedTerms}
            </div>
          ` : ''}

          <div class="dashed-line"></div>
          <div class="text-center bold" style="font-size: 10px; margin-top: 4px;">Thank you! Visit Again</div>
        </body>
        </html>
      `;
    } else {
      // Standard A4 Full Page Tax Invoice Layout
      content = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Tax Invoice - ${invoice.invoiceNo}</title>
          <style>
            @page {
              size: ${mode === 'a5' ? 'A5' : 'A4'} portrait;
              margin: 12mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-box {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .store-name {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .store-meta {
              font-size: 10.5px;
              color: #475569;
            }
            .badge-title {
              text-align: right;
            }
            .inv-badge {
              font-size: 16px;
              font-weight: 800;
              color: #1e1b4b;
              text-transform: uppercase;
            }
            .meta-grid {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              margin-bottom: 16px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
            }
            .meta-col {
              flex: 1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f1f5f9;
              color: #1e293b;
              font-weight: 800;
              font-size: 10px;
              text-transform: uppercase;
              padding: 8px 10px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            td {
              padding: 8px 10px;
              border: 1px solid #e2e8f0;
              font-size: 11px;
            }
            tr:nth-child(even) td {
              background-color: #fafafa;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .totals-container {
              display: flex;
              justify-content: space-between;
              margin-top: 16px;
              gap: 20px;
            }
            .bank-info {
              flex: 1;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
              font-size: 10.5px;
            }
            .calc-box {
              width: 300px;
            }
            .calc-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
              font-size: 11px;
            }
            .grand-total-row {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              font-weight: 800;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              padding: 6px 0;
              margin-top: 6px;
              color: #0f172a;
            }
            .sig-section {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
            }
            .sig-block {
              text-align: center;
              width: 180px;
            }
            .sig-line {
              border-top: 1px solid #0f172a;
              padding-top: 4px;
              font-weight: 700;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              ${config.ReceiptHeaderImage ? `<img src="${config.ReceiptHeaderImage}" style="max-height: 55px; margin-bottom: 6px; object-fit: contain;" /><br>` : ''}
              <h1 class="store-name">${config.CompanyName || 'Business Store'}</h1>
              <div class="store-meta">
                ${config.Address ? `<span>${config.Address}</span><br>` : ''}
                ${config.CompanyPhone ? `<span>Contact: ${config.CompanyPhone}</span>` : ''}
                ${showGst ? `<span> | GSTIN: ${config.CompanyGSTNo || '-'}</span>` : ''}
              </div>
            </div>
            <div class="badge-title">
              <div class="inv-badge">TAX INVOICE</div>
              <div style="font-size: 11px; font-weight: bold; color: #4338ca; margin-top: 4px;">Original for Recipient</div>
            </div>
          </div>

          ${invoice.status === 'Cancelled' ? `
            <div style="text-align: center; font-size: 48px; font-weight: bold; color: rgba(220, 38, 38, 0.2); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); pointer-events: none; white-space: nowrap;">
              CANCELLED
            </div>
            <div style="background-color: #fef2f2; color: #991b1b; padding: 12px; border: 1px solid #f87171; text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 20px; border-radius: 6px;">
              THIS INVOICE HAS BEEN CANCELLED
            </div>
          ` : ''}

          <div class="meta-grid">
            <div class="meta-col">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Billed To (Customer):</div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${invoice.customer?.name || 'Walk-in Cash Customer'}</div>
              ${invoice.customer?.phone ? `<div>Phone: ${invoice.customer.phone}</div>` : ''}
              ${showGst ? `<div>GSTIN: ${invoice.customer?.gstNo || '-'}</div>` : ''}
              ${invoice.customer?.address ? `<div>Address: ${invoice.customer.address}</div>` : ''}
            </div>
            <div class="meta-col" style="text-align: right;">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Invoice Details:</div>
              <div><b>Invoice No:</b> ${invoice.invoiceNo}</div>
              <div><b>Invoice Date:</b> ${new Date(invoice.date).toLocaleDateString()}</div>
              <div><b>Time:</b> ${new Date(invoice.date).toLocaleTimeString()}</div>
              <div><b>Payment Mode:</b> ${invoice.credit > 0 ? 'Credit / Partial' : 'Cash / Digital Paid'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 4%;" class="text-center">#</th>
                <th style="width: 28%;">Item</th>
                <th style="width: 8%;" class="text-center">Qty</th>
                <th style="width: 8%;" class="text-center">Unit</th>
                <th style="width: 12%;" class="text-right">Rate</th>
                <th style="width: 13%;" class="text-right">Sale Amt</th>
                ${showGst ? '<th style="width: 13%;" class="text-right">GST</th>' : ''}
                <th style="width: 14%;" class="text-right">Total Amt</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map((item, i) => {
                const saleAmt = Number(
                  item['Taxable Value'] !== undefined
                    ? item['Taxable Value']
                    : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
                ).toFixed(2);
                const gstAmt = Number(
                  item['GST Amount'] !== undefined
                    ? item['GST Amount']
                    : (item['Zero Rated (Y/N)'] === 'Y' ? 0 : ((Number(item['Taxable Value'] || 0) * (Number(item['GST %']) || 0)) / 100))
                ).toFixed(2);
                return `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>
                    <b>${item['Item Name']}</b>
                    ${(item.description || (item as any).Description || item["Item Description"]) ? `<br><small style="color: #475569; font-style: italic;">Desc: ${item.description || (item as any).Description || item["Item Description"]}</small>` : ''}
                    ${item['Serial Numbers'] ? `<br><small style="color: #64748b;">Serial/IMEI: ${item['Serial Numbers']}</small>` : ''}
                  </td>
                  <td class="text-center">${item.Qty}</td>
                  <td class="text-center">${item.Unit || 'Pcs'}</td>
                  <td class="text-right">${Number(item.Rate).toFixed(2)}</td>
                  <td class="text-right">${saleAmt}</td>
                  ${showGst ? `<td class="text-right">${gstAmt}</td>` : ''}
                  <td class="text-right" style="font-weight: bold;">${Number(item['Line Total']).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="bank-info">
              ${effectiveBankDetails ? `<b>Bank Transfer Details:</b><br><span style="white-space: pre-wrap;">${effectiveBankDetails}</span><br><br>` : ''}
              ${resolvedTerms ? `<div style="margin-top: 10px;"><b>Terms & Conditions / Remarks:</b><br><span style="white-space: pre-wrap; font-size: 10px; color: #334155;">${resolvedTerms}</span></div>` : ''}
            </div>

            <div class="calc-box">
              ${showGst ? `
                <div class="calc-row"><span>Taxable Amount:</span><span>${currency} ${invoice.taxable.toFixed(2)}</span></div>
                <div class="calc-row"><span>Zero-Rated / Exempt:</span><span>${currency} ${invoice.zeroRated.toFixed(2)}</span></div>
                <div class="calc-row"><span>Total GST:</span><span>${currency} ${invoice.gstAmt.toFixed(2)}</span></div>
              ` : ''}
              ${(invoice.additionalExpenses && invoice.additionalExpenses.length > 0) ? invoice.additionalExpenses.map(exp => `
                <div class="calc-row"><span>Addl Charge (${exp.ledger}):</span><span>${currency} ${Number(exp.amount).toFixed(2)}</span></div>
              `).join('') : ''}
              ${(invoice.discount && invoice.discount > 0) ? `
                <div class="calc-row">
                  <span>Gross Subtotal:</span>
                  <span>${currency} ${(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}</span>
                </div>
                <div class="calc-row" style="color: #dc2626; font-weight: bold;">
                  <span>Bill / Lumpsum Discount:</span>
                  <span>-${currency} ${invoice.discount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="grand-total-row">
                <span>TOTAL INVOICE VALUE:</span>
                <span>${currency} ${invoice.total.toFixed(2)}</span>
              </div>
              <div class="calc-row" style="margin-top: 6px; font-size: 10.5px; color: #334155;">
                <span>Paid (Cash + Bank):</span>
                <span>${currency} ${(invoice.cash + invoice.bank1 + invoice.bank2).toFixed(2)}</span>
              </div>
              ${invoice.bankTxnNo ? `
                <div class="calc-row" style="font-size: 10px; color: #4338ca; font-weight: bold;">
                  <span>Bank Txn / Ref #:</span>
                  <span>${invoice.bankTxnNo}</span>
                </div>
              ` : ''}
              ${invoice.credit > 0 ? `
                <div class="calc-row" style="font-weight: bold; color: #dc2626;">
                  <span>Balance Credit Due:</span>
                  <span>${currency} ${invoice.credit.toFixed(2)}</span>
                </div>
              ` : `
                <div class="calc-row" style="font-weight: bold; color: #16a34a;">
                  <span>Status:</span>
                  <span>PAID IN FULL</span>
                </div>
              `}
            </div>
          </div>

          <div class="sig-section">
            <div style="font-size: 10px; color: #64748b;">
              Thank you for your business! | Computer Generated Invoice
            </div>
            <div class="sig-block">
              <div style="height: 35px;"></div>
              <div class="sig-line">Receiver's Signature</div>
            </div>
            <div class="sig-block">
              ${config.ReceiptSignatureImage ? `<img src="${config.ReceiptSignatureImage}" style="max-height: 40px; margin-bottom: 2px;" /><br>` : '<div style="height: 35px;"></div>'}
              <div class="sig-line">${config.SignatoryTitle || 'Authorized Signatory'}</div>
            </div>
          </div>
          </div>
        </body>
        </html>
      `;
    }

    // Clean up any prior printing iframe
    cleanupPrintFrame();

    const iframe = document.createElement('iframe');
    iframe.id = 'print-receipt-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const pri = iframe.contentWindow;
    if (!pri) return;

    pri.document.open();
    pri.document.write(content);
    pri.document.close();

    // Trigger print safely without premature iframe destruction
    setTimeout(() => {
      try {
        pri.focus();
        pri.print();
      } catch (e) {
        console.error('Print iframe execution fallback:', e);
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'absolute';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = 'none';
        document.body.appendChild(printIframe);
        const win = printIframe.contentWindow;
        if (win) {
          win.document.write(content);
          win.document.close();
          win.focus();
          win.print();
          // Remove iframe after print dialog closes
          setTimeout(() => {
            document.body.removeChild(printIframe);
          }, 500);
        }
      }
    }, 250);
  };

  return (
    <div
      onClick={handleModalClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="thermal-receipt-modal"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Sale Bill Saved</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Invoice #{invoice.invoiceNo} &bull; {currency} {invoice.total.toFixed(2)}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Tab Toggle */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('thermal')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeTab === 'thermal'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3" Thermal
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('a4')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeTab === 'a4'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('a5')}
                className={`px-3 py-1 rounded-lg transition ${
                  activeTab === 'a5'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A5 Invoice
              </button>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Canvas */}
        <div className="my-3 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-100/70 p-3 sm:p-4">
          {activeTab === 'thermal' ? (
            /* 3-Inch Thermal Slip On-Screen Preview */
            <div className="mx-auto w-[280px] bg-white p-4 shadow-md rounded border border-slate-200 text-slate-900 leading-snug font-mono text-[10px]">
              <div className="text-center">
                <div className="font-bold text-sm uppercase tracking-wide">{config.CompanyName || 'My Retail Store'}</div>
                <div className="text-[10px] text-slate-600">{config.Address || ''}</div>
                {showGst && <div className="text-[10px] text-slate-600">GSTIN: {config.CompanyGSTNo || '-'}</div>}
              </div>

              <div className="my-2 border-b border-dashed border-slate-800" />

              <div className="space-y-0.5">
                <div><b>Inv:</b> {invoice.invoiceNo}</div>
                <div><b>Dt:</b> {new Date(invoice.date).toLocaleString()}</div>
                <div><b>Buyer:</b> {invoice.customer?.name || 'Cash Customer'}</div>
                {invoice.customer?.phone && <div><b>Ph:</b> {invoice.customer.phone}</div>}
                {invoice.customer?.address && <div><b>Addr:</b> {invoice.customer.address}</div>}
                {showGst && <div><b>Cust GST:</b> {invoice.customer?.gstNo || '-'}</div>}
              </div>

              <div className="my-2 border-b border-dashed border-slate-800" />

              <table className="w-full border-collapse text-[10px] table-fixed">
                <colgroup>
                  <col style={{ width: '38%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '20%' }} />
                  {showGst && <col style={{ width: '12%' }} />}
                  <col style={{ width: showGst ? '18%' : '30%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-dashed border-slate-800">
                    <th className="text-left py-1 pr-1 font-bold">Item</th>
                    <th className="text-center py-1 font-bold">Qty</th>
                    <th className="text-right py-1 pr-1 font-bold">Rate</th>
                    {showGst && <th className="text-right py-1 pr-1 font-bold">GST%</th>}
                    <th className="text-right font-bold">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-200">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-left py-1 pr-1 break-words">
                        <div>{item['Item Name']}</div>
                        {item['Serial Numbers'] && (
                          <div className="text-[8px] text-slate-500">SN: {item['Serial Numbers']}</div>
                        )}
                      </td>
                      <td className="text-center py-1 align-top">{item.Qty}</td>
                      <td className="text-right py-1 pr-1 align-top whitespace-nowrap">{Number(item.Rate).toFixed(2)}</td>
                      {showGst && <td className="text-right py-1 pr-1 align-top whitespace-nowrap">{item['GST %'] || 0}%</td>}
                      <td className="text-right py-1 align-top whitespace-nowrap">{Number(item['Line Total']).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="my-2 border-b border-dashed border-slate-800" />

              {showGst && (
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Taxable Sale:</span>
                    <span>{invoice.taxable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exempted Sale:</span>
                    <span>{invoice.zeroRated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Amount:</span>
                    <span>{invoice.gstAmt.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {invoice.additionalExpenses && invoice.additionalExpenses.length > 0 && (
                <div className="space-y-0.5 pt-1 mt-1 border-t border-dashed border-slate-300">
                  {invoice.additionalExpenses.map((exp, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Addl ({exp.ledger}):</span>
                      <span>{Number(exp.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {invoice.discount && invoice.discount > 0 ? (
                <div className="space-y-0.5 pt-1 mt-1 border-t border-dashed border-slate-300">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600">
                    <span>Bill Discount:</span>
                    <span>-{invoice.discount.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-2 pt-1 border-t border-slate-900 flex justify-between font-bold text-xs">
                <span>TOTAL:</span>
                <span>{currency} {invoice.total.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            /* A4 On-Screen Preview */
            <div className="mx-auto max-w-lg bg-white p-5 shadow-md rounded-xl border border-slate-200 text-slate-900 text-xs space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-900 uppercase text-sm">{config.CompanyName || 'Business Store'}</h4>
                  <p className="text-[11px] text-slate-500">{config.Address || ''}</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-indigo-900 text-xs px-2 py-0.5 bg-indigo-50 rounded">TAX INVOICE</span>
                  <p className="text-[10px] text-slate-400 mt-1">#{invoice.invoiceNo}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Customer</span>
                  <span className="font-bold text-slate-800">{invoice.customer?.name || 'Walk-in Cash Customer'}</span>
                  {invoice.customer?.phone && <div className="text-slate-600">{invoice.customer.phone}</div>}
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-bold uppercase text-[9px] block">Date</span>
                  <span className="font-semibold text-slate-700">{new Date(invoice.date).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-[11px] min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-center">Unit</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Sale Amt</th>
                      {showGst && <th className="p-2 text-right">GST</th>}
                      <th className="p-2 text-right">Total Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => {
                      const saleAmt = Number(
                        item['Taxable Value'] !== undefined
                          ? item['Taxable Value']
                          : (Number(item.Qty) || 0) * (Number(item.Rate) || 0) - (Number(item.Discount) || 0)
                      ).toFixed(2);
                      const gstAmt = Number(
                        item['GST Amount'] !== undefined
                          ? item['GST Amount']
                          : (item['Zero Rated (Y/N)'] === 'Y' ? 0 : ((Number(item['Taxable Value'] || 0) * (Number(item['GST %']) || 0)) / 100))
                      ).toFixed(2);
                      return (
                        <tr key={idx}>
                          <td className="p-2 font-medium">
                            <div>{item['Item Name']}</div>
                            {(item.description || (item as any).Description || item['Item Description'] || item.lineDescription) && (
                              <div className="text-[10px] text-slate-500 italic">{item.description || (item as any).Description || item['Item Description'] || item.lineDescription}</div>
                            )}
                            {item['Serial Numbers'] && (
                              <span className="text-[9.5px] text-slate-400">SN: {item['Serial Numbers']}</span>
                            )}
                          </td>
                          <td className="p-2 text-center">{item.Qty}</td>
                          <td className="p-2 text-center text-slate-600">{item.Unit || 'Pcs'}</td>
                          <td className="p-2 text-right">{Number(item.Rate).toFixed(2)}</td>
                          <td className="p-2 text-right">{saleAmt}</td>
                          {showGst && <td className="p-2 text-right font-medium text-slate-700">{gstAmt}</td>}
                          <td className="p-2 text-right font-bold text-slate-900">{Number(item['Line Total']).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {showGst && (
                <div className="space-y-1 text-slate-600 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold text-slate-800">{currency} {invoice.taxable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exempted / Zero-Rated:</span>
                    <span className="font-semibold text-slate-800">{currency} {invoice.zeroRated.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Amount:</span>
                    <span className="font-semibold text-slate-800">{currency} {invoice.gstAmt.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {invoice.additionalExpenses && invoice.additionalExpenses.length > 0 && (
                <div className="space-y-1 text-slate-700 text-[11px] pt-1 border-t border-slate-100">
                  {invoice.additionalExpenses.map((exp, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Addl Charge ({exp.ledger}):</span>
                      <span className="font-semibold text-slate-800">{currency} {Number(exp.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {invoice.discount && invoice.discount > 0 ? (
                <div className="space-y-1 text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex justify-between text-slate-500">
                    <span>Gross Subtotal:</span>
                    <span className="font-semibold">{currency} {(invoice.subtotal || (invoice.total + invoice.discount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600">
                    <span>Bill / Lumpsum Discount:</span>
                    <span>-{currency} {invoice.discount.toFixed(2)}</span>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold">
                <span className="text-slate-700">Grand Total:</span>
                <span className="text-sm text-indigo-700 font-extrabold">{currency} {invoice.total.toFixed(2)}</span>
              </div>

              {effectiveBankDetails && (
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-700">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <span>Bank & Payment Details:</span>
                  </div>
                  <div className="whitespace-pre-wrap font-mono leading-tight">{effectiveBankDetails}</div>
                </div>
              )}

              {resolvedTerms && (
                <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-700">
                  <div className="font-bold text-slate-900 mb-1">Terms & Conditions:</div>
                  <div className="whitespace-pre-wrap leading-relaxed">{resolvedTerms}</div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-end justify-between text-xs text-slate-500">
                <div>
                  <div className="h-8"></div>
                  <div className="border-t border-slate-300 pt-1 font-medium">Receiver's Signature</div>
                </div>
                <div className="text-right">
                  {config.ReceiptSignatureImage ? (
                    <img src={config.ReceiptSignatureImage} alt="Signature" className="max-h-12 max-w-[140px] ml-auto mb-1 object-contain" />
                  ) : (
                    <div className="h-8"></div>
                  )}
                  <div className="border-t border-slate-300 pt-1 font-bold text-slate-800">
                    {config.SignatoryTitle || 'Authorized Signatory'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* A4 Invoice Terms Selector */}
        {activeTab === 'a4' && (
          <div className="mb-2 p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-indigo-950 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span>Select Terms to Print:</span>
            </span>
            <select
              value={termsOption}
              onChange={e => setTermsOption(e.target.value as any)}
              className="h-8 rounded-lg border border-indigo-300 bg-white px-3 font-bold text-slate-800 outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
            >
              <option value="both">Both Terms (Term 1 Auto + Term 2 Secondary)</option>
              <option value="primary">Term 1 Only (Primary Auto)</option>
              <option value="secondary">Term 2 Only (Secondary Optional)</option>
              <option value="none">No Terms & Conditions</option>
            </select>
          </div>
        )}

        {/* WhatsApp Phone Prompt Box (if triggered) */}
        {showPhonePrompt && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in">
            <MessageCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Enter WhatsApp mobile number with country code (e.g. 97517123456)..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 bg-white font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => handleWhatsAppShare()}
              className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-lg hover:bg-emerald-700 transition"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setShowPhonePrompt(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="space-y-2 shrink-0 pt-1">
          {/* Primary Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Share PDF with WhatsApp/Email/Device */}
            <button
              type="button"
              onClick={handleSharePDF}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 px-3 text-xs font-bold text-white shadow-sm active:scale-98 transition cursor-pointer"
              title="Share attached PDF invoice via WhatsApp, Gmail, or device apps"
            >
              <Share2 className="h-4 w-4" />
              <span>Share PDF</span>
            </button>

            {/* Save PDF directly */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 py-2.5 px-3 text-xs font-bold text-white shadow-sm active:scale-98 transition cursor-pointer"
              title="Download professional A4 Tax Invoice PDF"
            >
              <FileDown className="h-4 w-4" />
              <span>Save PDF</span>
            </button>




            {/* Print A4 */}
            <button
              type="button"
              onClick={() => printReceipt('a4')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-98 transition cursor-pointer"
              title="Print full page A4 Tax Invoice Document"
            >
              <Printer className="h-4 w-4" />
              <span>A4 Print</span>
            </button>

            {/* 3-Inch Thermal */}
            <button
              type="button"
              onClick={() => printReceipt('thermal')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-98 transition cursor-pointer"
              title="Print 3-Inch Thermal Slip"
            >
              <Printer className="h-4 w-4" />
              <span>3" Thermal</span>
            </button>
          </div>

          {/* Secondary Utilities & Close */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 rounded hover:bg-slate-100 transition"
              title="Copy bill summary text"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
            </button>

            <button
              type="button"
              onClick={handleModalClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-1.5 font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

