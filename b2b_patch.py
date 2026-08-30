import re

with open("src/components/SalesInvoiceEntry.tsx", "r") as f:
    content = f.read()

# 1. Add Discount states
state_injection = """  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Discount settings
  const [showItemDiscount, setShowItemDiscount] = useState(false);
  const [showBillDiscount, setShowBillDiscount] = useState(false);
  const [billDiscount, setBillDiscount] = useState<number | ''>('');
  const [billDiscountType, setBillDiscountType] = useState<'flat' | 'percent'>('flat');
"""
content = content.replace("  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);\n  const [savedInvoice, setSavedInvoice] = useState<any>(null);\n  const [showPrintModal, setShowPrintModal] = useState(false);", state_injection)

# 2. Add calculateTotals() logic
totals_logic = """  const isCustomerGstExempted = false; // We can expand this later if needed

  const calculateTotals = () => {
    let taxable = 0, zeroRated = 0, gstAmt = 0, rawTotal = 0;
    cart.forEach(l => {
      const lineDisc = showItemDiscount ? (Number(l.discount) || 0) : 0;
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0) - lineDisc;
      const isZero = isCustomerGstExempted || String(l.zeroRated).toUpperCase() === 'Y';
      const lineGst = isZero ? 0 : (gross * (Number(l.gstPct) || 0) / 100);
      if (isZero) zeroRated += gross; else taxable += gross;
      gstAmt += lineGst;
      rawTotal += (gross + lineGst);
    });

    const expenses = additionalExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    rawTotal += expenses;

    let discountAmt = 0;
    if (showBillDiscount && billDiscount !== '') {
      const d = Number(billDiscount);
      if (billDiscountType === 'percent') {
        discountAmt = (rawTotal * d) / 100;
      } else {
        discountAmt = d;
      }
    }

    const finalTotal = Math.max(0, rawTotal - discountAmt);
    
    return {
      taxable,
      zeroRated,
      gstAmt,
      subtotal: rawTotal,
      discount: discountAmt,
      total: finalTotal
    };
  };

  const totals = calculateTotals();
"""
# Replace totalAmount logic
total_amount_regex = r"const totalAmount = cart\.reduce\(\(sum, line\) => sum \+ \(line\.qty \* line\.rate\) \+ \(Number\(line\.gstAmt\) \|\| 0\), 0\) \+ additionalExpenses\.reduce\(\(sum, exp\) => sum \+ \(Number\(exp\.amount\) \|\| 0\), 0\);"
content = re.sub(total_amount_regex, totals_logic, content)

# 3. Update Save Payload
save_payload_regex = r"termsAndConditions: termsAndConditions,"
save_payload_repl = """termsAndConditions: termsAndConditions,
      billDiscount: (showBillDiscount && billDiscount !== '') ? Number(billDiscount) : 0,
      billDiscountType: billDiscountType,"""
content = content.replace(save_payload_regex, save_payload_repl)


with open("src/components/SalesInvoiceEntry.tsx", "w") as f:
    f.write(content)
