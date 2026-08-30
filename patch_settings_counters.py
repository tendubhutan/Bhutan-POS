import re

with open("src/components/SettingsView.tsx", "r") as f:
    content = f.read()

# Add a function to update counters
old_set_form = """  const [form, setForm] = useState<Partial<Config>>(config);
"""
new_set_form = """  const [form, setForm] = useState<Partial<Config>>(config);
  const [counters, setCounters] = useState<Record<string, number>>(() => loadJson(STORAGE_KEYS.COUNTERS, {}));
  
  const handleCounterChange = (key: string, value: number) => {
    const nextVal = Math.max(0, value - 1);
    const updated = { ...counters, [key]: nextVal };
    setCounters(updated);
    saveJson(STORAGE_KEYS.COUNTERS, updated);
  };
"""

content = content.replace(old_set_form, new_set_form)

# Add Starting Number inputs next to prefixes
# Let's replace the whole Voucher Type Prefix Codes grid.
# Wait, it's easier to just do targeted replaces.

old_pmt = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Payment (PMT)</label>
                    <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PaymentVoucherPrefix || 'PMT-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.PaymentVoucherPrefix !== undefined ? form.PaymentVoucherPrefix : 'PMT-'}
                    onChange={e => setForm({ ...form, PaymentVoucherPrefix: e.target.value })}
                    placeholder="PMT-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_pmt = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Payment (PMT)</label>
                    <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PaymentVoucherPrefix || 'PMT-')}{(counters['PaymentVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.PaymentVoucherPrefix !== undefined ? form.PaymentVoucherPrefix : 'PMT-'}
                      onChange={e => setForm({ ...form, PaymentVoucherPrefix: e.target.value })}
                      placeholder="PMT-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['PaymentVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('PaymentVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_pmt, new_pmt)

old_rct = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Receipt (RCT)</label>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ReceiptVoucherPrefix || 'RCT-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.ReceiptVoucherPrefix !== undefined ? form.ReceiptVoucherPrefix : 'RCT-'}
                    onChange={e => setForm({ ...form, ReceiptVoucherPrefix: e.target.value })}
                    placeholder="RCT-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_rct = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Receipt (RCT)</label>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ReceiptVoucherPrefix || 'RCT-')}{(counters['ReceiptVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.ReceiptVoucherPrefix !== undefined ? form.ReceiptVoucherPrefix : 'RCT-'}
                      onChange={e => setForm({ ...form, ReceiptVoucherPrefix: e.target.value })}
                      placeholder="RCT-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['ReceiptVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('ReceiptVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_rct, new_rct)

old_jrn = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Journal (JRN)</label>
                    <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.JournalVoucherPrefix || 'JRN-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.JournalVoucherPrefix !== undefined ? form.JournalVoucherPrefix : 'JRN-'}
                    onChange={e => setForm({ ...form, JournalVoucherPrefix: e.target.value })}
                    placeholder="JRN-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_jrn = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Journal (JRN)</label>
                    <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.JournalVoucherPrefix || 'JRN-')}{(counters['JournalVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.JournalVoucherPrefix !== undefined ? form.JournalVoucherPrefix : 'JRN-'}
                      onChange={e => setForm({ ...form, JournalVoucherPrefix: e.target.value })}
                      placeholder="JRN-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['JournalVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('JournalVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_jrn, new_jrn)

old_ctr = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Contra (CTR)</label>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ContraVoucherPrefix || 'CTR-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.ContraVoucherPrefix !== undefined ? form.ContraVoucherPrefix : 'CTR-'}
                    onChange={e => setForm({ ...form, ContraVoucherPrefix: e.target.value })}
                    placeholder="CTR-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_ctr = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Contra (CTR)</label>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ContraVoucherPrefix || 'CTR-')}{(counters['ContraVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.ContraVoucherPrefix !== undefined ? form.ContraVoucherPrefix : 'CTR-'}
                      onChange={e => setForm({ ...form, ContraVoucherPrefix: e.target.value })}
                      placeholder="CTR-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['ContraVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('ContraVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_ctr, new_ctr)

old_sal = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Sales Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.SalesInvoicePrefix || 'SAL-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.SalesInvoicePrefix !== undefined ? form.SalesInvoicePrefix : 'SAL-'}
                    onChange={e => setForm({ ...form, SalesInvoicePrefix: e.target.value })}
                    placeholder="SAL-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_sal = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Sales Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.SalesInvoicePrefix || 'SAL-')}{(counters['SalesInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.SalesInvoicePrefix !== undefined ? form.SalesInvoicePrefix : 'SAL-'}
                      onChange={e => setForm({ ...form, SalesInvoicePrefix: e.target.value })}
                      placeholder="SAL-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['SalesInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('SalesInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_sal, new_sal)

old_pos = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">POS Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.POSInvoicePrefix || 'POS-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.POSInvoicePrefix !== undefined ? form.POSInvoicePrefix : 'POS-'}
                    onChange={e => setForm({ ...form, POSInvoicePrefix: e.target.value })}
                    placeholder="POS-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_pos = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">POS Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.POSInvoicePrefix || 'POS-')}{(counters['POSInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.POSInvoicePrefix !== undefined ? form.POSInvoicePrefix : 'POS-'}
                      onChange={e => setForm({ ...form, POSInvoicePrefix: e.target.value })}
                      placeholder="POS-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['POSInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('POSInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_pos, new_pos)

old_pur = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Purchase Inv</label>
                    <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PurchaseInvoicePrefix || 'PUR-')}1
                    </span>
                  </div>
                  <input
                    type="text"
                    value={form.PurchaseInvoicePrefix !== undefined ? form.PurchaseInvoicePrefix : 'PUR-'}
                    onChange={e => setForm({ ...form, PurchaseInvoicePrefix: e.target.value })}
                    placeholder="PUR-"
                    className="w-full h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                  />
                </div>"""

new_pur = """                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Purchase Inv</label>
                    <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PurchaseInvoicePrefix || 'PUR-')}{(counters['PurchaseInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.PurchaseInvoicePrefix !== undefined ? form.PurchaseInvoicePrefix : 'PUR-'}
                      onChange={e => setForm({ ...form, PurchaseInvoicePrefix: e.target.value })}
                      placeholder="PUR-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['PurchaseInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('PurchaseInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>"""

content = content.replace(old_pur, new_pur)

with open("src/components/SettingsView.tsx", "w") as f:
    f.write(content)
