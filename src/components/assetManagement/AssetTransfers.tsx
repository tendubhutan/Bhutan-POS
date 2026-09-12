import React, { useState, useEffect } from 'react';
import { Config } from '../../types';
import { FixedAsset, AssetTransfer } from '../../types/assetManagement';
import { getAssets, saveAsset, saveTransfer, getTransfers, getCustodians } from '../../services/assetManagementService';
import { ArrowRightLeft, Save, FileText } from 'lucide-react';

export const AssetTransfers: React.FC<{config: Config}> = ({ config }) => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [custodians, setCustodians] = useState<any[]>([]);

  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toCustodian, setToCustodian] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');
  const [toDepartment, setToDepartment] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setAssets(getAssets().filter(a => a.status === 'Active' || a.status === 'Fully Depreciated'));
    setTransfers(getTransfers().reverse()); // Show newest first
    setCustodians(getCustodians());
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;

    if (!toCustodian && !toLocation && !toDepartment) {
      alert("Please specify at least one destination (Custodian, Location, or Department).");
      return;
    }

    const newTransfer: AssetTransfer = {
      id: Math.random().toString(36).substring(2, 10),
      transferNumber: `TRF-${Math.floor(Math.random() * 100000)}`,
      assetId: asset.id,
      transferDate,
      fromCustodianId: asset.currentCustodianId,
      toCustodianId: toCustodian || asset.currentCustodianId,
      fromLocation: asset.location,
      toLocation: toLocation || asset.location,
      fromDepartment: asset.department,
      toDepartment: toDepartment || asset.department,
      reason,
      createdBy: 'system'
    };

    saveTransfer(newTransfer);

    // Update asset
    if (toCustodian) asset.currentCustodianId = toCustodian;
    if (toLocation) asset.location = toLocation;
    if (toDepartment) asset.department = toDepartment;
    
    saveAsset(asset, 'system');

    setSuccessMsg(`Asset ${asset.name} successfully transferred.`);
    setTimeout(() => setSuccessMsg(null), 3000);
    
    setSelectedAssetId('');
    setToCustodian('');
    setToLocation('');
    setToDepartment('');
    setReason('');
    
    loadData();
  };

  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
          Asset Transfer
        </h2>
        <p className="text-xs text-slate-500 mt-1">Transfer assets between custodians, locations, and departments.</p>
      </div>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 custom-scrollbar">
        {/* Form Section */}
        <div>
          <form onSubmit={handleTransfer} className="space-y-4">
            {successMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-200 rounded-lg">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Asset *</label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
              >
                <option value="">-- Choose Asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.assetId} - {a.name}</option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p><span className="font-bold text-slate-600">Current Custodian:</span> {selectedAsset.currentCustodianId || 'None'}</p>
                <p><span className="font-bold text-slate-600">Current Location:</span> {selectedAsset.location || 'None'}</p>
                <p><span className="font-bold text-slate-600">Current Department:</span> {selectedAsset.department || 'None'}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Date *</label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Custodian</label>
                <select
                  value={toCustodian}
                  onChange={(e) => setToCustodian(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"
                >
                  <option value="">-- Unchanged --</option>
                  {custodians.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Location</label>
                <input
                  type="text"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="e.g. Server Room A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Department</label>
                <input
                  type="text"
                  value={toDepartment}
                  onChange={(e) => setToDepartment(e.target.value)}
                  placeholder="e.g. IT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Transfer</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Employee reassignment, maintenance..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!selectedAssetId}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer shadow-sm"
              >
                <Save className="h-4 w-4" />
                Process Transfer
              </button>
            </div>
          </form>
        </div>

        {/* History Section */}
        <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-600" />
            <h3 className="font-bold text-sm text-slate-800">Transfer History</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            {transfers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No transfers recorded yet.</div>
            ) : (
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-bold text-slate-700">Date</th>
                    <th className="px-3 py-2 font-bold text-slate-700">Asset</th>
                    <th className="px-3 py-2 font-bold text-slate-700">From &rarr; To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map(tr => {
                    const assetName = getAssets().find(a => a.id === tr.assetId)?.name || 'Unknown';
                    const changes = [];
                    if (tr.fromCustodianId !== tr.toCustodianId) changes.push(`Cust: ${tr.toCustodianId || 'None'}`);
                    if (tr.fromLocation !== tr.toLocation) changes.push(`Loc: ${tr.toLocation || 'None'}`);
                    if (tr.fromDepartment !== tr.toDepartment) changes.push(`Dept: ${tr.toDepartment || 'None'}`);
                    
                    return (
                      <tr key={tr.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">{tr.transferDate}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{assetName}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]" title={changes.join(', ')}>
                          {changes.join(', ') || 'Metadata update'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
