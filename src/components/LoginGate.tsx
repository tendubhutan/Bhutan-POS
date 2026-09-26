import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  ShieldCheck, 
  Building2, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Mail,
  Eye,
  EyeOff,
  Terminal,
  Database,
  Sparkles,
  LogIn,
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Receipt,
  Settings,
  Zap,
  User,
  Calendar
} from 'lucide-react';
import { AppUser, UserPermission } from '../types';
import { 
  SupabaseCompany, 
  SupabaseFinancialYear, 
  fetchUserCompanies, 
  getDedicatedCompanyIdFromUrl 
} from '../services/supabaseTenantService';
import { 
  loginWithSupabaseAuth, 
  tenantSessionToAppUser, 
  isDevOrPreviewEnvironment
} from '../services/authTenantContext';
import { getActiveUser } from '../services/storageService';
import { EzeeErpLogo } from './common/EzeeErpLogo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const ALL_ADMIN_PERMISSIONS: UserPermission[] = [
  { module: 'pos', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'purchase', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'vouchers', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'masters', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'barcode', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'payroll', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'reports', display: true, create: true, edit: true, delete: true, print: true },
  { module: 'settings', display: true, create: true, edit: true, delete: true, print: true }
];

interface LoginGateProps {
  activeCompany?: SupabaseCompany | null;
  activeFY?: SupabaseFinancialYear | null;
  onUnlock: (user: AppUser) => void;
}

export const BHUTAN_LANDSCAPE_WALLPAPERS = [
  {
    id: 'tashichho_dzong',
    name: "Tashichho Dzong",
    location: "Thimphu Valley, Bhutan",
    url: '/tashichho_dzong.jpg',
    icon: '🏰'
  },
  {
    id: 'rice_fields',
    name: "Bhutan Rice Fields",
    location: "Terraced Rice Fields, Bhutan",
    url: '/bhutan_rice_fields.jpg',
    icon: '🌾'
  },
  {
    id: 'taktshang',
    name: "Taktshang Monastery",
    location: "Paro Valley, Bhutan",
    url: '/taktshang.jpg',
    icon: '🏔️'
  },
  {
    id: 'punakha_dzong',
    name: "Punakha Dzong",
    location: "Punakha Valley, Bhutan",
    url: '/punakha_dzong.jpg',
    icon: '🏛️'
  }
];

export const LoginGate: React.FC<LoginGateProps> = ({
  activeCompany,
  activeFY,
  onUnlock
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authenticatedRole, setAuthenticatedRole] = useState<string | null>(null);

  // Bhutan Scenic Background Wallpaper State
  const [selectedWallpaperUrl, setSelectedWallpaperUrl] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('bhutan_login_bg');
      if (saved) return saved;
    }
    return BHUTAN_LANDSCAPE_WALLPAPERS[0].url; // Default: Taktshang Monastery (Tiger's Nest)
  });

  const handleSelectWallpaper = (url: string) => {
    setSelectedWallpaperUrl(url);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bhutan_login_bg', url);
    }
  };

  // Dedicated Client URL parameter detection (?company=...)
  const dedicatedId = getDedicatedCompanyIdFromUrl();
  const [dedicatedCompany, setDedicatedCompany] = useState<SupabaseCompany | null>(() => {
    if (!dedicatedId) return null;
    if (activeCompany && activeCompany.id === dedicatedId) return activeCompany;
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('supabase_cached_companies');
        if (cached) {
          const list: SupabaseCompany[] = JSON.parse(cached);
          const found = list.find(c => c.id === dedicatedId);
          if (found) return found;
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (!dedicatedId) return;
    let isMounted = true;
    (async () => {
      try {
        const promises: Promise<any>[] = [];
        if (isSupabaseConfigured) {
          promises.push((async () => {
            try {
              const { data: comp } = await supabase.from('companies').select('*').eq('id', dedicatedId).maybeSingle();
              const { data: creds } = await supabase.from('tenant_settings').select('data').eq('company_id', dedicatedId).eq('record_id', 'admin_credentials').maybeSingle();
              if (comp && isMounted) {
                setDedicatedCompany(prev => ({
                  ...(prev || {}),
                  ...comp,
                  admin_username: creds?.data?.admin_username || prev?.admin_username || 'admin',
                  admin_password: creds?.data?.admin_password || prev?.admin_password || 'ClientPass@123',
                  admin_pin: creds?.data?.admin_pin || prev?.admin_pin || '1234',
                  admin_name: creds?.data?.admin_name || prev?.admin_name
                }));
              }
            } catch {}
          })());
        }

        promises.push((async () => {
          try {
            const snap = await getDoc(doc(db, 'companies', dedicatedId));
            if (snap.exists() && isMounted) {
              setDedicatedCompany(snap.data() as SupabaseCompany);
            }
          } catch {}
        })());

        await Promise.race([
          Promise.allSettled(promises),
          new Promise(r => setTimeout(r, 1500))
        ]);
      } catch (e) {
        console.warn('Dedicated company lookup notice in LoginGate:', e);
      }
    })();
    return () => { isMounted = false; };
  }, [dedicatedId]);

  const displayCompany = (dedicatedId && dedicatedCompany) 
    ? dedicatedCompany 
    : (activeCompany && (!dedicatedId || activeCompany.id === dedicatedId) ? activeCompany : null);

  const displayCompanyName = dedicatedId
    ? (displayCompany?.company_name || 'Client Workspace')
    : (activeCompany?.company_name || 'Bhutan Retail Enterprise');

  // Checks whether the app is currently running in a preview/development environment
  const isDevPreview = isDevOrPreviewEnvironment();

  const handleInstantUnlock = (userRole: 'Administrator' | 'Cashier' = 'Administrator', userName?: string) => {
    // Strictly disallowed in production
    if (!isDevPreview) {
      setErrorMsg('Unauthorized bypass action. Please enter your valid credentials.');
      return;
    }

    const resolvedName = userName || (dedicatedId ? `${displayCompanyName} Administrator` : 'System Administrator');
    setIsSuccess(true);
    setAuthenticatedRole(userRole);

    // Strictly bind active and assigned company to this client link if on dedicated URL
    if (dedicatedId) {
      localStorage.setItem('supabase_active_company_id', dedicatedId);
      localStorage.setItem('deep_pos_auth_assigned_company', dedicatedId);
      localStorage.setItem('deep_pos_auth_role', 'admin');
      sessionStorage.setItem('supabase_active_session_company', dedicatedId);
      sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
    }

    const existing = getActiveUser();
    const appUser: AppUser = {
      ...existing,
      fullName: resolvedName,
      role: userRole,
      assignedCompanyId: dedicatedId || undefined,
      permissions: existing?.permissions?.length ? existing.permissions : ALL_ADMIN_PERMISSIONS,
      status: 'Active',
      id: existing?.id || (dedicatedId ? `usr_${dedicatedId}` : 'usr_admin'),
      username: (dedicatedId && displayCompany?.admin_username) ? displayCompany.admin_username : (existing?.username || 'admin')
    };
    setTimeout(() => {
      onUnlock(appUser);
    }, 300);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMsg('Please enter your username or email address.');
      return;
    }
    if (!cleanPassword) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    setIsLoading(true);

    try {
      const { session, error } = await loginWithSupabaseAuth(cleanEmail, cleanPassword);

      if (error || !session) {
        // In dev / preview mode only, allow instant fallback for registered demo usernames
        // ONLY if not on dedicated client link, or if the email matches this dedicated client
        if (isDevPreview && !dedicatedId && (cleanEmail.includes('admin') || cleanEmail.includes('ezee') || cleanEmail.includes('retail'))) {
          handleInstantUnlock('Administrator', cleanEmail.split('@')[0]);
          return;
        }
        setErrorMsg(error || 'Invalid email or password. Please verify your credentials.');
        setIsLoading(false);
        return;
      }

      // Verify subscription status for the authenticated company (fast cached check)
      if (session.role !== 'superadmin' && session.assignedCompanyId) {
        let authComp: any = null;
        try {
          const cached = localStorage.getItem('supabase_cached_companies');
          if (cached) {
            const list: SupabaseCompany[] = JSON.parse(cached);
            authComp = list.find(c => c.id === session.assignedCompanyId);
          }
        } catch {}
        if (authComp && authComp.is_active === false) {
          setErrorMsg('Commercial Account Locked: This store subscription is currently inactive. Please contact your platform superadmin to renew access.');
          setIsLoading(false);
          return;
        }
      }

      setIsSuccess(true);
      setAuthenticatedRole(session.role);

      const appUser = tenantSessionToAppUser(session);
      setTimeout(() => {
        onUnlock(appUser);
      }, 50);
    } catch (err: any) {
      if (isDevPreview && !dedicatedId) {
        handleInstantUnlock('Administrator', cleanEmail ? cleanEmail.split('@')[0] : 'Administrator');
      } else {
        setErrorMsg('Authentication error. Please check your credentials.');
        setIsLoading(false);
      }
    }
  };

  const handleOneClickAccount = async (fillEmail: string, fillPass: string, roleName: 'Administrator' | 'Cashier', label: string) => {
    if (!isDevPreview) return;

    setEmail(fillEmail);
    setPassword(fillPass);
    setErrorMsg('');
    setIsLoading(true);

    try {
      const { session, error } = await loginWithSupabaseAuth(fillEmail, fillPass);
      if (session) {
        setIsSuccess(true);
        setAuthenticatedRole(session.role);
        const appUser = tenantSessionToAppUser(session);
        setTimeout(() => onUnlock(appUser), 50);
        return;
      }
    } catch {
      // ignore
    }
    // Instant fallback for preview convenience
    handleInstantUnlock(roleName, label);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between overflow-y-auto overflow-x-hidden selection:bg-blue-600 selection:text-white font-sans">
      {/* Scenic Background Wallpaper (Bhutan Iconic Landscapes - Paro Taktsang Tiger's Nest, Punakha Dzong, Rice Terraces, Himalayas) */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${selectedWallpaperUrl}')`
        }}
      >
        {/* Soft subtle gradient overlay to keep text readable while preserving vivid landscape details */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/60 via-slate-900/20 to-sky-900/30 backdrop-blur-[0.5px]" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full my-auto">
          
          {/* LEFT PANEL: Ezee ERP Brand Showcase & Feature Badges Grid */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Top Logo */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
              <EzeeErpLogo size="lg" />
            </div>

            {/* Feature Modules Grid (6 Colorful Badges - 2 rows x 3 cols) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 pt-2 max-w-lg">
              {/* Module 1: POS */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-emerald-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">POS</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">Fast & Easy Billing</p>
                </div>
              </div>

              {/* Module 2: Inventory */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-purple-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-105 transition">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Inventory</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">Track Stock</p>
                </div>
              </div>

              {/* Module 3: Accounting */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-amber-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Accounting</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">Stay Compliant</p>
                </div>
              </div>

              {/* Module 4: HR & Payroll */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-teal-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">HR & Payroll</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">Manage People</p>
                </div>
              </div>

              {/* Module 5: Purchase & Sales */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-blue-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Purchase & Sales</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">Grow Business</p>
                </div>
              </div>

              {/* Module 6: More Modules */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 backdrop-blur-md border border-indigo-200/80 shadow-sm hover:shadow-md transition text-center space-y-1.5 group">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">More Modules</h3>
                  <p className="text-[10px] font-semibold text-slate-500 leading-tight">All in One ERP</p>
                </div>
              </div>
            </div>

            {/* Bottom Cursive Priority Slogan */}
            <div className="pt-4 hidden lg:block">
              <span className="text-2xl font-serif italic text-slate-900 font-bold drop-shadow-sm border-b-2 border-amber-500 pb-1">
                Your Business Our Priority
              </span>
            </div>
          </div>

          {/* RIGHT PANEL: Light Glassmorphic Terminal Access Login Card */}
          <div className="lg:col-span-6 w-full max-w-md lg:max-w-md ml-auto">
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header Title with Avatar Circle */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 ring-4 ring-blue-100 shrink-0">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                    Terminal Access
                  </h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-1">
                    SECURE LOGIN PORTAL
                  </span>
                </div>
              </div>

              {/* 1-Click Instant Enter: ONLY displayed in development / preview environments */}
              {isDevPreview && (
                <div className="p-3.5 rounded-2xl bg-sky-50/90 border border-sky-200/80 space-y-2 text-left shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                      <span>PREVIEW MODE ONLY</span>
                    </span>
                    <span className="text-[9px] font-mono text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-md font-extrabold">
                      Hidden in Live Prod
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInstantUnlock('Administrator', `${displayCompanyName} Administrator`)}
                    className="w-full py-2.5 px-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-600/25 flex items-center justify-between gap-2 transition cursor-pointer active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Zap className="h-4 w-4 fill-amber-300 text-amber-300 shrink-0" />
                      <span className="truncate">1-Click Enter as {displayCompanyName} Admin (Preview Bypass)</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              )}

              {/* Active Workspace Notification Box */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[9px] font-mono uppercase tracking-wider font-extrabold">ACTIVE WORKSPACE</span>
                    <span className="text-slate-900 font-black truncate block text-xs">
                      {displayCompanyName}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 font-mono text-[10px] text-emerald-800 font-black bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{activeFY?.fy_name || 'FY 2026'}</span>
                </div>
              </div>

              {/* Alerts */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-150 text-left font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="leading-snug">{errorMsg}</div>
                </div>
              )}

              {isSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-150 font-bold text-left">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Entering {authenticatedRole ? `${authenticatedRole} workspace...` : 'workspace...'}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email, Username, or Store Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={dedicatedId ? `e.g. admin or ${(displayCompany?.email || 'admin')}` : "tendubhutan@gmail.com, admin, or store name"}
                      autoComplete="username"
                      disabled={isLoading || isSuccess}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 font-semibold text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Password or PIN
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password or 4-digit PIN"
                      autoComplete="current-password"
                      disabled={isLoading || isSuccess}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 font-semibold text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.99] text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      <span>Access Granted</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>Sign In to ERP</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Test Accounts 1-Click Launchers: ONLY shown in Development / Preview Mode */}
              {isDevPreview && (
                <div className="pt-3 border-t border-slate-200/80 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <span>Demo Test Accounts</span>
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                      <Zap className="h-3 w-3 text-amber-500 fill-amber-500" /> Quick Fill
                    </span>
                  </div>

                  {dedicatedId ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOneClickAccount(
                          displayCompany?.admin_username || displayCompany?.email || 'admin',
                          displayCompany?.admin_password || displayCompany?.admin_pin || 'ClientPass@123',
                          'Administrator',
                          `${displayCompanyName} Admin`
                        )}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-blue-700 truncate">{displayCompanyName}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">client admin</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">
                          {displayCompany?.admin_username || displayCompany?.email || 'admin'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOneClickAccount('admin@bhutanerp.bt', 'SuperAdminPass2026!', 'Administrator', 'System Admin')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-purple-700">System Admin</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-purple-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">superadmin</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">admin@bhutanerp.bt</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOneClickAccount('admin@bhutanerp.bt', 'SuperAdminPass2026!', 'Administrator', 'System Admin')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-purple-700">System Admin</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-purple-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800">superadmin</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">admin@bhutanerp.bt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOneClickAccount('admin@ezeeshop.bt', 'EzeeAdminPass2026!', 'Administrator', 'Ezee Shop Admin')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-emerald-700">Store Admin</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">client admin</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">admin@ezeeshop.bt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOneClickAccount('cashier@ezeeshop.bt', 'EzeeCashierPass2026!', 'Cashier', 'Ezee Cashier')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-blue-700">POS Cashier</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">staff</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">cashier@ezeeshop.bt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOneClickAccount('demo.admin@bhutanretail.bt', 'DemoAdminPass2026!', 'Administrator', 'Demo Retail Admin')}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left transition cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-900 group-hover:text-amber-700">Demo Store</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-amber-600 shrink-0 ml-1" />
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">demo</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block truncate mt-1">demo.admin@bhutanretail.bt</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 text-center text-[11px] font-bold text-slate-500 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>Secure • Reliable • Made for Bhutan</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Wave Footer Accent Bar & Bhutan Wallpaper Switcher */}
      <footer className="relative z-10 w-full bg-slate-900/90 backdrop-blur-md text-white py-3 px-4 border-t border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2 font-semibold text-blue-100">
            <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
            <span><strong>Ezee ERP</strong> &nbsp;|&nbsp; Everything Your Business Needs, in One Place.</span>
          </div>

          {/* Bhutan Landscape Wallpaper Switcher Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-slate-800/90 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 hidden lg:inline">Bhutan View:</span>
            {BHUTAN_LANDSCAPE_WALLPAPERS.map(wp => (
              <button
                key={wp.id}
                type="button"
                onClick={() => handleSelectWallpaper(wp.url)}
                className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer ${
                  selectedWallpaperUrl === wp.url
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
                title={`${wp.name} - ${wp.location}`}
              >
                <span>{wp.icon}</span>
                <span className="hidden sm:inline">{wp.name}</span>
              </button>
            ))}
          </div>

        </div>
      </footer>
    </div>
  );
};
