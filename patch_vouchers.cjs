const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

// 1. Add ID and focus class to Save button
content = content.replace(
  /<button\n\s*type="button"\n\s*onClick=\{handleSubmit\}\n\s*disabled=\{!isDirty\}\n\s*className="/g,
  '<button\n                type="button"\n                id="v-save-btn"\n                onClick={handleSubmit}\n                disabled={!isDirty}\n                className="focus:ring-4 focus:ring-indigo-500 outline-none '
);

// 2. Add onKeyDown to v-overall-narration to focus v-save-btn
content = content.replace(
  /onFocus=\{e => e\.target\.select\(\)\}\n\s*onChange=\{e => setNarration\(e\.target\.value\)\}\n\s*className="/g,
  `onFocus={e => e.target.select()}
              onChange={e => setNarration(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('v-save-btn')?.focus();
                }
              }}
              className="focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all `
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
