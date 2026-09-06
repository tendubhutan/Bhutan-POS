const fs = require('fs');
const file = 'src/components/Reports.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "      // Direct Alt+F2 or Alt+D shortcut for Change Period anywhere in Reports\n      if (e.altKey && (e.key === 'F2' || e.code === 'F2' || e.key === 'd' || e.key === 'D')) {\n        e.preventDefault();\n        e.stopPropagation();\n        openChangePeriod();\n        return;\n      }",
  "      // Alt+F2 is now handled globally by App.tsx to prevent duplicate dialogs when DrillModal is active"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched Reports.tsx Alt+F2 shortcut block');
