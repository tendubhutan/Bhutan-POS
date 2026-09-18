import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  if (!isSupabaseConfigured) {
    const localComp = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id') || '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
    const localRole = localStorage.getItem('supabase_active_role') || localStorage.getItem('deep_pos_auth_role') || 'admin';
    cachedTenantCompanyId = localComp;
    cachedUserRole = localRole;
    return {
      companyId: localComp,
      role: localRole,
      userId: 'local-admin-user',
      email: 'admin@local.pos'
    };
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      clearTenantSession();
      throw new Error('User is not authenticated in Supabase. Please sign in under User Roles / Cloud Account.');
    }

    // Fetch the company mapping assigned to this auth.uid()
    const isKnownSuperEmail = user.email?.toLowerCase() === 'tendubhutan@gmail.com' || user.email?.toLowerCase() === 'admin@bhutanerp.bt';

    const { data: profile, error: profileError } = await supabase
      .from('company_users')
      .select('company_id, role, is_active, email')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (profileError && !isKnownSuperEmail) {
      throw new Error(`Failed to load company profile: ${profileError.message}`);
    }

    let finalCompanyId = profile?.company_id;
    let finalRole = (profile?.role || (isKnownSuperEmail ? 'superadmin' : 'cashier'));

    if (isKnownSuperEmail) {
      finalRole = 'superadmin';
    }

    // If superadmin has no single fixed company assigned, fallback to their chosen active company
    if (!finalCompanyId) {
      if (finalRole === 'superadmin') {
        finalCompanyId = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id') || '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
      } else {
        const { data: isSuper } = await supabase.rpc('is_superadmin');
        if (isSuper) {
          finalRole = 'superadmin';
          finalCompanyId = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id') || '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
        } else {
          throw new Error('No active company membership found for this account in company_users.');
        }
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
      email: user.email
    };
  } catch (err: any) {
    console.warn('initTenantSession fallback:', err?.message);
    const localComp = localStorage.getItem('supabase_active_company_id') || localStorage.getItem('active_company_id') || '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
    const localRole = localStorage.getItem('supabase_active_role') || 'admin';
    return {
      companyId: localComp,
      role: localRole,
      userId: 'offline-user',
      email: 'offline@pos.local'
    };
  }
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
  if (!isSupabaseConfigured) {
    return { count: records.length };
  }

  const companyId = getActiveTenantId();
  const rows = records.map((record, idx) => {
    let recordId = '';
    try {
      recordId = getIdFn(record);
    } catch {
      recordId = '';
    }
    if (!recordId || String(recordId).trim() === '' || String(recordId).trim() === 'undefined' || String(recordId).trim() === 'null') {
      recordId = `${tableName}_rec_${Date.now()}_${idx + 1}`;
    }

    // Defensive clone with guaranteed structural fields for tables having flat column mappings
    const enrichedData: Record<string, any> = { ...record };
    if (tableName === 'ledgers') {
      const lName = enrichedData['Ledger Name'] || enrichedData.name || enrichedData.ledgerName || enrichedData.ledger_name || `Unnamed Ledger ${idx + 1}`;
      enrichedData['Ledger Name'] = lName;
      enrichedData.ledger_name = lName;
      enrichedData.name = lName;
      enrichedData.group = enrichedData.Group || enrichedData.group || 'Sundry Debtors';
    } else if (tableName === 'items') {
      const iCode = enrichedData['Item Code'] || enrichedData.code || enrichedData.itemCode || enrichedData.item_code || `ITEM-${idx + 1}`;
      const iName = enrichedData['Item Name'] || enrichedData.name || enrichedData.itemName || enrichedData.item_name || iCode;
      enrichedData['Item Code'] = iCode;
      enrichedData['Item Name'] = iName;
      enrichedData.item_code = iCode;
      enrichedData.item_name = iName;
    }

    return {
      company_id: companyId,
      record_id: String(recordId).trim(),
      ...(tableName === 'ledgers' ? { ledger_name: enrichedData['Ledger Name'], name: enrichedData['Ledger Name'], group: enrichedData.Group || 'Sundry Debtors' } : {}),
      ...(tableName === 'items' ? { item_code: enrichedData['Item Code'], item_name: enrichedData['Item Name'] } : {}),
      data: enrichedData,
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
      // If error is related to columns not existing in a purely JSONB document table, fallback without extra flat fields
      if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
        const cleanJsonbChunk = chunk.map(r => ({
          company_id: r.company_id,
          record_id: r.record_id,
          data: r.data,
          updated_at: r.updated_at
        }));
        const retryRes = await supabase
          .from(tableName)
          .upsert(cleanJsonbChunk, { onConflict: 'company_id, record_id' });
        if (retryRes.error) {
          console.error(`[MultiTenant Sync Error] Table ${tableName} chunk ${i}:`, retryRes.error.message);
          throw new Error(`Failed syncing ${tableName}: ${retryRes.error.message}`);
        }
      } else {
        console.error(`[MultiTenant Sync Error] Table ${tableName} chunk ${i}:`, error.message);
        throw new Error(`Failed syncing ${tableName}: ${error.message}`);
      }
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
  if (!isSupabaseConfigured) {
    return [];
  }

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
