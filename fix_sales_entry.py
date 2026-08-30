import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix setSavedInvoice & setShowPrintModal states
state_injection = """  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);"""
content = content.replace("  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);", state_injection)

# Fix save payload
content = content.replace("billNo: editingBillNo", "invoiceNo: editingBillNo")

# Inject description into cart rows
table_header_regex = r'<th className="px-3 py-2 text-left font-bold text-slate-700 bg-slate-100 border-b border-slate-200">Item</th>'
table_header_replacement = """<th className="px-3 py-2 text-left font-bold text-slate-700 bg-slate-100 border-b border-slate-200 w-1/4">Item</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 bg-slate-100 border-b border-slate-200 w-1/4">Description</th>"""
content = re.sub(table_header_regex, table_header_replacement, content)

table_col_regex = r'(<td className="px-3 py-2">.*?<div className="font-bold text-slate-800">.*?</div>\s*</td>)'
table_col_replacement = r"""\1
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="w-full bg-transparent border-0 border-b border-slate-300 focus:border-indigo-500 focus:ring-0 text-xs px-1 py-1"
                      placeholder="Add description..."
                      value={line.description || ''}
                      onChange={(e) => {
                        const updated = [...cart];
                        updated[idx].description = e.target.value;
                        setCart(updated);
                      }}
                    />
                  </td>"""
content = re.sub(table_col_regex, table_col_replacement, content, flags=re.DOTALL)

# Let's also check if I can just manually find and replace using standard find logic in Python to avoid regex misses.
with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)

