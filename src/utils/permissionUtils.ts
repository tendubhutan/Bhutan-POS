import { AppUser, ModuleId, UserPermission } from '../types';
import { isSuperAdmin, getCurrentTenantSession } from '../services/authTenantContext';

export const ALL_MODULE_IDS: ModuleId[] = [
  'pos',
  'normalsale',
  'purchase',
  'vouchers',
  'masters',
  'schemes',
  'barcode',
  'payroll',
  'staff',
  'reports',
  'settings'
];

export const MODULE_LABELS: Record<ModuleId, string> = {
  pos: 'POS Billing',
  normalsale: 'Sales Invoice (Normal Sale)',
  purchase: 'Purchase Entry',
  vouchers: 'Accounting Vouchers',
  masters: 'Masters Directory',
  schemes: 'Schemes & Offers',
  barcode: 'Barcode Printing',
  payroll: 'Payroll & HR',
  staff: 'Staff & Tasks (Attendance)',
  reports: 'Reports & Intelligence',
  settings: 'Settings & Security'
};

export function getDefaultPermissionsForRole(role: string): UserPermission[] {
  const r = (role || '').toLowerCase().trim();
  const isAdmin = r === 'administrator' || r === 'admin' || r === 'superadmin';
  const isManager = r === 'manager';
  const isAccountant = r === 'accountant';
  const isCashier = r === 'cashier';

  return ALL_MODULE_IDS.map(modId => {
    if (isAdmin) {
      return { module: modId, display: true, create: true, edit: true, delete: true, print: true };
    }
    if (isCashier) {
      if (modId === 'pos') {
        return { module: modId, display: true, create: true, edit: false, delete: false, print: true };
      }
      return { module: modId, display: false, create: false, edit: false, delete: false, print: false };
    }
    if (isAccountant) {
      const allowed = ['pos', 'normalsale', 'purchase', 'vouchers', 'reports'].includes(modId);
      return {
        module: modId,
        display: allowed,
        create: allowed,
        edit: allowed && modId !== 'reports',
        delete: false,
        print: allowed
      };
    }
    if (isManager) {
      const restricted = modId === 'settings';
      return {
        module: modId,
        display: !restricted,
        create: !restricted,
        edit: !restricted,
        delete: modId === 'pos' || modId === 'normalsale',
        print: !restricted
      };
    }
    // Default custom role
    return {
      module: modId,
      display: modId === 'pos',
      create: modId === 'pos',
      edit: false,
      delete: false,
      print: modId === 'pos'
    };
  });
}

export function isUserSuperAdmin(user?: AppUser | null): boolean {
  if (isSuperAdmin()) return true;
  const session = getCurrentTenantSession();
  if (session?.isSuperadmin) return true;
  const role = (
    user?.role ||
    session?.role ||
    (typeof localStorage !== 'undefined' ? (
      localStorage.getItem('deep_pos_auth_role') ||
      localStorage.getItem('supabase_active_role') ||
      localStorage.getItem('user_role') ||
      localStorage.getItem('role') ||
      ''
    ) : '')
  ).toString().toLowerCase().trim();
  return role === 'superadmin';
}

export function isModulePermitted(
  user: AppUser | undefined | null,
  moduleId: string,
  action: keyof Omit<UserPermission, 'module'> = 'display',
  isSuperadmin: boolean = false
): boolean {
  if (isSuperadmin || isUserSuperAdmin(user)) return true;
  if (!user) return false;

  const roleLower = (user.role || '').toLowerCase().trim();
  const isAdministrator = roleLower === 'administrator' || roleLower === 'admin' || roleLower === 'superadmin';

  // Normalize moduleId
  let normMod = moduleId.toLowerCase().trim() as ModuleId;
  if (normMod === 'sales' as any || normMod === 'sale' as any) normMod = 'normalsale';
  if (normMod === 'attendance' as any) normMod = 'staff';
  if (normMod === 'bankrecon' as any) normMod = 'vouchers';
  if (normMod === 'assets' as any) normMod = 'masters';

  // If user has permissions array, evaluate strict match first
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    const perm = user.permissions.find(p => p.module === normMod);
    if (perm !== undefined) {
      return Boolean(perm[action]);
    }

    // Fallbacks for legacy/unconfigured entries in permission array:
    if (normMod === 'normalsale') {
      const posPerm = user.permissions.find(p => p.module === 'pos');
      if (posPerm) return Boolean(posPerm[action]);
    }
    if (normMod === 'schemes' || normMod === 'barcode') {
      const mastersPerm = user.permissions.find(p => p.module === 'masters');
      if (mastersPerm) return Boolean(mastersPerm[action]);
      return isAdministrator;
    }
    if (normMod === 'staff') {
      const payrollPerm = user.permissions.find(p => p.module === 'payroll');
      if (payrollPerm) return Boolean(payrollPerm[action]);
      return isAdministrator;
    }
  }

  // Fallback based on user role when permissions array is not set
  if (isAdministrator) return true;
  if (roleLower === 'cashier') {
    return normMod === 'pos';
  }
  if (roleLower === 'manager') {
    return normMod !== 'settings';
  }
  if (roleLower === 'accountant') {
    return ['pos', 'normalsale', 'purchase', 'vouchers', 'reports'].includes(normMod);
  }

  return false;
}
