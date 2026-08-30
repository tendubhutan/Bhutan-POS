import React, { useState, useEffect } from 'react';
import { FixedAsset } from '../../types/assetManagement';
import { Config } from '../../types';
import { getAssets, saveAssets } from '../../services/assetManagementService';
import { Search, Plus, FileText, Eye, Upload } from 'lucide-react';

interface AssetRegisterProps {
  config: Config;
  onEditAsset: (id: string) => void;
}

export const AssetRegister: React.FC<AssetRegisterProps> = ({ config, onEditAsset }) => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    setAssets(getAssets());
    
    const handleStorageChange = () => setAssets(getAssets());
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (assets.length > 5000) {
      alert("Warning: Local storage capacity is reaching limits. Please upgrade to Cloud DB for 25,000+ assets.");
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return;
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const newAssets: FixedAsset[] = lines.slice(1).map((line, i) => {
          // Simple regex to split by comma ignoring commas inside quotes
          const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          const cleanVals = values.map(v => v.replace(/^"|"$/g, '').trim());
          
          const obj: any = {};
          headers.forEach((h, idx) => {
            obj[h] = cleanVals[idx] || '';
          });

          // Map CSV to our FixedAsset structure
          const cost = parseFloat(obj.cost) || 0;
          const accDep = parseFloat(obj.accumulateddepreciation) || parseFloat(obj.acc_dep) || 0;
          const nbv = Math.max(1, cost - accDep);

          return {
            id: crypto.randomUUID(),
            assetId: obj.assetid || `FA-IMP-${Date.now().toString().slice(-4)}${i}`,
            name: obj.name || `Imported Asset ${i+1}`,
            categoryId: obj.categoryid || obj.category || '',
            assetTag: obj.assettag || '',
            cost: cost,
            residualValue: 1,
            depreciationMethod: 'Straight Line',
            status: 'Active', // Import as active Opening Balances
            accumulatedDepreciation: accDep,
            netBookValue: nbv,
            createdBy: 'system_import',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as FixedAsset;
        });

        if (window.confirm(`Found ${newAssets.length} assets to import. Continue?`)) {
          const combined = [...assets, ...newAssets];
          saveAssets(combined);
          setAssets(combined);
          alert("Import successful! Note: Automated accounting vouchers are NOT generated for bulk imported assets. Please ensure your opening balance ledgers match.");
        }
      } catch (err) {
        console.error(err);
        alert("Error parsing CSV file. Please ensure it's a valid text/csv format.");
      }
    };
    reader.readAsText(file);
    // reset input
    e.target.value = '';
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.assetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.assetTag && a.assetTag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Draft': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Fully Depreciated': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'Disposed':
      case 'Sold':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          Asset Register
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 cursor-pointer transition-colors shadow-sm">
            <Upload className="h-4 w-4" />
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-10 shadow-xs">
            <tr>
              <th className="px-4 py-3">Asset ID</th>
              <th className="px-4 py-3">Asset Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Acc. Dep.</th>
              <th className="px-4 py-3 text-right">NBV</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">{asset.assetId}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{asset.name}</div>
                    <div className="text-[10px] text-slate-500">{asset.description || asset.assetTag}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{asset.categoryId}</td>
                  <td className="px-4 py-3 text-right font-mono">{asset.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-mono text-rose-600">{asset.accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                    {asset.netBookValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(asset.status)}`}>
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEditAsset(asset.id)}
                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                      title="View/Edit Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <FileText className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-lg font-semibold text-slate-700">No assets found</p>
                    <p className="text-sm mt-1">Click "Add Asset" to create a new fixed asset.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
