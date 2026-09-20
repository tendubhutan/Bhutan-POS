import React, { useState } from 'react';
import { Config } from '../types';
import { X, Wrench, MapPin, Car, Printer, FileText, Check, Plus, Trash2, ListTree } from 'lucide-react';
import { getRacks, saveRack, deleteRack, getCompatibilities, saveCompatibility, deleteCompatibility } from '../services/storageService';

interface SparePartsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  onUpdateConfig: (updated: Partial<Config>) => void;
}

export const SparePartsConfigModal: React.FC<SparePartsConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'options' | 'racks' | 'compatibilities'>('options');
  const [racksList, setRacksList] = useState<string[]>(getRacks());
  const [compatList, setCompatList] = useState<string[]>(getCompatibilities());
  const [newRackInput, setNewRackInput] = useState('');
  const [newCompatInput, setNewCompatInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isRackBinEnabled = config.EnableRackBin !== 'false';
  const isCompatibilityEnabled = config.EnableCompatibility !== 'false';
  const isPrintPartNoEnabled = config.PrintPartNumber !== 'false';
  const isPrintCompatEnabled = config.PrintCompatibility === 'true';

  const handleAddRack = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = saveRack(newRackInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to save rack');
      return;
    }
    setRacksList(res.racks);
    setNewRackInput('');
  };

  const handleDeleteRack = (name: string) => {
    const res = deleteRack(name);
    setRacksList(res.racks);
  };

  const handleAddCompat = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = saveCompatibility(newCompatInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to save compatibility');
      return;
    }
    setCompatList(res.compatibilities);
    setNewCompatInput('');
  };

  const handleDeleteCompat = (name: string) => {
    const res = deleteCompatibility(name);
    setCompatList(res.compatibilities);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="spare-parts-config-modal"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spare-parts-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/85">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 id="spare-parts-modal-title" className="text-sm font-extrabold text-slate-900">
                Spare Parts Management &amp; Master Lists
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure features, print settings, and manage pre-defined Racks &amp; Vehicle lists
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Close configuration window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-100/60 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('options')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-t border-x ${
              activeTab === 'options'
                ? 'bg-white text-blue-700 border-slate-200 shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            ⚙️ Feature &amp; Print Options
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('racks')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-t border-x flex items-center gap-1.5 ${
              activeTab === 'racks'
                ? 'bg-white text-blue-700 border-slate-200 shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Rack &amp; Bin List ({racksList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compatibilities')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition cursor-pointer border-t border-x flex items-center gap-1.5 ${
              activeTab === 'compatibilities'
                ? 'bg-white text-blue-700 border-slate-200 shadow-xs'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Car className="w-3.5 h-3.5 text-blue-600" />
            <span>Vehicle / Machinery List ({compatList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-800 font-bold">×</button>
            </div>
          )}

          {activeTab === 'options' && (
            <div className="space-y-3.5">
              {/* Option 1: Rack / Bin Location */}
              <div 
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                  isRackBinEnabled 
                    ? 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 opacity-80'
                }`}
                onClick={() => onUpdateConfig({ EnableRackBin: isRackBinEnabled ? 'false' : 'true' })}
              >
                <div className="pt-0.5">
                  <input
                    id="cfg-spare-rack-bin"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={isRackBinEnabled}
                    onChange={(e) => onUpdateConfig({ EnableRackBin: e.target.checked ? 'true' : 'false' })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <label htmlFor="cfg-spare-rack-bin" className="font-extrabold text-slate-900 text-xs cursor-pointer">
                      Rack &amp; Bin Location Tracking
                    </label>
                    {isRackBinEnabled && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                        ON
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Specify warehouse/shop physical storage location from a pre-defined list or add on the fly.
                  </p>
                </div>
              </div>

              {/* Option 2: Vehicle & Machine Compatibility */}
              <div 
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                  isCompatibilityEnabled 
                    ? 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 opacity-80'
                }`}
                onClick={() => onUpdateConfig({ EnableCompatibility: isCompatibilityEnabled ? 'false' : 'true' })}
              >
                <div className="pt-0.5">
                  <input
                    id="cfg-spare-compatibility"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={isCompatibilityEnabled}
                    onChange={(e) => onUpdateConfig({ EnableCompatibility: e.target.checked ? 'true' : 'false' })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <label htmlFor="cfg-spare-compatibility" className="font-extrabold text-slate-900 text-xs cursor-pointer">
                      Vehicle / Machine Compatibility
                    </label>
                    {isCompatibilityEnabled && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                        ON
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Define compatible vehicle/machinery models from a pre-defined dropdown list or add new ones on the fly.
                  </p>
                </div>
              </div>

              {/* Option 3: Print Part Number on Invoices */}
              <div 
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                  isPrintPartNoEnabled 
                    ? 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 opacity-80'
                }`}
                onClick={() => onUpdateConfig({ PrintPartNumber: isPrintPartNoEnabled ? 'false' : 'true' })}
              >
                <div className="pt-0.5">
                  <input
                    id="cfg-spare-print-partno"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={isPrintPartNoEnabled}
                    onChange={(e) => onUpdateConfig({ PrintPartNumber: e.target.checked ? 'true' : 'false' })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Printer className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <label htmlFor="cfg-spare-print-partno" className="font-extrabold text-slate-900 text-xs cursor-pointer">
                      Print Part Number on Bills &amp; Receipts
                    </label>
                    {isPrintPartNoEnabled && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                        ON
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Display Part / OEM No. under item titles on thermal receipts and tax invoices.
                  </p>
                </div>
              </div>

              {/* Option 4: Print Compatibility on Invoices */}
              <div 
                className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3.5 ${
                  isPrintCompatEnabled 
                    ? 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 opacity-80'
                }`}
                onClick={() => onUpdateConfig({ PrintCompatibility: isPrintCompatEnabled ? 'false' : 'true' })}
              >
                <div className="pt-0.5">
                  <input
                    id="cfg-spare-print-compat"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={isPrintCompatEnabled}
                    onChange={(e) => onUpdateConfig({ PrintCompatibility: e.target.checked ? 'true' : 'false' })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <label htmlFor="cfg-spare-print-compat" className="font-extrabold text-slate-900 text-xs cursor-pointer">
                      Print Compatibility on Bills &amp; Invoices
                    </label>
                    {isPrintCompatEnabled ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                        ON
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600">
                        OFF
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Include compatible vehicle/machinery description on printed customer bills.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'racks' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900">
                <b>Rack &amp; Bin Master List:</b> Define store physical locations so staff can easily select them when creating or updating items.
              </div>
              <form onSubmit={handleAddRack} className="flex gap-2">
                <input
                  type="text"
                  value={newRackInput}
                  onChange={(e) => setNewRackInput(e.target.value)}
                  placeholder="e.g. Rack D-05, Bin 24"
                  className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold focus:border-blue-500 outline-none bg-white"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Rack</span>
                </button>
              </form>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Rack / Bin Name</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {racksList.map((rack) => (
                      <tr key={rack} className="hover:bg-white transition">
                        <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          <span>{rack}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRack(rack)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete Rack"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'compatibilities' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900">
                <b>Vehicle / Machinery Master List:</b> Manage compatible vehicle makes, models, and equipment for quick item tagging.
              </div>
              <form onSubmit={handleAddCompat} className="flex gap-2">
                <input
                  type="text"
                  value={newCompatInput}
                  onChange={(e) => setNewCompatInput(e.target.value)}
                  placeholder="e.g. Isuzu D-Max, Hyundai Tucson, CAT Excavator"
                  className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-xs font-semibold focus:border-blue-500 outline-none bg-white"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Vehicle</span>
                </button>
              </form>
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Vehicle / Machinery Compatibility</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {compatList.map((compat) => (
                      <tr key={compat} className="hover:bg-white transition">
                        <td className="py-2 px-3 font-semibold text-slate-900 flex items-center gap-2">
                          <Car className="w-3.5 h-3.5 text-blue-600" />
                          <span>{compat}</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCompat(compat)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Delete Compatibility"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500">
            Changes apply immediately across inventory &amp; billing.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

