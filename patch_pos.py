import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

old_td = r"""                    \{showItemDiscount && \(
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center gap-0\.5 justify-end">
                          <input
                            type="number"
                            step="any"
                            value=\{line\.discount \|\| ''\}
                            onChange=\{e => updateCartLine\(idx, 'discount', Number\(e\.target\.value\)\)\}
                            className="w-12 text-right h-7 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                          />
                          <select
                            value=\{line\.discountType \|\| 'flat'\}
                            onChange=\{e => updateCartLine\(idx, 'discountType', e\.target\.value\)\}
                            className="h-7 rounded border border-slate-300 px-0\.5 text-\[9px\] font-semibold focus:border-indigo-500 outline-none bg-slate-50 w-7"
                          >
                            <option value="flat">#</option>
                            <option value="percent">%</option>
                          </select>
                        </div>
                      </td>
                    \)\}"""

new_td = """                    {showItemDiscount && (
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.discount || ''}
                          onChange={e => updateCartLine(idx, 'discount', Number(e.target.value))}
                          placeholder={config.ItemDiscountType === 'percent' ? '%' : '#'}
                          className="w-16 text-right h-7 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                        />
                      </td>
                    )}"""

content = re.sub(old_td, new_td, content)

old_th = r"""\{showItemDiscount && <th className="py-3 px-2 text-right">Disc</th>\}"""
new_th = """{showItemDiscount && <th className="py-3 px-2 text-right">Disc {config.ItemDiscountType === 'percent' ? '(%)' : '(#)'}</th>}"""
content = re.sub(old_th, new_th, content)

old_calc = r"""      if \(showItemDiscount\) \{
        const rawDisc = Number\(l\.discount\) \|\| 0;
        lineDisc = l\.discountType === 'percent' \? \(\(l\.qty \* l\.rate\) \* rawDisc / 100\) : rawDisc;
      \}"""
new_calc = """      if (showItemDiscount) {
        const rawDisc = Number(l.discount) || 0;
        lineDisc = config.ItemDiscountType === 'percent' ? ((l.qty * l.rate) * rawDisc / 100) : rawDisc;
      }"""
content = re.sub(old_calc, new_calc, content)

old_line_disc = r"""                  if \(showItemDiscount\) \{
                    const rawDisc = Number\(line\.discount\) \|\| 0;
                    lineDisc = line\.discountType === 'percent' \? \(\(line\.qty \* line\.rate\) \* rawDisc / 100\) : rawDisc;
                  \}"""
new_line_disc = """                  if (showItemDiscount) {
                    const rawDisc = Number(line.discount) || 0;
                    lineDisc = config.ItemDiscountType === 'percent' ? ((line.qty * line.rate) * rawDisc / 100) : rawDisc;
                  }"""
content = re.sub(old_line_disc, new_line_disc, content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
