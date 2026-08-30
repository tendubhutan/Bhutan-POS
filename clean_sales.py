import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = re.sub(r"const \[termsAndConditions, setTermsAndConditions\] = useState\(config\.FooterTerms \|\| ''\);\n", "", content)
content = re.sub(r"termsAndConditions: termsAndConditions,\n", "", content)

# Remove setBillDiscountType
content = re.sub(r"const \[billDiscountType, setBillDiscountType\] = useState\w*\('<select>' \| 'flat' \| 'percent'\)\('flat'\);\n", "", content)
content = re.sub(r"const \[billDiscountType, setBillDiscountType\] = useState\w*<'flat' \| 'percent'>\('flat'\);\n", "", content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
