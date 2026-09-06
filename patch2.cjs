const fs = require('fs');
const file = 'src/services/storageService.ts';
let content = fs.readFileSync(file, 'utf8');

const newFunc = `

export function getItemProfitabilityDetail(itemCode: string, from?: string, to?: string) {
  const fr = from ? new Date(from).setHours(0, 0, 0, 0) : 0;
  const toDt = to ? new Date(to).setHours(23, 59, 59, 999) : Date.now();
  
  const items = loadJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  const masterItem = items.find((i: any) => i['Item Code'] === itemCode);
  const purchaseRate = masterItem ? (Number(masterItem['Purchase Rate']) || 0) : 0;
  
  const sales = getDeduplicatedSales();
  const inPeriodInvs = sales.filter((r: any) => {
    const d = new Date(r.date).getTime();
    return d >= fr && d <= toDt;
  });

  const detailRows: Array<{
    date: string;
    invoiceNo: string;
    qty: number;
    purchasePrice: number;
    salePrice: number;
    totalRevenue: number;
    grossProfit: number;
    profitPct: number;
  }> = [];

  inPeriodInvs.forEach((inv: any) => {
    inv.items.forEach((r: any) => {
      if (r['Item Code'] === itemCode) {
        const q = Number(r.Qty) || 0;
        if (q > 0) {
          const lTot = (q * (Number(r.Rate) || 0)) - (Number(r.Discount) || 0);
          const salePricePerUnit = lTot / q;
          const grossProfit = lTot - (purchaseRate * q);
          const profitPct = lTot !== 0 ? (grossProfit / Math.abs(lTot)) * 100 : 0;

          detailRows.push({
            date: inv.date,
            invoiceNo: inv.invoiceNo,
            qty: q,
            purchasePrice: purchaseRate,
            salePrice: salePricePerUnit,
            totalRevenue: lTot,
            grossProfit: grossProfit,
            profitPct: profitPct
          });
        }
      }
    });
  });

  // Sort by date descending
  detailRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    itemCode,
    itemName: masterItem ? masterItem['Item Name'] : itemCode,
    rows: detailRows
  };
}`;

if (!content.includes('getItemProfitabilityDetail')) {
  content = content + newFunc;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Added getItemProfitabilityDetail');
} else {
  console.log('Already exists');
}
