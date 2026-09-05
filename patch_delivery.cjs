const fs = require('fs');
let content = fs.readFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', 'utf8');

// Add ID and enhance focus style to Save button
content = content.replace(
  /className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-2 focus:ring-cyan-400 outline-none cursor-pointer"\n\s*>\n\s*<CheckCircle2 className="h-4 w-4" \/>\n\s*<span>Save Delivery Note \(F2\)<\/span>\n\s*<\/button>/g,
  `id="dn-save-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-4 focus:ring-cyan-500 outline-none cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Save Delivery Note (F2)</span>
              </button>`
);

fs.writeFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', content);
