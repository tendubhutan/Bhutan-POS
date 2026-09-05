const fs = require('fs');

// Fix DeliveryNoteEntry double ID
let dnContent = fs.readFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', 'utf8');
const searchBlock = `id="dn-save-btn"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 px-4 py-2 font-black text-white text-xs shadow-xs transition active:scale-95 focus:ring-[4px] focus:ring-cyan-400/80 focus:ring-offset-1 focus:shadow-[0_0_15px_rgba(34,211,238,0.6)] z-10 relative focus:scale-[1.02] outline-none cursor-pointer"`;

dnContent = dnContent.replace(/id="dn-save-btn"\n\s*type="button"\n\s*id="dn-save-btn"/g, 'type="button"\n                id="dn-save-btn"');
dnContent = dnContent.replace(/id="dn-save-btn"[\s\S]*?id="dn-save-btn"/, 'id="dn-save-btn"');

fs.writeFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', dnContent);
