import re

def fix(file):
    with open(file, "r") as f:
        content = f.read()

    # Remove termsAndConditions state and references if any (mostly just PurchaseEntry)
    content = re.sub(r"const \[termsAndConditions, setTermsAndConditions\] = useState\(config\.FooterTerms \|\| ''\);\n", "", content)
    content = re.sub(r"\s*termsAndConditions: termsAndConditions,\n", "\n", content)

    # Remove billDiscountType state and references
    content = re.sub(r"const \[billDiscountType, setBillDiscountType\] = useState[^\n]*\n", "", content)
    content = re.sub(r"\s*billDiscountType: billDiscountType,\n", "\n", content)
    
    # Remove from POSBilling's calculateTotals result
    content = re.sub(r"\s*discountType: billDiscountType,\n", "\n", content)
    content = re.sub(r"\s*billDiscountType: totals\.discountType,\n", "\n", content)
    
    # Remove from saveSalesInvoice call in POS
    content = re.sub(r"\s*discountType: totals\.discountType,\n", "\n", content)

    with open(file, "w") as f:
        f.write(content)

fix("src/components/PurchaseEntry.tsx")
fix("src/components/POSBilling.tsx")
