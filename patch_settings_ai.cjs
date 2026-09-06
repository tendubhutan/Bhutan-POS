const fs = require('fs');
const file = 'src/components/SettingsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const aiSetting = `
                {/* Advanced Gemini AI Assistant */}
                <label className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition col-span-1 sm:col-span-2">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      checked={form.EnableAdvancedAI === 'true'}
                      onChange={e => setForm({ ...form, EnableAdvancedAI: e.target.checked ? 'true' : 'false' })}
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs">Enable Advanced AI Assistant (Gemini)</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Empowers the AI Assistant button with conversational reporting, predictive inventory, and data insights using Google Gemini. When disabled, the AI button functions as a normal local search.</p>
                  </div>
                </label>
`;

content = content.replace(
  "                  </div>\n                </label>\n\n                {/* Report Expansion Detail Level */}",
  "                  </div>\n                </label>\n" + aiSetting + "\n                {/* Report Expansion Detail Level */}"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched SettingsView.tsx');
