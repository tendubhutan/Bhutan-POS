const fs = require('fs');
let code = fs.readFileSync('src/components/SalesInvoiceEntry.tsx', 'utf8');

code = code.replace(
  `      const data = getFullLedgerStatement(customerName);\n      setReport(data.report || []);\n      setClosingBal(data.closingBal || 0);`,
  `      const data = getFullLedgerStatement(customerName);\n      let bal = data.openingBalance || 0;\n      (data.rows || []).forEach(r => bal += (r.Debit || 0) - (r.Credit || 0));\n      setReport(data.rows || []);\n      setClosingBal(bal);`
);

code = code.replace(
  `                          <td className="px-2 py-1.5 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString() : '-'}</td>\n                          <td className="px-2 py-1.5 truncate max-w-[100px]" title={r.refNo}>{r.refNo || r.type}</td>\n                          <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">{r.dr ? Number(r.dr).toFixed(2) : ''}</td>\n                          <td className="px-2 py-1.5 text-right text-rose-600 font-medium">{r.cr ? Number(r.cr).toFixed(2) : ''}</td>`,
  `                          <td className="px-2 py-1.5 whitespace-nowrap">{r.DateIso ? new Date(r.DateIso).toLocaleDateString() : '-'}</td>\n                          <td className="px-2 py-1.5 truncate max-w-[100px]" title={r['Ref No']}>{r['Ref No'] || r.Type}</td>\n                          <td className="px-2 py-1.5 text-right text-emerald-600 font-medium">{r.Debit ? Number(r.Debit).toFixed(2) : ''}</td>\n                          <td className="px-2 py-1.5 text-right text-rose-600 font-medium">{r.Credit ? Number(r.Credit).toFixed(2) : ''}</td>`
);

// Fix Phone doesn't exist on Ledger
code = code.replace(
  `{customerLedger?.Phone || customerLedger?.Mobile || '-'}`,
  `{customerLedger?.Mobile || '-'}`
);

fs.writeFileSync('src/components/SalesInvoiceEntry.tsx', code);
