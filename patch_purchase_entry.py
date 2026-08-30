import re

with open("src/components/PurchaseEntry.tsx", "r") as f:
    content = f.read()

# Fix updateCartLine signature
content = content.replace("field: 'qty' | 'rate' | 'gstAmt' | 'discount' | 'lineDescription'", "field: 'qty' | 'rate' | 'gstAmt' | 'discount' | 'discountType' | 'lineDescription'")
content = content.replace("if (field === 'qty' || field === 'rate' || field === 'discount') {", "if (field === 'qty' || field === 'rate' || field === 'discount' || field === 'discountType') {")

old_line_disc_upd = "const lineDisc = showItemDiscount ? (Number(updated[index].discount) || 0) : 0;"
new_line_disc_upd = """      let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(updated[index].discount) || 0;
        lineDisc = updated[index].discountType === 'percent' ? ((updated[index].qty * updated[index].rate) * rawDisc / 100) : rawDisc;
      }"""
content = content.replace(old_line_disc_upd, new_line_disc_upd)

old_line_disc_calc = "const lineDisc = showItemDiscount ? (Number(l.discount) || 0) : 0;"
new_line_disc_calc = """      let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(l.discount) || 0;
        lineDisc = l.discountType === 'percent' ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
      }"""
content = content.replace(old_line_disc_calc, new_line_disc_calc)

old_line_disc_render = "const lineDisc = showItemDiscount ? (Number(line.discount) || 0) : 0;"
new_line_disc_render = """                  let lineDisc = 0;
                  if (showItemDiscount) {
                    const rawDisc = Number(line.discount) || 0;
                    lineDisc = line.discountType === 'percent' ? ((line.qty * line.rate) * rawDisc / 100) : rawDisc;
                  }"""
content = content.replace(old_line_disc_render, new_line_disc_render)

old_exempt_ui = """                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""
content = content.replace(old_exempt_ui, "")

# Grid fixing
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

with open("src/components/PurchaseEntry.tsx", "w") as f:
    f.write(content)
