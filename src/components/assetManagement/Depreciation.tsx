import React, { useState, useEffect } from 'react';
import { Config } from '../../types';
import { 
  getAssets, 
  getAssetCategories, 
  saveDepreciation, 
  saveAsset, 
  calculateDepreciation, 
  getPeriodOptions, 
  getPeriodTargetDate,
  DepreciationFrequency 
} from '../../services/assetManagementService';
import { FixedAsset, AssetCategory, DepreciationTransaction } from '../../types/assetManagement';
import { Calculator, CheckCircle2, Save, X, AlertCircle, FileText } from 'lucide-react';
import { saveMultiLineVoucher, nextCounter, getVoucherPrefix } from '../../services/storageService';

interface DepreciationProps {
  config: Config;
  onDataRefresh: () => void;
  onNavigateToReports?: () => void;
}

export const Depreciation: React.FC<DepreciationProps> = ({ config, onDataRefresh, onNavigateToReports }) => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  
  const [financialYear, setFinancialYear] = useState<string>('2026');
  const [frequency, setFrequency] = useState<DepreciationFrequency>('Monthly');
  const [periodOptions, setPeriodOptions] = useState<string[]>([]);
  const [periodName, setPeriodName] = useState<string>('August 2026');
  const [targetDate, setTargetDate] = useState<string>('2026-08-31');
  
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Modal states for iframe safety
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [postedVoucherRef, setPostedVoucherRef] = useState<string>('');
  const [postedAssetCount, setPostedAssetCount] = useState<number>(0);
  const [postedTotalAmount, setPostedTotalAmount] = useState<number>(0);

  useEffect(() => {
    setAssets(getAssets().filter(a => a.status === 'Active')); // Only active assets
    setCategories(getAssetCategories());
  }, []);

  // Update period options and default target date whenever year or frequency changes
  useEffect(() => {
    const opts = getPeriodOptions(financialYear, frequency);
    setPeriodOptions(opts);

    // If current periodName is not in the new options, pick the first or August/Current
    let defaultPeriod = opts[0];
    if (frequency === 'Monthly') {
      const augOpt = opts.find(o => o.startsWith('August'));
      if (augOpt) defaultPeriod = augOpt;
    }
    setPeriodName(defaultPeriod);

    const calculatedTargetDate = getPeriodTargetDate(financialYear, frequency, defaultPeriod);
    setTargetDate(calculatedTargetDate);
    setIsCalculated(false);
    setPreviewData([]);
  }, [financialYear, frequency]);

  const handlePeriodChange = (selectedPeriod: string) => {
    setPeriodName(selectedPeriod);
    const calculatedTargetDate = getPeriodTargetDate(financialYear, frequency, selectedPeriod);
    setTargetDate(calculatedTargetDate);
    setIsCalculated(false);
    setPreviewData([]);
  };

  const handleCalculate = () => {
    const results: any[] = [];
    
    assets.forEach(asset => {
      const cat = categories.find(c => c.id === asset.categoryId);
      const calc = calculateDepreciation(asset, targetDate, frequency);
      
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

  const handleExecutePost = () => {
    if (previewData.length === 0) return;
    
    setIsPosting(true);
    setShowConfirmModal(false);
    
    try {
      const dateIso = new Date().toISOString();
      const px = getVoucherPrefix('J', config);
      const refNo = px + nextCounter('Voucher');
      
      let totalDepreciation = 0;
      const voucherLines: Array<{ type: 'Dr' | 'Cr'; ledger: string; amount: number; narration?: string }> = [];
      
      for (const item of previewData) {
        const { asset, depreciationAmount, newAccumulated, newNbv, category } = item;
        totalDepreciation += depreciationAmount;
        
        const depAcc = asset.depreciationExpenseGlAccountId || category?.depreciationExpenseGlAccountId || 'Depreciation Expense';
        const accDepAcc = asset.accumulatedDepreciationGlAccountId || category?.accumulatedDepreciationGlAccountId || 'Accumulated Depreciation';
        
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
        
        // Save Depreciation Transaction
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
        
        // Update Asset Master
        asset.accumulatedDepreciation = newAccumulated;
        asset.netBookValue = newNbv;
        if (newNbv <= (asset.residualValue ?? 1)) {
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
          narration: `Depreciation Posting for ${periodName} (${frequency})`,
          lines: voucherLines
        });
      }
      
      setPostedVoucherRef(refNo);
      setPostedAssetCount(previewData.length);
      setPostedTotalAmount(totalDepreciation);
      
      // Refresh assets & state
      setAssets(getAssets().filter(a => a.status === 'Active'));
      setPreviewData([]);
      setIsCalculated(false);
      setShowSuccessModal(true);
      onDataRefresh();
      
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
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-indigo-600" />
          Depreciation Processing
        </h2>
        <p className="text-xs text-slate-500 mt-1">Calculate and post depreciation for active fixed assets across Monthly, Quarterly, Half-Yearly, or Yearly periods.</p>
      </div>

      {/* Control Panel */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-end gap-4 shrink-0 bg-white">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Financial Year</label>
          <select 
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value)}
            className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:border-indigo-500 outline-none"
          >
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
            <option value="2028">2028</option>
            <option value="2029">2029</option>
            <option value="2030">2030</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Calculation Frequency</label>
          <select 
            value={frequency}
            onChange={e => setFrequency(e.target.value as DepreciationFrequency)}
            className="w-36 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-indigo-500 outline-none bg-indigo-50/30 text-indigo-900"
          >
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Half-Yearly">Half-Yearly</option>
            <option value="Yearly">Yearly / Annual</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Accounting Period</label>
          <select 
            value={periodName}
            onChange={e => handlePeriodChange(e.target.value)}
            className="w-56 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:border-indigo-500 outline-none"
          >
            {periodOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
          <input 
            type="date"
            value={targetDate}
            onChange={e => {
              setTargetDate(e.target.value);
              setIsCalculated(false);
            }}
            className="w-38 px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:border-indigo-500 outline-none"
          />
        </div>

        <button
          onClick={handleCalculate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-xs cursor-pointer"
        >
          <Calculator className="h-4 w-4" />
          Calculate
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        {!isCalculated ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3 py-12">
            <Calculator className="h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium">Select period & frequency, then click <b>Calculate</b> to preview depreciation.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Depreciation Preview</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Period: <span className="font-bold text-slate-700">{periodName}</span> ({frequency}) | Target Date: <span className="font-bold text-slate-700">{targetDate}</span>
                </p>
              </div>
              <div className="text-sm font-bold text-indigo-900 bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-200/80 shadow-2xs">
                Total: {config.CurrencySymbol} {totalDep.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Asset ID</th>
                      <th className="px-4 py-3">Asset Name</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Opening Acc. Dep.</th>
                      <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-900 font-extrabold">Current Dep. ({frequency})</th>
                      <th className="px-4 py-3 text-right">Closing Acc. Dep.</th>
                      <th className="px-4 py-3 text-right">Closing NBV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {previewData.length > 0 ? (
                      previewData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-bold">{item.asset.assetId}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{item.asset.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">{item.asset.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-500">{item.asset.accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold bg-indigo-50/60 text-indigo-800">
                            {item.depreciationAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-700 font-semibold">{item.newAccumulated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700">
                            {item.newNbv.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No active assets require depreciation for this period.
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
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isPosting}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 active:bg-emerald-800 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isPosting ? 'Posting Journal...' : 'Post Depreciation Journal'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IN-APP CONFIRMATION MODAL (Safe from iframe blocking) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-600" />
                Confirm Depreciation Posting
              </h4>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p>You are about to post depreciation and generate an accounting Journal Voucher.</p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-medium text-slate-700">
                <div className="flex justify-between">
                  <span>Period:</span>
                  <span className="font-bold text-slate-900">{periodName} ({frequency})</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Date:</span>
                  <span className="font-bold text-slate-900">{targetDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Assets to Depreciate:</span>
                  <span className="font-bold text-slate-900">{previewData.length} active asset(s)</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-indigo-900 font-extrabold text-sm">
                  <span>Total Amount:</span>
                  <span>{config.CurrencySymbol} {totalDep.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">This will update asset book values, accumulated depreciation, and post journal entries to the GL.</p>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePost}
                className="px-4 py-1.5 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm & Post Journal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Depreciation Posted Successfully!</h3>
              <p className="text-xs text-slate-500">Journal Voucher <b>{postedVoucherRef}</b> has been generated and posted to GL.</p>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60 text-xs text-emerald-950 font-medium space-y-1 text-left">
              <div className="flex justify-between">
                <span>Voucher Ref:</span>
                <span className="font-bold text-emerald-900 font-mono">{postedVoucherRef}</span>
              </div>
              <div className="flex justify-between">
                <span>Period:</span>
                <span className="font-bold text-emerald-900">{periodName}</span>
              </div>
              <div className="flex justify-between">
                <span>Assets Processed:</span>
                <span className="font-bold text-emerald-900">{postedAssetCount} assets</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-emerald-200 text-emerald-950 font-extrabold">
                <span>Total Amount Posted:</span>
                <span>{config.CurrencySymbol} {postedTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              {onNavigateToReports && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigateToReports();
                  }}
                  className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  View Depreciation Schedule in Reports
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
