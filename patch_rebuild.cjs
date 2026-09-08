const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /export function rebuildAccountingLogs\(\) \{/,
  `export function rebuildAccountingLogs() {\n  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);`
);

fs.writeFileSync('src/services/storageService.ts', code);
