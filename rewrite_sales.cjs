const fs = require('fs');

let code = fs.readFileSync('src/components/SalesInvoiceEntry.tsx', 'utf8');

// Ensure import
if (!code.includes('VoucherEntryShell')) {
  code = code.replace("import { SearchableLedgerSelect } from './SearchableLedgerSelect';", 
  "import { SearchableLedgerSelect } from './SearchableLedgerSelect';\nimport { VoucherEntryShell } from './vouchers/VoucherEntryShell';");
}

// Find return ( and replace everything after it until the end of the component
const returnIndex = code.indexOf('return (');
const lastClosingBrace = code.lastIndexOf('};');

const replacement = `
  const isHighDensity = true;
  
  return (
    <VoucherEntryShell
      title="Sales Invoice"
      voucherNo={
        <div className="flex items-center gap-2">
          <span>{voucherNo || 'NEW INVOICE'}</span>
          <span className="bg-emerald-500/20 text-emerald-100 px-1.5 py-0.2 rounded text-[10px] border border-emerald-500/30">
            Credit / Cash
          </span>
        </div>
      }
      headerPrimary={
        <>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Ledger *</label>
            <SearchableLedgerSelect
              id="sale-customer-input"
              value={customerName}
              onChange={name => {
                setCustomerName(name);
                const l = ledgers.find(x => x.name === name);
                if (l) setCustomerContact(l.phone || '');
              }}
              ledgers={ledgers}
              filterGroups={['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts']}
              placeholder="Select Customer Ledger"
              autoFocus={!initialVoucherTarget}
              onCreateNew={() => onOpenNewLedgerModal && onOpenNewLedgerModal('Sundry Debtors', setCustomerName)}
              onEditLedger={() => setDrillModalState({ type: 'ledger', targetId: customerName })}
              onShowInfo={() => setDrillModalState({ type: 'ledger', targetId: customerName })}
              onEnterNext={() => billDateRef.current?.focus()}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Invoice Date</label>
            <input
              ref={billDateRef}
              id="sale-date-input"
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              type="date"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById('sale-fast-item-picker')?.focus();
                }
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Billing Address</label>
            <input
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              type="text"
              placeholder="Street, City..."
              value={billingAddress}
              onChange={e => setBillingAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Customer Contact</label>
            <input
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              type="text"
              placeholder="Phone / Email"
              value={customerContact}
              onChange={e => setCustomerContact(e.target.value)}
            />
          </div>
        </>
      }
      headerSecondary={
        <>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Terms of Delivery</label>
            <input
              className="w-full h-8.5 rounded-lg border border-slate-300 px-2.5 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              type="text"
              placeholder="e.g. Immediate"
              value={deliveryTerms}
              onChange={e => setDeliveryTerms(e.target.value)}
            />
          </div>
        </>
      }
      grid={
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full border-collapse text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-2 px-3 text-left">ITEM DESCRIPTION</th>
                <th className="py-2 px-1 text-center w-20">QTY</th>
                <th className="py-2 px-1 text-center w-16">UNIT</th>
                <th className="py-2 px-1 text-right w-24">RATE</th>
                {showDiscountColumn && <th className="py-2 px-1 text-right w-20">DISC %</th>}
                {showGstColumn && <th className="py-2 px-1 text-right w-24">GST</th>}
                <th className="py-2 px-2 text-right w-28">AMOUNT</th>
                <th className="py-2 px-1 text-center w-12">ACT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((line, idx) => {
                const amount = line.qty * line.rate;
                const discAmt = amount * (line.discount / 100);
                const taxable = amount - discAmt;
                const finalAmt = taxable + line.gstAmt;
                const isCustomerGstExempted = false;
                const isZ = isCustomerGstExempted || String(line.zeroRated).toUpperCase() === 'Y';
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="py-1 px-2 align-middle font-medium min-w-[220px]">
                      <SearchableItemSelect
                        id={\`sale-item-\${idx}\`}
                        valueCode={line.itemCode}
                        items={items}
                        placeholder="Select Item / Barcode..."
                        currencySymbol={config.CurrencySymbol || 'Nu.'}
                        priceType="sale"
                        showPrice={true}
                        onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                        onSelect={item => {
                          const qty = line.qty || 1;
                          const rate = Number((item as any)['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? item['Purchase Rate'] ?? 0);
                          const isZero = isCustomerGstExempted || String(item['Zero Rated (Y/N)']).toUpperCase() === 'Y';
                          const computedGstAmt = isZero ? 0 : round2((qty * rate) * (Number(item['GST %']) || 0) / 100);

                          const updated = [...cart];
                          updated[idx] = {
                            ...updated[idx],
                            itemCode: item['Item Code'],
                            itemName: item['Item Name'],
                            unit: item.Unit || 'Pcs',
                            rate,
                            gstPct: Number(item['GST %']) || 0,
                            zeroRated: item['Zero Rated (Y/N)'] || 'N',
                            purchaseRate: item['Purchase Rate'] || 0,
                            isSerialized: item['Is Serialized'],
                            gstAmt: computedGstAmt
                          };
                          setCart(updated);
                        }}
                        onEnterNext={() => {
                          const qtyEl = document.getElementById(\`sale-qty-\${idx}\`) as HTMLInputElement | null;
                          if (qtyEl) {
                            qtyEl.focus();
                            qtyEl.select();
                          }
                        }}
                        onCreateNew={onOpenNewItemModal}
                        onEditItem={item => {
                          setItemToAlter(item);
                          setShowItemAlterModal(true);
                        }}
                        onShowInfo={item => setDrillModalState({ type: 'stock', targetId: item['Item Code'] || item['Item Name'] })}
                        onSaveVoucher={handleSaveInvoice}
                        onFocusDate={() => billDateRef.current?.focus()}
                        dropdownPosition="auto"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle">
                      <input
                        id={\`sale-qty-\${idx}\`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.qty || ''}
                        onChange={e => updateLine(idx, 'qty', e.target.value)}
                        onKeyDown={e => handleGridKeyDown(e, {
                          prefix: 'sale', idx, field: 'qty', totalRows: cart.length,
                          searchPickerId: 'sale-fast-item-picker',
                          hasDiscount: showDiscountColumn, hasGst: showGstColumn,
                          onDeleteRow: deleteLine, onAddNewRow: undefined,
                          onOpenNewItemModal,
                          onEditItem: () => {
                            const found = items.find(i => i['Item Code'] === line.itemCode);
                            if (found) { setItemToAlter(found); setShowItemAlterModal(true); }
                          },
                          onShowInfo: () => setDrillModalState({ type: 'stock', targetId: line.itemCode }),
                          onSaveVoucher: handleSaveInvoice
                        })}
                        className="w-full text-center rounded bg-transparent px-1 py-1 font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-300"
                      />
                    </td>
                    <td className="py-1 px-1 align-middle text-center font-medium text-slate-500 text-xs">
                      {line.unit}
                    </td>
                    <td className="py-1 px-1 align-middle">
                      <input
                        id={\`sale-rate-\${idx}\`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate || ''}
                        onChange={e => updateLine(idx, 'rate', e.target.value)}
                        onKeyDown={e => handleGridKeyDown(e, {
                          prefix: 'sale', idx, field: 'rate', totalRows: cart.length,
                          searchPickerId: 'sale-fast-item-picker',
                          hasDiscount: showDiscountColumn, hasGst: showGstColumn,
                          onDeleteRow: deleteLine, onAddNewRow: undefined,
                          onOpenNewItemModal,
                          onEditItem: () => {
                            const found = items.find(i => i['Item Code'] === line.itemCode);
                            if (found) { setItemToAlter(found); setShowItemAlterModal(true); }
                          },
                          onShowInfo: () => setDrillModalState({ type: 'stock', targetId: line.itemCode }),
                          onSaveVoucher: handleSaveInvoice
                        })}
                        className="w-full text-right rounded bg-transparent px-1 py-1 font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-300"
                      />
                    </td>
                    {showDiscountColumn && (
                      <td className="py-1 px-1 align-middle">
                        <input
                          id={\`sale-disc-\${idx}\`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.discount || ''}
                          onChange={e => updateLine(idx, 'discount', e.target.value)}
                          onKeyDown={e => handleGridKeyDown(e, {
                            prefix: 'sale', idx, field: 'disc', totalRows: cart.length,
                            searchPickerId: 'sale-fast-item-picker',
                            hasDiscount: showDiscountColumn, hasGst: showGstColumn,
                            onDeleteRow: deleteLine, onAddNewRow: undefined,
                            onOpenNewItemModal,
                            onEditItem: () => {
                              const found = items.find(i => i['Item Code'] === line.itemCode);
                              if (found) { setItemToAlter(found); setShowItemAlterModal(true); }
                            },
                            onShowInfo: () => setDrillModalState({ type: 'stock', targetId: line.itemCode }),
                            onSaveVoucher: handleSaveInvoice
                          })}
                          className="w-full text-right rounded bg-transparent px-1 py-1 font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500 border border-transparent focus:border-indigo-300"
                        />
                      </td>
                    )}
                    {showGstColumn && (
                      <td className="py-1 px-1 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          {isZ && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">ZERO</span>
                          )}
                          <input
                            id={\`sale-gst-\${idx}\`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            disabled={isZ}
                            value={line.gstPct === 0 ? '' : line.gstPct}
                            onChange={e => updateLine(idx, 'gstPct', e.target.value)}
                            onKeyDown={e => handleGridKeyDown(e, {
                              prefix: 'sale', idx, field: 'gst', totalRows: cart.length,
                              searchPickerId: 'sale-fast-item-picker',
                              hasDiscount: showDiscountColumn, hasGst: showGstColumn,
                              onDeleteRow: deleteLine, onAddNewRow: undefined,
                              onOpenNewItemModal,
                              onEditItem: () => {
                                const found = items.find(i => i['Item Code'] === line.itemCode);
                                if (found) { setItemToAlter(found); setShowItemAlterModal(true); }
                              },
                              onShowInfo: () => setDrillModalState({ type: 'stock', targetId: line.itemCode }),
                              onSaveVoucher: handleSaveInvoice
                            })}
                            className="w-12 text-right rounded bg-transparent px-1 py-1 font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 border border-transparent focus:border-indigo-300"
                          />
                          <span className="text-slate-400 font-medium text-xs">%</span>
                        </div>
                      </td>
                    )}
                    <td className="py-1 px-2 align-middle text-right font-black text-indigo-700 text-sm tracking-tight">
                      {finalAmt.toFixed(2)}
                    </td>
                    <td className="py-1 px-1 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => deleteLine(idx)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Row (Alt+D)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Active Table Cell Search Row (Continuous Entry) */}
              <tr className="bg-indigo-50/20 hover:bg-indigo-50/40 transition border-t border-indigo-100">
                <td className="py-1 px-2 align-middle min-w-[220px]">
                  <SearchableItemSelect
                    id="sale-fast-item-picker"
                    items={items}
                    placeholder="Type Item Name or Scan Barcode..."
                    currencySymbol={config.CurrencySymbol || 'Nu.'}
                    priceType="sale"
                    showPrice={true}
                    onEndOfList={(id) => id && focusNextOutsideGrid(id)}
                    onSelect={item => selectItem(item, true)}
                    autoClearAfterSelect={true}
                    onCreateNew={onOpenNewItemModal}
                    onSaveVoucher={handleSaveInvoice}
                    dropdownPosition="auto"
                  />
                </td>
                <td colSpan={showDiscountColumn && showGstColumn ? 7 : (showDiscountColumn || showGstColumn) ? 6 : 5} className="py-1 px-2 align-middle text-right">
                   <div className="flex justify-end pr-8">
                     <span className="text-xs font-bold text-indigo-400 flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 shadow-sm text-[10px]">Enter</kbd> to jump to quantity</span>
                   </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end w-full">
          <div className="w-full sm:w-1/2">
            <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Narration / Remarks</label>
            <input
              id="sale-narration-input"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              type="text"
              placeholder="Enter narration for this invoice..."
              value={narration}
              onChange={e => setNarration(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveInvoice();
                }
              }}
            />
          </div>
          <div className="flex flex-col items-end w-full sm:w-1/2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-500 text-right font-medium">Subtotal:</span>
              <span className="text-slate-800 text-right font-bold">{config.CurrencySymbol || 'Nu.'} {totals.taxable.toFixed(2)}</span>
              
              {totals.discount > 0 && (
                <>
                  <span className="text-slate-500 text-right font-medium">Discount:</span>
                  <span className="text-rose-600 text-right font-bold">-{config.CurrencySymbol || 'Nu.'} {totals.discount.toFixed(2)}</span>
                </>
              )}
              
              {showGstColumn && totals.gst > 0 && (
                <>
                  <span className="text-slate-500 text-right font-medium">Total GST:</span>
                  <span className="text-slate-800 text-right font-bold">{config.CurrencySymbol || 'Nu.'} {totals.gst.toFixed(2)}</span>
                </>
              )}

              {additionalCharges.map((charge, idx) => (
                <React.Fragment key={idx}>
                  <span className="text-slate-500 text-right font-medium truncate">{charge.ledgerName || 'Additional Charge'}:</span>
                  <span className="text-slate-800 text-right font-bold">{config.CurrencySymbol || 'Nu.'} {charge.amount.toFixed(2)}</span>
                </React.Fragment>
              ))}

              <span className="text-slate-900 text-right font-black uppercase text-sm mt-1 border-t border-slate-200 pt-1">
                Grand Total:
              </span>
              <span className="text-emerald-600 text-right font-black text-lg font-mono tracking-tighter mt-1 border-t border-slate-200 pt-1">
                {config.CurrencySymbol || 'Nu.'} {totals.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      }
      actions={
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={addAdditionalCharge}
              className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Addl Charge ({additionalCharges.length})</span>
            </button>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleSaveInvoice}
              disabled={cart.length === 0}
              className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-sm hover:bg-emerald-700 disabled:opacity-50 transition flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
              title="Save Invoice (F2)"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Save [F2]</span>
            </button>
          </div>
        </>
      }
    />
  );
`;

code = code.substring(0, returnIndex) + replacement + '\n' + code.substring(lastClosingBrace);

fs.writeFileSync('src/components/SalesInvoiceEntry.tsx', code);
console.log('Done!');
