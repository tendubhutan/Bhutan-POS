const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const searchWordsFallback = qLower.replace(/\\b(what|is|the|purchase|price|of|sale|how|much|does|cost|find|search|item|with|selling|rate)\\b/gi, '').match(/[a-z0-9]+/gi) || [];",
  "const stopWords = ['what', 'is', 'the', 'purchase', 'price', 'of', 'sale', 'how', 'much', 'does', 'cost', 'find', 'out', 'search', 'item', 'with', 'selling', 'rate', 'latest', 'last', 'first', 'show', 'me', 'tell', 'about', 'for', 'any'];\n  const searchWordsFallback = (qLower.match(/[a-z0-9]+/gi) || []).filter(w => w.length > 1 && !stopWords.includes(w));"
);

content = content.replace(
  /w => w\.length > 2 && /g,
  "w => "
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched search logic");
