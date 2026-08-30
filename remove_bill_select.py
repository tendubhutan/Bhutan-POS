import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

old_bill_ui = r"""                <select
                  value=\{billDiscountType\}
                  onChange=\{e => setBillDiscountType\(e\.target\.value as 'flat' \| 'percent'\)\}
                  className="h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 outline-none bg-slate-50"
                >
                  <option value="flat">Flat \(\{config\.CurrencySymbol \|\| 'Nu\.'\}\)</option>
                  <option value="percent">%</option>
                </select>"""

new_bill_ui = """                <div className="h-8 rounded border border-slate-300 px-2 flex items-center bg-slate-50 text-xs font-semibold text-slate-600">
                  {config.BillDiscountType === 'percent' ? '%' : (config.CurrencySymbol || 'Nu.')}
                </div>"""

content = re.sub(old_bill_ui, new_bill_ui, content)

# Calculation update
old_calc = r"""    if \(showBillDiscount && billDiscount !== ''\) \{
      const d = Number\(billDiscount\);
      if \(billDiscountType === 'percent'\) \{
        discountAmt = \(rawTotal \* d\) / 100;
      \} else \{
        discountAmt = d;
      \}
    \}"""

new_calc = """    if (showBillDiscount && billDiscount !== '') {
      const d = Number(billDiscount);
      if (config.BillDiscountType === 'percent') {
        discountAmt = (rawTotal * d) / 100;
      } else {
        discountAmt = d;
      }
    }"""
content = re.sub(old_calc, new_calc, content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
