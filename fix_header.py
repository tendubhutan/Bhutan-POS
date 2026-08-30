import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix Order Date -> Invoice Date
content = content.replace('<label className="block text-[11px] font-bold text-slate-700 mb-0.5">Order Date</label>', '<label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice Date</label>')
content = content.replace('<label className="block text-[11px] font-bold text-slate-700 mb-0.5">Order / Ref No</label>', '<label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice / Ref No</label>')

# Add new fields below
new_fields = """          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Order No</label>
            <input
              type="text"
              value={orderNo}
              onChange={e => setOrderNo(e.target.value)}
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="PO-1234"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Order Date</label>
            <input
              type="date"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Delivery Note No</label>
            <input
              type="text"
              value={deliveryNoteNo}
              onChange={e => setDeliveryNoteNo(e.target.value)}
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              placeholder="DN-1234"
            />"""

content = content.replace("""              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>
        </div>
      )}""", """              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
            />""" + new_fields + """
          </div>
        </div>
      )}""")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
