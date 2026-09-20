import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Calendar, 
  Check, 
  ShieldCheck, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  Lock, 
  Globe, 
  Share2, 
  Copy, 
  Trash2, 
  RotateCcw, 
  ExternalLink, 
  EyeOff, 
  Eye, 
  CheckCheck,
  CheckCircle2,
  HelpCircle,
  Edit3,
  Mail,
  Sparkles,
  Phone,
  MapPin,
  Coins
} from 'lucide-react';
import { 
  SupabaseCompany, 
  SupabaseFinancialYear, 
  fetchUserCompanies, 
  createCompany, 
  updateCompany,
  deleteCompany,
  fetchFinancialYears, 
  createFinancialYear, 
  getActiveCompanyId, 
  setActiveCompanyId, 
  getActiveFYId, 
  setActiveFYId,
  getCompanyDedicatedUrl,
  initializeBlankTenantStorage,
  DEFAULT_TENANT_COMPANY
} from '../services/supabaseTenantService';
import { resetCompanyToBlank } from '../services/storageService';
import { isSupabaseConfigured } from '../lib/supabase';
import { GlowButton } from './common/GlowButton';
import { getCurrentTenantSession } from '../services/authTenantContext';

interface CompanyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanySelected?: (company: SupabaseCompany) => void;
}

export const CompanyManagerModal: React.FC<CompanyManagerModalProps> = ({
  isOpen,
  onClose,
  onCompanySelected
}) => {
  const session = getCurrentTenantSession();
  const isSuperAdmin = session?.role === 'superadmin';

  const [companies, setCompanies] = useState<SupabaseCompany[]>([]);
  const [activeCompanyId, setActiveCompId] = useState<string>(getActiveCompanyId());
  const [financialYears, setFinancialYears] = useState<SupabaseFinancialYear[]>([]);
  const [activeFYId, setActiveFinancialYearId] = useState<string>(getActiveFYId());
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create_company' | 'edit_company' | 'create_fy'>('list');

  // Dedicated URL Share Modal state
  const [shareCompany, setShareCompany] = useState<SupabaseCompany | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Edit Company state
  const [editingCompany, setEditingCompany] = useState<SupabaseCompany | null>(null);

  // Reset & Delete confirmation states
  const [confirmResetCompany, setConfirmResetCompany] = useState<SupabaseCompany | null>(null);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<SupabaseCompany | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Preference: Hide demo company
  const [hideDemoCompany, setHideDemoCompany] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_hide_demo_company') === 'true';
  });

  // Form states for New / Edit Company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newTradeLicense, setNewTradeLicense] = useState('');
  const [newTPN, setNewTPN] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCurrency, setNewCurrency] = useState('Nu.');
  const [newAdminUsername, setNewAdminUsername] = useState('admin');
  const [newAdminName, setNewAdminName] = useState('Administrator');
  const [newAdminPin, setNewAdminPin] = useState('1234');
  const [newAdminPassword, setNewAdminPassword] = useState('ClientPass@123');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for New FY (Bhutan standard: Jan 1 to Dec 31)
  const currentYr = new Date().getFullYear();
  const [newFYName, setNewFYName] = useState(`FY ${currentYr}`);
  const [newFYStart, setNewFYStart] = useState(`${currentYr}-01-01`);
  const [newFYEnd, setNewFYEnd] = useState(`${currentYr}-12-31`);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { companies: comps, error: compErr } = await fetchUserCompanies(true);
      if (compErr) setError(compErr);
      setCompanies(comps);

      let currentCmpId = getActiveCompanyId();
      if (!comps.some(c => c.id === currentCmpId) && comps.length > 0) {
        currentCmpId = comps[0].id;
        setActiveCompanyId(currentCmpId);
      }
      setActiveCompId(currentCmpId);

      if (currentCmpId) {
        const { financialYears: fys } = await fetchFinancialYears(currentCmpId);
        setFinancialYears(fys);
        setActiveFinancialYearId(getActiveFYId());
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setViewMode('list');
      setShareCompany(null);
      setConfirmResetCompany(null);
      setConfirmDeleteCompany(null);
    }
  }, [isOpen]);

  const toggleHideDemo = async () => {
    const nextVal = !hideDemoCompany;
    setHideDemoCompany(nextVal);
    localStorage.setItem('deep_pos_hide_demo_company', String(nextVal));
    await loadData();
    showToast(nextVal ? 'Demo company hidden from view.' : 'Demo company visible in list.');
  };

  const handleSelectCompany = async (company: SupabaseCompany) => {
    // Strict multi-tenant security: non-superadmin cannot switch to other companies or demo
    if (!isSuperAdmin && session?.assignedCompanyId && company.id !== session.assignedCompanyId) {
      setError('Unauthorized: You are assigned exclusively to your organization and cannot switch companies.');
      return;
    }

    setActiveCompanyId(company.id);
    setActiveCompId(company.id);
    
    // Load financial years for this company
    const { financialYears: fys } = await fetchFinancialYears(company.id);
    setFinancialYears(fys);
    if (fys.length > 0) {
      setActiveFYId(fys[0].id);
      setActiveFinancialYearId(fys[0].id);
    }

    if (onCompanySelected) {
      onCompanySelected(company);
    }
    onClose();
  };

  const handleSelectFY = (fy: SupabaseFinancialYear) => {
    setActiveFYId(fy.id);
    setActiveFinancialYearId(fy.id);
    onClose();
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { company, error: createErr } = await createCompany({
        company_name: newCompanyName.trim(),
        trade_license_no: newTradeLicense.trim(),
        tax_payer_id: newTPN.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        address: newAddress.trim(),
        currency_symbol: newCurrency.trim() || 'Nu.',
        admin_username: newAdminUsername.trim().toLowerCase() || 'admin',
        admin_name: newAdminName.trim() || 'Administrator',
        admin_pin: newAdminPin.trim() || '1234',
        admin_password: newAdminPassword.trim() || newAdminPin.trim() || 'ClientPass@123'
      });

      if (createErr || !company) {
        setError(createErr || 'Failed to create company');
        setSubmitting(false);
        return;
      }

      // Guarantee clean blank slate for newly created client company
      resetCompanyToBlank(company.id);
      initializeBlankTenantStorage(company.id);

      // Reset form
      setNewCompanyName('');
      setNewTradeLicense('');
      setNewTPN('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      setNewAdminUsername('admin');
      setNewAdminName('Administrator');
      setNewAdminPin('1234');
      setNewAdminPassword('ClientPass@123');
      
      // Refresh list & select new company
      await loadData();
      handleSelectCompany(company);
      setViewMode('list');
      showToast(`Company "${company.company_name}" created with a clean blank slate.`);
    } catch (err: any) {
      setError(err?.message || 'Unexpected error creating company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditCompany = (comp: SupabaseCompany) => {
    setEditingCompany(comp);
    setNewCompanyName(comp.company_name || '');
    setNewTradeLicense(comp.trade_license_no || '');
    setNewTPN(comp.tax_payer_id || '');
    setNewPhone(comp.phone || '');
    setNewEmail(comp.email || '');
    setNewAddress(comp.address || '');
    setNewCurrency(comp.currency_symbol || 'Nu.');
    setNewAdminUsername(comp.admin_username || 'admin');
    setNewAdminName(comp.admin_name || 'Administrator');
    setNewAdminPin(comp.admin_pin || '1234');
    setNewAdminPassword(comp.admin_password || comp.admin_pin || 'ClientPass@123');
    setError(null);
    setViewMode('edit_company');
  };

  const handleUpdateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany || !newCompanyName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const { company, error: updateErr } = await updateCompany(editingCompany.id, {
        company_name: newCompanyName.trim(),
        trade_license_no: newTradeLicense.trim(),
        tax_payer_id: newTPN.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        address: newAddress.trim(),
        currency_symbol: newCurrency.trim() || 'Nu.',
        admin_username: newAdminUsername.trim().toLowerCase() || 'admin',
        admin_name: newAdminName.trim() || 'Administrator',
        admin_pin: newAdminPin.trim() || '1234',
        admin_password: newAdminPassword.trim() || newAdminPin.trim() || 'ClientPass@123'
      });

      if (updateErr) {
        setError(updateErr);
        setSubmitting(false);
        return;
      }

      await loadData();
      setViewMode('list');
      setEditingCompany(null);
      showToast(`Company "${newCompanyName.trim()}" login & details updated successfully.`);
    } catch (err: any) {
      setError(err?.message || 'Unexpected error updating company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFYSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFYName.trim() || !activeCompanyId) return;

    setSubmitting(true);
    setError(null);
    try {
      const { financialYear, error: createErr } = await createFinancialYear({
        company_id: activeCompanyId,
        fy_name: newFYName.trim(),
        start_date: newFYStart,
        end_date: newFYEnd,
        is_active: true,
        is_locked: false
      });

      if (createErr || !financialYear) {
        setError(createErr || 'Failed to create financial year');
        setSubmitting(false);
        return;
      }

      const { financialYears: fys } = await fetchFinancialYears(activeCompanyId);
      setFinancialYears(fys);
      handleSelectFY(financialYear);
      setViewMode('list');
    } catch (err: any) {
      setError(err?.message || 'Unexpected error creating financial year');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = (comp: SupabaseCompany) => {
    resetCompanyToBlank(comp.id);
    initializeBlankTenantStorage(comp.id);
    setConfirmResetCompany(null);
    showToast(`Company "${comp.company_name}" was successfully reset to a blank slate.`);
    if (comp.id === activeCompanyId) {
      window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: comp.id } }));
    }
  };

  const handleConfirmDelete = async (comp: SupabaseCompany) => {
    const res = await deleteCompany(comp.id);
    if (!res.success) {
      setError(res.error || 'Failed to delete company');
    } else {
      setConfirmDeleteCompany(null);
      showToast(`Company "${comp.company_name}" has been deleted.`);
      await loadData();
    }
  };

  const handleCopyShareUrl = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
      showToast('Dedicated client portal URL copied to clipboard!');
    }
  };

  if (!isOpen) return null;

  const isFormMode = viewMode === 'create_company' || viewMode === 'edit_company';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className={`bg-slate-900 border border-slate-700 w-full ${isFormMode ? 'max-w-4xl xl:max-w-5xl' : 'max-w-2xl'} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-200`}>
        
        {/* Modal Header */}
        <div className="bg-slate-800/90 border-b border-slate-700/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Multi-Tenant Company Workspaces
                {isSupabaseConfigured ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Supabase RLS Active
                  </span>
                ) : (
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Isolated Cloud Tenant
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Manage separate company profiles, share dedicated client URLs, and maintain clean tenant data.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-6 py-2.5 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-6">
              {/* Companies Section */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      Registered Companies ({companies.length})
                    </span>
                    
                    {/* Hide / Show Demo Company Toggle (Superadmin only) */}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={toggleHideDemo}
                        className={`text-[11px] px-2.5 py-0.5 rounded-md border flex items-center gap-1 transition cursor-pointer ${
                          hideDemoCompany 
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title="Hide or show the initial Demo Company (Bhutan Retail Enterprise)"
                      >
                        {hideDemoCompany ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        <span>{hideDemoCompany ? 'Demo Hidden' : 'Demo Visible'}</span>
                      </button>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewMode('create_company')}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Create Company</span>
                      </button>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
                    <span className="text-xs">Fetching company workspaces...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {companies.map((comp) => {
                      const isSelected = comp.id === activeCompanyId;
                      const isDemo = comp.id === DEFAULT_TENANT_COMPANY.id;

                      return (
                        <div
                          key={comp.id}
                          className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/30'
                              : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                          }`}
                        >
                          {/* Card Top: Clickable to select */}
                          <div 
                            onClick={() => handleSelectCompany(comp)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-sm text-white">{comp.company_name}</h4>
                                  {isDemo && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono font-semibold">
                                      DEMO
                                    </span>
                                  )}
                                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  {comp.trade_license_no && <span>GST: {comp.trade_license_no}</span>}
                  {comp.tax_payer_id && <span>TPN: {comp.tax_payer_id}</span>}
                  {!comp.trade_license_no && !comp.tax_payer_id && <span>Clean Client Workspace</span>}
                </p>
                                {comp.address && (
                                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{comp.address}</p>
                                )}
                                {comp.email ? (
                                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                                    <Mail className="h-3 w-3 text-blue-400 shrink-0" />
                                    <span className="truncate">{comp.email}</span>
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-amber-400/90 mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                    <span>No email set (Click Edit to add)</span>
                                  </p>
                                )}
                              </div>
                              {isSelected ? (
                                <span className="h-6 w-6 shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                              )}
                            </div>
                          </div>

                          {/* Action Toolbar on Card */}
                          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareCompany(comp);
                              }}
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium hover:underline cursor-pointer"
                              title="View & Share Dedicated Client URL"
                            >
                              <Share2 className="h-3 w-3" />
                              <span>Share Client Link</span>
                            </button>

                            <div className="flex items-center gap-2">
                              {/* Edit Company & Login Info Button */}
                              {isSuperAdmin && !isDemo && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditCompany(comp);
                                  }}
                                  className="text-slate-400 hover:text-blue-400 p-1 rounded hover:bg-slate-700/50 transition cursor-pointer flex items-center gap-1 text-[11px]"
                                  title="Edit Company Profile & Login Credentials"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {/* Reset to Blank Slate Button - NEVER allow for DEMO company, SuperAdmin only */}
                              {isSuperAdmin && !isDemo && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmResetCompany(comp);
                                  }}
                                  className="text-slate-400 hover:text-amber-400 p-1 rounded hover:bg-slate-700/50 transition cursor-pointer"
                                  title="Reset this company to 0 vouchers, 0 sales, 0 items (clean slate)"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Delete Company Button - NEVER allow for DEMO company, SuperAdmin only */}
                              {isSuperAdmin && !isDemo && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteCompany(comp);
                                  }}
                                  className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-700/50 transition cursor-pointer"
                                  title="Permanently delete this company"
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

              {/* Financial Year Section */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Financial Years for Active Company
                  </span>
                  <button
                    onClick={() => setViewMode('create_fy')}
                    className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Financial Year</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {financialYears.map((fy) => {
                    const isSelected = fy.id === activeFYId;
                    return (
                      <div
                        key={fy.id}
                        onClick={() => handleSelectFY(fy)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200'
                            : 'bg-slate-800/40 border-slate-700 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-sm block">{fy.fy_name}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {fy.start_date} → {fy.end_date}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="h-5 w-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CREATE COMPANY VIEW */}
          {viewMode === 'create_company' && (
            <form onSubmit={handleCreateCompanySubmit} className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Register New Client Company</span>
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Clean Blank Slate
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Configure legal business details, cloud database login, and in-store counter credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  ← Back to List
                </button>
              </div>

              {/* 2-Column Responsive Grid: Company Profile (Left) & Access Credentials (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
                {/* LEFT COLUMN: Business Profile */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Business Profile</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Invoice & Tax Info</span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {/* Company / Trade Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Company / Trade Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Druk Wangyel Supermarket"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-medium"
                      />
                    </div>

                    {/* GST No & TPN (2-column) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          GST / License No
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GST-2026-9041"
                          value={newTradeLicense}
                          onChange={(e) => setNewTradeLicense(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Tax Payer ID (TPN)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TPN-4050607"
                          value={newTPN}
                          onChange={(e) => setNewTPN(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    {/* Phone & Currency (2-column) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>Contact Phone</span>
                        </label>
                        <input
                          type="text"
                          placeholder="+975 17 000 000"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-400" />
                          <span>Currency Symbol</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Nu."
                          value={newCurrency}
                          onChange={(e) => setNewCurrency(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-amber-300 font-bold font-mono text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Physical Address */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>Physical Store / Office Address</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Changlam Square, Thimphu"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Access & Security Credentials */}
                <div className="space-y-3 flex flex-col justify-between">
                  {/* Card 1: Cloud & System Sign-In Credentials */}
                  <div className="bg-slate-950/70 rounded-xl border border-blue-500/35 p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/20">
                      <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-blue-400" />
                        <span>Cloud Sign-In Credentials</span>
                      </div>
                      <span className="text-[10px] text-blue-400 bg-blue-950/90 px-2 py-0.5 rounded-full border border-blue-800/60 font-mono">
                        Main System Login
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>Client Login Email</span>
                        </label>
                        <input
                          type="email"
                          placeholder="client.name@store.bt"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span>Client Cloud Password</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                          >
                            {showAdminPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            <span>{showAdminPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          placeholder="e.g. ClientPass@123"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-amber-300 font-mono text-xs focus:border-blue-500 focus:outline-hidden font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: In-Store Counter & POS Identity */}
                  <div className="bg-slate-950/70 rounded-xl border border-emerald-500/30 p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>In-Store Counter & POS Identity</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
                        POS Terminal / Register
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Admin Full Name (Printed on Bills & Reports)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tenzin Norbu"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Cashier Username
                          </label>
                          <input
                            type="text"
                            placeholder="admin"
                            value={newAdminUsername}
                            onChange={(e) => setNewAdminUsername(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Quick Security PIN
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="1234"
                            value={newAdminPin}
                            onChange={(e) => setNewAdminPin(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-emerald-400 font-bold text-xs focus:border-blue-500 focus:outline-hidden font-mono tracking-widest"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Action Bar */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-blue-300/80 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Starts 100% clean: 0 vouchers, 0 sales invoices, and 0 stock items.</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>Register Client Company</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* EDIT COMPANY VIEW */}
          {viewMode === 'edit_company' && editingCompany && (
            <form onSubmit={handleUpdateCompanySubmit} className="space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Edit Client Profile & Login</span>
                      <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-medium px-2 py-0.5 rounded-full font-mono">
                        {editingCompany.company_name}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Update official company contact details, tax numbers, and login credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    setEditingCompany(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  ← Back to List
                </button>
              </div>

              {/* 2-Column Responsive Grid: Company Profile (Left) & Access Credentials (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
                {/* LEFT COLUMN: Business Profile */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Business Profile</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Invoice & Tax Info</span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {/* Company / Trade Name */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Company / Trade Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Druk Wangyel Supermarket"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-medium"
                      />
                    </div>

                    {/* GST No & TPN (2-column) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          GST / License No
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GST-2026-9041"
                          value={newTradeLicense}
                          onChange={(e) => setNewTradeLicense(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Tax Payer ID (TPN)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TPN-4050607"
                          value={newTPN}
                          onChange={(e) => setNewTPN(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    {/* Phone & Currency (2-column) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>Contact Phone</span>
                        </label>
                        <input
                          type="text"
                          placeholder="+975 17 000 000"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-400" />
                          <span>Currency Symbol</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Nu."
                          value={newCurrency}
                          onChange={(e) => setNewCurrency(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-amber-300 font-bold font-mono text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Physical Address */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>Physical Store / Office Address</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Changlam Square, Thimphu"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Access & Security Credentials */}
                <div className="space-y-3 flex flex-col justify-between">
                  {/* Card 1: Cloud & System Sign-In Credentials */}
                  <div className="bg-slate-950/70 rounded-xl border border-blue-500/35 p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/20">
                      <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-blue-400" />
                        <span>Cloud Sign-In Credentials</span>
                      </div>
                      <span className="text-[10px] text-blue-400 bg-blue-950/90 px-2 py-0.5 rounded-full border border-blue-800/60 font-mono">
                        Main System Login
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>Client Login Email</span>
                        </label>
                        <input
                          type="email"
                          placeholder="client.name@company.bt"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full bg-slate-900 border border-blue-500/50 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span>Client Cloud Password</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                          >
                            {showAdminPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            <span>{showAdminPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          placeholder="e.g. ClientPass@123"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-amber-300 font-mono text-xs focus:border-blue-500 focus:outline-hidden font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: In-Store Counter & POS Identity */}
                  <div className="bg-slate-950/70 rounded-xl border border-emerald-500/30 p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>In-Store Counter & POS Identity</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
                        POS Terminal / Register
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Admin Full Name (Printed on Bills & Reports)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Tenzin Norbu"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Cashier Username
                          </label>
                          <input
                            type="text"
                            placeholder="admin"
                            value={newAdminUsername}
                            onChange={(e) => setNewAdminUsername(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Quick Security PIN
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="1234"
                            value={newAdminPin}
                            onChange={(e) => setNewAdminPin(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-1.5 sm:py-2 text-emerald-400 font-bold text-xs focus:border-blue-500 focus:outline-hidden font-mono tracking-widest"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Action Bar */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Tenant ID: <code className="text-slate-300 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded">{editingCompany.id.slice(0, 18)}...</code></span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('list');
                      setEditingCompany(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Save Company Details</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* CREATE FINANCIAL YEAR VIEW */}
          {viewMode === 'create_fy' && (
            <form onSubmit={handleCreateFYSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  Add Financial Year
                </h3>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back to List
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Financial Year Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FY 2026"
                    value={newFYName}
                    onChange={(e) => setNewFYName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={newFYStart}
                      onChange={(e) => setNewFYStart(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={newFYEnd}
                      onChange={(e) => setNewFYEnd(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Save Financial Year</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-800/90 border-t border-slate-700/80 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-blue-400" />
            <span>Dedicated Tenant Isolation Enabled</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* DEDICATED CLIENT URL SHARE POPUP */}
      {shareCompany && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-blue-500/60 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Share2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Dedicated Client Portal URL</h3>
                  <p className="text-xs text-slate-400">{shareCompany.company_name}</p>
                </div>
              </div>
              <button
                onClick={() => setShareCompany(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Provide this dedicated URL to your client or bookmark it on their POS terminal. When accessed via this link, the system opens directly into their isolated company workspace with no demo data.
              </p>

              {/* Dedicated Client Portal Link */}
              {(() => {
                const isCustomOrCloudflare = typeof window !== 'undefined' && 
                  !window.location.origin.includes('ais-dev-') && 
                  !window.location.origin.includes('ais-pre-') && 
                  !window.location.origin.includes('localhost') && 
                  !window.location.origin.includes('127.0.0.1');

                const clientDedicatedUrl = isCustomOrCloudflare
                  ? `${window.location.origin}/?company=${shareCompany.id}`
                  : `https://bhutan-pos.tendubhutan.workers.dev/?company=${shareCompany.id}`;

                const displayHost = isCustomOrCloudflare
                  ? window.location.host
                  : 'bhutan-pos.tendubhutan.workers.dev';

                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        Client Production Portal Link
                      </label>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                        {displayHost}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={clientDedicatedUrl}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 select-all focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyShareUrl(clientDedicatedUrl)}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        {copiedUrl ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Dedicated Client Admin Credentials */}
              <div className="bg-slate-950/80 border border-blue-500/40 rounded-xl p-3 text-xs space-y-2.5">
                <div className="font-semibold text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Client Credentials Package</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShareCompany(null);
                      handleStartEditCompany(shareCompany);
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit Credentials / Password</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Cloud Login Email</span>
                    <span className="text-blue-300 font-mono font-bold text-xs truncate block" title={shareCompany.email || 'Not configured'}>
                      {shareCompany.email || <span className="text-amber-400 font-normal italic">Not set</span>}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Cloud Password</span>
                    <span className="text-amber-300 font-mono font-bold text-xs truncate block">
                      {shareCompany.admin_password || shareCompany.admin_pin || 'ClientPass@123'}
                    </span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Cashier Username</span>
                    <span className="text-white font-mono font-bold text-xs">{shareCompany.admin_username || 'admin'}</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Quick POS PIN</span>
                    <span className="text-emerald-400 font-mono font-bold text-xs tracking-wider">{shareCompany.admin_pin || '1234'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const clientLink = getCompanyDedicatedUrl(shareCompany.id, true);
                    const text = `Company: ${shareCompany.company_name}
Direct URL: ${clientLink}
Client Login Email: ${shareCompany.email || 'N/A'}
Cloud Login Password: ${shareCompany.admin_password || shareCompany.admin_pin || 'ClientPass@123'}
POS Cashier Username: ${shareCompany.admin_username || 'admin'}
POS Quick Unlock PIN: ${shareCompany.admin_pin || '1234'}`;
                    navigator.clipboard.writeText(text);
                    showToast('Full access details (Link, Email, Password, Username & PIN) copied!');
                  }}
                  className="w-full py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Complete Access Package (URL + Email + Password + Username + PIN)</span>
                </button>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-blue-400" />
                  How to share with your client:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>Send <strong className="text-slate-300 break-all">{getCompanyDedicatedUrl(shareCompany.id, true)}</strong> to the client via WhatsApp, SMS, or Email.</li>
                  <li>Opening this link opens <strong>{shareCompany.company_name}</strong> in client mode.</li>
                  <li>The company is completely isolated with its own data and 0 demo records.</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareCompany(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.open(getCompanyDedicatedUrl(shareCompany.id), '_blank')}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in New Tab</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESET TO BLANK SLATE DIALOG */}
      {confirmResetCompany && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/60 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Reset to 100% Blank Slate?</h3>
                <p className="text-xs text-amber-300 font-semibold">{confirmResetCompany.company_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will erase any demo vouchers, test sales invoices, purchase records, and items for this company, returning it to a completely empty, fresh state.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetCompany(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmReset(confirmResetCompany)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Yes, Reset to Blank</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE COMPANY DIALOG */}
      {confirmDeleteCompany && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/60 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Permanently Delete Company?</h3>
                <p className="text-xs text-rose-300 font-semibold">{confirmDeleteCompany.company_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete this company workspace? All associated financial years and isolated records will be permanently removed.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCompany(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(confirmDeleteCompany)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Company</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
