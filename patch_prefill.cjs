const fs = require('fs');

function fixPrefill(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const firstItem = items\[0\];\s*setItemLines\(\[\s*\{\s*id: String\(Date\.now\(\)\),\s*itemCode: firstItem\?\.\['Item Code'\] \|\| '',\s*itemName: firstItem\?\.\['Item Name'\] \|\| '',\s*qty: 1,\s*rate: firstItem\?\.\['(?:Sale Rate|Purchase Rate)'\] \|\| 0,\s*gstPct: firstItem\?\.\['GST %'\] \|\| 0,\s*amount: firstItem\?\.\['(?:Sale Rate|Purchase Rate)'\] \|\| 0\s*\}\s*\]\);/g, 
  `setItemLines([
            {
              id: String(Date.now()),
              itemCode: '',
              itemName: '',
              qty: 1,
              rate: 0,
              gstPct: 0,
              amount: 0
            }
          ]);`);
  fs.writeFileSync(file, content);
}

fixPrefill('src/components/vouchers/CreditNoteEntry.tsx');
fixPrefill('src/components/vouchers/DebitNoteEntry.tsx');
