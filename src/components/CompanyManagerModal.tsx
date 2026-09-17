import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Calendar, 
  Check, 
  ShieldCheck, 
  ChevronRight, 
  Database, 
  RefreshCw, 
  AlertCircle, 
  Sparkles,
  Lock,
  Globe
} from 'lucide-react';
import { 
  SupabaseCompany, 
  SupabaseFinancialYear, 
  fetchUserCompanies, 
  createCompany, 
  fetchFinancialYears, 
  createFinancialYear, 
  getActiveCompanyId, 
  setActiveCompanyId, 
  getActiveFYId, 
  setActiveFYId 
} from '../services/supabaseTenantService';
import { isSupabaseConfigured } from '../lib/supabase';
import { GlowButton } from './common/GlowButton';

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
  const [companies, setCompanies] = useState<SupabaseCompany[]>([]);
  const [activeCompanyId, setActiveCompId] = useState<string>(getActiveCompanyId());
  const [financialYears, setFinancialYears] = useState<SupabaseFinancialYear[]>([]);
  const [activeFYId, setActiveFinancialYearId] = useState<string>(getActiveFYId());
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'create_company' | 'create_fy'>('list');

  // Form states for New Company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newTradeLicense, setNewTradeLicense] = useState('');
  const [newTPN, setNewTPN] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCurrency, setNewCurrency] = useState('Nu.');
  const [submitting, setSubmitting] = useState(false);

  // Form states for New FY (Bhutan standard: Jan 1 to Dec 31)
  const currentYr = new Date().getFullYear();
  const [newFYName, setNewFYName] = useState(`FY ${currentYr}`);
  const [newFYStart, setNewFYStart] = useState(`${currentYr}-01-01`);
  const [newFYEnd, setNewFYEnd] = useState(`${currentYr}-12-31`);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { companies: comps, error: compErr } = await fetchUserCompanies();
      if (compErr) setError(compErr);
      setCompanies(comps);

      let currentCmpId = getActiveCompanyId();
      // Ensure currentCmpId exists in comps
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
    }
  }, [isOpen]);

  const handleSelectCompany = async (company: SupabaseCompany) => {
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
        currency_symbol: newCurrency.trim() || 'Nu.'
      });

      if (createErr || !company) {
        setError(createErr || 'Failed to create company');
        setSubmitting(false);
        return;
      }

      // Reset form
      setNewCompanyName('');
      setNewTradeLicense('');
      setNewTPN('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      
      // Refresh list & select new company
      await loadData();
      handleSelectCompany(company);
      setViewMode('list');
    } catch (err: any) {
      setError(err?.message || 'Unexpected error creating company');
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

      setNewFYName('');
      await loadData();
      handleSelectFY(financialYear);
      setViewMode('list');
    } catch (err: any) {
      setError(err?.message || 'Error creating financial year');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-800/90 border-b border-slate-700/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Multi-Tenant Company & Financial Year
                {isSupabaseConfigured ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Supabase RLS Active
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Local Tenant Sandbox
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Switch or create isolated company databases with strict Row-Level Security isolation.
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
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-400" />
                    Registered Companies ({companies.length})
                  </span>
                  <button
                    onClick={() => setViewMode('create_company')}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create Company</span>
                  </button>
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
                      return (
                        <div
                          key={comp.id}
                          onClick={() => handleSelectCompany(comp)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                            isSelected
                              ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/30'
                              : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-white">{comp.company_name}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {comp.tax_payer_id ? `TPN: ${comp.tax_payer_id}` : 'Standard Tenant'}
                              </p>
                              {comp.address && (
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{comp.address}</p>
                              )}
                            </div>
                            {isSelected ? (
                              <span className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs">
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-500" />
                            )}
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
                    <span>New Financial Year</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {financialYears.map((fy) => {
                    const isSelected = fy.id === activeFYId;
                    return (
                      <div
                        key={fy.id}
                        onClick={() => handleSelectFY(fy)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30'
                            : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-white">{fy.fy_name}</h4>
                            {fy.is_locked && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                                Locked
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {fy.start_date} → {fy.end_date}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
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

          {/* Create Company View */}
          {viewMode === 'create_company' && (
            <form onSubmit={handleCreateCompanySubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  Create New Isolated Company Tenant
                </h3>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Store Name *</label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Royal Himalayan Trading Pvt Ltd"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">TPN / Tax ID</label>
                  <input
                    type="text"
                    value={newTPN}
                    onChange={(e) => setNewTPN(e.target.value)}
                    placeholder="e.g. TPN-1029384"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Trade License No</label>
                  <input
                    type="text"
                    value={newTradeLicense}
                    onChange={(e) => setNewTradeLicense(e.target.value)}
                    placeholder="e.g. TRD-2024-8891"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +975 17 123 456"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    placeholder="e.g. Nu. or $"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Office / Store Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="e.g. Norzin Lam, Thimphu, Bhutan"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-hidden"
                  />
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
                  className="px-5 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Save & Switch to Company</span>
                </button>
              </div>
            </form>
          )}

          {/* Create Financial Year View */}
          {viewMode === 'create_fy' && (
            <form onSubmit={handleCreateFYSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  Add Financial Year
                </h3>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Financial Year Name *</label>
                  <input
                    type="text"
                    required
                    value={newFYName}
                    onChange={(e) => setNewFYName(e.target.value)}
                    placeholder="e.g. FY 2026"
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
            <span>Supabase Database Tenant Isolation</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
