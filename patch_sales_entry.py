import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix updateCartLine signature
content = content.replace("field: 'qty' | 'rate' | 'gstAmt' | 'discount' | 'lineDescription'", "field: 'qty' | 'rate' | 'gstAmt' | 'discount' | 'discountType' | 'lineDescription'")
content = content.replace("if (field === 'qty' || field === 'rate' || field === 'discount') {", "if (field === 'qty' || field === 'rate' || field === 'discount' || field === 'discountType') {")

# Fix lineDisc calc in updateCartLine
old_line_disc_upd = "const lineDisc = showItemDiscount ? (Number(updated[index].discount) || 0) : 0;"
new_line_disc_upd = """      let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(updated[index].discount) || 0;
        lineDisc = updated[index].discountType === 'percent' ? ((updated[index].qty * updated[index].rate) * rawDisc / 100) : rawDisc;
      }"""
content = content.replace(old_line_disc_upd, new_line_disc_upd)

# Fix lineDisc calc in calculateTotals
old_line_disc_calc = "const lineDisc = showItemDiscount ? (Number(l.discount) || 0) : 0;"
new_line_disc_calc = """      let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(l.discount) || 0;
        lineDisc = l.discountType === 'percent' ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
      }"""
content = content.replace(old_line_disc_calc, new_line_disc_calc)

# Fix lineDisc in render
old_line_disc_render = "const lineDisc = showItemDiscount ? (Number(line.discount) || 0) : 0;"
new_line_disc_render = """                  let lineDisc = 0;
                  if (showItemDiscount) {
                    const rawDisc = Number(line.discount) || 0;
                    lineDisc = line.discountType === 'percent' ? ((line.qty * line.rate) * rawDisc / 100) : rawDisc;
                  }"""
content = content.replace(old_line_disc_render, new_line_disc_render)

# Remove the bad "Terms & Conditions" block and fix the bill discount layout
old_bill_summary_start = r'''          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Terms & Conditions</label>'''

content = re.sub(old_bill_summary_start, "", content, count=1)

# Now fix the rendering of the discount inputs in the table
old_th = """                <th className="py-2.5 px-3 text-left">Item Name & Description</th>
                <th className="py-2.5 px-1 text-center">Qty</th>
                <th className="py-2.5 px-1 text-center">Unit</th>
                <th className="py-2.5 px-1 text-right">Rate</th>
                {showItemDiscount && <th className="py-2.5 px-1 text-right">Disc</th>}
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>"""

new_th = """                <th className="py-2.5 px-3 text-left">Item Name & Description</th>
                <th className="py-2.5 px-1 text-center">Qty</th>
                <th className="py-2.5 px-1 text-center">Unit</th>
                <th className="py-2.5 px-1 text-right">Rate</th>
                {showItemDiscount && <th className="py-2.5 px-1 text-right">Disc</th>}
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>"""

# Wait, the column alignment issue is because of colgroup
old_colgroup = """            <colgroup>
              <col style={{ width: showItemDiscount ? '36%' : '44%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              {showItemDiscount && <col style={{ width: '8%' }} />}
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""

new_colgroup = """            <colgroup>
              <col style={{ width: showItemDiscount ? '30%' : '44%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              {showItemDiscount && <col style={{ width: '14%' }} />}
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""
content = content.replace(old_colgroup, new_colgroup)

old_disc_td = """                    {showItemDiscount && (
                      <td className="py-1 px-1 align-middle text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.discount || ''}
                          onChange={e => updateCartLine(idx, 'discount', Number(e.target.value))}
                          className="w-full text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                        />
                      </td>
                    )}"""

new_disc_td = """                    {showItemDiscount && (
                      <td className="py-1 px-1 align-middle text-right">
                        <div className="flex items-center gap-0.5 justify-end">
                          <input
                            type="number"
                            step="any"
                            value={line.discount || ''}
                            onChange={e => updateCartLine(idx, 'discount', Number(e.target.value))}
                            className="w-full min-w-[30px] text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                          />
                          <select
                            value={line.discountType || 'flat'}
                            onChange={e => updateCartLine(idx, 'discountType', e.target.value)}
                            className="h-8 rounded border border-slate-300 px-0.5 text-[10px] font-semibold focus:border-indigo-500 outline-none bg-slate-50 w-8"
                          >
                            <option value="flat">#</option>
                            <option value="percent">%</option>
                          </select>
                        </div>
                      </td>
                    )}"""
content = content.replace(old_disc_td, new_disc_td)

# Remove the "Exempt" badge and "GST: X%" from item description cell
old_exempt_ui = """                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""
content = content.replace(old_exempt_ui, "")

# Remove the duplicate bill summary block logic that might have been mangled
old_bill_discount = r'''                        {showBillDiscount && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Bill Disc"
                  value={billDiscount}
                  onChange={e => setBillDiscount(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-24 text-right h-8 rounded border border-slate-300 px-2 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
                />
                <select
                  value={billDiscountType}
                  onChange={e => setBillDiscountType(e.target.value as 'flat' | 'percent')}
                  className="h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 outline-none bg-slate-50"
                >
                  <option value="flat">Flat ({config.CurrencySymbol || 'Nu.'})</option>
                  <option value="percent">%</option>
                </select>
              </div>
            )}'''

content = re.sub(old_bill_discount, "", content, count=1, flags=re.DOTALL)


# Let's cleanly inject the Bill Discount + Terms block right before the Bill Breakdown Header
old_block_target = r'''        {/\* Bill Breakdown Header: Taxable Sale, Exempted Sale, GST & Total Invoice Amount \*/}'''

new_discount_block = '''
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-1">
          <div className="lg:col-span-2 space-y-3">
            {showBillDiscount && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <label className="block text-xs font-bold text-slate-700">Bill Lumpsum Discount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Discount"
                    value={billDiscount}
                    onChange={e => setBillDiscount(e.target.value !== '' ? Number(e.target.value) : '')}
                    className="w-24 text-right h-8 rounded border border-slate-300 px-2 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                  />
                  <select
                    value={billDiscountType}
                    onChange={e => setBillDiscountType(e.target.value as 'flat' | 'percent')}
                    className="h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 outline-none bg-slate-50"
                  >
                    <option value="flat">Flat ({config.CurrencySymbol || 'Nu.'})</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
            )}

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Terms & Conditions / Invoice Notes</label>
              <textarea
                rows={2}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                placeholder="Enter terms and conditions or specific notes for this invoice..."
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
              />
            </div>
          </div>
'''
# We will inject this later, first let's see how much we messed up the layout in the previous patching.
with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
