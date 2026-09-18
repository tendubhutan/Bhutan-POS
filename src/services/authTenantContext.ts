import { supabase, isSupabaseConfigured, SupabaseCompany, SupabaseFinancialYear } from '../lib/supabase';
import { AppUser } from '../types';

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
  if (currentSessionCache) return currentSessionCache;

  const unlocked = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED) === 'true';
  const role = (typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_ROLE) : null) as UserTenantRole | null;
  const assignedCompanyId = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_ASSIGNED_COMPANY) : null;
  const uid = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEYS.AUTH_UID) : null;
  const activeCompanyId = typeof localStorage !== 'undefined' ? (localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID) || DEMO_COMPANY_UUID) : DEMO_COMPANY_UUID;

  if (unlocked && role) {
    const isSuperadmin = role === 'superadmin';
    const isClientAdmin = role === 'admin';
    currentSessionCache = {
      uid: uid || 'restored_session_user',
      email: isSuperadmin ? 'admin@bhutanerp.bt' : 'client@tenant.bt',
      fullName: isSuperadmin ? 'Platform System Administrator' : 'Tenant Administrator',
      role,
      assignedCompanyId,
      activeCompanyId: isSuperadmin ? activeCompanyId : (assignedCompanyId || activeCompanyId),
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
  return Boolean(session?.isSuperadmin);
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

  // 1. Try querying company_users in Supabase
  try {
    const { data: compUser, error: compErr } = await supabase
      .from('company_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (compUser && !compErr) {
      return {
        role: compUser.role as UserTenantRole,
        assignedCompanyId: compUser.company_id || null,
        fullName: compUser.full_name || 'System User'
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
      const mappedRole: UserTenantRole = 
        appUser.role === 'superadmin' ? 'superadmin' :
        appUser.role === 'Administrator' || appUser.role === 'admin' ? 'admin' :
        appUser.role === 'Cashier' ? 'cashier' :
        appUser.role === 'Accountant' ? 'accountant' :
        appUser.role === 'Auditor' ? 'auditor' : 'manager';

      return {
        role: mappedRole,
        assignedCompanyId: appUser.company_id || null,
        fullName: appUser.full_name || 'System User'
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
      // Superadmin can use stored active company or default to Demo Company
      const stored = localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID);
      activeCompanyId = stored || DEMO_COMPANY_UUID;
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
 * Authenticates user via Supabase Auth: supabase.auth.signInWithPassword()
 */
export async function loginWithSupabaseAuth(email: string, password: string): Promise<{
  session?: TenantAuthSession;
  error?: string;
}> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      return { error: 'Please enter your email and password.' };
    }

    // 1. Execute Supabase signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass
    });

    if (error) {
      // Handle known Supabase email confirmation or invalid credential messages
      if (error.message.includes('Email not confirmed')) {
        // Check if this is one of our seeded test users and allow local simulation if SQL not yet pasted
        if (KNOWN_ACCOUNT_ROLES[cleanEmail] && cleanPass.length >= 6) {
          const known = KNOWN_ACCOUNT_ROLES[cleanEmail];
          const session: TenantAuthSession = {
            uid: `test_user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email: cleanEmail,
            fullName: known.name,
            role: known.role,
            assignedCompanyId: known.companyId,
            activeCompanyId: known.companyId || DEMO_COMPANY_UUID,
            isSuperadmin: known.role === 'superadmin',
            isClientAdmin: known.role === 'admin',
            canSwitchCompany: known.role === 'superadmin'
          };
          localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, session.activeCompanyId);
          sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_UNLOCKED, 'true');
          notifySessionListeners(session);
          return { session };
        }
        return { 
          error: 'Email confirmation pending in Supabase. Please confirm your email or run the SQL trigger in your Supabase SQL editor.' 
        };
      }
      return { error: error.message || 'Invalid email or password.' };
    }

    if (!data.user) {
      return { error: 'No user returned from Supabase authentication.' };
    }

    // 2. Resolve role and company membership
    const profile = await resolveUserTenantProfile(data.user.id, data.user.email || cleanEmail);

    const isSuperadmin = profile.role === 'superadmin';
    const isClientAdmin = profile.role === 'admin';
    const canSwitchCompany = isSuperadmin;

    let activeCompanyId = profile.assignedCompanyId;
    if (isSuperadmin) {
      const stored = localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID);
      activeCompanyId = stored || DEMO_COMPANY_UUID;
    } else {
      activeCompanyId = profile.assignedCompanyId || DEMO_COMPANY_UUID;
      localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_COMPANY_ID, activeCompanyId);
    }

    const session: TenantAuthSession = {
      uid: data.user.id,
      email: data.user.email || cleanEmail,
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
    }
    localStorage.setItem(SESSION_STORAGE_KEYS.AUTH_UID, data.user.id);

    notifySessionListeners(session);
    return { session };
  } catch (err: any) {
    return { error: err?.message || 'Authentication failed' };
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
  const isPrivileged = session.isSuperadmin || session.isClientAdmin;
  
  return {
    id: session.uid,
    username: session.email.split('@')[0],
    fullName: session.fullName,
    role: session.isSuperadmin 
      ? 'Administrator' 
      : session.isClientAdmin 
        ? 'Administrator' 
        : session.role === 'cashier' 
          ? 'Cashier' 
          : session.role === 'accountant' 
            ? 'Accountant' 
            : 'Manager',
    status: 'Active',
    pinCode: '',
    permissions: [
      { module: 'pos', display: true, create: true, edit: isPrivileged, delete: isPrivileged, print: true },
      { module: 'purchase', display: isPrivileged || session.role === 'accountant', create: isPrivileged, edit: isPrivileged, delete: false, print: true },
      { module: 'vouchers', display: isPrivileged || session.role === 'accountant', create: isPrivileged || session.role === 'accountant', edit: isPrivileged, delete: isPrivileged, print: true },
      { module: 'masters', display: isPrivileged, create: isPrivileged, edit: isPrivileged, delete: isPrivileged, print: true },
      { module: 'barcode', display: true, create: isPrivileged, edit: isPrivileged, delete: false, print: true },
      { module: 'payroll', display: isPrivileged, create: isPrivileged, edit: isPrivileged, delete: isPrivileged, print: true },
      { module: 'reports', display: isPrivileged || session.role === 'accountant', create: false, edit: false, delete: false, print: true },
      { module: 'settings', display: isPrivileged, create: isPrivileged, edit: isPrivileged, delete: false, print: true }
    ]
  };
}
