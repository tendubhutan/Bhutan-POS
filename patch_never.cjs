const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const numbersInQuery = query\.match/g,
  "const numbersInQuery: string[] = query.match"
);

content = content.replace(
  /const numbersInQueryFallback = query\.match/g,
  "const numbersInQueryFallback: string[] = query.match"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched never[]');
