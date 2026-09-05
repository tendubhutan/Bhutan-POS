const fs = require('fs');

function patchDebit() {
  let content = fs.readFileSync('src/components/vouchers/DebitNoteEntry.tsx', 'utf8');
  
  // 1. Add ID to Save button
  content = content.replace(
    /<button\n\s*type="button"\n\s*onClick=\{handleSaveDebitNote\}\n\s*disabled=\{itemLines.length === 0\}\n\s*className="/g,
    '<button\n                type="button"\n                id="dn-save-btn"\n                onClick={handleSaveDebitNote}\n                disabled={itemLines.length === 0}\n                className="focus:ring-4 focus:ring-rose-500 outline-none '
  );
  
  // 2. Add onKeyDown and styling to narration
  content = content.replace(
    /onChange=\{e => setNarration\(e.target.value\)\}\n\s*onFocus=\{e => e.target.select\(\)\}\n\s*className="/g,
    `onChange={e => setNarration(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('dn-save-btn')?.focus();
                }
              }}
              className="focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all `
  );
  fs.writeFileSync('src/components/vouchers/DebitNoteEntry.tsx', content);
}

function patchCredit() {
  let content = fs.readFileSync('src/components/vouchers/CreditNoteEntry.tsx', 'utf8');
  
  // 1. Add ID to Save button
  content = content.replace(
    /<button\n\s*type="button"\n\s*onClick=\{handleSaveCreditNote\}\n\s*disabled=\{itemLines.length === 0\}\n\s*className="/g,
    '<button\n                type="button"\n                id="cn-save-btn"\n                onClick={handleSaveCreditNote}\n                disabled={itemLines.length === 0}\n                className="focus:ring-4 focus:ring-teal-500 outline-none '
  );
  
  // 2. Add onKeyDown and styling to narration
  content = content.replace(
    /onChange=\{e => setNarration\(e.target.value\)\}\n\s*onFocus=\{e => e.target.select\(\)\}\n\s*className="/g,
    `onChange={e => setNarration(e.target.value)}
              onFocus={e => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('cn-save-btn')?.focus();
                }
              }}
              className="focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all `
  );
  fs.writeFileSync('src/components/vouchers/CreditNoteEntry.tsx', content);
}

patchDebit();
patchCredit();
