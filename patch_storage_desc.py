import re

with open("src/services/storageService.ts", "r") as f:
    content = f.read()

# Fix the cart mapped properties in saveSalesInvoice
old_desc = "'Item Description': l.description || '',\n      description: l.description || '',"
new_desc = "'Item Description': l.description || l.lineDescription || '',\n      description: l.description || l.lineDescription || '',\n      lineDescription: l.lineDescription || '',"

content = content.replace(old_desc, new_desc)

with open("src/services/storageService.ts", "w") as f:
    f.write(content)
