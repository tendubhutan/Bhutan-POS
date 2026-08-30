import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Update colgroup
old_colgroup = """            <colgroup>
              <col style={{ width: '32%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""
new_colgroup = """            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>"""
content = content.replace(old_colgroup, new_colgroup)

# Update thead
old_thead = """              <tr>
                <th className="py-2.5 px-3 text-left">Item Description</th>
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
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>
              </tr>"""
content = content.replace(old_thead, new_thead)

# Update row rendering
old_row = """                    <div className="font-bold text-slate-800 line-clamp-2 leading-tight">
                      {line.itemName}
                    </div>
                  </td>
                  <td className="py-1.5 px-1 text-center">"""
new_row = """                    <div className="font-bold text-slate-800 line-clamp-2 leading-tight">
                      {line.itemName}
                    </div>
                  </td>
                  <td className="py-1.5 px-1 align-top">
                    <textarea
                      rows={2}
                      className="w-full text-xs p-1 border border-slate-200 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                      placeholder="Custom line description..."
                      value={line.description || ''}
                      onChange={(e) => {
                        const updated = [...cart];
                        updated[idx].description = e.target.value;
                        setCart(updated);
                      }}
                    />
                  </td>
                  <td className="py-1.5 px-1 text-center align-top">"""
content = content.replace(old_row, new_row)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
