import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

old_bill_ui = r"""                <select
                  value=\{billDiscountType\}
                  onChange=\{e => setBillDiscountType\(e\.target\.value as 'flat' \| 'percent'\)\}
                  className="w-10 rounded border border-slate-300 px-0\.5 text-\[10px\] font-semibold focus:border-indigo-500 outline-none bg-slate-50"
                >
                  <option value="flat">#</option>
                  <option value="percent">%</option>
                </select>"""

new_bill_ui = """                <div className="w-10 h-7 rounded border border-slate-300 px-1 flex items-center justify-center bg-slate-50 text-[10px] font-semibold text-slate-600">
                  {config.BillDiscountType === 'percent' ? '%' : '#'}
                </div>"""

content = re.sub(old_bill_ui, new_bill_ui, content)

old_calc = r"""    if \(showBillDiscount && billDiscount !== '' && Number\(billDiscount\) > 0\) \{
      if \(billDiscountType === 'percent'\) \{
        discountAmt = round2\(\(subtotal \* Number\(billDiscount\)\) / 100\);
      \} else \{
        discountAmt = round2\(Number\(billDiscount\)\);
      \}
    \}"""

new_calc = """    if (showBillDiscount && billDiscount !== '' && Number(billDiscount) > 0) {
      if (config.BillDiscountType === 'percent') {
        discountAmt = round2((subtotal * Number(billDiscount)) / 100);
      } else {
        discountAmt = round2(Number(billDiscount));
      }
    }"""
content = re.sub(old_calc, new_calc, content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
