import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Currently showItemDiscount is: 
# const showItemDiscount = config.EnableItemDiscount === 'true';

# Let's change it to respect posSettings.enableItemDiscount

old_showItemDisc = r"const showItemDiscount = config\.EnableItemDiscount === 'true';"
new_showItemDisc = "const showItemDiscount = posSettings.enableItemDiscount !== false && posSettings.enableDiscount !== false;"

content = re.sub(old_showItemDisc, new_showItemDisc, content)

# Currently showBillDiscount is:
# const showBillDiscount = config.EnableBillDiscount === 'true';
# Change it to respect posSettings.enableBillDiscount
old_showBillDisc = r"const showBillDiscount = config\.EnableBillDiscount === 'true';"
new_showBillDisc = "const showBillDiscount = posSettings.enableBillDiscount !== false;"

content = re.sub(old_showBillDisc, new_showBillDisc, content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
