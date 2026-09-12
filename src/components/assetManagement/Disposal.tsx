import React, { useState, useEffect } from 'react';
import { Config, Ledger } from '../../types';
import { FixedAsset, AssetCategory, AssetDisposal } from '../../types/assetManagement';
import { getAssets, getAssetCategories, saveAsset, saveDisposal } from '../../services/assetManagementService';
import { saveMultiLineVoucher, nextCounter, getVoucherPrefix, loadJson, saveJson, STORAGE_KEYS } from '../../services/storageService';
import { Trash2, Calculator, Save, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface DisposalProps {
  config: Config;
  ledgers: Ledger[];
  onDataRefresh: () => void;
}

export const Disposal: React.FC<DisposalProps> = ({ config, ledgers, onDataRefresh }) => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [disposalDate, setDisposalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disposalType, setDisposalType] = useState<'Sale' | 'Scrapped'>('Sale');
  const [saleProceeds, setSaleProceeds] = useState<number>(0);
  const [buyerLedger, setBuyerLedger] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ voucherNo: string; assetName: string; gainLoss: number } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setAssets(getAssets().filter(a => a.status === 'Active' || a.status === 'Fully Depreciated'));
    setCategories(getAssetCategories());
  }, []);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedCategory = selectedAsset ? categories.find(c => c.id === selectedAsset.categoryId) : undefined;
  
  const nbv = selectedAsset?.netBookValue || 0;
  const gainLoss = disposalType === 'Sale' ? (saleProceeds - nbv) : -nbv;

  const handleStartDispose = () => {
    setErrorMessage(null);
    if (!selectedAsset) {
      setErrorMessage("Please select an active asset to dispose.");
      return;
    }
    if (disposalType === 'Sale' && !buyerLedger) {
      setErrorMessage("Please select a Buyer / Receivable Ledger for the sale proceeds.");
      return;
    }
    setIsConfirming(true);
  };

  const executeDispose = () => {
    if (!selectedAsset) return;
    setErrorMessage(null);

    try {
      const assetGlAcc = selectedAsset.assetGlAccountId || selectedCategory?.assetGlAccountId || 'Fixed Assets';
      const accDepAcc = selectedAsset.accumulatedDepreciationGlAccountId || selectedCategory?.accumulatedDepreciationGlAccountId || 'Accumulated Depreciation';
      const gainAcc = selectedAsset.gainOnDisposalAccountId || selectedCategory?.gainOnDisposalAccountId || 'Gain on Disposal of Asset';
      const lossAcc = selectedAsset.lossOnDisposalAccountId || selectedCategory?.lossOnDisposalAccountId || 'Loss on Disposal of Asset';

      // Ensure GL accounts exist with proper groups before vouchering
      const allLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, []);
      let ledgersModified = false;
      
      const ensureLedger = (name: string, group: string, defaultType: 'Dr' | 'Cr') => {
        if (!allLedgers.find(l => l['Ledger Name'].toLowerCase() === name.toLowerCase())) {
          allLedgers.push({
            'Ledger Name': name,
            Group: group,
            'Opening Balance': 0,
            'Balance Type (Dr/Cr)': defaultType,
            'Current Balance': 0
          });
          ledgersModified = true;
        }
      };

      ensureLedger(assetGlAcc, 'Fixed Assets', 'Dr');
      ensureLedger(accDepAcc, 'Provisions', 'Cr');
      ensureLedger(gainAcc, 'Indirect Incomes', 'Cr');
      ensureLedger(lossAcc, 'Indirect Expenses', 'Dr');

      if (ledgersModified) {
        saveJson(STORAGE_KEYS.LEDGERS, allLedgers);
      }

      const px = getVoucherPrefix('J', config);
      const voucherNo = px + nextCounter('Voucher');
      
      const voucherLines: Array<{ type: 'Dr' | 'Cr'; ledger: string; amount: number; narration?: string }> = [];
      const cost = Number(selectedAsset.cost) || 0;
      const accDep = Number(selectedAsset.accumulatedDepreciation) || 0;
      
      // 1. Remove Asset Cost
      voucherLines.push({ type: 'Cr', ledger: assetGlAcc, amount: cost, narration: `Disposal of ${selectedAsset.name}` });
      
      // 2. Remove Accumulated Depreciation
      if (accDep > 0) {
        voucherLines.push({ type: 'Dr', ledger: accDepAcc, amount: accDep, narration: `Disposal of ${selectedAsset.name}` });
      }
      
      // 3. Record Sale Proceeds
      if (disposalType === 'Sale' && saleProceeds > 0) {
        voucherLines.push({ type: 'Dr', ledger: buyerLedger, amount: saleProceeds, narration: `Sale Proceeds from ${selectedAsset.name}` });
      }
      
      // 4. Record Gain / Loss
      if (gainLoss > 0) {
        voucherLines.push({ type: 'Cr', ledger: gainAcc, amount: gainLoss, narration: `Gain on Disposal of ${selectedAsset.name}` });
      } else if (gainLoss < 0) {
        voucherLines.push({ type: 'Dr', ledger: lossAcc, amount: Math.abs(gainLoss), narration: `Loss on Disposal of ${selectedAsset.name}` });
      }
      
      // Post Voucher
      saveMultiLineVoucher({
        type: 'J',
        voucherNo,
        date: disposalDate,
        narration: `Asset Disposal: ${selectedAsset.name}`,
        lines: voucherLines
      });
      
      // Save Disposal Record
      const dispRecord: AssetDisposal = {
        id: crypto.randomUUID(),
        disposalNumber: `DISP-${Math.floor(Math.random() * 100000)}`,
        assetId: selectedAsset.id,
        disposalType: disposalType,
        disposalDate,
        assetCost: cost,
        accumulatedDepreciation: accDep,
        netBookValue: selectedAsset.netBookValue || 0,
        saleProceeds: disposalType === 'Sale' ? saleProceeds : 0,
        gainLoss,
        buyer: buyerLedger,
        journalId: voucherNo,
        status: 'Completed',
        remarks,
        createdBy: 'system',
        createdAt: new Date().toISOString()
      };
      saveDisposal(dispRecord);
      
      // Update Asset Status
      selectedAsset.status = disposalType === 'Sale' ? 'Sold' : 'Written Off';
      saveAsset(selectedAsset, 'system');
      
      setSuccessInfo({
        voucherNo,
        assetName: selectedAsset.name,
        gainLoss
      });
      setIsConfirming(false);
      
      // Refresh assets
      setAssets(getAssets().filter(a => a.status === 'Active' || a.status === 'Fully Depreciated'));
      setSelectedAssetId('');
      setRemarks('');
      setSaleProceeds(0);
      setBuyerLedger('');
      onDataRefresh();
    } catch (err: any) {
      console.error("Disposal Error:", err);
      setErrorMessage(err?.message || "Failed to post disposal journal voucher. Please check ledger configurations.");
      setIsConfirming(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-rose-600" />
          Asset Disposal & Sale
        </h2>
        <p className="text-xs text-slate-500 mt-1">Dispose of an asset and automatically book accounting entries for gain/loss.</p>
      </div>

      <div className="p-6 flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Success Banner */}
          {successInfo && (
            <div className="bg-emerald-50 border-2 border-emerald-500/80 p-5 rounded-2xl shadow-sm text-slate-800 space-y-3">
              <div className="flex items-center gap-3 text-emerald-800 font-extrabold text-base">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <span>Asset Disposed & Journal Voucher Posted Successfully!</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs font-mono space-y-1">
                <p>Asset Disposed: <strong className="text-slate-900">{successInfo.assetName}</strong></p>
                <p>Journal Voucher No: <strong className="text-indigo-700">{successInfo.voucherNo}</strong></p>
                <p>Gain/Loss: <strong className={successInfo.gainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}>
                  {config.CurrencySymbol} {Math.abs(successInfo.gainLoss).toFixed(2)} ({successInfo.gainLoss >= 0 ? "Gain" : "Loss"})
                </strong></p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessInfo(null)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Dispose Another Asset
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-50 border-2 border-rose-400 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold shadow-xs">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Asset to Dispose *</label>
              <select
                value={selectedAssetId || ''}
                onChange={(e) => {
                  setSelectedAssetId(e.target.value);
                  setErrorMessage(null);
                  setSuccessInfo(null);
                  setIsConfirming(false);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">-- Select an active asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.assetId} - {a.name} (NBV: {config.CurrencySymbol} {(a.netBookValue || 0).toFixed(2)})</option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedAsset && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-5">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Asset Cost</span>
                  <span className="font-extrabold text-slate-900">{config.CurrencySymbol} {(selectedAsset.cost || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Accum. Depr.</span>
                  <span className="font-extrabold text-rose-700">{config.CurrencySymbol} {(selectedAsset.accumulatedDepreciation || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Net Book Value</span>
                  <span className="font-extrabold text-indigo-700">{config.CurrencySymbol} {(selectedAsset.netBookValue || 0).toFixed(2)}</span>
                </div>
              </div>
              
              <hr className="border-slate-200" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disposal Date</label>
                  <input
                    type="date"
                    value={disposalDate || ''}
                    onChange={(e) => setDisposalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disposal Type</label>
                  <select
                    value={disposalType || 'Sale'}
                    onChange={(e) => {
                      setDisposalType(e.target.value as any);
                      setErrorMessage(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white"
                  >
                    <option value="Sale">Sale (with Proceeds)</option>
                    <option value="Scrapped">Scrapped (Write-off)</option>
                  </select>
                </div>
                
                {disposalType === 'Sale' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sale Proceeds ({config.CurrencySymbol})</label>
                      <input
                        type="number"
                        min="0"
                        value={saleProceeds || ''}
                        onChange={(e) => setSaleProceeds(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-600 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Buyer / Receivable Ledger *</label>
                      <select
                        value={buyerLedger || ''}
                        onChange={(e) => {
                          setBuyerLedger(e.target.value);
                          setErrorMessage(null);
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white"
                      >
                        <option value="">-- Select Ledger --</option>
                        {ledgers.map(l => (
                          <option key={l['Ledger Name']} value={l['Ledger Name']}>{l['Ledger Name']}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Reason</label>
                  <input
                    type="text"
                    value={remarks || ''}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none bg-white"
                    placeholder="e.g. Sold to employee / Replaced with newer model..."
                  />
                </div>
              </div>
              
              <div className={`p-4 rounded-xl border ${gainLoss >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} flex items-start gap-3 mt-4`}>
                <Calculator className={`h-5 w-5 ${gainLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'} shrink-0 mt-0.5`} />
                <div>
                  <h4 className={`text-sm font-bold ${gainLoss >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {gainLoss >= 0 ? 'Projected Gain on Disposal' : 'Projected Loss on Disposal'}
                  </h4>
                  <p className={`text-xs ${gainLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1`}>
                    This will automatically book a Journal Voucher to write off the asset and record the {gainLoss >= 0 ? 'gain' : 'loss'} of {config.CurrencySymbol} {Math.abs(gainLoss).toFixed(2)}.
                  </p>
                </div>
              </div>

              {/* Inline Confirmation Prompt */}
              {isConfirming && (
                <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    Confirm Disposal of "{selectedAsset.name}"? This action is permanent and will post the Journal Voucher immediately.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={executeDispose}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Save className="h-4 w-4" />
                      Yes, Post & Complete Disposal
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirming(false)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {!isConfirming && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleStartDispose}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Confirm & Post Journal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
