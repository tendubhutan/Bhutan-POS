import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

replacement = """<div class="sig-block">
              <div style="height: 35px;"></div>
              <div class="sig-line">Receiver's Signature</div>
            </div>
            <div class="sig-block">
              ${config.ReceiptSignatureImage ? `<img src="${config.ReceiptSignatureImage}" style="max-height: 40px; margin-bottom: 2px;" /><br>` : '<div style="height: 35px;"></div>'}
              <div class="sig-line">${config.SignatoryTitle || 'Authorized Signatory'}</div>
            </div>"""

content = re.sub(r'<div class="sig-block">.*?<\/div>\s*<\/div>', replacement + '\n          </div>', content, flags=re.DOTALL)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
