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
    (updated[index] as any)[field] = val;
    
    if (field === 'qty' || field === 'rate' || field === 'discount') {
      const isZ = isCustomerGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const lineDisc = showItemDiscount ? (Number(updated[index].discount) || 0) : 0;
      const gr = (updated[index].qty * updated[index].rate) - lineDisc;
      updated[index].gstAmt = isZ ? 0 : round2(Math.max(0, gr) * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
  };"""

content = content.replace(update_cart_old, update_cart_new)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
