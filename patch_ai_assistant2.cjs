const fs = require('fs');
const file = 'src/components/AIAssistant.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const actionMatch = responseText\.match\(\/\\\\`\\\\`\\\\`json\\\\n\(\[\\\\s\\\\S\]\*\?\)\\n\\\\`\\\\`\\\\`\/\);/,
  "const actionMatch = responseText.match(/```json[\\s\\n]*([\\s\\S]*?)[\\s\\n]*```/);"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched AIAssistant.tsx regex');
