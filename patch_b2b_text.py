import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Replace hardcoded Purchase Entry text
content = content.replace("Purchase Entry", "Sales Invoice (B2B)")
content = content.replace("handleSavePurchase", "handleSaveInvoice")
content = content.replace("item['Purchase Rate']", "item['Sales Rate']")
content = content.replace("purchaseRate: rate", "purchaseRate: item['Purchase Rate'] || 0")
content = content.replace("Purchase cart is empty.", "Invoice cart is empty.")
content = content.replace("onPrintPurchaseBarcodes", "onPrintBarcodes")
content = content.replace("Save Purchase", "Save Invoice")
content = content.replace("Add Purchase Items", "Add Invoice Items")
content = content.replace("No items in purchase grid yet.", "No items in invoice grid yet.")

# Fix barcode popup (sales typically don't print barcodes on receive, let's remove it)
barcode_prompt_regex = r"if \(confirm\('Sales Invoice \(B2B\) saved successfully! Do you want to print Barcode Stickers for received items now\?'\)\) \{\s*if \(onPrintBarcodes\) \{\s*onPrintBarcodes\(queueForBarcode\);\s*\}\s*\}"
content = re.sub(barcode_prompt_regex, "", content)

# Check if credit note stuff is there (just in case)
content = content.replace("Save Purchase (Credit)", "Save Invoice")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
