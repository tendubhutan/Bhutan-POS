import React, { useState, useEffect } from 'react';
import { Config, Ledger } from '../../types';
import { FixedAsset, AssetCategory, AssetDisposal } from '../../types/assetManagement';
import { getAssets, getAssetCategories, saveAsset, saveDisposal } from '../../services/assetManagementService';
import { saveMultiLineVoucher, nextCounter, getVoucherPrefix } from '../../services/storageService';
import { Trash2, Calculator, Save, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    setAssets(getAssets().filter(a => a.status === 'Active' || a.status === 'Fully Depreciated'));
    setCategories(getAssetCategories());
  }, []);

  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const selectedCategory = selectedAsset ? categories.find(c => c.id === selectedAsset.categoryId) : undefined;
  
  const nbv = selectedAsset?.netBookValue || 0;
  const gainLoss = disposalType === 'Sale' ? (saleProceeds - nbv) : -nbv;

  const handleDispose = () => {
    if (!selectedAsset) return;
    if (disposalType === 'Sale' && !buyerLedger) {
      alert("Please select a Buyer Ledger for the sale proceeds.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to dispose of ${selectedAsset.name}? This cannot be undone.`)) return;
    
    const assetGlAcc = selectedAsset.assetGlAccountId || selectedCategory?.assetGlAccountId || 'Fixed Assets';
    const accDepAcc = selectedAsset.accumulatedDepreciationGlAccountId || selectedCategory?.accumulatedDepreciationGlAccountId || 'Accumulated Depreciation';
    const gainAcc = selectedAsset.gainOnDisposalAccountId || selectedCategory?.gainOnDisposalAccountId || 'Gain on Disposal of Asset';
    const lossAcc = selectedAsset.lossOnDisposalAccountId || selectedCategory?.lossOnDisposalAccountId || 'Loss on Disposal of Asset';

    const px = getVoucherPrefix('J', config);
    const voucherNo = px + nextCounter('Voucher');
    
    const voucherLines: Array<{ type: 'Dr' | 'Cr'; ledger: string; amount: number; narration?: string }> = [];
    
    // 1. Remove Asset Cost
    voucherLines.push({ type: 'Cr', ledger: assetGlAcc, amount: selectedAsset.cost, narration: `Disposal of ${selectedAsset.name}` });
    
    // 2. Remove Accumulated Depreciation
    if (selectedAsset.accumulatedDepreciation > 0) {
      voucherLines.push({ type: 'Dr', ledger: accDepAcc, amount: selectedAsset.accumulatedDepreciation, narration: `Disposal of ${selectedAsset.name}` });
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
      assetCost: selectedAsset.cost,
      accumulatedDepreciation: selectedAsset.accumulatedDepreciation,
      netBookValue: selectedAsset.netBookValue,
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
    
    alert(`Asset disposed successfully.\nJournal Voucher: ${voucherNo} posted.\n${gainLoss >= 0 ? 'Gain' : 'Loss'}: ${config.CurrencySymbol} ${Math.abs(gainLoss).toFixed(2)}`);
    
    // Refresh
    setAssets(getAssets().filter(a => a.status === 'Active' || a.status === 'Fully Depreciated'));
    setSelectedAssetId('');
    onDataRefresh();
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Asset to Dispose *</label>
              <select
                value={selectedAssetId || ''}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none"
              >
                <option value="">-- Select an active asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.assetId} - {a.name} (NBV: {config.CurrencySymbol} {a.netBookValue.toFixed(2)})</option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedAsset && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Asset Cost</span>
                  <span className="font-bold">{config.CurrencySymbol} {selectedAsset.cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Accum. Depr.</span>
                  <span className="font-bold">{config.CurrencySymbol} {selectedAsset.accumulatedDepreciation.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">Net Book Value</span>
                  <span className="font-bold text-indigo-700">{config.CurrencySymbol} {selectedAsset.netBookValue.toFixed(2)}</span>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Disposal Type</label>
                  <select
                    value={disposalType || 'Sale'}
                    onChange={(e) => setDisposalType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Buyer / Receivable Ledger</label>
                      <select
                        value={buyerLedger || ''}
                        onChange={(e) => setBuyerLedger(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                  <input
                    type="text"
                    value={remarks || ''}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                    placeholder="Reason for disposal..."
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
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleDispose}
                  className="flex items-center gap-2 bg-rose-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-rose-700 transition shadow-sm cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  Confirm & Post Journal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
