import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

content = re.sub(r"value=\{line\.rate\}", "value={line.rate || ''}", content)
content = re.sub(r"placeholder=\{config\.ItemDiscountType === 'percent' \? '%' : '#'\}", "", content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
