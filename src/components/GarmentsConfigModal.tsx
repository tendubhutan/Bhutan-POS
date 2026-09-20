import React, { useState } from 'react';
import { Config } from '../types';
import { X, Shirt, Tag, Palette, Printer, Plus, Trash2 } from 'lucide-react';
import { getSizes, saveSize, deleteSize, getColors, saveColor, deleteColor } from '../services/storageService';

interface GarmentsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  onUpdateConfig: (updated: Partial<Config>) => void;
}

export const GarmentsConfigModal: React.FC<GarmentsConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'options' | 'sizes' | 'colors'>('options');
  const [sizesList, setSizesList] = useState<string[]>(getSizes());
  const [colorsList, setColorsList] = useState<string[]>(getColors());
  const [newSizeInput, setNewSizeInput] = useState('');
  const [newColorInput, setNewColorInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isSizeEnabled = config.EnableSize !== 'false';
  const isColorEnabled = config.EnableColor !== 'false';
  const isPrintSizeEnabled = config.PrintSize !== 'false';
  const isPrintColorEnabled = config.PrintColor !== 'false';

  const handleAddSize = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = saveSize(newSizeInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to save size');
      return;
    }
    setSizesList(res.sizes);
    setNewSizeInput('');
  };

  const handleDeleteSize = (name: string) => {
    const res = deleteSize(name);
    setSizesList(res.sizes);
  };

  const handleAddColor = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = saveColor(newColorInput);
    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to save color');
      return;
    }
    setColorsList(res.colors);
    setNewColorInput('');
  };

  const handleDeleteColor = (name: string) => {
    const res = deleteColor(name);
    setColorsList(res.colors);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="garments-config-modal"
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="garments-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-purple-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <h3 id="garments-modal-title" className="text-sm font-extrabold text-slate-900">
                Garments &amp; Footwear Variants (Size &amp; Color)
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure size, color, printing options and manage master variant lists
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('options'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition cursor-pointer ${
              activeTab === 'options'
                ? 'border-purple-600 text-purple-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Shirt className="w-3.5 h-3.5" />
            <span>Options &amp; Print Rules</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('sizes'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition cursor-pointer ${
              activeTab === 'sizes'
                ? 'border-purple-600 text-purple-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-purple-600" />
            <span>Sizes Master ({sizesList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('colors'); setErrorMsg(''); }}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition cursor-pointer ${
              activeTab === 'colors'
                ? 'border-purple-600 text-purple-700 bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-pink-600" />
            <span>Colors Master ({colorsList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: OPTIONS */}
          {activeTab === 'options' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
                <h4 className="font-extrabold text-purple-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-purple-600" />
                  Garment &amp; Footwear Variant Fields
                </h4>
                
                {/* Enable Size */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-purple-300 transition cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-4 h-4 text-purple-600" />
                    <div>
                      <span className="font-extrabold text-slate-900">Enable Size Field</span>
                      <p className="text-[11px] text-slate-500">Track garment sizes (S, M, L) and footwear sizes (38, 39, 40)</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSizeEnabled}
                    onChange={(e) => onUpdateConfig({ EnableSize: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                </label>

                {/* Enable Color */}
                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-pink-300 transition cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Palette className="w-4 h-4 text-pink-600" />
                    <div>
                      <span className="font-extrabold text-slate-900">Enable Color Field</span>
                      <p className="text-[11px] text-slate-500">Track garment and shoe colors (Black, Navy, White)</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isColorEnabled}
                    onChange={(e) => onUpdateConfig({ EnableColor: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Printing Rules */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <Printer className="w-4 h-4 text-slate-600" />
                  Print Options on Invoices &amp; Receipts
                </h4>

                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition cursor-pointer">
                  <span className="font-bold text-slate-800">Print Selected Size on Invoices &amp; Receipts</span>
                  <input
                    type="checkbox"
                    checked={isPrintSizeEnabled}
                    onChange={(e) => onUpdateConfig({ PrintSize: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition cursor-pointer">
                  <span className="font-bold text-slate-800">Print Selected Color on Invoices &amp; Receipts</span>
                  <input
                    type="checkbox"
                    checked={isPrintColorEnabled}
                    onChange={(e) => onUpdateConfig({ PrintColor: e.target.checked ? 'true' : 'false' })}
                    className="w-4 h-4 text-pink-600 rounded border-slate-300 focus:ring-pink-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: SIZES MASTER */}
          {activeTab === 'sizes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddSize} className="flex gap-2 bg-purple-50/60 p-3 rounded-xl border border-purple-100">
                <input
                  type="text"
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  placeholder="Enter new Size (e.g., XL, 42)..."
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:border-purple-600 outline-none bg-white"
                />
                <button
                  type="submit"
                  className="px-4 h-9 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Size</span>
                </button>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1 p-2 bg-slate-50">
                  {sizesList.length === 0 ? (
                    <p className="col-span-2 text-center text-slate-400 py-4 font-semibold">No pre-defined sizes found.</p>
                  ) : (
                    sizesList.map((sz) => (
                      <div key={sz} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                        <span className="font-bold text-slate-800 font-mono">{sz}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSize(sz)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete size"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COLORS MASTER */}
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <form onSubmit={handleAddColor} className="flex gap-2 bg-pink-50/60 p-3 rounded-xl border border-pink-100">
                <input
                  type="text"
                  value={newColorInput}
                  onChange={(e) => setNewColorInput(e.target.value)}
                  placeholder="Enter new Color (e.g., Black, Navy Blue)..."
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-xs font-semibold focus:border-pink-600 outline-none bg-white"
                />
                <button
                  type="submit"
                  className="px-4 h-9 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Color</span>
                </button>
              </form>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1 p-2 bg-slate-50">
                  {colorsList.length === 0 ? (
                    <p className="col-span-2 text-center text-slate-400 py-4 font-semibold">No pre-defined colors found.</p>
                  ) : (
                    colorsList.map((col) => (
                      <div key={col} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                        <span className="font-bold text-slate-800 font-mono">{col}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteColor(col)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete color"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-extrabold rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
