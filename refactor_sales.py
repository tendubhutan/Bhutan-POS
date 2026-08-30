import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = content.replace("PurchaseEntry", "SalesInvoiceEntry")
content = content.replace("savePurchaseInvoice", "saveSalesInvoice")
content = content.replace("Purchase Invoice", "Sales Invoice (B2B)")
content = content.replace("Purchase Date", "Invoice Date")
content = content.replace("supplier:", "customer:")
content = content.replace("Supplier Details", "Customer Details")
content = content.replace("Supplier Ledger", "Customer Ledger")
content = content.replace("Supplier Name", "Customer Name")
content = content.replace("Select Supplier Ledger", "Select Customer Ledger")
content = content.replace("Select supplier...", "Select customer...")
content = content.replace("Supplier Name (Print)", "Customer Name (Print)")
content = content.replace("Select or type supplier name...", "Select or type customer name...")
content = content.replace("Supplier GST No", "Customer GST No")
content = content.replace("supplierLedger", "customerLedger")
content = content.replace("supplierName", "customerName")
content = content.replace("supplierGSTNo", "customerGSTNo")
content = content.replace("Purchase Saved Successfully!", "Sales Invoice Saved Successfully!")
content = content.replace("Purchase Failed", "Sales Invoice Failed")

# Add missing imports or fields if necessary. 
# PurchaseEntry doesn't have termsAndConditions. Let's add them.
# We'll inject these fields before the Subtotal/Discount section.

injection_form = """
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Order No</label>
                  <input type="text" value={form.orderNo || ''} onChange={e => setForm({...form, orderNo: e.target.value})} className="w-full h-9 rounded-xl border border-slate-300 px-3 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Order Date</label>
                  <input type="date" value={form.orderDate || ''} onChange={e => setForm({...form, orderDate: e.target.value})} className="w-full h-9 rounded-xl border border-slate-300 px-3 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Note No</label>
                  <input type="text" value={form.deliveryNoteNo || ''} onChange={e => setForm({...form, deliveryNoteNo: e.target.value})} className="w-full h-9 rounded-xl border border-slate-300 px-3 text-sm focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Terms & Conditions (Editable)</label>
                <textarea rows={3} value={form.termsAndConditions !== undefined ? form.termsAndConditions : (config.FooterTerms || '')} onChange={e => setForm({...form, termsAndConditions: e.target.value})} className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 outline-none"></textarea>
              </div>
              
              {/* Payment Split */}
"""

content = content.replace("{/* Payment Split */}", injection_form)

# Add properties to form state
state_injection = """  const [form, setForm] = useState({
    voucherNo: '',
    date: new Date().toISOString().split('T')[0],
    orderNo: '',
    orderDate: '',
    deliveryNoteNo: '',
    termsAndConditions: config.FooterTerms || '',"""
content = re.sub(r'const \[form, setForm\] = useState\(\{[^}]*date: [^,]+,', state_injection, content, count=1)

# Modify payload mapping
payload_injection = """      customer: {
        ledger: form.customerLedger,
        name: form.customerName,
        gstNo: form.customerGSTNo
      },
      orderNo: form.orderNo,
      orderDate: form.orderDate,
      deliveryNoteNo: form.deliveryNoteNo,
      termsAndConditions: form.termsAndConditions,"""

content = re.sub(r'customer:\s*\{[^}]+\},', payload_injection, content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
