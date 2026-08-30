import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

old_bill_disc = r"""              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3\.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0\.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked=\{form\.EnableBillDiscount === "true"\}
                    onChange=\{e => setForm\(\{ \.\.\.form, EnableBillDiscount: e\.target\.checked \? "true" : "false" \}\)\}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Bill Lumpsum Discount</span>
                  <p className="text-\[10px\] text-slate-500 mt-0\.5 leading-snug">Allow a single flat or percentage discount on the entire bill\.</p>
                </div>
              </label>"""

new_bill_disc = """              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 transition">
                <label className="flex items-start gap-3.5 cursor-pointer">
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
                {form.EnableBillDiscount === "true" && (
                  <div className="ml-7 flex items-center gap-3 bg-white p-2.5 border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="BillDiscountType" value="flat" checked={form.BillDiscountType !== "percent"} onChange={() => setForm({...form, BillDiscountType: 'flat'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Flat Amount (#)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="BillDiscountType" value="percent" checked={form.BillDiscountType === "percent"} onChange={() => setForm({...form, BillDiscountType: 'percent'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Percentage (%)</span>
                    </label>
                  </div>
                )}
              </div>"""

content = re.sub(old_bill_disc, new_bill_disc, content)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
