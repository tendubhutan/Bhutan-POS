const fs = require('fs');
const filepath = 'src/components/vouchers/VoucherSuccessActionModal.tsx';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  /window\.addEventListener\('keydown', handleKeyDown\);/g,
  "window.addEventListener('keydown', handleKeyDown, { capture: true });"
);

content = content.replace(
  /window\.removeEventListener\('keydown', handleKeyDown\);/g,
  "window.removeEventListener('keydown', handleKeyDown, { capture: true });"
);

// We should also make sure it uses stopImmediatePropagation
content = content.replace(
  /e\.stopPropagation\(\);/g,
  "e.stopPropagation();\n        e.stopImmediatePropagation?.();"
);

fs.writeFileSync(filepath, content);
