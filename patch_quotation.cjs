const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/QuotationEntry.tsx', 'utf8');

// 1. Add ID to Save button
content = content.replace(
  /<button\n\s*type="button"\n\s*onClick=\{handleSaveQuotation\}\n\s*disabled=\{quoteItems.length === 0\}\n\s*className="/g,
  '<button\n                type="button"\n                id="qt-save-btn"\n                onClick={handleSaveQuotation}\n                disabled={quoteItems.length === 0}\n                className="focus:ring-4 focus:ring-purple-500 outline-none '
);

// 2. Add focus classes to terms textarea
content = content.replace(
  /className="w-full text-\[11px\] border-none outline-none resize-none bg-transparent placeholder:text-slate-400"/g,
  'className="w-full text-[11px] border-none outline-none resize-none bg-transparent placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all rounded p-1"'
);

fs.writeFileSync('src/components/vouchers/QuotationEntry.tsx', content);
