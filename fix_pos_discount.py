import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Add state back
content = re.sub(
    r"const \[billDiscount, setBillDiscount\] = useState<number \| ''>\(''\);\n",
    "const [billDiscount, setBillDiscount] = useState<number | ''>('');\n  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>(config.BillDiscountType || 'flat');\n",
    content
)

# Fix calculation in calculateTotals (around line 500)
# We might have replaced it with config.BillDiscountType before. Let's check how it looks currently.
