import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

old_bank = r"""            <div class="bank-info">
              \$\{config\.CompanyBankDetails \? `<b>Bank Transfer Details:</b><br><span style="white-space: pre-wrap;">\$\{config\.CompanyBankDetails\}</span><br><br>` : ''\}
              \$\{resolvedTerms \? `<b>Terms & Conditions:</b><br><span style="white-space: pre-wrap; font-size: 9\.5px; color: #475569;">\$\{resolvedTerms\}</span>` : ''\}
            </div>"""

new_bank = """            <div class="bank-info">
              ${config.CompanyBankDetails ? `<b>Bank Transfer Details:</b><br><span style="white-space: pre-wrap;">${config.CompanyBankDetails}</span><br><br>` : ''}
              ${resolvedTerms ? `<div style="margin-top: 10px;"><b>Terms & Conditions / Remarks:</b><br><span style="white-space: pre-wrap; font-size: 10px; color: #334155;">${resolvedTerms}</span></div>` : ''}
            </div>"""

content = re.sub(old_bank, new_bank, content)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
