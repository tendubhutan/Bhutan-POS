import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

old_block = """          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                <input type="checkbox" checked={showItemDiscount} onChange={e => setShowItemDiscount(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Enable Item-wise Discount
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                <input type="checkbox" checked={showBillDiscount} onChange={e => setShowBillDiscount(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Enable Bill Lumpsum Discount
              </label>
            </div>
            <textarea"""

new_block = """          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Terms & Conditions</label>
            <textarea"""

content = content.replace(old_block, new_block)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
