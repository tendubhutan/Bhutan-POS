const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "        const t = { category: 'daily' as const, openChangePeriod: true, timestamp: Date.now() };",
  "        if (drillModal.type !== null) {\n          window.dispatchEvent(new CustomEvent('app:drill-open-change-period'));\n          return;\n        }\n\n        const t = { category: 'daily' as const, openChangePeriod: true, timestamp: Date.now() };"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched App.tsx');
