import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix colgroup
old_colgroup = """            <colgroup>
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
new_colgroup = """            <colgroup>
              <col style={{ width: showItemDiscount ? '36%' : '44%' }} />
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
                {showItemDiscount && <th className="py-2.5 px-1 text-right">Disc</th>}
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>
              </tr>"""
new_thead = """              <tr>
                <th className="py-2.5 px-3 text-left">Item Name & Description</th>
                <th className="py-2.5 px-1 text-center">Qty</th>
                <th className="py-2.5 px-1 text-center">Unit</th>
                <th className="py-2.5 px-1 text-right">Rate</th>
                {showItemDiscount && <th className="py-2.5 px-1 text-right">Disc</th>}
                <th className="py-2.5 px-1 text-right">GST</th>
                <th className="py-2.5 px-2 text-right">Amount</th>
                <th className="py-2.5 px-1 text-center">Act</th>
              </tr>"""
content = content.replace(old_thead, new_thead)

# Replace Item Code with Line Description
old_td = """                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 align-middle font-medium text-slate-800 break-words">
                      <div className="font-semibold text-slate-900">{line.itemName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Code: {line.itemCode}</span>
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""
new_td = """                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 align-top font-medium text-slate-800 break-words">
                      <div className="font-semibold text-slate-900">{line.itemName}</div>
                      <div className="mt-1">
                        <input
                          type="text"
                          placeholder="Line description..."
                          value={line.lineDescription || ''}
                          onChange={e => updateCartLine(idx, 'lineDescription', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-dashed border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-0 py-0.5"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""
content = content.replace(old_td, new_td)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
