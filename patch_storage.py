import re

with open("src/services/storageService.ts", "r") as f:
    content = f.read()

old_s_pur = """  if (type === 'S') return 'SAL-';
  if (type === 'PUR') return 'PUR-';"""

new_s_pur = """  if (type === 'S') return config.SalesInvoicePrefix !== undefined && config.SalesInvoicePrefix !== '' ? config.SalesInvoicePrefix : 'SAL-';
  if (type === 'PUR') return config.PurchaseInvoicePrefix !== undefined && config.PurchaseInvoicePrefix !== '' ? config.PurchaseInvoicePrefix : 'PUR-';"""

content = content.replace(old_s_pur, new_s_pur)

with open("src/services/storageService.ts", "w") as f:
    f.write(content)
