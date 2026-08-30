import re

def patch_file(filename):
    with open(filename, "r") as f:
        content = f.read()

    # 1. Update calculateTotals
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
      taxable,
      zeroRated,
      gstAmt,
      subtotal: rawTotal,
      discount: discountAmt,
      total: finalTotal
    \};"""
    
    new_ret = """    return {
      taxable,
      zeroRated,
      gstAmt,
      subtotal: rawTotal,
      discount: discountAmt,
      itemDiscountTotal,
      total: finalTotal
    };"""
    
    content = re.sub(old_ret, new_ret, content)
    
    # 2. Update Bill Breakdown rendering
    # Look for {totals.discount > 0 && (
    old_disc_render = r"""            \{totals\.discount > 0 && \(
              <div className="flex items-center justify-between text-emerald-400">
                <span className="font-medium">Discount</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">
                  -<span className="text-\[11px\] text-emerald-500 font-normal mr-1">\{config\.CurrencySymbol \|\| 'Nu\.'\}</span>
                  \{totals\.discount\.toLocaleString\('en-US', \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)\}
                </span>
              </div>
            \)\}"""

    new_disc_render = """            {totals.itemDiscountTotal > 0 && (
              <div className="flex items-center justify-between text-emerald-400">
                <span className="font-medium">Item Disc. Total</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">
                  -<span className="text-[11px] text-emerald-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                  {totals.itemDiscountTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="flex items-center justify-between text-emerald-400">
                <span className="font-medium">Bill Discount</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">
                  -<span className="text-[11px] text-emerald-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                  {totals.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}"""
            
    content = re.sub(old_disc_render, new_disc_render, content)
    
    with open(filename, "w") as f:
        f.write(content)

patch_file("src/components/SalesInvoiceEntry.tsx")
patch_file("src/components/PurchaseEntry.tsx")
