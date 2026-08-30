import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Replace the specific Rate TD all the way to GST TD
old_td_block = """                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        type="number"
                        step="any"
                        value={line.rate}
                        onChange={e => updateCartLine(idx, 'rate', Number(e.target.value))}
                        className="w-full text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        type="number"
                        step="any"
                        value={line.gstAmt || ''}
                        disabled={isZ}
                        placeholder={isZ ? '0.00' : ''}
                        onChange={e => updateCartLine(idx, 'gstAmt', Number(e.target.value))}
                        className="w-full text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>"""

new_td_block = """                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        type="number"
                        step="any"
                        value={line.rate}
                        onChange={e => updateCartLine(idx, 'rate', Number(e.target.value))}
                        className="w-full text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                      />
                    </td>
                    {showItemDiscount && (
                      <td className="py-1 px-1 align-middle text-right">
                        <input
                          type="number"
                          step="any"
                          value={line.discount || ''}
                          onChange={e => updateCartLine(idx, 'discount', Number(e.target.value))}
                          className="w-full text-right h-8 rounded border border-emerald-300 px-1 text-xs font-semibold text-emerald-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none bg-emerald-50"
                        />
                      </td>
                    )}
                    <td className="py-1 px-1 align-middle text-right">
                      <input
                        type="number"
                        step="any"
                        value={line.gstAmt || ''}
                        disabled={isZ}
                        placeholder={isZ ? '0.00' : ''}
                        onChange={e => updateCartLine(idx, 'gstAmt', Number(e.target.value))}
                        className="w-full text-right h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </td>"""

content = content.replace(old_td_block, new_td_block)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
