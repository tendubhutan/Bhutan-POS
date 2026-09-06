const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const newContextLogic = `
      const rawMatches = searchAllEntries(query);
      
      let dataContext = rawMatches.slice(0, 50).map(m => 
        \`[Ref: \${m.refNo}, Date: \${m.date}, Type: \${m.typeLabel}, Party: \${m.party}, Amount: \${m.amount}]\`
      ).join('\\n');

      // Add item search logic
      const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
      const qLower = query.toLowerCase();
      // Extract numbers from query to match prices
      const numbersInQuery = query.match(/\\d+(\\.\\d+)?/g) || [];
      
      const itemMatches = items.filter(it => 
        it['Item Name'].toLowerCase().includes(qLower) || 
        it['Item Code'].toLowerCase().includes(qLower) ||
        it['Barcode'].toLowerCase().includes(qLower) ||
        (it.Category && it.Category.toLowerCase().includes(qLower)) ||
        numbersInQuery.includes(it['Sale Rate'].toString()) ||
        numbersInQuery.includes(it['Purchase Rate'].toString()) ||
        numbersInQuery.includes(it['MRP'].toString())
      ).slice(0, 20);

      if (itemMatches.length > 0) {
        dataContext += '\\n\\nMatching Items:\\n' + itemMatches.map(it => 
          \`[Item: \${it['Item Name']}, Code: \${it['Item Code']}, Sale Rate: \${it['Sale Rate']}, MRP: \${it['MRP']}, Stock: \${it['Current Stock']}]\`
        ).join('\\n');
      }
`;

content = content.replace(
  /const rawMatches = searchAllEntries\(query\);\s+const dataContext = rawMatches\.slice\(0, 50\)\.map\(m => \s+`\[Ref: \$\{m\.refNo\}, Date: \$\{m\.date\}, Type: \$\{m\.typeLabel\}, Party: \$\{m\.party\}, Amount: \$\{m\.amount\}\]`\s+\)\.join\('\\n'\);/,
  newContextLogic.trim()
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService.ts for items');
