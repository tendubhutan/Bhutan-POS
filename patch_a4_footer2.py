import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

a4_footer_regex = r'<div style="text-align: right;">\s*\$\{config\.ReceiptSignatureImage.*?</label>\s*</div>'
# Let's replace the whole parent div if we can find it. 
# Alternatively, I can just use sed.
