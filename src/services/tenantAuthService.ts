import { supabase } from '../lib/supabase';

let cachedTenantCompanyId: string | null = null;
let cachedUserRole: string | null = null;

export interface TenantContext {
  companyId: string;
  role: string;
  userId: string;
  email?: string;
}

/**
 * Validates and locks the tenant session upon login.
 * Resolves the true company_id from `company_users` to prevent localStorage tampering.
 */
export async function initTenantSession(): Promise<TenantContext> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    clearTenantSession();
    throw new Error('User is not authenticated in Supabase. Please sign in under User Roles / Cloud Account.');
  }

  // Fetch the company mapping assigned to this auth.uid()
  const { data: profile, error: profileError } = await supabase
    .from('company_users')
    .select('company_id, role, is_active, email')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load company profile: ${profileError.message}`);
  }

  let finalCompanyId = profile?.company_id;
  let finalRole = profile?.role || 'cashier';

  // If superadmin has no single fixed company assigned, fallback to their chosen active company
  if (!finalCompanyId) {
    const { data: isSuper } = await supabase.rpc('is_superadmin');
    if (isSuper) {
      finalRole = 'superadmin';
      finalCompanyId = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id') || '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
    } else {
      throw new Error('No active company membership found for this account in company_users.');
    }
  }

  cachedTenantCompanyId = finalCompanyId;
  cachedUserRole = finalRole;

  // Persist for offline-first resilience
  localStorage.setItem('supabase_active_company_id', finalCompanyId);
  localStorage.setItem('supabase_active_role', finalRole);

  return {
    companyId: finalCompanyId,
    role: finalRole,
    userId: user.id,
    email: user.email,
  };
}

/**
 * Returns the currently active and verified company_id.
 */
export function getActiveTenantId(): string {
  if (cachedTenantCompanyId) return cachedTenantCompanyId;
  const stored = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id');
  if (stored) {
    cachedTenantCompanyId = stored;
    return stored;
  }
  throw new Error('Tenant context missing. Please initialize session.');
}

/**
 * Clears the in-memory cached tenant state upon logout.
 */
export function clearTenantSession(): void {
  cachedTenantCompanyId = null;
  cachedUserRole = null;
  localStorage.removeItem('supabase_active_company_id');
  localStorage.removeItem('supabase_active_role');
}

/**
 * Universal upsert function that pushes any collection to Supabase in chunks of 200,
 * automatically injecting the verified `company_id`.
 */
export async function pushCollectionToSupabase<T extends Record<string, any>>(
  tableName: string,
  records: T[],
  getIdFn: (item: T) => string
): Promise<{ count: number }> {
  if (!records || records.length === 0) return { count: 0 };

  const companyId = getActiveTenantId();
  const rows = records.map((record) => {
    const recordId = getIdFn(record);
    return {
      company_id: companyId,
      record_id: String(recordId),
      data: record,
      updated_at: new Date().toISOString()
    };
  });

  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'company_id, record_id' });

    if (error) {
      console.error(`[MultiTenant Sync Error] Table ${tableName} chunk ${i}:`, error.message);
      throw new Error(`Failed syncing ${tableName}: ${error.message}`);
    }
  }

  return { count: rows.length };
}

/**
 * Universal query function that fetches documents for the current tenant.
 */
export async function pullCollectionFromSupabase<T>(
  tableName: string
): Promise<T[]> {
  const companyId = getActiveTenantId();

  const { data, error } = await supabase
    .from(tableName)
    .select('record_id, data, updated_at')
    .eq('company_id', companyId);

  if (error) {
    console.error(`[MultiTenant Pull Error] Table ${tableName}:`, error.message);
    throw new Error(`Failed loading ${tableName}: ${error.message}`);
  }

  return (data || []).map((row) => row.data as T);
}
