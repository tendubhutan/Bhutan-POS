import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "const [billDiscount, setBillDiscount] = useState<number | ''>('');",
    "const [billDiscount, setBillDiscount] = useState<number | ''>('');\n  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>(config.BillDiscountType || 'flat');"
)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
