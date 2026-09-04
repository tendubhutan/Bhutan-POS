import React, { useState, useEffect } from 'react';
import { Config, Ledger } from '../../types';
import { getAssets, getAssetCategories, saveDepreciation, saveAsset, calculateDepreciation } from '../../services/assetManagementService';
import { FixedAsset, AssetCategory, DepreciationTransaction } from '../../types/assetManagement';
import { Calculator, Eye, CheckCircle2, Search, ArrowRight, Save } from 'lucide-react';
import { saveMultiLineVoucher, nextCounter, getVoucherPrefix } from '../../services/storageService';

interface DepreciationProps {
  config: Config;
  onDataRefresh: () => void;
}

export const Depreciation: React.FC<DepreciationProps> = ({ config, onDataRefresh }) => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodName, setPeriodName] = useState<string>('Current Month');
  const [financialYear, setFinancialYear] = useState<string>('2026');
  
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    setAssets(getAssets().filter(a => a.status === 'Active')); // Only active assets
    setCategories(getAssetCategories());
  }, []);

  const handleCalculate = () => {
    const results: any[] = [];
    
    assets.forEach(asset => {
      // Find category config for GL accounts if not on asset
      const cat = categories.find(c => c.id === asset.categoryId);
      
      const calc = calculateDepreciation(asset, targetDate);
      
      if (calc && calc.depreciationAmount > 0) {
        results.push({
          asset,
          category: cat,
          depreciationAmount: calc.depreciationAmount,
          newAccumulated: calc.newAccumulated,
          newNbv: calc.newNbv
        });
      }
    });
    
    setPreviewData(results);
    setIsCalculated(true);
  };

  const handlePost = async () => {
    if (previewData.length === 0) return;
    
    const confirmMsg = `You are about to post depreciation for ${periodName}.\n\nAssets: ${previewData.length}\nTotal Amount: ${config.CurrencySymbol} ${previewData.reduce((sum, item) => sum + item.depreciationAmount, 0).toFixed(2)}\n\nAre you sure you want to proceed?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setIsPosting(true);
    
    try {
      // 1. Create a Journal Voucher for the total depreciation (Grouped by Category or simple single voucher)
      const dateIso = new Date().toISOString();
      const px = getVoucherPrefix('J', config);
      const refNo = px + nextCounter('Voucher');
      
      let totalDepreciation = 0;
      const voucherLines: Array<{ type: 'Dr' | 'Cr'; ledger: string; amount: number; narration?: string }> = [];
      
      for (const item of previewData) {
        const { asset, depreciationAmount, newAccumulated, newNbv, category } = item;
        totalDepreciation += depreciationAmount;
        
        const depAcc = asset.depreciationExpenseGlAccountId || category?.depreciationExpenseGlAccountId;
        const accDepAcc = asset.accumulatedDepreciationGlAccountId || category?.accumulatedDepreciationGlAccountId;
        
        if (depAcc && accDepAcc) {
          // Post to GL
          voucherLines.push({
            type: 'Dr',
            ledger: depAcc,
            amount: depreciationAmount,
            narration: `Depreciation for ${asset.name} (${periodName})`
          });
          
          voucherLines.push({
            type: 'Cr',
            ledger: accDepAcc,
            amount: depreciationAmount,
            narration: `Depreciation for ${asset.name} (${periodName})`
          });
        }
        
        // 2. Save Depreciation Transaction
        const depTxn: DepreciationTransaction = {
          id: crypto.randomUUID(),
          assetId: asset.id,
          financialYear,
          accountingPeriod: periodName,
          depreciationDate: targetDate,
          openingNbv: asset.netBookValue,
          depreciationAmount,
          accumulatedDepreciation: newAccumulated,
          closingNbv: newNbv,
          journalId: refNo,
          status: 'Posted',
          postedBy: 'system',
          postedAt: dateIso
        };
        saveDepreciation(depTxn);
        
        // 3. Update Asset Master
        asset.accumulatedDepreciation = newAccumulated;
        asset.netBookValue = newNbv;
        if (newNbv <= asset.residualValue) {
          asset.status = 'Fully Depreciated';
          asset.fullyDepreciatedDate = dateIso;
        }
        saveAsset(asset, 'system');
      }
      
      if (voucherLines.length > 0) {
        saveMultiLineVoucher({
          type: 'J',
          voucherNo: refNo,
          date: targetDate,
          narration: `Depreciation for period ${periodName}`,
          lines: voucherLines
        });
      }
      
      alert(`Successfully posted ${config.CurrencySymbol} ${totalDepreciation.toFixed(2)} to ${previewData.length} assets.`);
      
      // Refresh UI
      setAssets(getAssets().filter(a => a.status === 'Active'));
      setPreviewData([]);
      setIsCalculated(false);
      onDataRefresh(); // Tell parent to reload generic data if needed
      
    } catch (e) {
      console.error(e);
      alert("An error occurred while posting depreciation.");
    } finally {
      setIsPosting(false);
    }
  };

  const totalDep = previewData.reduce((sum, item) => sum + item.depreciationAmount, 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-600" />
          Depreciation Processing
        </h2>
        <p className="text-xs text-slate-500 mt-1">Calculate and post depreciation for active fixed assets.</p>
      </div>

      <div className="p-4 border-b border-slate-200 flex flex-wrap items-end gap-4 shrink-0 bg-white">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Financial Year</label>
          <select 
            value={financialYear || '2026'}
            onChange={e => setFinancialYear(e.target.value)}
            className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
          >
            <option value="2026">2026</option>
            <option value="2027">2027</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Accounting Period</label>
          <select 
            value={periodName || 'Current Month'}
            onChange={e => setPeriodName(e.target.value)}
            className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
          >
            <option value="January 2026">January 2026</option>
            <option value="February 2026">February 2026</option>
            <option value="March 2026">March 2026</option>
            <option value="April 2026">April 2026</option>
            <option value="Current Month">Current Month</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
          <input 
            type="date"
            value={targetDate || ''}
            onChange={e => setTargetDate(e.target.value)}
            className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 outline-none"
          />
        </div>
        <button
          onClick={handleCalculate}
          className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-900 transition shadow-sm cursor-pointer"
        >
          <Calculator className="h-4 w-4" />
          Calculate
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {!isCalculated ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
            <Calculator className="h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium">Select period and click Calculate to preview depreciation.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Depreciation Preview</h3>
              <div className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                Total: {config.CurrencySymbol} {totalDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Asset ID</th>
                      <th className="px-4 py-3">Asset Name</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Opening Acc. Dep.</th>
                      <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-900">Current Dep.</th>
                      <th className="px-4 py-3 text-right">Closing Acc. Dep.</th>
                      <th className="px-4 py-3 text-right">Closing NBV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.length > 0 ? (
                      previewData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">{item.asset.assetId}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.asset.name}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.asset.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600">{item.asset.accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold bg-indigo-50/50 text-indigo-700">
                            {item.depreciationAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700">{item.newAccumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                            {item.newNbv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No depreciation to post for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {previewData.length > 0 && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handlePost}
                  disabled={isPosting}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  {isPosting ? 'Posting...' : 'Post Depreciation Journal'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
