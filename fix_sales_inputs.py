import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix rate input value
content = re.sub(r"value=\{line\.rate\}", "value={line.rate || ''}", content)

# Remove discount placeholder
content = re.sub(r"placeholder=\{config\.ItemDiscountType === 'percent' \? '%' : '#'\}", "", content)

# Remove rate placeholder if any
content = re.sub(r"placeholder=\{[^\}]*\}", "", content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
