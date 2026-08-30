import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Fix save payload issues
save_call_regex = r'invoiceNo: billNo,\s*notes: billDate \? `Bill Date: \$\{billDate\}` : \'\',\s*invoiceNo: editingBillNo \|\| undefined'
save_call_replacement = r'notes: billDate ? `Bill Date: ${billDate}` : \'\',\n      invoiceNo: editingBillNo || undefined'
content = re.sub(save_call_regex, save_call_replacement, content)

# Fix setSavedInvoice usage
res_invoice_regex = r'setSavedInvoice\(res\.invoice\);'
res_invoice_replacement = r'setSavedInvoice(res as any);'
content = re.sub(res_invoice_regex, res_invoice_replacement, content)

# Ensure ThermalReceiptModal is actually rendered at the end of the file
if "showPrintModal &&" not in content:
    modal_injection = """
      {showPrintModal && (
        <ThermalReceiptModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          invoice={savedInvoice}
          config={config}
        />
      )}
    </div>
  );
};
"""
    content = re.sub(r'<\/div>\s*<\/div>\s*\);\s*\}\s*$', modal_injection, content)

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)

