import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

# We need to insert a Receiver's Signature block in the A4 string before the </body>.
# Currently it might just be the Authorized Signatory. Let's find it.
# Look for "Authorized Signatory"

a4_footer = """
            <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div style="text-align: center;">
                <div style="width: 150px; border-bottom: 1px solid #000; margin-bottom: 5px; margin-top: 40px;"></div>
                <div style="font-size: 11px; font-weight: bold;">Receiver's Signature</div>
              </div>
              <div style="text-align: center;">
                ${config.ReceiptSignatureImage 
                  ? `<img src="${config.ReceiptSignatureImage}" style="height: 40px; object-fit: contain; margin-bottom: 5px; filter: grayscale(100%);" />` 
                  : `<div style="width: 150px; border-bottom: 1px solid #000; margin-bottom: 5px; margin-top: 40px;"></div>`
                }
                <div style="font-size: 11px; font-weight: bold;">Authorized Signatory</div>
              </div>
            </div>
"""

# Let's see if we can replace the existing authorized signatory part in A4
# It might look like:
#               <div style="text-align: right;">
#                ${config.ReceiptSignatureImage ? ...

# Since it might be hard to match the exact HTML, let's just use sed or run a script to see what it is.
