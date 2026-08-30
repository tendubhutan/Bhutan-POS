import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

replacement = """${config.ReceiptSignatureImage ? `
            <div class="dashed-line"></div>
            <div class="text-center">
              <img src="${config.ReceiptSignatureImage}" style="max-height: 35px; margin: 2px auto 0 auto; display: block;" />
              <div style="font-size: 8px; font-weight: bold; border-top: 1px solid #000; display: inline-block; padding-top: 2px; margin-top: 2px;">
                ${config.SignatoryTitle || 'Authorized Signatory'}
              </div>
            </div>
          ` : ''}
          <div class="dashed-line"></div>
          <div style="text-align: center; margin-top: 20px;">
             <div style="width: 100px; border-bottom: 1px solid #000; margin: 0 auto 5px auto;"></div>
             <div style="font-size: 9px; font-weight: bold;">Receiver's Signature</div>
          </div>"""

content = re.sub(r'\$\{config\.ReceiptSignatureImage \? `.*?\` : \'\'\}', replacement, content, flags=re.DOTALL)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
