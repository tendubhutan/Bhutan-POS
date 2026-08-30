import React from 'react';
import { POSSettings, DEFAULT_POS_SETTINGS } from '../../types/posSettings';
import { X, Settings, Zap, SlidersHorizontal, Volume2, AlertTriangle, Coins, Printer, Check, RotateCcw, Search, Percent, Save, Eye } from 'lucide-react';

interface POSSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: POSSettings;
  onSaveSettings: (newSettings: POSSettings) => void;
}

export const POSSettingsModal: React.FC<POSSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings
}) => {
  const [localSettings, setLocalSettings] = React.useState<POSSettings>(settings);
  const [isSaved, setIsSaved] = React.useState(false);

  React.useEffect(() => {
    setLocalSettings(settings);
    setIsSaved(false);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof POSSettings>(key: K, value: POSSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setIsSaved(true);
    onSaveSettings(localSettings);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 700);
  };

  const handleResetDefaults = () => {
    setLocalSettings(DEFAULT_POS_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">POS Preferences & Workflow</h2>
              <p className="text-xs text-slate-500 font-medium">Customize your keyboard workflow and billing speed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Item Add Workflow Mode */}
          <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
            <label className="block text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                Item Selection & Add Mode
              </span>
              <span className="text-[10px] font-mono text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                RECOMMENDED
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateSetting('itemAddMode', 'direct')}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                  localSettings.itemAddMode === 'direct'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-xs mb-1">
                    <span>⚡ Direct Quick-Add</span>
                    {localSettings.itemAddMode === 'direct' && <Check className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Selecting an item or scanning a barcode immediately adds it to the cart (Qty=1) and keeps focus on the search bar.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-semibold text-indigo-700 bg-indigo-100/60 rounded px-1.5 py-0.5 self-start">
                  Fast Supermarket / Retail Mode
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSetting('itemAddMode', 'prompt')}
                className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                  localSettings.itemAddMode === 'prompt'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-xs mb-1">
                    <span>🎯 Step-by-Step Prompt</span>
                    {localSettings.itemAddMode === 'prompt' && <Check className="h-4 w-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Selecting an item moves cursor to Qty &rarr; Rate &rarr; Discount with Arrow / Enter keys before adding.
                  </p>
                </div>
                <div className="mt-2 text-[10px] font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 self-start">
                  Wholesale / Custom Price Mode
                </div>
              </button>
            </div>
          </div>

          {/* Individual Feature Toggles */}
          <div className="space-y-2.5">
            {/* Item Discount in POS */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-indigo-600" />
                  Item-wise Discount (Per Line Item)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Allow entering discounts for individual items in the cart and top item selection bar. When disabled, item discount inputs and columns are hidden.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.enableItemDiscount !== false}
                  onChange={e => {
                    updateSetting('enableItemDiscount', e.target.checked);
                    updateSetting('enableDiscount', e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Lumpsum / Bill-level Discount in POS */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-rose-500" />
                  Lumpsum / Bill-level Discount
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Show the single-row discount option (Flat Amount or Percentage %) in the checkout panel to discount the entire bill.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.enableBillDiscount !== false}
                  onChange={e => updateSetting('enableBillDiscount', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Auto-Increment Qty */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
                  Auto-Increment Quantity on Rescan
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  When the same item is scanned or selected again, increment its existing cart quantity by +1 instead of creating a new line.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.autoIncrementQty}
                  onChange={e => updateSetting('autoIncrementQty', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Sound & Beep Feedback */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                  Audio & Beep Feedback
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Play pleasant audio beeps on barcode scan, item addition, and bill checkout without requiring external audio files.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.enableSoundFeedback}
                  onChange={e => updateSetting('enableSoundFeedback', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Low / Zero Stock Warning */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Zero / Negative Stock Alert
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Display a badge and warning if an item with 0 or negative current inventory is added to the cart.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.warnLowStock}
                  onChange={e => updateSetting('warnLowStock', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Quick Cash Tender Presets */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-indigo-600" />
                  Quick Cash Tender Buttons
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Show quick denomination buttons (Exact, +50, +100, +500, +1000, Round Up) in the payment panel for rapid 1-click cash entry.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showQuickCashButtons}
                  onChange={e => updateSetting('showQuickCashButtons', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Auto Print Receipt */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  Auto-Launch Receipt on Checkout
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Instantly open the thermal receipt print preview upon checkout (F2) for immediate printing.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.autoPrintReceipt}
                  onChange={e => updateSetting('autoPrintReceipt', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Always Return Focus to Item Search */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-700" />
                  Continuous Fast Search Focus
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Always return focus to the item search bar after cart operations to enable 90%+ mouse-free keyboard operation.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.alwaysFocusSearch}
                  onChange={e => updateSetting('alwaysFocusSearch', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Put Item Description During Sale Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-violet-600" />
                  Item Description Field During Sale
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Provide option to put custom item descriptions, specifications, or notes for each item line during billing and print on invoices.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.enableItemDescription ?? false}
                  onChange={e => updateSetting('enableItemDescription', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Show Purchase Price Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <div className="pr-4">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-emerald-600" />
                  Show Purchase Price
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Display the latest purchase price (cost price) of items in the search dropdown during sale to assist with pricing decisions.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={localSettings.showPurchasePrice ?? false}
                  onChange={e => updateSetting('showPurchasePrice', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel (ESC)
            </button>
            <button
              type="button"
              disabled={isSaved}
              onClick={handleSave}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                isSaved
                  ? 'bg-emerald-600 shadow-sm ring-2 ring-emerald-300'
                  : 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800'
              }`}
            >
              {isSaved ? (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Saved Successfully!</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-orange-100" />
                  <span>Save Preferences</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
