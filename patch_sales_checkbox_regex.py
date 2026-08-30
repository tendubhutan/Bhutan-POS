import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

content = re.sub(
    r'<div className="flex items-center gap-4 mb-2">.*?<label.*?Enable Item-wise Discount.*?</label>.*?<label.*?Enable Bill Lumpsum Discount.*?</label>.*?</div>', 
    '<label className="block text-xs font-bold text-slate-700 mb-1.5">Terms & Conditions</label>', 
    content, 
    flags=re.DOTALL
)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
