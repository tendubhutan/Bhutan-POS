import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

old_terms = r"""          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <label className="block text-\[11px\] font-bold text-slate-700 mb-1">Terms & Conditions / Invoice Notes</label>
            <textarea
              rows=\{2\}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              placeholder="Enter terms and conditions or specific notes for this invoice\.\.\."
              value=\{termsAndConditions\}
              onChange=\{\(e\) => setTermsAndConditions\(e\.target\.value\)\}
            />
          </div>"""

content = re.sub(old_terms, "", content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
