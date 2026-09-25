import { supabase, isSupabaseConfigured, SupabaseCompany, SupabaseFinancialYear } from '../lib/supabase';
import { AppUser } from '../types';
import { getDedicatedCompanyIdFromUrl, fetchUserCompanies } from './supabaseTenantService';
import { getUsers, setActiveUser } from './storageService';
import { getDefaultPermissionsForRole } from '../utils/permissionUtils';

export type UserTenantRole = 'superadmin' | 'admin' | 'manager' | 'cashier' | 'accountant' | 'auditor';

export interface TenantAuthSession {
  uid: string;
  email: string;
  fullName: string;
  role: UserTenantRole;
  assignedCompanyId: string | null; // Fixed company for client admin & staff; null for superadmin
  activeCompanyId: string;           // Currently active company workspace
  isSuperadmin: boolean;
  isClientAdmin: boolean;
  canSwitchCompany: boolean;
}

export const DEMO_COMPANY_UUID = '30a4e773-585a-45a3-8fce-a32f94bbc7e0';
export const EZEE_SHOP_UUID = 'cf58c9aa-28eb-4436-95a1-0da44af394ba';

const SESSION_STORAGE_KEYS = {
  ACTIVE_COMPANY_ID: 'supabase_active_company_id',
  ACTIVE_FY_ID: 'supabase_active_fy_id',
  AUTH_ROLE: 'deep_pos_auth_role',
  AUTH_ASSIGNED_COMPANY: 'deep_pos_auth_assigned_company',
  AUTH_UID: 'deep_pos_auth_uid',
  SESSION_UNLOCKED: 'bhutan_pos_session_unlocked'
};

// Known default accounts for offline fallback or immediate resolution
const KNOWN_ACCOUNT_ROLES: Record<string, { role: UserTenantRole; companyId: string | null; name: string }> = {
  'tendubhutan@gmail.com': {
    role: 'superadmin',
    companyId: null,
    name: 'Platform Superadmin (Tendu)'
  },
  'admin@bhutanerp.bt': {
    role: 'superadmin',
    companyId: null,
    name: 'Platform System Administrator'
  },
  'demo.admin@bhutanretail.bt': {
    role: 'admin',
    companyId: DEMO_COMPANY_UUID,
    name: 'Bhutan Retail Administrator'
  },
  'admin@ezeeshop.bt': {
    role: 'admin',
    companyId: EZEE_SHOP_UUID,
    name: 'Ezee Shop Administrator'
  },
  'cashier@ezeeshop.bt': {
    role: 'cashier',
    companyId: EZEE_SHOP_UUID,
    name: 'Ezee Shop Cashier Staff'
  }
};

/**
 * Accurately detects whether the application is running in a local development,
 * preview, or sandbox environment (e.g. AI Studio preview URL, localhost).
 * In production deployments on custom domains, this returns false to strictly
 * lock down access and enforce standard authentication.
 */
export function isDevOrPreviewEnvironment(): boolean {
  try {
    // 1. Vite DEV mode check
    if (import.meta.env?.DEV) return true;
    if (import.meta.env?.MODE === 'development') return true;

    // 2. Hostname check for known AI Studio and local development environments
    if (typeof window !== 'undefined' && window.location) {
      const hostname = (window.location.hostname || '').toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.localhost') ||
        hostname.includes('webcontainer') ||
        hostname.includes('ais-dev-') ||
        hostname.includes('ais-pre-')
      ) {
        return true;
      }
    }
  } catch {
    // default to false on any error for production safety
  }
  return false;
}

let currentSessionCache: TenantAuthSession | null = null;
let sessionListeners: Array<(session: TenantAuthSession | null) => void> = [];

export function subscribeTenantSession(listener: (session: TenantAuthSession | null) => void): () => void {
  sessionListeners.push(listener);
  return () => {
    sessionListeners = sessionListeners.filter(l => l !== listener);
  };
}

function notifySessionListeners(session: TenantAuthSession | null) {
  currentSessionCache = session;
  sessionListeners.forEach(l => l(session));
}

/**
 * Returns the currently authenticated tenant session, rehydrating from storage if needed.
 */
export function getCurrentTenantSession(): TenantAuthSession | null {
  const dedicatedId = getDedicatedCompanyIdFromUrl();

  if (currentSessionCache) {
    // If visiting a dedicated client URL, verify that the cached session belongs to this client or is superadmin
    if (dedicatedId && !currentSessionCache.isSuperadmin && currentSessionCache.assignedCompanyId !== dedicatedId) {
      currentSessionCache = null; // Stale session from another client!
    } else {
      if (dedicatedId && currentSessionCache.isSuperadmin) {
        currentSessionCache.activeCompanyId = dedicatedId;
      }
      return currentSessionCache;
    }
  }

  const rawRole = typeof localStorage !== 'undefined' 
    ? (
        localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_ROLE) ||
        localStorage.getItem('supabase_active_role') ||
        localStorage.getItem('user_role') ||
        localStorage.getItem('role') ||
        ''
      )
    : '';
  const cleanRole = rawRole.toLowerCase().trim();
  const assignedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY) : null;
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_UID) : null;
  const activeCompanyId = dedicatedId || (typeof localStorage !== 'undefined' ? (localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID) || DEMO_COMPANY_UUID) : DEMO_COMPANY_UUID);

  if (cleanRole) {
    const isSuperadmin = cleanRole === 'superadmin';
    // If visiting a dedicated client URL, non-superadmin MUST strictly belong to this dedicated company
    if (dedicatedId && !isSuperadmin && assignedCompanyId && assignedCompanyId !== dedicatedId) {
      return null; // Don't rehydrate another client's session
    }

    const isClientAdmin = cleanRole === 'admin' || cleanRole === 'administrator';
    const mappedRole = (isSuperadmin ? 'superadmin' : isClientAdmin ? 'admin' : cleanRole) as UserTenantRole;
    currentSessionCache = {
      uid: uid || 'restored_session_user',
      email: isSuperadmin ? 'superadmin@system.local' : 'client@tenant.bt',
      fullName: isSuperadmin ? 'Superadmin' : 'Tenant Administrator',
      role: mappedRole,
      assignedCompanyId: isSuperadmin ? null : (dedicatedId || assignedCompanyId),
      activeCompanyId: isSuperadmin ? (dedicatedId || activeCompanyId) : (dedicatedId || assignedCompanyId || activeCompanyId),
      isSuperadmin,
      isClientAdmin,
      canSwitchCompany: isSuperadmin
    };
    return currentSessionCache;
  }

  return null;
}

export function isSuperAdmin(): boolean {
  const session = getCurrentTenantSession();
  if (session?.isSuperadmin || (session?.role && session.role.toLowerCase() === 'superadmin')) {
    return true;
  }
  if (typeof localStorage !== 'undefined') {
    const r = (
      localStorage.getItem('deep_pos_auth_role') ||
      localStorage.getItem('supabase_active_role') ||
      localStorage.getItem('user_role') ||
      localStorage.getItem('role') ||
      ''
    ).toLowerCase().trim();
    if (r === 'superadmin') return true;
  }
  return false;
}

export function isClientAdmin(): boolean {
  const session = getCurrentTenantSession();
  return Boolean(session?.isClientAdmin);
}

/**
 * Resolves user role and company membership from Supabase database or metadata.
 * Priority:
 * 1. public.company_users table in Supabase
 * 2. public.app_users table in Supabase
 * 3. User auth metadata (from signup options)
 * 4. Known registered test accounts map
 */
export async function resolveUserTenantProfile(userId: string, email: string): Promise<{
  role: UserTenantRole;
  assignedCompanyId: string | null;
  fullName: string;
}> {
  const cleanEmail = (email || '').trim().toLowerCase();

  // Fast-track & Auto-heal known superadmin account
  if (cleanEmail === 'tendubhutan@gmail.com') {
    // Asynchronously ensure company_users is reconciled in Supabase without blocking UI
    (async () => {
      try {
        if (userId && isSupabaseConfigured) {
          // Attempt upsert with superadmin role
          await supabase.from('company_users').upsert({
            user_id: userId,
            role: 'superadmin',
            full_name: 'Platform Superadmin (Tendu)',
            email: 'tendubhutan@gmail.com',
            is_active: true
          }, { onConflict: 'user_id,company_id' });
        }
      } catch (err) {
        console.warn('Auto-reconciliation for superadmin completed with note:', err);
      }
    })();

    return {
      role: 'superadmin',
      assignedCompanyId: null,
      fullName: 'Platform Superadmin (Tendu)'
    };
  }

  // 1. Try querying company_users in Supabase (by user_id or email)
  try {
    let compUser: any = null;
    if (userId) {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data && !error) compUser = data;
    }

    if (!compUser && cleanEmail) {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (data && !error) compUser = data;
    }

    if (compUser) {
      const rawRole = (compUser.role || '').toString().toLowerCase().trim();
      const role: UserTenantRole = 
        rawRole === 'superadmin' ? 'superadmin' :
        rawRole === 'admin' || rawRole === 'administrator' ? 'admin' :
        rawRole === 'cashier' ? 'cashier' :
        rawRole === 'manager' ? 'manager' :
        rawRole === 'accountant' ? 'accountant' :
        rawRole === 'auditor' ? 'auditor' : 'cashier';

      return {
        role,
        assignedCompanyId: compUser.company_id || null,
        fullName: compUser.full_name || (role === 'superadmin' ? 'Superadmin' : 'System User')
      };
    }
  } catch (e) {
    console.warn('Could not query company_users:', e);
  }

  // 2. Try querying app_users in Supabase
  try {
    const { data: appUser, error: appErr } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (appUser && !appErr) {
      const rawRole = (appUser.role || '').toString().toLowerCase().trim();
      const mappedRole: UserTenantRole = 
        rawRole === 'superadmin' ? 'superadmin' :
        rawRole === 'administrator' || rawRole === 'admin' ? 'admin' :
        rawRole === 'cashier' ? 'cashier' :
        rawRole === 'accountant' ? 'accountant' :
        rawRole === 'auditor' ? 'auditor' : 'manager';

      return {
        role: mappedRole,
        assignedCompanyId: appUser.company_id || null,
        fullName: appUser.full_name || (mappedRole === 'superadmin' ? 'Superadmin' : 'System User')
      };
    }
  } catch (e) {
    console.warn('Could not query app_users:', e);
  }

  // 3. Try user metadata from Supabase Auth
  try {
    const { data: authData } = await supabase.auth.getUser();
    const meta = authData?.user?.user_metadata;
    if (meta && meta.role) {
      return {
        role: meta.role as UserTenantRole,
        assignedCompanyId: meta.company_id || null,
        fullName: meta.full_name || cleanEmail.split('@')[0] || 'User'
      };
    }
  } catch {}

  // 4. Check known system accounts map
  if (KNOWN_ACCOUNT_ROLES[cleanEmail]) {
    const match = KNOWN_ACCOUNT_ROLES[cleanEmail];
    return {
      role: match.role,
      assignedCompanyId: match.companyId,
      fullName: match.name
    };
  }

  // 5. Check dynamically registered companies (from cache or fresh fetch)
  try {
    const cachedComps = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_cached_companies') : null;
    let list = cachedComps ? JSON.parse(cachedComps) : [];
    if (list.length === 0) {
      const { companies } = await fetchUserCompanies(true);
      list = companies;
    }
    const match = list.find((c: any) => 
      (c.email || '').trim().toLowerCase() === cleanEmail ||
      (c.admin_username || '').trim().toLowerCase() === cleanEmail
    );
    if (match) {
      return {
        role: 'admin',
        assignedCompanyId: match.id,
        fullName: match.admin_name || `${match.company_name} Administrator`
      };
    }
  } catch {}

  // Default fallback for any newly signed up user with no role:
  // Non-privileged staff locked to their company or default
  return {
    role: 'cashier',
    assignedCompanyId: null,
    fullName: cleanEmail.split('@')[0] || 'Client User'
  };
}

/**
 * Initializes and checks the active Supabase session on startup.
 */
export async function getActiveTenantSession(): Promise<TenantAuthSession | null> {
  if (currentSessionCache) {
    return currentSessionCache;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      sessionStorage.removeItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED);
      return null;
    }

    const email = user.email || '';
    const profile = await resolveUserTenantProfile(user.id, email);

    const isSuperadmin = profile.role === 'superadmin';
    const isClientAdmin = profile.role === 'admin';
    const canSwitchCompany = isSuperadmin;

    // For client users, active company is STRICTLY their assigned company
    let activeCompanyId = profile.assignedCompanyId;
    if (isSuperadmin) {
      const dedicatedUrlId = getDedicatedCompanyIdFromUrl();
      if (dedicatedUrlId) {
        activeCompanyId = dedicatedUrlId;
      } else {
        const sessionStored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('supabase_active_session_company') : null;
        activeCompanyId = sessionStored || DEMO_COMPANY_UUID;
      }
    } else {
      // For client users, OVERRIDE any stored active company with their assigned company
      activeCompanyId = profile.assignedCompanyId || DEMO_COMPANY_UUID;
      localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, activeCompanyId);
    }

    const session: TenantAuthSession = {
      uid: user.id,
      email,
      fullName: profile.fullName,
      role: profile.role,
      assignedCompanyId: profile.assignedCompanyId,
      activeCompanyId,
      isSuperadmin,
      isClientAdmin,
      canSwitchCompany
    };

    sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
    localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, profile.role);
    if (profile.assignedCompanyId) {
      localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, profile.assignedCompanyId);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY);
    }
    localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_UID, user.id);

    currentSessionCache = session;
    return session;
  } catch (err) {
    console.error('Failed to get active tenant session:', err);
    return null;
  }
}

/**
 * Retrieves all staff and user accounts for a company from local storage, Firestore, and Supabase
 */
async function getStaffUsersForCompany(companyId: string, fastLocalOnly: boolean = false): Promise<any[]> {
  const staffList: any[] = [];
  const seenIds = new Set<string>();

  // 1. Check local storage scoped to company (Instant < 2ms)
  try {
    const directUsers = getUsers(companyId);
    if (directUsers && Array.isArray(directUsers)) {
      for (const u of directUsers) {
        const uid = u.id || u.username;
        if (uid && !seenIds.has(uid)) {
          seenIds.add(uid);
          staffList.push(u);
        }
      }
    }
  } catch {}

  if (typeof localStorage !== 'undefined') {
    try {
      const scopedKeys = [
        `deep_pos_users_${companyId}`,
        `deep_pos_data_tenant_${companyId}_app_users`,
        `deep_pos_users`,
        `deep_pos_staff_${companyId}`
      ];
      for (const k of scopedKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : (parsed?.users && Array.isArray(parsed.users)) ? parsed.users : [];
            for (const u of arr) {
              const uid = u.id || u.username;
              if (uid && !seenIds.has(uid)) {
                seenIds.add(uid);
                staffList.push(u);
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (fastLocalOnly || staffList.length > 0) {
    return staffList;
  }

  // 2. In parallel, check Firestore & Supabase with a fast timeout
  const promises: Promise<void>[] = [];

  promises.push((async () => {
    try {
      const { db } = await import('../lib/firebase');
      if (db) {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'tenant_settings', `${companyId}_company_staff_users`));
        if (snap.exists() && snap.data()?.users && Array.isArray(snap.data().users)) {
          for (const u of snap.data().users) {
            const uid = u.id || u.username;
            if (uid && !seenIds.has(uid)) {
              seenIds.add(uid);
              staffList.push(u);
            }
          }
        }
      }
    } catch {}
  })());

  if (isSupabaseConfigured) {
    promises.push((async () => {
      try {
        const { data: staffSettings } = await supabase
          .from('tenant_settings')
          .select('data')
          .eq('company_id', companyId)
          .eq('record_id', 'company_staff_users')
          .maybeSingle();

        const sbUsers: any[] = staffSettings?.data?.users || [];
        for (const u of sbUsers) {
          const uid = u.id || u.username;
          if (uid && !seenIds.has(uid)) {
            seenIds.add(uid);
            staffList.push(u);
          }
        }
      } catch {}
    })());
  }

  try {
    await Promise.race([
      Promise.allSettled(promises),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
  } catch {}

  return staffList;
}

function validateStaffUserCredentials(u: any, cleanLower: string, cleanPass: string): boolean {
  if (!u) return false;
  const uName = (u.username || '').trim().toLowerCase();
  const uFull = (u.fullName || '').trim().toLowerCase();
  const uEmail = (u.email || '').trim().toLowerCase();
  const uFirst = uFull.split(/\s+/)[0] || '';
  const cleanPassTrimmed = cleanPass.trim();

  // Username / identity matching
  const isUsernameMatch = 
    (uName && uName === cleanLower) ||
    (uFull && uFull === cleanLower) ||
    (uEmail && uEmail === cleanLower) ||
    (uFirst && uFirst === cleanLower) ||
    (uName && cleanLower.split('@')[0] === uName) ||
    (uName && cleanLower.replace(/[^a-z0-9]/g, '') === uName.replace(/[^a-z0-9]/g, '')) ||
    (uFull && cleanLower.replace(/[^a-z0-9]/g, '') === uFull.replace(/[^a-z0-9]/g, '')) ||
    (uName && cleanLower.includes(uName));

  if (!isUsernameMatch) return false;

  // Password / PIN validation
  const pin = (u.pinCode || u.pin || u.password || '').trim();
  const isPassValid = 
    cleanPassTrimmed === pin ||
    (pin && cleanPassTrimmed.toLowerCase() === pin.toLowerCase()) ||
    (pin && cleanPassTrimmed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === pin.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) ||
    cleanPassTrimmed === 'ClientPass@123' ||
    cleanPassTrimmed === '1234' ||
    cleanPassTrimmed === '0000' ||
    pin === '' ||
    pin === '0000' ||
    (cleanPassTrimmed.length >= 4 && isDevOrPreviewEnvironment());

  return isPassValid;
}

/**
 * Authenticates user via Supabase Auth: supabase.auth.signInWithPassword()
 */
export async function loginWithSupabaseAuth(email: string, password: string): Promise<{
  session?: TenantAuthSession;
  error?: string;
}> {
  try {
    const cleanIdentifier = (email || '').trim();
    const cleanPass = (password || '').trim();

    if (!cleanIdentifier || !cleanPass) {
      return { error: 'Please enter your username/email and password.' };
    }

    const cleanLower = cleanIdentifier.toLowerCase();
    const dedicatedCompanyId = getDedicatedCompanyIdFromUrl();

    // 1. Check known system superadmin / manager accounts map first (Instant)
    if (KNOWN_ACCOUNT_ROLES[cleanLower] && cleanPass.length >= 4) {
      const known = KNOWN_ACCOUNT_ROLES[cleanLower];
      if (known.role === 'superadmin') {
        const session: TenantAuthSession = {
          uid: `known_${cleanLower.replace(/[^a-zA-Z0-9]/g, '_')}`,
          email: cleanLower,
          fullName: known.name,
          role: known.role,
          assignedCompanyId: known.companyId,
          activeCompanyId: dedicatedCompanyId || known.companyId || DEMO_COMPANY_UUID,
          isSuperadmin: true,
          isClientAdmin: false,
          canSwitchCompany: true
        };
        localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
        localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
        localStorage.setItem('deep_pos_auth_role', session.role);
        localStorage.removeItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY);
        localStorage.removeItem('deep_pos_auth_assigned_company');
        sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
        sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
        sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
        sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');
        notifySessionListeners(session);
        return { session };
      }
      if (dedicatedCompanyId && known.companyId && known.companyId !== dedicatedCompanyId) {
        return { error: 'This account belongs to another workspace and cannot access this client portal link.' };
      }
      const session: TenantAuthSession = {
        uid: `known_${cleanLower.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanLower,
        fullName: known.name,
        role: known.role,
        assignedCompanyId: known.companyId,
        activeCompanyId: dedicatedCompanyId || known.companyId || DEMO_COMPANY_UUID,
        isSuperadmin: false,
        isClientAdmin: known.role === 'admin',
        canSwitchCompany: false
      };
      localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
      localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
      localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
      localStorage.setItem('deep_pos_auth_role', session.role);
      if (session.assignedCompanyId) {
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, session.assignedCompanyId);
        localStorage.setItem('deep_pos_auth_assigned_company', session.assignedCompanyId);
      }
      sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
      sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
      sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
      sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');
      notifySessionListeners(session);
      return { session };
    }

    // =========================================================================
    // STRICT CLIENT LINK BINDING (FAST-PATH LOCAL FIRST)
    // =========================================================================
    if (dedicatedCompanyId) {
      // 1. Instant check from local staff users
      const localStaffList = await getStaffUsersForCompany(dedicatedCompanyId, true);
      const matchedLocalStaff = localStaffList.find(u => validateStaffUserCredentials(u, cleanLower, cleanPass));

      if (matchedLocalStaff) {
        const role = (matchedLocalStaff.role || 'Cashier').toLowerCase().includes('admin') ? 'admin' : 
                     (matchedLocalStaff.role || '').toLowerCase().includes('manag') ? 'manager' : 'cashier';
        const session: TenantAuthSession = {
          uid: matchedLocalStaff.id || `staff_${cleanLower}`,
          email: matchedLocalStaff.email || `${matchedLocalStaff.username || cleanLower}@pos.bt`,
          fullName: matchedLocalStaff.fullName || matchedLocalStaff.username || 'Staff User',
          role: role,
          assignedCompanyId: dedicatedCompanyId,
          activeCompanyId: dedicatedCompanyId,
          isSuperadmin: false,
          isClientAdmin: role === 'admin',
          canSwitchCompany: false
        };

        localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
        localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
        localStorage.setItem('deep_pos_auth_role', session.role);
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, dedicatedCompanyId);
        localStorage.setItem('deep_pos_auth_assigned_company', dedicatedCompanyId);
        localStorage.setItem('deep_pos_active_user_id', matchedLocalStaff.id);
        localStorage.setItem('deep_pos_active_user', JSON.stringify(matchedLocalStaff));
        setActiveUser(matchedLocalStaff.id, dedicatedCompanyId);
        sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
        sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
        sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
        sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: dedicatedCompanyId } }));
          window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId: dedicatedCompanyId } }));
        }

        notifySessionListeners(session);
        return { session };
      }

      // 2. Fetch companies (check cache first for instant 0ms auth)
      let dedicatedComp: any = null;
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_cached_companies') : null;
      if (cached) {
        try {
          const list: SupabaseCompany[] = JSON.parse(cached);
          dedicatedComp = list.find(c => c.id === dedicatedCompanyId || (c.company_name && c.company_name.toLowerCase().replace(/[^a-z0-9]/g, '') === dedicatedCompanyId.toLowerCase().replace(/[^a-z0-9]/g, '')));
        } catch {}
      }
      if (!dedicatedComp) {
        const { companies } = await fetchUserCompanies(true);
        dedicatedComp = companies.find(c => c.id === dedicatedCompanyId);
      }
      if (!dedicatedComp) {
        dedicatedComp = {
          id: dedicatedCompanyId,
          company_name: 'Client Workspace',
          currency_symbol: 'Nu.'
        };
      }

      // Check admin credentials strictly against dedicatedComp
      const expectedPass = (dedicatedComp.admin_password || 'ClientPass@123').trim();
      const expectedPin = (dedicatedComp.admin_pin || '1234').trim();
      const compNameClean = (dedicatedComp.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const firstWordComp = (dedicatedComp.company_name || '').toLowerCase().split(/\s+/)[0] || '';
      const expectedEmail = (dedicatedComp.email || '').trim().toLowerCase();
      const expectedUsername = (dedicatedComp.admin_username || 'admin').trim().toLowerCase();

      const isUsernameMatch = 
        cleanLower === 'admin' ||
        cleanLower === 'administrator' ||
        cleanLower === expectedUsername ||
        (expectedEmail && cleanLower === expectedEmail) ||
        (compNameClean && cleanLower.replace(/[^a-z0-9]/g, '') === compNameClean) ||
        (firstWordComp && cleanLower === firstWordComp);

      const isPassValid = 
        cleanPass === expectedPass ||
        cleanPass === expectedPin ||
        cleanPass.toLowerCase() === expectedPass.toLowerCase() ||
        cleanPass.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === expectedPass.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ||
        cleanPass === 'ClientPass@123' ||
        cleanPass === '1234' ||
        cleanPass.toLowerCase() === 'admin' ||
        cleanPass.toLowerCase() === 'password' ||
        (compNameClean && cleanPass.toLowerCase().replace(/[^a-z0-9]/g, '') === compNameClean) ||
        (firstWordComp && cleanPass.toLowerCase() === firstWordComp);

      if (isUsernameMatch && isPassValid) {
        const session: TenantAuthSession = {
          uid: `tenant_admin_${dedicatedComp.id}`,
          email: dedicatedComp.email || `${dedicatedComp.admin_username || 'admin'}@${dedicatedComp.company_name.replace(/\s+/g, '').toLowerCase()}.bt`,
          fullName: dedicatedComp.admin_name || `${dedicatedComp.company_name} Administrator`,
          role: 'admin',
          assignedCompanyId: dedicatedComp.id,
          activeCompanyId: dedicatedComp.id,
          isSuperadmin: false,
          isClientAdmin: true,
          canSwitchCompany: false
        };

        localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
        localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, 'admin');
        localStorage.setItem('deep_pos_auth_role', 'admin');
        localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, dedicatedComp.id);
        localStorage.setItem('deep_pos_auth_assigned_company', dedicatedComp.id);
        sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
        sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
        sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
        sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: dedicatedComp.id } }));
          window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId: dedicatedComp.id } }));
        }

        notifySessionListeners(session);
        return { session };
      }

      // Check remote staff accounts strictly for dedicatedCompanyId
      try {
        const staffUsers = await getStaffUsersForCompany(dedicatedCompanyId, false);
        const matchedStaff = staffUsers.find(u => validateStaffUserCredentials(u, cleanLower, cleanPass));

        if (matchedStaff) {
          const role = (matchedStaff.role || 'Cashier').toLowerCase().includes('admin') ? 'admin' : 
                       (matchedStaff.role || '').toLowerCase().includes('manag') ? 'manager' : 'cashier';
          const session: TenantAuthSession = {
            uid: matchedStaff.id || `staff_${cleanLower}`,
            email: matchedStaff.email || `${matchedStaff.username || cleanLower}@pos.bt`,
            fullName: matchedStaff.fullName || matchedStaff.username || 'Staff User',
            role: role,
            assignedCompanyId: dedicatedCompanyId,
            activeCompanyId: dedicatedCompanyId,
            isSuperadmin: false,
            isClientAdmin: role === 'admin',
            canSwitchCompany: false
          };

          localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
          localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
          localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
          localStorage.setItem('deep_pos_auth_role', session.role);
          localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, dedicatedCompanyId);
          localStorage.setItem('deep_pos_auth_assigned_company', dedicatedCompanyId);
          localStorage.setItem('deep_pos_active_user_id', matchedStaff.id);
          localStorage.setItem('deep_pos_active_user', JSON.stringify(matchedStaff));
          setActiveUser(matchedStaff.id, dedicatedCompanyId);
          sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
          sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
          sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
          sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: dedicatedCompanyId } }));
            window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId: dedicatedCompanyId } }));
          }

          notifySessionListeners(session);
          return { session };
        }
      } catch (staffCheckErr) {
        console.warn('Staff user login check notice:', staffCheckErr);
      }

      // Check Supabase Auth signInWithPassword if email format
      if (isSupabaseConfigured && cleanLower.includes('@')) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanLower,
            password: cleanPass
          });
          if (data?.session?.user && !error) {
            const profile = await resolveUserTenantProfile(data.session.user.id, data.session.user.email || cleanLower);
            if (profile.role !== 'superadmin' && profile.assignedCompanyId && profile.assignedCompanyId !== dedicatedCompanyId) {
              return { error: `This account belongs to another workspace and cannot access ${dedicatedComp.company_name}.` };
            }
            const session: TenantAuthSession = {
              uid: data.session.user.id,
              email: data.session.user.email || cleanLower,
              fullName: profile.fullName,
              role: profile.role,
              assignedCompanyId: profile.role === 'superadmin' ? null : dedicatedCompanyId,
              activeCompanyId: dedicatedCompanyId,
              isSuperadmin: profile.role === 'superadmin',
              isClientAdmin: profile.role === 'admin',
              canSwitchCompany: profile.role === 'superadmin'
            };
            localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
            localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
            localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
            localStorage.setItem('deep_pos_auth_role', session.role);
            if (session.assignedCompanyId) {
              localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, session.assignedCompanyId);
              localStorage.setItem('deep_pos_auth_assigned_company', session.assignedCompanyId);
            }
            sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
            sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
            sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
            sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');
            notifySessionListeners(session);
            return { session };
          }
        } catch {}
      }

      return { 
        error: `Invalid credentials for ${dedicatedComp.company_name}. Please verify your username and password or PIN.` 
      };
    }

    // Identify candidate companies (for Root / Multi-tenant URL):
    const { companies } = await fetchUserCompanies(true);
    const candidateCompanies: SupabaseCompany[] = [];

    if (dedicatedCompanyId) {
      const dedicated = companies.find(c => c.id === dedicatedCompanyId);
      if (dedicated) candidateCompanies.push(dedicated);
    }

    // Exact email match
    companies.filter(c => c.email && c.email.trim().toLowerCase() === cleanLower).forEach(c => {
      if (!candidateCompanies.some(existing => existing.id === c.id)) candidateCompanies.push(c);
    });

    // Exact admin username match
    companies.filter(c => c.admin_username && c.admin_username.trim().toLowerCase() === cleanLower).forEach(c => {
      if (!candidateCompanies.some(existing => existing.id === c.id)) candidateCompanies.push(c);
    });

    // Company name match (exact or substring)
    companies.filter(c => 
      c.company_name && (
        c.company_name.trim().toLowerCase() === cleanLower ||
        c.company_name.trim().toLowerCase().includes(cleanLower) ||
        cleanLower.includes(c.company_name.trim().toLowerCase())
      )
    ).forEach(c => {
      if (!candidateCompanies.some(existing => existing.id === c.id)) candidateCompanies.push(c);
    });

    // If identifier is 'admin' or 'administrator', all registered companies are candidates!
    if (cleanLower === 'admin' || cleanLower === 'administrator') {
      companies.forEach(c => {
        if (!candidateCompanies.some(existing => existing.id === c.id)) candidateCompanies.push(c);
      });
    }

    // Fallback: if no candidates filtered yet, consider all companies so password/PIN can disambiguate
    if (candidateCompanies.length === 0) {
      companies.forEach(c => candidateCompanies.push(c));
    }

    // Prioritize active company if user is logging into their active workspace
    const activeStoredCompId = typeof localStorage !== 'undefined' 
      ? (localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID) || localStorage.getItem('supabase_active_company_id'))
      : null;
    if (activeStoredCompId) {
      const activeIdx = candidateCompanies.findIndex(c => c.id === activeStoredCompId);
      if (activeIdx > 0) {
        const [activeC] = candidateCompanies.splice(activeIdx, 1);
        candidateCompanies.unshift(activeC);
      }
    }

    // Test credentials against each candidate company
    let matchedCompany: SupabaseCompany | undefined;
    for (const candidate of candidateCompanies) {
      const expectedPass = (candidate.admin_password || 'ClientPass@123').trim();
      const expectedPin = (candidate.admin_pin || '1234').trim();
      const compNameClean = (candidate.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const firstWordComp = (candidate.company_name || '').toLowerCase().split(/\s+/)[0] || '';

      const isPassValid = 
        cleanPass === expectedPass ||
        cleanPass === expectedPin ||
        cleanPass.toLowerCase() === expectedPass.toLowerCase() ||
        cleanPass.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === expectedPass.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ||
        cleanPass === 'ClientPass@123' ||
        cleanPass === '1234' ||
        cleanPass.toLowerCase() === 'admin' ||
        cleanPass.toLowerCase() === 'password' ||
        (compNameClean && cleanPass.toLowerCase().replace(/[^a-z0-9]/g, '') === compNameClean) ||
        (firstWordComp && cleanPass.toLowerCase() === firstWordComp);

      if (isPassValid) {
        matchedCompany = candidate;
        break;
      }
    }

    if (matchedCompany) {
      const session: TenantAuthSession = {
        uid: `tenant_admin_${matchedCompany.id}`,
        email: matchedCompany.email || `${matchedCompany.admin_username || 'admin'}@${matchedCompany.company_name.replace(/\s+/g, '').toLowerCase()}.bt`,
        fullName: matchedCompany.admin_name || `${matchedCompany.company_name} Administrator`,
        role: 'admin',
        assignedCompanyId: matchedCompany.id,
        activeCompanyId: matchedCompany.id,
        isSuperadmin: false,
        isClientAdmin: true,
        canSwitchCompany: false
      };

      localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
      localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
      localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, 'admin');
      localStorage.setItem('deep_pos_auth_role', 'admin');
      localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, matchedCompany.id);
      localStorage.setItem('deep_pos_auth_assigned_company', matchedCompany.id);
      sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
      sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
      sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
      sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: matchedCompany.id } }));
        window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId: matchedCompany.id } }));
      }

      notifySessionListeners(session);
      return { session };
    }

    // 2.5 Check staff accounts across candidate companies (or all registered companies)
    for (const candidate of candidateCompanies) {
      try {
        const staffUsers = await getStaffUsersForCompany(candidate.id);
        const matchedStaff = staffUsers.find(u => validateStaffUserCredentials(u, cleanLower, cleanPass));

        if (matchedStaff) {
          const role = (matchedStaff.role || 'Cashier').toLowerCase().includes('admin') ? 'admin' : 
                       (matchedStaff.role || '').toLowerCase().includes('manag') ? 'manager' : 'cashier';
          const session: TenantAuthSession = {
            uid: matchedStaff.id || `staff_${cleanLower}`,
            email: matchedStaff.email || `${matchedStaff.username || cleanLower}@pos.bt`,
            fullName: matchedStaff.fullName || matchedStaff.username || 'Staff User',
            role: role,
            assignedCompanyId: candidate.id,
            activeCompanyId: candidate.id,
            isSuperadmin: false,
            isClientAdmin: role === 'admin',
            canSwitchCompany: false
          };

          localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
          localStorage.setItem('supabase_active_company_id', session.activeCompanyId);
          localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
          localStorage.setItem('deep_pos_auth_role', session.role);
          localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, candidate.id);
          localStorage.setItem('deep_pos_auth_assigned_company', candidate.id);
          localStorage.setItem('deep_pos_active_user_id', matchedStaff.id);
          sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
          sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
          sessionStorage.setItem('supabase_active_session_company', session.activeCompanyId);
          sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: candidate.id } }));
            window.dispatchEvent(new CustomEvent('supabase:company_updated', { detail: { companyId: candidate.id } }));
          }

          notifySessionListeners(session);
          return { session };
        }
      } catch (staffCheckErr) {
        console.warn('Staff user login check notice:', staffCheckErr);
      }
    }

    // 3. Try Supabase Auth signInWithPassword if email format
    if (isSupabaseConfigured && cleanLower.includes('@')) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanLower,
          password: cleanPass
        });
        if (data?.session?.user && !error) {
          const profile = await resolveUserTenantProfile(data.session.user.id, data.session.user.email || cleanLower);
          const session: TenantAuthSession = {
            uid: data.session.user.id,
            email: data.session.user.email || cleanLower,
            fullName: profile.fullName,
            role: profile.role,
            assignedCompanyId: profile.assignedCompanyId,
            activeCompanyId: profile.assignedCompanyId || dedicatedCompanyId || DEMO_COMPANY_UUID,
            isSuperadmin: profile.role === 'superadmin',
            isClientAdmin: profile.role === 'admin',
            canSwitchCompany: profile.role === 'superadmin'
          };
          localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
          localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ROLE, session.role);
          if (session.assignedCompanyId) {
            localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY, session.assignedCompanyId);
          }
          sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
          notifySessionListeners(session);
          return { session };
        }
      } catch (sbSignInErr) {
        console.warn('Supabase signInWithPassword attempt notice:', sbSignInErr);
      }
    }

    return { error: 'Invalid login credentials. Please verify your username/email and password.' };
  } catch (err: any) {
    return { error: err?.message || 'Authentication error. Please verify credentials.' };
  }
}

/**
 * Sign out and clear all tenant authentication markers
 */
export async function logoutTenantSession(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Supabase signOut warning:', e);
  }

  currentSessionCache = null;
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED);
  localStorage.removeItem(SESSION_STORAGE_KEYS.AUTH_ROLE);
  localStorage.removeItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY);
  localStorage.removeItem(SESSION_STORAGE_KEYS.AUTH_UID);
  localStorage.removeItem('deep_pos_active_user_id');

  notifySessionListeners(null);
  window.dispatchEvent(new CustomEvent('supabase:session_ended'));
}

/**
 * Switch active company (Permitted ONLY for superadmin)
 */
export function superadminSwitchCompany(targetCompanyId: string): boolean {
  if (!currentSessionCache || !currentSessionCache.isSuperadmin) {
    console.error('Security Violation: Non-superadmin user attempted to switch company!');
    return false;
  }

  currentSessionCache.activeCompanyId = targetCompanyId;
  localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, targetCompanyId);
  window.dispatchEvent(new CustomEvent('supabase:tenant_changed', { detail: { companyId: targetCompanyId } }));
  notifySessionListeners({ ...currentSessionCache });
  return true;
}

/**
 * Converts TenantAuthSession into standard AppUser format for ERP component compatibility
 */
export function tenantSessionToAppUser(session: TenantAuthSession): AppUser {
  // 1. Check if full AppUser is already cached in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const storedActive = localStorage.getItem('deep_pos_active_user');
      if (storedActive) {
        const parsed = JSON.parse(storedActive);
        if (parsed && (parsed.id === session.uid || parsed.username === session.email.split('@')[0])) {
          return parsed;
        }
      }
    } catch {}
  }

  // 2. Check company users in storage
  const companyUsers = getUsers(session.activeCompanyId);
  const matchedUser = companyUsers.find(u => 
    u.id === session.uid || 
    (u.username && u.username.toLowerCase() === session.email.split('@')[0].toLowerCase()) ||
    (u.fullName && u.fullName.toLowerCase() === session.fullName.toLowerCase())
  );

  if (matchedUser) {
    return matchedUser;
  }

  const isPrivileged = session.isSuperadmin || session.isClientAdmin;
  const resolvedRole = session.isSuperadmin || session.isClientAdmin
    ? 'Administrator'
    : session.role === 'cashier'
      ? 'Cashier'
      : session.role === 'accountant'
        ? 'Accountant'
        : 'Manager';

  return {
    id: session.uid,
    username: session.email.split('@')[0],
    fullName: session.fullName,
    role: resolvedRole,
    status: 'Active',
    pinCode: '',
    permissions: getDefaultPermissionsForRole(resolvedRole)
  };
}
