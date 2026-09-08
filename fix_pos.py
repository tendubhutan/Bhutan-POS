import sys
with open('src/components/POSBilling.tsx', 'r') as f:
    pos = f.read()

pos = pos.replace("invoiceNo: editingInvoiceNo || undefined,", "originalInvoiceNo: editingInvoiceNo || undefined,")
with open('src/components/POSBilling.tsx', 'w') as f:
    f.write(pos)
