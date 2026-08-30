import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Replace the messy block from <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-1"> to the Bill Breakdown Header
pattern = r'<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-1">.*?\{\/\* Bill Breakdown Header'
new_block = """<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-1">
        <div className="lg:col-span-2 space-y-3">
          {showBillDiscount && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Bill Lumpsum Discount</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Discount"
                  value={billDiscount}
                  onChange={e => setBillDiscount(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-24 text-right h-8 rounded border border-slate-300 px-2 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
                />
                <select
                  value={billDiscountType}
                  onChange={e => setBillDiscountType(e.target.value as 'flat' | 'percent')}
                  className="h-8 rounded border border-slate-300 px-1 text-xs font-semibold focus:border-indigo-500 outline-none bg-slate-50"
                >
                  <option value="flat">Flat ({config.CurrencySymbol || 'Nu.'})</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
          )}

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Terms & Conditions / Invoice Notes</label>
            <textarea
              rows={2}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              placeholder="Enter terms and conditions or specific notes for this invoice..."
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
            />
          </div>
        </div>

        {/* Bill Breakdown Header"""

content = re.sub(pattern, new_block, content, flags=re.DOTALL)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
