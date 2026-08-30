import re

with open("src/services/storageService.ts", "r") as f:
    content = f.read()

# Update payload signature
old_payload = """export function saveSalesInvoice(payload: {
  orderNo?: string;
  orderDate?: string;
  deliveryNoteNo?: string;
  cart: CartLine[];
  payment: PaymentDetails;
  customer: CustomerDetails;
  billDiscount?: number;
  billDiscountType?: 'flat' | 'percent';
  billDiscountValue?: number;
  notes?: string;
  termsAndConditions?: string;
  invoiceNo?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
}) {"""

new_payload = """export function saveSalesInvoice(payload: {
  orderNo?: string;
  orderDate?: string;
  deliveryNoteNo?: string;
  cart: CartLine[];
  payment: PaymentDetails;
  customer: CustomerDetails;
  billDiscount?: number;
  billDiscountType?: 'flat' | 'percent';
  billDiscountValue?: number;
  notes?: string;
  termsAndConditions?: string;
  invoiceNo?: string;
  voucherTypeId?: string;
  voucherTypeName?: string;
  isPOS?: boolean;
}) {"""

content = content.replace(old_payload, new_payload)

# Update the destructuring
content = content.replace("orderDate, deliveryNoteNo, voucherTypeId, voucherTypeName, invoiceNo } = payload;", "orderDate, deliveryNoteNo, voucherTypeId, voucherTypeName, invoiceNo, isPOS } = payload;")

# Update invPrefix logic
old_invPrefix = """  const invPrefix = matchedVt?.prefix || (cfg.BarcodePrefix ? 'INV-' : 'INV-');
  const counterKey = matchedVt ? `Voucher_${matchedVt.id}` : 'SalesInvoice';"""

new_invPrefix = """  const defaultPrefix = isPOS ? (cfg.POSInvoicePrefix || 'POS-') : (cfg.SalesInvoicePrefix || 'SAL-');
  const invPrefix = matchedVt?.prefix || defaultPrefix;
  const counterKey = matchedVt ? `Voucher_${matchedVt.id}` : (isPOS ? 'POSInvoice' : 'SalesInvoice');"""

content = content.replace(old_invPrefix, new_invPrefix)

with open("src/services/storageService.ts", "w") as f:
    f.write(content)
