const fs = require('fs');
let code = fs.readFileSync('src/components/ThermalReceiptModal.tsx', 'utf8');

code = code.replace(
  `            {/* Export Excel */}\n            <button\n              type="button"\n              onClick={handleExportExcel}\n              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 py-2.5 px-3 text-xs font-bold shadow-sm active:scale-98 transition cursor-pointer"\n              title="Export A4 Invoice data to Excel"\n            >\n              <FileDown className="h-4 w-4 text-emerald-600" />\n              <span>Excel</span>\n            </button>`,
  ``
);
fs.writeFileSync('src/components/ThermalReceiptModal.tsx', code);
