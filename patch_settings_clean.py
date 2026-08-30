import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

# Remove the junk I just added
bad_block = """
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

content = content.replace(bad_block, "")

# Now add them properly matching the existing layout
good_block = """              </label>

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
              </label>"""

content = content.replace('</label>\n\n              {/* Asset Management Module */}', good_block + '\n\n              {/* Asset Management Module */}')

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
