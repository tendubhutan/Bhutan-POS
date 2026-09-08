const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

const gstCardCode = `
            {/* GST Card */}
            {showGst && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                  <CircleDollarSign className="h-4 w-4 text-indigo-600" />
                  <span>GST & Tax</span>
                </div>
                <p className="text-[11px] text-slate-500">Taxable amounts, GST tax collected, zero-rated summaries, and GST Input Claims.</p>
                <div className="pt-1 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setMainCategory('gst');
                      setShowReportCatalog(false);
                    }}
                    className={\`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition \${mainCategory === 'gst' ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}\`}
                  >
                    GST Output (Sales)
                  </button>
                  {config.EnableGSTInputTax === 'true' && (
                    <>
                      <button
                        onClick={() => {
                          setMainCategory('gst_input_dom');
                          setShowReportCatalog(false);
                        }}
                        className={\`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition \${mainCategory === 'gst_input_dom' ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}\`}
                      >
                        GST Input (Domestic & Exp)
                      </button>
                      <button
                        onClick={() => {
                          setMainCategory('gst_input_imp');
                          setShowReportCatalog(false);
                        }}
                        className={\`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition \${mainCategory === 'gst_input_imp' ? 'bg-indigo-600 text-white' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'}\`}
                      >
                        GST Input (Import Purchase)
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
`;

code = code.replace(
  /            \{\/\* GST Card \*\/\}[\s\S]*?            \)\}/,
  gstCardCode.trim()
);

fs.writeFileSync('src/components/Reports.tsx', code);
