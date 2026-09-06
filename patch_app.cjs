const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `
            const isNormalSale = inv && (
              inv.isPOS === false || 
              inv.voucherTypeId === 'VT-SALE-NORMAL' || 
              inv.invoiceNo?.startsWith('SAL-') || 
              inv.invoiceNo?.startsWith('INV-B2B-') || 
              Boolean(inv.orderNo) || 
              Boolean(inv.deliveryNoteNo) || 
              Boolean(inv.termsAndConditions)
            );
`;

const newLogic = `
            const isNormalSale = inv && inv.isPOS !== true && (
              inv.isPOS === false || 
              inv.voucherTypeId === 'VT-SALE-NORMAL' || 
              inv.invoiceNo?.startsWith('SAL-') || 
              inv.invoiceNo?.startsWith('INV-B2B-') || 
              Boolean(inv.orderNo) || 
              Boolean(inv.deliveryNoteNo) || 
              (Boolean(inv.termsAndConditions) && !inv.invoiceNo?.startsWith('POS-'))
            );
`;

content = content.replace(
  /const isNormalSale = inv && \([\s\S]*?Boolean\(inv.termsAndConditions\)\n            \);/,
  newLogic.trim()
);

fs.writeFileSync(file, content, 'utf8');
