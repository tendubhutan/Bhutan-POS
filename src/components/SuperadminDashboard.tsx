import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Power,
  PowerOff,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Sliders,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  MapPin,
  FileText,
  Sparkles,
  Lock,
  ArrowRight,
  Bot,
  CheckSquare,
  Square,
  Layers,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  SupabaseCompany, 
  fetchUserCompanies, 
  updateCompanyStatus, 
  createCompany, 
  setActiveCompanyId,
  getCompanyDedicatedUrl,
  DEFAULT_TENANT_COMPANY
} from '../services/supabaseTenantService';
import { 
  getCurrentTenantSession, 
  isSuperAdmin as checkIsSuperAdmin 
} from '../services/authTenantContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AppUser } from '../types';
import { 
  ALL_SYSTEM_FEATURES, 
  FEATURE_PRESETS, 
  FeaturePreset,
  FeatureDefinition,
  getCompanyConfig, 
  saveCompanyFeatures 
} from '../services/tenantFeatureService';

interface SuperadminDashboardProps {
  currentUser?: AppUser;
  onNavigate?: (view: string) => void;
  onSwitchCompany?: (company: SupabaseCompany) => void;
}

const RECOMMENDED_TENANT_QUOTA = 50;
const PLAN_PRICE_PER_TENANT_USD = 25;

export const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({
  currentUser,
  onNavigate,
  onSwitchCompany
}) => {
  const [companies, setCompanies] = useState<SupabaseCompany[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Company Modal & Feature Configuration
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCompanyActiveTab, setNewCompanyActiveTab] = useState<'details' | 'features'>('details');
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newTradeLicense, setNewTradeLicense] = useState<string>('');
  const [newTaxId, setNewTaxId] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newCurrency, setNewCurrency] = useState<string>('Nu.');
  const [newAdminUsername, setNewAdminUsername] = useState<string>('admin');
  const [newAdminPin, setNewAdminPin] = useState<string>('1234');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Company Feature Checklist & Preset state
  const [newSelectedPresetId, setNewSelectedPresetId] = useState<string | null>('retail');
  const [newFeatures, setNewFeatures] = useState<Record<string, boolean>>(() => {
    const retailPreset = FEATURE_PRESETS.find(p => p.id === 'retail');
    return retailPreset ? { ...retailPreset.features } : {};
  });

  // Feature Management for Existing Company
  const [managingCompany, setManagingCompany] = useState<SupabaseCompany | null>(null);
  const [editingFeatures, setEditingFeatures] = useState<Record<string, boolean>>({});
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isSavingFeatures, setIsSavingFeatures] = useState<boolean>(false);

  // Verify superadmin access
  const session = getCurrentTenantSession();
  const rawRole = (
    session?.role || 
    currentUser?.role || 
    (typeof localStorage !== 'undefined' ? (
      localStorage.getItem('deep_pos_auth_role') ||
      localStorage.getItem('supabase_active_role') ||
      localStorage.getItem('user_role') ||
      localStorage.getItem('role') ||
      ''
    ) : '')
  ).toString().toLowerCase().trim();

  const isSuperadminUser = 
    checkIsSuperAdmin() || 
    session?.isSuperadmin === true || 
    rawRole === 'superadmin';

  // Load companies directly from Supabase / master list
  const loadMasterCompanies = async () => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      // 1. Try querying Supabase directly for real-time table state
      if (isSupabaseConfigured) {
        try {
          const { data: sbComps, error: sbErr } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

          if (sbComps && sbComps.length > 0 && !sbErr) {
            // Ensure default company exists in list
            const hasDefault = sbComps.some(c => c.id === DEFAULT_TENANT_COMPANY.id);
            const list = hasDefault ? sbComps : [DEFAULT_TENANT_COMPANY, ...sbComps];
            setCompanies(list);
            setIsLoading(false);
            return;
          }
        } catch (sbEx) {
          console.warn('Direct Supabase fetch fallback in SuperadminDashboard:', sbEx);
        }
      }

      // 2. Fallback to master service
      const { companies: list } = await fetchUserCompanies(true);
      setCompanies(list);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to load companies' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadminUser) {
      loadMasterCompanies();
    }
  }, [isSuperadminUser]);

  // Subscription Toggle Handler
  const handleToggleStatus = async (company: SupabaseCompany) => {
    const currentActive = company.is_active !== false; // defaults to true if undefined
    const nextActive = !currentActive;

    setTogglingId(company.id);
    try {
      const res = await updateCompanyStatus(company.id, nextActive);
      if (res.success) {
        setCompanies(prev =>
          prev.map(c => (c.id === company.id ? { ...c, is_active: nextActive } : c))
        );
        setFeedbackMsg({
          type: 'success',
          text: `Updated "${company.company_name}" status to ${nextActive ? 'Active (Subscribed)' : 'Suspended (Locked Out)'}.`
        });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update subscription status' });
      }
    } catch (e: any) {
      setFeedbackMsg({ type: 'error', text: e?.message || 'Error updating status' });
    } finally {
      setTogglingId(null);
    }
  };

  // Copy Client Dedicated URL
  const handleCopyPortalUrl = (cId: string) => {
    const url = getCompanyDedicatedUrl(cId, true);
    navigator.clipboard.writeText(url);
    setCopiedId(cId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Switch workspace to selected company
  const handleEnterClientWorkspace = (company: SupabaseCompany) => {
    setActiveCompanyId(company.id);
    if (onSwitchCompany) {
      onSwitchCompany(company);
    }
    if (onNavigate) {
      onNavigate('dashboard');
    }
  };

  // Open features modal for existing company
  const handleOpenFeaturesModal = (company: SupabaseCompany) => {
    const currentCfg = getCompanyConfig(company.id);
    const initialMap: Record<string, boolean> = {};
    ALL_SYSTEM_FEATURES.forEach(f => {
      if (currentCfg.superadminFeatures && currentCfg.superadminFeatures[f.id] !== undefined) {
        initialMap[f.id] = currentCfg.superadminFeatures[f.id] === true;
      } else {
        const val = (currentCfg as any)[f.id];
        if (f.id === 'EnableSpareParts' || f.id === 'EnableGarmentsAndFootwear' || f.id === 'EnableBillDiscount' || f.id === 'EnableAdvancedAI' || f.id === 'EnableGSTInputTax') {
          initialMap[f.id] = val === 'true';
        } else {
          initialMap[f.id] = val !== 'false';
        }
      }
    });

    const matchingPreset = FEATURE_PRESETS.find(p => {
      return Object.entries(p.features).every(([key, val]) => initialMap[key] === val);
    });

    setEditingFeatures(initialMap);
    setEditingPresetId(matchingPreset ? matchingPreset.id : null);
    setManagingCompany(company);
  };

  // Save features for existing company
  const handleSaveExistingFeatures = () => {
    if (!managingCompany) return;
    setIsSavingFeatures(true);
    try {
      saveCompanyFeatures(managingCompany.id, editingFeatures);
      setFeedbackMsg({
        type: 'success',
        text: `Features and permissions for "${managingCompany.company_name}" have been updated successfully and applied immediately.`
      });
      setManagingCompany(null);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Failed to update company features'
      });
    } finally {
      setIsSavingFeatures(false);
    }
  };

  // Preset apply helper
  const handleApplyPreset = (preset: FeaturePreset, target: 'new' | 'edit') => {
    if (target === 'new') {
      setNewFeatures({ ...preset.features });
      setNewSelectedPresetId(preset.id);
    } else {
      setEditingFeatures({ ...preset.features });
      setEditingPresetId(preset.id);
    }
  };

  // Toggle individual feature
  const handleToggleFeature = (featureId: string, target: 'new' | 'edit') => {
    if (target === 'new') {
      setNewFeatures(prev => ({
        ...prev,
        [featureId]: !prev[featureId]
      }));
      setNewSelectedPresetId(null);
    } else {
      setEditingFeatures(prev => ({
        ...prev,
        [featureId]: !prev[featureId]
      }));
      setEditingPresetId(null);
    }
  };

  // Select/Deselect All
  const handleSetAllFeatures = (enable: boolean, target: 'new' | 'edit') => {
    const nextMap: Record<string, boolean> = {};
    ALL_SYSTEM_FEATURES.forEach(f => {
      nextMap[f.id] = enable;
    });
    if (target === 'new') {
      setNewFeatures(nextMap);
      setNewSelectedPresetId(enable ? 'enterprise' : null);
    } else {
      setEditingFeatures(nextMap);
      setEditingPresetId(enable ? 'enterprise' : null);
    }
  };

  // Create New Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      setNewCompanyActiveTab('details');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCompany({
        company_name: newCompanyName.trim(),
        trade_license_no: newTradeLicense.trim() || undefined,
        tax_payer_id: newTaxId.trim() || undefined,
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        address: newAddress.trim() || undefined,
        currency_symbol: newCurrency.trim() || 'Nu.',
        admin_username: newAdminUsername.trim() || 'admin',
        admin_name: `${newCompanyName.trim()} Administrator`,
        admin_pin: newAdminPin.trim() || '1234',
        is_active: true,
        initialFeatures: newFeatures
      });

      if (res.company) {
        setFeedbackMsg({
          type: 'success',
          text: `Successfully provisioned client workspace "${res.company.company_name}" with configured features.`
        });
        setShowAddModal(false);
        // Reset form
        setNewCompanyName('');
        setNewTradeLicense('');
        setNewTaxId('');
        setNewEmail('');
        setNewPhone('');
        setNewAddress('');
        const retailPreset = FEATURE_PRESETS.find(p => p.id === 'retail');
        setNewFeatures(retailPreset ? { ...retailPreset.features } : {});
        setNewSelectedPresetId('retail');
        setNewCompanyActiveTab('details');
        await loadMasterCompanies();
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to create company' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to provision company' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculated Metrics
  const totalTenants = companies.length;
  const activeTenants = companies.filter(c => c.is_active !== false).length;
  const inactiveTenants = totalTenants - activeTenants;
  const estimatedMRR = activeTenants * PLAN_PRICE_PER_TENANT_USD;
  const quotaPercent = Math.min(100, Math.round((totalTenants / RECOMMENDED_TENANT_QUOTA) * 100));

  // Filtered List
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const isActive = c.is_active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.company_name?.toLowerCase().includes(q) ||
        c.trade_license_no?.toLowerCase().includes(q) ||
        c.tax_payer_id?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.id?.toLowerCase().includes(q)
      );
    });
  }, [companies, searchQuery, statusFilter]);

  // Render feature configuration & presets checklist
  const renderFeatureChecklist = (
    features: Record<string, boolean>,
    activePresetId: string | null,
    target: 'new' | 'edit'
  ) => {
    const totalActive = ALL_SYSTEM_FEATURES.filter(f => features[f.id] === true).length;
    const categories: Array<'Billing & POS' | 'Inventory & Variants' | 'Taxation & Accounts' | 'HR, Assets & Modules'> = [
      'Billing & POS',
      'Inventory & Variants',
      'Taxation & Accounts',
      'HR, Assets & Modules'
    ];

    return (
      <div className="space-y-4">
        {/* Preset Bot Row */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-white text-xs block">Industry Preset Bot (One-Click Auto Setup)</span>
                <p className="text-[10px] text-slate-400">
                  Select an industry template to auto-toggle features. You can still customize any feature on/off below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                {totalActive} / {ALL_SYSTEM_FEATURES.length} Modules Active
              </span>
              <button
                type="button"
                onClick={() => handleSetAllFeatures(true, target)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold border border-slate-700 transition cursor-pointer"
              >
                All ON
              </button>
              <button
                type="button"
                onClick={() => handleSetAllFeatures(false, target)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-bold border border-slate-700 transition cursor-pointer"
              >
                All OFF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {FEATURE_PRESETS.map(preset => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset, target)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/25 border-indigo-400 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-400/80'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold truncate">{preset.badge}</span>
                    {isSelected && (
                      <span className="px-1 py-0.2 bg-indigo-500 text-[9px] font-mono text-white rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categorized Feature Checklist */}
        <div className="space-y-3.5">
          {categories.map(category => {
            const categoryFeatures = ALL_SYSTEM_FEATURES.filter(f => f.category === category);
            const activeInCategory = categoryFeatures.filter(f => features[f.id] === true).length;
            return (
              <div key={category} className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{category}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {activeInCategory} / {categoryFeatures.length} Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryFeatures.map(feat => {
                    const isEnabled = features[feat.id] === true;
                    return (
                      <div
                        key={feat.id}
                        onClick={() => handleToggleFeature(feat.id as string, target)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 select-none ${
                          isEnabled
                            ? 'bg-slate-900/90 border-indigo-500/40 hover:border-indigo-400'
                            : 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                              {feat.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{feat.shortDesc}</p>
                        </div>
                        <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1">
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                              isEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                isEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                          <span className={`text-[9px] font-bold ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {isEnabled ? 'ON' : 'HIDDEN'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // RESTRICTED ACCESS SCREEN FOR NON-SUPERADMINS
  if (!isSuperadminUser) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="h-20 w-20 rounded-3xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 mb-5 shadow-2xl shadow-rose-900/30">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">
          Restricted Access Area
        </h2>
        <p className="text-slate-400 max-w-md text-sm mb-6 leading-relaxed">
          The Superadmin Tenant Control Panel is strictly restricted to platform administrators with superadmin privileges in the <code className="text-rose-300 font-mono text-xs">company_users</code> registry.
        </p>
        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center gap-2"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200 text-slate-100">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/70 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-mono font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>SUPERADMIN ACCESS RESTRICTED</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px] font-bold font-mono">
              Live RLS Sync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Tenant Control Panel</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Master multi-tenant registry, commercial subscription status, and tenant isolation controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadMasterCompanies}
            disabled={isLoading}
            className="py-2.5 px-3.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Refresh tenants list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Provision Client Tenant</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards & Plan Quota Tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tenants */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tenants</span>
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalTenants}</span>
            <span className="text-[11px] text-slate-400 font-medium">Registered Companies</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-mono">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>Isolated PostgreSQL RLS</span>
          </div>
        </div>

        {/* Card 2: Active Subscriptions */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Subscriptions</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">{activeTenants}</span>
            <span className="text-[11px] text-slate-400 font-medium">Unlocked Clients</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{inactiveTenants} Suspended / Locked Out</span>
          </div>
        </div>

        {/* Card 3: Estimated MRR */}
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated MRR</span>
            <DollarSign className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-indigo-400">${estimatedMRR}</span>
            <span className="text-[11px] text-slate-400 font-medium">USD / Month</span>
          </div>
          <div className="mt-2 text-[10px] text-indigo-300/80 font-mono">
            ${PLAN_PRICE_PER_TENANT_USD}/mo per active client tier
          </div>
        </div>

        {/* Card 4: Plan Limits Tracker ($25/mo Quota) */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between text-slate-300 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Plan Limits Tracker</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-400">
              {totalTenants}/{RECOMMENDED_TENANT_QUOTA}
            </span>
          </div>
          
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
              <span>Tenant Quota Usage</span>
              <span className="text-white font-bold">{quotaPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Quota: {RECOMMENDED_TENANT_QUOTA} Recommended</span>
            <span className="text-emerald-400 font-bold">Good Capacity</span>
          </div>
        </div>
      </div>

      {/* Main Client Overview Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        {/* Table Filters & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="relative w-full md:w-80">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, license, email, ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start md:self-auto w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              All Clients ({totalTenants})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Active ({activeTenants})</span>
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'inactive'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Suspended ({inactiveTenants})</span>
            </button>
          </div>
        </div>

        {/* Client Master Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Commercial Client</th>
                <th className="py-3 px-3">License & Tax ID</th>
                <th className="py-3 px-3">Contact Details</th>
                <th className="py-3 px-3">Commercial Plan</th>
                <th className="py-3 px-3 text-center">Account Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                      <span>Fetching client database records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="h-8 w-8 text-slate-600" />
                      <span className="font-bold text-white text-sm">No clients matched your filter</span>
                      <span className="text-xs text-slate-500">Try adjusting your search criteria or register a new company.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(company => {
                  const isActive = company.is_active !== false;
                  const isToggling = togglingId === company.id;

                  return (
                    <tr
                      key={company.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Column 1: Client Name & UUID */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isActive
                              ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400'
                              : 'bg-rose-600/20 border border-rose-500/40 text-rose-400'
                          }`}>
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                              <span>{company.company_name}</span>
                              {company.id === DEFAULT_TENANT_COMPANY.id && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span className="truncate max-w-[140px] sm:max-w-[200px]" title={company.id}>
                                ID: {company.id}
                              </span>
                              <button
                                onClick={() => handleCopyPortalUrl(company.id)}
                                className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
                                title="Copy client portal URL"
                              >
                                {copiedId === company.id ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: License & TPN */}
                      <td className="py-3.5 px-3 font-mono text-[11px]">
                        <div className="text-slate-200">
                          <span className="text-slate-500 text-[10px] block">Trade License:</span>
                          {company.trade_license_no || '—'}
                        </div>
                        {company.tax_payer_id && (
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            <span className="text-slate-500">TPN: </span>
                            {company.tax_payer_id}
                          </div>
                        )}
                      </td>

                      {/* Column 3: Contact */}
                      <td className="py-3.5 px-3 text-[11px] text-slate-300">
                        {company.email ? (
                          <div className="flex items-center gap-1 text-slate-300">
                            <Mail className="h-3 w-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[150px]">{company.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                            <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                            <span>{company.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Plan */}
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-[11px] font-medium font-mono">
                          <CreditCard className="h-3 w-3 text-indigo-400" />
                          <span>${PLAN_PRICE_PER_TENANT_USD}/mo Commercial</span>
                        </span>
                      </td>

                      {/* Column 5: Live Subscription Switch (Lock/Unlock) */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(company)}
                            disabled={isToggling}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              isActive ? 'bg-emerald-600' : 'bg-slate-700'
                            }`}
                            title={isActive ? 'Click to deactivate / lock tenant out' : 'Click to activate / unlock tenant'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          
                          <span className={`text-[10px] font-bold ${
                            isActive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isToggling ? 'Updating...' : isActive ? 'Active / Unlocked' : 'Suspended / Locked'}
                          </span>
                        </div>
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenFeaturesModal(company)}
                            className="py-1.5 px-2.5 bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-lg text-[11px] font-bold border border-indigo-700/60 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                            title="Turn client features on/off or apply industry presets"
                          >
                            <Sliders className="h-3 w-3 text-indigo-400" />
                            <span>Features</span>
                          </button>

                          <button
                            onClick={() => handleEnterClientWorkspace(company)}
                            className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                            title="Switch active workspace to this client"
                          >
                            <span>Enter Store</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>

                          <button
                            onClick={() => handleCopyPortalUrl(company.id)}
                            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer"
                            title="Copy client login portal URL"
                          >
                            {copiedId === company.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Provision New Commercial Client</h3>
                  <p className="text-xs text-slate-400">Creates isolated workspace, admin credentials & financial year</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setNewCompanyActiveTab('details')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  newCompanyActiveTab === 'details'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>1. Store Profile & Login</span>
              </button>
              <button
                type="button"
                onClick={() => setNewCompanyActiveTab('features')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  newCompanyActiveTab === 'features'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                <Bot className="h-3.5 w-3.5 text-indigo-400" />
                <span>2. Feature Checklist & Presets</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-[10px] font-mono text-emerald-400 border border-slate-700">
                  {ALL_SYSTEM_FEATURES.filter(f => newFeatures[f.id] === true).length} Active
                </span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateCompany} className="flex-1 overflow-y-auto pt-3 pb-2 text-left text-xs space-y-4 pr-1">
              {newCompanyActiveTab === 'details' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Company / Store Name *</label>
                    <input
                      type="text"
                      required
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Paro Wholesale Mart"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Trade License No</label>
                      <input
                        type="text"
                        value={newTradeLicense}
                        onChange={e => setNewTradeLicense(e.target.value)}
                        placeholder="TRD-2026-XXXX"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Tax Payer ID (TPN)</label>
                      <input
                        type="text"
                        value={newTaxId}
                        onChange={e => setNewTaxId(e.target.value)}
                        placeholder="TPN-XXXXXXX"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="admin@clientstore.bt"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="+975 17 XXX XXX"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Store Address</label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={e => setNewAddress(e.target.value)}
                      placeholder="Main Town, Dzongkhag, Bhutan"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="p-3.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-indigo-300 block">Initial Store Admin Login Setup</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Admin Username</label>
                        <input
                          type="text"
                          value={newAdminUsername}
                          onChange={e => setNewAdminUsername(e.target.value)}
                          placeholder="admin"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-medium mb-1">Initial PIN Code</label>
                        <input
                          type="text"
                          value={newAdminPin}
                          onChange={e => setNewAdminPin(e.target.value)}
                          placeholder="1234"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {newCompanyActiveTab === 'features' && (
                <div>{renderFeatureChecklist(newFeatures, newSelectedPresetId, 'new')}</div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {newCompanyActiveTab === 'details' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCompanyName.trim()) {
                          setFeedbackMsg({ type: 'error', text: 'Please enter a company name first.' });
                          return;
                        }
                        setNewCompanyActiveTab('features');
                      }}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next: Configure Features</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNewCompanyActiveTab('details')}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition border border-slate-700 cursor-pointer"
                    >
                      ← Back to Profile
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Client Workspace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Client Features & Permissions Modal (For Existing Clients) */}
      {managingCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Client Feature Permissions</h3>
                  <p className="text-xs text-slate-400">
                    Managing active modules for <span className="text-indigo-300 font-bold">"{managingCompany.company_name}"</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCompany(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notice */}
            <div className="py-2.5 px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl my-3 text-[11px] text-amber-300/90 leading-relaxed shrink-0">
              <span className="font-bold">Superadmin Policy:</span> Modules turned <span className="font-bold text-rose-400">OFF</span> are completely hidden from the client's screen, sidebar, and settings menu. Whatever modules are left <span className="font-bold text-emerald-400">ON</span>, the client can use freely.
            </div>

            {/* Scrollable Checklist Body */}
            <div className="flex-1 overflow-y-auto pb-2 pr-1">
              {renderFeatureChecklist(editingFeatures, editingPresetId, 'edit')}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setManagingCompany(null)}
                className="py-2 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveExistingFeatures}
                disabled={isSavingFeatures}
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingFeatures ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Permissions...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Save Feature Permissions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
