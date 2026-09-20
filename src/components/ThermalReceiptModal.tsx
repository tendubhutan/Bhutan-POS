import React, { useState } from 'react';
import { SalesInvoice, Config } from '../types';
import { X, Printer, Share2, Mail, MessageCircle, FileText, Check, Copy, FileDown } from 'lucide-react';
import { generateInvoicePDF, shareOrDownloadPDF, resolveBankDetailsForPrint } from '../utils/pdfExport';
import { formatDateDMY, formatDateTimeDMY } from '../utils/dateUtils';
import { GlowButton } from './common/GlowButton';
import { getItemDiscountDetails, calculateInvoiceSavings } from '../utils/discountUtils';

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
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
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
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
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
  const hasGstOnBill = showGst && (
    Number(invoice.gstAmt || 0) > 0.001 ||
    (Array.isArray(invoice.items) && invoice.items.some((it: any) =>
      Number(it['GST Amount'] ?? it.gstAmount ?? 0) > 0.001 ||
      (Number(it['GST %'] ?? it.gstPct ?? 0) > 0 && it['Zero Rated (Y/N)'] !== 'Y' && !it.zeroRated)
    ))
  );

  const hasDiscountOnBill = Array.isArray(invoice.items) && invoice.items.some((it: any) => {
    const disc = getItemDiscountDetails(it, config);
    const discAmt = disc.hasDiscount ? Number(disc.discountAmt || 0) : Number(it.Discount ?? (it as any).discount ?? 0);
    return discAmt > 0.001;
  });

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
  const invoiceSavings = calculateInvoiceSavings(invoice, config);

  const safeItems = Array.isArray(invoice.items) ? invoice.items : [];
  let undiscountedTaxable = 0;
  let undiscountedZeroRated = 0;
  let undiscountedGst = 0;

  safeItems.forEach((item: any) => {
    const qty = Number(item.Qty ?? item.qty ?? 1);
    const rate = Number(item.originalRate !== undefined ? item.originalRate : (item.Rate ?? item.rate ?? 0));
    const gross = qty * rate;
    const isZero = (item['Zero Rated (Y/N)'] === 'Y' || item.zeroRated === 'Y' || item.zeroRated === true);
    const gstPct = Number(item['GST %'] ?? item.gstPct ?? 0);

    if (isZero) {
      undiscountedZeroRated += gross;
    } else {
      undiscountedTaxable += gross;
      undiscountedGst += (gross * gstPct) / 100;
    }
  });

  const addlExpensesTotal = (invoice.additionalExpenses && invoice.additionalExpenses.length > 0)
    ? invoice.additionalExpenses.reduce((sum: number, exp: any) => sum + (Number(exp.amount) || 0), 0)
    : 0;

  const undiscountedBillIncGst = Math.round((undiscountedTaxable + undiscountedZeroRated + undiscountedGst + addlExpensesTotal) * 100) / 100;
  const netAmountPaid = Number(invoice.total || 0);
  const totalSavingsIncGst = Math.max(0, Math.round((undiscountedBillIncGst - netAmountPaid) * 100) / 100);

  const generateInvoiceText = () => {
    if (!invoice) return '';
    const safeItems = Array.isArray(invoice.items) ? invoice.items : [];
    const partyName = typeof invoice.customer === 'object'
      ? (invoice.customer?.name || invoice.customer?.ledger || 'Walk-in Cash Customer')
      : (invoice.customer || 'Walk-in Cash Customer');
    const partyPhone = typeof invoice.customer === 'object' ? invoice.customer?.phone : '';

    const lines = [
      `🧾 *TAX INVOICE: ${invoice.invoiceNo || 'INV'}*`,
      `🏪 *${config.CompanyName || 'Retail Store'}*`,
      config.Address ? `📍 ${config.Address}` : '',
      showGst && config.CompanyGSTNo ? `🏛 GSTIN: ${config.CompanyGSTNo}` : '',
      `📅 Date: ${invoice.date ? new Date(invoice.date).toLocaleString() : new Date().toLocaleString()}`,
      `👤 Customer: ${partyName}`,
      partyPhone ? `📞 Phone: ${partyPhone}` : '',
      '--------------------------------',
      '*ITEMS:*',
      ...safeItems.map((item: any) => {
        const itemQty = Number(item.Qty ?? item.qty ?? 1);
        const itemRate = Number(item.Rate ?? item.rate ?? 0);
        const itemDisc = Number(item.Discount ?? item.discount ?? 0);
        const itemName = item['Item Name'] || item.itemName || item.itemDescription || 'Item';
        const itemUnit = item.Unit || item.unit || 'Pcs';
        const itemGstPct = Number(item['GST %'] ?? item.gstPct ?? item.taxRate ?? 0);
        const itemGstAmt = Number(item['GST Amount'] ?? item.gstAmt ?? 0);
        const itemLineTotal = Number(item['Line Total'] ?? item.lineTotal ?? item.amount ?? (itemQty * itemRate - itemDisc));
        const saleAmt = Number(
          item['Taxable Value'] !== undefined
            ? item['Taxable Value']
            : (itemQty * itemRate - itemDisc)
        ).toFixed(2);
        const discInfo = getItemDiscountDetails(item, config);
        const discText = (hasDiscountOnBill && discInfo.hasDiscount) ? ` | ${discInfo.displayText}` : '';
        const gstInfo = hasGstOnBill ? ` | GST: ${itemGstPct}% (${currency} ${itemGstAmt.toFixed(2)})` : '';
        const returnPrefix = itemQty < 0 ? '[RETURN] ' : '';
        return `• *${returnPrefix}${itemName}* (${itemQty} ${itemUnit} @ ${currency} ${itemRate.toFixed(2)}${discText}) | Sale Amt: ${currency} ${saleAmt}${gstInfo} | Total: ${currency} ${itemLineTotal.toFixed(2)}`;
      }),
      '--------------------------------',
      hasGstOnBill ? `Taxable Sale: ${currency} ${Number(invoice.taxable || 0).toFixed(2)}` : '',
      (hasGstOnBill && Number(invoice.zeroRated || 0) > 0) ? `Exempted Sale: ${currency} ${Number(invoice.zeroRated || 0).toFixed(2)}` : '',
      hasGstOnBill ? `GST Amount: ${currency} ${Number(invoice.gstAmt || 0).toFixed(2)}` : '',
      ...(Array.isArray(invoice.additionalExpenses) && invoice.additionalExpenses.length > 0 ? invoice.additionalExpenses.map((exp: any) => `Addl Charge (${exp.ledger || 'Exp'}): ${currency} ${Number(exp.amount || 0).toFixed(2)}`) : []),
      (Number(invoice.discount || 0) > 0) ? `Subtotal: ${currency} ${Number(invoice.subtotal || (Number(invoice.total || 0) + Number(invoice.discount || 0))).toFixed(2)}` : '',
      (invoiceSavings.itemDiscountsTotal > 0) ? `Item Discounts: -${currency} ${invoiceSavings.itemDiscountsTotal.toFixed(2)}` : '',
      (Number(invoice.discount || 0) > 0) ? `Bill Discount: -${currency} ${Number(invoice.discount || 0).toFixed(2)}` : '',
      `*GRAND TOTAL: ${currency} ${Number(invoice.total || 0).toFixed(2)}*`,
      (invoiceSavings.totalSavings > 0) ? `*TOTAL SAVINGS: ${currency} ${invoiceSavings.totalSavings.toFixed(2)}*` : '',
      '--------------------------------',
      `Paid: Cash ${currency} ${Number(invoice.cash || 0).toFixed(2)} | Bank ${currency} ${(Number(invoice.bank1 || 0) + Number(invoice.bank2 || 0)).toFixed(2)}`,
      Number(invoice.credit || 0) > 0 ? `⚠️ *Credit Balance Due: ${currency} ${Number(invoice.credit || 0).toFixed(2)}*` : '✅ *Status: Fully Paid*',
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
    try {
      const doc = generateInvoicePDF(invoice, config, { customTerms: resolvedTerms, customBankDetails: effectiveBankDetails });
      doc.save(`Invoice_${invoice.invoiceNo || 'INV'}.pdf`);
    } catch (err) {
      console.error('Download PDF error', err);
    }
  };

  const handleSharePDF = async () => {
    if (!invoice) return;
    try {
      const doc = generateInvoicePDF(invoice, config, { customTerms: resolvedTerms, customBankDetails: effectiveBankDetails });
      const filename = `Invoice_${invoice.invoiceNo || 'INV'}.pdf`;
      await shareOrDownloadPDF(
        doc,
        filename,
        `Tax Invoice #${invoice.invoiceNo || 'INV'} - ${config.CompanyName || 'Store'}`,
        generateInvoiceText()
      );
    } catch (err) {
      console.error('Share PDF error', err);
    }
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
            <div style="font-size: 13px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 3px;">TAX INVOICE</div>
            ${config.ReceiptHeaderImage ? `<div style="margin-bottom: 6px;"><img src="${config.ReceiptHeaderImage}" style="max-width: 100%; max-height: 50px; object-fit: contain;" /></div>` : ''}
            <div style="font-size: 14px; font-weight: bold; text-transform: uppercase;">${config.CompanyName || 'My Retail Store'}</div>
            <div>${config.Address || ''}</div>
            ${showGst ? `<div>GSTIN: ${config.CompanyGSTNo || '-'}</div>` : ''}
          </div>

          <div class="dashed-line"></div>

          ${invoice.status === 'Cancelled' ? '<div class="cancelled-banner">CANCELLED</div>' : ''}

          <div>
            <div><b>Inv #:</b> ${invoice.invoiceNo}</div>
            <div><b>Date:</b> ${formatDateTimeDMY(invoice.date)}</div>
            <div><b>Customer:</b> ${invoice.customer?.name || 'Cash Customer'}</div>
            ${invoice.customer?.phone ? `<div><b>Ph:</b> ${invoice.customer.phone}</div>` : ''}
            ${invoice.customer?.address ? `<div><b>Addr:</b> ${invoice.customer.address}</div>` : ''}
            ${showGst ? `<div><b>Cust GST:</b> ${invoice.customer?.gstNo || '-'}</div>` : ''}
          </div>

          <div class="dashed-line"></div>

          <table>
            <colgroup>
              <col style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '50%' : (!hasDiscountOnBill ? '40%' : (!hasGstOnBill ? '36%' : '28%'))};">
              <col style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '12%' : '10%'};">
              <col style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '18%' : '18%'};">
              ${hasDiscountOnBill ? '<col style="width: 14%;">' : ''}
              ${hasGstOnBill ? '<col style="width: 12%;">' : ''}
              <col style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '20%' : '18%'};">
            </colgroup>
            <thead>
              <tr>
                <th class="text-left">Item</th>
                <th class="text-center">Qty</th>
                <th class="text-right">Rate</th>
                ${hasDiscountOnBill ? '<th class="text-right">Disc</th>' : ''}
                ${hasGstOnBill ? '<th class="text-right">GST%</th>' : ''}
                <th class="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${(Array.isArray(invoice.items) ? invoice.items : []).map(item => {
                const itemQty = Number(item.Qty ?? (item as any).qty ?? 1);
                const pNo = (item as any).partNumber;
                const compat = (item as any).compatibility;
                const discInfo = getItemDiscountDetails(item, config);
                const discStr = discInfo.hasDiscount
                  ? (discInfo.discountPct > 0
                      ? `${discInfo.discountPct % 1 === 0 ? discInfo.discountPct : discInfo.discountPct.toFixed(1)}%`
                      : Number(discInfo.discountAmt).toFixed(2))
                  : '-';
                return `
                <tr>
                  <td class="text-left">
                    <b>${item['Item Name'] || (item as any).itemName || (item as any).name || 'Item'}</b>
                    ${config.PrintPartNumber !== 'false' && pNo ? `<br><span style="font-size: 8px; font-family: monospace;">Part No: ${pNo}</span>` : ''}
                    ${config.PrintCompatibility === 'true' && compat ? `<br><span style="font-size: 8px; color: #555;">Fits: ${compat}</span>` : ''}
                    ${item['Serial Numbers'] ? `<br><span style="font-size: 8px;">SN: ${item['Serial Numbers']}</span>` : ''}
                  </td>
                  <td class="text-center">${item.Qty ?? (item as any).qty ?? 1}</td>
                  <td class="text-right">${Number(item.Rate ?? (item as any).rate ?? 0).toFixed(2)}</td>
                  ${hasDiscountOnBill ? `<td class="text-right">${discStr}</td>` : ''}
                  ${hasGstOnBill ? `<td class="text-right">${item['GST %'] ?? (item as any).gstPct ?? 0}%</td>` : ''}
                  <td class="text-right">${Number(item['Line Total'] ?? (item as any).lineTotal ?? (item as any).amount ?? 0).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <div class="dashed-line"></div>

          ${hasGstOnBill ? `
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
            <div class="summary-row" style="font-weight: bold; color: #166534;">
              <span>Bill Discount:</span>
              <span>-${invoice.discount.toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="total-row">
            <span>Total Invoice Amount:</span>
            <span>${currency} ${invoice.total.toFixed(2)}</span>
          </div>

          ${(totalSavingsIncGst > 0.005 || invoiceSavings.totalSavings > 0) ? `
            <div style="margin: 6px 0 4px 0; padding: 5px 4px; border: 1px dashed #000; font-size: 10px; line-height: 1.45;">
              <div style="background-color: #166534; color: #ffffff; font-weight: bold; font-size: 9.5px; padding: 2px 5px; border-radius: 3px; text-align: left; margin-bottom: 3px; letter-spacing: 0.2px;">
                Your Savings on this bill
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Total Bill Amount (Inc GST):</span>
                <span>${currency} ${undiscountedBillIncGst.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; color: #166534;">
                <span>less Discount (Total Savings):</span>
                <span>-${currency} ${totalSavingsIncGst.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed #000; margin-top: 3px; padding-top: 3px;">
                <span>Net Amount Paid:</span>
                <span>${currency} ${invoice.total.toFixed(2)}</span>
              </div>
            </div>
          ` : ''}

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
              gap: 16px;
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
              width: 275px;
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
                <th style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '54%' : (!hasDiscountOnBill ? '36%' : (!hasGstOnBill ? '44%' : '25%'))};">Item</th>
                <th style="width: 6%;" class="text-center">Qty</th>
                <th style="width: 6%;" class="text-center">Unit</th>
                <th style="width: 10%;" class="text-right">Rate</th>
                ${hasDiscountOnBill ? '<th style="width: 10%;" class="text-right">Disc Amt</th>' : ''}
                ${hasGstOnBill ? '<th style="width: 12%;" class="text-right">Sale Amt</th>' : ''}
                ${hasGstOnBill ? '<th style="width: 12%;" class="text-right">GST (5%)</th>' : ''}
                <th style="width: ${!hasDiscountOnBill && !hasGstOnBill ? '20%' : '15%'};" class="text-right">Total Amt</th>
              </tr>
            </thead>
            <tbody>
              ${(Array.isArray(invoice.items) ? invoice.items : []).map((item, i) => {
                const itemQty = Number(item.Qty ?? (item as any).qty ?? 1);
                const itemRate = Number(item.Rate ?? (item as any).rate ?? 0);
                const discInfo = getItemDiscountDetails(item, config);
                const discAmt = discInfo.hasDiscount ? Number(discInfo.discountAmt || 0) : Number(item.Discount ?? (item as any).discount ?? 0);
                const discStr = discAmt > 0 ? discAmt.toFixed(2) : '-';
                const saleAmt = Number(
                  item['Taxable Value'] !== undefined
                    ? item['Taxable Value']
                    : (itemQty * itemRate - discAmt)
                ).toFixed(2);
                const isZero = (item['Zero Rated (Y/N)'] === 'Y' || (item as any).zeroRated === 'Y' || (item as any).zeroRated === true);
                const gstAmt = Number(
                  item['GST Amount'] !== undefined
                    ? item['GST Amount']
                    : (isZero ? 0 : (((itemQty * itemRate - discAmt) * Number(item['GST %'] ?? (item as any).gstPct ?? 5)) / 100))
                ).toFixed(2);
                const pNo = (item as any).partNumber;
                const compat = (item as any).compatibility;
                return `
                <tr>
                  <td class="text-center">${i + 1}</td>
                  <td>
                    <b>${item['Item Name'] || (item as any).itemName || (item as any).name || 'Item'}</b>
                    ${config.PrintPartNumber !== 'false' && pNo ? `<br><small style="font-family: monospace; color: #1e3a8a; font-weight: 600;">Part No: ${pNo}</small>` : ''}
                    ${config.PrintCompatibility === 'true' && compat ? `<br><small style="color: #475569;">Fits: ${compat}</small>` : ''}
                    ${(item.description || (item as any).Description || item["Item Description"]) ? `<br><small style="color: #475569; font-style: italic;">Desc: ${item.description || (item as any).Description || item["Item Description"]}</small>` : ''}
                    ${item['Serial Numbers'] ? `<br><small style="color: #64748b;">Serial/IMEI: ${item['Serial Numbers']}</small>` : ''}
                  </td>
                  <td class="text-center">${itemQty}</td>
                  <td class="text-center">${item.Unit || (item as any).unit || 'Pcs'}</td>
                  <td class="text-right">${itemRate.toFixed(2)}</td>
                  ${hasDiscountOnBill ? `<td class="text-right">${discStr}</td>` : ''}
                  ${hasGstOnBill ? `<td class="text-right">${saleAmt}</td>` : ''}
                  ${hasGstOnBill ? `<td class="text-right">${gstAmt}</td>` : ''}
                  <td class="text-right" style="font-weight: bold;">${Number(item['Line Total'] ?? (item as any).lineTotal ?? (item as any).amount ?? 0).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="bank-info">
              ${effectiveBankDetails ? `<b>Bank Transfer Details:</b><br><span style="white-space: pre-wrap;">${effectiveBankDetails}</span><br><br>` : ''}
              ${resolvedTerms ? `<div style="margin-top: 8px;"><b>Terms & Conditions:</b><br><span style="white-space: pre-wrap; font-size: 10px; color: #334155;">${resolvedTerms}</span></div>` : ''}
            </div>

            <div class="calc-box">
              ${hasGstOnBill ? `
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
                <span>Total Invoice Amount:</span>
                <span>${currency} ${invoice.total.toFixed(2)}</span>
              </div>
              ${(totalSavingsIncGst > 0.005 || invoiceSavings.totalSavings > 0) ? `
                <div style="margin-top: 6px; padding: 6px 8px; border: 1.5px dashed #16a34a; background-color: #f0fdf4; border-radius: 6px; font-size: 10px; line-height: 1.5;">
                  <div style="background-color: #15803d; color: #ffffff; font-weight: bold; font-size: 10px; padding: 3px 6px; border-radius: 4px; text-align: left; margin-bottom: 4px; letter-spacing: 0.2px;">
                    Your Savings on this bill
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Total Bill Amount (Inc GST):</span>
                    <span>${currency} ${undiscountedBillIncGst.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold; color: #15803d;">
                    <span>less Discount (Total Savings):</span>
                    <span>-${currency} ${totalSavingsIncGst.toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-weight: bold; border-top: 1px dashed #16a34a; margin-top: 3px; padding-top: 3px;">
                    <span>Net Amount Paid:</span>
                    <span>${currency} ${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              ` : ''}
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
                <div className="font-extrabold text-xs uppercase tracking-widest text-slate-900 border-b border-dashed border-slate-300 pb-1 mb-1.5">TAX INVOICE</div>
                <div className="font-bold text-sm uppercase tracking-wide">{config.CompanyName || 'My Retail Store'}</div>
                <div className="text-[10px] text-slate-600">{config.Address || ''}</div>
                {showGst && <div className="text-[10px] text-slate-600">GSTIN: {config.CompanyGSTNo || '-'}</div>}
              </div>

              <div className="my-2 border-b border-dashed border-slate-800" />

              <div className="space-y-0.5">
                <div><b>Inv:</b> {invoice.invoiceNo}</div>
                <div><b>Dt:</b> {formatDateTimeDMY(invoice.date)}</div>
                <div><b>Buyer:</b> {invoice.customer?.name || 'Cash Customer'}</div>
                {invoice.customer?.phone && <div><b>Ph:</b> {invoice.customer.phone}</div>}
                {invoice.customer?.address && <div><b>Addr:</b> {invoice.customer.address}</div>}
                {showGst && <div><b>Cust GST:</b> {invoice.customer?.gstNo || '-'}</div>}
              </div>

              <div className="my-2 border-b border-dashed border-slate-800" />

              <table className="w-full border-collapse text-[10px] table-fixed">
                <colgroup>
                  <col style={{ width: !hasDiscountOnBill && !hasGstOnBill ? '50%' : (!hasDiscountOnBill ? '40%' : (!hasGstOnBill ? '36%' : '28%')) }} />
                  <col style={{ width: !hasDiscountOnBill && !hasGstOnBill ? '12%' : '10%' }} />
                  <col style={{ width: !hasDiscountOnBill && !hasGstOnBill ? '18%' : '18%' }} />
                  {hasDiscountOnBill && <col style={{ width: '14%' }} />}
                  {hasGstOnBill && <col style={{ width: '12%' }} />}
                  <col style={{ width: !hasDiscountOnBill && !hasGstOnBill ? '20%' : '18%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-dashed border-slate-800">
                    <th className="text-left py-1 pr-1 font-bold">Item</th>
                    <th className="text-center py-1 font-bold">Qty</th>
                    <th className="text-right py-1 pr-1 font-bold">Rate</th>
                    {hasDiscountOnBill && <th className="text-right py-1 pr-1 font-bold">Disc</th>}
                    {hasGstOnBill && <th className="text-right py-1 pr-1 font-bold">GST%</th>}
                    <th className="text-right font-bold">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-200">
                  {invoice.items.map((item, idx) => {
                    const discInfo = getItemDiscountDetails(item, config);
                    const discStr = discInfo.hasDiscount
                      ? (discInfo.discountPct > 0
                          ? `${discInfo.discountPct % 1 === 0 ? discInfo.discountPct : discInfo.discountPct.toFixed(1)}%`
                          : Number(discInfo.discountAmt).toFixed(2))
                      : '-';
                    return (
                      <tr key={idx}>
                        <td className="text-left py-1 pr-1 break-words">
                          <div>{item['Item Name']}</div>
                          {item['Serial Numbers'] && (
                            <div className="text-[8px] text-slate-500">SN: {item['Serial Numbers']}</div>
                          )}
                        </td>
                        <td className="text-center py-1 align-top">{item.Qty}</td>
                        <td className="text-right py-1 pr-1 align-top whitespace-nowrap">{Number(item.Rate).toFixed(2)}</td>
                        {hasDiscountOnBill && <td className="text-right py-1 pr-1 align-top whitespace-nowrap">{discStr}</td>}
                        {hasGstOnBill && <td className="text-right py-1 pr-1 align-top whitespace-nowrap">{item['GST %'] || 0}%</td>}
                        <td className="text-right py-1 align-top whitespace-nowrap">{Number(item['Line Total']).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="my-2 border-b border-dashed border-slate-800" />

              {hasGstOnBill && (
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
                <span>Total Invoice Amount:</span>
                <span>{currency} {invoice.total.toFixed(2)}</span>
              </div>

              {(totalSavingsIncGst > 0.005 || invoiceSavings.totalSavings > 0) && (
                <div className="my-2 py-1.5 px-2 border border-dashed border-slate-800 rounded text-[10px] space-y-0.5">
                  <div className="bg-slate-800 text-white font-bold text-[9.5px] px-2 py-0.5 rounded text-left mb-1 inline-block">
                    Your Savings on this bill
                  </div>
                  <div className="flex justify-between">
                    <span>Total Bill Amount (Inc GST):</span>
                    <span>{currency} {undiscountedBillIncGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>less Discount (Total Savings):</span>
                    <span>-{currency} {totalSavingsIncGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-dashed border-slate-400 pt-0.5 mt-0.5">
                    <span>Net Amount Paid:</span>
                    <span>{currency} {invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
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
                  <span className="font-semibold text-slate-700">{formatDateDMY(invoice.date)}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-[11px] min-w-[550px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-center">Unit</th>
                      <th className="p-2 text-right">Rate</th>
                      {hasDiscountOnBill && <th className="p-2 text-right">Disc Amt</th>}
                      {hasGstOnBill && <th className="p-2 text-right">Sale Amt</th>}
                      {hasGstOnBill && <th className="p-2 text-right">GST (5%)</th>}
                      <th className="p-2 text-right">Total Amt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => {
                      const itemQty = Number(item.Qty ?? (item as any).qty ?? 1);
                      const itemRate = Number(item.Rate ?? (item as any).rate ?? 0);
                      const discInfo = getItemDiscountDetails(item, config);
                      const discAmt = discInfo.hasDiscount ? Number(discInfo.discountAmt || 0) : Number(item.Discount ?? (item as any).discount ?? 0);
                      const discStr = discAmt > 0 ? discAmt.toFixed(2) : '-';
                      const saleAmt = Number(
                        item['Taxable Value'] !== undefined
                          ? item['Taxable Value']
                          : itemQty * itemRate - discAmt
                      ).toFixed(2);
                      const isZero = (item['Zero Rated (Y/N)'] === 'Y' || (item as any).zeroRated === 'Y' || (item as any).zeroRated === true);
                      const gstAmt = Number(
                        item['GST Amount'] !== undefined
                          ? item['GST Amount']
                          : (isZero ? 0 : ((Number(saleAmt) * Number(item['GST %'] ?? (item as any).gstPct ?? 5)) / 100))
                      ).toFixed(2);
                      return (
                        <tr key={idx}>
                          <td className="p-2 text-center text-slate-400">{idx + 1}</td>
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
                          <td className="p-2 text-right">{itemRate.toFixed(2)}</td>
                          {hasDiscountOnBill && <td className="p-2 text-right text-slate-700">{discStr}</td>}
                          {hasGstOnBill && <td className="p-2 text-right">{saleAmt}</td>}
                          {hasGstOnBill && <td className="p-2 text-right font-medium text-slate-700">{gstAmt}</td>}
                          <td className="p-2 text-right font-bold text-slate-900">{Number(item['Line Total']).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasGstOnBill && (
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
                <span className="text-slate-700">Total Invoice Amount:</span>
                <span className="text-sm text-indigo-700 font-extrabold">{currency} {invoice.total.toFixed(2)}</span>
              </div>

              {(totalSavingsIncGst > 0.005 || invoiceSavings.totalSavings > 0) && (
                <div className="mt-2 py-2 px-3 border border-dashed border-emerald-600 bg-emerald-50 rounded-lg text-[11px] space-y-1">
                  <div className="bg-emerald-700 text-white font-bold text-[10.5px] px-2 py-0.5 rounded text-left mb-1 inline-block">
                    Your Savings on this bill
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Total Bill Amount (Inc GST):</span>
                    <span className="font-semibold">{currency} {undiscountedBillIncGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-bold">
                    <span>less Discount (Total Savings):</span>
                    <span>-{currency} {totalSavingsIncGst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 border-t border-dashed border-emerald-300 pt-1 mt-1">
                    <span>Net Amount Paid:</span>
                    <span>{currency} {invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Share PDF with WhatsApp/Email/Device */}
            <GlowButton
              type="button"
              onClick={handleSharePDF}
              variant="purple"
              size="sm"
              icon={Share2}
              title="Share attached PDF invoice via WhatsApp, Gmail, or device apps"
            >
              Share PDF
            </GlowButton>

            {/* Save PDF directly */}
            <GlowButton
              type="button"
              onClick={handleDownloadPDF}
              variant="blue"
              size="sm"
              icon={FileDown}
              title="Download professional A4 Tax Invoice PDF"
            >
              Save PDF
            </GlowButton>

            {/* Print A4 */}
            <GlowButton
              type="button"
              onClick={() => printReceipt('a4')}
              variant="cyan"
              size="sm"
              icon={Printer}
              title="Print full page A4 Tax Invoice Document"
            >
              A4 Print
            </GlowButton>

            {/* 3-Inch Thermal */}
            <GlowButton
              type="button"
              onClick={() => printReceipt('thermal')}
              variant="emerald"
              size="sm"
              icon={Printer}
              title="Print 3-Inch Thermal Slip"
            >
              3" Thermal
            </GlowButton>
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

