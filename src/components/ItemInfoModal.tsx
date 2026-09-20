import React, { useMemo, useState } from 'react';
import { Item, ItemBatch } from '../types';
import { getItemPriceHistory, getItemTransactionHistory, ItemTransactionRecord } from '../services/storageService';
import { X, ExternalLink, Package, MapPin, History, User, CheckCircle, AlertTriangle, Pill, Shirt, ArrowLeft, Search } from 'lucide-react';

interface ItemInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  customerPartyName?: string;
  onEditInMaster?: (item: Item) => void;
  currencySymbol?: string;
}

export const ItemInfoModal: React.FC<ItemInfoModalProps> = ({
  isOpen,
  onClose,
  item,
  customerPartyName,
  onEditInMaster,
  currencySymbol = 'Nu.'
}) => {
  const [drilldownType, setDrilldownType] = useState<'purchase' | 'sale' | null>(null);

  const partNo = item ? (item.partNumber || (item as any)['Part Number'] || (item as any)['Part No'] || (item as any)['part_number'] || '') : '';
  const rackLoc = item ? (item.rackLocation || (item as any)['Rack Location'] || (item as any)['Rack / Bin Location'] || (item as any)['Rack'] || (item as any)['Bin'] || '') : '';
  const compat = item ? (item.compatibility || (item as any)['Compatibility'] || (item as any)['Vehicle / Machine Compatibility'] || '') : '';

  const rackLocations = useMemo(() => {
    if (!rackLoc) return [];
    return rackLoc.split(/[,/;|]+/).map((s: string) => s.trim()).filter(Boolean);
  }, [rackLoc]);

  const compatibilities = useMemo(() => {
    if (!compat) return [];
    return compat.split(/[,/;|]+/).map((s: string) => s.trim()).filter(Boolean);
  }, [compat]);

  const priceHistory = useMemo(() => {
    if (!item) return {};
    return getItemPriceHistory(item['Item Code'], item['Item Name'], customerPartyName);
  }, [item, customerPartyName]);

  const transactionHistory = useMemo(() => {
    if (!item) return { purchases: [], sales: [] };
    return getItemTransactionHistory(item['Item Code'], item['Item Name']);
  }, [item]);

  if (!isOpen || !item) return null;

  const stock = Number(item['Current Stock']) || 0;
  const reorder = Number(item['Reorder Level']) || 0;
  const isLowStock = item['Maintain Stock'] !== 'N' && stock <= reorder;

  // Dynamic Item Nature Classification
  const isPharma = item.isPharmacy === 'Y' || item.maintainBatch === 'Y' || (item.batches && item.batches.length > 0);
  const isGarment = !isPharma && Boolean(item.size || item.color || (item.variants && item.variants.length > 0));
  const isSparePart = !isPharma && !isGarment && Boolean(partNo || compat);
  const isGeneralItem = !isPharma && !isGarment && !isSparePart;

  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Drilldown Overlay Mode
  if (drilldownType) {
    const records = drilldownType === 'purchase' ? transactionHistory.purchases : transactionHistory.sales;
    const isPurchase = drilldownType === 'purchase';

    return (
      <div className="fixed inset-0 z-[1000010] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
          {/* Drilldown Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>{isPurchase ? '🛒 Purchase' : '🛍️ Sales'} Transaction Drilldown</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono font-bold border border-slate-700">
                  {records.length} {records.length === 1 ? 'Record' : 'Records'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Item: <span className="font-semibold text-white">{item['Item Name']}</span> ({item['Item Code']})
              </p>
            </div>
            <button
              onClick={() => setDrilldownType(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drilldown Content */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {records.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                No historical {isPurchase ? 'purchase' : 'sale'} transactions recorded for this item yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Voucher / Inv No</th>
                      <th className="p-2.5">{isPurchase ? 'Supplier / Vendor' : 'Customer'}</th>
                      <th className="p-2.5 text-center">Batch</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {records.map((r: ItemTransactionRecord, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 text-slate-800 whitespace-nowrap">{r.date || '-'}</td>
                        <td className="p-2.5 font-bold text-indigo-900 whitespace-nowrap">{r.voucherNo}</td>
                        <td className="p-2.5 font-sans font-medium text-slate-900">{r.partyName}</td>
                        <td className="p-2.5 text-center text-slate-600">{r.batchNo || '-'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-800 whitespace-nowrap">{r.qty} {r.unit || item.Unit || 'Pcs'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900 whitespace-nowrap">{currencySymbol} {Number(r.rate).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-800 whitespace-nowrap">{currencySymbol} {Number(r.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Drilldown Footer */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center text-xs">
            <button
              onClick={() => setDrilldownType(null)}
              className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Item Info</span>
            </button>
            <span className="text-[11px] text-slate-500 font-medium">
              Showing past {isPurchase ? 'purchases' : 'sales'} from database
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000010] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className={`bg-white w-full ${isGeneralItem ? 'max-w-lg' : 'max-w-2xl'} rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh] transition-all duration-200`}>
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-white truncate leading-tight">
                {item['Item Name']}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-300 font-mono mt-0.5">
                <span>Code: {item['Item Code']}</span>
                {item.Barcode && <span>• Barcode: {item.Barcode}</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {onEditInMaster && (
              <button
                type="button"
                onClick={() => {
                  onEditInMaster(item);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Edit this item in Item Master"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Master</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-800 text-xs">
          {/* Dynamic Specifications & Details based on Item Nature */}
          {isPharma ? (
            /* Pharmaceutical & Batch / Expiry Details */
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  <span>Pharmaceutical & Batch / Expiry Details</span>
                </div>
                {item.batches && item.batches.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
                    {item.batches.length} Active {item.batches.length === 1 ? 'Batch' : 'Batches'}
                  </span>
                )}
              </div>

              {item.batches && item.batches.length > 0 ? (() => {
                const itemStock = Number(item['Current Stock']) || 0;
                const totalExplicitBatchStock = item.batches.reduce((sum: number, bt: ItemBatch) => {
                  return sum + (Number(bt.currentStock) || Number(bt.openingStock) || 0);
                }, 0);

                return (
                  <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-emerald-100/60 text-emerald-900 font-bold border-b border-emerald-200 text-[10px] uppercase">
                          <th className="py-2 px-2.5">Batch No</th>
                          <th className="py-2 px-2">Mfg Date</th>
                          <th className="py-2 px-2">Expiry Date</th>
                          <th className="py-2 px-2 text-center">Status</th>
                          <th className="py-2 px-2 text-right">Stock</th>
                          <th className="py-2 px-2.5 text-right">Sale Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100">
                        {item.batches.map((b: ItemBatch, bIdx: number) => {
                          const exp = b.expDate || '';
                          let isExpired = false;
                          let isNear = false;
                          if (exp) {
                            if (exp < todayStr) isExpired = true;
                            else if (exp <= thirtyDaysStr) isNear = true;
                          }

                          let batchStockVal = Number(b.currentStock) || Number(b.openingStock) || 0;
                          if (batchStockVal === 0 && totalExplicitBatchStock === 0 && itemStock > 0) {
                            const numBatches = item.batches!.length;
                            const baseStock = Math.floor(itemStock / numBatches);
                            const remainder = itemStock % numBatches;
                            batchStockVal = baseStock + (bIdx === 0 ? remainder : 0);
                          }

                          return (
                            <tr key={b.id || bIdx} className="hover:bg-emerald-50/50">
                              <td className="py-2 px-2.5 font-mono font-bold text-slate-900">
                                {b.batchNo || 'N/A'}
                              </td>
                              <td className="py-2 px-2 font-mono text-slate-600">
                                {b.mfgDate || '-'}
                              </td>
                              <td className="py-2 px-2 font-mono font-bold text-slate-800">
                                {b.expDate || '-'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {isExpired ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[9px]">EXPIRED</span>
                                ) : isNear ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[9px]">EXPIRING SOON</span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9px]">VALID</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                                {batchStockVal} {item.Unit || 'Pcs'}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono text-emerald-800 font-bold">
                                {currencySymbol} {Number(b.saleRate || item['Sale Rate'] || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                    <span className="block text-[10px] text-emerald-700 font-semibold uppercase mb-1">Batch Tracking</span>
                    <span className="font-bold text-emerald-900 text-xs block">Enabled (Pharma / Batch Item)</span>
                  </div>
                  {rackLocations.length > 0 && (
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="block text-[10px] text-emerald-700 font-semibold uppercase mb-1">Rack / Bin Location</span>
                      <div className="flex flex-wrap gap-1">
                        {rackLocations.map((r: string, idx: number) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                            📍 {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item['HSN/SAC'] && (
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="block text-[10px] text-emerald-700 font-semibold uppercase mb-1">HSN / SAC Code</span>
                      <span className="font-mono font-extrabold text-slate-900 text-xs block">{item['HSN/SAC']}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isGarment ? (
            /* Garments & Footwear Section */
            <div className="p-4 rounded-xl bg-violet-50/80 border border-violet-200/80 space-y-3">
              <div className="flex items-center gap-2 text-violet-900 font-bold text-xs uppercase tracking-wider">
                <Shirt className="h-4 w-4 text-violet-600" />
                <span>Garments, Footwear & Variant Specifications</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {item.size && (
                  <div className="bg-white p-2.5 rounded-lg border border-violet-200">
                    <span className="block text-[10px] text-violet-700 font-semibold uppercase mb-1">Available Size(s)</span>
                    <span className="font-bold text-slate-900 text-xs block">{item.size}</span>
                  </div>
                )}
                {item.color && (
                  <div className="bg-white p-2.5 rounded-lg border border-violet-200">
                    <span className="block text-[10px] text-violet-700 font-semibold uppercase mb-1">Available Color(s)</span>
                    <span className="font-bold text-slate-900 text-xs block">{item.color}</span>
                  </div>
                )}
                {rackLocations.length > 0 && (
                  <div className="bg-white p-2.5 rounded-lg border border-violet-200">
                    <span className="block text-[10px] text-violet-700 font-semibold uppercase mb-1">Rack / Bin Location</span>
                    <div className="flex flex-wrap gap-1">
                      {rackLocations.map((r: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-violet-100 text-violet-900 border border-violet-300 font-bold text-xs">
                          📍 {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : isSparePart ? (
            /* Spare Parts & Warehouse Location Details */
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <MapPin className="h-4 w-4 text-amber-600" />
                <span>Spare Parts & Warehouse Location</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {partNo && (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="block text-[10px] text-amber-700 font-semibold uppercase mb-1">Part No / OEM</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm block">{partNo}</span>
                  </div>
                )}
                
                {rackLocations.length > 0 && (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="block text-[10px] text-amber-700 font-semibold uppercase mb-1">Rack / Bin Locations</span>
                    <div className="flex flex-wrap gap-1">
                      {rackLocations.map((r: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                          📍 {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {compatibilities.length > 0 && (
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200">
                    <span className="block text-[10px] text-amber-700 font-semibold uppercase mb-1">Vehicle / Machine Compatibility</span>
                    <div className="flex flex-wrap gap-1">
                      {compatibilities.map((c: string, idx: number) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-medium text-xs">
                          🚗 {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Master Price Rates & Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Sale Price</span>
              <span className="text-sm font-extrabold text-slate-900 font-mono">
                {currencySymbol} {Number(item['Sale Rate'] || item.MRP || 0).toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Purchase Rate</span>
              <span className="text-sm font-extrabold text-indigo-700 font-mono">
                {currencySymbol} {Number(item['Purchase Rate'] || 0).toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="block text-[10px] text-slate-500 font-bold uppercase">MRP</span>
              <span className="text-sm font-extrabold text-slate-700 font-mono">
                {currencySymbol} {Number(item.MRP || 0).toFixed(2)}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${isLowStock ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase">Current Stock</span>
                {isLowStock ? <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <span className="text-sm font-extrabold font-mono mt-0.5 block">
                {item['Maintain Stock'] === 'N' ? 'N/A' : `${stock} ${item.Unit || ''}`}
              </span>
            </div>
          </div>

          {/* Historical Price Intelligence */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                <History className="h-4 w-4 text-indigo-600" />
                <span>Historical Price & Transaction Intelligence</span>
              </div>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/80 px-2 py-0.5 rounded-full border border-indigo-200">
                Click card for deep-down details 🔍
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Last Purchase Price */}
              <div 
                onClick={() => setDrilldownType('purchase')}
                className="bg-white p-3 rounded-lg border border-indigo-100 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group space-y-1"
                title="Click to view purchase transaction deep-down drilldown"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-indigo-800 flex items-center gap-1 group-hover:text-indigo-600">
                    <span>Last Purchase Price</span>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded group-hover:bg-indigo-100">Drilldown 🔍</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{priceHistory.lastPurchaseDate || 'No record'}</span>
                </div>
                <div className="text-base font-extrabold font-mono text-indigo-700">
                  {priceHistory.lastPurchaseRate !== undefined ? `${currencySymbol} ${priceHistory.lastPurchaseRate.toFixed(2)}` : 'N/A'}
                </div>
                {priceHistory.lastPurchaseSupplier && (
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <User className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">Vendor: {priceHistory.lastPurchaseSupplier}</span>
                  </div>
                )}
              </div>

              {/* Last Sale Price */}
              <div 
                onClick={() => setDrilldownType('sale')}
                className="bg-white p-3 rounded-lg border border-emerald-100 hover:border-emerald-400 hover:shadow-md transition cursor-pointer group space-y-1"
                title="Click to view sales transaction deep-down drilldown"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 group-hover:text-emerald-600">
                    <span>Last Sale Price</span>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded group-hover:bg-emerald-100">Drilldown 🔍</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{priceHistory.lastSaleDate || 'No record'}</span>
                </div>
                <div className="text-base font-extrabold font-mono text-emerald-700">
                  {priceHistory.lastSaleRate !== undefined ? `${currencySymbol} ${priceHistory.lastSaleRate.toFixed(2)}` : 'N/A'}
                </div>
                {priceHistory.lastSaleCustomer && (
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <User className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">Customer: {priceHistory.lastSaleCustomer}</span>
                  </div>
                )}
              </div>

              {/* Customer Specific Last Sale Price if applicable */}
              {customerPartyName && (
                <div 
                  onClick={() => setDrilldownType('sale')}
                  className="sm:col-span-2 bg-emerald-50/80 p-3 rounded-lg border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition cursor-pointer group space-y-1"
                  title="Click to view sales transaction deep-down drilldown"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1">
                      <span>Last Sale Price for "{customerPartyName}"</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">Drilldown 🔍</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">{priceHistory.customerLastSaleDate || 'No prior purchase'}</span>
                  </div>
                  <div className="text-base font-extrabold font-mono text-emerald-800">
                    {priceHistory.customerLastSaleRate !== undefined ? `${currencySymbol} ${priceHistory.customerLastSaleRate.toFixed(2)}` : 'No prior invoice for this customer'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Category: <span className="font-semibold text-slate-700">{item.Category || 'General'}</span> • Group: <span className="font-semibold text-slate-700">{item.Group || 'General'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
