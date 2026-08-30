import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# 194
content = re.sub(r"\s*setBillDiscountType\([^\)]*\);\n", "\n", content)

# 516
content = re.sub(r"\s*billDiscountType,\n", "\n", content)

# 981
content = re.sub(r"\s*billDiscountType,\n", "\n", content)

# 1798 / 1810 / 1830 (Hold bills, etc)
# Let's just do a regex replace for any line with setBillDiscountType
content = re.sub(r"[^\n]*setBillDiscountType[^\n]*\n", "\n", content)

# 981
content = re.sub(r"billDiscountType: billDiscountType", "billDiscountType: config.BillDiscountType || 'flat'", content)
content = re.sub(r"billDiscountType,\n", "billDiscountType: config.BillDiscountType || 'flat',\n", content)

# 1830 
content = re.sub(r"billDiscountType\}\n", "billDiscountType: config.BillDiscountType || 'flat'}\n", content)

# 1911 discountType does not exist
content = re.sub(r"totals\.discountType === 'percent'", "config.BillDiscountType === 'percent'", content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
