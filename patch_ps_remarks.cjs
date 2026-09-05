const fs = require('fs');
let psContent = fs.readFileSync('src/components/vouchers/PhysicalStockEntry.tsx', 'utf8');
psContent = psContent.replace(
  /onFocus=\{e => e\.target\.select\(\)\}\n\s*className="/g,
  `onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('ps-save-btn')?.focus();
                    }
                  }}
                  className="`
);
fs.writeFileSync('src/components/vouchers/PhysicalStockEntry.tsx', psContent);
