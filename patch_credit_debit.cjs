const fs = require('fs');

function replaceNarration(filePath, btnId) {
  let content = fs.readFileSync(filePath, 'utf8');
  // the onKeyDown is currently:
  /*
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (hasStockReturn) {
                    focusElement('cn-item-0-qty'); // or dn
                  } else {
                    focusElement('cn-lumpsum-amt');
                  }
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  focusElement('cn-sales-return');
                }
              }}
  */
  // Let's replace the Enter part to focus the save button.
  
  content = content.replace(
    /if \(e\.key === 'Enter'\) \{\n\s*e\.preventDefault\(\);\n\s*if \(hasStockReturn\) \{\n\s*focusElement\('.*?'\);\n\s*\} else \{\n\s*focusElement\('.*?'\);\n\s*\}\n\s*\}/g,
    `if (e.key === 'Enter') {\n                  e.preventDefault();\n                  document.getElementById('${btnId}')?.focus();\n                }`
  );
  
  // Also add focus style to className: focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50
  content = content.replace(
    /className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-[a-z]+-600 text-xs"/g,
    `className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:bg-indigo-50 transition-all text-xs"`
  );

  fs.writeFileSync(filePath, content);
}

replaceNarration('src/components/vouchers/CreditNoteEntry.tsx', 'cn-save-btn');
replaceNarration('src/components/vouchers/DebitNoteEntry.tsx', 'dn-save-btn');

