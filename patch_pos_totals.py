import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

old_calc = r"""  const calculateTotals = \(\) => \{
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0;
    cart\.forEach\(l => \{"""
new_calc = """  const calculateTotals = () => {
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0, itemDiscountTotal = 0;
    cart.forEach(l => {"""
content = re.sub(old_calc, new_calc, content)

old_loop = r"""      if \(showItemDiscount\) \{
        const rawDisc = Number\(l\.discount\) \|\| 0;
        lineDisc = l\.discountType === 'percent' \? \(\(l\.qty \* l\.rate\) \* rawDisc / 100\) : rawDisc;
      \}"""
new_loop = """      if (showItemDiscount) {
        const rawDisc = Number(l.discount) || 0;
        lineDisc = l.discountType === 'percent' ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
      }
      itemDiscountTotal += lineDisc;"""
content = re.sub(old_loop, new_loop, content)

old_ret = r"""    return \{
      subtotal,
      discount: discountAmt,
      discountType: billDiscountType,
      discountValue: \(showBillDiscount && billDiscount !== ''\) \? Number\(billDiscount\) : 0,
      taxable: round2\(taxable\),
      zeroRated: round2\(zeroRated\),
      gstAmt: round2\(gstAmt\),
      total
    \};"""
new_ret = """    return {
      subtotal,
      discount: discountAmt,
      discountType: billDiscountType,
      discountValue: (showBillDiscount && billDiscount !== '') ? Number(billDiscount) : 0,
      taxable: round2(taxable),
      zeroRated: round2(zeroRated),
      gstAmt: round2(gstAmt),
      itemDiscountTotal: round2(itemDiscountTotal),
      total
    };"""
content = re.sub(old_ret, new_ret, content)

# Check rendering:
old_render = r"""              \{totals\.discount > 0 && \(
                <div className="flex justify-between items-center text-rose-500 font-bold px-1">
                  <span>Discount</span>
                  <span>- \{currency\} \{totals\.discount\.toFixed\(2\)\}</span>
                </div>
              \)\}"""

new_render = """              {totals.itemDiscountTotal > 0 && (
                <div className="flex justify-between items-center text-rose-500 font-bold px-1">
                  <span>Item Disc. Total</span>
                  <span>- {currency} {totals.itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}
              {totals.discount > 0 && (
                <div className="flex justify-between items-center text-rose-500 font-bold px-1">
                  <span>Bill Discount</span>
                  <span>- {currency} {totals.discount.toFixed(2)}</span>
                </div>
              )}"""
content = re.sub(old_render, new_render, content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
