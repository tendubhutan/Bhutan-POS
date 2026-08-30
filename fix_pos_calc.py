import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Replace config.BillDiscountType with billDiscountType ONLY in the dynamic contexts
content = re.sub(
    r"if \(config\.BillDiscountType === 'percent'\) \{",
    "if (billDiscountType === 'percent') {",
    content
)
content = re.sub(
    r"holdBill\(name, cart, totals\.discountValue, config\.BillDiscountType\);",
    "holdBill(name, cart, totals.discountValue, billDiscountType);",
    content
)
content = re.sub(
    r"config\.BillDiscountType === 'flat'\n\s*\? 'bg-white text-indigo-700 shadow-2xs font-black'",
    "billDiscountType === 'flat'\n                      ? 'bg-white text-indigo-700 shadow-2xs font-black'",
    content
)
content = re.sub(
    r"config\.BillDiscountType === 'percent'\n\s*\? 'bg-white text-indigo-700 shadow-2xs font-black'",
    "billDiscountType === 'percent'\n                      ? 'bg-white text-indigo-700 shadow-2xs font-black'",
    content
)
content = re.sub(
    r"placeholder=\{config\.BillDiscountType === 'flat' \? '0\.00' : '0%'\}",
    "placeholder={billDiscountType === 'flat' ? '0.00' : '0%'}",
    content
)
content = re.sub(
    r"\{config\.BillDiscountType === 'percent' && \(",
    "{billDiscountType === 'percent' && (",
    content
)

# And add the onClick handlers to the buttons
content = re.sub(
    r"title=\"Flat discount amount\"\n\s*>",
    "title=\"Flat discount amount\"\n                  onClick={() => setBillDiscountType('flat')}\n                >",
    content
)
content = re.sub(
    r"title=\"Percentage discount \(%\)\"\n\s*>",
    "title=\"Percentage discount (%)\"\n                  onClick={() => setBillDiscountType('percent')}\n                >",
    content
)


# Don't forget that handleResumeBill has a place where we need to restore billDiscountType
content = re.sub(
    r"setBillDiscount\(res\.billDiscountValue \|\| ''\);\n",
    "setBillDiscount(res.billDiscountValue || '');\n      setBillDiscountType(res.billDiscountType || 'flat');\n",
    content
)

# Also handleClearBill should reset billDiscountType
content = re.sub(
    r"setBillDiscount\(''\);\n\s*onDataRefresh",
    "setBillDiscount('');\n    setBillDiscountType(config.BillDiscountType || 'flat');\n    onDataRefresh",
    content
)
content = re.sub(
    r"setBillDiscount\(''\);\n\s*setWalkInDetails\(null\);\n",
    "setBillDiscount('');\n    setBillDiscountType(config.BillDiscountType || 'flat');\n    setWalkInDetails(null);\n",
    content
)
content = re.sub(
    r"setBillDiscount\(''\);\n\s*setSearchTerm",
    "setBillDiscount('');\n      setBillDiscountType(config.BillDiscountType || 'flat');\n      setSearchTerm",
    content
)


with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
