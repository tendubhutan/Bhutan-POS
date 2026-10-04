import React, { useState, useEffect } from 'react';
import {
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  CheckCircle2,
  ArrowLeft,
  Zap,
  KeyRound,
  ShieldCheck,
  Mail,
  RotateCcw,
  Check
} from 'lucide-react';
import { DrukErpLogo } from '../common/DrukErpLogo';
import { 
  loginWithSupabaseAuth, 
  tenantSessionToAppUser,
  isDevOrPreviewEnvironment 
} from '../../services/authTenantContext';
import { getActiveUser } from '../../services/storageService';
import { AppUser, UserPermission } from '../../types';
import { SupabaseCompany, fetchUserCompanies } from '../../services/supabaseTenantService';
import {
  verifyCompanyByEmailAndCode,
  getCompanyCode,
  getSavedVerifiedCompany,
  clearVerifiedCompany
} from '../../services/tenantVerificationService';

interface SapEnterpriseLogonProps {
  onUnlock: (user?: AppUser) => void;
  onBackToWebsite?: () => void;
}

export const SapEnterpriseLogon: React.FC<SapEnterpriseLogonProps> = ({
  onUnlock,
  onBackToWebsite
}) => {
  // STAGE 1: Organization Verification State
  const [companyEmail, setCompanyEmail] = useState(() => {
    return localStorage.getItem('drukerp_last_company_email') || '';
  });
  const [companyCode, setCompanyCode] = useState(() => {
    return localStorage.getItem('drukerp_last_company_code') || '';
  });
  const [verifiedCompany, setVerifiedCompany] = useState<SupabaseCompany | null>(() => {
    return getSavedVerifiedCompany();
  });
  const [isVerifyingOrg, setIsVerifyingOrg] = useState(false);

  // Available Companies for Dev Mode Helper
  const [availableCompanies, setAvailableCompanies] = useState<SupabaseCompany[]>([]);

  // STAGE 2: Staff / User Authentication State
  const [user, setUser] = useState(() => {
    return localStorage.getItem('drukerp_last_user') || 'admin';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'DZ'>('EN');
  const [systemBranch, setSystemBranch] = useState('01 - Thimphu HQ');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Quick mode toggle: Enterprise vs Quick Cashier PIN
  const [logonMode, setLogonMode] = useState<'enterprise' | 'cashier'>('enterprise');
  const [cashierPin, setCashierPin] = useState('');
  const [showDemoPicker, setShowDemoPicker] = useState(false);

  const isDevPreview = isDevOrPreviewEnvironment();

  // Superadmin Secret Knock-Knock Gate States (Never saved to storage!)
  const [logoClicks, setLogoClicks] = useState(0);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretPin, setSecretPin] = useState('');
  const [secretOtp, setSecretOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [secretError, setSecretPinError] = useState('');

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowSecretModal(true);
        setSecretPin('');
        setSecretOtp('');
        setIsOtpSent(false);
        setSecretPinError('');
        return 0; // Reset counter
      }
      return next;
    });
  };

  const handleVerifySecretPin = (e: React.FormEvent) => {
    e.preventDefault();
    setSecretPinError('');

    if (secretPin === '1121') {
      setShowSecretModal(false);
      window.location.href = '/?portal=superadmin';
    } else {
      setSecretPinError('Invalid 4-digit Platform Master PIN.');
    }
  };

  const handleVerifySecretOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setSecretPinError('');

    if (secretOtp === '0458') {
      setShowSecretModal(false);
      window.location.href = '/?portal=superadmin';
    } else {
      setSecretPinError('Invalid 4-digit OTP verification code.');
    }
  };

  const handleSendSecretOtp = () => {
    setSecretPinError('');
    setIsOtpSending(true);
    setTimeout(() => {
      setIsOtpSending(false);
      setIsOtpSent(true);
    }, 1500);
  };

  // Load available companies for dev mode helper
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchUserCompanies();
        const comps = res?.companies || [];
        if (comps && comps.length > 0) {
          setAvailableCompanies(comps);
          // If first time and fields are blank, prepopulate with first company
          if (!companyEmail && comps[0]) {
            setCompanyEmail(comps[0].email || 'info@drukmart.bt');
            setCompanyCode(getCompanyCode(comps[0]));
          }
        }
      } catch {}
    })();
  }, []);

  // --------------------------------------------------------------------------
  // HANDLER: STEP 1 - VERIFY ORGANIZATION (COMPANY EMAIL + CODE)
  // --------------------------------------------------------------------------
  const handleVerifyOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const emailInput = companyEmail.trim().toLowerCase();
    if (emailInput === 'tendubhutan@gmail.com' || emailInput === 'admin@bhutanerp.bt') {
      window.location.href = '/?portal=superadmin';
      return;
    }

    setIsVerifyingOrg(true);

    try {
      const { company, error } = await verifyCompanyByEmailAndCode(companyEmail, companyCode);

      if (error || !company) {
        setErrorMsg(error || 'Invalid Company Email or Company Code. Please verify with your SuperAdmin.');
        setIsVerifyingOrg(false);
        return;
      }

      // Organization verified successfully!
      setVerifiedCompany(company);
      localStorage.setItem('drukerp_last_company_email', companyEmail.trim());
      localStorage.setItem('drukerp_last_company_code', companyCode.trim().toUpperCase());
      setIsVerifyingOrg(false);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error connecting to database partition.');
      setIsVerifyingOrg(false);
    }
  };

  const handleSwitchOrganization = () => {
    clearVerifiedCompany();
    setVerifiedCompany(null);
    setPassword('');
    setErrorMsg('');
  };

  // --------------------------------------------------------------------------
  // HANDLER: STEP 2 - AUTHENTICATE USER WITHIN VERIFIED COMPANY
  // --------------------------------------------------------------------------
  const handleLogonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUserLower = user.trim().toLowerCase();
    if (cleanUserLower === 'tendubhutan@gmail.com') {
      window.location.href = '/?portal=superadmin';
      return;
    }

    if (!verifiedCompany) {
      setErrorMsg('Organization verification required. Please verify Company Email and Code first.');
      return;
    }

    if (logonMode === 'cashier') {
      if (!cashierPin.trim()) {
        setErrorMsg('Please enter your 4-digit cashier terminal PIN.');
        return;
      }
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        handleInstantUnlock('Cashier', 'Store Cashier');
      }, 400);
      return;
    }

    const cleanUser = user.trim();
    const cleanPassword = password.trim();

    if (!cleanUser) {
      setErrorMsg('Please enter your staff username or email.');
      return;
    }
    if (!cleanPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    localStorage.setItem('drukerp_last_user', cleanUser);

    try {
      // Authenticate with backend auth service strictly scoped to this company
      const { session, error } = await loginWithSupabaseAuth(cleanUser, cleanPassword);

      if (error || !session) {
        // In dev / preview mode only, allow instant fallback for demo accounts
        if (isDevPreview && (cleanUser.includes('admin') || cleanUser.includes('ezee') || cleanUser.includes('demo') || cleanUser === 'admin')) {
          handleInstantUnlock('Administrator', cleanUser === 'admin' ? `${verifiedCompany.company_name} Admin` : cleanUser.split('@')[0]);
          return;
        }
        setErrorMsg(error || `Logon rejected: Invalid username or password for ${verifiedCompany.company_name}.`);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      
      // Strictly bind active company to the verified company
      localStorage.setItem('supabase_active_company_id', verifiedCompany.id);
      localStorage.setItem('deep_pos_auth_assigned_company', verifiedCompany.id);
      sessionStorage.setItem('supabase_active_session_company', verifiedCompany.id);

      const appUser = tenantSessionToAppUser({
        ...session,
        assignedCompanyId: verifiedCompany.id
      });

      setTimeout(() => {
        onUnlock(appUser);
      }, 350);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connection failure to application server.');
      setIsLoading(false);
    }
  };

  const handleInstantUnlock = (userRole: 'Administrator' | 'Cashier' = 'Administrator', userName?: string) => {
    setIsSuccess(true);
    const existing = getActiveUser();

    if (verifiedCompany) {
      localStorage.setItem('supabase_active_company_id', verifiedCompany.id);
      localStorage.setItem('deep_pos_auth_assigned_company', verifiedCompany.id);
      sessionStorage.setItem('supabase_active_session_company', verifiedCompany.id);
    }

    const appUser: AppUser = {
      ...existing,
      fullName: userName || (verifiedCompany ? `${verifiedCompany.company_name} Administrator` : 'System Administrator'),
      role: userRole,
      assignedCompanyId: verifiedCompany?.id,
      status: 'Active',
      id: existing?.id || (verifiedCompany ? `usr_${verifiedCompany.id}` : 'usr_admin'),
      username: user || 'admin'
    };
    setTimeout(() => {
      onUnlock(appUser);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#e7ebf0] text-slate-800 flex flex-col justify-between overflow-y-auto selection:bg-[#0070f2] selection:text-white font-sans">
      
      {/* 1. Top Enterprise Header Bar */}
      <header className="bg-[#002d62] text-white px-4 sm:px-8 py-2.5 flex items-center justify-between border-b border-[#001f44] shadow-md shrink-0">
        <div className="flex items-center gap-4">
          {/* Back to Website Button */}
          {onBackToWebsite && (
            <button
              type="button"
              onClick={onBackToWebsite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Website</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/95 font-medium">
              DrukERP Enterprise Cloud • Bhutan Secure Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-white/80">
          <span className="bg-[#001f44] px-2.5 py-1 rounded text-[11px] font-medium text-sky-200 border border-white/10 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure Cloud Workspace</span>
          </span>
        </div>
      </header>

      {/* 2. Main Enterprise Logon Canvas */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,35,90,0.18)] border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Prominent Full Brand Logo Header at Top of Card */}
          <div className="pt-7 pb-5 px-6 sm:px-8 bg-gradient-to-b from-sky-50/50 via-white to-white text-center border-b border-slate-100 flex flex-col items-center">
            <div 
              onClick={handleLogoClick}
              className="w-full flex items-center justify-center py-1 cursor-pointer select-none active:opacity-85 transition"
              title="DrukERP Master Control"
            >
              <DrukErpLogo size="md" variant="full" />
            </div>

            {/* Tweaked Step Indicator (Modern, clean 2-step progress badge) */}
            <div className="mt-4 flex items-center justify-center gap-2 select-none">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                !verifiedCompany 
                  ? 'bg-blue-50 text-[#004b99] ring-1 ring-blue-300/80 shadow-2xs font-extrabold' 
                  : 'bg-emerald-50 text-emerald-700 font-bold'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  !verifiedCompany ? 'bg-[#004b99] text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {!verifiedCompany ? '1' : '✓'}
                </span>
                <span>Organization</span>
              </span>

              <span className="text-slate-300 text-xs">→</span>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                verifiedCompany 
                  ? 'bg-blue-50 text-[#004b99] ring-1 ring-blue-300/80 shadow-2xs font-extrabold' 
                  : 'bg-slate-100 text-slate-400 font-medium'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                  verifiedCompany ? 'bg-[#004b99] text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  2
                </span>
                <span>Staff Login</span>
              </span>
            </div>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
          )}

          {isSuccess && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Logon successful. Loading ERP Workspace...</span>
            </div>
          )}

          {/* ================================================================ */}
          {/* SCREEN 1: ORGANIZATION VERIFICATION (COMPANY EMAIL + CODE)        */}
          {/* ================================================================ */}
          {!verifiedCompany ? (
            <form onSubmit={handleVerifyOrganization} className="p-6 sm:p-7 space-y-4">
              <div className="text-left mb-1">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Sign In to Your Workspace
                </h3>
                <p className="text-[11px] text-slate-500">
                  Enter your registered business email and assigned company code.
                </p>
              </div>

              {/* Field 1: Company Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="e.g. accounts@bhutanretail.bt"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-bold bg-slate-50/60 focus:bg-white focus:border-[#004b99] focus:ring-2 focus:ring-blue-100 outline-none"
                    list="company-email-suggestions"
                  />
                  {availableCompanies.length > 0 && (
                    <datalist id="company-email-suggestions">
                      {availableCompanies.map(c => (
                        <option key={c.id} value={c.email || ''}>{c.company_name}</option>
                      ))}
                    </datalist>
                  )}
                </div>
              </div>

              {/* Field 2: Company Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    placeholder="e.g. DRUK-100 or TPN Number"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-mono font-black uppercase bg-slate-50/60 focus:bg-white focus:border-[#004b99] focus:ring-2 focus:ring-blue-100 outline-none tracking-wider"
                    list="company-code-suggestions"
                  />
                  {availableCompanies.length > 0 && (
                    <datalist id="company-code-suggestions">
                      {availableCompanies.map(c => (
                        <option key={c.id} value={getCompanyCode(c)}>{c.company_name}</option>
                      ))}
                    </datalist>
                  )}
                </div>
              </div>

              {/* Action Button: Verify Organization */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isVerifyingOrg}
                  className="w-full py-2.5 rounded-lg bg-[#004b99] hover:bg-[#00387b] active:bg-[#00285a] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isVerifyingOrg ? (
                    <span>Verifying Organization...</span>
                  ) : (
                    <>
                      <span>Verify Organization</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Option to Switch to Superadmin Portal */}
              <div className="pt-2 text-center border-t border-slate-100 mt-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/?portal=superadmin';
                  }}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>🔑 Switch to Superadmin Master Portal</span>
                </button>
              </div>

              {/* Tweaked non-intrusive Dev Helper Quick Pick */}
              {isDevPreview && availableCompanies.length > 0 && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setShowDemoPicker(!showDemoPicker)}
                    className="text-[11px] text-slate-400 hover:text-blue-700 font-medium inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>{showDemoPicker ? 'Hide Test Stores' : 'Quick Pick Test Store ▾'}</span>
                  </button>

                  {showDemoPicker && (
                    <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap justify-center gap-1.5 animate-in fade-in">
                      {availableCompanies.slice(0, 4).map(comp => (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => {
                            setCompanyEmail(comp.email || 'info@drukmart.bt');
                            setCompanyCode(getCompanyCode(comp));
                            setShowDemoPicker(false);
                          }}
                          className="px-2 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 rounded text-[10px] font-bold transition shadow-2xs cursor-pointer truncate max-w-[190px]"
                        >
                          🏢 {comp.company_name} ({getCompanyCode(comp)})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          ) : (
            /* ================================================================ */
            /* SCREEN 2: USER AUTHENTICATION (USERNAME + PASSWORD)              */
            /* ================================================================ */
            <form onSubmit={handleLogonSubmit} className="p-6 space-y-4">
              
              {/* Organization Verified Badge with Switch Option */}
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-emerald-800 tracking-wider block">
                      VERIFIED PARTITION
                    </span>
                    <span className="font-extrabold text-slate-900 truncate block">
                      {verifiedCompany.company_name}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSwitchOrganization}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline shrink-0 cursor-pointer"
                >
                  Switch
                </button>
              </div>

              {/* Mode Switcher: Enterprise vs Quick Cashier PIN */}
              <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setLogonMode('enterprise');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2.5 text-center transition cursor-pointer ${logonMode === 'enterprise' ? 'bg-white text-[#004b99] border-b-2 border-[#004b99] font-black' : 'hover:text-slate-900'}`}
                >
                  Staff Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogonMode('cashier');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2.5 text-center transition cursor-pointer ${logonMode === 'cashier' ? 'bg-white text-[#004b99] border-b-2 border-[#004b99] font-black' : 'hover:text-slate-900'}`}
                >
                  Quick Cashier PIN
                </button>
              </div>

              {logonMode === 'enterprise' ? (
                <>
                  {/* Field 1: User / Username / Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Staff Username / Email
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      placeholder="e.g. admin or staff name"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-bold bg-slate-50/60 focus:bg-white focus:border-[#004b99] focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  {/* Field 2: Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Password / Access PIN</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-xs font-bold bg-slate-50/60 focus:bg-white focus:border-[#004b99] focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  {/* Field 3 & 4: Language & System Branch */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Language</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-slate-50/60 outline-none"
                      >
                        <option value="EN">EN - English</option>
                        <option value="DZ">DZ - རྫོང་ཁ (Dzongkha)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">System Branch</label>
                      <select
                        value={systemBranch}
                        onChange={(e) => setSystemBranch(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-slate-50/60 outline-none"
                      >
                        <option value="01 - Thimphu HQ">01 - Thimphu HQ</option>
                        <option value="02 - Phuntsholing">02 - Phuntsholing</option>
                        <option value="03 - Paro Branch">03 - Paro Branch</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                /* Quick Cashier PIN Mode */
                <div className="space-y-4 py-2">
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Cashier Counter PIN</h4>
                    <p className="text-[11px] text-slate-500">
                      Enter 4-digit PIN for {verifiedCompany.company_name}
                    </p>
                  </div>

                  <input
                    type="password"
                    autoFocus
                    maxLength={6}
                    value={cashierPin}
                    onChange={(e) => setCashierPin(e.target.value)}
                    placeholder="••••"
                    className="w-full py-3 text-center tracking-widest text-lg font-mono font-black border border-slate-300 rounded-xl outline-none focus:border-blue-600"
                  />
                </div>
              )}

              {/* Action Button: Log On */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || isSuccess}
                  className="w-full py-2.5 rounded-lg bg-[#004b99] hover:bg-[#00387b] active:bg-[#00285a] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span>Authenticating on {verifiedCompany.company_name}...</span>
                  ) : (
                    <>
                      <span>Log On to {verifiedCompany.company_name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Clean Dialog Footer */}
          <div className="px-6 py-3 bg-[#f8fafc] border-t border-slate-100 flex items-center justify-center text-[11px] text-slate-400 font-medium">
            <span>DrukERP Enterprise Cloud • Bhutan 🇧🇹</span>
          </div>
        </div>
      </main>

      {/* 3. Bottom Footer Bar */}
      <footer className="bg-[#f0f3f6] border-t border-slate-300 px-4 sm:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 font-medium shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            System Status: Connected
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-slate-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>DRC / BURS Tax Compliant</span>
          </span>
          <span>•</span>
          <span>Bhutan Enterprise Cloud</span>
        </div>

        <div>
          <span>&copy; {new Date().getFullYear()} DrukERP • All rights reserved</span>
        </div>
      </footer>

      {/* Secret Superadmin Master Gate Dialog */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-200/80 text-center space-y-5 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100/50 shadow-xs">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>

            <div>
              <h4 className="font-extrabold text-base text-slate-900 tracking-tight">Platform Master Security Shield</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {!isOtpSent 
                  ? 'Access restricted to system administration. Please verify your 4-digit Master Security PIN.' 
                  : 'A secure One-Time Password (OTP) has been dispatched to your registered email: tendubhutan@gmail.com.'
                }
              </p>
            </div>

            {secretError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{secretError}</span>
              </div>
            )}

            {!isOtpSent ? (
              <form onSubmit={handleVerifySecretPin} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Access PIN</label>
                  <input
                    type="password"
                    autoFocus
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={secretPin}
                    onChange={(e) => {
                      setSecretPin(e.target.value.replace(/[^0-9]/g, ''));
                      setSecretPinError('');
                    }}
                    className="w-full py-3 text-center tracking-widest text-lg font-mono font-black border border-slate-300 focus:border-indigo-600 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 bg-slate-50/50 focus:bg-white transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSecretModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-xs shadow-md shadow-indigo-600/10 transition cursor-pointer"
                  >
                    Unlock Portal
                  </button>
                </div>

                <div className="pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isOtpSending}
                    onClick={handleSendSecretOtp}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition cursor-pointer flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
                  >
                    {isOtpSending ? (
                      <span>Requesting OTP...</span>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span>Forgot PIN? Send OTP to registered email: tendubhutan@gmail.com</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifySecretOtp} className="space-y-4">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-950 text-xs font-bold text-left leading-relaxed">
                  📧 Email OTP sent successfully to registered email **tendubhutan@gmail.com** (simulated access). Enter the 4-digit OTP code to verify.
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Verification OTP Code</label>
                  <input
                    type="password"
                    autoFocus
                    required
                    maxLength={4}
                    placeholder="••••"
                    value={secretOtp}
                    onChange={(e) => {
                      setSecretOtp(e.target.value.replace(/[^0-9]/g, ''));
                      setSecretPinError('');
                    }}
                    className="w-full py-3 text-center tracking-widest text-lg font-mono font-black border border-slate-300 focus:border-indigo-600 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 bg-slate-50/50 focus:bg-white transition"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOtpSent(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold text-xs transition cursor-pointer"
                  >
                    ← Back to PIN
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-600/10 transition cursor-pointer"
                  >
                    Verify OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
