import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

terms_injection = """      {/* Terms and Conditions / Notes */}
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

      {/* Save Actions Bar */}"""

content = content.replace("{/* Save Actions Bar */}", terms_injection)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
