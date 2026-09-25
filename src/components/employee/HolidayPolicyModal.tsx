import React, { useState } from 'react';
import { 
  Calendar, Check, X, Plus, Trash2, Sliders, ShieldCheck, 
  Info, Sparkles, Building2, Globe, AlertCircle, CheckCircle2
} from 'lucide-react';
import { 
  CompanyHolidayPolicy, CompanyHoliday, WeeklyOffMode 
} from '../../types/staffPortal';
import { 
  getCompanyHolidayPolicy, saveCompanyHolidayPolicy,
  DEFAULT_BHUTAN_GOVERNMENT_HOLIDAYS 
} from '../../services/employeeStaffService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';

interface HolidayPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPolicyUpdated?: (policy: CompanyHolidayPolicy) => void;
  companyId?: string;
}

export const HolidayPolicyModal: React.FC<HolidayPolicyModalProps> = ({
  isOpen,
  onClose,
  onPolicyUpdated,
  companyId
}) => {
  const cId = companyId || getActiveCompanyId();
  const [policy, setPolicy] = useState<CompanyHolidayPolicy>(() => getCompanyHolidayPolicy(cId));
  const [filterType, setFilterType] = useState<'all' | 'govt' | 'custom'>('all');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customHolidayForm, setCustomHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    isRecurringYearly: true,
    description: ''
  });
  const [saveToast, setSaveToast] = useState(false);

  if (!isOpen) return null;

  const handleWeeklyOffChange = (mode: WeeklyOffMode) => {
    let customDays = [0];
    if (mode === 'saturday_sunday') {
      customDays = [0, 6];
    } else if (mode === 'sunday_only') {
      customDays = [0];
    }
    const updated: CompanyHolidayPolicy = {
      ...policy,
      weeklyOffMode: mode,
      customWeeklyOffDays: customDays
    };
    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);
  };

  const handleToggleHoliday = (id: string) => {
    const updatedHolidays = policy.holidays.map(h => {
      if (h.id === id) {
        return { ...h, enabled: !h.enabled };
      }
      return h;
    });
    const updated: CompanyHolidayPolicy = {
      ...policy,
      holidays: updatedHolidays
    };
    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);
  };

  const handleBulkGovtToggle = (enableAll: boolean) => {
    const updatedHolidays = policy.holidays.map(h => {
      if (h.isGovernmentHoliday) {
        return { ...h, enabled: enableAll };
      }
      return h;
    });
    const updated: CompanyHolidayPolicy = {
      ...policy,
      holidays: updatedHolidays,
      enableGovernmentHolidays: enableAll
    };
    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);
  };

  const handleAddCustomHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHolidayForm.name.trim() || !customHolidayForm.date) return;

    const newHoliday: CompanyHoliday = {
      id: `HOL-${Date.now().toString(36).toUpperCase()}`,
      name: customHolidayForm.name.trim(),
      date: customHolidayForm.date,
      isRecurringYearly: customHolidayForm.isRecurringYearly,
      isGovernmentHoliday: false,
      enabled: true,
      description: customHolidayForm.description.trim() || undefined
    };

    const updated: CompanyHolidayPolicy = {
      ...policy,
      holidays: [...policy.holidays, newHoliday]
    };

    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);

    setCustomHolidayForm({
      name: '',
      date: new Date().toISOString().split('T')[0],
      isRecurringYearly: true,
      description: ''
    });
    setShowAddCustom(false);
  };

  const handleDeleteHoliday = (id: string) => {
    const updated: CompanyHolidayPolicy = {
      ...policy,
      holidays: policy.holidays.filter(h => h.id !== id)
    };
    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);
  };

  const handleToggleAutoExclude = (field: 'autoExcludeHolidaysFromLeave' | 'autoExcludeWeeklyOffFromLeave') => {
    const updated: CompanyHolidayPolicy = {
      ...policy,
      [field]: !policy[field]
    };
    setPolicy(updated);
    saveCompanyHolidayPolicy(updated, cId);
    if (onPolicyUpdated) onPolicyUpdated(updated);
  };

  const filteredHolidays = policy.holidays.filter(h => {
    if (filterType === 'govt') return h.isGovernmentHoliday;
    if (filterType === 'custom') return !h.isGovernmentHoliday;
    return true;
  });

  const enabledCount = policy.holidays.filter(h => h.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Company Holidays & Weekly-Off Policy</h3>
              <p className="text-xs text-slate-500">Configure weekly offs and company holidays. These days are automatically excluded from leave deductions.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* SECTION 1: WEEKLY-OFF MODE */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Standard Weekly-Off Schedule</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {policy.weeklyOffMode === 'saturday_sunday' 
                ? '5-Day Work Week (Sat & Sun Off)' 
                : policy.weeklyOffMode === 'sunday_only'
                ? '6-Day Work Week (Sunday Only Off)'
                : 'Custom Weekly Offs'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleWeeklyOffChange('saturday_sunday')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                policy.weeklyOffMode === 'saturday_sunday'
                  ? 'bg-blue-50/80 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
              }`}
            >
              <div className="font-bold text-xs">Saturday & Sunday</div>
              <p className="text-[10px] text-slate-500 mt-1">Both Saturday and Sunday are weekly offs (5-Day Work Week).</p>
            </button>

            <button
              type="button"
              onClick={() => handleWeeklyOffChange('sunday_only')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                policy.weeklyOffMode === 'sunday_only'
                  ? 'bg-blue-50/80 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
              }`}
            >
              <div className="font-bold text-xs">Sunday Only</div>
              <p className="text-[10px] text-slate-500 mt-1">Only Sunday is weekly off; Saturday is a regular working day (6-Day Work Week).</p>
            </button>

            <button
              type="button"
              onClick={() => handleWeeklyOffChange('none')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                policy.weeklyOffMode === 'none'
                  ? 'bg-blue-50/80 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
              }`}
            >
              <div className="font-bold text-xs">No Fixed Weekly Off</div>
              <p className="text-[10px] text-slate-500 mt-1">Roster-based or custom working schedule with no fixed weekend deduction.</p>
            </button>
          </div>
        </div>

        {/* SECTION 2: AUTO-EXCLUSION TOGGLES */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-900 font-bold">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Leave Auto-Deduction Rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.autoExcludeWeeklyOffFromLeave}
                onChange={() => handleToggleAutoExclude('autoExcludeWeeklyOffFromLeave')}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <span className="text-[11px] font-semibold">Auto-exclude Weekly Offs from Leave Deductions</span>
            </label>

            <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.autoExcludeHolidaysFromLeave}
                onChange={() => handleToggleAutoExclude('autoExcludeHolidaysFromLeave')}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
              <span className="text-[11px] font-semibold">Auto-exclude Active Holidays from Leave Deductions</span>
            </label>
          </div>
        </div>

        {/* SECTION 3: HOLIDAY LIST (GOVERNMENT & CUSTOM) */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <span>Observed Public & Company Holidays ({enabledCount} Active)</span>
              </h4>
              <p className="text-[11px] text-slate-500">Toggle active holidays or customize specific government days your business provides.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                >
                  All ({policy.holidays.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('govt')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterType === 'govt' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                >
                  Govt ({policy.holidays.filter(h => h.isGovernmentHoliday).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('custom')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${filterType === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                >
                  Custom ({policy.holidays.filter(h => !h.isGovernmentHoliday).length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustom(true)}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Custom Holiday</span>
              </button>
            </div>
          </div>

          {/* Quick Bulk Select for Govt Holidays */}
          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px]">
            <span className="text-slate-600">Quick Govt Holiday Presets:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkGovtToggle(true)}
                className="text-blue-600 hover:underline font-bold text-[10px] cursor-pointer"
              >
                Enable All Govt Holidays
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => handleBulkGovtToggle(false)}
                className="text-slate-600 hover:underline font-bold text-[10px] cursor-pointer"
              >
                Disable All
              </button>
            </div>
          </div>

          {/* Add Custom Holiday Inline Form */}
          {showAddCustom && (
            <form onSubmit={handleAddCustomHoliday} className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3 text-xs animate-in fade-in">
              <div className="flex items-center justify-between font-bold text-blue-900">
                <span>Add New Company Holiday</span>
                <button type="button" onClick={() => setShowAddCustom(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Holiday Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Local Tshechu or Annual Picnic"
                    value={customHolidayForm.name}
                    onChange={e => setCustomHolidayForm({ ...customHolidayForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Holiday Date *</label>
                  <input
                    type="date"
                    required
                    value={customHolidayForm.date}
                    onChange={e => setCustomHolidayForm({ ...customHolidayForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Notes / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional details or instructions..."
                  value={customHolidayForm.description}
                  onChange={e => setCustomHolidayForm({ ...customHolidayForm, description: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          )}

          {/* Holiday Scrollable List */}
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
            {filteredHolidays.map(h => (
              <div 
                key={h.id} 
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                  h.enabled 
                    ? 'bg-white border-slate-200 shadow-2xs' 
                    : 'bg-slate-50/70 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={() => handleToggleHoliday(h.id)}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs truncate">{h.name}</span>
                      {h.isGovernmentHoliday ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold border border-amber-200 shrink-0">
                          Public Holiday
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold border border-indigo-200 shrink-0">
                          Custom Company
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                      <span>📅 {h.date}</span>
                      {h.description && <span className="text-slate-400 truncate">• {h.description}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!h.isGovernmentHoliday && (
                    <button
                      type="button"
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                      title="Delete Custom Holiday"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {h.enabled ? 'Active' : 'Off'}
                  </span>
                </div>
              </div>
            ))}

            {filteredHolidays.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No holidays found matching this filter.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Changes are saved immediately and applied to all leave requests.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
};
