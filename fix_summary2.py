import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# The summary block replacement
old_summary_block = """            {/* Terms and Conditions / Notes */}
      <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs shrink-0 mb-1">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">Terms & Conditions / Invoice Notes</label>
        <textarea
          rows={2}
          className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          placeholder="Enter terms and conditions or specific notes for this invoice..."
          value={termsAndConditions}
          onChange={(e) => setTermsAndConditions(e.target.value)}
        />
      </div>

      {/* Save Actions Bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">"""

new_summary_block = """      {/* Discounts & Bill Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-1">
        <div className="lg:col-span-2 space-y-2">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                <input type="checkbox" checked={showItemDiscount} onChange={e => setShowItemDiscount(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Enable Item-wise Discount
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                <input type="checkbox" checked={showBillDiscount} onChange={e => setShowBillDiscount(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                Enable Bill Lumpsum Discount
              </label>
            </div>
            
            {showBillDiscount && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Bill Disc"
                  value={billDiscount}
                  onChange={e => setBillDiscount(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-24 text-right h-8 rounded border border-slate-300 px-2 text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none"
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
            )}
            
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
        
        {/* Bill Breakdown Header: Taxable Sale, Exempted Sale, GST & Total Invoice Amount */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 text-white p-3.5 shadow-md space-y-2 flex flex-col justify-center">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400">Taxable Sale</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                <span className="text-[11px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                {totals.taxable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            {totals.zeroRated > 0 && (
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium text-slate-400">Exempted Sale</span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  <span className="text-[11px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                  {totals.zeroRated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-300">
              <span className="font-medium text-slate-400">GST Amount</span>
              <span className="font-mono font-bold text-slate-100 text-sm">
                <span className="text-[11px] text-slate-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                {totals.gstAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {totals.discount > 0 && (
              <div className="flex items-center justify-between text-emerald-400">
                <span className="font-medium">Discount</span>
                <span className="font-mono font-bold text-emerald-300 text-sm">
                  -<span className="text-[11px] text-emerald-500 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                  {totals.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            
            {additionalExpenses.length > 0 && (
              <div className="flex items-center justify-between text-rose-300">
                <span className="font-medium">Addl. Charges</span>
                <span className="font-mono font-bold text-rose-200 text-sm">
                  +<span className="text-[11px] text-rose-400 font-normal mr-1">{config.CurrencySymbol || 'Nu.'}</span>
                  {additionalExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/80 pt-2 flex items-center justify-between">
            <span className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">Net Invoice</span>
            <span className="font-mono text-xl font-black text-emerald-400 drop-shadow-sm">
              <span className="text-sm text-emerald-600/70 mr-1">{config.CurrencySymbol || 'Nu.'}</span>
              {totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Save Actions Bar */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">"""

content = content.replace(old_summary_block, new_summary_block)

# Remove the old Total display at the end of the Save Actions bar since we have a nice widget now
old_total_display = """        <div className="text-base sm:text-lg font-black text-indigo-950 font-mono">
          Total: <span className="text-emerald-600">{config.CurrencySymbol || 'Nu.'} {totals.total.toFixed(2)}</span>
        </div>"""
content = content.replace(old_total_display, "")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
