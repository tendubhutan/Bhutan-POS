import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix colgroup
old_colgroup = """            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""
new_colgroup = """            <colgroup>
              <col style={{ width: showItemDiscount ? '20%' : '24%' }} />
              <col style={{ width: showItemDiscount ? '16%' : '20%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              {showItemDiscount && <col style={{ width: '8%' }} />}
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""
content = content.replace(old_colgroup, new_colgroup)

# Fix thead
old_thead = """              <tr>
                <th className="py-2.5 px-3 text-left">Item Name</th>
                <th className="py-2.5 px-1 text-left">Line Description</th>
                <th className="py-2.5 px-1 text-center">Qty</th>
                <th className="py-2.5 px-1 text-center">Unit</th>
                <th className="py-2.5 px-1 text-right">Rate</th>
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>
              </tr>"""
new_thead = """              <tr>
                <th className="py-2.5 px-3 text-left">Item Name</th>
                <th className="py-2.5 px-1 text-left">Line Description</th>
                <th className="py-2.5 px-1 text-center">Qty</th>
                <th className="py-2.5 px-1 text-center">Unit</th>
                <th className="py-2.5 px-1 text-right">Rate</th>
                {showItemDiscount && <th className="py-2.5 px-1 text-right">Disc</th>}
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>
              </tr>"""
content = content.replace(old_thead, new_thead)

# Fix row body
old_td_rate = """                  <td className="py-1.5 px-1 text-right align-top">
                    <input
                      type="number"
                      className="w-full text-right bg-transparent border-0 border-b border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-1 py-1"
                      value={line.rate || ''}
                      onChange={(e) => {
                        const updated = [...cart];
                        updated[idx].rate = Number(e.target.value);
                        setCart(updated);
                      }}
                    />
                  </td>
                  <td className="py-1.5 px-1 text-right align-top">"""
new_td_rate = """                  <td className="py-1.5 px-1 text-right align-top">
                    <input
                      type="number"
                      className="w-full text-right bg-transparent border-0 border-b border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-1 py-1"
                      value={line.rate || ''}
                      onChange={(e) => {
                        const updated = [...cart];
                        updated[idx].rate = Number(e.target.value);
                        setCart(updated);
                      }}
                    />
                  </td>
                  {showItemDiscount && (
                    <td className="py-1.5 px-1 text-right align-top">
                      <input
                        type="number"
                        className="w-full text-right bg-transparent border-0 border-b border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-1 py-1 text-emerald-600 font-medium"
                        value={line.discount || ''}
                        onChange={(e) => {
                          const updated = [...cart];
                          updated[idx].discount = Number(e.target.value);
                          setCart(updated);
                        }}
                      />
                    </td>
                  )}
                  <td className="py-1.5 px-1 text-right align-top">"""
content = content.replace(old_td_rate, new_td_rate)

# Fix Amount calculation inside the grid
old_amount = """<div className="font-bold text-slate-900">{((line.qty * line.rate) + (Number(line.gstAmt) || 0)).toFixed(2)}</div>"""
new_amount = """<div className="font-bold text-slate-900">{(((line.qty * line.rate) - (showItemDiscount ? (Number(line.discount) || 0) : 0)) + (Number(line.gstAmt) || 0)).toFixed(2)}</div>"""
content = content.replace(old_amount, new_amount)


with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
