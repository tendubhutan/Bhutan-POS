/**
 * Utility functions for calculating and formatting item-level discounts,
 * bill discounts, and customer total savings across receipts and invoices.
 */

export interface ItemDiscountDetails {
  hasDiscount: boolean;
  discountAmt: number;
  discountPct: number;
  displayText: string;
}

export function getItemDiscountDetails(item: any, config?: any): ItemDiscountDetails {
  if (!item) {
    return { hasDiscount: false, discountAmt: 0, discountPct: 0, displayText: '' };
  }

  const qty = Number(item.Qty ?? item.qty ?? 1);
  const rate = Number(item.Rate ?? item.rate ?? 0);
  const rawDisc = Number(item.Discount ?? item.discount ?? 0);
  const gross = Math.abs(qty) * rate;

  let discAmt = 0;
  let discPct = 0;

  // 1. Explicit discountAmt saved on line
  if (item.discountAmt !== undefined && Number(item.discountAmt) > 0) {
    discAmt = Number(item.discountAmt);
    discPct = gross > 0 ? (discAmt / gross) * 100 : (item.discountType === 'percent' ? rawDisc : 0);
  }
  // 2. Percent-based discount
  else if (item.discountType === 'percent' || (config?.ItemDiscountType === 'percent' && rawDisc > 0)) {
    discPct = rawDisc;
    discAmt = gross > 0 ? (gross * discPct) / 100 : 0;
  }
  // 3. Flat numeric discount
  else if (rawDisc > 0) {
    discAmt = rawDisc;
    discPct = gross > 0 ? (discAmt / gross) * 100 : 0;
  }
  // 4. Inferred discount from Taxable Value (e.g. historical invoices or scheme rate reductions)
  else if (gross > 0 && item['Taxable Value'] !== undefined) {
    const taxable = Number(item['Taxable Value']);
    if (taxable >= 0 && taxable < gross - 0.01) {
      discAmt = gross - taxable;
      discPct = (discAmt / gross) * 100;
    }
  }

  discAmt = Math.max(0, Math.round(discAmt * 100) / 100);
  discPct = Math.max(0, Math.round(discPct * 10) / 10);

  const hasDiscount = discAmt > 0.005;
  let displayText = '';
  if (hasDiscount) {
    if (discPct > 0) {
      const formattedPct = Math.abs(discPct - Math.round(discPct)) < 0.1 ? Math.round(discPct) : discPct.toFixed(1);
      displayText = `Disc: ${formattedPct}% (-${discAmt.toFixed(2)})`;
    } else {
      displayText = `Disc: -${discAmt.toFixed(2)}`;
    }
  }

  return {
    hasDiscount,
    discountAmt: discAmt,
    discountPct: discPct,
    displayText
  };
}

export function calculateInvoiceSavings(invoice: any, config?: any) {
  if (!invoice) {
    return { itemDiscountsTotal: 0, billDiscount: 0, totalSavings: 0 };
  }

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  let itemDiscountsTotal = 0;

  items.forEach((it: any) => {
    const d = getItemDiscountDetails(it, config);
    if (d.hasDiscount) {
      itemDiscountsTotal += d.discountAmt;
    }
  });

  const billDiscount = Number(invoice.discount ?? invoice.billDiscount ?? 0);
  const totalSavings = itemDiscountsTotal + billDiscount;

  return {
    itemDiscountsTotal: Math.round(itemDiscountsTotal * 100) / 100,
    billDiscount: Math.round(billDiscount * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100
  };
}

export function calculateUndiscountedBillAndSavings(invoice: any, config?: any) {
  if (!invoice) {
    return { undiscountedBillIncGst: 0, totalSavingsIncGst: 0, netAmountPaid: 0 };
  }

  const safeItems = Array.isArray(invoice.items) ? invoice.items : [];
  let undiscountedTaxable = 0;
  let undiscountedZeroRated = 0;
  let undiscountedGst = 0;

  safeItems.forEach((item: any) => {
    const qty = Number(item.Qty ?? item.qty ?? 1);
    const rate = Number(item.originalRate !== undefined ? item.originalRate : (item.Rate ?? item.rate ?? 0));
    const gross = qty * rate;
    const isZero = (item['Zero Rated (Y/N)'] === 'Y' || item.zeroRated === 'Y' || item.zeroRated === true);
    const gstPct = Number(item['GST %'] ?? item.gstPct ?? (config?.gstPct ?? 5));

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

  return { undiscountedBillIncGst, totalSavingsIncGst, netAmountPaid };
}
