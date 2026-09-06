const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

const newItemSearchLogic = `
      // Add item search logic
      const items = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
      const qLower = query.toLowerCase();
      // Extract numbers from query to match prices
      const numbersInQuery: string[] = query.match(/\\d+(\\.\\d+)?/g) || [];
      const searchWords = qLower.replace(/\\b(what|is|the|purchase|price|of|sale|how|much|does|cost|find|search|item|with|selling|rate)\\b/gi, '').match(/[a-z0-9]+/gi) || [];
      
      const itemMatches = items.filter(it => {
        const nameLower = (it['Item Name'] || '').toLowerCase();
        const codeLower = (it['Item Code'] || '').toLowerCase();
        const catLower = (it.Category || '').toLowerCase();
        
        const matchesWord = searchWords.length > 0 && searchWords.some(w => w.length > 2 && (nameLower.includes(w) || codeLower.includes(w) || catLower.includes(w)));
        const matchesQuery = nameLower.includes(qLower) || codeLower.includes(qLower);
        
        return matchesWord || matchesQuery ||
        numbersInQuery.includes(it['Sale Rate']?.toString()) ||
        numbersInQuery.includes(it['Purchase Rate']?.toString()) ||
        numbersInQuery.includes(it['MRP']?.toString());
      }).slice(0, 20);

      if (itemMatches.length > 0) {
        dataContext += '\\n\\nMatching Items:\\n' + itemMatches.map(it => 
          \`[Item: \${it['Item Name']}, Code: \${it['Item Code']}, Sale Rate: \${it['Sale Rate']}, Purchase Rate: \${it['Purchase Rate']}, MRP: \${it['MRP']}, Stock: \${it['Current Stock']}]\`
        ).join('\\n');
      }
`;

content = content.replace(
  /\/\/ Add item search logic[\s\S]*?\}\]\`\s*\)\.join\('\\n'\);\s*\}/,
  newItemSearchLogic.trim()
);

const newFallbackSearchLogic = `
  const itemsFallback = loadJson<any[]>(STORAGE_KEYS.ITEMS, []);
  const qLowerFallback = query.toLowerCase();
  const numbersInQueryFallback: string[] = query.match(/\\d+(\\.\\d+)?/g) || [];
  const searchWordsFallback = qLowerFallback.replace(/\\b(what|is|the|purchase|price|of|sale|how|much|does|cost|find|search|item|with|selling|rate)\\b/gi, '').match(/[a-z0-9]+/gi) || [];
  
  const itemMatchesFallback = itemsFallback.filter(it => {
    const nameLower = (it['Item Name'] || '').toLowerCase();
    const codeLower = (it['Item Code'] || '').toLowerCase();
    const catLower = (it.Category || '').toLowerCase();
    
    const matchesWord = searchWordsFallback.length > 0 && searchWordsFallback.some(w => w.length > 2 && (nameLower.includes(w) || codeLower.includes(w) || catLower.includes(w)));
    const matchesQuery = nameLower.includes(qLowerFallback) || codeLower.includes(qLowerFallback);
    
    return matchesWord || matchesQuery ||
    numbersInQueryFallback.includes(it['Sale Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['Purchase Rate']?.toString()) ||
    numbersInQueryFallback.includes(it['MRP']?.toString());
  }).slice(0, 6);
`;

content = content.replace(
  /const itemsFallback = loadJson<any\[\]>\(STORAGE_KEYS\.ITEMS, \[\]\);[\s\S]*?\.slice\(0, 6\);/,
  newFallbackSearchLogic.trim()
);

// also fix the fallback output to show purchase rate
content = content.replace(
  /Sale Rate: Nu\. \$\{it\['Sale Rate'\]\} \| MRP: Nu\. \$\{it\['MRP'\]\} \| Stock: \$\{it\['Current Stock'\]\}/,
  "Sale Rate: Nu. ${it['Sale Rate']} | Purchase Rate: Nu. ${it['Purchase Rate']} | MRP: Nu. ${it['MRP']} | Stock: ${it['Current Stock']}"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched localAIService.ts');
