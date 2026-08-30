import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# Add states
state_injection = """  const [billNo, setBillNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(config.FooterTerms || '');"""
content = content.replace("  const [billNo, setBillNo] = useState('');", state_injection)

# Fix saveSalesInvoice call
save_regex = r"customer: \{\s*ledger: form\.customerLedger,\s*name: form\.customerName,\s*gstNo: form\.customerGSTNo\s*\},"
save_replacement = """customer: {
        ledger: customerLedger ? customerLedger['Ledger Name'] : customerName,
        name: customerName,
        gstNo: customerLedger ? customerLedger['GST No'] : ''
      },"""
content = re.sub(save_regex, save_replacement, content)

content = content.replace("orderNo: form.orderNo,", "orderNo: orderNo,")
content = content.replace("orderDate: form.orderDate,", "orderDate: orderDate,")
content = content.replace("deliveryNoteNo: form.deliveryNoteNo,", "deliveryNoteNo: deliveryNoteNo,")
content = content.replace("termsAndConditions: form.termsAndConditions,", "termsAndConditions: termsAndConditions,")

with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
