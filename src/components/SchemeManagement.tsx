import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Tags,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Edit2,
  Trash2,
  Copy,
  Calendar,
  Clock,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Percent,
  Layers,
  CheckCircle2,
  XCircle,
  Power
} from 'lucide-react';
import { Scheme, SchemeTargetType, SchemeType, SchemeSaleChannel, Item, ItemGroup, Config } from '../types';
import {
  getSchemes,
  saveScheme,
  deleteScheme,
  toggleSchemeStatus,
  isSchemeActiveNow,
  DEFAULT_SCHEMES
} from '../services/schemeService';
import { loadJson, STORAGE_KEYS, getItemCategories } from '../services/storageService';

const DAYS_OF_WEEK = [
  { day: 0, label: 'Sun', full: 'Sunday' },
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' }
];

export const SchemeManagement: React.FC<{
  onClose?: () => void;
  currency?: string;
}> = ({ onClose, currency = 'Nu.' }) => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'pos_only' | 'b2b_only' | 'both'>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formChannel, setFormChannel] = useState<SchemeSaleChannel>('all');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  const [formTargetType, setFormTargetType] = useState<SchemeTargetType>('all_items');
  const [formTargetValues, setFormTargetValues] = useState<string[]>([]);
  const [itemSearchText, setItemSearchText] = useState('');
  const [brandInputText, setBrandInputText] = useState('');

  const [formSchemeType, setFormSchemeType] = useState<SchemeType>('percent_discount');
  const [formDiscountValue, setFormDiscountValue] = useState<number | ''>(10);
  const [formSpecialRate, setFormSpecialRate] = useState<number | ''>('');
  const [formMinQty, setFormMinQty] = useState<number | ''>('');
  const [formMaxQty, setFormMaxQty] = useState<number | ''>('');

  const [formBuyQty, setFormBuyQty] = useState<number | ''>(2);
  const [formFreeQty, setFormFreeQty] = useState<number | ''>(1);

  const [formMinBillAmount, setFormMinBillAmount] = useState<number | ''>(1000);
  const [formBillDiscountType, setFormBillDiscountType] = useState<'percent' | 'flat'>('flat');
  const [formBillDiscountValue, setFormBillDiscountValue] = useState<number | ''>(50);

  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([]);
  const [formHasTimeLimit, setFormHasTimeLimit] = useState(false);
  const [formStartTime, setFormStartTime] = useState('14:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formPriority, setFormPriority] = useState<number>(10);

  const [formError, setFormError] = useState<string | null>(null);

  // Load masters data
  const items = useMemo(() => loadJson<Item[]>(STORAGE_KEYS.ITEMS, []), []);
  const itemGroups = useMemo(() => loadJson<ItemGroup[]>(STORAGE_KEYS.ITEM_GROUPS, []), []);
  const itemCategories = useMemo(() => getItemCategories(), []);
  
  // Extract unique brands from items
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const b = (i.brand || i.Brand || (i as any).manufacturer || (i as any).Manufacturer || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set);
  }, [items]);

  const loadAllSchemes = () => {
    setSchemes(getSchemes());
  };

  useEffect(() => {
    loadAllSchemes();
  }, []);

  // Filtered schemes
  const filteredSchemes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return schemes.filter(s => {
      // Search
      if (q) {
        const matchName = s.name.toLowerCase().includes(q);
        const matchCode = (s.code || '').toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        const matchTargets = (s.targetValues || []).some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchDesc && !matchTargets) return false;
      }

      // Status
      if (statusFilter === 'active' && s.status !== 'active') return false;
      if (statusFilter === 'paused' && s.status !== 'inactive') return false;

      // Channel
      if (channelFilter === 'both' && s.appliesToSaleType !== 'all') return false;
      if (channelFilter === 'pos_only' && s.appliesToSaleType !== 'pos_only') return false;
      if (channelFilter === 'b2b_only' && s.appliesToSaleType !== 'b2b_only') return false;

      // Target
      if (targetFilter !== 'all' && s.targetType !== targetFilter) return false;

      return true;
    });
  }, [schemes, searchQuery, statusFilter, channelFilter, targetFilter]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const total = schemes.length;
    const active = schemes.filter(s => s.status === 'active').length;
    const liveNow = schemes.filter(s => {
      const posCheck = isSchemeActiveNow(s, 'pos', now);
      const b2bCheck = isSchemeActiveNow(s, 'b2b', now);
      return posCheck.active || b2bCheck.active;
    }).length;
    const posCount = schemes.filter(s => s.appliesToSaleType === 'pos_only' || s.appliesToSaleType === 'all').length;
    const b2bCount = schemes.filter(s => s.appliesToSaleType === 'b2b_only' || s.appliesToSaleType === 'all').length;

    return { total, active, liveNow, posCount, b2bCount };
  }, [schemes]);

  const handleOpenCreateModal = () => {
    setEditingScheme(null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormChannel('all');
    setFormStatus('active');
    setFormTargetType('all_items');
    setFormTargetValues([]);
    setItemSearchText('');
    setBrandInputText('');
    setFormSchemeType('percent_discount');
    setFormDiscountValue(10);
    setFormSpecialRate('');
    setFormMinQty('');
    setFormMaxQty('');
    setFormBuyQty(2);
    setFormFreeQty(1);
    setFormMinBillAmount(1000);
    setFormBillDiscountType('flat');
    setFormBillDiscountValue(50);
    setFormStartDate('');
    setFormEndDate('');
    setFormDaysOfWeek([]);
    setFormHasTimeLimit(false);
    setFormStartTime('14:00');
    setFormEndTime('18:00');
    setFormPriority(10);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setFormName(scheme.name);
    setFormCode(scheme.code || '');
    setFormDescription(scheme.description || '');
    setFormChannel(scheme.appliesToSaleType || 'all');
    setFormStatus(scheme.status || 'active');
    setFormTargetType(scheme.targetType || 'all_items');
    setFormTargetValues(scheme.targetValues || []);
    setItemSearchText('');
    setBrandInputText('');
    setFormSchemeType(scheme.schemeType || 'percent_discount');
    setFormDiscountValue(scheme.discountValue !== undefined ? scheme.discountValue : 10);
    setFormSpecialRate(scheme.specialRate !== undefined ? scheme.specialRate : '');
    setFormMinQty(scheme.minQty !== undefined ? scheme.minQty : '');
    setFormMaxQty(scheme.maxQty !== undefined ? scheme.maxQty : '');
    setFormBuyQty(scheme.buyQty !== undefined ? scheme.buyQty : 2);
    setFormFreeQty(scheme.freeQty !== undefined ? scheme.freeQty : 1);
    setFormMinBillAmount(scheme.minBillAmount !== undefined ? scheme.minBillAmount : 1000);
    setFormBillDiscountType(scheme.billDiscountType || 'flat');
    setFormBillDiscountValue(scheme.billDiscountValue !== undefined ? scheme.billDiscountValue : 50);
    setFormStartDate(scheme.startDate || '');
    setFormEndDate(scheme.endDate || '');
    setFormDaysOfWeek(scheme.daysOfWeek || []);
    setFormHasTimeLimit(Boolean(scheme.hasTimeLimit));
    setFormStartTime(scheme.startTime || '14:00');
    setFormEndTime(scheme.endTime || '18:00');
    setFormPriority(scheme.priority || 10);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveScheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Scheme Name is required.');
      return;
    }

    if (formTargetType !== 'all_items' && formTargetValues.length === 0) {
      setFormError(`Please select at least one target for "${formTargetType.replace('_', ' ')}".`);
      return;
    }

    if (formSchemeType === 'percent_discount' && (formDiscountValue === '' || Number(formDiscountValue) <= 0)) {
      setFormError('Please enter a valid discount percentage greater than 0.');
      return;
    }

    if (formSchemeType === 'flat_discount' && (formDiscountValue === '' || Number(formDiscountValue) <= 0)) {
      setFormError('Please enter a valid flat discount amount.');
      return;
    }

    if (formSchemeType === 'special_rate' && (formSpecialRate === '' || Number(formSpecialRate) <= 0)) {
      setFormError('Please enter a valid special promotional rate.');
      return;
    }

    if (formSchemeType === 'bogo' && (Number(formBuyQty) <= 0 || Number(formFreeQty) <= 0)) {
      setFormError('Buy quantity and Free quantity must be greater than 0.');
      return;
    }

    if (formSchemeType === 'bill_discount' && (Number(formMinBillAmount) <= 0 || Number(formBillDiscountValue) <= 0)) {
      setFormError('Minimum bill amount and bill discount value must be greater than 0.');
      return;
    }

    const payload: Scheme = {
      id: editingScheme?.id || `scheme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: formName.trim(),
      code: formCode.trim().toUpperCase() || undefined,
      description: formDescription.trim() || undefined,
      status: formStatus,
      appliesToSaleType: formChannel,
      targetType: formTargetType,
      targetValues: formTargetType === 'all_items' ? [] : formTargetValues,
      schemeType: formSchemeType,
      discountValue: (formSchemeType === 'percent_discount' || formSchemeType === 'flat_discount')
        ? Number(formDiscountValue)
        : undefined,
      specialRate: formSchemeType === 'special_rate' ? Number(formSpecialRate) : undefined,
      minQty: formMinQty !== '' ? Number(formMinQty) : undefined,
      maxQty: formMaxQty !== '' ? Number(formMaxQty) : undefined,
      buyQty: formSchemeType === 'bogo' ? Number(formBuyQty) : undefined,
      freeQty: formSchemeType === 'bogo' ? Number(formFreeQty) : undefined,
      minBillAmount: formSchemeType === 'bill_discount' ? Number(formMinBillAmount) : undefined,
      billDiscountType: formSchemeType === 'bill_discount' ? formBillDiscountType : undefined,
      billDiscountValue: formSchemeType === 'bill_discount' ? Number(formBillDiscountValue) : undefined,
      startDate: formStartDate || undefined,
      endDate: formEndDate || undefined,
      daysOfWeek: formDaysOfWeek.length > 0 ? formDaysOfWeek : undefined,
      hasTimeLimit: formHasTimeLimit,
      startTime: formHasTimeLimit ? formStartTime : undefined,
      endTime: formHasTimeLimit ? formEndTime : undefined,
      priority: Number(formPriority) || 10
    };

    const res = saveScheme(payload);
    if (res.ok) {
      loadAllSchemes();
      setIsModalOpen(false);
    } else {
      setFormError(res.error || 'Failed to save scheme.');
    }
  };

  const handleToggleStatus = (schemeId: string) => {
    toggleSchemeStatus(schemeId);
    loadAllSchemes();
  };

  const handleDelete = (schemeId: string) => {
    deleteScheme(schemeId);
    setConfirmDeleteId(null);
    loadAllSchemes();
  };

  const handleDuplicate = (scheme: Scheme) => {
    const clone: Scheme = {
      ...scheme,
      id: `scheme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${scheme.name} (Copy)`,
      code: scheme.code ? `${scheme.code}_COPY` : undefined,
      status: 'inactive'
    };
    saveScheme(clone);
    loadAllSchemes();
  };

  const toggleTargetValue = (val: string) => {
    setFormTargetValues(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setFormDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 text-slate-800">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shrink-0 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Schemes & Promotions</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  POS & B2B
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Manage automated discounts, happy hours, festival offers, and volume slab schemes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Scheme</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* KPI Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Total Schemes</span>
            <span className="font-black text-slate-800 text-sm">{stats.total}</span>
          </div>
          <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200 flex items-center justify-between">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live Now
            </span>
            <span className="font-black text-emerald-800 text-sm">{stats.liveNow}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Active (Configured)</span>
            <span className="font-black text-slate-800 text-sm">{stats.active}</span>
          </div>
          <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-200 flex items-center justify-between">
            <span className="text-indigo-700 font-medium flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> POS Eligible
            </span>
            <span className="font-black text-indigo-800 text-sm">{stats.posCount}</span>
          </div>
          <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-200 flex items-center justify-between">
            <span className="text-blue-700 font-medium flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" /> B2B Eligible
            </span>
            <span className="font-black text-blue-800 text-sm">{stats.b2bCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search schemes by name, code, target or brand..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="paused">Paused Only</option>
          </select>

          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value as any)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="both">Both POS & B2B</option>
            <option value="pos_only">POS Only</option>
            <option value="b2b_only">B2B Only</option>
          </select>

          {/* Target Filter */}
          <select
            value={targetFilter}
            onChange={e => setTargetFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:border-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Target Scopes</option>
            <option value="all_items">Storewide (All Items)</option>
            <option value="item">By Product</option>
            <option value="item_group">By Item Group</option>
            <option value="item_category">By Category</option>
            <option value="brand">By Brand</option>
          </select>
        </div>
      </div>

      {/* Main Schemes List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredSchemes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Tag className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Schemes Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery || statusFilter !== 'all' || channelFilter !== 'all' || targetFilter !== 'all'
                ? 'No schemes match your current search or filter criteria. Try clearing filters.'
                : 'You have not created any promotional schemes yet. Click the button below to add your first promotion.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Scheme</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSchemes.map(scheme => {
              const now = new Date();
              const posActive = isSchemeActiveNow(scheme, 'pos', now);
              const b2bActive = isSchemeActiveNow(scheme, 'b2b', now);
              const isLive = posActive.active || b2bActive.active;

              return (
                <div
                  key={scheme.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden shadow-2xs hover:shadow-md ${
                    scheme.status === 'active'
                      ? isLive
                        ? 'border-emerald-300 ring-1 ring-emerald-200/50'
                        : 'border-slate-200'
                      : 'border-slate-200 opacity-75 bg-slate-50/50'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {/* Live Status Badge */}
                        {scheme.status === 'active' ? (
                          isLive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE NOW
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                              title={posActive.reason || b2bActive.reason}
                            >
                              <Clock className="h-3 w-3" /> Scheduled / Off-Hours
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Power className="h-3 w-3" /> Paused
                          </span>
                        )}

                        {/* Channel Badge */}
                        {scheme.appliesToSaleType === 'pos_only' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <ShoppingCart className="h-3 w-3" /> POS Only
                          </span>
                        )}
                        {scheme.appliesToSaleType === 'b2b_only' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <ShoppingBag className="h-3 w-3" /> B2B Only
                          </span>
                        )}
                        {scheme.appliesToSaleType === 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            POS & B2B
                          </span>
                        )}

                        {scheme.code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-slate-100 text-slate-700">
                            {scheme.code}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-900 truncate" title={scheme.name}>
                        {scheme.name}
                      </h3>
                      {scheme.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={scheme.description}>
                          {scheme.description}
                        </p>
                      )}
                    </div>

                    {/* Quick Active Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(scheme.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        scheme.status === 'active' ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                      title={scheme.status === 'active' ? 'Click to Pause scheme' : 'Click to Activate scheme'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          scheme.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Card Body - Scope & Benefit */}
                  <div className="p-4 py-3 flex-1 flex flex-col justify-between gap-3 text-xs">
                    {/* Benefit Highlighting */}
                    <div className="bg-indigo-50/50 rounded-xl p-2.5 border border-indigo-100">
                      <div className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-600 mb-0.5">
                        Customer Benefit
                      </div>
                      <div className="font-extrabold text-sm text-indigo-950 flex items-center gap-1.5">
                        {scheme.schemeType === 'percent_discount' && (
                          <>
                            <Percent className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>{scheme.discountValue}% Discount on Item Rate</span>
                          </>
                        )}
                        {scheme.schemeType === 'flat_discount' && (
                          <>
                            <Tag className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>Flat {currency} {Number(scheme.discountValue).toFixed(2)} Off per piece</span>
                          </>
                        )}
                        {scheme.schemeType === 'special_rate' && (
                          <>
                            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>Special Promo Price: {currency} {Number(scheme.specialRate).toFixed(2)}</span>
                          </>
                        )}
                        {scheme.schemeType === 'bogo' && (
                          <>
                            <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>Buy {scheme.buyQty} Get {scheme.freeQty} Free</span>
                          </>
                        )}
                        {scheme.schemeType === 'bill_discount' && (
                          <>
                            <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span>
                              Spend {currency} {scheme.minBillAmount}+ get{' '}
                              {scheme.billDiscountType === 'percent'
                                ? `${scheme.billDiscountValue}% Off`
                                : `${currency} ${scheme.billDiscountValue} Off Entire Bill`}
                            </span>
                          </>
                        )}
                      </div>
                      {scheme.minQty && (
                        <div className="text-[11px] text-indigo-700 mt-1">
                          • Requires min purchase of <strong>{scheme.minQty} units</strong>
                        </div>
                      )}
                    </div>

                    {/* Target Scope */}
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                        Applicable Target
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold capitalize">
                          {scheme.targetType === 'all_items' && 'Storewide (All Items)'}
                          {scheme.targetType === 'item_group' && `Group: ${scheme.targetValues.join(', ')}`}
                          {scheme.targetType === 'item_category' && `Category: ${scheme.targetValues.join(', ')}`}
                          {scheme.targetType === 'brand' && `Brand: ${scheme.targetValues.join(', ')}`}
                          {scheme.targetType === 'item' && `${scheme.targetValues.length} Selected Product(s)`}
                        </span>
                      </div>
                    </div>

                    {/* Schedule & Timing */}
                    <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3 w-3" /> Validity:
                        </span>
                        <span className="font-medium text-slate-800">
                          {scheme.startDate || scheme.endDate
                            ? `${scheme.startDate || 'Start'} to ${scheme.endDate || 'Ongoing'}`
                            : 'Continuous (No Expiry)'}
                        </span>
                      </div>

                      {scheme.daysOfWeek && scheme.daysOfWeek.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Days:</span>
                          <span className="font-semibold text-slate-800">
                            {scheme.daysOfWeek.map(d => DAYS_OF_WEEK[d]?.label).join(', ')}
                          </span>
                        </div>
                      )}

                      {scheme.hasTimeLimit && scheme.startTime && scheme.endTime && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3" /> Hours:
                          </span>
                          <span className="font-semibold text-indigo-700">
                            {scheme.startTime} – {scheme.endTime} (Happy Hour)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">
                      Priority: {scheme.priority || 10}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicate(scheme)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Duplicate / Clone Scheme"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(scheme)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                        title="Edit Scheme"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === scheme.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-200">
                          <button
                            onClick={() => handleDelete(scheme.id)}
                            className="px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-600 text-white rounded hover:bg-rose-700 cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(scheme.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Scheme"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Scheme Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingScheme ? 'Edit Promotional Scheme' : 'Create New Promotional Scheme'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configure automated discount rules, schedule, and applicable sales channels
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveScheme} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Basic Info & Channel */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">1</span>
                  <span>Scheme Details & Sales Channel</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Scheme Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Weekend Festive 10% Off, Happy Hour Beverages"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Short Code / Coupon
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. WKND10"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold uppercase focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Description / Terms (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Short note shown on receipt or cashier tooltip"
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Applicable Sales Channel Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Applicable Sales Channel <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormChannel('all')}
                      className={`px-3 py-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        formChannel === 'all'
                          ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs">🌐 Both POS & B2B</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Applies storewide & invoice</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormChannel('pos_only')}
                      className={`px-3 py-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        formChannel === 'pos_only'
                          ? 'border-purple-600 bg-purple-50/80 text-purple-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs">🛍️ POS Billing Only</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Walk-in retail counter only</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormChannel('b2b_only')}
                      className={`px-3 py-2 rounded-xl border text-center font-bold transition cursor-pointer ${
                        formChannel === 'b2b_only'
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs">🏢 B2B Sales Only</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Wholesale / sales invoices</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Target Scope */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">2</span>
                  <span>Target Scope (Where does this scheme apply?)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'all_items', label: 'Storewide (All)' },
                    { id: 'item_group', label: 'By Item Group' },
                    { id: 'item_category', label: 'By Category' },
                    { id: 'brand', label: 'By Brand' },
                    { id: 'item', label: 'Specific Items' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setFormTargetType(t.id as any);
                        if (t.id === 'all_items') setFormTargetValues([]);
                      }}
                      className={`py-2 px-1 text-center font-bold rounded-lg border transition cursor-pointer ${
                        formTargetType === t.id
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sub-selectors based on target */}
                {formTargetType === 'item_group' && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Select Item Groups ({formTargetValues.length} selected):
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {itemGroups.map(g => {
                        const sel = formTargetValues.includes(g['Group Name']);
                        return (
                          <button
                            key={g['Group Name']}
                            type="button"
                            onClick={() => toggleTargetValue(g['Group Name'])}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                              sel
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {sel && '✓ '}
                            {g['Group Name']}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formTargetType === 'item_category' && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Select Categories ({formTargetValues.length} selected):
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {itemCategories.map(c => {
                        const sel = formTargetValues.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleTargetValue(c)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                              sel
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {sel && '✓ '}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formTargetType === 'brand' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-700">
                      Select or Add Brand Name ({formTargetValues.length} selected):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type brand name and click Add (e.g. Nestlé, Samsung)..."
                        value={brandInputText}
                        onChange={e => setBrandInputText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (brandInputText.trim() && !formTargetValues.includes(brandInputText.trim())) {
                              setFormTargetValues([...formTargetValues, brandInputText.trim()]);
                              setBrandInputText('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (brandInputText.trim() && !formTargetValues.includes(brandInputText.trim())) {
                            setFormTargetValues([...formTargetValues, brandInputText.trim()]);
                            setBrandInputText('');
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {Array.from(new Set([...availableBrands, ...formTargetValues])).map(b => {
                        const sel = formTargetValues.includes(b);
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => toggleTargetValue(b)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                              sel
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {sel && '✓ '}
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formTargetType === 'item' && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-700">
                      Search & Select Products ({formTargetValues.length} selected):
                    </label>
                    <input
                      type="text"
                      placeholder="Search items by code or name..."
                      value={itemSearchText}
                      onChange={e => setItemSearchText(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white outline-none"
                    />

                    {/* Selected items chips */}
                    {formTargetValues.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-indigo-50/50 rounded-lg border border-indigo-100">
                        {formTargetValues.map(code => {
                          const it = items.find(i => i['Item Code'] === code);
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200"
                            >
                              <span>{it ? it['Item Name'] : code}</span>
                              <button
                                type="button"
                                onClick={() => toggleTargetValue(code)}
                                className="hover:text-rose-600 font-bold ml-0.5"
                              >
                                ✕
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Item list */}
                    <div className="max-h-40 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {items
                        .filter(i => {
                          if (!itemSearchText) return true;
                          const q = itemSearchText.toLowerCase();
                          return i['Item Name'].toLowerCase().includes(q) || i['Item Code'].toLowerCase().includes(q);
                        })
                        .slice(0, 50)
                        .map(i => {
                          const sel = formTargetValues.includes(i['Item Code']);
                          return (
                            <div
                              key={i['Item Code']}
                              onClick={() => toggleTargetValue(i['Item Code'])}
                              className={`p-1.5 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 ${
                                sel ? 'bg-indigo-50/60 font-bold text-indigo-900' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <span className="font-mono text-[10px] text-slate-500 mr-2">[{i['Item Code']}]</span>
                                <span>{i['Item Name']}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-[10px]">{currency} {i['Sale Rate']}</span>
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => {}}
                                  className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-0"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Benefit & Discount Rule */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">3</span>
                  <span>Discount & Scheme Benefit</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'percent_discount', label: '% Discount' },
                    { id: 'flat_discount', label: 'Flat Nu. Off' },
                    { id: 'special_rate', label: 'Special Rate' },
                    { id: 'bogo', label: 'Buy X Get Y' },
                    { id: 'bill_discount', label: 'Bill Spend' }
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setFormSchemeType(b.id as any)}
                      className={`py-2 px-1 text-center font-bold rounded-lg border transition cursor-pointer ${
                        formSchemeType === b.id
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Specific Inputs based on Benefit */}
                {formSchemeType === 'percent_discount' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Discount Percentage (%) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="100"
                          placeholder="e.g. 10"
                          value={formDiscountValue}
                          onChange={e => setFormDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                        />
                        <span className="absolute right-3 top-2 font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Minimum Quantity Required (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 2 units to qualify"
                        value={formMinQty}
                        onChange={e => setFormMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {formSchemeType === 'flat_discount' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Flat Discount Amount per unit ({currency}) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="e.g. 20"
                          value={formDiscountValue}
                          onChange={e => setFormDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                        />
                        <span className="absolute right-3 top-2 font-bold text-slate-400">{currency}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Minimum Quantity Required (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 3"
                        value={formMinQty}
                        onChange={e => setFormMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {formSchemeType === 'special_rate' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Special Promo Rate ({currency}) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="e.g. 99"
                          value={formSpecialRate}
                          onChange={e => setFormSpecialRate(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                        />
                        <span className="absolute right-3 top-2 font-bold text-slate-400">{currency}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Minimum Quantity Required (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1"
                        value={formMinQty}
                        onChange={e => setFormMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {formSchemeType === 'bogo' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Buy Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 2"
                        value={formBuyQty}
                        onChange={e => setFormBuyQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Get Free Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1"
                        value={formFreeQty}
                        onChange={e => setFormFreeQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {formSchemeType === 'bill_discount' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Min. Bill Amount ({currency}) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="e.g. 2000"
                        value={formMinBillAmount}
                        onChange={e => setFormMinBillAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={formBillDiscountType}
                        onChange={e => setFormBillDiscountType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium focus:border-indigo-500 outline-none"
                      >
                        <option value="flat">Flat Amount ({currency})</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Discount Value <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="e.g. 100"
                        value={formBillDiscountValue}
                        onChange={e => setFormBillDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Schedule & Timing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">4</span>
                  <span>Validity, Days of Week & Time Restrictions</span>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={e => setFormEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-700">
                      Applicable Days of Week ({formDaysOfWeek.length === 0 ? 'Everyday' : `${formDaysOfWeek.length} days selected`})
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFormDaysOfWeek([])}
                        className="text-[10px] text-indigo-600 hover:underline font-bold"
                      >
                        Everyday
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setFormDaysOfWeek([1, 2, 3, 4, 5])}
                        className="text-[10px] text-indigo-600 hover:underline font-bold"
                      >
                        Mon–Fri
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setFormDaysOfWeek([0, 6])}
                        className="text-[10px] text-indigo-600 hover:underline font-bold"
                      >
                        Weekends
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_WEEK.map(d => {
                      const sel = formDaysOfWeek.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => toggleDayOfWeek(d.day)}
                          className={`py-1.5 text-center font-bold rounded-lg border text-xs transition cursor-pointer ${
                            sel
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Happy Hours / Time of Day */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-slate-800">Time-Restricted Scheme (Happy Hours)</span>
                      <p className="text-[10px] text-slate-500">Only trigger discount during specific hours of the day</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formHasTimeLimit}
                      onChange={e => setFormHasTimeLimit(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded focus:ring-0 cursor-pointer"
                    />
                  </div>

                  {formHasTimeLimit && (
                    <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-lg border border-slate-200 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Start Time (24h)
                        </label>
                        <input
                          type="time"
                          value={formStartTime}
                          onChange={e => setFormStartTime(e.target.value)}
                          className="w-full px-2.5 py-1 rounded border border-slate-300 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          End Time (24h)
                        </label>
                        <input
                          type="time"
                          value={formEndTime}
                          onChange={e => setFormEndTime(e.target.value)}
                          className="w-full px-2.5 py-1 rounded border border-slate-300 font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Conflict Priority (Higher = Wins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formPriority}
                    onChange={e => setFormPriority(Number(e.target.value) || 10)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                  >
                    <option value="active">Active (Ready to run)</option>
                    <option value="inactive">Paused (Draft / Inactive)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  {editingScheme ? 'Update Scheme' : 'Create Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
