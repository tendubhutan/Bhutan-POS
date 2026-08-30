import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

old_resume = r"""      if \(res\.billDiscount && res\.billDiscount > 0\) \{
        setBillDiscount\(res\.billDiscount\);
      \} else \{
        setBillDiscount\(''\);
      \}"""

new_resume = """      if (res.billDiscount && res.billDiscount > 0) {
        setBillDiscount(res.billDiscount);
      } else {
        setBillDiscount('');
      }
      setBillDiscountType(res.billDiscountType || 'flat');"""

content = re.sub(old_resume, new_resume, content)

# Check clear bill
old_clear = r"""    setCart\(\[\]\);
    setCustomerName\(''\);
    setWalkInDetails\(null\);
    setBillDiscount\(''\);
    onDataRefresh\(\);"""

new_clear = """    setCart([]);
    setCustomerName('');
    setWalkInDetails(null);
    setBillDiscount('');
    setBillDiscountType(config.BillDiscountType || 'flat');
    onDataRefresh();"""

content = re.sub(old_clear, new_clear, content)

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
