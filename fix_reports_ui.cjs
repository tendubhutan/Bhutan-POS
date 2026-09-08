const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

const gstInputTables = `
            {/* GST Input - Domestic & Expenses */}
            {mainCategory === 'gst_input_dom' && (
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Transaction Type</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Supplier Name</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">GSTIN</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Invoice Date</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Invoice No</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Exempted</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">GST @ 5%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.rows || []).map((r: any, idx: number) => (
                    <tr key={idx} onClick={() => onDrillVoucher(r.invoiceNo || r.referenceNo)} className="hover:bg-slate-50 cursor-pointer transition">
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.transactionType}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.supplierName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.supplierGstNo || '-'}</td>
                      <td className="py-2 px-3 text-center font-mono">{formatDateStr(r.invoiceDate)}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.invoiceNo}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{fmt(r.taxable)}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{fmt(r.exempted)}</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-indigo-700">{fmt(r.gstAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {reportData.totals && (
                  <tfoot className="sticky bottom-0 bg-slate-50 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] ring-1 ring-slate-200">
                    <tr className="font-bold text-slate-900 border-t border-slate-300">
                      <td colSpan={5} className="py-3 px-3 text-right uppercase text-[11px] tracking-wider text-slate-500">Total</td>
                      <td className="py-3 px-3 text-right font-mono text-sm">{fmt(reportData.totals.taxable)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm">{fmt(reportData.totals.exempted)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-indigo-700">{fmt(reportData.totals.gstAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {/* GST Input - Import */}
            {mainCategory === 'gst_input_imp' && (
              <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm">
                <thead className="sticky top-0 sm:top-0 z-30 bg-slate-100 shadow-md ring-1 ring-slate-200">
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Supplier Country</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-center">Declaration Date</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-left">Declaration Number</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">Total Import Amount</th>
                    <th className="bg-slate-100 bg-clip-padding py-2.5 px-3 text-right">GST Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reportData.rows || []).map((r: any, idx: number) => (
                    <tr key={idx} onClick={() => onDrillVoucher(r.declarationNo)} className="hover:bg-slate-50 cursor-pointer transition">
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.supplierCountry}</td>
                      <td className="py-2 px-3 text-center font-mono">{formatDateStr(r.declarationDate)}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.declarationNo}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">{fmt(r.totalImportAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono font-black text-indigo-700">{fmt(r.gstAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {reportData.totals && (
                  <tfoot className="sticky bottom-0 bg-slate-50 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] ring-1 ring-slate-200">
                    <tr className="font-bold text-slate-900 border-t border-slate-300">
                      <td colSpan={3} className="py-3 px-3 text-right uppercase text-[11px] tracking-wider text-slate-500">Total</td>
                      <td className="py-3 px-3 text-right font-mono text-sm">{fmt(reportData.totals.totalImportAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm text-indigo-700">{fmt(reportData.totals.gstAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
`;

code = code.replace(
  /            \{\/\* Stock Summary & Valuation \*\/\}/,
  gstInputTables + '\n            {/* Stock Summary & Valuation */}'
);

fs.writeFileSync('src/components/Reports.tsx', code);
