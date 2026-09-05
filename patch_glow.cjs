const fs = require('fs');

function replaceAll(filepath) {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');

  const glowInput = "focus:ring-[3px] focus:ring-indigo-400/80 focus:bg-indigo-50/50 focus:border-indigo-400 focus:shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all z-10 relative";

  content = content.replace(
    /focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 px-2 py-1 rounded transition-all/g,
    `px-2 py-1 rounded ${glowInput}`
  );

  content = content.replace(
    /focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all/g,
    glowInput
  );

  content = content.replace(
    /focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all rounded p-1/g,
    `rounded p-1 ${glowInput}`
  );

  content = content.replace(
    /id="ps-remarks"([\s\S]*?)className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"/g,
    `id="ps-remarks"$1className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-semibold text-slate-900 outline-none ${glowInput} text-xs"`
  );

  content = content.replace(
    /focus:ring-4 focus:ring-emerald-500/g,
    'focus:ring-[4px] focus:ring-emerald-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(52,211,153,0.6)] z-10 relative focus:scale-[1.02]'
  );
  content = content.replace(
    /focus:ring-2 focus:ring-emerald-400/g,
    'focus:ring-[4px] focus:ring-emerald-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(52,211,153,0.6)] z-10 relative focus:scale-[1.02]'
  );

  content = content.replace(
    /focus:ring-4 focus:ring-indigo-500/g,
    'focus:ring-[4px] focus:ring-indigo-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(99,102,241,0.6)] z-10 relative focus:scale-[1.02]'
  );

  content = content.replace(
    /focus:ring-4 focus:ring-rose-500/g,
    'focus:ring-[4px] focus:ring-rose-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(251,113,133,0.6)] z-10 relative focus:scale-[1.02]'
  );

  content = content.replace(
    /focus:ring-4 focus:ring-teal-500/g,
    'focus:ring-[4px] focus:ring-teal-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(45,212,191,0.6)] z-10 relative focus:scale-[1.02]'
  );

  content = content.replace(
    /focus:ring-4 focus:ring-purple-500/g,
    'focus:ring-[4px] focus:ring-purple-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(192,132,252,0.6)] z-10 relative focus:scale-[1.02]'
  );

  content = content.replace(
    /focus:ring-4 focus:ring-cyan-500/g,
    'focus:ring-[4px] focus:ring-cyan-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10 relative focus:scale-[1.02]'
  );

  fs.writeFileSync(filepath, content);
}

const files = [
  'src/components/SalesInvoiceEntry.tsx',
  'src/components/PurchaseEntry.tsx',
  'src/components/Vouchers.tsx',
  'src/components/vouchers/DebitNoteEntry.tsx',
  'src/components/vouchers/CreditNoteEntry.tsx',
  'src/components/vouchers/QuotationEntry.tsx',
  'src/components/vouchers/DeliveryNoteEntry.tsx',
  'src/components/vouchers/PhysicalStockEntry.tsx'
];

files.forEach(replaceAll);

let psContent = fs.readFileSync('src/components/vouchers/PhysicalStockEntry.tsx', 'utf8');
psContent = psContent.replace(
  /onFocus=\{e => e\.target\.select\(\)\}\n\s*onKeyDown=\{e => \{/g,
  `onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('ps-save-btn')?.focus();
                    }`
);
fs.writeFileSync('src/components/vouchers/PhysicalStockEntry.tsx', psContent);

