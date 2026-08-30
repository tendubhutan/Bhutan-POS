import re

with open("src/components/PurchaseEntry.tsx", "r") as f:
    content = f.read()

# Update updateCartLine
old_update = """  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt', val: number) => {
    const updated = [...cart];
    updated[index][field] = val;
    
    if (field === 'qty' || field === 'rate') {
      const isZ = isSupplierGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const gr = updated[index].qty * updated[index].rate;
      updated[index].gstAmt = isZ ? 0 : round2(gr * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
    if (field === 'qty' && updated[index].isSerialized === 'Y' && showSerials) {
      setActiveSerialIndex(index);
      setSerialModalOpen(true);
    }
  };"""

new_update = """  const updateCartLine = (index: number, field: 'qty' | 'rate' | 'gstAmt' | 'lineDescription', val: any) => {
    const updated = [...cart];
    (updated[index] as any)[field] = val;
    
    if (field === 'qty' || field === 'rate') {
      const isZ = isSupplierGstExempted || String(updated[index].zeroRated).toUpperCase() === 'Y';
      const gr = updated[index].qty * updated[index].rate;
      updated[index].gstAmt = isZ ? 0 : round2(gr * (Number(updated[index].gstPct) || 0) / 100);
    }

    setCart(updated);
    if (field === 'qty' && updated[index].isSerialized === 'Y' && showSerials) {
      setActiveSerialIndex(index);
      setSerialModalOpen(true);
    }
  };"""
content = content.replace(old_update, new_update)

# Update the item column display
old_td = """                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 align-middle font-medium text-slate-800 break-words">
                      <div className="font-semibold text-slate-900">{line.itemName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Code: {line.itemCode}</span>
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""

new_td = """                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 align-top font-medium text-slate-800 break-words">
                      <div className="font-semibold text-slate-900">{line.itemName}</div>
                      <div className="mt-1">
                        <input
                          type="text"
                          placeholder="Line description..."
                          value={line.lineDescription || ''}
                          onChange={e => updateCartLine(idx, 'lineDescription', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-dashed border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-0 py-0.5"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        {line.gstPct > 0 && <span>GST: {line.gstPct}%</span>}
                        {isZ && <span className="bg-emerald-100 text-emerald-800 px-1 rounded">Exempt</span>}
                      </div>"""

content = content.replace(old_td, new_td)

with open("src/components/PurchaseEntry.tsx", "w") as f:
    f.write(content)
