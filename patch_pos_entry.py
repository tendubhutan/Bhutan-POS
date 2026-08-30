import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Fix lineDisc calc in updateCartItem
old_line_disc_upd = "const lineDisc = showItemDiscount ? (Number(updatedCart[idx].discount) || 0) : 0;"
new_line_disc_upd = """      let lineDisc = 0;
      if (showItemDiscount) {
        const rawDisc = Number(updatedCart[idx].discount) || 0;
        lineDisc = updatedCart[idx].discountType === 'percent' ? ((updatedCart[idx].qty * updatedCart[idx].rate) * rawDisc / 100) : rawDisc;
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
new_line_disc_render = """                      let lineDisc = 0;
                      if (showItemDiscount) {
                        const rawDisc = Number(line.discount) || 0;
                        lineDisc = line.discountType === 'percent' ? ((line.qty * line.rate) * rawDisc / 100) : rawDisc;
                      }"""
content = content.replace(old_line_disc_render, new_line_disc_render)

old_exempt_ui = """                                {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                                {isZero && <span className="bg-emerald-100 text-emerald-800 px-1 rounded font-bold">Exempt</span>}"""
content = content.replace(old_exempt_ui, "")

# Grid fixing
old_colgroup = """                  {showItemDiscount ? (
                    <>
                      <col style={{ width: '36%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: '42%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  )}"""

new_colgroup = """                  {showItemDiscount ? (
                    <>
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  ) : (
                    <>
                      <col style={{ width: '42%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '5%' }} />
                    </>
                  )}"""
content = content.replace(old_colgroup, new_colgroup)

old_disc_td = """                          {showItemDiscount && (
                            <td className="py-1 px-1 align-middle text-right">
                              <input
                                ref={el => { cartDiscRefs.current[idx] = el; }}
                                type="number"
                                step="any"
                                value={line.discount || ''}
                                onChange={e => updateCartItem(idx, 'discount', Number(e.target.value))}
                                onKeyDown={e => handleCartGridKeyDown(e, idx, 'discount')}
                                className="w-full text-right h-7 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                              />
                            </td>
                          )}"""

new_disc_td = """                          {showItemDiscount && (
                            <td className="py-1 px-1 align-middle text-right">
                              <div className="flex items-center gap-0.5 justify-end">
                                <input
                                  ref={el => { cartDiscRefs.current[idx] = el; }}
                                  type="number"
                                  step="any"
                                  value={line.discount || ''}
                                  onChange={e => updateCartItem(idx, 'discount', Number(e.target.value))}
                                  onKeyDown={e => handleCartGridKeyDown(e, idx, 'discount')}
                                  className="w-full min-w-[30px] text-right h-7 rounded-md border border-slate-300 px-1.5 text-xs font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none bg-white hover:border-slate-400 py-0"
                                />
                                <select
                                  value={line.discountType || 'flat'}
                                  onChange={e => updateCartItem(idx, 'discountType', e.target.value)}
                                  className="h-7 rounded-md border border-slate-300 px-0.5 text-[10px] font-semibold focus:border-indigo-500 outline-none bg-slate-50 w-7"
                                >
                                  <option value="flat">#</option>
                                  <option value="percent">%</option>
                                </select>
                              </div>
                            </td>
                          )}"""
content = content.replace(old_disc_td, new_disc_td)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
