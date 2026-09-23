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
  ToggleRight,
  Pencil,
  Settings2,
  Calendar,
  Tag
} from 'lucide-react';
import { 
  SupabaseCompany, 
  fetchUserCompanies, 
  updateCompanyStatus, 
  updateCompany,
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
import { getMaxTerminalLimit, setMaxTerminalLimit } from '../services/storageService';
import { 
  ALL_SYSTEM_FEATURES, 
  FEATURE_PRESETS, 
  FeaturePreset,
  FeatureDefinition,
  getCompanyConfig, 
  saveCompanyFeatures,
  isSupportAccessAllowed 
} from '../services/tenantFeatureService';

export interface SubscriptionPlanDetails {
  planName: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'quarterly' | 'one-time';
  expiresAt?: string;
  notes?: string;
}

export interface GlobalPricingSettings {
  defaultPrice: number;
  defaultCurrency: string;
  defaultTierName: string;
}

const GLOBAL_PRICING_STORAGE_KEY = 'superadmin_global_pricing_config';

export function getGlobalPricingSettings(): GlobalPricingSettings {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(GLOBAL_PRICING_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          defaultPrice: typeof parsed.defaultPrice === 'number' ? parsed.defaultPrice : 25,
          defaultCurrency: parsed.defaultCurrency || 'USD',
          defaultTierName: parsed.defaultTierName || 'Commercial'
        };
      }
    } catch {}
  }
  return {
    defaultPrice: 25,
    defaultCurrency: 'USD',
    defaultTierName: 'Commercial'
  };
}

export function saveGlobalPricingSettings(settings: GlobalPricingSettings): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(GLOBAL_PRICING_STORAGE_KEY, JSON.stringify(settings));
  }
}

export function parseSubscriptionPlan(
  rawPlan?: string,
  globalPricing?: GlobalPricingSettings
): SubscriptionPlanDetails {
  const gPrice = globalPricing?.defaultPrice ?? 25;
  const gCurrency = globalPricing?.defaultCurrency ?? 'USD';
  const gTier = globalPricing?.defaultTierName ?? 'Commercial';

  if (!rawPlan || !rawPlan.trim()) {
    return {
      planName: gTier,
      price: gPrice,
      currency: gCurrency,
      billingCycle: 'monthly',
      notes: 'Standard plan tier'
    };
  }

  // 1. Try JSON parsing
  if (rawPlan.startsWith('{') && rawPlan.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawPlan);
      return {
        planName: parsed.planName || parsed.name || gTier,
        price: typeof parsed.price === 'number' ? parsed.price : (parseFloat(parsed.price) || 0),
        currency: parsed.currency || gCurrency,
        billingCycle: parsed.billingCycle || parsed.interval || 'monthly',
        expiresAt: parsed.expiresAt,
        notes: parsed.notes
      };
    } catch {}
  }

  // 2. Parse string format like "$25/mo Commercial" or "Nu. 1800/mo"
  let currency = gCurrency;
  if (/nu\.?|btn/i.test(rawPlan)) currency = 'Nu.';
  else if (/\$|usd/i.test(rawPlan)) currency = 'USD';
  else if (/₹|inr/i.test(rawPlan)) currency = '₹';

  let billingCycle: 'monthly' | 'yearly' = 'monthly';
  if (/yr|year|annual/i.test(rawPlan)) billingCycle = 'yearly';

  const numMatch = rawPlan.match(/[\d,]+(?:\.\d+)?/);
  const price = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : gPrice;

  let cleanName = rawPlan
    .replace(/[\$\d,\.\/]+(mo|month|yr|year|qtr)?/gi, '')
    .replace(/Nu\.?|USD|BTN|INR|₹/gi, '')
    .replace(/per\s+(month|year)/gi, '')
    .replace(/[\(\)\-\:\/]/g, '')
    .trim();

  if (!cleanName) cleanName = gTier;

  return {
    planName: cleanName,
    price,
    currency,
    billingCycle
  };
}

export function formatPlanBadge(plan: SubscriptionPlanDetails): { label: string; currencySymbol: string } {
  const symbol = plan.currency === 'USD' ? '$' : plan.currency === 'INR' ? '₹' : plan.currency === 'Nu.' ? 'Nu. ' : `${plan.currency} `;
  const cycleSuffix = plan.billingCycle === 'monthly' ? '/mo' : plan.billingCycle === 'yearly' ? '/yr' : plan.billingCycle === 'quarterly' ? '/qtr' : '';

  if (plan.price === 0) {
    return {
      label: `Free ${plan.planName}`,
      currencySymbol: symbol
    };
  }

  return {
    label: `${symbol}${plan.price.toLocaleString()}${cycleSuffix} ${plan.planName}`,
    currencySymbol: symbol
  };
}

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
  const [newAllowedCounters, setNewAllowedCounters] = useState<number>(1);
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
  const [managingAllowedCounters, setManagingAllowedCounters] = useState<number>(1);
  const [editingFeatures, setEditingFeatures] = useState<Record<string, boolean>>({});
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isSavingFeatures, setIsSavingFeatures] = useState<boolean>(false);

  // Global Benchmark Pricing state
  const [globalPricing, setGlobalPricing] = useState<GlobalPricingSettings>(getGlobalPricingSettings);
  const [showGlobalPricingModal, setShowGlobalPricingModal] = useState<boolean>(false);
  const [editGlobalPrice, setEditGlobalPrice] = useState<number | string>(globalPricing.defaultPrice);
  const [editGlobalCurrency, setEditGlobalCurrency] = useState<string>(globalPricing.defaultCurrency);
  const [editGlobalTierName, setEditGlobalTierName] = useState<string>(globalPricing.defaultTierName);

  // Tenant Plan Edit Modal state
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [editingPlanCompany, setEditingPlanCompany] = useState<SupabaseCompany | null>(null);
  const [planFormAllowedCounters, setPlanFormAllowedCounters] = useState<number>(1);
  const [planFormTier, setPlanFormTier] = useState<string>('commercial');
  const [planFormName, setPlanFormName] = useState<string>('Commercial');
  const [planFormPrice, setPlanFormPrice] = useState<number | string>(25);
  const [planFormCurrency, setPlanFormCurrency] = useState<string>('USD');
  const [planFormCycle, setPlanFormCycle] = useState<'monthly' | 'yearly' | 'quarterly' | 'one-time'>('monthly');
  const [planFormExpiresAt, setPlanFormExpiresAt] = useState<string>('');

  // Privacy Protection Modal state
  const [privacyBlockedCompany, setPrivacyBlockedCompany] = useState<SupabaseCompany | null>(null);
  const [planFormNotes, setPlanFormNotes] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState<boolean>(false);

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
    // Privacy check for client companies (allow default demo company)
    if (company.id !== DEFAULT_TENANT_COMPANY.id && !isSupportAccessAllowed(company)) {
      setPrivacyBlockedCompany(company);
      return;
    }

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
    setManagingAllowedCounters(company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id));
    setManagingCompany(company);
  };

  // Save features for existing company
  const handleSaveExistingFeatures = async () => {
    if (!managingCompany) return;
    setIsSavingFeatures(true);
    try {
      saveCompanyFeatures(managingCompany.id, editingFeatures);
      setMaxTerminalLimit(managingAllowedCounters, managingCompany.id);
      await updateCompany(managingCompany.id, { allowed_counters: managingAllowedCounters });
      setCompanies(prev =>
        prev.map(c =>
          c.id === managingCompany.id
            ? { ...c, allowed_counters: managingAllowedCounters }
            : c
        )
      );
      setFeedbackMsg({
        type: 'success',
        text: `Features and terminal limits for "${managingCompany.company_name}" have been updated successfully and applied immediately.`
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
        allowed_counters: newAllowedCounters,
        admin_username: newAdminUsername.trim() || 'admin',
        admin_name: `${newCompanyName.trim()} Administrator`,
        admin_pin: newAdminPin.trim() || '1234',
        is_active: true,
        initialFeatures: newFeatures
      });

      if (res.company) {
        setMaxTerminalLimit(newAllowedCounters, res.company.id);
        setFeedbackMsg({
          type: 'success',
          text: `Successfully provisioned client workspace "${res.company.company_name}" with configured features and terminal limits.`
        });
        setShowAddModal(false);
        // Reset form
        setNewCompanyName('');
        setNewTradeLicense('');
        setNewTaxId('');
        setNewEmail('');
        setNewPhone('');
        setNewAddress('');
        setNewAllowedCounters(1);
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

  // Open Plan Modal for Tenant
  const handleOpenPlanModal = (company: SupabaseCompany) => {
    const plan = parseSubscriptionPlan(company.subscription_plan, globalPricing);
    setEditingPlanCompany(company);
    setPlanFormName(plan.planName);
    setPlanFormPrice(plan.price);
    setPlanFormCurrency(plan.currency);
    setPlanFormCycle(plan.billingCycle);
    setPlanFormExpiresAt(company.subscription_expires_at || plan.expiresAt || '');
    setPlanFormNotes(plan.notes || '');
    setPlanFormAllowedCounters(company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id));

    if (plan.price === 0) {
      setPlanFormTier('free');
    } else if (plan.price === 15 || plan.price === 1000) {
      setPlanFormTier('starter');
    } else if (plan.price === 25 || plan.price === 1800) {
      setPlanFormTier('commercial');
    } else if (plan.price === 50 || plan.price === 3500) {
      setPlanFormTier('enterprise');
    } else {
      setPlanFormTier('custom');
    }

    setShowPlanModal(true);
  };

  // Quick Preset Selector for Plan Modal
  const applyPlanPreset = (presetKey: string) => {
    setPlanFormTier(presetKey);
    const isNu = planFormCurrency === 'Nu.' || planFormCurrency === 'BTN';
    if (presetKey === 'free') {
      setPlanFormName('Free Trial');
      setPlanFormPrice(0);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(1);
    } else if (presetKey === 'starter') {
      setPlanFormName('Starter Tier');
      setPlanFormPrice(isNu ? 1000 : 15);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(1);
    } else if (presetKey === 'commercial') {
      setPlanFormName('Commercial Plan');
      setPlanFormPrice(isNu ? 1800 : 25);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(2);
    } else if (presetKey === 'enterprise') {
      setPlanFormName('Enterprise Tier');
      setPlanFormPrice(isNu ? 3500 : 50);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(0);
    }
  };

  // Save Tenant Subscription Plan
  const handleSaveCompanyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlanCompany) return;

    setIsSavingPlan(true);
    try {
      const numPrice = typeof planFormPrice === 'string' ? (parseFloat(planFormPrice) || 0) : planFormPrice;
      const planDetails: SubscriptionPlanDetails = {
        planName: planFormName.trim() || 'Commercial Plan',
        price: numPrice,
        currency: planFormCurrency,
        billingCycle: planFormCycle,
        expiresAt: planFormExpiresAt || undefined,
        notes: planFormNotes.trim() || undefined
      };

      const serializedPlan = JSON.stringify(planDetails);
      const updates: Partial<SupabaseCompany> = {
        subscription_plan: serializedPlan,
        subscription_expires_at: planFormExpiresAt || undefined,
        allowed_counters: planFormAllowedCounters
      };

      setMaxTerminalLimit(planFormAllowedCounters, editingPlanCompany.id);
      const res = await updateCompany(editingPlanCompany.id, updates);
      if (res.error) {
        setFeedbackMsg({ type: 'error', text: res.error });
      } else {
        setCompanies(prev =>
          prev.map(c =>
            c.id === editingPlanCompany.id
              ? { ...c, subscription_plan: serializedPlan, subscription_expires_at: planFormExpiresAt || undefined, allowed_counters: planFormAllowedCounters }
              : c
          )
        );
        const formatted = formatPlanBadge(planDetails);
        setFeedbackMsg({
          type: 'success',
          text: `Updated "${editingPlanCompany.company_name}" subscription plan to ${formatted.label} (Counters limit: ${planFormAllowedCounters === 0 ? 'Unlimited' : planFormAllowedCounters}).`
        });
        setShowPlanModal(false);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to update plan' });
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Save Global Benchmark Pricing Settings
  const handleSaveGlobalPricing = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = typeof editGlobalPrice === 'string' ? (parseFloat(editGlobalPrice) || 0) : editGlobalPrice;
    const newSettings: GlobalPricingSettings = {
      defaultPrice: numPrice,
      defaultCurrency: editGlobalCurrency,
      defaultTierName: editGlobalTierName.trim() || 'Commercial'
    };
    saveGlobalPricingSettings(newSettings);
    setGlobalPricing(newSettings);
    setShowGlobalPricingModal(false);
    setFeedbackMsg({
      type: 'success',
      text: `Updated global default platform pricing benchmark to ${newSettings.defaultCurrency === 'USD' ? '$' : newSettings.defaultCurrency === 'Nu.' ? 'Nu. ' : `${newSettings.defaultCurrency} `}${newSettings.defaultPrice}/mo (${newSettings.defaultTierName}).`
    });
  };

  // Calculated Metrics
  const totalTenants = companies.length;
  const activeTenants = companies.filter(c => c.is_active !== false).length;
  const inactiveTenants = totalTenants - activeTenants;
  const quotaPercent = Math.min(100, Math.round((totalTenants / RECOMMENDED_TENANT_QUOTA) * 100));

  // Dynamic MRR Calculation across all active companies
  const mrrData = useMemo(() => {
    const activeCompanies = companies.filter(c => c.is_active !== false);
    const totalsByCurrency: Record<string, number> = {};

    activeCompanies.forEach(c => {
      const plan = parseSubscriptionPlan(c.subscription_plan, globalPricing);
      const monthlyPrice = plan.billingCycle === 'yearly'
        ? Math.round(plan.price / 12)
        : plan.billingCycle === 'quarterly'
        ? Math.round(plan.price / 3)
        : plan.price;

      const curr = plan.currency || globalPricing.defaultCurrency;
      totalsByCurrency[curr] = (totalsByCurrency[curr] || 0) + monthlyPrice;
    });

    const entries = Object.entries(totalsByCurrency);
    if (entries.length === 0) {
      const currSymbol = globalPricing.defaultCurrency === 'USD' ? '$' : globalPricing.defaultCurrency === 'Nu.' ? 'Nu. ' : `${globalPricing.defaultCurrency} `;
      return {
        displayValue: `${currSymbol}0`,
        suffix: `${globalPricing.defaultCurrency} / Month`,
        subtitle: `${currSymbol}${globalPricing.defaultPrice}/mo default benchmark rate`,
        totalCount: 0
      };
    }

    if (entries.length === 1) {
      const [curr, total] = entries[0];
      const symbol = curr === 'USD' ? '$' : curr === 'Nu.' ? 'Nu. ' : curr === 'INR' ? '₹' : `${curr} `;
      return {
        displayValue: `${symbol}${total.toLocaleString()}`,
        suffix: `${curr === 'Nu.' ? 'BTN' : curr} / Month`,
        subtitle: `Calculated from ${activeTenants} active client ${activeTenants === 1 ? 'tier' : 'tiers'}`,
        totalCount: activeTenants
      };
    }

    // Multi-currency display
    const formattedParts = entries.map(([curr, total]) => {
      const symbol = curr === 'USD' ? '$' : curr === 'Nu.' ? 'Nu. ' : curr === 'INR' ? '₹' : `${curr} `;
      return `${symbol}${total.toLocaleString()}`;
    });

    return {
      displayValue: formattedParts.join(' + '),
      suffix: 'Combined / Month',
      subtitle: `Aggregated across ${activeTenants} active clients`,
      totalCount: activeTenants
    };
  }, [companies, globalPricing, activeTenants]);

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
        <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-md relative group">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated MRR</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditGlobalPrice(globalPricing.defaultPrice);
                  setEditGlobalCurrency(globalPricing.defaultCurrency);
                  setEditGlobalTierName(globalPricing.defaultTierName);
                  setShowGlobalPricingModal(true);
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded-lg transition cursor-pointer"
                title="Configure platform benchmark pricing & default currency"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <DollarSign className="h-4 w-4 text-indigo-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-indigo-400">{mrrData.displayValue}</span>
            <span className="text-[11px] text-slate-400 font-medium">{mrrData.suffix}</span>
          </div>
          <div className="mt-2 text-[10px] text-indigo-300/80 font-mono flex items-center justify-between">
            <span className="truncate mr-1">{mrrData.subtitle}</span>
            <button
              type="button"
              onClick={() => {
                setEditGlobalPrice(globalPricing.defaultPrice);
                setEditGlobalCurrency(globalPricing.defaultCurrency);
                setEditGlobalTierName(globalPricing.defaultTierName);
                setShowGlobalPricingModal(true);
              }}
              className="text-indigo-400 hover:text-indigo-200 underline cursor-pointer text-[10px] shrink-0"
            >
              Configure
            </button>
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
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>Commercial Plan</span>
                    <span className="text-[9px] text-indigo-400 font-normal font-sans lowercase tracking-normal">(click to edit)</span>
                  </div>
                </th>
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
                        {(() => {
                          const plan = parseSubscriptionPlan(company.subscription_plan, globalPricing);
                          const badge = formatPlanBadge(plan);
                          const limit = company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id);
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPlanModal(company)}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/60 hover:border-indigo-500 text-indigo-300 hover:text-white text-[11px] font-medium font-mono transition-all cursor-pointer shadow-xs"
                                title="Click to edit Commercial Plan, pricing & billing details"
                              >
                                <CreditCard className="h-3 w-3 text-indigo-400 group-hover:text-indigo-200 shrink-0" />
                                <span className="font-semibold">{badge.label}</span>
                                <Pencil className="h-2.5 w-2.5 text-indigo-400/60 group-hover:text-indigo-200 ml-0.5" />
                              </button>
                              <span className="text-[10px] bg-slate-800/90 text-slate-300 border border-slate-700/70 px-2 py-0.2 rounded font-mono flex items-center gap-1">
                                <Sliders className="h-2.5 w-2.5 text-indigo-400" />
                                <span>{limit === 0 ? 'Unlimited Counters' : `${limit} Counter${limit > 1 ? 's' : ''}`}</span>
                              </span>
                            </div>
                          );
                        })()}
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

                  {/* Allowed Active POS Counters Limit */}
                  <div className="p-3.5 bg-slate-800/80 border border-indigo-500/30 rounded-xl space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Allowed Active Counters Limit (Superadmin Control)</span>
                      </span>
                      <span className="text-[10px] font-mono text-indigo-400">
                        {newAllowedCounters === 0 ? 'Unlimited' : `${newAllowedCounters} Counter${newAllowedCounters > 1 ? 's' : ''}`}
                      </span>
                    </label>
                    <select
                      value={newAllowedCounters}
                      onChange={e => setNewAllowedCounters(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-3 py-2 text-white font-semibold text-xs focus:border-indigo-400 focus:outline-none"
                    >
                      <option value={1}>1 Terminal (Single Counter Plan - Default)</option>
                      <option value={2}>2 Terminals (Dual Cashier Counters)</option>
                      <option value={3}>3 Terminals (3-Desk Setup)</option>
                      <option value={4}>4 Terminals (4-Desk Setup)</option>
                      <option value={5}>5 Terminals (5-Desk Setup)</option>
                      <option value={0}>Unlimited Terminals (Enterprise Tier)</option>
                    </select>
                    <p className="text-[10px] text-slate-400">
                      Enforces how many POS billing counters this client can simultaneously activate on their system.
                    </p>
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

            {/* Allowed Active POS Counters Limit */}
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl mb-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Authorized POS Billing Counters Limit</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Maximum number of active cashier desks/terminals this client can run concurrently.
                  </p>
                </div>
                <div className="min-w-[200px]">
                  <select
                    value={managingAllowedCounters}
                    onChange={e => setManagingAllowedCounters(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl px-3 py-1.5 text-white font-semibold text-xs focus:border-indigo-400 focus:outline-none"
                  >
                    <option value={1}>1 Terminal (Single Counter)</option>
                    <option value={2}>2 Terminals (Dual Cashier)</option>
                    <option value={3}>3 Terminals (3-Desk Setup)</option>
                    <option value={4}>4 Terminals (4-Desk Setup)</option>
                    <option value={5}>5 Terminals (5-Desk Setup)</option>
                    <option value={0}>Unlimited (Enterprise Tier)</option>
                  </select>
                </div>
              </div>
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

      {/* 3. Commercial Subscription Plan & Pricing Modal */}
      {showPlanModal && editingPlanCompany && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl p-6 flex flex-col max-h-[90vh] text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Commercial Subscription Plan</h3>
                  <p className="text-xs text-slate-400">
                    Set tier, pricing & billing interval for <span className="text-indigo-300 font-bold">{editingPlanCompany.company_name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCompanyPlan} className="flex-1 overflow-y-auto pt-4 pb-2 space-y-4 text-xs">
              {/* Quick Plan Preset Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Select Plan Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'free', label: 'Free Trial', priceLabel: '0 / Free' },
                    { id: 'starter', label: 'Starter', priceLabel: planFormCurrency === 'Nu.' ? 'Nu. 1,000' : '$15/mo' },
                    { id: 'commercial', label: 'Commercial', priceLabel: planFormCurrency === 'Nu.' ? 'Nu. 1,800' : '$25/mo' },
                    { id: 'enterprise', label: 'Enterprise', priceLabel: planFormCurrency === 'Nu.' ? 'Nu. 3,500' : '$50/mo' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPlanPreset(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        planFormTier === preset.id
                          ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-xs'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold text-xs">{preset.label}</div>
                      <div className="text-[10px] text-indigo-400 font-mono mt-0.5">{preset.priceLabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Plan Tier Name *</label>
                  <input
                    type="text"
                    required
                    value={planFormName}
                    onChange={e => {
                      setPlanFormName(e.target.value);
                      setPlanFormTier('custom');
                    }}
                    placeholder="e.g. Commercial Plan"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Billing Price / Rate *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={planFormPrice}
                    onChange={e => {
                      setPlanFormPrice(e.target.value);
                      setPlanFormTier('custom');
                    }}
                    placeholder="25"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Currency & Billing Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Currency</label>
                  <select
                    value={planFormCurrency}
                    onChange={e => setPlanFormCurrency(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="Nu.">Nu. (BTN - Bhutanese Ngultrum)</option>
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Billing Cycle</label>
                  <select
                    value={planFormCycle}
                    onChange={e => setPlanFormCycle(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="monthly">Monthly (/mo)</option>
                    <option value="yearly">Yearly (/yr)</option>
                    <option value="quarterly">Quarterly (/qtr)</option>
                    <option value="one-time">One-Time / Lifetime</option>
                  </select>
                </div>
              </div>

              {/* Expiry Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Subscription / Renewal Expiry (Optional)</label>
                  <input
                    type="date"
                    value={planFormExpiresAt}
                    onChange={e => setPlanFormExpiresAt(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Admin Notes (Optional)</label>
                  <input
                    type="text"
                    value={planFormNotes}
                    onChange={e => setPlanFormNotes(e.target.value)}
                    placeholder="e.g. Contract signed, direct invoice"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Allowed POS Counters / Terminal Licenses */}
              <div className="p-3 bg-slate-950/60 border border-indigo-500/40 rounded-xl space-y-1.5">
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Authorized POS Billing Counters Limit (Superadmin Control)</span>
                  </span>
                  <span className="text-indigo-400 font-mono text-[10px]">
                    {planFormAllowedCounters === 0 ? 'Unlimited Desks' : `${planFormAllowedCounters} Counter${planFormAllowedCounters > 1 ? 's' : ''}`}
                  </span>
                </label>
                <select
                  value={planFormAllowedCounters}
                  onChange={e => setPlanFormAllowedCounters(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-indigo-500/50 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-indigo-400"
                >
                  <option value={1}>1 Terminal (Single Counter Plan - Default)</option>
                  <option value={2}>2 Terminals (Dual Cashier Counters)</option>
                  <option value={3}>3 Terminals (3-Desk Setup)</option>
                  <option value={4}>4 Terminals (4-Desk Setup)</option>
                  <option value={5}>5 Terminals (5-Desk Setup)</option>
                  <option value={0}>Unlimited Terminals (Enterprise Unlimited)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  Controls how many active billing counters or client terminals this company can register and run simultaneously.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Live Badge Preview</span>
                  <div className="mt-1">
                    {(() => {
                      const numP = typeof planFormPrice === 'string' ? (parseFloat(planFormPrice) || 0) : planFormPrice;
                      const badge = formatPlanBadge({
                        planName: planFormName || 'Commercial Plan',
                        price: numP,
                        currency: planFormCurrency,
                        billingCycle: planFormCycle
                      });
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-xs font-bold">
                          <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Monthly MRR Value</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {(() => {
                      const numP = typeof planFormPrice === 'string' ? (parseFloat(planFormPrice) || 0) : planFormPrice;
                      const sym = planFormCurrency === 'USD' ? '$' : planFormCurrency === 'Nu.' ? 'Nu. ' : '₹';
                      const monthly = planFormCycle === 'yearly' ? Math.round(numP / 12) : planFormCycle === 'quarterly' ? Math.round(numP / 3) : numP;
                      return `${sym}${monthly.toLocaleString()}/mo`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPlan ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Plan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Subscription Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Global Benchmark Pricing Settings Modal */}
      {showGlobalPricingModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Global Pricing Benchmark</h3>
                  <p className="text-xs text-slate-400">
                    Default rate for unassigned companies & baseline MRR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGlobalPricingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGlobalPricing} className="pt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Default Plan Tier Name</label>
                <input
                  type="text"
                  required
                  value={editGlobalTierName}
                  onChange={e => setEditGlobalTierName(e.target.value)}
                  placeholder="Commercial"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Default Monthly Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editGlobalPrice}
                    onChange={e => setEditGlobalPrice(e.target.value)}
                    placeholder="25"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Default Currency</label>
                  <select
                    value={editGlobalCurrency}
                    onChange={e => setEditGlobalCurrency(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="Nu.">Nu. (BTN)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-[11px] text-slate-400 leading-relaxed">
                <span className="font-bold text-slate-200">Note:</span> Individual client companies with custom plans configured will keep their specific pricing. This setting controls the default baseline rate and fallback for MRR estimation.
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowGlobalPricingModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Benchmark Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Privacy Protection Shield Modal */}
      {privacyBlockedCompany && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Client Data Privacy Active
                </span>
                <h3 className="font-bold text-lg text-white mt-1">Platform Support Access is OFF</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              The owner of <strong className="text-white">"{privacyBlockedCompany.company_name}"</strong> has set Platform Support Access to <span className="text-amber-400 font-bold">OFF</span> to protect confidential business books, daily sales, and customer ledger balances.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 space-y-2 mb-5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Client records, day books, and financial transactions are protected from unauthorized observation.</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>If this client requires remote assistance, request their Company Admin to toggle on <strong>"Allow Platform Support Access"</strong> in <span className="text-white font-semibold">Settings → Security & Permissions</span>.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPrivacyBlockedCompany(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const comp = privacyBlockedCompany;
                  setPrivacyBlockedCompany(null);
                  handleOpenFeaturesModal(comp);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Manage Features & Tier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
