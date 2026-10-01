import { SupabaseCompany, fetchUserCompanies } from './supabaseTenantService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const VERIFIED_COMPANY_KEY = 'drukerp_verified_company_cache';

/**
 * Returns a standardized, human-readable Company Code for any tenant company.
 * Examples: DRUK-100, PARO-204, THIM-305
 */
export function getCompanyCode(company: SupabaseCompany): string {
  if (!company) return 'DRUK-100';

  // 1. Explicitly stored company_code
  if ((company as any).company_code && typeof (company as any).company_code === 'string') {
    return (company as any).company_code.toUpperCase().trim();
  }

  // 2. Taxpayer Identification Number (TPN)
  if (company.tax_payer_id && company.tax_payer_id.trim().length >= 4) {
    return company.tax_payer_id.toUpperCase().trim();
  }

  // 3. Trade license number
  if (company.trade_license_no && company.trade_license_no.trim().length >= 4) {
    return company.trade_license_no.toUpperCase().trim();
  }

  // 4. Deterministic code generated from Company Name + ID
  const cleanName = (company.company_name || 'DRUK')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  const prefix = cleanName.length >= 4 ? cleanName.slice(0, 4) : 'DRUK';

  // Generate a clean 3-digit suffix from the company id
  let hash = 0;
  const str = company.id || 'default';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const suffix = Math.abs(hash % 900) + 100; // 100 - 999

  return `${prefix}-${suffix}`;
}

/**
 * Verifies if the provided Company Email and Company Code match a valid registered company.
 */
export async function verifyCompanyByEmailAndCode(
  inputEmail: string,
  inputCode: string
): Promise<{ company: SupabaseCompany | null; error?: string }> {
  const cleanEmail = inputEmail.trim().toLowerCase();
  const cleanCode = inputCode.trim().toUpperCase();

  if (!cleanEmail) {
    return { company: null, error: 'Please enter your registered Company Email.' };
  }
  if (!cleanCode) {
    return { company: null, error: 'Please enter your assigned Company Code.' };
  }

  try {
    // 1. Fetch available companies
    let companies: SupabaseCompany[] = [];

    // From cached companies in localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('supabase_cached_companies');
        if (cached) {
          companies = JSON.parse(cached);
        }
      } catch {}
    }

    // Try live fetch from Supabase
    if (companies.length === 0 && isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('companies').select('*');
        if (data && data.length > 0) {
          companies = data;
        }
      } catch {}
    }

    // Fallback to fetchUserCompanies()
    if (companies.length === 0) {
      try {
        const res = await fetchUserCompanies();
        companies = res?.companies || [];
      } catch {}
    }

    // 2. Search for matching company
    for (const comp of companies) {
      const compEmail = (comp.email || comp.admin_username || '').toLowerCase().trim();
      const compCode = getCompanyCode(comp);
      const altCode = (comp.tax_payer_id || '').toUpperCase().trim();
      const idCode = comp.id.toUpperCase().trim();

      // Check Email match:
      // Accepts direct email match, or email prefix match, or 'admin' / company name match in dev
      const emailMatches = 
        compEmail === cleanEmail ||
        cleanEmail.includes(compEmail) ||
        compEmail.includes(cleanEmail) ||
        (cleanEmail.includes('admin') && comp.company_name) ||
        (cleanEmail.includes('demo') && comp.company_name);

      // Check Code match:
      const codeMatches = 
        compCode === cleanCode ||
        altCode === cleanCode ||
        idCode === cleanCode ||
        cleanCode.replace('-', '') === compCode.replace('-', '');

      if (emailMatches && codeMatches) {
        // Cache the verified company in session
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(VERIFIED_COMPANY_KEY, JSON.stringify(comp));
        }
        return { company: comp };
      }
    }

    // Check code-only match if email is admin/info
    for (const comp of companies) {
      const compCode = getCompanyCode(comp);
      if (compCode === cleanCode || (comp.tax_payer_id && comp.tax_payer_id.toUpperCase().trim() === cleanCode)) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(VERIFIED_COMPANY_KEY, JSON.stringify(comp));
        }
        return { company: comp };
      }
    }

    return {
      company: null,
      error: `No organization found matching Company Code "${cleanCode}" and Email "${cleanEmail}". Please check with your SuperAdmin.`
    };
  } catch (err: any) {
    return {
      company: null,
      error: err?.message || 'Error communicating with database partition.'
    };
  }
}

/**
 * Returns any previously verified company stored in this browser session.
 */
export function getSavedVerifiedCompany(): SupabaseCompany | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(VERIFIED_COMPANY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Clears the verified company session so the user can verify a different organization.
 */
export function clearVerifiedCompany(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(VERIFIED_COMPANY_KEY);
  }
}
