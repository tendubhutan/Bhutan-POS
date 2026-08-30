import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

old_save = """    const result = saveSalesInvoice({
      cart,
      payment: payData,
      customer,
      billDiscount: totals.discount,
      billDiscountType: totals.discountType,
      billDiscountValue: totals.discountValue,
      voucherTypeId: activeVoucherType?.id,
      voucherTypeName: activeVoucherType?.name,
      invoiceNo: editingInvoiceNo || undefined
    });"""

new_save = """    const result = saveSalesInvoice({
      cart,
      payment: payData,
      customer,
      billDiscount: totals.discount,
      billDiscountType: totals.discountType,
      billDiscountValue: totals.discountValue,
      voucherTypeId: activeVoucherType?.id,
      voucherTypeName: activeVoucherType?.name,
      invoiceNo: editingInvoiceNo || undefined,
      isPOS: true
    });"""

content = content.replace(old_save, new_save)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
