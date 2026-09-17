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

// Load companies from Supabase or cached offline state
export async function fetchUserCompanies(): Promise<{ companies: SupabaseCompany[]; error?: string }> {
  try {
    if (!isSupabaseConfigured) {
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      const list = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
      return { companies: list };
    }

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('company_name', { ascending: true });

    if (error) {
      console.warn('Supabase fetchUserCompanies error, falling back to local cached list:', error.message);
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      const list = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
      return { companies: list, error: error.message };
    }

    if (data && data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(data));
      return { companies: data };
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
      return { companies: [insertedComp] };
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

      return { company: newComp };
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create company' };
  }
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

// Get and Set Active Company and FY IDs
export function getActiveCompanyId(): string {
  return localStorage.getItem(STORAGE_KEYS.TENANT_COMPANY_ID) || DEFAULT_TENANT_COMPANY.id;
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
