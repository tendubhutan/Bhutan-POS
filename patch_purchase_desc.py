import re

with open("src/components/PurchaseEntry.tsx", "r") as f:
    content = f.read()

# 1. We'll update posSettings.enableItemDiscount logic in POSBilling (not in PurchaseEntry, but let's do PurchaseEntry description first).
# In PurchaseEntry.tsx, look for line description field.
# Currently it uses `line.lineDescription`. Let's hide it completely by default or remove it as requested "Item line discription on purchase is not required."

old_desc = r"""                      <div className="mt-1\.5">
                        <input
                          type="text"
                          placeholder="Line description\.\.\."
                          value=\{line\.lineDescription \|\| ''\}
                          onChange=\{e => updateCartLine\(idx, 'lineDescription', e\.target\.value\)\}
                          className="w-full bg-transparent border-0 border-b border-dashed border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-0 py-0\.5"
                        />
                      </div>"""

content = re.sub(old_desc, "", content)

with open("src/components/PurchaseEntry.tsx", "w") as f:
    f.write(content)
