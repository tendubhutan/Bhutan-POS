import re

with open("src/services/storageService.ts", "r") as f:
    content = f.read()

content = content.replace("export function saveSalesInvoice(payload: {",
"""export function saveSalesInvoice(payload: {
  orderNo?: string;
  orderDate?: string;
  deliveryNoteNo?: string;""")

content = content.replace("billDiscountValue, termsAndConditions, voucherTypeId, voucherTypeName, invoiceNo } = payload;",
"billDiscountValue, termsAndConditions, voucherTypeId, voucherTypeName, invoiceNo, orderNo, orderDate, deliveryNoteNo } = payload;")

content = content.replace("termsAndConditions,", "termsAndConditions, orderNo, orderDate, deliveryNoteNo,")

with open("src/services/storageService.ts", "w") as f:
    f.write(content)
