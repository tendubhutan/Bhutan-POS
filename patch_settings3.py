import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

# Let's see if we can find Asset Management and insert after it.
new_toggles = """
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Enable Item-wise Discount</h4>
                  <p className="text-xs text-slate-500">Allow discounts per individual item in invoices</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, EnableItemDiscount: form.EnableItemDiscount === 'true' ? 'false' : 'true' })}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${form.EnableItemDiscount === 'true' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${form.EnableItemDiscount === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Enable Bill Lumpsum Discount</h4>
                  <p className="text-xs text-slate-500">Allow a single flat or percentage discount on the entire bill</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, EnableBillDiscount: form.EnableBillDiscount === 'true' ? 'false' : 'true' })}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${form.EnableBillDiscount === 'true' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${form.EnableBillDiscount === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>"""

content = re.sub(
    r'(<span className="font-extrabold text-slate-900 text-xs">Enable Asset Management</span>\s*<p.*?</div>\s*</label>)', 
    r'\1' + new_toggles.replace('$', '\$'), 
    content, 
    flags=re.DOTALL
)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
