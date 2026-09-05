const fs = require('fs');

function patchTopPickerId(filepath, originalId, newId) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(`id="${originalId}"`, `id="${newId}"`);
  fs.writeFileSync(filepath, content);
}

patchTopPickerId('src/components/vouchers/DeliveryNoteEntry.tsx', 'dn-fast-item-picker', 'dn-fast-item-picker-top');
patchTopPickerId('src/components/vouchers/QuotationEntry.tsx', 'qt-fast-item-picker', 'qt-fast-item-picker-top');

