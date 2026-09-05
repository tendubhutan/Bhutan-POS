const fs = require('fs');

function replaceInFile(file, regex, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
}

// 1. Quotation
let qtContent = fs.readFileSync('src/components/vouchers/QuotationEntry.tsx', 'utf8');
qtContent = qtContent.replace(/focusNextOutsideGrid\([\s\S]*?\)/g, "focusElement('qt-save-btn')");
fs.writeFileSync('src/components/vouchers/QuotationEntry.tsx', qtContent);

// 2. Delivery Note
let dnContent = fs.readFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', 'utf8');
dnContent = dnContent.replace(/focusNextOutsideGrid\([\s\S]*?\)/g, "focusElement('dn-save-btn')");
fs.writeFileSync('src/components/vouchers/DeliveryNoteEntry.tsx', dnContent);

// 3. Credit Note
let cnContent = fs.readFileSync('src/components/vouchers/CreditNoteEntry.tsx', 'utf8');
cnContent = cnContent.replace(/focusNextOutsideGrid\([\s\S]*?\)/g, "focusElement('cn-save-btn')");
if (!cnContent.includes('id="cn-save-btn"')) {
  cnContent = cnContent.replace(/type="submit"/, 'id="cn-save-btn"\n                type="submit"');
}
fs.writeFileSync('src/components/vouchers/CreditNoteEntry.tsx', cnContent);

// 4. Debit Note
let dbnContent = fs.readFileSync('src/components/vouchers/DebitNoteEntry.tsx', 'utf8');
dbnContent = dbnContent.replace(/focusNextOutsideGrid\([\s\S]*?\)/g, "focusElement('dn-save-btn')");
if (!dbnContent.includes('id="dbn-save-btn"') && dbnContent.includes('id="dn-save-btn"')) {
    // wait, DebitNote has dn-save-btn
}
fs.writeFileSync('src/components/vouchers/DebitNoteEntry.tsx', dbnContent);

