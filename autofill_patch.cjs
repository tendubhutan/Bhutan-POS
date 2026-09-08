const fs = require('fs');
let code = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

const autofillCode = `
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const lastDerivedGst = useRef({
    supplierName: '',
    taxableAmount: '',
    gstAmount: '',
    referenceNo: '',
    invoiceDate: ''
  });

  useEffect(() => {
    if (activeVType === 'P' && config.EnableGSTInputTax === 'true' && gstInputType !== 'None') {
      let bankLg = '';
      let expenseAmt = 0;
      let gstAmt = 0;
      
      if (entryMode === 'double') {
        lines.forEach(l => {
          if (!l.ledger || !l.type) return;
          const lgObj = ledgers.find(lg => lg['Ledger Name'] === l.ledger);
          const grp = lgObj?.Group || '';
          const amt = Number(l.debit) || Number(l.credit) || 0;
          if (l.type === 'Cr' && (grp === 'Bank Accounts' || grp === 'Cash-in-Hand')) {
            bankLg = l.ledger;
          }
          if (l.type === 'Dr') {
            if (grp === 'Duties & Taxes' || l.ledger.toLowerCase().includes('gst')) {
              gstAmt += amt;
            } else {
              expenseAmt += amt;
            }
          }
        });
      } else {
        const lgObj = ledgers.find(lg => lg['Ledger Name'] === modeLedger);
        if (lgObj && (lgObj.Group === 'Bank Accounts' || lgObj.Group === 'Cash-in-Hand')) {
          bankLg = modeLedger;
        }
        expenseAmt = Number(amount) || 0;
      }

      const derivedSupplier = (gstInputType === 'Bank Charges' && bankLg) ? bankLg : '';
      const derivedTaxable = expenseAmt > 0 ? expenseAmt.toString() : '';
      const derivedGst = gstAmt > 0 ? gstAmt.toString() : (expenseAmt > 0 && gstInputType !== 'Import Customs GST Payment' ? (expenseAmt * 0.05).toFixed(2) : '');
      const derivedRef = transactionId || '';
      const derivedDate = date || '';

      if (derivedSupplier && (!supplierName || supplierName === lastDerivedGst.current.supplierName)) {
        setSupplierName(derivedSupplier);
        lastDerivedGst.current.supplierName = derivedSupplier;
      }
      if (derivedTaxable && (!taxableAmount || taxableAmount.toString() === lastDerivedGst.current.taxableAmount)) {
        setTaxableAmount(Number(derivedTaxable));
        lastDerivedGst.current.taxableAmount = derivedTaxable;
      }
      if (derivedGst && (!gstAmount || gstAmount.toString() === lastDerivedGst.current.gstAmount)) {
        setGstAmount(Number(derivedGst));
        lastDerivedGst.current.gstAmount = derivedGst;
      }
      if (derivedRef && (!referenceNo || referenceNo === lastDerivedGst.current.referenceNo)) {
        setReferenceNo(derivedRef);
        lastDerivedGst.current.referenceNo = derivedRef;
      }
      if (derivedDate && (!invoiceDate || invoiceDate === lastDerivedGst.current.invoiceDate)) {
        setInvoiceDate(derivedDate);
        lastDerivedGst.current.invoiceDate = derivedDate;
      }
    }
  }, [gstInputType, lines, amount, partyLedger, modeLedger, transactionId, date, entryMode, ledgers, config.EnableGSTInputTax, activeVType]);
`;

code = code.replace(
  /  const linesRef = useRef\(lines\);\n  useEffect\(\(\) => \{\n    linesRef\.current = lines;\n  \}, \[lines\]\);/,
  autofillCode
);

fs.writeFileSync('src/components/Vouchers.tsx', code);
