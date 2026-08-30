import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = content.replace("setSupplierName", "setCustomerName")
content = content.replace("selectedSupplierObj", "selectedCustomerObj")
content = content.replace("isSupplierGstExempted", "isCustomerGstExempted")
content = content.replace("Please select or enter a supplier.", "Please select or enter a customer.")
content = content.replace("Supplier & Bill Header Fields", "Customer & Bill Header Fields")
content = content.replace("Supplier</span>", "Customer</span>")
content = content.replace("GST Exempted Supplier", "GST Exempted Customer")
content = content.replace("Sundry Creditors", "Sundry Debtors")
content = content.replace("Supplier Bill Date", "Order Date")
content = content.replace("Supplier Bill / Ref No", "Order / Ref No")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
