const fs = require('fs');
let code = fs.readFileSync('src/services/storageService.ts', 'utf8');

code = code.replace(
  /export function recalculateLedgerBalances\(\) \{/,
  `export function recalculateLedgerBalances() {\n  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);`
);

code = code.replace(
  /export function recalculateStock\(\) \{/,
  `export function recalculateStock() {\n  const cfg = loadJson<Config>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);`
);

fs.writeFileSync('src/services/storageService.ts', code);
