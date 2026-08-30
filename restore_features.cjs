const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf-8');

const emptyGrid = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              
            </div>`;

const newGrid = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* GST / Taxation Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableGST === 'true'}
                    onChange={e => setForm({ ...form, EnableGST: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable GST (Taxation Module)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Calculates and tracks GST on purchases and sales. Requires GST No.</p>
                </div>
              </label>

              {/* Serial Numbers Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableSerials === 'true'}
                    onChange={e => setForm({ ...form, EnableSerials: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Serial Numbers (Inventory)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Track individual stock items by unique IMEI or Serial No.</p>
                </div>
              </label>

              {/* Item Categories */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableCategory === 'true'}
                    onChange={e => setForm({ ...form, EnableCategory: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Item Categories</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Group items into hierarchical categories for better reporting.</p>
                </div>
              </label>
            </div>`;

content = content.replace(emptyGrid, newGrid);
fs.writeFileSync('src/components/SettingsView.tsx', content);
