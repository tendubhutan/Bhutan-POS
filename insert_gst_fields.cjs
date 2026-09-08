const fs = require('fs');
let code = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

const gstBlock = `

          {/* GST Input Claim Tracking Form (Only for Payment Vouchers) */}
          {activeVType === 'P' && config.EnableGSTInputTax === 'true' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-indigo-900">GST Input Claim Details</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-indigo-600 font-medium">Transaction Type:</span>
                  <select
                    className="rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] font-bold text-indigo-900 outline-none focus:border-indigo-500"
                    value={gstInputType}
                    onChange={(e: any) => setGstInputType(e.target.value)}
                  >
                    <option value="None">Not Applicable</option>
                    <option value="Local Expenses">Local Expenses</option>
                    <option value="Bank Charges">Bank Charges</option>
                    <option value="Import Customs GST Payment">Import Customs GST Payment</option>
                  </select>
                </div>
              </div>

              {gstInputType !== 'None' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                  {gstInputType === 'Import Customs GST Payment' ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Supplier Country</label>
                        <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={supplierCountry} onChange={e => setSupplierCountry(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Declaration Date</label>
                        <input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={declarationDate} onChange={e => setDeclarationDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Declaration Number</label>
                        <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={declarationNo} onChange={e => setDeclarationNo(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Total Import Amount</label>
                        <input type="number" step="any" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={totalImportAmount !== undefined && totalImportAmount !== null ? totalImportAmount : ''} onChange={e => setTotalImportAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-0.5">GST Amount Paid</label>
                        <input type="number" step="any" className="w-full rounded border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs font-bold text-indigo-900 focus:border-indigo-500 outline-none" value={gstAmount !== undefined && gstAmount !== null ? gstAmount : ''} onChange={e => setGstAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Supplier Name (Party)</label>
                        <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Supplier GST No.</label>
                        <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={supplierGstNo} onChange={e => setSupplierGstNo(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Invoice Date</label>
                        <input type="date" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Invoice No.</label>
                        <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                      </div>
                      {gstInputType === 'Bank Charges' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Reference No.</label>
                          <input type="text" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="Bank Ref" />
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Taxable Value</label>
                        <input type="number" step="any" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={taxableAmount !== undefined && taxableAmount !== null ? taxableAmount : ''} onChange={e => setTaxableAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Exempted Value</label>
                        <input type="number" step="any" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-indigo-500 outline-none" value={exemptedAmount !== undefined && exemptedAmount !== null ? exemptedAmount : ''} onChange={e => setExemptedAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-0.5">GST @ 5%</label>
                        <input type="number" step="any" className="w-full rounded border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-xs font-bold text-indigo-900 focus:border-indigo-500 outline-none" value={gstAmount !== undefined && gstAmount !== null ? gstAmount : ''} onChange={e => setGstAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
`;

code = code.replace(
  /          \{\/\* Overall Narration at bottom of voucher entry \*\/\}/,
  gstBlock + '\n          {/* Overall Narration at bottom of voucher entry */}'
);

fs.writeFileSync('src/components/Vouchers.tsx', code);
