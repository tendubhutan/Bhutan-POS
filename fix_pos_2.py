import re

with open("src/components/POSBilling.tsx", "r") as f:
    content = f.read()

# Replace billDiscountType with config.BillDiscountType everywhere
content = re.sub(r"\bbillDiscountType\b", "config.BillDiscountType", content)

# Remove the button group
old_buttons = r"""              <div className="flex bg-slate-200/70 p-0\.5 rounded-lg border border-slate-300 shadow-inner mr-2">
                <button
                  type="button"
                  className=\{`px-1\.5 py-0\.5 rounded-md transition cursor-pointer \$\{
                    config\.BillDiscountType === 'flat'
                      \? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  \}`}
                  title="Flat discount amount"
                >
                  \{config\.CurrencySymbol \|\| 'Nu\.'\}
                </button>
                <button
                  type="button"
                  className=\{`px-1\.5 py-0\.5 rounded-md transition cursor-pointer \$\{
                    config\.BillDiscountType === 'percent'
                      \? 'bg-white text-indigo-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  \}`}
                  title="Percentage discount \(%\)"
                >
                  %
                </button>
              </div>"""

content = re.sub(old_buttons, "", content)

# Change config.BillDiscountType === 'flat' to config.BillDiscountType !== 'percent' where appropriate, or just leave it.

with open("src/components/POSBilling.tsx", "w") as f:
    f.write(content)
