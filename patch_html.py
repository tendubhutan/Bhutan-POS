import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

# For A4 Printing (A4 Invoice Template string generation)
# Look for "<div><b>To:</b> ${invoice.customer.name || 'Cash Customer'}</div>"
# We should add orderNo, orderDate, deliveryNoteNo right after GST No.

a4_cust_regex = r"<div><b>To:<\/b> \$\{invoice\.customer\.name \|\| 'Cash Customer'\}<\/div>.*?<\/div>"
a4_cust_replacement = """<div><b>To:</b> ${invoice.customer.name || 'Cash Customer'}</div>
              ${invoice.customer.phone ? `<div><b>Ph:</b> ${invoice.customer.phone}</div>` : ''}
              ${invoice.customer.gstNo ? `<div><b>GST No:</b> ${invoice.customer.gstNo}</div>` : ''}
              ${invoice.orderNo ? `<div><b>Order No:</b> ${invoice.orderNo} ${invoice.orderDate ? `(Dt: ${invoice.orderDate})` : ''}</div>` : ''}
              ${invoice.deliveryNoteNo ? `<div><b>Delivery Note:</b> ${invoice.deliveryNoteNo}</div>` : ''}
            </div>"""

content = re.sub(r'<div><b>To:<\/b> \$\{invoice\.customer\.name.*?<\/div>\s*<\/div>', a4_cust_replacement, content, flags=re.DOTALL)

# For Thermal printing
thermal_cust_replacement = """<div style="font-weight: bold;">To: ${invoice.customer.name || 'Cash Customer'}</div>
            ${invoice.customer.phone ? `<div>Ph: ${invoice.customer.phone}</div>` : ''}
            ${invoice.customer.gstNo ? `<div>GST No: ${invoice.customer.gstNo}</div>` : ''}
            ${invoice.orderNo ? `<div>Order No: ${invoice.orderNo}</div>` : ''}
            ${invoice.deliveryNoteNo ? `<div>Delivery Note: ${invoice.deliveryNoteNo}</div>` : ''}
          </div>"""
content = re.sub(r'<div style="font-weight: bold;">To: \$\{invoice\.customer\.name.*?<\/div>\s*<\/div>', thermal_cust_replacement, content, flags=re.DOTALL)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
