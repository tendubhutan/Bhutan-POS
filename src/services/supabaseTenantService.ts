import { supabase, isSupabaseConfigured, SupabaseCompany, SupabaseFinancialYear, SupabaseAppUser } from '../lib/supabase';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { Config, AppUser } from '../types';
import { saveCompanyFeatures } from './tenantFeatureService';
import { DEFAULT_LEDGERS, healAndSanitizeNonDemoTenant } from './storageService';
import { purgeRemoteCompanyData } from './supabaseSyncService';

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

export const PRODUCTION_BASE_URL = 'https://bhutan-pos.tendubhutan.workers.dev';

/**
 * Generates the full dedicated client portal URL for a specific company.
 * Automatically uses the active browser origin (e.g. Cloudflare domain) or defaults to production URL.
 */
export function getCompanyDedicatedUrl(companyId: string, forceCurrentOrigin: boolean = false): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    return `${window.location.origin}${cleanPath}/?company=${companyId}`;
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

  // If a dedicated client link parameter is present in the URL (e.g. ?company=...)
  const dedicatedId = getDedicatedCompanyIdFromUrl();
  if (dedicatedId) {
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
  if ((hideDemo || isClient) && list.length > 1 && !list.every(c => c.id === DEFAULT_TENANT_COMPANY.id)) {
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

    // 1. Fetch from Supabase companies table and attach credentials from tenant_settings
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('companies').select('*');
        if (!includeAll && !isSuperadmin && assignedCompanyId) {
          query = query.eq('id', assignedCompanyId);
        }
        const { data: sbCompanies, error: sbErr } = await query;
        if (sbCompanies && sbCompanies.length > 0 && !sbErr) {
          sbCompanies.forEach(c => {
            if (c && c.id) mergedMap.set(c.id, { ...c });
          });
        }

        // Fetch admin_credentials and main_config from tenant_settings so every company has its settings and support access status across all PCs!
        let settingsQuery = supabase.from('tenant_settings').select('company_id, record_id, data').in('record_id', ['admin_credentials', 'main_config']);
        if (!includeAll && !isSuperadmin && assignedCompanyId) {
          settingsQuery = settingsQuery.eq('company_id', assignedCompanyId);
        }
        const { data: settingsList } = await settingsQuery;
        if (settingsList && settingsList.length > 0) {
          settingsList.forEach(row => {
            if (row.company_id && row.data) {
              const existing: SupabaseCompany = mergedMap.get(row.company_id) || {
                id: row.company_id,
                company_name: row.data.company_name || 'Client Company',
                currency_symbol: 'Nu.'
              };

              if (row.record_id === 'admin_credentials') {
                mergedMap.set(row.company_id, {
                  ...existing,
                  company_name: existing.company_name || row.data.company_name || 'Client Company',
                  email: existing.email || row.data.email || '',
                  phone: existing.phone || row.data.phone || '',
                  trade_license_no: existing.trade_license_no || row.data.trade_license_no || '',
                  tax_payer_id: existing.tax_payer_id || row.data.tax_payer_id || '',
                  address: existing.address || row.data.address || '',
                  admin_username: row.data.admin_username || existing.admin_username || 'admin',
                  admin_name: row.data.admin_name || existing.admin_name,
                  admin_pin: row.data.admin_pin || existing.admin_pin || '1234',
                  admin_password: row.data.admin_password || existing.admin_password || 'ClientPass@123',
                  is_active: row.data.is_active !== undefined ? row.data.is_active : (existing.is_active ?? true)
                });
              } else if (row.record_id === 'main_config') {
                const supportAccess = row.data.AllowSupportAccess === 'true' || row.data.AllowSupportAccess === true || row.data.allow_support_access === true;
                mergedMap.set(row.company_id, {
                  ...existing,
                  allow_support_access: supportAccess || existing.allow_support_access || false
                });
              }
            }
          });
        }
      } catch (e) {
        console.warn('Supabase companies fetch warning:', e);
      }
    }

    // 1.5 Fetch companies from Firestore cloud database (guarantees cross-PC discovery)
    try {
      const fsSnap = await getDocs(collection(db, 'companies'));
      fsSnap.forEach(docSnap => {
        const c = docSnap.data() as SupabaseCompany;
        if (c && c.id) {
          const existing = mergedMap.get(c.id);
          if (existing) {
            mergedMap.set(c.id, { ...c, ...existing });
          } else {
            mergedMap.set(c.id, c);
          }
        }
      });
    } catch (fsErr) {
      console.warn('Firestore companies fetch notice:', fsErr);
    }

    // 2. Dedicated URL company lookup check (e.g. ?company=uuid)
    const dedicatedId = getDedicatedCompanyIdFromUrl();
    if (dedicatedId && isSupabaseConfigured) {
      const existingComp = mergedMap.get(dedicatedId);
      if (!existingComp || !existingComp.admin_password) {
        try {
          const { data: dedicatedComp } = await supabase.from('companies').select('*').eq('id', dedicatedId).maybeSingle();
          const { data: dedicatedCreds } = await supabase.from('tenant_settings').select('data').eq('company_id', dedicatedId).eq('record_id', 'admin_credentials').maybeSingle();
          if (dedicatedComp) {
            const creds = dedicatedCreds?.data || {};
            mergedMap.set(dedicatedId, {
              ...(existingComp || {}),
              ...dedicatedComp,
              email: dedicatedComp.email || creds.email || existingComp?.email || '',
              phone: dedicatedComp.phone || creds.phone || existingComp?.phone || '',
              address: dedicatedComp.address || creds.address || existingComp?.address || '',
              trade_license_no: dedicatedComp.trade_license_no || creds.trade_license_no || existingComp?.trade_license_no || '',
              tax_payer_id: dedicatedComp.tax_payer_id || creds.tax_payer_id || existingComp?.tax_payer_id || '',
              admin_username: creds.admin_username || existingComp?.admin_username,
              admin_name: creds.admin_name || existingComp?.admin_name,
              admin_pin: creds.admin_pin || existingComp?.admin_pin,
              admin_password: creds.admin_password || existingComp?.admin_password,
              is_active: creds.is_active !== undefined ? creds.is_active : (existingComp?.is_active ?? true)
            });
          }
        } catch (e) {
          console.warn('Dedicated company Supabase lookup warning:', e);
        }
      }
    }

    // If client user and not requesting all companies, strictly return only assigned company
    if (!includeAll && !isSuperadmin && assignedCompanyId) {
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

    // 3. Load locally cached companies
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
    if (cached) {
      try {
        const localList: SupabaseCompany[] = JSON.parse(cached);
        for (const c of localList) {
          if (c && c.id) {
            const existing = mergedMap.get(c.id);
            if (existing) {
              // Supabase cloud data is authoritative! Do NOT let empty or stale local fields overwrite real Supabase data.
              mergedMap.set(c.id, {
                ...c,
                ...existing,
                // Supabase fields take precedence, but if Supabase is empty while local has value, retain local non-empty value
                email: (existing.email && existing.email.trim()) ? existing.email.trim() : (c.email && c.email.trim() ? c.email.trim() : ''),
                phone: (existing.phone && existing.phone.trim()) ? existing.phone.trim() : (c.phone && c.phone.trim() ? c.phone.trim() : ''),
                address: (existing.address && existing.address.trim()) ? existing.address.trim() : (c.address && c.address.trim() ? c.address.trim() : ''),
                trade_license_no: (existing.trade_license_no && existing.trade_license_no.trim()) ? existing.trade_license_no.trim() : (c.trade_license_no && c.trade_license_no.trim() ? c.trade_license_no.trim() : ''),
                tax_payer_id: (existing.tax_payer_id && existing.tax_payer_id.trim()) ? existing.tax_payer_id.trim() : (c.tax_payer_id && c.tax_payer_id.trim() ? c.tax_payer_id.trim() : ''),
                currency_symbol: existing.currency_symbol || c.currency_symbol || 'Nu.',
                company_name: (existing.company_name && existing.company_name.trim()) ? existing.company_name.trim() : (c.company_name || 'Company')
              });
            } else {
              mergedMap.set(c.id, c);
            }
          }
        }
      } catch {}
    }

    // For superadmin, ensure Demo Company is present
    if (!mergedMap.has(DEFAULT_TENANT_COMPANY.id)) {
      mergedMap.set(DEFAULT_TENANT_COMPANY.id, DEFAULT_TENANT_COMPANY);
    }

    // Ensure Demo Company is first in the list so standard fallbacks resolve to Bhutan Retail Enterprise
    const demoCompany = mergedMap.get(DEFAULT_TENANT_COMPANY.id) || DEFAULT_TENANT_COMPANY;
    const others = Array.from(mergedMap.values()).filter(c => c.id !== DEFAULT_TENANT_COMPANY.id);
    const rawList = [demoCompany, ...others];

    // Deduplicate companies by normalized company name to prevent duplicate entries
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    const allList: SupabaseCompany[] = [];

    for (const comp of rawList) {
      if (!comp || !comp.id) continue;
      const normalizedName = (comp.company_name || '').trim().toLowerCase();
      
      // If we haven't seen this ID and haven't seen this company name yet, keep it
      if (!seenIds.has(comp.id) && (!normalizedName || !seenNames.has(normalizedName))) {
        seenIds.add(comp.id);
        if (normalizedName) {
          seenNames.add(normalizedName);
        }
        allList.push(comp);
      }
    }

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

// Helper to ensure a company record exists in the public.companies table in Supabase
export async function ensureCompanyExists(companyId: string): Promise<void> {
  if (!isSupabaseConfigured || !companyId) return;
  try {
    const { data } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle();
    if (!data) {
      // Find company details from local cache or fallback to default
      let compInfo: SupabaseCompany = DEFAULT_TENANT_COMPANY;
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES) : null;
      if (cached) {
        try {
          const list: SupabaseCompany[] = JSON.parse(cached);
          const found = list.find(c => c.id === companyId);
          if (found) compInfo = found;
        } catch {}
      }
      await supabase.from('companies').upsert({
        id: companyId,
        company_name: compInfo.company_name || 'Business Workspace',
        trade_license_no: compInfo.trade_license_no || '',
        tax_payer_id: compInfo.tax_payer_id || '',
        phone: compInfo.phone || '',
        email: compInfo.email || '',
        address: compInfo.address || '',
        currency_symbol: compInfo.currency_symbol || 'Nu.',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('[Supabase ensureCompanyExists warning]:', err);
  }
}

// Create new company in Supabase, Firestore, and local storage
export async function createCompany(
  companyData: Omit<SupabaseCompany, 'id' | 'created_at'> & {
    initialFeatures?: Record<string, boolean>;
    initialConfig?: Partial<Config>;
  }
): Promise<{ company?: SupabaseCompany; error?: string }> {
  try {
    const newId = generateUUID();
    const adminUsername = (companyData.admin_username || 'admin').trim().toLowerCase();
    const adminFullName = (companyData.admin_name || `${companyData.company_name} Administrator`).trim();
    const adminPin = (companyData.admin_pin || '1234').trim();
    const adminPassword = (companyData.admin_password || companyData.admin_pin || 'ClientPass@123').trim();

    const newComp: SupabaseCompany = {
      id: newId,
      ...companyData,
      admin_username: adminUsername,
      admin_name: adminFullName,
      admin_pin: adminPin,
      admin_password: adminPassword,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // 1. Insert into Supabase companies table (sanitized columns to match PostgreSQL schema)
    if (isSupabaseConfigured) {
      try {
        await supabase.from('companies').upsert({
          id: newId,
          company_name: newComp.company_name,
          trade_license_no: newComp.trade_license_no || '',
          tax_payer_id: newComp.tax_payer_id || '',
          phone: newComp.phone || '',
          email: newComp.email || '',
          address: newComp.address || '',
          currency_symbol: newComp.currency_symbol || 'Nu.',
          created_at: newComp.created_at
        }, { onConflict: 'id' });
      } catch (sbCompErr) {
        console.warn('Supabase company table insert warning:', sbCompErr);
      }

      // Also persist admin credentials in Supabase tenant_settings table
      try {
        await supabase.from('tenant_settings').upsert({
          company_id: newId,
          record_id: 'admin_credentials',
          data: {
            admin_username: adminUsername,
            admin_name: adminFullName,
            admin_pin: adminPin,
            admin_password: adminPassword,
            company_name: newComp.company_name,
            email: newComp.email || ''
          }
        }, { onConflict: 'company_id,record_id' });
      } catch (tsErr) {
        console.warn('Supabase tenant_settings insert notice:', tsErr);
      }
    }

    // Attempt to register in Supabase Auth if configured
    if (isSupabaseConfigured && companyData.email && adminPassword) {
      try {
        await supabase.auth.signUp({
          email: companyData.email.trim().toLowerCase(),
          password: adminPassword,
          options: {
            data: {
              company_id: newId,
              role: 'admin',
              full_name: adminFullName
            }
          }
        });
      } catch (sbSignUpErr) {
        console.warn('Supabase auth signUp background notice:', sbSignUpErr);
      }
    }

    // 1.8 Persist to Firestore cloud database (guarantees other PCs discover it immediately)
    try {
      await setDoc(doc(db, 'companies', newId), {
        ...newComp,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'tenant_settings', `${newId}_admin_credentials`), {
        company_id: newId,
        record_id: 'admin_credentials',
        data: {
          admin_username: adminUsername,
          admin_name: adminFullName,
          admin_pin: adminPin,
          admin_password: adminPassword,
          company_name: newComp.company_name,
          email: newComp.email || ''
        },
        updatedAt: new Date().toISOString()
      });
    } catch (fsErr) {
      console.warn('Firestore company save notice:', fsErr);
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

    // 6. Apply Superadmin-configured features for this tenant
    if (companyData.initialFeatures) {
      saveCompanyFeatures(newComp.id, companyData.initialFeatures);
    }

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
  try {
    const clean = DEFAULT_LEDGERS.map(l => ({
      ...l,
      'Opening Balance': 0,
      'Current Balance': 0
    }));
    localStorage.setItem(`deep_pos_ledgers_${cId}`, JSON.stringify(clean));
  } catch {}
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
  purgeRemoteCompanyData(cId).catch(() => {});
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

    // 2. Fallback to local storage
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

    // Delete from Supabase companies and tenant_settings tables
    if (isSupabaseConfigured) {
      try {
        await supabase.from('companies').delete().eq('id', companyId);
        await supabase.from('tenant_settings').delete().eq('company_id', companyId);
      } catch (sbDelErr) {
        console.warn('Supabase company deletion warning:', sbDelErr);
      }
    }

    list = list.filter(c => c.id !== companyId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(list));
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

  // 2. If dedicated URL parameter is provided (e.g. ?company=... or ?cid=... or ?tenant=...)
  const urlId = getDedicatedCompanyIdFromUrl();
  if (urlId) {
    return urlId;
  }

  // 3. Clean Root URL / Session check:
  if (typeof sessionStorage !== 'undefined') {
    const sessionCompany = sessionStorage.getItem('supabase_active_session_company');
    if (sessionCompany) {
      return sessionCompany;
    }
  }

  // 4. Persistent company selection in localStorage:
  if (typeof localStorage !== 'undefined') {
    const localCompany = localStorage.getItem(STORAGE_KEYS.TENANT_COMPANY_ID) || localStorage.getItem('supabase_active_company_id');
    if (localCompany) {
      return localCompany;
    }
  }

  return DEFAULT_TENANT_COMPANY.id;
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
    if (typeof sessionStorage !== 'undefined') {
      if (id === DEFAULT_TENANT_COMPANY.id) {
        sessionStorage.removeItem('supabase_active_session_company');
      } else {
        sessionStorage.setItem('supabase_active_session_company', id);
      }
    }
  }

  // URL handling:
  // If the current URL has a dedicated query parameter (e.g., ?company=...), keep it in sync.
  // If switching back to default company, strip the query parameter so URL becomes clean
  // CRITICAL: NEVER inject ?company=... onto a clean root URL!
  if (typeof window !== 'undefined' && window.history && window.location) {
    try {
      const url = new URL(window.location.href);
      const hasDedicatedParam = url.searchParams.has('company') || url.searchParams.has('cid') || url.searchParams.has('tenant');

      if (id === DEFAULT_TENANT_COMPANY.id) {
        if (hasDedicatedParam) {
          url.searchParams.delete('company');
          url.searchParams.delete('cid');
          url.searchParams.delete('tenant');
          if (url.hash && url.hash.includes('company=')) {
            const parts = url.hash.split('?');
            url.hash = parts[0] || '';
          }
          window.history.replaceState({}, '', url.toString());
        }
      } else if (hasDedicatedParam) {
        url.searchParams.set('company', id);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      console.warn('Could not update URL parameter on company switch:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: id } }));
  }
  healAndSanitizeNonDemoTenant(id);
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

    // 2. Update in Local Storage Cache
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

/**
 * Updates full company profile and client admin credentials in Supabase, Firestore, and local cache.
 */
export async function updateCompany(
  companyId: string,
  updates: Partial<Omit<SupabaseCompany, 'id' | 'created_at'>>
): Promise<{ company?: SupabaseCompany; error?: string }> {
  try {
    if (!companyId) {
      return { error: 'Company ID is required for update.' };
    }

    // 1. Clean update payload
    const cleanedUpdates: Partial<SupabaseCompany> = { ...updates };
    if (cleanedUpdates.admin_username !== undefined) {
      cleanedUpdates.admin_username = cleanedUpdates.admin_username.trim().toLowerCase();
    }
    if (cleanedUpdates.admin_pin !== undefined) {
      cleanedUpdates.admin_pin = cleanedUpdates.admin_pin.trim();
    }
    if (cleanedUpdates.admin_password !== undefined) {
      cleanedUpdates.admin_password = cleanedUpdates.admin_password.trim();
    }
    if (cleanedUpdates.email !== undefined) {
      cleanedUpdates.email = cleanedUpdates.email.trim();
    }
    if (cleanedUpdates.company_name !== undefined) {
      cleanedUpdates.company_name = cleanedUpdates.company_name.trim();
    }
    if (cleanedUpdates.phone !== undefined) {
      cleanedUpdates.phone = cleanedUpdates.phone.trim();
    }
    if (cleanedUpdates.address !== undefined) {
      cleanedUpdates.address = cleanedUpdates.address.trim();
    }
    if (cleanedUpdates.trade_license_no !== undefined) {
      cleanedUpdates.trade_license_no = cleanedUpdates.trade_license_no.trim();
    }
    if (cleanedUpdates.tax_payer_id !== undefined) {
      cleanedUpdates.tax_payer_id = cleanedUpdates.tax_payer_id.trim();
    }

    // 2. Update in Supabase
    if (isSupabaseConfigured) {
      try {
        const sbPayload: any = {};
        if (cleanedUpdates.company_name !== undefined) sbPayload.company_name = cleanedUpdates.company_name;
        if (cleanedUpdates.trade_license_no !== undefined) sbPayload.trade_license_no = cleanedUpdates.trade_license_no;
        if (cleanedUpdates.tax_payer_id !== undefined) sbPayload.tax_payer_id = cleanedUpdates.tax_payer_id;
        if (cleanedUpdates.phone !== undefined) sbPayload.phone = cleanedUpdates.phone;
        if (cleanedUpdates.email !== undefined) sbPayload.email = cleanedUpdates.email;
        if (cleanedUpdates.address !== undefined) sbPayload.address = cleanedUpdates.address;
        if (cleanedUpdates.currency_symbol !== undefined) sbPayload.currency_symbol = cleanedUpdates.currency_symbol;
        if (cleanedUpdates.logo_url !== undefined) sbPayload.logo_url = cleanedUpdates.logo_url;

        if (Object.keys(sbPayload).length > 0) {
          const { error: sbErr } = await supabase
            .from('companies')
            .update(sbPayload)
            .eq('id', companyId);
          if (sbErr) {
            console.warn('Supabase update company warning:', sbErr.message);
          }
        }

        // Always sync credentials and profile metadata to tenant_settings for cross-device backup
        const { data: existingCreds } = await supabase
          .from('tenant_settings')
          .select('data')
          .eq('company_id', companyId)
          .eq('record_id', 'admin_credentials')
          .maybeSingle();

        const credsPayload: any = {
          ...(existingCreds?.data || {}),
          updated_at: new Date().toISOString()
        };
        if (cleanedUpdates.admin_username !== undefined) credsPayload.admin_username = cleanedUpdates.admin_username;
        if (cleanedUpdates.admin_password !== undefined) credsPayload.admin_password = cleanedUpdates.admin_password;
        if (cleanedUpdates.admin_pin !== undefined) credsPayload.admin_pin = cleanedUpdates.admin_pin;
        if (cleanedUpdates.admin_name !== undefined) credsPayload.admin_name = cleanedUpdates.admin_name;
        if (cleanedUpdates.company_name !== undefined) credsPayload.company_name = cleanedUpdates.company_name;
        if (cleanedUpdates.email !== undefined) credsPayload.email = cleanedUpdates.email;
        if (cleanedUpdates.phone !== undefined) credsPayload.phone = cleanedUpdates.phone;
        if (cleanedUpdates.trade_license_no !== undefined) credsPayload.trade_license_no = cleanedUpdates.trade_license_no;
        if (cleanedUpdates.tax_payer_id !== undefined) credsPayload.tax_payer_id = cleanedUpdates.tax_payer_id;
        if (cleanedUpdates.address !== undefined) credsPayload.address = cleanedUpdates.address;

        await supabase.from('tenant_settings').upsert({
          company_id: companyId,
          record_id: 'admin_credentials',
          data: credsPayload
        }, { onConflict: 'company_id,record_id' });
      } catch (sbE: any) {
        console.warn('Supabase exception on updateCompany:', sbE);
      }
    }

    // 3. Update in Local Storage Cache
    let updatedCompany: SupabaseCompany | undefined;
    if (typeof localStorage !== 'undefined') {
      let list: SupabaseCompany[] = [];
      const cached = localStorage.getItem(STORAGE_KEYS.LOCAL_COMPANIES);
      if (cached) {
        try {
          list = JSON.parse(cached);
        } catch (cacheErr) {
          list = [];
        }
      }
      let found = false;
      const updated = list.map(c => {
        if (c.id === companyId) {
          found = true;
          updatedCompany = { ...c, ...cleanedUpdates };
          return updatedCompany;
        }
        return c;
      });
      if (!found) {
        updatedCompany = {
          id: companyId,
          company_name: cleanedUpdates.company_name || 'Company Workspace',
          ...cleanedUpdates
        } as SupabaseCompany;
        updated.push(updatedCompany);
      }
      localStorage.setItem(STORAGE_KEYS.LOCAL_COMPANIES, JSON.stringify(updated));
    }

    // 5. Update dedicated client admin user in tenant storage if admin info was modified
    if (cleanedUpdates.admin_username || cleanedUpdates.admin_pin || cleanedUpdates.admin_name) {
      const adminUserId = `admin_${companyId}`;
      const adminUsername = cleanedUpdates.admin_username || 'admin';
      const adminName = cleanedUpdates.admin_name || `${cleanedUpdates.company_name || 'Store'} Administrator`;
      const adminPin = cleanedUpdates.admin_pin || '1234';

      const adminUser = {
        id: adminUserId,
        username: adminUsername,
        fullName: adminName,
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
        localStorage.setItem(`deep_pos_users_${companyId}`, JSON.stringify([adminUser]));
      }
    }

    // 6. Broadcast event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId, updates: cleanedUpdates } }));
      window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId } }));
    }

    return { company: updatedCompany };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update company' };
  }
}

/**
 * Fetch remote main_config (including feature flags & superadminFeatures) from Supabase tenant_settings
 */
export async function fetchTenantRemoteConfig(companyId: string): Promise<Config | null> {
  if (!isSupabaseConfigured || !companyId) return null;
  try {
    const { data: cfgRow, error } = await supabase
      .from('tenant_settings')
      .select('data')
      .eq('company_id', companyId)
      .eq('record_id', 'main_config')
      .maybeSingle();

    if (!error && cfgRow?.data && typeof cfgRow.data === 'object') {
      return cfgRow.data as Config;
    }
  } catch (e) {
    console.warn('fetchTenantRemoteConfig notice:', e);
  }
  return null;
}


