import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

old_disc_td = r'''                    \{showItemDiscount && \(
                      <td className="py-1 px-1 align-middle text-right">
                        <input
                          type="number"
                          step="any"
                          value=\{line.discount \|\| ''\}
                          onChange=\{e => updateCartLine\(idx, 'discount', Number\(e.target.value\)\)\}
                          className="w-full text-right h-8 rounded border border-emerald-300 px-1 text-xs font-semibold text-emerald-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-emerald-50"
                        />
                      </td>
                    \)\}'''

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

content = re.sub(old_disc_td, new_disc_td, content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
