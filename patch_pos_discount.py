import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Replace showItemDiscount eval
old_pos = """  const showItemDiscount = 
    posSettings.enableItemDiscount !== false && 
    
    String(config.EnableItemDiscount) !== 'false';
  const showBillDiscount = 
    posSettings.enableBillDiscount !== false && 
    String(config.EnableBillDiscount) !== 'false';"""

new_pos = """  const showItemDiscount = config.EnableItemDiscount === 'true';
  const showBillDiscount = config.EnableBillDiscount === 'true';"""

content = content.replace(old_pos, new_pos)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
