const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /gstAmount: finalGst \|\| 0\n\s*\}\);\n\s*\}/g,
  `gstAmount: finalGst || 0
        });
        }
      }`
);

fs.writeFileSync('src/services/storageService.ts', code);
