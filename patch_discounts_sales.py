import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Replace states
old_states = """  const [showItemDiscount, setShowItemDiscount] = useState(false);
  const [showBillDiscount, setShowBillDiscount] = useState(false);"""

new_states = """  const [showItemDiscount] = useState(config.EnableItemDiscount === 'true');
  const [showBillDiscount] = useState(config.EnableBillDiscount === 'true');"""

content = content.replace(old_states, new_states)

# Replace the checkboxes
old_checkboxes = """          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
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
            <textarea
              value={termsAndConditions}
              onChange={e => setTermsAndConditions(e.target.value)}
              placeholder="Terms and conditions..."
              rows={3}
              className="w-full text-xs p-2 border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
            />
          </div>"""

new_textarea = """          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Terms & Conditions</label>
            <textarea
              value={termsAndConditions}
              onChange={e => setTermsAndConditions(e.target.value)}
              placeholder="Terms and conditions..."
              rows={3}
              className="w-full text-xs p-2 border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
            />
          </div>"""

content = content.replace(old_checkboxes, new_textarea)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
