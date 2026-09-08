import sys
with open('src/components/SalesInvoiceEntry.tsx', 'r') as f:
    sales = f.read()

sales = sales.replace("invoiceNo: editingBillNo || (billNo.trim() ? billNo.trim() : undefined),", "invoiceNo: billNo.trim() || undefined,\n      originalInvoiceNo: editingBillNo || undefined,")
with open('src/components/SalesInvoiceEntry.tsx', 'w') as f:
    f.write(sales)

with open('src/components/PurchaseEntry.tsx', 'r') as f:
    purchases = f.read()

purchases = purchases.replace("billNo: editingBillNo || undefined,", "originalBillNo: editingBillNo || undefined,")
with open('src/components/PurchaseEntry.tsx', 'w') as f:
    f.write(purchases)
