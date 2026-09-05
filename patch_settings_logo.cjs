const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const uploadCode = `              <div className="col-span-1 sm:col-span-2 mt-2">
                <label className="block font-bold text-slate-700 mb-1">Company / Print Header Logo (A4 & Reports)</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setForm({ ...form, CompanyLogo: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-xl file:border-0
                        file:text-sm file:font-semibold
                        file:bg-indigo-50 file:text-indigo-700
                        hover:file:bg-indigo-100 transition
                      "
                    />
                  </div>
                  {form.CompanyLogo && (
                    <div className="flex items-center gap-2">
                      <img src={form.CompanyLogo} alt="Logo Preview" className="h-10 object-contain rounded border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, CompanyLogo: '' })}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                        title="Remove Logo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">This logo will dynamically appear on the header of all A4 Bills, Invoices, Vouchers, and Reports.</p>
              </div>`;

content = content.replace(
  /<div>\s*<label className="block font-bold text-slate-700 mb-1">Company GSTIN \/ TPN<\/label>/,
  uploadCode + '\n              <div>\n                <label className="block font-bold text-slate-700 mb-1">Company GSTIN / TPN</label>'
);

fs.writeFileSync('src/components/SettingsView.tsx', content);
