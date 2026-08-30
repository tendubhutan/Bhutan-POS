import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

content = re.sub(r'const showItemDiscount =[^;]+;', "const showItemDiscount = config.EnableItemDiscount === 'true';", content)
content = re.sub(r'const showBillDiscount =[^;]+;', "const showBillDiscount = config.EnableBillDiscount === 'true';", content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
