import React, { useState, useEffect } from 'react';
import { Config, Item } from '../../types';
import { RestaurantTable, MenuItemSchedule } from '../../types/restaurant';
import { getTables, saveTables, getMenuItemSchedules, saveAllMenuItemSchedules } from '../../services/restaurantService';
import { getTenantStorageKey, loadJson, saveJson, getInitialData } from '../../services/storageService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { X, Utensils, Users, Check, Sliders, Search, EyeOff, CheckSquare } from 'lucide-react';

export interface WaiterStaff {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  isActive: boolean;
}

const WAITER_KEY = 'restaurant_waiters';

export function getWaiters(companyId?: string): WaiterStaff[] {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(WAITER_KEY, cId);
  return loadJson<WaiterStaff[]>(key, [
    { id: 'W1', name: 'Waiter 1', phone: '', role: 'Waiter', isActive: true },
    { id: 'W2', name: 'Waiter 2', phone: '', role: 'Waiter', isActive: true }
  ]);
}

export function saveWaiters(waiters: WaiterStaff[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(WAITER_KEY, cId);
  saveJson(key, waiters);
}

interface RestaurantConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: Config;
  onSaveConfig: (updatedConfig: Config) => void;
  items?: Item[];
}

export const RestaurantConfigModal: React.FC<RestaurantConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  items: propItems
}) => {
  const [activeTab, setActiveTab] = useState<'features' | 'tables' | 'waiters' | 'schedules'>('features');

  // Sub-features Form State
  const [form, setForm] = useState<Config>({ ...config });

  // Tables State
  const [tables, setTables] = useState<RestaurantTable[]>(() => getTables());
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableNameInput, setTableNameInput] = useState<string>('');
  const [tableCapInput, setTableCapInput] = useState<number>(4);
  const [tableAreaInput, setTableAreaInput] = useState<string>('Main Hall');

  // Waiters State
  const [waiters, setWaiters] = useState<WaiterStaff[]>(() => getWaiters());
  const [editingWaiterId, setEditingWaiterId] = useState<string | null>(null);
  const [waiterNameInput, setWaiterNameInput] = useState<string>('');
  const [waiterPhoneInput, setWaiterPhoneInput] = useState<string>('');

  // Items & Availability State
  const [items, setItems] = useState<Item[]>(() => propItems || getInitialData().items || []);
  const [schedules, setSchedules] = useState<Record<string, MenuItemSchedule>>(() => getMenuItemSchedules());
  const [scheduleSearch, setScheduleSearch] = useState<string>('');
  const [scheduleCategory, setScheduleCategory] = useState<string>('all');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | 'hidden' | 'available'>('all');

  useEffect(() => {
    setForm({ ...config });
    setTables(getTables());
    setWaiters(getWaiters());
    setItems(propItems || getInitialData().items || []);
    setSchedules(getMenuItemSchedules());
  }, [config, isOpen, propItems]);

  if (!isOpen) return null;

  // Save sub-features
  const handleSaveSubFeatures = () => {
    onSaveConfig(form);
  };

  // Table Handlers
  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNameInput.trim()) return;

    let updated: RestaurantTable[];
    if (editingTableId) {
      updated = tables.map(t =>
        t.id === editingTableId
          ? { ...t, name: tableNameInput.trim(), capacity: tableCapInput, area: tableAreaInput.trim() || 'Main Hall' }
          : t
      );
    } else {
      const newId = `T-${Date.now().toString().slice(-4)}`;
      updated = [
        ...tables,
        { id: newId, name: tableNameInput.trim(), capacity: tableCapInput, area: tableAreaInput.trim() || 'Main Hall', status: 'available' }
      ];
    }
    saveTables(updated);
    setTables(updated);
    setEditingTableId(null);
    setTableNameInput('');
  };

  const handleEditTable = (t: RestaurantTable) => {
    setEditingTableId(t.id);
    setTableNameInput(t.name);
    setTableCapInput(t.capacity);
    setTableAreaInput(t.area || 'Main Hall');
  };

  const handleDeleteTable = (id: string) => {
    if (confirm('Are you sure you want to delete this table?')) {
      const updated = tables.filter(t => t.id !== id);
      saveTables(updated);
      setTables(updated);
    }
  };

  // Waiter Handlers
  const handleSaveWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterNameInput.trim()) return;

    let updated: WaiterStaff[];
    if (editingWaiterId) {
      updated = waiters.map(w =>
        w.id === editingWaiterId
          ? { ...w, name: waiterNameInput.trim(), phone: waiterPhoneInput.trim() }
          : w
      );
    } else {
      const newId = `W-${Date.now().toString().slice(-4)}`;
      updated = [
        ...waiters,
        { id: newId, name: waiterNameInput.trim(), phone: waiterPhoneInput.trim(), role: 'Waiter', isActive: true }
      ];
    }
    saveWaiters(updated);
    setWaiters(updated);
    setEditingWaiterId(null);
    setWaiterNameInput('');
    setWaiterPhoneInput('');
  };

  const handleEditWaiter = (w: WaiterStaff) => {
    setEditingWaiterId(w.id);
    setWaiterNameInput(w.name);
    setWaiterPhoneInput(w.phone || '');
  };

  const handleDeleteWaiter = (id: string) => {
    if (confirm('Are you sure you want to delete this waiter?')) {
      const updated = waiters.filter(w => w.id !== id);
      saveWaiters(updated);
      setWaiters(updated);
    }
  };

  // Simple Item Availability (Tick to Hide / Untick to Show)
  const handleToggleItemUnavailable = (itemCode: string) => {
    const existing = schedules[itemCode] || { itemCode };
    const isCurrentlyUnavailable = existing.isUnavailable === true || existing.isAvailableNow === false || existing.isHiddenFromQR === true;
    const nextUnavailable = !isCurrentlyUnavailable;
    const updatedSchedule: MenuItemSchedule = {
      ...existing,
      itemCode,
      isUnavailable: nextUnavailable,
      isAvailableNow: !nextUnavailable,
      isHiddenFromQR: nextUnavailable,
      outOfStockReason: nextUnavailable ? 'Not available at this time' : undefined
    };
    const updatedAll = { ...schedules, [itemCode]: updatedSchedule };
    setSchedules(updatedAll);
    saveAllMenuItemSchedules(updatedAll);
  };

  const handleMakeAllAvailable = () => {
    const updatedAll = { ...schedules };
    items.forEach(it => {
      const existing = updatedAll[it['Item Code']] || { itemCode: it['Item Code'] };
      updatedAll[it['Item Code']] = {
        ...existing,
        isUnavailable: false,
        isAvailableNow: true,
        isHiddenFromQR: false,
        outOfStockReason: undefined
      };
    });
    setSchedules(updatedAll);
    saveAllMenuItemSchedules(updatedAll);
  };

  const categories = Array.from(new Set(items.map(i => i.Category || 'General Food').filter(Boolean)));

  const unavailableCount = items.filter(it => {
    const s = schedules[it['Item Code']];
    return s?.isUnavailable === true || s?.isAvailableNow === false || s?.isHiddenFromQR === true;
  }).length;
  const availableCount = items.length - unavailableCount;

  const filteredMenuItems = items.filter(i => {
    const schedule = schedules[i['Item Code']];
    const isUnavailable = schedule?.isUnavailable === true || schedule?.isAvailableNow === false || schedule?.isHiddenFromQR === true;

    if (scheduleStatusFilter === 'hidden' && !isUnavailable) return false;
    if (scheduleStatusFilter === 'available' && isUnavailable) return false;
    if (scheduleCategory !== 'all' && i.Category !== scheduleCategory) return false;
    if (scheduleSearch.trim() && !i['Item Name'].toLowerCase().includes(scheduleSearch.toLowerCase()) && !i['Item Code'].toLowerCase().includes(scheduleSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Configure Restaurant &amp; Dining Suite</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Manage restaurant features, menu availability (hide/show items), tables, and staff</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-100 py-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('features')}
            className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'features' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Sub-Feature Toggles</span>
          </button>

          <button
            onClick={() => setActiveTab('schedules')}
            className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'schedules' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Menu Availability &amp; Hide Items ({items.length})</span>
            {unavailableCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                {unavailableCount} Hidden
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tables' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Utensils className="h-3.5 w-3.5" />
            <span>Manage Tables ({tables.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('waiters')}
            className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'waiters' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Manage Waiters ({waiters.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-4 pr-1 space-y-4">
          
          {/* TAB 1: SUB-FEATURE TOGGLES */}
          {activeTab === 'features' && (
            <div className="space-y-3 text-xs">
              
              {/* Service Charge Toggle & Pct */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                      checked={form.EnableRestaurantServiceCharge !== 'false'}
                      onChange={e => setForm({ ...form, EnableRestaurantServiceCharge: e.target.checked ? 'true' : 'false' })}
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 text-xs">Enable Restaurant Service Charge</span>
                      <p className="text-[10px] text-slate-500">Applies optional service charge % to dine-in table bills</p>
                    </div>
                  </label>

                  {form.EnableRestaurantServiceCharge !== 'false' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-700 text-xs">Service Charge %:</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={form.RestaurantServiceChargePct || '10'}
                        onChange={e => setForm({ ...form, RestaurantServiceChargePct: e.target.value })}
                        className="w-16 h-8 rounded-xl border border-slate-300 px-2 text-xs font-black text-slate-900 bg-white outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Sub Toggles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Table Billing */}
                <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    checked={form.EnableTableBilling !== 'false'}
                    onChange={e => setForm({ ...form, EnableTableBilling: e.target.checked ? 'true' : 'false' })}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Table Floor Plan &amp; Billing</span>
                    <span className="text-[10px] text-slate-500">Visual table grid (T1, T2, VIP) with status colors</span>
                  </div>
                </label>

                {/* QR Digital Menu View */}
                <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    checked={form.EnableDigitalMenuQR !== 'false'}
                    onChange={e => setForm({ ...form, EnableDigitalMenuQR: e.target.checked ? 'true' : 'false' })}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">QR Code Digital Menu (View Only)</span>
                    <span className="text-[10px] text-slate-500">Printable table QR stand cards for customer menu viewing</span>
                  </div>
                </label>

                {/* QR Direct Customer Self-Ordering */}
                <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    checked={form.EnableQRDirectOrdering !== 'false'}
                    onChange={e => setForm({ ...form, EnableQRDirectOrdering: e.target.checked ? 'true' : 'false' })}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">QR Direct Customer Self-Ordering</span>
                    <span className="text-[10px] text-slate-500">Customers place orders directly from table QR to Kitchen</span>
                  </div>
                </label>

                {/* Waiter Mobile Pad */}
                <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    checked={form.EnableWaiterMobilePad !== 'false'}
                    onChange={e => setForm({ ...form, EnableWaiterMobilePad: e.target.checked ? 'true' : 'false' })}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Waiter Smartphone Order Pad</span>
                    <span className="text-[10px] text-slate-500">Table-side order taking for waiter staff</span>
                  </div>
                </label>

                {/* Kitchen Display System */}
                <label className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer sm:col-span-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    checked={form.EnableKDSAndKitchenIssue !== 'false'}
                    onChange={e => setForm({ ...form, EnableKDSAndKitchenIssue: e.target.checked ? 'true' : 'false' })}
                  />
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">Kitchen Display (KDS) &amp; Auto Raw Store Deduction</span>
                    <span className="text-[10px] text-slate-500">Live kitchen screen with "Mark Ready" alerts + auto-consumption of raw stock ingredients</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSubFeatures}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md transition cursor-pointer"
                >
                  Save Feature Configuration
                </button>
              </div>
            </div>
          )}

          {/* TAB: MENU AVAILABILITY (HIDE/SHOW ITEMS ON QR MENU) */}
          {activeTab === 'schedules' && (
            <div className="space-y-3.5 text-xs">
              
              {/* Instructions Banner */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-black shrink-0 shadow-xs">
                  <CheckSquare className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-slate-900 text-xs">
                    Simple Menu Availability Control (QR Menu Visibility)
                  </h4>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Simply <strong className="text-rose-700 font-black">TICK ☑️</strong> any item that is <span className="underline font-bold">NOT available right now</span> (e.g. <em>Local fish fry</em> not available in the morning, sold out, or evening only).
                    All ticked items are <strong>instantly hidden</strong> when customers scan the QR Code.
                    <br />
                    Simply <strong className="text-emerald-700 font-black">UNTICK ⬜</strong> at any time to make the dish visible and orderable again instantly!
                  </p>
                </div>
              </div>

              {/* Summary Stats & Quick Bulk Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500">Menu Overview:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-black text-slate-800 text-[11px] shadow-2xs">
                    Total: {items.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 font-black text-emerald-800 text-[11px] shadow-2xs flex items-center gap-1">
                    <span>✅ Visible on QR:</span>
                    <span>{availableCount}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 font-black text-rose-800 text-[11px] shadow-2xs flex items-center gap-1">
                    <span>❌ Hidden / Ticked:</span>
                    <span>{unavailableCount}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleMakeAllAvailable}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer shadow-2xs flex items-center gap-1"
                    title="Untick all items so everything is available on QR menu"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Untick All (Make All Available)</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="relative sm:col-span-6">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={scheduleSearch}
                    onChange={e => setScheduleSearch(e.target.value)}
                    placeholder="Search dish name or item code (e.g. Local fish fry)..."
                    className="w-full h-8.5 pl-8 pr-3 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-amber-500 bg-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={scheduleCategory}
                    onChange={e => setScheduleCategory(e.target.value)}
                    className="w-full h-8.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-amber-500"
                  >
                    <option value="all">All Categories ({items.length})</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={scheduleStatusFilter}
                    onChange={e => setScheduleStatusFilter(e.target.value as any)}
                    className="w-full h-8.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white outline-none focus:border-amber-500"
                  >
                    <option value="all">All Items ({items.length})</option>
                    <option value="hidden">❌ Only Ticked / Hidden ({unavailableCount})</option>
                    <option value="available">✅ Only Visible / Available ({availableCount})</option>
                  </select>
                </div>
              </div>

              {/* Interactive Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[460px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">Tick to Hide</th>
                      <th className="py-2.5 px-3">Item / Food Name</th>
                      <th className="py-2.5 px-3 w-28">Category</th>
                      <th className="py-2.5 px-3 w-24 text-right">Price</th>
                      <th className="py-2.5 px-3 w-44 text-center">QR Menu Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredMenuItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                          No matching food items found.
                        </td>
                      </tr>
                    ) : (
                      filteredMenuItems.map((item, idx) => {
                        const schedule = schedules[item['Item Code']] || { itemCode: item['Item Code'] };
                        const isUnavailable = schedule.isUnavailable === true || schedule.isAvailableNow === false || schedule.isHiddenFromQR === true;

                        return (
                          <tr
                            key={`${item['Item Code']}_${idx}`}
                            onClick={() => handleToggleItemUnavailable(item['Item Code'])}
                            className={`transition cursor-pointer select-none ${
                              isUnavailable
                                ? 'bg-rose-50/80 hover:bg-rose-100/70 text-rose-950'
                                : 'bg-white hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            {/* Checkbox Column */}
                            <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                              <label className="flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isUnavailable}
                                  onChange={() => handleToggleItemUnavailable(item['Item Code'])}
                                  className="w-5 h-5 text-rose-600 rounded-lg border-2 border-slate-300 focus:ring-rose-500 cursor-pointer accent-rose-600"
                                />
                              </label>
                            </td>

                            {/* Item Info */}
                            <td className="py-2.5 px-3">
                              <div className="font-black text-slate-900 text-xs flex items-center gap-2">
                                <span>{item['Item Name']}</span>
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded font-normal">
                                  {item['Item Code']}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {isUnavailable ? (
                                  <span className="text-rose-700 font-bold">
                                    ⚠️ Ticked — Not available right now (Hidden from customer QR scan)
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-medium">
                                    ✓ Unticked — Active and visible in customer QR scan
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-2.5 px-3">
                              <span className="inline-block text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                {item.Category || 'General'}
                              </span>
                            </td>

                            {/* Price */}
                            <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                              {config.CurrencySymbol || 'Nu.'} {Number(item['Sale Rate'] || 0).toFixed(2)}
                            </td>

                            {/* Status Badge */}
                            <td className="py-2.5 px-3 text-center">
                              {isUnavailable ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                                  <span>❌ HIDDEN (Not Available)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span>✅ VISIBLE (Available)</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE TABLES */}
          {activeTab === 'tables' && (
            <div className="space-y-4 text-xs">
              
              {/* Add / Edit Table Form */}
              <form onSubmit={handleSaveTable} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-extrabold text-slate-900 text-xs block">
                  {editingTableId ? '✏️ Edit Table' : '➕ Add New Dining Table'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Table Name / ID</label>
                    <input
                      type="text"
                      placeholder="e.g. Table 1, T1, VIP-1"
                      value={tableNameInput}
                      onChange={e => setTableNameInput(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Capacity (Guests)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={tableCapInput}
                      onChange={e => setTableCapInput(Number(e.target.value) || 2)}
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Dining Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Hall, Terrace, Bar"
                      value={tableAreaInput}
                      onChange={e => setTableAreaInput(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {editingTableId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTableId(null);
                        setTableNameInput('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    {editingTableId ? 'Update Table' : 'Add Table'}
                  </button>
                </div>
              </form>

              {/* Table List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Area</th>
                      <th className="py-2.5 px-3 text-center">Capacity</th>
                      <th className="py-2.5 px-3 text-center">Current Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tables.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-black text-slate-900">{t.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{t.area}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{t.capacity} seats</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            t.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'occupied' ? 'bg-amber-100 text-amber-800' :
                            t.status === 'kot_sent' ? 'bg-orange-100 text-orange-800' :
                            t.status === 'ready' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditTable(t)}
                              className="p-1 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                              title="Edit Table"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTable(t.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Table"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE WAITERS */}
          {activeTab === 'waiters' && (
            <div className="space-y-4 text-xs">
              {/* Add / Edit Waiter Form */}
              <form onSubmit={handleSaveWaiter} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="font-extrabold text-slate-900 text-xs block">
                  {editingWaiterId ? '✏️ Edit Waiter Staff' : '➕ Add Waiter Staff'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Waiter Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sonam, Tashi, Karma"
                      value={waiterNameInput}
                      onChange={e => setWaiterNameInput(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Phone (Optional for alerts)</label>
                    <input
                      type="text"
                      placeholder="e.g. 17123456"
                      value={waiterPhoneInput}
                      onChange={e => setWaiterPhoneInput(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {editingWaiterId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWaiterId(null);
                        setWaiterNameInput('');
                        setWaiterPhoneInput('');
                      }}
                      className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    {editingWaiterId ? 'Update Waiter' : 'Add Waiter'}
                  </button>
                </div>
              </form>

              {/* Waiter List */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waiters.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-black text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-black">
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{w.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{w.role || 'Waiter'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{w.phone || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditWaiter(w)}
                              className="p-1 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                              title="Edit Waiter"
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWaiter(w.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Waiter"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">Restaurant POS &amp; Dining System</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Done / Close
          </button>
        </div>

      </div>
    </div>
  );
};
