const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace default state
  content = content.replace(
    /const \[itemLines, setItemLines\] = useState<ItemLine\[\]>\(\[\s*\{\s*id: '1',\s*itemCode: items\[0\]\?\.\['Item Code'\] \|\| '',\s*itemName: items\[0\]\?\.\['Item Name'\] \|\| '',\s*qty: 1,\s*rate: items\[0\]\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0,\s*gstPct: items\[0\]\?\.\['GST %'\] \|\| 0,\s*amount: items\[0\]\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0\s*\}\s*\]\);/g,
    `const [itemLines, setItemLines] = useState<ItemLine[]>([
    {
      id: '1',
      itemCode: '',
      itemName: '',
      qty: 1,
      rate: 0,
      gstPct: 0,
      amount: 0
    }
  ]);`
  );

  // Replace handleAddItemLine
  content = content.replace(
    /const handleAddItemLine = \(\) => \{\s*const firstItem = items\[0\];\s*setItemLines\(prev => \[\s*\.\.\.prev,\s*\{\s*id: String\(Date\.now\(\)\),\s*itemCode: firstItem\?\.\['Item Code'\] \|\| '',\s*itemName: firstItem\?\.\['Item Name'\] \|\| '',\s*qty: 1,\s*rate: firstItem\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0,\s*gstPct: firstItem\?\.\['GST %'\] \|\| 0,\s*amount: firstItem\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0\s*\}\s*\]\);\s*\};/g,
    `const handleAddItemLine = () => {
    setItemLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        itemCode: '',
        itemName: '',
        qty: 1,
        rate: 0,
        gstPct: 0,
        amount: 0
      }
    ]);
  };`
  );

  // Replace auto-add in onKeyDown (like when hitting enter on last row amount)
  content = content.replace(
    /const firstItem = items\[0\];\s*setItemLines\(prev => \[\s*\.\.\.prev,\s*\{\s*id: String\(Date\.now\(\)\),\s*itemCode: firstItem\?\.\['Item Code'\] \|\| '',\s*itemName: firstItem\?\.\['Item Name'\] \|\| '',\s*qty: 1,\s*rate: firstItem\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0,\s*gstPct: firstItem\?\.\['GST %'\] \|\| 0,\s*amount: firstItem\?\.\['(Purchase Rate|Sale Rate)'\] \|\| 0\s*\}\s*\]\);/g,
    `setItemLines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        itemCode: '',
        itemName: '',
        qty: 1,
        rate: 0,
        gstPct: 0,
        amount: 0
      }
    ]);`
  );

  fs.writeFileSync(filepath, content);
}

patchFile('src/components/vouchers/DebitNoteEntry.tsx');
patchFile('src/components/vouchers/CreditNoteEntry.tsx');
