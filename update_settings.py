import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

replacement = """
              {/* Normal Sale Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableNormalSale !== 'false'}
                    onChange={e => setForm({ ...form, EnableNormalSale: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Normal Sale (B2B)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Traditional sales entry with Order No, Delivery Note, and custom Terms.</p>
                </div>
              </label>

              {/* POS Sale Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnablePOS !== 'false'}
                    onChange={e => setForm({ ...form, EnablePOS: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable POS Billing (Retail)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Fast point-of-sale interface for retail billing.</p>
                </div>
              </label>

              {/* Payroll Module */}
"""

content = content.replace("{/* Payroll Module */}", replacement)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
