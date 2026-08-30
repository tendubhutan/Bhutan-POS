with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = content.replace("` : \\'\\',", "` : '',")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)

