import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

update_cart_old = """  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt', val: number) => {
    const updated = [...cart];
    updated[index][field] = val;
    
    if (field === 'qty' || field === 'rate') {
      const isZ = isCustomerGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const gr = updated[index].qty * updated[index].rate;
      updated[index].gstAmt = isZ ? 0 : round2(gr * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
  };"""

update_cart_new = """  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt' | 'discount', val: number) => {
    const updated = [...cart];
    updated[index][field] = val as never; // Hack to bypass strict typing if 'discount' isn't explicitly in the union
    
    if (field === 'qty' || field === 'rate' || field === 'discount') {
      const isZ = isCustomerGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const lineDisc = showItemDiscount ? (Number(updated[index].discount) || 0) : 0;
      const gr = (updated[index].qty * updated[index].rate) - lineDisc;
      updated[index].gstAmt = isZ ? 0 : round2(Math.max(0, gr) * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
  };"""

content = content.replace(update_cart_old, update_cart_new)

# Also update the `onChange` for discount to use `updateCartLine`
discount_onchange_old = """onChange={(e) => {
                          const updated = [...cart];
                          updated[idx].discount = Number(e.target.value);
                          setCart(updated);
                        }}"""
discount_onchange_new = """onChange={(e) => updateCartLine(idx, 'discount', Number(e.target.value))}"""
content = content.replace(discount_onchange_old, discount_onchange_new)

# Update Amount line calculation inside the render block
amt_calc_old = """                  const gr = line.qty * line.rate;
                  const amt = gr + (Number(line.gstAmt) || 0);"""
amt_calc_new = """                  const lineDisc = showItemDiscount ? (Number(line.discount) || 0) : 0;
                  const gr = (line.qty * line.rate) - lineDisc;
                  const amt = Math.max(0, gr) + (Number(line.gstAmt) || 0);"""
content = content.replace(amt_calc_old, amt_calc_new)

# update Amount in the column (if it's not already correct)
content = content.replace("{(((line.qty * line.rate) - (showItemDiscount ? (Number(line.discount) || 0) : 0)) + (Number(line.gstAmt) || 0)).toFixed(2)}", "{amt.toFixed(2)}")


with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
