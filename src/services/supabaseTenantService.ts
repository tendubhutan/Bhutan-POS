import { supabase, isSupabaseConfigured, SupabaseCompany, SupabaseFinancialYear, SupabaseAppUser } from '../lib/supabase';
import { Config, AppUser } from '../types';

export type { SupabaseCompany, SupabaseFinancialYear, SupabaseAppUser };

export interface MultiTenantSessionState {
  currentCompany: SupabaseCompany | null;
  currentFinancialYear: SupabaseFinancialYear | null;
  currentUser: SupabaseAppUser | null;
  companies: SupabaseCompany[];
  financialYears: SupabaseFinancialYear[];
  isConnected: boolean;
  error?: string | null;
}

const STORAGE_KEYS = {
  TENANT_COMPANY_ID: 'supabase_active_company_id',
  TENANT_FY_ID: 'supabase_active_fy_id',
  LOCAL_COMPANIES: 'supabase_cached_companies',
  LOCAL_FYS: 'supabase_cached_fys'
};

// Standard UUID generator compatible with Postgres uuid column type
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Check if the browser URL specifies a dedicated tenant company
 * e.g. https://.../?company=uuid or ?cid=uuid
 */
export function getDedicatedCompanyIdFromUrl(): string | null {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('company') || params.get('cid') || params.get('tenant') || null;
  } catch {
    return null;
  }
}

export const PRODUCTION_BASE_URL = 'https://bhutan-pos.web.app';

/**
 * Generates the full dedicated client portal URL for a specific company.
 * Defaults to the production domain: https://bhutan-pos.web.app/?company=...
 */
export function getCompanyDedicatedUrl(companyId: string, forceCurrentOrigin: boolean = false): string {
  if (forceCurrentOrigin && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?company=${companyId}`;
  }
  return `${PRODUCTION_BASE_URL}/?company=${companyId}`;
}

// Fallback / Initial Demo Company
export const DEFAULT_TENANT_COMPANY: SupabaseCompany = {
  id: '00000000-0000-0000-0000-000000000001',
  company_name: 'Bhutan Retail Enterprise',
  trade_license_no: 'TRD-2024-8891',
  tax_payer_id: 'TPN-1029384',
  phone: '+975 17 654 321',
  email: 'accounts@bhutanretail.bt',
  address: 'Norzin Lam, Sector 2, Thimphu, Bhutan',
  currency_symbol: 'Nu.'
};

export const DEFAULT_TENANT_FY: SupabaseFinancialYear = {
  id: '00000000-0000-0000-0000-000000000002',
  company_id: '00000000-0000-0000-0000-000000000001',
  fy_name: 'FY 2026',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  is_active: true,
  is_locked: false
};

// Filter companies according to dedicated client URL or hide demo company preference
function filterCompaniesForView(list: SupabaseCompany[]): SupabaseCompany[] {
  if (!list || list.length === 0) return [DEFAULT_TENANT_COMPANY];

  // 1. If accessed via dedicated client URL parameter (?company=...), lock ONLY to this specific company
  const dedicatedId = getDedicatedCompanyIdFromUrl();
  if (dedicatedId) {
    const matched = list.filter(c => c.id === dedicatedId);
    if (matched.length > 0) return matched;
  }

  // 2. If client mode is active, or if user explicitly chose to hide demo company, and at least one real company exists
  const hideDemo = typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_hide_demo_company') === 'true';
  const isClient = typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_is_client_mode') === 'true';
  if ((hideDemo || isClient) && list.length > 1) {
    const withoutDemo = list.filter(c => c.id !== DEFAULT_TENANT_COMPANY.id);
    if (withoutDemo.length > 0) return withoutDemo;
  }

  return list;
}

// Load companies from Supabase or cached offline state
export async function fetchUserCompanies(): Promise<{ companies: SupabaseCompany[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) {
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      const list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
      return { companies: filterCompaniesForView(list) };
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('company_name', { ascending: true });

    if (error) {
      console.warn('Supabase fetchUserCompanies error, falling back to local cached list:', error.message);
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      const list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
      return { companies: filterCompaniesForView(list), error: error.message };
    }

    if (data && data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(data));
      return { companies: filterCompaniesForView(data) };
    }

    // If Supabase table is empty, auto-bootstrap the initial default company into Supabase
    const { data: insertedComp, error: insertErr } = await supabase
      .from('companies')
      .insert([{
        company_name: DEFAULT_TENANT_COMPANY.company_name,
        trade_license_no: DEFAULT_TENANT_COMPANY.trade_license_no,
        tax_payer_id: DEFAULT_TENANT_COMPANY.tax_payer_id,
        phone: DEFAULT_TENANT_COMPANY.phone,
        email: DEFAULT_TENANT_COMPANY.email,
        address: DEFAULT_TENANT_COMPANY.address,
        currency_symbol: DEFAULT_TENANT_COMPANY.currency_symbol
      }])
      .select()
      .single();

    if (!insertErr && insertedComp) {
      // Also bootstrap initial FY
      const curYr = new Date().getFullYear();
      await supabase
        .from('financial_years')
        .insert([{
          company_id: insertedComp.id,
          fy_name: `FY ${curYr}`,
          start_date: `${curYr}-01-01`,
          end_date: `${curYr}-12-31`,
          is_active: true,
          is_locked: false
        }]);

      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify([insertedComp]));
      localStorage.setItem(STORAGE_KEYS.TENANT_COMPANY_ID, insertedComp.id);
      return { companies: filterCompaniesForView([insertedComp]) };
    }

    return { companies: [DEFAULT_TENANT_COMPANY] };
  } catch (err: any) {
    return { companies: [DEFAULT_TENANT_COMPANY], error: err?.message || 'Error fetching companies' };
  }
}

// Create new company in Supabase
export async function createCompany(companyData: Omit<SupabaseCompany, 'id' | 'created_at'>): Promise<{ company?: SupabaseCompany; error?: string }> {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('companies')
        .insert([{
          company_name: companyData.company_name,
          trade_license_no: companyData.trade_license_no,
          tax_payer_id: companyData.tax_payer_id,
          phone: companyData.phone,
          email: companyData.email,
          address: companyData.address,
          currency_symbol: companyData.currency_symbol,
          logo_url: companyData.logo_url
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to create company in Supabase:', error);
        return { error: error.message };
      }

      // Automatically create the initial default Financial Year for this new company (Bhutan: Jan 1 - Dec 31)
      const currentYear = new Date().getFullYear();
      await createFinancialYear({
        company_id: data.id,
        fy_name: `FY ${currentYear}`,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        is_active: true,
        is_locked: false
      });

      // Initialize clean blank slate for new tenant
      initializeBlankTenantStorage(data.id);
      return { company: data };
    } else {
      // Local demo persistence
      const newId = generateUUID();
      const newComp: SupabaseCompany = {
        id: newId,
        ...companyData
      };
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      const list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
      list.push(newComp);
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(list));

      const currentYear = new Date().getFullYear();
      await createFinancialYear({
        company_id: newComp.id,
        fy_name: `FY ${currentYear}`,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        is_active: true,
        is_locked: false
      });

      // Initialize clean blank slate for new tenant
      initializeBlankTenantStorage(newComp.id);
      return { company: newComp };
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create company' };
  }
}

export function initializeBlankTenantStorage(cId: string) {
  if (!cId || typeof localStorage === 'undefined') return;
  const prefixes = [
    'deep_pos_vouchers',
    'deep_pos_sales_invoices',
    'deep_pos_purchase_invoices',
    'deep_pos_stock_ledger',
    'deep_pos_ledger_log',
    'deep_pos_held_bills',
    'deep_pos_items',
    'deep_pos_quotations',
    'deep_pos_delivery_notes',
    'deep_pos_sales_orders',
    'deep_pos_purchase_orders',
    'deep_pos_receipt_notes',
    'deep_pos_physical_stock',
    'deep_pos_monthly_payrolls',
    'deep_pos_employee_advances',
    'deep_pos_bank_recon',
    'deep_pos_trash',
    'deep_pos_audit_log',
    'deep_pos_deleted_items',
    'deep_pos_deleted_ledgers',
    'deep_pos_am_assets',
    'deep_pos_am_disposals'
  ];
  prefixes.forEach(p => {
    localStorage.setItem(`${p}_${cId}`, '[]');
  });
  localStorage.setItem(`deep_pos_counters_${cId}`, JSON.stringify({
    SalesInvoice: 0,
    POSInvoice: 0,
    PurchaseInvoice: 0,
    PaymentVoucher: 0,
    ReceiptVoucher: 0,
    JournalVoucher: 0,
    ContraVoucher: 0,
    CreditNote: 0,
    DebitNote: 0,
    Voucher: 0
  }));
}

// Fetch financial years for a company
export async function fetchFinancialYears(companyId: string): Promise<{ financialYears: SupabaseFinancialYear[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) {
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_FYS);
      let list: SupabaseFinancialYear[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_FY];
      
      // Auto-migrate any legacy 2025-2026 April-March entries to standard Bhutan Jan-Dec calendar
      let modified = false;
      list = list.map(fy => {
        if (fy.id === 'fy_2025_2026' || fy.fy_name === 'FY 2025-2026' || fy.start_date.endsWith('-04-01')) {
          modified = true;
          return {
            ...fy,
            id: '00000000-0000-0000-0000-000000000002',
            fy_name: 'FY 2026',
            start_date: '2026-01-01',
            end_date: '2026-12-31'
          };
        }
        return fy;
      });
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_FYS, JSON.stringify(list));
      }

      const filtered = list.filter(f => f.company_id === companyId);
      return { financialYears: filtered.length > 0 ? filtered : [DEFAULT_TENANT_FY] };
    }

    // If companyId is not a valid UUID format (e.g. legacy cached 'cmp_demo_main'), try finding first real company in db
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetCompanyId = companyId;

    if (!uuidRegex.test(targetCompanyId)) {
      const { companies } = await fetchUserCompanies();
      const validCompany = companies.find(c => uuidRegex.test(c.id));
      if (validCompany) {
        targetCompanyId = validCompany.id;
        setActiveCompanyId(targetCompanyId);
      } else {
        return { financialYears: [DEFAULT_TENANT_FY] };
      }
    }

    const { data, error } = await supabase
      .from('financial_years')
      .select('*')
      .eq('company_id', targetCompanyId)
      .order('start_date', { ascending: false });

    if (error) {
      return { financialYears: [], error: error.message };
    }

    return { financialYears: data || [] };
  } catch (err: any) {
    return { financialYears: [], error: err?.message || 'Error fetching financial years' };
  }
}

// Create new financial year for active company
export async function createFinancialYear(fyData: Omit<SupabaseFinancialYear, 'id' | 'created_at'>): Promise<{ financialYear?: SupabaseFinancialYear; error?: string }> {
  try {
    if (isSupabaseConfigured) {
      // Ensure company_id is a valid UUID
      let targetCompanyId = fyData.company_id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetCompanyId)) {
        const { companies } = await fetchUserCompanies();
        const validCompany = companies.find(c => uuidRegex.test(c.id));
        if (validCompany) {
          targetCompanyId = validCompany.id;
          setActiveCompanyId(targetCompanyId);
        } else {
          return { error: 'Invalid Company selection. Please select or create a valid company first.' };
        }
      }

      const { data, error } = await supabase
        .from('financial_years')
        .insert([{
          company_id: targetCompanyId,
          fy_name: fyData.fy_name,
          start_date: fyData.start_date,
          end_date: fyData.end_date,
          is_active: fyData.is_active ?? true,
          is_locked: fyData.is_locked ?? false
        }])
        .select()
        .single();

      if (error) {
        console.error('Failed to create financial year in Supabase:', error);
        return { error: error.message };
      }
      return { financialYear: data };
    } else {
      const newId = generateUUID();
      const newFY: SupabaseFinancialYear = {
        id: newId,
        ...fyData
      };
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_FYS);
      const list: SupabaseFinancialYear[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_FY];
      list.push(newFY);
      localStorage.setItem(STORAGE_KEYS.LOCAL_FYS, JSON.stringify(list));
      return { financialYear: newFY };
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create financial year' };
  }
}

/**
 * Permanently delete a company and purge its tenant data
 */
export async function deleteCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
    let list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];

    if (list.length <= 1) {
      return { success: false, error: 'Cannot delete the only registered company. Create another company first.' };
    }

    list = list.filter(c => c.id !== companyId);
    localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(list));

    // Clear all tenant-scoped data keys for this company from localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(`_${companyId}`)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Also remove financial years for this company
    const cachedFYs = localStorage.getItem(STORAGE_KEYS.LOCAL_FYS);
    if (cachedFYs) {
      try {
        let fys: SupabaseFinancialYear[] = JSON.parse(cachedFYs);
        fys = fys.filter(f => f.company_id !== companyId);
        localStorage.setItem(STORAGE_KEYS.LOCAL_FYS, JSON.stringify(fys));
      } catch {}
    }

    // If deleted company was active, switch active company to the first remaining company
    if (getActiveCompanyId() === companyId) {
      const nextComp = list[0];
      setActiveCompanyId(nextComp.id);
    }

    if (isSupabaseConfigured) {
      await supabase.from('companies').delete().eq('id', companyId);
      await supabase.from('financial_years').delete().eq('company_id', companyId);
    }

    window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: list[0].id } }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete company' };
  }
}

// Get and Set Active Company and FY IDs
export function getActiveCompanyId(): string {
  const urlId = getDedicatedCompanyIdFromUrl();
  if (urlId) {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TENANT_COMPANY_ID) : null;
    if (stored !== urlId && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.TENANT_COMPANY_ID, urlId);
    }
    return urlId;
  }
  return (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEYS.TENANT_COMPANY_ID)) || DEFAULT_TENANT_COMPANY.id;
}

export function setActiveCompanyId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.TENANT_COMPANY_ID, id);
  window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: id } }));
}

export function getActiveFYId(): string {
  const stored = localStorage.getItem(STORAGE_KEYS.TENANT_FY_ID);
  if (!stored || stored === 'fy_2025_2026') {
    return DEFAULT_TENANT_FY.id;
  }
  return stored;
}

export function setActiveFYId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.TENANT_FY_ID, id);
  window.dispatchEvent(new CustomEvent('supabase:fy_changed', { detail: { fyId: id } }));
}
