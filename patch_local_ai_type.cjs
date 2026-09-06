const fs = require('fs');
const file = 'src/services/localAIService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "  const config = loadJson(STORAGE_KEYS.CONFIG, {});",
  "  const config = loadJson<any>(STORAGE_KEYS.CONFIG, {});"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched type error in localAIService.ts');
