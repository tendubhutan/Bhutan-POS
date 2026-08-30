import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

good_block = """
              {/* Discount Modules */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableItemDiscount === "true"}
                    onChange={e => setForm({ ...form, EnableItemDiscount: e.target.checked ? "true" : "false" })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Item-wise Discount</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Allow discounts per individual item in invoices.</p>
                </div>
              </label>

              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableBillDiscount === "true"}
                    onChange={e => setForm({ ...form, EnableBillDiscount: e.target.checked ? "true" : "false" })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Bill Lumpsum Discount</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Allow a single flat or percentage discount on the entire bill.</p>
                </div>
              </label>
"""

# Find the Asset Management label and insert before it
pattern = r'(\{\/\* Asset Management Module \*\/})'
if re.search(pattern, content):
    content = re.sub(pattern, good_block + r'\n              \1', content)
else:
    print("Could not find Asset Management Module")

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
