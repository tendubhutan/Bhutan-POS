const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/components/SalesInvoiceEntry.tsx',
  'src/components/PurchaseEntry.tsx',
  'src/components/Vouchers.tsx',
  'src/components/Reports.tsx',
  'src/components/POSBilling.tsx',
  'src/components/vouchers/CreditNoteEntry.tsx',
  'src/components/vouchers/DebitNoteEntry.tsx',
  'src/components/vouchers/DeliveryNoteEntry.tsx',
  'src/components/vouchers/PhysicalStockEntry.tsx',
  'src/components/vouchers/QuotationEntry.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes("if (e.key === 'Escape'") || content.includes('if (e.key === "Escape"')) {
    // Replace `if (e.key === 'Escape') {` with `if (e.key === 'Escape') { if (e.defaultPrevented) return;`
    content = content.replace(/if\s*\(\s*e\.key\s*===\s*['"]Escape['"]\s*\)\s*\{/, "if (e.key === 'Escape') { if (e.defaultPrevented) return;");
    fs.writeFileSync(f, content);
  }
});

// Also fix VoucherSuccessActionModal
let vsModal = fs.readFileSync('src/components/vouchers/VoucherSuccessActionModal.tsx', 'utf8');
if (!vsModal.includes('e.stopPropagation')) {
  vsModal = vsModal.replace(
    /if\s*\(\s*e\.key\s*===\s*['"]Escape['"]\s*\)\s*\{\s*e\.preventDefault\(\);/g,
    "if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();"
  );
  // Add capture: true if not present
  if (vsModal.includes("window.addEventListener('keydown', handleKeyDown, true);")) {
     // Already capture
  } else if (vsModal.includes("window.addEventListener('keydown', handleKeyDown);")) {
     vsModal = vsModal.replace("window.addEventListener('keydown', handleKeyDown);", "window.addEventListener('keydown', handleKeyDown, { capture: true });");
     vsModal = vsModal.replace("window.removeEventListener('keydown', handleKeyDown);", "window.removeEventListener('keydown', handleKeyDown, { capture: true });");
  }
  fs.writeFileSync('src/components/vouchers/VoucherSuccessActionModal.tsx', vsModal);
}
