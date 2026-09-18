import { supabase, isSupabaseConfigured, SupabaseCompany, SupabaseFinancialYear, SupabaseAppUser } from '../lib/supabase';
import { Config, AppUser } from '../types';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';

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
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('company') || searchParams.get('cid') || searchParams.get('tenant');
    if (fromSearch) return fromSearch;

    // Support hash fragment URLs like /#/?company=... or /#/path?company=...
    if (window.location.hash && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      const hashParams = new URLSearchParams(hashQuery);
      return hashParams.get('company') || hashParams.get('cid') || hashParams.get('tenant') || null;
    }
    return null;
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

// Fallback / Initial Demo Company (Actual UUID from Supabase)
export const DEFAULT_TENANT_COMPANY: SupabaseCompany = {
  id: '30a4e773-585a-45a3-8fce-a32f94bbc7e0',
  company_name: 'Bhutan Retail Enterprise',
  trade_license_no: 'TRD-2024-8891',
  tax_payer_id: 'TPN-1029384',
  phone: '+975 17 654 321',
  email: 'accounts@bhutanretail.bt',
  address: 'Norzin Lam, Sector 2, Thimphu, Bhutan',
  currency_symbol: 'Nu.'
};

export const DEFAULT_TENANT_FY: SupabaseFinancialYear = {
  id: '35b9e0fb-3e95-4571-9e4c-f263226c4ede',
  company_id: '30a4e773-585a-45a3-8fce-a32f94bbc7e0',
  fy_name: 'FY 2026',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  is_active: true,
  is_locked: false
};

// Filter companies according to dedicated client URL or hide demo company preference
function filterCompaniesForView(list: SupabaseCompany[]): SupabaseCompany[] {
  // Check if non-superadmin has an assigned company
  const assignedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_assigned_company') : null;
  const role = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_role') : null;
  if (role && role !== 'superadmin' && assignedCompanyId) {
    const matched = list.filter(c => c.id === assignedCompanyId);
    if (matched.length > 0) return matched;
    return [{
      id: assignedCompanyId,
      company_name: 'Client Workspace',
      currency_symbol: 'Nu.'
    }];
  }

  const dedicatedId = getDedicatedCompanyIdFromUrl();
  const isExplicitClient = typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_is_client_mode') === 'true';
  if (dedicatedId && isExplicitClient) {
    const matched = list.filter(c => c.id === dedicatedId);
    if (matched.length > 0) return matched;
    return [{
      id: dedicatedId,
      company_name: 'Client Workspace',
      currency_symbol: 'Nu.'
    }];
  }

  if (!list || list.length === 0) return [DEFAULT_TENANT_COMPANY];

  const hideDemo = typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_hide_demo_company') === 'true';
  const isClient = typeof localStorage !== 'undefined' && localStorage.getItem('deep_pos_is_client_mode') === 'true';
  if ((hideDemo || isClient) && list.length > 1) {
    const withoutDemo = list.filter(c => c.id !== DEFAULT_TENANT_COMPANY.id);
    if (withoutDemo.length > 0) return withoutDemo;
  }

  return list;
}

// Load companies from Supabase, Firestore & local offline cache
export async function fetchUserCompanies(includeAll: boolean = false): Promise<{ companies: SupabaseCompany[]; error?: string }> {
  try {
    const mergedMap = new Map<string, SupabaseCompany>();

    // Check user authorization
    const role = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_role') : null;
    const assignedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_assigned_company') : null;
    const isSuperadmin = role === 'superadmin';

    // 1. Fetch from Supabase
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('companies').select('*');
        if (!isSuperadmin && assignedCompanyId) {
          query = query.eq('id', assignedCompanyId);
        }
        const { data: sbCompanies, error: sbErr } = await query;
        if (sbCompanies && sbCompanies.length > 0 && !sbErr) {
          sbCompanies.forEach(c => {
            if (c && c.id) mergedMap.set(c.id, c);
          });
        }
      } catch (e) {
        console.warn('Supabase companies fetch warning:', e);
      }
    }

    // If client user, strictly return only assigned company
    if (!isSuperadmin && assignedCompanyId) {
      const clientComp = mergedMap.get(assignedCompanyId);
      if (clientComp) {
        return { companies: [clientComp] };
      }
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
      if (cached) {
        try {
          const list: SupabaseCompany[] = JSON.parse(cached);
          const found = list.find(c => c.id === assignedCompanyId);
          if (found) return { companies: [found] };
        } catch {}
      }
      return { 
        companies: [{
          id: assignedCompanyId,
          company_name: 'Client Workspace',
          currency_symbol: 'Nu.'
        }]
      };
    }

    // Load locally cached companies
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
    if (cached) {
      try {
        const localList: SupabaseCompany[] = JSON.parse(cached);
        localList.forEach(c => {
          if (c && c.id) mergedMap.set(c.id, c);
        });
      } catch {}
    }

    // For superadmin, ensure Demo Company is present
    if (!mergedMap.has(DEFAULT_TENANT_COMPANY.id)) {
      mergedMap.set(DEFAULT_TENANT_COMPANY.id, DEFAULT_TENANT_COMPANY);
    }

    // Also fetch from Cloud Firestore
    try {
      const companiesCollRef = collection(db, 'companies');
      const snap = await getDocs(companiesCollRef);
      snap.forEach(d => {
        const data = d.data() as SupabaseCompany;
        if (data && data.id) {
          mergedMap.set(data.id, data);
        }
      });
    } catch (fsErr) {
      console.warn('Firestore fetch companies warning:', fsErr);
    }

    const allList = Array.from(mergedMap.values());
    if (typeof localStorage !== 'undefined' && allList.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(allList));
    }

    if (includeAll || isSuperadmin) {
      return { companies: allList };
    }
    return { companies: filterCompaniesForView(allList) };
  } catch (err: any) {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
    const list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
    return { companies: includeAll ? list : filterCompaniesForView(list), error: err?.message };
  }
}

// Create new company in Firestore and local storage
export async function createCompany(companyData: Omit<SupabaseCompany, 'id' | 'created_at'>): Promise<{ company?: SupabaseCompany; error?: string }> {
  try {
    const newId = generateUUID();
    const adminUsername = (companyData.admin_username || 'admin').trim().toLowerCase();
    const adminFullName = (companyData.admin_name || `${companyData.company_name} Administrator`).trim();
    const adminPin = (companyData.admin_pin || '1234').trim();

    const newComp: SupabaseCompany = {
      id: newId,
      ...companyData,
      admin_username: adminUsername,
      admin_name: adminFullName,
      admin_pin: adminPin,
      created_at: new Date().toISOString()
    };

    // 1. Save to Cloud Firestore
    try {
      const compRef = doc(db, 'companies', newId);
      await setDoc(compRef, newComp);
    } catch (fsErr) {
      console.warn('Could not write company to Firestore, saving offline:', fsErr);
    }

    // 2. Save in local cache
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
    const list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];
    list.push(newComp);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(list));
    }

    // 3. Initialize dedicated admin user for this company
    const adminUser = {
      id: `admin_${newId}`,
      username: adminUsername,
      fullName: adminFullName,
      role: 'Administrator',
      pinCode: adminPin,
      permissions: [
        'pos_billing',
        'sales_entry',
        'purchase_entry',
        'vouchers',
        'inventory_read',
        'inventory_write',
        'reports',
        'settings',
        'user_management'
      ]
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`deep_pos_users_${newId}`, JSON.stringify([adminUser]));
      localStorage.setItem('deep_pos_active_user_id', adminUser.id);
      sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
    }

    try {
      const userRef = doc(db, 'tenants', newId, 'users', adminUser.id);
      await setDoc(userRef, adminUser);
    } catch (uErr) {
      console.warn('Could not write admin user to Firestore:', uErr);
    }

    // 4. Automatically create initial Financial Year for this new company (Jan 1 - Dec 31)
    const currentYear = new Date().getFullYear();
    await createFinancialYear({
      company_id: newComp.id,
      fy_name: `FY ${currentYear}`,
      start_date: `${currentYear}-01-01`,
      end_date: `${currentYear}-12-31`,
      is_active: true,
      is_locked: false
    });

    // 5. Initialize clean blank slate for new tenant (0 vouchers, 0 sales, reset counters)
    initializeBlankTenantStorage(newComp.id);

    return { company: newComp };
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
    // 1. Try fetching from Supabase directly
    if (isSupabaseConfigured) {
      try {
        const { data: sbFYs, error: sbErr } = await supabase
          .from('financial_years')
          .select('*')
          .eq('company_id', companyId);
        if (sbFYs && sbFYs.length > 0 && !sbErr) {
          return { financialYears: sbFYs };
        }
      } catch (sbErr) {
        console.warn('Supabase fetch financial years warning:', sbErr);
      }
    }

    // 2. Try fetching from Cloud Firestore
    try {
      const fyCollRef = collection(db, 'financial_years');
      const q = query(fyCollRef, where('company_id', '==', companyId));
      const snap = await getDocs(q);
      const fsFYs: SupabaseFinancialYear[] = [];
      snap.forEach(d => {
        const data = d.data() as SupabaseFinancialYear;
        if (data && data.id) fsFYs.push(data);
      });
      if (fsFYs.length > 0) {
        return { financialYears: fsFYs };
      }
    } catch (fsErr) {
      console.warn('Firestore fetch financial years error:', fsErr);
    }

    // 3. Fallback to local storage
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_FYS) : null;
    let list: SupabaseFinancialYear[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_FY];
    
    // Auto-migrate any legacy 2025-2026 April-March entries to standard Bhutan Jan-Dec calendar
    let modified = false;
    list = list.map(fy => {
      if (fy.id === 'fy_2025_2026' || fy.fy_name === 'FY 2025-2026' || fy.start_date.endsWith('-04-01')) {
        modified = true;
        return {
          ...fy,
          id: DEFAULT_TENANT_FY.id,
          fy_name: 'FY 2026',
          start_date: '2026-01-01',
          end_date: '2026-12-31'
        };
      }
      return fy;
    });
    if (modified && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LOCAL_FYS, JSON.stringify(list));
    }

    const filtered = list.filter(f => f.company_id === companyId);
    if (filtered.length > 0) {
      return { financialYears: filtered };
    }

    // Default financial year for this company
    const curYear = new Date().getFullYear();
    const fallbackFY: SupabaseFinancialYear = {
      id: generateUUID(),
      company_id: companyId,
      fy_name: `FY ${curYear}`,
      start_date: `${curYear}-01-01`,
      end_date: `${curYear}-12-31`,
      is_active: true,
      is_locked: false
    };
    return { financialYears: [fallbackFY] };
  } catch (err: any) {
    return { financialYears: [DEFAULT_TENANT_FY], error: err?.message || 'Error fetching financial years' };
  }
}

// Create new financial year for active company
export async function createFinancialYear(fyData: Omit<SupabaseFinancialYear, 'id' | 'created_at'>): Promise<{ financialYear?: SupabaseFinancialYear; error?: string }> {
  try {
    const newId = generateUUID();
    const newFY: SupabaseFinancialYear = {
      id: newId,
      ...fyData
    };

    // Save to Firestore
    try {
      const fyDocRef = doc(db, 'financial_years', newId);
      await setDoc(fyDocRef, newFY);
    } catch (fsErr) {
      console.warn('Could not write financial year to Firestore, saving offline:', fsErr);
    }

    // Save to local cache
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_FYS) : null;
    const list: SupabaseFinancialYear[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_FY];
    list.push(newFY);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LOCAL_FYS, JSON.stringify(list));
    }
    return { financialYear: newFY };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create financial year' };
  }
}

/**
 * Permanently delete a company and purge its tenant data
 */
export async function deleteCompany(companyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
    let list: SupabaseCompany[] = cached ? JSON.parse(cached) : [DEFAULT_TENANT_COMPANY];

    if (list.length <= 1) {
      return { success: false, error: 'Cannot delete the only registered company. Create another company first.' };
    }

    list = list.filter(c => c.id !== companyId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(list));
    }

    // 1. Delete from Firestore
    try {
      await deleteDoc(doc(db, 'companies', companyId));
    } catch (fsErr) {
      console.warn('Firestore delete company error:', fsErr);
    }

    // Clear all tenant-scoped data keys for this company from localStorage
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith(`_${companyId}`)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    // Also remove financial years for this company
    const cachedFYs = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_FYS) : null;
    if (cachedFYs && typeof localStorage !== 'undefined') {
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: list[0].id } }));
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete company' };
  }
}

// Get and Set Active Company and FY IDs
export function getActiveCompanyId(): string {
  // 1. If user is authenticated as non-superadmin, STRICTLY enforce their assigned company
  if (typeof localStorage !== 'undefined') {
    const role = localStorage.getItem('deep_pos_auth_role');
    const assigned = localStorage.getItem('deep_pos_auth_assigned_company');
    if (role && role !== 'superadmin' && assigned) {
      return assigned;
    }
  }

  // 2. If dedicated URL parameter is provided (e.g. ?company=...)
  const urlId = getDedicatedCompanyIdFromUrl();
  if (urlId) {
    return urlId;
  }

  // 3. Superadmin or default workspace
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TENANT_COMPANY_ID) : null;
  return stored || DEFAULT_TENANT_COMPANY.id;
}

export function setActiveCompanyId(id: string): void {
  if (typeof localStorage !== 'undefined') {
    const role = localStorage.getItem('deep_pos_auth_role');
    const assigned = localStorage.getItem('deep_pos_auth_assigned_company');
    // Security check: non-superadmin cannot switch company
    if (role && role !== 'superadmin' && assigned && id !== assigned) {
      console.error('Unauthorized attempt by non-superadmin to switch active company to:', id);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.TENANT_COMPANY_ID, id);
  }

  // Update browser URL seamlessly so refresh or copying URL retains the chosen company
  if (typeof window !== 'undefined' && window.history && window.location) {
    try {
      const url = new URL(window.location.href);
      if (id === DEFAULT_TENANT_COMPANY.id) {
        url.searchParams.delete('company');
        url.searchParams.delete('cid');
        url.searchParams.delete('tenant');
        if (url.hash && url.hash.includes('company=')) {
          const parts = url.hash.split('?');
          url.hash = parts[0] || '';
        }
      } else {
        url.searchParams.set('company', id);
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('Could not update URL parameter on company switch:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: id } }));
  }
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

/**
 * Superadmin action: updates the active subscription status (is_active) of a company.
 * When is_active is false, users belonging to this tenant will be locked out of the ERP.
 */
export async function updateCompanyStatus(
  companyId: string, 
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update in Supabase
    if (isSupabaseConfigured) {
      try {
        const { error: sbErr } = await supabase
          .from('companies')
          .update({ is_active: isActive })
          .eq('id', companyId);
        if (sbErr) {
          console.warn('Supabase update company status warning:', sbErr.message);
        }
      } catch (sbE: any) {
        console.warn('Supabase exception on updateCompanyStatus:', sbE);
      }
    }

    // 2. Update in Firestore
    try {
      const compRef = doc(db, 'companies', companyId);
      await setDoc(compRef, { is_active: isActive }, { merge: true });
    } catch (fsErr) {
      console.warn('Firestore update company status warning:', fsErr);
    }

    // 3. Update in Local Storage Cache
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      if (cached) {
        try {
          const list: SupabaseCompany[] = JSON.parse(cached);
          const updated = list.map(c => c.id === companyId ? { ...c, is_active: isActive } : c);
          localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(updated));
        } catch {}
      }
    }

    // Notify listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase:tenant_status_changed', { detail: { companyId, isActive } }));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update company status' };
  }
}

