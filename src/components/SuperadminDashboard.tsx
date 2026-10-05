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
  Tag,
  Eye,
  EyeOff,
  Key,
  MessageCircle,
  Share2,
  Smartphone,
  HelpCircle,
  ChevronRight,
  X,
  HardDrive,
  Database,
  Activity,
  Wifi,
  Server
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
  fetchSupabaseStorageStats, 
  SupabaseStorageOverview, 
  ClientStorageStats, 
  formatBytes, 
  getStorageQuotaMB, 
  setStorageQuotaMB 
} from '../services/supabaseStorageStatsService';
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
        // Ensure default currency is strictly Nu. unless user explicitly selected another valid non-USD currency
        const rawCurr = parsed.defaultCurrency;
        const curr = (!rawCurr || rawCurr === 'USD' || rawCurr === '$') ? 'Nu.' : rawCurr;
        const price = (typeof parsed.defaultPrice === 'number' && parsed.defaultPrice !== 25) ? parsed.defaultPrice : 1800;
        const normalized: GlobalPricingSettings = {
          defaultPrice: price,
          defaultCurrency: curr,
          defaultTierName: parsed.defaultTierName || 'Commercial'
        };
        // Auto-heal legacy USD in localStorage so it never reloads USD
        if (parsed.defaultCurrency === 'USD' || parsed.defaultCurrency === '$' || !parsed.defaultCurrency || parsed.defaultPrice === 25) {
          try {
            localStorage.setItem(GLOBAL_PRICING_STORAGE_KEY, JSON.stringify(normalized));
          } catch {}
        }
        return normalized;
      }
    } catch {}
  }
  const defaultSettings: GlobalPricingSettings = {
    defaultPrice: 1800,
    defaultCurrency: 'Nu.',
    defaultTierName: 'Commercial'
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GLOBAL_PRICING_STORAGE_KEY, JSON.stringify(defaultSettings));
    } catch {}
  }
  return defaultSettings;
}

export function saveGlobalPricingSettings(settings: GlobalPricingSettings): void {
  const safeCurr = (settings.defaultCurrency && settings.defaultCurrency !== 'USD' && settings.defaultCurrency !== '$') ? settings.defaultCurrency : 'Nu.';
  const safeSettings = {
    ...settings,
    defaultCurrency: safeCurr,
    defaultPrice: settings.defaultPrice === 25 && safeCurr === 'Nu.' ? 1800 : settings.defaultPrice
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(GLOBAL_PRICING_STORAGE_KEY, JSON.stringify(safeSettings));
  }
}

export function parseSubscriptionPlan(
  rawPlan?: string,
  globalPricing?: GlobalPricingSettings,
  companyCurrency: string = 'Nu.'
): SubscriptionPlanDetails {
  const safeCompCurr = (companyCurrency && companyCurrency !== 'USD' && companyCurrency !== '$') ? companyCurrency : 'Nu.';
  const gCurrency = (globalPricing?.defaultCurrency && globalPricing.defaultCurrency !== 'USD' && globalPricing.defaultCurrency !== '$')
    ? globalPricing.defaultCurrency
    : safeCompCurr;
  const gPrice = (globalPricing?.defaultPrice && globalPricing.defaultPrice !== 25)
    ? globalPricing.defaultPrice
    : 1800;
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
      // Permanently normalize USD / $ to Nu.
      const rawCurr = parsed.currency;
      const parsedCurr = (!rawCurr || rawCurr === 'USD' || rawCurr === '$') ? gCurrency : rawCurr;
      let parsedPrice = typeof parsed.price === 'number' ? parsed.price : (parseFloat(parsed.price) || gPrice);
      if (parsedPrice === 25 && parsedCurr === 'Nu.') {
        parsedPrice = gPrice;
      }
      return {
        planName: parsed.planName || parsed.name || gTier,
        price: parsedPrice,
        currency: parsedCurr,
        billingCycle: parsed.billingCycle || parsed.interval || 'monthly',
        expiresAt: parsed.expiresAt,
        notes: parsed.notes
      };
    } catch {}
  }

  // 2. Parse string format like "$25/mo Commercial" or "Nu. 1800/mo"
  let currency = gCurrency;
  if (/nu\.?|btn/i.test(rawPlan)) {
    currency = 'Nu.';
  } else if (/₹|inr/i.test(rawPlan)) {
    currency = '₹';
  } else if (/\$|usd/i.test(rawPlan)) {
    // Legacy $ / USD defaults permanently normalize to Nu.
    currency = 'Nu.';
  }

  let billingCycle: 'monthly' | 'yearly' = 'monthly';
  if (/yr|year|annual/i.test(rawPlan)) billingCycle = 'yearly';

  const numMatch = rawPlan.match(/[\d,]+(?:\.\d+)?/);
  let price = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : gPrice;
  // If price was the old $25 template and currency is Nu., convert to standard Nu. rate
  if (price === 25 && currency === 'Nu.') {
    price = gPrice;
  }

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
  const isNu = plan.currency === 'Nu.' || !plan.currency || plan.currency === 'BTN' || plan.currency === 'USD' || plan.currency === '$';
  const symbol = isNu
    ? 'Nu. '
    : plan.currency === 'INR' || plan.currency === '₹'
    ? '₹'
    : `${plan.currency} `;
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
const DEFAULT_PLAN_PRICE_PER_TENANT_NU = 1800;

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
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);
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

  // Unified Client 360° Management Hub state
  const [unifiedClient, setUnifiedClient] = useState<SupabaseCompany | null>(null);
  const [unifiedActiveTab, setUnifiedActiveTab] = useState<'profile' | 'features' | 'links' | 'plan' | 'storage'>('profile');
  const [unifiedCompanyName, setUnifiedCompanyName] = useState<string>('');
  const [unifiedTradeLicense, setUnifiedTradeLicense] = useState<string>('');
  const [unifiedTaxId, setUnifiedTaxId] = useState<string>('');
  const [unifiedPhone, setUnifiedPhone] = useState<string>('');
  const [unifiedEmail, setUnifiedEmail] = useState<string>('');
  const [unifiedAddress, setUnifiedAddress] = useState<string>('');
  const [unifiedCurrency, setUnifiedCurrency] = useState<string>('Nu.');
  const [unifiedIsActive, setUnifiedIsActive] = useState<boolean>(true);
  const [unifiedAllowedCounters, setUnifiedAllowedCounters] = useState<number>(1);
  const [unifiedAdminUsername, setUnifiedAdminUsername] = useState<string>('admin');
  const [unifiedAdminPassword, setUnifiedAdminPassword] = useState<string>('');
  const [unifiedAdminPin, setUnifiedAdminPin] = useState<string>('1234');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSavingUnified, setIsSavingUnified] = useState<boolean>(false);

  // Supabase Data Storage & Realtime Telemetry State
  const [storageOverview, setStorageOverview] = useState<SupabaseStorageOverview | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState<boolean>(false);
  const [showQuotaModal, setShowQuotaModal] = useState<boolean>(false);
  const [quotaInputMB, setQuotaInputMB] = useState<number>(getStorageQuotaMB);

  // Unified Plan details
  const [unifiedPlanTier, setUnifiedPlanTier] = useState<string>('commercial');
  const [unifiedPlanName, setUnifiedPlanName] = useState<string>('Commercial Plan');
  const [unifiedPlanPrice, setUnifiedPlanPrice] = useState<number | string>(1800);
  const [unifiedPlanCurrency, setUnifiedPlanCurrency] = useState<string>('Nu.');
  const [unifiedPlanCycle, setUnifiedPlanCycle] = useState<'monthly' | 'yearly' | 'quarterly' | 'one-time'>('monthly');
  const [unifiedPlanExpiresAt, setUnifiedPlanExpiresAt] = useState<string>('');
  const [unifiedPlanNotes, setUnifiedPlanNotes] = useState<string>('');

  // Global Benchmark Pricing state
  const [globalPricing, setGlobalPricing] = useState<GlobalPricingSettings>(getGlobalPricingSettings);
  const [showGlobalPricingModal, setShowGlobalPricingModal] = useState<boolean>(false);
  const [editGlobalPrice, setEditGlobalPrice] = useState<number | string>(globalPricing.defaultPrice);
  const [editGlobalCurrency, setEditGlobalCurrency] = useState<string>(globalPricing.defaultCurrency || 'Nu.');
  const [editGlobalTierName, setEditGlobalTierName] = useState<string>(globalPricing.defaultTierName);

  // Tenant Plan Edit Modal state
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [editingPlanCompany, setEditingPlanCompany] = useState<SupabaseCompany | null>(null);
  const [planFormAllowedCounters, setPlanFormAllowedCounters] = useState<number>(1);
  const [planFormTier, setPlanFormTier] = useState<string>('commercial');
  const [planFormName, setPlanFormName] = useState<string>('Commercial');
  const [planFormPrice, setPlanFormPrice] = useState<number | string>(1800);
  const [planFormCurrency, setPlanFormCurrency] = useState<string>('Nu.');
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

  // Load live Supabase storage and realtime metrics
  const loadStorageTelemetry = async (comps: SupabaseCompany[]) => {
    if (!comps || comps.length === 0) return;
    setIsLoadingStorage(true);
    try {
      const stats = await fetchSupabaseStorageStats(comps);
      setStorageOverview(stats);
    } catch (err) {
      console.warn('Failed to load storage telemetry:', err);
    } finally {
      setIsLoadingStorage(false);
    }
  };

  const handleSaveQuota = (mb: number) => {
    setStorageQuotaMB(mb);
    setShowQuotaModal(false);
    setFeedbackMsg({
      type: 'success',
      text: `Supabase platform storage quota updated to ${mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB'}.`
    });
    if (companies.length > 0) {
      loadStorageTelemetry(companies);
    }
  };

  // Load companies directly from Supabase / master list with credentials merged
  const loadMasterCompanies = async () => {
    setIsLoading(true);
    setFeedbackMsg(null);
    try {
      // Helper to migrate legacy USD plan templates to Nu. permanently
      const healCompanyPlans = (rawCompanies: SupabaseCompany[]): SupabaseCompany[] => {
        return rawCompanies.map(c => {
          const safeCompCurr = (c.currency_symbol && c.currency_symbol !== 'USD' && c.currency_symbol !== '$') ? c.currency_symbol : 'Nu.';
          const plan = parseSubscriptionPlan(c.subscription_plan, globalPricing, safeCompCurr);
          const isLegacy = !c.subscription_plan || c.subscription_plan.includes('$') || c.subscription_plan.includes('USD') || plan.currency === 'USD' || plan.currency === '$' || c.currency_symbol === 'USD' || c.currency_symbol === '$';
          if (isLegacy) {
            const healed: SubscriptionPlanDetails = {
              planName: plan.planName || 'Commercial Plan',
              price: (plan.price === 25 || !plan.price) ? (globalPricing.defaultPrice || 1800) : plan.price,
              currency: 'Nu.',
              billingCycle: plan.billingCycle || 'monthly',
              expiresAt: c.subscription_expires_at || plan.expiresAt,
              notes: plan.notes
            };
            const serialized = JSON.stringify(healed);
            updateCompany(c.id, { subscription_plan: serialized, currency_symbol: 'Nu.' }).catch(() => {});
            return { ...c, subscription_plan: serialized, currency_symbol: 'Nu.' };
          }
          return { ...c, currency_symbol: safeCompCurr };
        });
      };

      // 1. Primary: fetchUserCompanies with includeAll=true loads both companies and credentials from tenant_settings
      const { companies: list } = await fetchUserCompanies(true);
      if (list && list.length > 0) {
        const healedList = healCompanyPlans(list);
        setCompanies(healedList);
        loadStorageTelemetry(healedList);
        setIsLoading(false);
        return;
      }

      // 2. Direct Supabase fallback
      if (isSupabaseConfigured) {
        try {
          const { data: sbComps, error: sbErr } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

          if (sbComps && sbComps.length > 0 && !sbErr) {
            const hasDefault = sbComps.some(c => c.id === DEFAULT_TENANT_COMPANY.id);
            const fallbackList = hasDefault ? sbComps : [DEFAULT_TENANT_COMPANY, ...sbComps];
            const healedFallback = healCompanyPlans(fallbackList);
            setCompanies(healedFallback);
            loadStorageTelemetry(healedFallback);
            setIsLoading(false);
            return;
          }
        } catch (sbEx) {
          console.warn('Direct Supabase fetch fallback in SuperadminDashboard:', sbEx);
        }
      }

      const defaultList = healCompanyPlans([DEFAULT_TENANT_COMPANY]);
      setCompanies(defaultList);
      loadStorageTelemetry(defaultList);
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

  useEffect(() => {
    if (!isSuperadminUser || companies.length === 0) return;
    const interval = setInterval(() => {
      loadStorageTelemetry(companies);
    }, 45000);
    return () => clearInterval(interval);
  }, [isSuperadminUser, companies.length]);

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

  // Copy Client Dedicated URL (uses active domain or configured custom domain)
  const handleCopyPortalUrl = (cId: string) => {
    const url = getCompanyDedicatedUrl(cId, true);
    navigator.clipboard.writeText(url);
    setCopiedId(cId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Copy Client Dedicated Staff PWA Portal URL (specifically triggers the Employee Portal)
  const handleCopyStaffPortalUrl = (cId: string) => {
    const baseUrl = getCompanyDedicatedUrl(cId, true);
    const staffUrl = `${baseUrl}&portal=staff`;
    navigator.clipboard.writeText(staffUrl);
    setCopiedStaffId(cId);
    setTimeout(() => setCopiedStaffId(null), 2500);
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

  // Helper to generate a random strong password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setUnifiedAdminPassword(`Druk@${res}`);
  };

  // Helper to format WhatsApp share URL
  const getWhatsAppShareUrl = () => {
    if (!unifiedClient) return '';
    const erpUrl = getCompanyDedicatedUrl(unifiedClient.id, true);
    const staffUrl = `${erpUrl}&portal=staff`;
    const msg = `*DrukERP Portal Details*
Store: ${unifiedCompanyName || unifiedClient.company_name}

🔑 *Store Admin Login:*
• Portal: ${erpUrl}
• Username: ${unifiedAdminUsername || 'admin'}
• Password: ${unifiedAdminPassword || 'ClientPass@123'}
• PIN: ${unifiedAdminPin || '1234'}

👥 *Staff Clock-in & Leave Portal:*
• Staff URL: ${staffUrl}

Please save this link to your phone or desktop.`;
    const cleanPhone = (unifiedPhone || '').replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Open the Unified Client 360° Management Hub
  const handleOpenUnifiedClient = async (
    company: SupabaseCompany, 
    defaultTab: 'profile' | 'features' | 'links' | 'plan' | 'storage' = 'profile'
  ) => {
    setUnifiedClient(company);
    setUnifiedActiveTab(defaultTab);
    setUnifiedCompanyName(company.company_name || '');
    setUnifiedTradeLicense(company.trade_license_no || '');
    setUnifiedTaxId(company.tax_payer_id || '');
    setUnifiedPhone(company.phone || '');
    setUnifiedEmail(company.email || '');
    setUnifiedAddress(company.address || '');
    const compCurrency = (company.currency_symbol && company.currency_symbol !== 'USD' && company.currency_symbol !== '$') ? company.currency_symbol : 'Nu.';
    setUnifiedCurrency(compCurrency);
    setUnifiedIsActive(company.is_active !== false);

    const limit = company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id);
    setUnifiedAllowedCounters(limit);

    setUnifiedAdminUsername(company.admin_username || 'admin');
    setUnifiedAdminPassword(company.admin_password || 'ClientPass@123');
    setUnifiedAdminPin(company.admin_pin || '1234');
    setShowPassword(false);

    // Plan
    const plan = parseSubscriptionPlan(company.subscription_plan, globalPricing, compCurrency);
    setUnifiedPlanName(plan.planName);
    setUnifiedPlanPrice(plan.price === 25 ? 1800 : plan.price);
    const planCurr = (plan.currency && plan.currency !== 'USD' && plan.currency !== '$') ? plan.currency : compCurrency;
    setUnifiedPlanCurrency(planCurr);
    setUnifiedPlanCycle(plan.billingCycle);
    setUnifiedPlanExpiresAt(company.subscription_expires_at || plan.expiresAt || '');
    setUnifiedPlanNotes(plan.notes || '');
    if (plan.price === 0) setUnifiedPlanTier('free');
    else if (plan.price === 15 || plan.price === 1000) setUnifiedPlanTier('starter');
    else if (plan.price === 25 || plan.price === 1800) setUnifiedPlanTier('commercial');
    else if (plan.price === 50 || plan.price === 3500) setUnifiedPlanTier('enterprise');
    else setUnifiedPlanTier('custom');

    // Features
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

    // Try fetching remote credentials from tenant_settings if needed
    if (isSupabaseConfigured) {
      try {
        const { data: credsRow } = await supabase
          .from('tenant_settings')
          .select('data')
          .eq('company_id', company.id)
          .eq('record_id', 'admin_credentials')
          .maybeSingle();

        if (credsRow && credsRow.data) {
          if (credsRow.data.admin_username) setUnifiedAdminUsername(credsRow.data.admin_username);
          if (credsRow.data.admin_password) setUnifiedAdminPassword(credsRow.data.admin_password);
          if (credsRow.data.admin_pin) setUnifiedAdminPin(credsRow.data.admin_pin);
        }
      } catch (e) {
        console.warn('Could not fetch remote creds:', e);
      }
    }
  };

  // Save all Unified Client changes in one atomic action
  const handleSaveUnifiedClient = async () => {
    if (!unifiedClient) return;
    if (!unifiedCompanyName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Store Name cannot be empty.' });
      setUnifiedActiveTab('profile');
      return;
    }

    setIsSavingUnified(true);
    try {
      const numPrice = typeof unifiedPlanPrice === 'string' ? (parseFloat(unifiedPlanPrice) || 0) : unifiedPlanPrice;
      const safeCurr = (unifiedPlanCurrency && unifiedPlanCurrency !== 'USD' && unifiedPlanCurrency !== '$') 
        ? unifiedPlanCurrency 
        : (unifiedCurrency.trim() && unifiedCurrency.trim() !== 'USD' && unifiedCurrency.trim() !== '$')
        ? unifiedCurrency.trim()
        : 'Nu.';
      const finalPrice = (numPrice === 25 && safeCurr === 'Nu.') ? 1800 : numPrice;
      const planDetails: SubscriptionPlanDetails = {
        planName: unifiedPlanName.trim() || 'Commercial Plan',
        price: finalPrice,
        currency: safeCurr,
        billingCycle: unifiedPlanCycle,
        expiresAt: unifiedPlanExpiresAt || undefined,
        notes: unifiedPlanNotes.trim() || undefined
      };
      const serializedPlan = JSON.stringify(planDetails);

      const updates: Partial<SupabaseCompany> = {
        company_name: unifiedCompanyName.trim(),
        trade_license_no: unifiedTradeLicense.trim() || undefined,
        tax_payer_id: unifiedTaxId.trim() || undefined,
        phone: unifiedPhone.trim() || undefined,
        email: unifiedEmail.trim() || undefined,
        address: unifiedAddress.trim() || undefined,
        currency_symbol: safeCurr,
        is_active: unifiedIsActive,
        allowed_counters: unifiedAllowedCounters,
        admin_username: unifiedAdminUsername.trim() || 'admin',
        admin_password: unifiedAdminPassword.trim() || 'ClientPass@123',
        admin_pin: unifiedAdminPin.trim() || '1234',
        subscription_plan: serializedPlan,
        subscription_expires_at: unifiedPlanExpiresAt || undefined
      };

      await updateCompany(unifiedClient.id, updates);
      await updateCompanyStatus(unifiedClient.id, unifiedIsActive);

      saveCompanyFeatures(unifiedClient.id, editingFeatures);
      setMaxTerminalLimit(unifiedAllowedCounters, unifiedClient.id);

      setCompanies(prev =>
        prev.map(c =>
          c.id === unifiedClient.id
            ? { ...c, ...updates }
            : c
        )
      );

      setFeedbackMsg({
        type: 'success',
        text: `All changes for "${unifiedCompanyName.trim()}" (Profile, Login Credentials, Features & Plan) have been saved successfully!`
      });
      setUnifiedClient(null);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to save client settings' });
    } finally {
      setIsSavingUnified(false);
    }
  };

  // Open features modal for existing company (redirects to unified hub)
  const handleOpenFeaturesModal = (company: SupabaseCompany) => {
    handleOpenUnifiedClient(company, 'features');
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

  // Hidden restaurant sub-features automatically synced with EnableRestaurantMode in Superadmin
  const HIDDEN_FROM_SUPERADMIN_CHECKLIST = [
    'EnableTableBilling',
    'EnableDigitalMenuQR',
    'EnableQRDirectOrdering',
    'EnableWaiterMobilePad',
    'EnableKDSAndKitchenIssue'
  ];

  // Preset apply helper
  const handleApplyPreset = (preset: FeaturePreset, target: 'new' | 'edit') => {
    let nextMap = { ...preset.features };
    const isRest = nextMap.EnableRestaurantMode === true;
    nextMap.EnableTableBilling = isRest;
    nextMap.EnableDigitalMenuQR = isRest;
    nextMap.EnableQRDirectOrdering = isRest;
    nextMap.EnableWaiterMobilePad = isRest;
    nextMap.EnableKDSAndKitchenIssue = isRest;

    // When Restaurant POS is enabled in preset, normal retail POS should be off
    if (isRest) {
      nextMap.EnablePOS = false;
    }

    if (target === 'new') {
      setNewFeatures(nextMap);
      setNewSelectedPresetId(preset.id);
    } else {
      setEditingFeatures(nextMap);
      setEditingPresetId(preset.id);
    }
  };

  // Toggle individual feature
  const handleToggleFeature = (featureId: string, target: 'new' | 'edit') => {
    const isNew = target === 'new';
    const currentMap = isNew ? newFeatures : editingFeatures;
    const currentVal = currentMap[featureId] === true;
    const nextVal = !currentVal;

    let updatedMap: Record<string, boolean> = {
      ...currentMap,
      [featureId]: nextVal
    };

    if (featureId === 'EnableRestaurantMode') {
      updatedMap.EnableTableBilling = nextVal;
      updatedMap.EnableDigitalMenuQR = nextVal;
      updatedMap.EnableQRDirectOrdering = nextVal;
      updatedMap.EnableWaiterMobilePad = nextVal;
      updatedMap.EnableKDSAndKitchenIssue = nextVal;

      // When Restaurant POS is enabled, normal retail POS should be off
      if (nextVal) {
        updatedMap.EnablePOS = false;
      }
    }

    if (featureId === 'EnablePOS') {
      // When normal retail POS is enabled, Restaurant POS and its subfeatures should be off
      if (nextVal) {
        updatedMap.EnableRestaurantMode = false;
        updatedMap.EnableTableBilling = false;
        updatedMap.EnableDigitalMenuQR = false;
        updatedMap.EnableQRDirectOrdering = false;
        updatedMap.EnableWaiterMobilePad = false;
        updatedMap.EnableKDSAndKitchenIssue = false;
      }
    }

    if (isNew) {
      setNewFeatures(updatedMap);
      setNewSelectedPresetId(null);
    } else {
      setEditingFeatures(updatedMap);
      setEditingPresetId(null);
    }
  };

  // Select/Deselect All
  const handleSetAllFeatures = (enable: boolean, target: 'new' | 'edit') => {
    const nextMap: Record<string, boolean> = {};
    ALL_SYSTEM_FEATURES.forEach(f => {
      nextMap[f.id] = enable;
    });
    nextMap.EnableTableBilling = enable;
    nextMap.EnableDigitalMenuQR = enable;
    nextMap.EnableQRDirectOrdering = enable;
    nextMap.EnableWaiterMobilePad = enable;
    nextMap.EnableKDSAndKitchenIssue = enable;

    // When Restaurant POS is enabled, normal retail POS should be off
    if (enable) {
      nextMap.EnablePOS = false;
    }

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

  // Open Plan Modal for Tenant (redirects to Unified Hub)
  const handleOpenPlanModal = (company: SupabaseCompany) => {
    handleOpenUnifiedClient(company, 'plan');
  };

  // Quick Preset Selector for Plan Modal
  const applyPlanPreset = (presetKey: string) => {
    setPlanFormTier(presetKey);
    setPlanFormCurrency('Nu.');
    if (presetKey === 'free') {
      setPlanFormName('Free Trial');
      setPlanFormPrice(0);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(1);
    } else if (presetKey === 'starter') {
      setPlanFormName('Starter Tier');
      setPlanFormPrice(1000);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(1);
    } else if (presetKey === 'commercial') {
      setPlanFormName('Commercial Plan');
      setPlanFormPrice(1800);
      setPlanFormCycle('monthly');
      setPlanFormAllowedCounters(2);
    } else if (presetKey === 'enterprise') {
      setPlanFormName('Enterprise Tier');
      setPlanFormPrice(3500);
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
      const safePlanCurr = (planFormCurrency && planFormCurrency !== 'USD' && planFormCurrency !== '$') ? planFormCurrency : 'Nu.';
      const finalPrice = (numPrice === 25 && safePlanCurr === 'Nu.') ? 1800 : numPrice;
      const planDetails: SubscriptionPlanDetails = {
        planName: planFormName.trim() || 'Commercial Plan',
        price: finalPrice,
        currency: safePlanCurr,
        billingCycle: planFormCycle,
        expiresAt: planFormExpiresAt || undefined,
        notes: planFormNotes.trim() || undefined
      };

      const serializedPlan = JSON.stringify(planDetails);
      const updates: Partial<SupabaseCompany> = {
        currency_symbol: safePlanCurr,
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
              ? { ...c, currency_symbol: safePlanCurr, subscription_plan: serializedPlan, subscription_expires_at: planFormExpiresAt || undefined, allowed_counters: planFormAllowedCounters }
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
    const safeCurr = (editGlobalCurrency && editGlobalCurrency !== 'USD' && editGlobalCurrency !== '$') ? editGlobalCurrency : 'Nu.';
    const finalPrice = (numPrice === 25 && safeCurr === 'Nu.') ? 1800 : numPrice;
    const newSettings: GlobalPricingSettings = {
      defaultPrice: finalPrice,
      defaultCurrency: safeCurr,
      defaultTierName: editGlobalTierName.trim() || 'Commercial'
    };
    saveGlobalPricingSettings(newSettings);
    setGlobalPricing(newSettings);
    setShowGlobalPricingModal(false);
    setFeedbackMsg({
      type: 'success',
      text: `Updated global default platform pricing benchmark to ${safeCurr === 'Nu.' ? 'Nu. ' : `${safeCurr} `}${newSettings.defaultPrice}/mo (${newSettings.defaultTierName}).`
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
      const safeCompCurr = (c.currency_symbol && c.currency_symbol !== 'USD' && c.currency_symbol !== '$') ? c.currency_symbol : 'Nu.';
      const plan = parseSubscriptionPlan(c.subscription_plan, globalPricing, safeCompCurr);
      const monthlyPrice = plan.billingCycle === 'yearly'
        ? Math.round(plan.price / 12)
        : plan.billingCycle === 'quarterly'
        ? Math.round(plan.price / 3)
        : plan.price;

      const rawCurr = plan.currency || globalPricing.defaultCurrency || 'Nu.';
      const curr = (rawCurr && rawCurr !== 'USD' && rawCurr !== '$') ? rawCurr : 'Nu.';
      totalsByCurrency[curr] = (totalsByCurrency[curr] || 0) + monthlyPrice;
    });

    const entries = Object.entries(totalsByCurrency);
    if (entries.length === 0) {
      const rawCurr = globalPricing.defaultCurrency || 'Nu.';
      const curr = (rawCurr && rawCurr !== 'USD' && rawCurr !== '$') ? rawCurr : 'Nu.';
      const currSymbol = curr === 'Nu.' || curr === 'BTN' ? 'Nu. ' : curr === 'INR' ? '₹' : `${curr} `;
      return {
        displayValue: `${currSymbol}0`,
        suffix: `${curr === 'Nu.' ? 'BTN' : curr} / Month`,
        subtitle: `${currSymbol}${globalPricing.defaultPrice}/mo default benchmark rate`,
        totalCount: 0
      };
    }

    if (entries.length === 1) {
      const [curr, total] = entries[0];
      const symbol = curr === 'Nu.' || curr === 'BTN' ? 'Nu. ' : curr === 'INR' ? '₹' : `${curr} `;
      return {
        displayValue: `${symbol}${total.toLocaleString()}`,
        suffix: `${curr === 'Nu.' ? 'BTN' : curr} / Month`,
        subtitle: `Calculated from ${activeTenants} active client ${activeTenants === 1 ? 'tier' : 'tiers'}`,
        totalCount: activeTenants
      };
    }

    // Multi-currency display
    const formattedParts = entries.map(([curr, total]) => {
      const symbol = curr === 'Nu.' || curr === 'BTN' ? 'Nu. ' : curr === 'INR' ? '₹' : `${curr} `;
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
    const visibleSystemFeatures = ALL_SYSTEM_FEATURES.filter(f => !HIDDEN_FROM_SUPERADMIN_CHECKLIST.includes(f.id));
    const totalActive = visibleSystemFeatures.filter(f => features[f.id] === true).length;
    const categories: Array<'Billing & POS' | 'Inventory & Variants' | 'Taxation & Accounts' | 'HR, Assets & Modules'> = [
      'Billing & POS',
      'Inventory & Variants',
      'Taxation & Accounts',
      'HR, Assets & Modules'
    ];

    return (
      <div className="space-y-4 text-slate-800">
        {/* Preset Bot Row */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-xs block">Industry Preset Bot (7 Dedicated Presets)</span>
                <p className="text-[10px] text-slate-500">
                  Select an industry template to auto-toggle features. Payroll, HR, Assets & Warehouses are restricted to Enterprise.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold border border-emerald-200">
                {totalActive} / {visibleSystemFeatures.length} Modules Active
              </span>
              <button
                type="button"
                onClick={() => handleSetAllFeatures(true, target)}
                className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded text-[10px] font-bold border border-slate-200 shadow-xs transition cursor-pointer"
              >
                All ON
              </button>
              <button
                type="button"
                onClick={() => handleSetAllFeatures(false, target)}
                className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded text-[10px] font-bold border border-slate-200 shadow-xs transition cursor-pointer"
              >
                All OFF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
            {FEATURE_PRESETS.map(preset => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset, target)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold truncate">{preset.badge}</span>
                    {isSelected && (
                      <span className="px-1 py-0.2 bg-indigo-600 text-[8px] font-mono text-white rounded font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categorized Feature Checklist */}
        <div className="space-y-3.5">
          {categories.map(category => {
            const categoryFeatures = ALL_SYSTEM_FEATURES.filter(
              f => f.category === category && !HIDDEN_FROM_SUPERADMIN_CHECKLIST.includes(f.id)
            );
            const activeInCategory = categoryFeatures.filter(f => features[f.id] === true).length;
            return (
              <div key={category} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{category}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {activeInCategory} / {categoryFeatures.length} Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryFeatures.map(feat => {
                    const isEnabled = features[feat.id] === true;
                    const isRestaurantMode = feat.id === 'EnableRestaurantMode';
                    return (
                      <div
                        key={feat.id}
                        onClick={() => handleToggleFeature(feat.id as string, target)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 select-none ${
                          isEnabled
                            ? 'bg-indigo-50/45 border-indigo-200 hover:border-indigo-350'
                            : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 opacity-80'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                              {feat.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{feat.shortDesc}</p>
                          {isRestaurantMode && (
                            <div className="mt-1 text-[9px] font-bold text-amber-700 flex items-center gap-1">
                              <span>⚡ Auto-enables Digital Menu, KDS, Table Grid & Waiter Pad for client</span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 pt-0.5 flex flex-col items-end gap-1">
                          <div
                            className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                              isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                isEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                          <span className={`text-[9px] font-bold ${isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
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
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center bg-white rounded-3xl border border-slate-200 shadow-sm m-4">
        <div className="h-20 w-20 rounded-3xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-5 shadow-lg shadow-rose-100">
          <Lock className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">
          Restricted Access Area
        </h2>
        <p className="text-slate-600 max-w-md text-sm mb-6 leading-relaxed">
          The Superadmin Tenant Control Panel is strictly restricted to platform administrators with superadmin privileges in the <code className="text-rose-700 font-mono text-xs">company_users</code> registry.
        </p>
        <button
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="py-2.5 px-5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs transition cursor-pointer flex items-center gap-2"
        >
          <span>Return to Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 animate-in fade-in duration-200 text-slate-800">
      {/* Top Banner Header - Compact Height */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 border border-indigo-700 py-3 px-4 sm:py-3.5 sm:px-6 rounded-2xl shadow-lg shadow-indigo-600/10 text-white">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.2 rounded-full bg-white/20 border border-white/10 text-white text-[10px] font-mono font-bold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-white" />
              <span>SUPERADMIN ACCESS RESTRICTED</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500 border border-emerald-400 text-white text-[9px] font-bold font-mono">
              Live RLS Sync
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Tenant Control Panel</span>
          </h1>
          <p className="text-xs text-indigo-100 mt-0.5">
            Master multi-tenant registry, commercial subscription status, and tenant isolation controls.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadMasterCompanies}
            disabled={isLoading}
            className="py-1.5 px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            title="Refresh tenants list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="py-1.5 px-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98] border border-amber-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Provision Client Tenant</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-3 border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
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

      {/* ====================================================================== */}
      {/* UNIFIED COMPACT COMMAND BAR (ONE SINGLE ROW)                            */}
      {/* Combines Total Tenants & Subscriptions with Supabase Storage Telemetry */}
      {/* ====================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-x-3 sm:gap-x-4 gap-y-2">
        {/* 1. Total Tenants */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 shrink-0">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Tenants</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-slate-900 leading-none">{totalTenants}</span>
              <span className="text-[9px] text-slate-400 font-mono">RLS</span>
            </div>
          </div>
        </div>

        {/* 2. Active Subscriptions */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Active</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-emerald-600 leading-none">{activeTenants}</span>
              <span className="text-[9px] text-slate-400 font-medium">({inactiveTenants} off)</span>
            </div>
          </div>
        </div>

        {/* 3. Estimated MRR */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 shrink-0">
            <CreditCard className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1 leading-none">
              <span className="text-[10px] uppercase font-bold text-slate-400">MRR</span>
              <button
                type="button"
                onClick={() => {
                  setEditGlobalPrice(globalPricing.defaultPrice);
                  setEditGlobalCurrency(globalPricing.defaultCurrency);
                  setEditGlobalTierName(globalPricing.defaultTierName);
                  setShowGlobalPricingModal(true);
                }}
                className="text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                title="Configure platform benchmark pricing"
              >
                <Settings2 className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="text-sm font-black text-indigo-600 leading-none">{mrrData.displayValue}</span>
              <span className="text-[9px] text-slate-400 font-medium">{mrrData.suffix}</span>
            </div>
          </div>
        </div>

        {/* 4. Plan Limits Tracker */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-600 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Limit</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-slate-800 leading-none">{totalTenants}/{RECOMMENDED_TENANT_QUOTA}</span>
              <div className="w-10 sm:w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-emerald-600 leading-none">{quotaPercent}%</span>
            </div>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="hidden xl:block h-6 w-px bg-slate-200 shrink-0" />

        {/* 5. Consumed Storage */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-900 text-indigo-400 rounded-lg shrink-0">
            <HardDrive className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Storage</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-slate-900 leading-none">
                {formatBytes(storageOverview?.totalBytesUsed || 0)}
              </span>
              <span className="text-[9px] text-indigo-600 font-mono font-bold">
                ({storageOverview?.usagePercentage || 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* 6. Storage Headroom */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Headroom</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-emerald-600 leading-none">
                {formatBytes(storageOverview?.balanceBytesRemaining || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* 7. Total Records */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600 shrink-0">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Records</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-slate-900 leading-none">
                {(storageOverview?.totalRowsCount || 0).toLocaleString()}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">rows</span>
            </div>
          </div>
        </div>

        {/* 8. Realtime Sockets & Latency */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-600 shrink-0 relative">
            <Activity className="h-3.5 w-3.5" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Realtime</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-black text-slate-900 leading-none">
                {storageOverview?.activeRealtimeConnections || companies.length}/{storageOverview?.realtimeQuota || 200}
              </span>
              <span className="text-[9px] text-emerald-600 font-mono font-bold">
                ~{storageOverview?.pingMs || 24}ms
              </span>
            </div>
          </div>
        </div>

        {/* 9. Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => {
              setQuotaInputMB(getStorageQuotaMB());
              setShowQuotaModal(true);
            }}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 transition cursor-pointer flex items-center gap-1"
            title="Configure platform storage quota limit (e.g. Free Tier 500MB vs Pro Tier 8GB)"
          >
            <Settings2 className="h-3 w-3 text-slate-500" />
            <span>Quota: {getStorageQuotaMB() >= 1024 ? `${(getStorageQuotaMB() / 1024).toFixed(1)} GB` : `${getStorageQuotaMB()} MB`}</span>
          </button>

          <button
            type="button"
            onClick={() => loadStorageTelemetry(companies)}
            disabled={isLoadingStorage}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
            title="Re-scan Supabase storage & latency"
          >
            <RefreshCw className={`h-3 w-3 ${isLoadingStorage ? 'animate-spin' : ''}`} />
            <span>{isLoadingStorage ? 'Scanning...' : 'Scan DB'}</span>
          </button>
        </div>
      </div>

      {/* Main Client Overview Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        {/* Table Filters & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1 min-w-0">
            <div className="relative w-full md:w-80">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search clients by name, ID, license..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
            <span className="hidden xl:inline text-[11px] text-slate-400 font-medium truncate">
              💡 Tip: Click any client row to view &amp; edit full business details, passwords &amp; features
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-start md:self-auto w-full md:w-auto overflow-x-auto pb-1 md:pb-0 shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Clients ({totalTenants})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
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
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Suspended ({inactiveTenants})</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SMARTPHONE CLIENT CARDS VIEW (block md:hidden)           */}
        {/* Optimized for mobile touch, big touch targets >= 44px     */}
        {/* ======================================================== */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
              <span className="text-xs">Fetching client database records...</span>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <span className="font-bold text-slate-900 text-sm block">No clients found</span>
              <span className="text-xs text-slate-400">Try adjusting your search criteria.</span>
            </div>
          ) : (
            filteredCompanies.map(company => {
              const isActive = company.is_active !== false;
              const isToggling = togglingId === company.id;
              const plan = parseSubscriptionPlan(company.subscription_plan, globalPricing, company.currency_symbol || 'Nu.');
              const badge = formatPlanBadge(plan);
              const limit = company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id);

              return (
                <div
                  key={company.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-indigo-300 transition"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      onClick={() => handleOpenUnifiedClient(company)}
                      className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0"
                    >
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isActive
                          ? 'bg-blue-50 border border-blue-100 text-blue-600'
                          : 'bg-rose-50 border border-rose-100 text-rose-600'
                      }`}>
                        <Building2 className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{company.company_name}</span>
                          {company.id === DEFAULT_TENANT_COMPANY.id && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <span className="truncate max-w-[130px]" title={company.id}>ID: {company.id.slice(0, 8)}...</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyPortalUrl(company.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Copy Portal Link"
                          >
                            {copiedId === company.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Status switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(company)}
                      disabled={isToggling}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition shrink-0 cursor-pointer ${
                        isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {isToggling ? 'Updating...' : isActive ? '● Active' : '○ Suspended'}
                    </button>
                  </div>

                  {/* Details metadata */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Trade License / TPN:</span>
                      <span className="font-bold text-slate-700 truncate block">{company.trade_license_no || company.tax_payer_id || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Plan &amp; Desks:</span>
                      <span className="font-semibold text-indigo-700 truncate block">{badge.label} · {limit === 0 ? 'Unlimited' : `${limit} Desk`}</span>
                    </div>
                    {company.phone && (
                      <div className="col-span-2 flex items-center gap-1.5 text-slate-600 truncate">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <a href={`tel:${company.phone}`} className="hover:underline">{company.phone}</a>
                        {company.address && <span className="text-slate-400 truncate">· {company.address}</span>}
                      </div>
                    )}
                  </div>

                  {/* Smartphone Storage Consumption Pill */}
                  {(() => {
                    const cs = storageOverview?.clientStats[company.id];
                    const bytes = cs?.totalBytes || 1024;
                    const rows = cs?.totalRows || 1;
                    const pct = cs?.percentageOfTotal || 0;
                    return (
                      <div 
                        onClick={() => handleOpenUnifiedClient(company, 'storage')}
                        className="flex items-center justify-between bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 rounded-xl px-3 py-2 text-[11px] transition cursor-pointer"
                        title="Click to view full database storage breakdown"
                      >
                        <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                          <HardDrive className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-700">Storage:</span>
                          <span className="font-mono font-bold text-slate-900">{formatBytes(bytes)}</span>
                          <span className="text-[10px] text-slate-400 truncate">({rows} rows)</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                            {pct}% share
                          </span>
                          <ChevronRight className="h-3 w-3 text-slate-400" />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Primary Touch Action: Manage Client (Profile, Credentials, Features, Links) */}
                  <button
                    type="button"
                    onClick={() => handleOpenUnifiedClient(company)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                  >
                    <Sliders className="h-4 w-4" />
                    <span>Manage Client (Profile, Password &amp; Features)</span>
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>

                  {/* Quick Mobile Icons Row */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCopyPortalUrl(company.id)}
                      className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 border border-slate-200 min-h-[40px] cursor-pointer"
                      title="Copy Client Portal URL"
                    >
                      {copiedId === company.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ExternalLink className="h-3.5 w-3.5 text-blue-600" />}
                      <span>{copiedId === company.id ? 'Copied' : 'ERP Link'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyStaffPortalUrl(company.id)}
                      className="py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 border border-slate-200 min-h-[40px] cursor-pointer"
                      title="Copy Staff Portal URL"
                    >
                      {copiedStaffId === company.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Users className="h-3.5 w-3.5 text-emerald-600" />}
                      <span>{copiedStaffId === company.id ? 'Copied' : 'Staff PWA'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEnterClientWorkspace(company)}
                      className="py-2 px-2 rounded-xl bg-slate-850 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1 min-h-[40px] cursor-pointer"
                      title="Enter Store Workspace"
                    >
                      <span>Enter</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ======================================================== */}
        {/* DESKTOP CLIENT TABLE VIEW (hidden md:block)              */}
        {/* Clean, spacious & executive: full details in 360° modal   */}
        {/* ======================================================== */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-[35%]">Commercial Client</th>
                <th className="py-3.5 px-3 w-[18%]">Commercial Plan</th>
                <th className="py-3.5 px-3 w-[18%]">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Supabase Storage</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 w-[12%] text-center">Status</th>
                <th className="py-3.5 px-4 w-[17%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                      <span>Fetching client database records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="h-8 w-8 text-slate-400" />
                      <span className="font-black text-slate-900 text-sm">No clients matched your filter</span>
                      <span className="text-xs text-slate-400">Try adjusting your search criteria or register a new company.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(company => {
                  const isActive = company.is_active !== false;
                  const isToggling = togglingId === company.id;
                  const plan = parseSubscriptionPlan(company.subscription_plan, globalPricing, company.currency_symbol || 'Nu.');
                  const badge = formatPlanBadge(plan);
                  const limit = company.allowed_counters !== undefined ? company.allowed_counters : getMaxTerminalLimit(company.id);
                  const cs = storageOverview?.clientStats[company.id];
                  const bytes = cs?.totalBytes || 1024;
                  const rows = cs?.totalRows || 1;
                  const pct = cs?.percentageOfTotal || 0;

                  return (
                    <tr
                      key={company.id}
                      className="hover:bg-indigo-50/40 transition group cursor-pointer"
                      onClick={() => handleOpenUnifiedClient(company)}
                    >
                      {/* Column 1: Client Name, Avatar & Clean Subtitle */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition ${
                            isActive
                              ? 'bg-blue-50 border border-blue-200/80 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                              : 'bg-rose-50 border border-rose-200/80 text-rose-600 group-hover:bg-rose-600 group-hover:text-white'
                          }`}>
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                              <span className="group-hover:text-indigo-600 transition truncate max-w-[260px] lg:max-w-[340px]">
                                {company.company_name}
                              </span>
                              {company.id === DEFAULT_TENANT_COMPANY.id && (
                                <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shrink-0">
                                  Default Store
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                ID: {company.id.slice(0, 8)}...
                              </span>
                              {(company.email || company.phone || company.address) && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500 truncate max-w-[220px]">
                                    {company.email || company.phone || company.address}
                                  </span>
                                </>
                              )}
                              <span className="text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition text-[10px] ml-1">
                                Click to edit →
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Commercial Plan */}
                      <td className="py-3.5 px-3" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-start gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenUnifiedClient(company, 'plan')}
                            className="group/plan inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-800 hover:text-indigo-700 text-[11px] font-medium font-mono transition cursor-pointer shadow-2xs"
                            title="Click to edit Commercial Plan & pricing"
                          >
                            <CreditCard className="h-3 w-3 text-indigo-500 shrink-0" />
                            <span className="font-bold">{badge.label}</span>
                            <Pencil className="h-2.5 w-2.5 text-slate-400 group-hover/plan:text-indigo-600 ml-0.5" />
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {limit === 0 ? 'Unlimited Desks' : `${limit} Desk${limit > 1 ? 's' : ''}`}
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Supabase Storage */}
                      <td className="py-3.5 px-3" onClick={e => { e.stopPropagation(); handleOpenUnifiedClient(company, 'storage'); }}>
                        <div className="flex flex-col gap-1 min-w-[125px] group/storage cursor-pointer" title="Click to view full client database & entity breakdown">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-800 group-hover/storage:text-indigo-600 transition flex items-center gap-1">
                              <HardDrive className="h-3 w-3 text-indigo-500" />
                              <span>{formatBytes(bytes)}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {rows} rows
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-medium text-slate-500">{pct}% share</span>
                            <span className="text-indigo-600 opacity-0 group-hover/storage:opacity-100 transition text-[9px] font-bold">Details →</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Account Status */}
                      <td className="py-3.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(company)}
                            disabled={isToggling}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={isActive ? 'Click to suspend / lock tenant' : 'Click to activate / unlock tenant'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          
                          <span className={`text-[10px] font-bold ${
                            isActive ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {isToggling ? 'Updating...' : isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </td>

                      {/* Column 5: Clean Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenUnifiedClient(company)}
                            className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Open Client 360 Hub to edit Profile, Credentials, Features, Plan & Storage"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            <span>Manage Client</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEnterClientWorkspace(company)}
                            className="py-1.5 px-2.5 bg-slate-850 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            title="Switch active workspace into this store"
                          >
                            <span>Enter Store</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleCopyPortalUrl(company.id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                              title="Copy Store ERP Link"
                            >
                              {copiedId === company.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ExternalLink className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyStaffPortalUrl(company.id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                              title="Copy Staff Portal Link"
                            >
                              {copiedStaffId === company.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Users className="h-3.5 w-3.5" />}
                            </button>
                          </div>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-slate-850">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Provision New Commercial Client</h3>
                  <p className="text-xs text-slate-500 font-medium">Creates isolated workspace, admin credentials & financial year</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
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
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
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
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Bot className="h-3.5 w-3.5 text-indigo-600" />
                <span>2. Feature Checklist & Presets</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-[10px] font-mono text-indigo-700 border border-slate-300">
                  {ALL_SYSTEM_FEATURES.filter(f => newFeatures[f.id] === true).length} Active
                </span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateCompany} className="flex-1 overflow-y-auto pt-3 pb-2 text-left text-xs space-y-4 pr-1">
              {newCompanyActiveTab === 'details' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Company / Store Name *</label>
                    <input
                      type="text"
                      required
                      value={newCompanyName}
                      onChange={e => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Paro Wholesale Mart"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Trade License No</label>
                      <input
                        type="text"
                        value={newTradeLicense}
                        onChange={e => setNewTradeLicense(e.target.value)}
                        placeholder="TRD-2026-XXXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Tax Payer ID (TPN)</label>
                      <input
                        type="text"
                        value={newTaxId}
                        onChange={e => setNewTaxId(e.target.value)}
                        placeholder="TPN-XXXXXXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="admin@clientstore.bt"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="+975 17 XXX XXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Store Address</label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={e => setNewAddress(e.target.value)}
                      placeholder="Main Town, Dzongkhag, Bhutan"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-850 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Allowed Active POS Counters Limit */}
                  <div className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Allowed Active Counters Limit (Superadmin Control)</span>
                      </span>
                      <span className="text-[10px] font-mono text-indigo-600 font-bold">
                        {newAllowedCounters === 0 ? 'Unlimited' : `${newAllowedCounters} Counter${newAllowedCounters > 1 ? 's' : ''}`}
                      </span>
                    </label>
                    <select
                      value={newAllowedCounters}
                      onChange={e => setNewAllowedCounters(parseInt(e.target.value, 10))}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-slate-800 font-semibold text-xs focus:border-indigo-500 focus:outline-none shadow-xs"
                    >
                      <option value={1}>1 Terminal (Single Counter Plan - Default)</option>
                      <option value={2}>2 Terminals (Dual Cashier Counters)</option>
                      <option value={3}>3 Terminals (3-Desk Setup)</option>
                      <option value={4}>4 Terminals (4-Desk Setup)</option>
                      <option value={5}>5 Terminals (5-Desk Setup)</option>
                      <option value={0}>Unlimited Terminals (Enterprise Tier)</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Enforces how many POS billing counters this client can simultaneously activate on their system.
                    </p>
                  </div>

                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-indigo-800 block">Initial Store Admin Login Setup</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-1">Admin Username</label>
                        <input
                          type="text"
                          value={newAdminUsername}
                          onChange={e => setNewAdminUsername(e.target.value)}
                          placeholder="admin"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-medium mb-1">Initial PIN Code</label>
                        <input
                          type="text"
                          value={newAdminPin}
                          onChange={e => setNewAdminPin(e.target.value)}
                          placeholder="1234"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:border-indigo-500 focus:outline-none"
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
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold"
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
                      className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next: Configure Features</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNewCompanyActiveTab('details')}
                      className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition border border-slate-200 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-slate-850">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Client Feature Permissions</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Managing active modules for <span className="text-indigo-600 font-bold">"{managingCompany.company_name}"</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCompany(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Notice */}
            <div className="py-2.5 px-3.5 bg-amber-50 border border-amber-200 rounded-xl my-3 text-[11px] text-amber-800 leading-relaxed shrink-0">
              <span className="font-bold">Superadmin Policy:</span> Modules turned <span className="font-bold text-rose-700">OFF</span> are completely hidden from the client's screen, sidebar, and settings menu. Whatever modules are left <span className="font-bold text-emerald-700">ON</span>, the client can use freely.
            </div>

            {/* Allowed Active POS Counters Limit */}
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl mb-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Authorized POS Billing Counters Limit</span>
                  </label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Maximum number of active cashier desks/terminals this client can run concurrently.
                  </p>
                </div>
                <div className="min-w-[200px]">
                  <select
                    value={managingAllowedCounters}
                    onChange={e => setManagingAllowedCounters(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-slate-800 font-semibold text-xs focus:border-indigo-500 focus:outline-none shadow-xs"
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
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setManagingCompany(null)}
                className="py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold text-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 flex flex-col max-h-[90vh] text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Commercial Subscription Plan</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Set tier, pricing & billing interval for <span className="text-indigo-600 font-bold">{editingPlanCompany.company_name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCompanyPlan} className="flex-1 overflow-y-auto pt-4 pb-2 space-y-4 text-xs">
              {/* Quick Plan Preset Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Select Plan Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'free', label: 'Free Trial', priceLabel: '0 / Free' },
                    { id: 'starter', label: 'Starter', priceLabel: 'Nu. 1,000/mo' },
                    { id: 'commercial', label: 'Commercial', priceLabel: 'Nu. 1,800/mo' },
                    { id: 'enterprise', label: 'Enterprise', priceLabel: 'Nu. 3,500/mo' },
                  ].map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPlanPreset(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        planFormTier === preset.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950 hover:border-slate-350'
                      }`}
                    >
                      <div className="font-bold text-xs">{preset.label}</div>
                      <div className="text-[10px] text-indigo-600 font-mono mt-0.5">{preset.priceLabel}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Plan Tier Name *</label>
                  <input
                    type="text"
                    required
                    value={planFormName}
                    onChange={e => {
                      setPlanFormName(e.target.value);
                      setPlanFormTier('custom');
                    }}
                    placeholder="e.g. Commercial Plan"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Billing Price / Rate *</label>
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
                    placeholder="1800"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Currency & Billing Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Currency</label>
                  <select
                    value={planFormCurrency}
                    onChange={e => setPlanFormCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition font-bold"
                  >
                    <option value="Nu.">Nu. (BTN - Bhutanese Ngultrum)</option>
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Billing Cycle</label>
                  <select
                    value={planFormCycle}
                    onChange={e => setPlanFormCycle(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
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
                  <label className="block text-slate-700 font-bold mb-1">Subscription / Renewal Expiry (Optional)</label>
                  <input
                    type="date"
                    value={planFormExpiresAt}
                    onChange={e => setPlanFormExpiresAt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Admin Notes (Optional)</label>
                  <input
                    type="text"
                    value={planFormNotes}
                    onChange={e => setPlanFormNotes(e.target.value)}
                    placeholder="e.g. Contract signed, direct invoice"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Allowed POS Counters / Terminal Licenses */}
              <div className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-1.5">
                <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-indigo-800">
                    <Sliders className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Authorized POS Billing Counters Limit (Superadmin Control)</span>
                  </span>
                  <span className="text-indigo-600 font-mono text-[10px] font-bold">
                    {planFormAllowedCounters === 0 ? 'Unlimited Desks' : `${planFormAllowedCounters} Counter${planFormAllowedCounters > 1 ? 's' : ''}`}
                  </span>
                </label>
                <select
                  value={planFormAllowedCounters}
                  onChange={e => setPlanFormAllowedCounters(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:border-indigo-550 shadow-xs"
                >
                  <option value={1}>1 Terminal (Single Counter Plan - Default)</option>
                  <option value={2}>2 Terminals (Dual Cashier Counters)</option>
                  <option value={3}>3 Terminals (3-Desk Setup)</option>
                  <option value={4}>4 Terminals (4-Desk Setup)</option>
                  <option value={5}>5 Terminals (5-Desk Setup)</option>
                  <option value={0}>Unlimited Terminals (Enterprise Unlimited)</option>
                </select>
                <p className="text-[10px] text-slate-500">
                  Controls how many active billing counters or client terminals this company can register and run simultaneously.
                </p>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Live Badge Preview</span>
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-700 font-mono text-xs font-bold">
                          <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{badge.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-900 block font-bold uppercase tracking-wider">Monthly MRR Value</span>
                  <span className="text-sm font-black text-emerald-600 font-mono">
                    {(() => {
                      const numP = typeof planFormPrice === 'string' ? (parseFloat(planFormPrice) || 0) : planFormPrice;
                      const sym = (planFormCurrency === 'INR' || planFormCurrency === '₹') ? '₹' : 'Nu. ';
                      const monthly = planFormCycle === 'yearly' ? Math.round(numP / 12) : planFormCycle === 'quarterly' ? Math.round(numP / 3) : numP;
                      return `${sym}${monthly.toLocaleString()}/mo`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold text-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-6 flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-55 bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Global Pricing Benchmark</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Default rate for unassigned companies & baseline MRR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGlobalPricingModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGlobalPricing} className="pt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-750 font-bold mb-1">Default Plan Tier Name</label>
                <input
                  type="text"
                  required
                  value={editGlobalTierName}
                  onChange={e => setEditGlobalTierName(e.target.value)}
                  placeholder="Commercial"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-750 font-bold mb-1">Default Monthly Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editGlobalPrice}
                    onChange={e => setEditGlobalPrice(e.target.value)}
                    placeholder="1800"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-slate-750 font-bold mb-1">Default Currency</label>
                  <select
                    value={editGlobalCurrency}
                    onChange={e => setEditGlobalCurrency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition font-bold"
                  >
                    <option value="Nu.">Nu. (BTN)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-800">Note:</span> Individual client companies with custom plans configured will keep their specific pricing. This setting controls the default baseline rate and fallback for MRR estimation.
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowGlobalPricingModal(false)}
                  className="py-2 px-4 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition font-bold text-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-amber-300 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 text-left text-slate-800">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Client Data Privacy Active
                </span>
                <h3 className="font-bold text-lg text-slate-900 mt-1">Platform Support Access is OFF</h3>
              </div>
            </div>

            <p className="text-xs text-slate-650 leading-relaxed mb-4">
              The owner of <strong className="text-slate-950">"{privacyBlockedCompany.company_name}"</strong> has set Platform Support Access to <span className="text-amber-700 font-bold">OFF</span> to protect confidential business books, daily sales, and customer ledger balances.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 mb-5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Client records, day books, and financial transactions are protected from unauthorized observation.</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span>If this client requires remote assistance, request their Company Admin to toggle on <strong>"Allow Platform Support Access"</strong> in <span className="text-slate-900 font-semibold">Settings → Security & Permissions</span>.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPrivacyBlockedCompany(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer font-bold border border-slate-200"
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

      {/* ======================================================== */}
      {/* UNIFIED CLIENT 360° MANAGEMENT HUB MODAL                  */}
      {/* All-in-one: Store Profile, Credentials, Features, Links, Plan */}
      {/* ======================================================== */}
      {unifiedClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[95vh] sm:max-h-[90vh] text-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  unifiedIsActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-rose-600 text-white shadow-sm'
                }`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 text-base sm:text-lg truncate">
                      {unifiedCompanyName || unifiedClient.company_name}
                    </h3>
                    {unifiedClient.id === DEFAULT_TENANT_COMPANY.id && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                        Default System Store
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                    <span className="truncate max-w-[180px] sm:max-w-none">ID: {unifiedClient.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPortalUrl(unifiedClient.id)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition cursor-pointer"
                      title="Copy Store Portal Link"
                    >
                      {copiedId === unifiedClient.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status toggle & Close */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="flex items-center gap-1.5 bg-white border border-slate-250 px-2.5 py-1 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 hidden sm:inline">Status:</span>
                  <button
                    type="button"
                    onClick={() => setUnifiedIsActive(!unifiedIsActive)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      unifiedIsActive
                        ? 'bg-emerald-500 text-white shadow-2xs'
                        : 'bg-rose-500 text-white shadow-2xs'
                    }`}
                  >
                    {unifiedIsActive ? 'Active' : 'Suspended'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setUnifiedClient(null)}
                  className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Touch-Friendly Navigation Tabs (Scrollable on mobile) */}
            <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-1 border-b border-slate-100 bg-white overflow-x-auto shrink-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setUnifiedActiveTab('profile')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  unifiedActiveTab === 'profile'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>1. Store Profile &amp; Login</span>
              </button>

              <button
                type="button"
                onClick={() => setUnifiedActiveTab('features')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  unifiedActiveTab === 'features'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>2. Feature Allocation (On/Off)</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  unifiedActiveTab === 'features' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {ALL_SYSTEM_FEATURES.filter(f => editingFeatures[f.id] === true).length} Active
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUnifiedActiveTab('links')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  unifiedActiveTab === 'links'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>3. App Links &amp; WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setUnifiedActiveTab('plan')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  unifiedActiveTab === 'plan'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>4. Subscription Plan</span>
              </button>

              <button
                type="button"
                onClick={() => setUnifiedActiveTab('storage')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  unifiedActiveTab === 'storage'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>5. Database &amp; Storage</span>
                {(() => {
                  const cs = storageOverview?.clientStats[unifiedClient.id];
                  if (!cs) return null;
                  return (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      unifiedActiveTab === 'storage' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {formatBytes(cs.totalBytes)}
                    </span>
                  );
                })()}
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              {/* TAB 1: STORE PROFILE & LOGIN CREDENTIALS */}
              {unifiedActiveTab === 'profile' && (
                <div className="space-y-4">
                  {/* Card A: Company Profile */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>Company Profile &amp; Location Details</span>
                    </h4>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Company / Store Name *</label>
                      <input
                        type="text"
                        required
                        value={unifiedCompanyName}
                        onChange={e => setUnifiedCompanyName(e.target.value)}
                        placeholder="e.g. Paro Retail Enterprise"
                        className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Trade License Number</label>
                        <input
                          type="text"
                          value={unifiedTradeLicense}
                          onChange={e => setUnifiedTradeLicense(e.target.value)}
                          placeholder="TRD-2026-XXXX"
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Tax Payer ID (TPN)</label>
                        <input
                          type="text"
                          value={unifiedTaxId}
                          onChange={e => setUnifiedTaxId(e.target.value)}
                          placeholder="TPN-XXXXXXX"
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Contact Phone Number</label>
                        <input
                          type="text"
                          value={unifiedPhone}
                          onChange={e => setUnifiedPhone(e.target.value)}
                          placeholder="+975 17 XXX XXX"
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Contact Email</label>
                        <input
                          type="email"
                          value={unifiedEmail}
                          onChange={e => setUnifiedEmail(e.target.value)}
                          placeholder="owner@clientstore.bt"
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">Store Physical Address</label>
                        <input
                          type="text"
                          value={unifiedAddress}
                          onChange={e => setUnifiedAddress(e.target.value)}
                          placeholder="Town, Dzongkhag, Bhutan"
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Currency Symbol</label>
                        <select
                          value={unifiedCurrency}
                          onChange={e => {
                            const val = e.target.value;
                            setUnifiedCurrency(val);
                            setUnifiedPlanCurrency(val);
                          }}
                          className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-2xs"
                        >
                          <option value="Nu.">Nu. (BTN - Bhutan)</option>
                          <option value="₹">₹ (INR - Indian Rupee)</option>
                          <option value="USD">USD ($ - US Dollar)</option>
                          <option value="€">€ (EUR - Euro)</option>
                          <option value="£">£ (GBP - British Pound)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Card B: Store Admin Credentials */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-indigo-600" />
                        <span>Client Admin Login Credentials</span>
                      </h4>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-250 shadow-2xs transition flex items-center gap-1 cursor-pointer"
                        title="Generate random password"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        <span>Generate Password</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      These login details give the store owner or manager immediate access to their isolated ERP portal. You can reset or update them here at any time.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Admin Username</label>
                        <input
                          type="text"
                          value={unifiedAdminUsername}
                          onChange={e => setUnifiedAdminUsername(e.target.value)}
                          placeholder="admin"
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                          <span>Login Password</span>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={unifiedAdminPassword}
                            onChange={e => setUnifiedAdminPassword(e.target.value)}
                            placeholder="ClientPass@123"
                            className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Quick PIN (Cashier Unlock)</label>
                        <input
                          type="text"
                          maxLength={6}
                          value={unifiedAdminPin}
                          onChange={e => setUnifiedAdminPin(e.target.value)}
                          placeholder="1234"
                          className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs font-mono tracking-widest text-center"
                        />
                      </div>
                    </div>

                    {/* Authorized Counters */}
                    <div className="pt-2 border-t border-indigo-200/60">
                      <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-indigo-900">
                          <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Authorized Active POS Terminals / Cashier Desks</span>
                        </span>
                        <span className="text-[11px] font-mono text-indigo-700 font-bold">
                          {unifiedAllowedCounters === 0 ? 'Unlimited Desks' : `${unifiedAllowedCounters} Counter${unifiedAllowedCounters > 1 ? 's' : ''}`}
                        </span>
                      </label>
                      <select
                        value={unifiedAllowedCounters}
                        onChange={e => setUnifiedAllowedCounters(parseInt(e.target.value, 10))}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-slate-800 font-bold text-xs focus:outline-none focus:border-indigo-500 shadow-2xs"
                      >
                        <option value={1}>1 Terminal (Single Counter Plan - Default)</option>
                        <option value={2}>2 Terminals (Dual Cashier Desks)</option>
                        <option value={3}>3 Terminals (3-Desk Setup)</option>
                        <option value={4}>4 Terminals (4-Desk Setup)</option>
                        <option value={5}>5 Terminals (5-Desk Setup)</option>
                        <option value={0}>Unlimited Terminals (Enterprise Unlimited)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FEATURE ALLOCATION */}
              {unifiedActiveTab === 'features' && (
                <div className="space-y-3">
                  <div className="py-2.5 px-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    <span className="font-extrabold">Superadmin Policy:</span> Modules turned <strong className="text-rose-700">OFF</strong> are completely hidden from this client store's sidebar, top navigation, and settings menus. Whatever modules are left <strong className="text-emerald-700">ON</strong> can be used freely by the client.
                  </div>
                  <div>
                    {renderFeatureChecklist(editingFeatures, editingPresetId, 'edit')}
                  </div>
                </div>
              )}

              {/* TAB 3: APP LINKS & WHATSAPP SHARE */}
              {unifiedActiveTab === 'links' && (
                <div className="space-y-4">
                  {/* Link 1: ERP Login Portal */}
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <span>Client Dedicated ERP Login Portal Link</span>
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        Main POS &amp; Accounting
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={getCompanyDedicatedUrl(unifiedClient.id, true)}
                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyPortalUrl(unifiedClient.id)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        {copiedId === unifiedClient.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === unifiedClient.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={getCompanyDedicatedUrl(unifiedClient.id, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 shrink-0 shadow-2xs transition"
                        title="Test launch in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* Link 2: Staff Attendance Portal */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span>Client Dedicated Staff Attendance &amp; Leave Portal</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Staff PWA
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${getCompanyDedicatedUrl(unifiedClient.id, true)}&portal=staff`}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyStaffPortalUrl(unifiedClient.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        {copiedStaffId === unifiedClient.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedStaffId === unifiedClient.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <a
                        href={`${getCompanyDedicatedUrl(unifiedClient.id, true)}&portal=staff`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0 shadow-2xs transition"
                        title="Test launch staff portal"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* WhatsApp Direct Invite Messenger */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>Instant WhatsApp Client Onboarding Message</span>
                      </h5>
                      <span className="text-[10px] font-bold text-emerald-700">1-Tap Send</span>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      Send the store owner their login link, username, and password directly to their WhatsApp:
                    </p>

                    <div className="p-3 bg-white rounded-xl border border-emerald-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed shadow-2xs">
{`*DrukERP Access Details*
Store: ${unifiedCompanyName || unifiedClient.company_name}

🔑 *Store Admin Login:*
• Portal: ${getCompanyDedicatedUrl(unifiedClient.id, true)}
• Username: ${unifiedAdminUsername || 'admin'}
• Password: ${unifiedAdminPassword || 'ClientPass@123'}
• PIN: ${unifiedAdminPin || '1234'}

👥 *Staff Clock-in & Leave Portal:*
• Staff URL: ${getCompanyDedicatedUrl(unifiedClient.id, true)}&portal=staff`}
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <a
                        href={getWhatsAppShareUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs transition cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Send to Client via WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const text = `*DrukERP Access Details*
Store: ${unifiedCompanyName || unifiedClient.company_name}

🔑 *Store Admin Login:*
• Portal: ${getCompanyDedicatedUrl(unifiedClient.id, true)}
• Username: ${unifiedAdminUsername || 'admin'}
• Password: ${unifiedAdminPassword || 'ClientPass@123'}
• PIN: ${unifiedAdminPin || '1234'}

👥 *Staff Clock-in & Leave Portal:*
• Staff URL: ${getCompanyDedicatedUrl(unifiedClient.id, true)}&portal=staff`;
                          navigator.clipboard.writeText(text);
                          alert('Onboarding WhatsApp message copied to clipboard!');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Message Text</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: COMMERCIAL PLAN & SUBSCRIPTION */}
              {unifiedActiveTab === 'plan' && (
                <div className="space-y-4">
                  {/* Preset Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Select Plan Preset
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'free', label: 'Free Trial', priceLabel: '0 / Free' },
                        { id: 'starter', label: 'Starter', priceLabel: 'Nu. 1,000/mo' },
                        { id: 'commercial', label: 'Commercial', priceLabel: 'Nu. 1,800/mo' },
                        { id: 'enterprise', label: 'Enterprise', priceLabel: 'Nu. 3,500/mo' },
                      ].map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setUnifiedPlanTier(preset.id);
                            if (preset.id === 'free') {
                              setUnifiedPlanName('Free Trial');
                              setUnifiedPlanPrice(0);
                              setUnifiedPlanCycle('monthly');
                            } else if (preset.id === 'starter') {
                              setUnifiedPlanName('Starter Tier');
                              setUnifiedPlanPrice(1000);
                              setUnifiedPlanCurrency('Nu.');
                              setUnifiedCurrency('Nu.');
                              setUnifiedPlanCycle('monthly');
                            } else if (preset.id === 'commercial') {
                              setUnifiedPlanName('Commercial Plan');
                              setUnifiedPlanPrice(1800);
                              setUnifiedPlanCurrency('Nu.');
                              setUnifiedCurrency('Nu.');
                              setUnifiedPlanCycle('monthly');
                            } else if (preset.id === 'enterprise') {
                              setUnifiedPlanName('Enterprise Tier');
                              setUnifiedPlanPrice(3500);
                              setUnifiedPlanCurrency('Nu.');
                              setUnifiedCurrency('Nu.');
                              setUnifiedPlanCycle('monthly');
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            unifiedPlanTier === preset.id
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs ring-1 ring-indigo-400'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                          }`}
                        >
                          <div className="font-bold text-xs">{preset.label}</div>
                          <div className="text-[10px] text-indigo-600 font-mono mt-0.5">{preset.priceLabel}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Plan Tier Name</label>
                      <input
                        type="text"
                        value={unifiedPlanName}
                        onChange={e => {
                          setUnifiedPlanName(e.target.value);
                          setUnifiedPlanTier('custom');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Price Rate</label>
                      <input
                        type="number"
                        min="0"
                        value={unifiedPlanPrice}
                        onChange={e => {
                          setUnifiedPlanPrice(e.target.value);
                          setUnifiedPlanTier('custom');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Billing Currency</label>
                      <select
                        value={unifiedPlanCurrency}
                        onChange={e => {
                          const val = e.target.value;
                          setUnifiedPlanCurrency(val);
                          setUnifiedCurrency(val);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold"
                      >
                        <option value="Nu.">Nu. (BTN)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Billing Interval</label>
                      <select
                        value={unifiedPlanCycle}
                        onChange={e => setUnifiedPlanCycle(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold"
                      >
                        <option value="monthly">Monthly (/mo)</option>
                        <option value="yearly">Yearly (/yr)</option>
                        <option value="quarterly">Quarterly (/qtr)</option>
                        <option value="one-time">One-Time / Lifetime</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Subscription Renewal / Expiry (Optional)</label>
                      <input
                        type="date"
                        value={unifiedPlanExpiresAt}
                        onChange={e => setUnifiedPlanExpiresAt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Admin Notes (Optional)</label>
                      <input
                        type="text"
                        value={unifiedPlanNotes}
                        onChange={e => setUnifiedPlanNotes(e.target.value)}
                        placeholder="e.g. Contract signed, payment via mBoB"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: DATABASE & STORAGE CONSUMPTION */}
              {unifiedActiveTab === 'storage' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                    <div>
                      <h4 className="font-bold text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                        <Database className="h-4 w-4 text-indigo-600" />
                        <span>Client Postgres Database &amp; Storage Footprint</span>
                      </h4>
                      <p className="text-[11px] text-indigo-700">
                        Granular storage metrics, table row allocations, and Supabase realtime connection status.
                      </p>
                    </div>
                    {(() => {
                      const cs = storageOverview?.clientStats[unifiedClient.id];
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-white border border-indigo-200 text-indigo-900 shadow-2xs">
                            {formatBytes(cs?.totalBytes || 1024)} Total Consumed
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Metric Cards Grid */}
                  {(() => {
                    const cs = storageOverview?.clientStats[unifiedClient.id];
                    const bytes = cs?.totalBytes || 1024;
                    const totalRows = cs?.totalRows || 1;
                    const pct = cs?.percentageOfTotal || 0;
                    const items = cs?.itemCount || 0;
                    const vouchers = cs?.voucherCount || 0;
                    const invoices = cs?.invoiceCount || 0;
                    const ledgers = cs?.ledgerCount || 0;
                    const settingsBytes = cs?.settingsBytes || 0;

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Storage Footprint
                            </span>
                            <span className="text-xl font-black text-indigo-600 block mt-0.5">
                              {formatBytes(bytes)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {pct}% of platform Supabase data ({formatBytes(storageOverview?.totalBytesUsed || 0)})
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Database Records
                            </span>
                            <span className="text-xl font-black text-slate-900 block mt-0.5">
                              {totalRows.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              Total stored Postgres table rows
                            </span>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Realtime Sync Channel
                            </span>
                            <span className="text-xl font-black text-emerald-600 flex items-center gap-1.5 mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Active &amp; Synced
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              Live multi-tenant tenant channel
                            </span>
                          </div>
                        </div>

                        {/* Table Entity Breakdown */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                          <h5 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Storage Consumption by Data Entity</span>
                          </h5>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">Inventory &amp; Catalog</span>
                                <span className="text-[10px] text-slate-400">Postgres items records</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-indigo-600 block">{items} items</span>
                                <span className="text-[10px] text-slate-400 font-mono">~{formatBytes(items * 480)}</span>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">Sales Invoices</span>
                                <span className="text-[10px] text-slate-400">POS &amp; customer billing</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-indigo-600 block">{invoices} invoices</span>
                                <span className="text-[10px] text-slate-400 font-mono">~{formatBytes(invoices * 1200)}</span>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">Accounting Vouchers</span>
                                <span className="text-[10px] text-slate-400">Double-entry journals</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-indigo-600 block">{vouchers} vouchers</span>
                                <span className="text-[10px] text-slate-400 font-mono">~{formatBytes(vouchers * 750)}</span>
                              </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">Ledgers &amp; Accounts</span>
                                <span className="text-[10px] text-slate-400">Chart of accounts</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-indigo-600 block">{ledgers} accounts</span>
                                <span className="text-[10px] text-slate-400 font-mono">~{formatBytes(ledgers * 350)}</span>
                              </div>
                            </div>

                            <div className="col-span-1 sm:col-span-2 bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 block">Documents &amp; Settings (JSON)</span>
                                <span className="text-[10px] text-slate-400">
                                  Configurations, staff rosters, attendance logs, and tax metadata
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-emerald-600 block">{formatBytes(settingsBytes)}</span>
                                <span className="text-[10px] text-slate-400 font-mono">Stored payload</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Bottom Sticky Action Bar (Optimized for Smartphone Thumb Zone) */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUnifiedClient(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs transition cursor-pointer"
                >
                  Cancel / Close
                </button>
                <button
                  type="button"
                  onClick={() => handleEnterClientWorkspace(unifiedClient)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Switch active workspace into this store"
                >
                  <span>Enter Store</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveUnifiedClient}
                disabled={isSavingUnified}
                className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                {isSavingUnified ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving All Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save All Client Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Storage Quota Configuration Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Supabase Storage Quota</h4>
                  <p className="text-[11px] text-slate-500">Configure platform storage threshold &amp; headroom balance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Quick Tier Presets:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuotaInputMB(500)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    quotaInputMB === 500
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block text-xs font-extrabold">500 MB</span>
                  <span className="block text-[10px] text-slate-400">Free Tier</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuotaInputMB(8192)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    quotaInputMB === 8192
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block text-xs font-extrabold">8 GB</span>
                  <span className="block text-[10px] text-slate-400">Pro Tier</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuotaInputMB(102400)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    quotaInputMB === 102400
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-bold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block text-xs font-extrabold">100 GB</span>
                  <span className="block text-[10px] text-slate-400">Enterprise</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Custom Quota Limit (MB):</label>
                <input
                  type="number"
                  min="10"
                  max="10000000"
                  value={quotaInputMB}
                  onChange={e => setQuotaInputMB(Math.max(10, parseInt(e.target.value) || 500))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Equivalent to: {quotaInputMB >= 1024 ? `${(quotaInputMB / 1024).toFixed(2)} GB` : `${quotaInputMB} MB`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveQuota(quotaInputMB)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Quota Benchmark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
