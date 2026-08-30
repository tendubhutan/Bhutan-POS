import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = re.sub(r"\s*billDiscountType: billDiscountType,\n", "\n", content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
