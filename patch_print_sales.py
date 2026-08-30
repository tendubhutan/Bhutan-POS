import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

replacement = """
    if (!res.ok) {
      alert(res.error || 'Failed to save sales invoice');
      return;
    }

    setSavedInvoice(res.invoice);
    setShowPrintModal(true);
    setEditingBillNo(null);
    setCart([]);
    setBillNo('');
"""

content = re.sub(r'if \(!res\.ok\) \{.*?setCart\(\[\]\);', replacement, content, flags=re.DOTALL)

# Also let's rename "Supplier Details" in the UI string just in case
content = content.replace("supplierBillNo", "invoiceNo")
content = content.replace("Failed to save purchase invoice", "Failed to save sales invoice")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
