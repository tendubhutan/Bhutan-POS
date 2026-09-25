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
  LogIn
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

      // Verify subscription status for the authenticated company
      if (session.role !== 'superadmin' && session.assignedCompanyId) {
        const { companies } = await fetchUserCompanies(true);
        const authComp = companies.find(c => c.id === session.assignedCompanyId);
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
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Ambient background lighting and subtle gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] sm:w-[750px] h-[380px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-[450px] h-[350px] bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[450px] h-[350px] bg-teal-500/10 rounded-full blur-3xl" />
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
      </div>

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-6 sm:p-8 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3.5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/15">
              <ShieldCheck className="h-8 w-8 text-white drop-shadow" />
            </div>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-300 text-xs font-semibold tracking-wide shadow-xs mb-2">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            <span>{dedicatedId ? displayCompanyName : 'Ezee ERP'}</span>
          </div>

          <h1 className="text-2xl sm:text-[26px] font-black text-white tracking-tight">
            Terminal Access
          </h1>
        </div>

        {/* 1-Click Instant Enter: ONLY displayed in development / preview environments */}
        {isDevPreview && (
          <div className="mb-5 p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                <span>Preview Mode Only</span>
              </span>
              <span className="text-[9px] font-mono text-emerald-300/70 bg-emerald-900/40 px-1.5 py-0.5 rounded">
                Hidden in Live Prod
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleInstantUnlock('Administrator', `${displayCompanyName} Administrator`)}
              className="w-full py-2.5 px-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.98]"
            >
              <span>1-Click Enter as {displayCompanyName} Admin (Preview Bypass)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active Workspace Notification */}
        <div className="mb-5 p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center shrink-0 text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0">
              <span className="text-slate-400 block text-[9px] font-mono uppercase tracking-wider font-semibold">Active Workspace</span>
              <span className="text-white font-bold truncate block text-xs">
                {displayCompanyName}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg shadow-2xs">
            {activeFY?.fy_name || 'FY 2026'}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Entering {authenticatedRole ? `${authenticatedRole} workspace...` : 'workspace...'}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
              Email, Username, or Store Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={dedicatedId ? `e.g. admin or ${(displayCompany?.email || 'admin')}` : "e.g. panglungenterprise@gmail.com, admin, or store name"}
                autoComplete="username"
                disabled={isLoading || isSuccess}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-inner"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 text-left">
                Password or PIN
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password or 4-digit PIN"
                autoComplete="current-password"
                disabled={isLoading || isSuccess}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-800/70 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In to ERP</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Test Accounts 1-Click Launchers: ONLY shown in Development / Preview Mode */}
        {isDevPreview && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase flex items-center gap-1">
                <span>Demo Test Accounts</span>
                <span className="text-[9px] text-amber-400 font-mono font-normal">(Dev Preview)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-medium">Quick Fill</span>
            </div>

            {dedicatedId ? (
              /* When visiting a dedicated client link, strictly show this client's credentials and system admin */
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOneClickAccount(
                    displayCompany?.admin_username || displayCompany?.email || 'admin',
                    displayCompany?.admin_password || displayCompany?.admin_pin || 'ClientPass@123',
                    'Administrator',
                    `${displayCompanyName} Admin`
                  )}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-emerald-950/40 border border-slate-700/60 hover:border-emerald-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-emerald-300 truncate">{displayCompanyName}</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-900/60 text-emerald-300 shrink-0 ml-1">client admin</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">
                    {displayCompany?.admin_username || displayCompany?.email || 'admin'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOneClickAccount('admin@bhutanerp.bt', 'SuperAdminPass2026!', 'Administrator', 'System Admin')}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-purple-950/40 border border-slate-700/60 hover:border-purple-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-purple-300">System Admin</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-900/60 text-purple-300">superadmin</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">admin@bhutanerp.bt</span>
                </button>
              </div>
            ) : (
              /* When visiting generic root URL, show standard demo accounts */
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOneClickAccount('admin@bhutanerp.bt', 'SuperAdminPass2026!', 'Administrator', 'System Admin')}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-purple-950/40 border border-slate-700/60 hover:border-purple-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-purple-300">System Admin</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-purple-900/60 text-purple-300">superadmin</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">admin@bhutanerp.bt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOneClickAccount('admin@ezeeshop.bt', 'EzeeAdminPass2026!', 'Administrator', 'Ezee Shop Admin')}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-emerald-950/40 border border-slate-700/60 hover:border-emerald-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-emerald-300">Store Admin</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-900/60 text-emerald-300">client admin</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">admin@ezeeshop.bt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOneClickAccount('cashier@ezeeshop.bt', 'EzeeCashierPass2026!', 'Cashier', 'Ezee Cashier')}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-blue-950/40 border border-slate-700/60 hover:border-blue-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-blue-300">POS Cashier</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-blue-900/60 text-blue-300">staff</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">cashier@ezeeshop.bt</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOneClickAccount('demo.admin@bhutanretail.bt', 'DemoAdminPass2026!', 'Administrator', 'Demo Retail Admin')}
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-amber-950/40 border border-slate-700/60 hover:border-amber-500/50 text-left transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white group-hover:text-amber-300">Demo Store</span>
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-900/60 text-amber-300">demo</span>
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate mt-0.5">demo.admin@bhutanretail.bt</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
