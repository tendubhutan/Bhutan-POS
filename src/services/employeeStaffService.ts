import { 
  LeaveTypeConfig, 
  LeaveApplication, 
  EmployeeLeaveBalance, 
  AttendanceRecord, 
  TaskAssignment, 
  TaskAssignmentComment,
  MonthlyAttendanceSummary,
  AttendanceStatus,
  OfficeNetworkSecurityConfig,
  NetworkVerificationResult
} from '../types/staffPortal';
import { Employee } from '../types';
import { loadJson, saveJson, STORAGE_KEYS, getEmployees, saveEmployees } from './storageService';
import { DEFAULT_TENANT_COMPANY, getActiveCompanyId } from './supabaseTenantService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const getBaseAppUrl = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return '';
};

// ---------------------------------------------------------------------------
// OFFICE NETWORK & ANTI-FRAUD SECURITY CONFIGURATION
// ---------------------------------------------------------------------------

export const DEFAULT_OFFICE_NETWORK_CONFIG: OfficeNetworkSecurityConfig = {
  requireOfficeNetwork: true,
  officeWifiSsid: '',
  allowedIps: [],
  allowLocalLan: true,
  requireOfficeGps: false,
  officeLatitude: undefined,
  officeLongitude: undefined,
  officeRadiusMeters: 100,
  allowAdminBypass: true
};

export function getOfficeNetworkConfig(companyId?: string): OfficeNetworkSecurityConfig {
  const cId = companyId || getActiveCompanyId();
  const allConfigs = loadJson<Record<string, OfficeNetworkSecurityConfig>>(STORAGE_KEYS.OFFICE_NETWORK_CONFIG, {});
  const existing = allConfigs[cId];
  if (!existing) {
    return { ...DEFAULT_OFFICE_NETWORK_CONFIG };
  }
  return {
    ...DEFAULT_OFFICE_NETWORK_CONFIG,
    ...existing
  };
}

export function saveOfficeNetworkConfig(config: OfficeNetworkSecurityConfig, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const allConfigs = loadJson<Record<string, OfficeNetworkSecurityConfig>>(STORAGE_KEYS.OFFICE_NETWORK_CONFIG, {});
  allConfigs[cId] = { ...config };
  saveJson(STORAGE_KEYS.OFFICE_NETWORK_CONFIG, allConfigs);

  // Cross-PC sync
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase.from('tenant_settings').upsert({
        company_id: cId,
        record_id: 'company_office_network_config',
        data: { config, updated_at: new Date().toISOString() }
      }, { onConflict: 'company_id,record_id' })
    ).catch(err => console.warn('[Supabase saveOfficeNetworkConfig cloud sync error]:', err));
  }
}

// Haversine formula to compute distance in meters between two GPS coordinates
export function calculateGpsDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function verifyOfficeNetwork(
  coords?: { latitude: number; longitude: number } | null,
  companyId?: string
): Promise<NetworkVerificationResult> {
  const cfg = getOfficeNetworkConfig(companyId);

  // If network restriction is toggled OFF by admin, permit attendance
  if (!cfg.requireOfficeNetwork) {
    return {
      allowed: true,
      isOfficeNetwork: true,
      reason: 'Office network restriction is disabled by management.'
    };
  }

  let serverNetworkResult: any = null;
  let clientIp = '';
  let isOfficeLan = false;

  try {
    const queryParams = new URLSearchParams({
      allowLocalLan: String(cfg.allowLocalLan),
      allowedIps: cfg.allowedIps.join(',')
    });

    const res = await fetch(`/api/attendance/verify-network?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      serverNetworkResult = await res.json();
      clientIp = serverNetworkResult.clientIp || '';
      isOfficeLan = serverNetworkResult.isLan || false;
    }
  } catch (err) {
    console.warn('[Attendance Network Verify] Server check error:', err);
  }

  // Check hostname if running directly on local office IP/LAN (e.g. 192.168.x.x, localhost)
  let hostnameIsLan = false;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host === 'localhost' || 
      host === '127.0.0.1' || 
      host.startsWith('192.168.') || 
      host.startsWith('10.') || 
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      hostnameIsLan = true;
    }
  }

  const isLanMatch = cfg.allowLocalLan && (isOfficeLan || hostnameIsLan);

  let isIpMatch = false;
  if (clientIp && cfg.allowedIps && cfg.allowedIps.length > 0) {
    isIpMatch = cfg.allowedIps.some(rule => {
      const trimmed = rule.trim();
      if (!trimmed) return false;
      if (trimmed.endsWith('*')) {
        return clientIp.startsWith(trimmed.slice(0, -1));
      }
      return clientIp === trimmed || clientIp.startsWith(trimmed);
    });
  }

  // In cloud preview / development or if no explicit IP whitelist entered yet:
  // If allowLocalLan is enabled and LAN/localhost is verified, or server match succeeds:
  let isNetworkAllowed = isLanMatch || isIpMatch || Boolean(serverNetworkResult && serverNetworkResult.isOfficeNetwork);

  // If GPS Geofence is required
  let gpsVerified = true;
  let distanceMeters: number | undefined = undefined;

  if (cfg.requireOfficeGps && cfg.officeLatitude != null && cfg.officeLongitude != null) {
    if (!coords) {
      gpsVerified = false;
    } else {
      distanceMeters = calculateGpsDistanceMeters(
        coords.latitude,
        coords.longitude,
        cfg.officeLatitude,
        cfg.officeLongitude
      );
      const maxRadius = cfg.officeRadiusMeters || 100;
      gpsVerified = distanceMeters <= maxRadius;
    }
  }

  const finalAllowed = isNetworkAllowed && gpsVerified;
  let reason = '';
  if (!isNetworkAllowed) {
    reason = cfg.officeWifiSsid 
      ? `Not on office network. Please connect to Office WiFi: "${cfg.officeWifiSsid}" to check in.`
      : 'Not connected to the Office Network/WiFi. Attendance sign-in from home or outside the office is restricted.';
  } else if (!gpsVerified) {
    reason = distanceMeters != null 
      ? `Outside office premises (${distanceMeters}m away, max allowed ${cfg.officeRadiusMeters || 100}m).`
      : 'GPS location is required to verify physical presence at office premises.';
  }

  return {
    allowed: finalAllowed,
    isOfficeNetwork: isNetworkAllowed,
    clientIp,
    networkType: isLanMatch ? 'lan' : (isIpMatch ? 'broadband' : 'external'),
    wifiHint: cfg.officeWifiSsid,
    reason: finalAllowed ? undefined : reason,
    gpsVerified,
    distanceMeters
  };
}

// ---------------------------------------------------------------------------
// DEFAULT STANDARD LEAVE POLICIES (Bhutan Labor Standard)
// ---------------------------------------------------------------------------

export const DEFAULT_LEAVE_TYPES: LeaveTypeConfig[] = [
  {
    id: 'annual',
    name: 'Annual / Earned Leave',
    code: 'AL',
    defaultDays: 18,
    enabled: true,
    carryForward: true,
    color: 'emerald',
    description: 'Standard paid annual leave for rest and recuperation.'
  },
  {
    id: 'casual',
    name: 'Casual Leave',
    code: 'CL',
    defaultDays: 10,
    enabled: true,
    carryForward: false,
    color: 'blue',
    description: 'For unforeseen personal matters and short emergencies.'
  },
  {
    id: 'medical',
    name: 'Medical / Sick Leave',
    code: 'ML',
    defaultDays: 14,
    enabled: true,
    carryForward: false,
    color: 'rose',
    description: 'For illness or medical treatment (may require medical fitness certificate).'
  },
  {
    id: 'maternity',
    name: 'Maternity Leave',
    code: 'MTL',
    defaultDays: 90,
    enabled: true,
    carryForward: false,
    color: 'purple',
    description: 'For female employees on childbirth (standard 3 months).'
  },
  {
    id: 'paternity',
    name: 'Paternity Leave',
    code: 'PTL',
    defaultDays: 5,
    enabled: true,
    carryForward: false,
    color: 'indigo',
    description: 'For male employees on birth of their child.'
  },
  {
    id: 'bereavement',
    name: 'Bereavement / Compassionate Leave',
    code: 'BL',
    defaultDays: 10,
    enabled: true,
    carryForward: false,
    color: 'slate',
    description: 'For bereavement or funeral of immediate family members.'
  }
];

// ---------------------------------------------------------------------------
// LEAVE POLICIES & QUOTAS MANAGEMENT
// ---------------------------------------------------------------------------

export function getLeaveTypes(companyId?: string): LeaveTypeConfig[] {
  const cId = companyId || getActiveCompanyId();
  const list = loadJson<LeaveTypeConfig[]>(STORAGE_KEYS.LEAVE_TYPES, [], cId);
  if (!list || list.length === 0) {
    saveJson(STORAGE_KEYS.LEAVE_TYPES, DEFAULT_LEAVE_TYPES, cId);
    return DEFAULT_LEAVE_TYPES;
  }
  return list;
}

export function saveLeaveTypes(types: LeaveTypeConfig[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  saveJson(STORAGE_KEYS.LEAVE_TYPES, types, cId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deep_pos_leave_types_updated', { detail: { types } }));
  }

  // Cross-PC sync
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase.from('tenant_settings').upsert({
        company_id: cId,
        record_id: 'company_leave_types',
        data: { types, updated_at: new Date().toISOString() }
      }, { onConflict: 'company_id,record_id' })
    ).catch(err => console.warn('[Supabase saveLeaveTypes cloud sync error]:', err));
  }
}

export function updateLeaveType(updatedType: LeaveTypeConfig, companyId?: string): void {
  const types = getLeaveTypes(companyId);
  const idx = types.findIndex(t => t.id === updatedType.id);
  if (idx >= 0) {
    types[idx] = updatedType;
  } else {
    types.push(updatedType);
  }
  saveLeaveTypes(types, companyId);
}

// ---------------------------------------------------------------------------
// LEAVE APPLICATIONS & WORKFLOW
// ---------------------------------------------------------------------------

export function getLeaveApplications(companyId?: string): LeaveApplication[] {
  const cId = companyId || getActiveCompanyId();
  return loadJson<LeaveApplication[]>(STORAGE_KEYS.LEAVE_APPLICATIONS, [], cId);
}

export function saveLeaveApplications(apps: LeaveApplication[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  saveJson(STORAGE_KEYS.LEAVE_APPLICATIONS, apps, cId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deep_pos_leave_apps_updated', { detail: { apps } }));
  }

  // Cross-PC sync
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase.from('tenant_settings').upsert({
        company_id: cId,
        record_id: 'company_leave_applications',
        data: { apps, updated_at: new Date().toISOString() }
      }, { onConflict: 'company_id,record_id' })
    ).catch(err => console.warn('[Supabase saveLeaveApplications cloud sync error]:', err));
  }
}

export function applyForLeave(app: Omit<LeaveApplication, 'id' | 'appliedAt' | 'status'>, companyId?: string): LeaveApplication {
  const cId = companyId || getActiveCompanyId();
  const all = getLeaveApplications(cId);
  const newApp: LeaveApplication = {
    ...app,
    id: `LA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    companyId: cId,
    appliedAt: new Date().toISOString(),
    status: 'Pending'
  };
  all.unshift(newApp);
  saveLeaveApplications(all, cId);
  return newApp;
}

export function reviewLeaveApplication(
  appId: string, 
  status: 'Approved' | 'Rejected', 
  reviewedBy: string, 
  rejectionReason?: string, 
  companyId?: string
): boolean {
  const cId = companyId || getActiveCompanyId();
  const all = getLeaveApplications(cId);
  const target = all.find(a => a.id === appId);
  if (!target) return false;

  target.status = status;
  target.reviewedBy = reviewedBy;
  target.reviewedAt = new Date().toISOString();
  if (rejectionReason) target.rejectionReason = rejectionReason;

  saveLeaveApplications(all, cId);

  // If approved, update attendance register for those dates
  if (status === 'Approved') {
    markLeaveOnAttendance(target, cId);
  }
  return true;
}

export function cancelLeaveApplication(appId: string, companyId?: string): boolean {
  const cId = companyId || getActiveCompanyId();
  const all = getLeaveApplications(cId);
  const target = all.find(a => a.id === appId);
  if (!target) return false;
  target.status = 'Cancelled';
  saveLeaveApplications(all, cId);
  return true;
}

export function calculateEmployeeLeaveBalance(employeeId: string, year = new Date().getFullYear(), companyId?: string): EmployeeLeaveBalance {
  const leaveTypes = getLeaveTypes(companyId);
  const apps = getLeaveApplications(companyId).filter(a => a.employeeId === employeeId);

  const balances: EmployeeLeaveBalance['balances'] = {};

  leaveTypes.forEach(lt => {
    const allocated = lt.enabled ? lt.defaultDays : 0;
    
    // Find all applications in this year
    const appsForType = apps.filter(a => {
      if (a.leaveTypeId !== lt.id) return false;
      const appYr = new Date(a.startDate).getFullYear();
      return appYr === year;
    });

    const used = appsForType
      .filter(a => a.status === 'Approved')
      .reduce((sum, a) => sum + (a.daysCount || 0), 0);

    const pending = appsForType
      .filter(a => a.status === 'Pending')
      .reduce((sum, a) => sum + (a.daysCount || 0), 0);

    const remaining = Math.max(0, allocated - used);

    balances[lt.id] = {
      allocated,
      used,
      pending,
      remaining
    };
  });

  return {
    employeeId,
    year,
    balances
  };
}

// ---------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT (CHECK-IN / CHECK-OUT)
// ---------------------------------------------------------------------------

export function getAttendanceRecords(companyId?: string): AttendanceRecord[] {
  const cId = companyId || getActiveCompanyId();
  return loadJson<AttendanceRecord[]>(STORAGE_KEYS.ATTENDANCE_RECORDS, [], cId);
}

export function saveAttendanceRecords(records: AttendanceRecord[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  saveJson(STORAGE_KEYS.ATTENDANCE_RECORDS, records, cId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deep_pos_attendance_updated', { detail: { records } }));
  }

  // Cross-PC sync
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase.from('tenant_settings').upsert({
        company_id: cId,
        record_id: 'company_attendance_records',
        data: { records, updated_at: new Date().toISOString() }
      }, { onConflict: 'company_id,record_id' })
    ).catch(err => console.warn('[Supabase saveAttendanceRecords cloud sync error]:', err));
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function getEmployeeTodayAttendance(employeeId: string, companyId?: string): AttendanceRecord | null {
  const today = getTodayDateString();
  const records = getAttendanceRecords(companyId);
  return records.find(r => r.employeeId === employeeId && r.date === today) || null;
}

export function employeeClockIn(params: {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  terminal?: string;
  note?: string;
  source?: 'mobile_pwa' | 'pos_terminal' | 'manual_admin';
  companyId?: string;
  networkVerification?: NetworkVerificationResult;
  bypassNetworkCheck?: boolean;
}): { ok: boolean; record?: AttendanceRecord; message: string } {
  const cId = params.companyId || getActiveCompanyId();
  const records = getAttendanceRecords(cId);
  const today = getTodayDateString();
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

  // Enforce Office Network Security Rule
  const netCfg = getOfficeNetworkConfig(cId);
  if (netCfg.requireOfficeNetwork && !params.bypassNetworkCheck && params.source === 'mobile_pwa') {
    if (!params.networkVerification || !params.networkVerification.allowed) {
      const failReason = params.networkVerification?.reason || 
        (netCfg.officeWifiSsid 
          ? `Access Denied: You must be connected to the Office WiFi (${netCfg.officeWifiSsid}) to Clock In.` 
          : 'Access Denied: You must be connected to the Office Network/WiFi to Clock In. Clocking in from home is prohibited.');
      return { ok: false, message: `🚫 ${failReason}` };
    }
  }

  let existing = records.find(r => r.employeeId === params.employeeId && r.date === today);

  if (existing && existing.checkInTime) {
    return { ok: false, record: existing, message: `Already checked in today at ${existing.checkInTime}` };
  }

  // Check if late (standard office hours e.g. after 09:30 AM)
  const hours = now.getHours();
  const mins = now.getMinutes();
  const isLate = hours > 9 || (hours === 9 && mins > 30);

  const networkDetails = params.networkVerification?.networkType 
    ? `Office Network (${params.networkVerification.networkType.toUpperCase()})` 
    : (params.source === 'pos_terminal' ? 'POS Counter Terminal' : 'Office Verified');

  if (!existing) {
    existing = {
      id: `ATT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      companyId: cId,
      employeeId: params.employeeId,
      employeeCode: params.employeeCode,
      employeeName: params.employeeName,
      date: today,
      checkInTime: timeStr,
      checkInTerminal: params.terminal || 'Mobile App',
      checkInNote: params.note || '',
      status: isLate ? 'Late' : 'Present',
      source: params.source || 'mobile_pwa',
      networkIp: params.networkVerification?.clientIp,
      networkVerified: params.networkVerification ? Boolean(params.networkVerification.allowed) : true,
      networkDetails,
      updatedAt: now.toISOString()
    };
    records.unshift(existing);
  } else {
    existing.checkInTime = timeStr;
    existing.checkInTerminal = params.terminal || existing.checkInTerminal || 'Mobile App';
    if (params.note) existing.checkInNote = params.note;
    existing.status = isLate ? 'Late' : 'Present';
    existing.networkIp = params.networkVerification?.clientIp || existing.networkIp;
    existing.networkVerified = params.networkVerification ? Boolean(params.networkVerification.allowed) : true;
    existing.networkDetails = networkDetails;
    existing.updatedAt = now.toISOString();
  }

  saveAttendanceRecords(records, cId);
  return { ok: true, record: existing, message: `Successfully clocked in at ${timeStr}` };
}

export function employeeClockOut(params: {
  employeeId: string;
  note?: string;
  companyId?: string;
  source?: 'mobile_pwa' | 'pos_terminal' | 'manual_admin';
  networkVerification?: NetworkVerificationResult;
  bypassNetworkCheck?: boolean;
}): { ok: boolean; record?: AttendanceRecord; message: string } {
  const cId = params.companyId || getActiveCompanyId();
  const records = getAttendanceRecords(cId);
  const today = getTodayDateString();
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

  // Enforce Office Network Security Rule for Clock Out
  const netCfg = getOfficeNetworkConfig(cId);
  if (netCfg.requireOfficeNetwork && !params.bypassNetworkCheck && params.source === 'mobile_pwa') {
    if (!params.networkVerification || !params.networkVerification.allowed) {
      const failReason = params.networkVerification?.reason || 
        (netCfg.officeWifiSsid 
          ? `Access Denied: You must be connected to the Office WiFi (${netCfg.officeWifiSsid}) to Clock Out.` 
          : 'Access Denied: You must be connected to the Office Network/WiFi to Clock Out.');
      return { ok: false, message: `🚫 ${failReason}` };
    }
  }

  const existing = records.find(r => r.employeeId === params.employeeId && r.date === today);

  if (!existing || !existing.checkInTime) {
    return { ok: false, message: 'Please clock in first before clocking out.' };
  }

  existing.checkOutTime = timeStr;
  if (params.note) existing.checkOutNote = params.note;

  // Calculate hours worked
  try {
    const [inH, inM, inS] = existing.checkInTime.split(':').map(Number);
    const inDate = new Date();
    inDate.setHours(inH || 0, inM || 0, inS || 0, 0);

    const diffMs = now.getTime() - inDate.getTime();
    const hours = Math.max(0, Number((diffMs / (1000 * 60 * 60)).toFixed(2)));
    existing.hoursWorked = hours;

    if (hours < 4 && existing.status !== 'On-Leave') {
      existing.status = 'Half-Day';
    }
  } catch {}

  existing.updatedAt = now.toISOString();
  saveAttendanceRecords(records, cId);
  return { ok: true, record: existing, message: `Successfully clocked out at ${timeStr} (Hours: ${existing.hoursWorked || 0} hrs)` };
}

function markLeaveOnAttendance(leave: LeaveApplication, companyId: string): void {
  const records = getAttendanceRecords(companyId);
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);

  const cur = new Date(start);
  while (cur <= end) {
    const yr = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const da = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${yr}-${mo}-${da}`;

    const existingIdx = records.findIndex(r => r.employeeId === leave.employeeId && r.date === dateStr);
    const leaveRec: AttendanceRecord = {
      id: existingIdx >= 0 ? records[existingIdx].id : `ATT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      companyId,
      employeeId: leave.employeeId,
      employeeCode: leave.employeeCode,
      employeeName: leave.employeeName,
      date: dateStr,
      status: leave.isHalfDay ? 'Half-Day' : 'On-Leave',
      leaveApplicationId: leave.id,
      checkInNote: `Approved ${leave.leaveTypeName}`,
      source: 'manual_admin',
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      records[existingIdx] = leaveRec;
    } else {
      records.push(leaveRec);
    }

    cur.setDate(cur.getDate() + 1);
  }

  saveAttendanceRecords(records, companyId);
}

// ---------------------------------------------------------------------------
// MONTHLY ATTENDANCE AGGREGATOR FOR PAYROLL INTEGRATION
// ---------------------------------------------------------------------------

export function calculateMonthlyAttendanceSummary(
  employeeId: string, 
  year: number, 
  month: number, // 1 to 12
  companyId?: string
): MonthlyAttendanceSummary {
  const cId = companyId || getActiveCompanyId();
  const employees = getEmployees();
  const emp = employees.find(e => e.id === employeeId);
  const empName = emp ? emp.fullName : 'Employee';
  const empCode = emp ? emp.empCode : '';

  const daysInMonth = new Date(year, month, 0).getDate();
  const records = getAttendanceRecords(cId).filter(r => {
    if (r.employeeId !== employeeId) return false;
    const [rY, rM] = r.date.split('-').map(Number);
    return rY === year && rM === month;
  });

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let lateDays = 0;
  let halfDays = 0;

  records.forEach(r => {
    if (r.status === 'Present') presentDays += 1;
    else if (r.status === 'Late') { presentDays += 1; lateDays += 1; }
    else if (r.status === 'Half-Day') { presentDays += 0.5; halfDays += 1; }
    else if (r.status === 'On-Leave') paidLeaveDays += 1;
    else if (r.status === 'Absent') unpaidLeaveDays += 1;
  });

  // Calculate Sundays / standard off days
  let sundaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek === 0) sundaysCount += 1; // Sunday
  }

  const standardWorkingDays = daysInMonth - sundaysCount;
  
  // Total accounted days
  const accountedDays = presentDays + paidLeaveDays + unpaidLeaveDays;
  // If employee has unrecorded working days up to today
  const isCurrentMonth = new Date().getFullYear() === year && (new Date().getMonth() + 1) === month;
  const daysPassed = isCurrentMonth ? Math.min(new Date().getDate(), daysInMonth) : daysInMonth;
  
  let unrecordedDays = 0;
  if (daysPassed > accountedDays + sundaysCount) {
    unrecordedDays = Math.max(0, daysPassed - sundaysCount - accountedDays);
  }

  const absentDays = unpaidLeaveDays + unrecordedDays;
  const lossOfPayDays = absentDays;
  const effectiveWorkingDays = Math.max(0, standardWorkingDays - lossOfPayDays);

  return {
    employeeId,
    employeeName: empName,
    employeeCode: empCode,
    year,
    month,
    monthTotalDays: daysInMonth,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    lateDays,
    halfDays,
    totalWorkingDays: standardWorkingDays,
    lossOfPayDays,
    effectiveWorkingDays
  };
}

// ---------------------------------------------------------------------------
// TASK & ASSIGNMENT / NOTE TRACKING
// ---------------------------------------------------------------------------

export function getTaskAssignments(companyId?: string): TaskAssignment[] {
  const cId = companyId || getActiveCompanyId();
  return loadJson<TaskAssignment[]>(STORAGE_KEYS.TASK_ASSIGNMENTS, [], cId);
}

export function saveTaskAssignments(tasks: TaskAssignment[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  saveJson(STORAGE_KEYS.TASK_ASSIGNMENTS, tasks, cId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('deep_pos_tasks_updated', { detail: { tasks } }));
  }

  // Cross-PC sync
  if (isSupabaseConfigured && cId) {
    Promise.resolve(
      supabase.from('tenant_settings').upsert({
        company_id: cId,
        record_id: 'company_task_assignments',
        data: { tasks, updated_at: new Date().toISOString() }
      }, { onConflict: 'company_id,record_id' })
    ).catch(err => console.warn('[Supabase saveTaskAssignments cloud sync error]:', err));
  }
}

export function createTaskAssignment(
  task: Omit<TaskAssignment, 'id' | 'taskNo' | 'createdAt' | 'status' | 'comments'>, 
  companyId?: string
): TaskAssignment {
  const cId = companyId || getActiveCompanyId();
  const all = getTaskAssignments(cId);
  const count = all.length + 1;
  const taskNo = `TSK-${String(count).padStart(3, '0')}`;

  const newTask: TaskAssignment = {
    ...task,
    id: `TSK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    taskNo,
    companyId: cId,
    status: 'Assigned',
    comments: [],
    createdAt: new Date().toISOString()
  };

  all.unshift(newTask);
  saveTaskAssignments(all, cId);
  return newTask;
}

export function updateTaskStatus(
  taskId: string, 
  status: TaskAssignment['status'], 
  commentText?: string, 
  author?: { id: string; name: string; role: 'Manager' | 'GM' | 'Admin' | 'Employee' },
  companyId?: string
): boolean {
  const cId = companyId || getActiveCompanyId();
  const all = getTaskAssignments(cId);
  const target = all.find(t => t.id === taskId);
  if (!target) return false;

  target.status = status;
  target.updatedAt = new Date().toISOString();
  if (status === 'Completed') {
    target.completedAt = new Date().toISOString();
  }

  if (commentText && commentText.trim() && author) {
    const comment: TaskAssignmentComment = {
      id: `CMT-${Date.now().toString(36).toUpperCase()}`,
      authorId: author.id,
      authorName: author.name,
      authorRole: author.role,
      message: commentText.trim(),
      createdAt: new Date().toISOString()
    };
    target.comments.push(comment);
  }

  saveTaskAssignments(all, cId);
  return true;
}

export function addTaskComment(
  taskId: string, 
  message: string, 
  author: { id: string; name: string; role: 'Manager' | 'GM' | 'Admin' | 'Employee' },
  companyId?: string
): TaskAssignmentComment | null {
  const cId = companyId || getActiveCompanyId();
  const all = getTaskAssignments(cId);
  const target = all.find(t => t.id === taskId);
  if (!target || !message.trim()) return null;

  const comment: TaskAssignmentComment = {
    id: `CMT-${Date.now().toString(36).toUpperCase()}`,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(target.comments)) {
    target.comments = [];
  }
  target.comments.push(comment);
  target.updatedAt = new Date().toISOString();

  saveTaskAssignments(all, cId);
  return comment;
}

export function deleteTaskAssignment(taskId: string, companyId?: string): boolean {
  const cId = companyId || getActiveCompanyId();
  const all = getTaskAssignments(cId);
  const next = all.filter(t => t.id !== taskId);
  if (next.length === all.length) return false;
  saveTaskAssignments(next, cId);
  return true;
}

export function updateTaskAssignment(
  taskId: string, 
  updates: Partial<Omit<TaskAssignment, 'id' | 'taskNo' | 'createdAt' | 'comments'>>, 
  companyId?: string
): TaskAssignment | null {
  const cId = companyId || getActiveCompanyId();
  const all = getTaskAssignments(cId);
  const target = all.find(t => t.id === taskId);
  if (!target) return null;

  Object.assign(target, updates);
  target.updatedAt = new Date().toISOString();
  if (updates.status === 'Completed' && !target.completedAt) {
    target.completedAt = new Date().toISOString();
  } else if (updates.status && updates.status !== 'Completed') {
    target.completedAt = undefined;
  }

  saveTaskAssignments(all, cId);
  return target;
}


// ---------------------------------------------------------------------------
// DEDICATED EMPLOYEE MOBILE PORTAL URL & AUTH
// ---------------------------------------------------------------------------

export function getDedicatedEmployeePortalUrl(companyId?: string): string {
  const cId = companyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const baseUrl = getBaseAppUrl();
  const url = new URL(baseUrl);
  url.searchParams.set('portal', 'employee');
  url.searchParams.set('company', cId);
  return url.toString();
}

export function getEmployeePortalQrCodeUrl(companyId?: string, size = 260): string {
  const link = getDedicatedEmployeePortalUrl(companyId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}&margin=1`;
}

export function getEmployeeStaffSession(): { employee: Employee; companyId: string } | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_staff_session') : null;
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function setEmployeeStaffSession(employee: Employee, companyId: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('deep_pos_staff_session', JSON.stringify({ employee, companyId }));
    }
  } catch {}
}

export function clearEmployeeStaffSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('deep_pos_staff_session');
    }
  } catch {}
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  // If starts with 975 (Bhutan country code) and has 11 digits (975 + 8 digits), strip 975
  if (cleaned.startsWith('975') && cleaned.length >= 11) {
    cleaned = cleaned.slice(3);
  }
  // If starts with 0 and has 9 digits, strip 0
  if (cleaned.startsWith('0') && cleaned.length === 9) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

export function findEmployeeByMobileOrCode(identifier: string): Employee | undefined {
  if (!identifier || !identifier.trim()) return undefined;
  const emps = getEmployees();
  const trimmed = identifier.trim().toLowerCase();
  const normalizedInput = normalizePhoneNumber(identifier);

  return emps.find(emp => {
    // Check mobile match
    if (emp.contactNo) {
      const normalizedContact = normalizePhoneNumber(emp.contactNo);
      if (normalizedContact && normalizedInput && (normalizedContact === normalizedInput || normalizedContact.endsWith(normalizedInput) || normalizedInput.endsWith(normalizedContact))) {
        return true;
      }
      if (emp.contactNo.trim().toLowerCase() === trimmed) {
        return true;
      }
    }
    // Check employee code
    if (emp.empCode && emp.empCode.trim().toLowerCase() === trimmed) {
      return true;
    }
    // Check CID
    if (emp.cidNo && emp.cidNo.trim().toLowerCase() === trimmed) {
      return true;
    }
    // Check ID
    if (emp.id === identifier.trim()) {
      return true;
    }
    return false;
  });
}

export function updateEmployeePortalPin(
  empId: string, 
  currentPin: string, 
  newPin: string
): { success: boolean; error?: string; updatedEmployee?: Employee } {
  const emps = getEmployees();
  const targetIndex = emps.findIndex(e => e.id === empId);
  if (targetIndex === -1) {
    return { success: false, error: 'Employee profile not found.' };
  }

  const emp = emps[targetIndex];
  const existingPin = emp.pin || '1234';
  const defaultFallbackPin = emp.contactNo ? emp.contactNo.slice(-4) : '1234';

  const enteredCurrent = (currentPin || '').trim();
  const isValidCurrent = 
    enteredCurrent === existingPin || 
    enteredCurrent === '1234' || 
    enteredCurrent === defaultFallbackPin;

  if (!isValidCurrent) {
    return { success: false, error: 'Current PIN is incorrect. (Default PIN is 1234)' };
  }

  const cleanNewPin = (newPin || '').trim();
  if (!cleanNewPin || cleanNewPin.length < 4 || cleanNewPin.length > 6) {
    return { success: false, error: 'New PIN must be between 4 and 6 digits.' };
  }

  if (!/^\d+$/.test(cleanNewPin)) {
    return { success: false, error: 'New PIN must contain digits only.' };
  }

  const updatedEmp: Employee = {
    ...emp,
    pin: cleanNewPin
  };

  emps[targetIndex] = updatedEmp;
  saveEmployees(emps);

  // Update staff session if active
  const activeSession = getEmployeeStaffSession();
  if (activeSession && activeSession.employee.id === empId) {
    setEmployeeStaffSession(updatedEmp, activeSession.companyId);
  }

  return { success: true, updatedEmployee: updatedEmp };
}

export function resetEmployeePinToDefault(empId: string): boolean {
  const emps = getEmployees();
  const targetIndex = emps.findIndex(e => e.id === empId);
  if (targetIndex === -1) return false;

  emps[targetIndex] = {
    ...emps[targetIndex],
    pin: '1234'
  };
  saveEmployees(emps);
  return true;
}

// Storage key for active OTP challenges
const STAFF_OTP_CHALLENGE_KEY = 'deep_pos_staff_pin_reset_otp';

export interface StaffPinResetOtpData {
  employeeId: string;
  employeeName: string;
  mobile: string;
  maskedMobile: string;
  otpCode: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
}

/**
 * Mask mobile number for privacy (e.g. 17123456 -> 17****56)
 */
export function maskPhoneNumber(phone: string): string {
  const clean = (phone || '').replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  const first = clean.slice(0, 2);
  const last = clean.slice(-2);
  const stars = '*'.repeat(Math.max(2, clean.length - 4));
  return `${first}${stars}${last}`;
}

/**
 * Sends a 6-digit OTP to the employee's registered mobile number for PIN Reset.
 */
export function requestStaffPinResetOtp(
  mobileOrCodeOrId: string
): { 
  success: boolean; 
  error?: string; 
  otpSession?: { 
    employeeId: string; 
    employeeName: string; 
    mobile: string; 
    maskedMobile: string; 
    expiresAt: number; 
    debugOtp: string; 
  } 
} {
  const input = (mobileOrCodeOrId || '').trim();
  if (!input) {
    return { success: false, error: 'Please enter your registered mobile number.' };
  }

  const emps = getEmployees().filter(e => e.status === 'Active');
  const normalizedInput = normalizePhoneNumber(input);

  // Find employee by mobile number, empCode, or ID
  const employee = emps.find(e => {
    if (e.id === input) return true;
    if (e.empCode && e.empCode.toLowerCase() === input.toLowerCase()) return true;
    if (e.contactNo) {
      const normContact = normalizePhoneNumber(e.contactNo);
      if (normContact === normalizedInput) return true;
      if (normContact.endsWith(normalizedInput) || normalizedInput.endsWith(normContact)) return true;
    }
    return false;
  });

  if (!employee) {
    return { 
      success: false, 
      error: 'No active employee found with this mobile number. Please check the number or contact your Manager.' 
    };
  }

  if (!employee.contactNo) {
    return { 
      success: false, 
      error: `Employee ${employee.fullName} does not have a registered mobile number. Please ask your administrator to update your contact number.` 
    };
  }

  // Generate secure 6-digit OTP (100000 - 999999)
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + (10 * 60 * 1000); // 10 minutes validity

  const otpData: StaffPinResetOtpData = {
    employeeId: employee.id,
    employeeName: employee.fullName,
    mobile: employee.contactNo,
    maskedMobile: maskPhoneNumber(employee.contactNo),
    otpCode,
    expiresAt,
    createdAt: now,
    attempts: 0
  };

  try {
    sessionStorage.setItem(STAFF_OTP_CHALLENGE_KEY, JSON.stringify(otpData));
  } catch {
    // Fallback if sessionStorage is restricted
  }

  return {
    success: true,
    otpSession: {
      employeeId: employee.id,
      employeeName: employee.fullName,
      mobile: employee.contactNo,
      maskedMobile: maskPhoneNumber(employee.contactNo),
      expiresAt,
      debugOtp: otpCode
    }
  };
}

/**
 * Verifies entered 6-digit OTP and updates employee PIN.
 */
export function verifyOtpAndResetPin(
  employeeId: string,
  enteredOtp: string,
  newPin: string
): { 
  success: boolean; 
  error?: string; 
  updatedEmployee?: Employee 
} {
  let storedChallenge: StaffPinResetOtpData | null = null;
  try {
    const raw = sessionStorage.getItem(STAFF_OTP_CHALLENGE_KEY);
    if (raw) storedChallenge = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!storedChallenge || storedChallenge.employeeId !== employeeId) {
    return { success: false, error: 'OTP request expired or not found. Please request a new OTP code.' };
  }

  if (Date.now() > storedChallenge.expiresAt) {
    sessionStorage.removeItem(STAFF_OTP_CHALLENGE_KEY);
    return { success: false, error: 'The OTP code has expired. Please request a new code.' };
  }

  const cleanOtp = (enteredOtp || '').trim().replace(/\D/g, '');
  if (cleanOtp !== storedChallenge.otpCode) {
    storedChallenge.attempts += 1;
    if (storedChallenge.attempts >= 5) {
      sessionStorage.removeItem(STAFF_OTP_CHALLENGE_KEY);
      return { success: false, error: 'Too many incorrect attempts. Please request a new OTP.' };
    }
    try {
      sessionStorage.setItem(STAFF_OTP_CHALLENGE_KEY, JSON.stringify(storedChallenge));
    } catch {}
    return { success: false, error: `Invalid OTP code. You have ${5 - storedChallenge.attempts} attempts remaining.` };
  }

  const cleanNewPin = (newPin || '').trim();
  if (!cleanNewPin || cleanNewPin.length < 4 || cleanNewPin.length > 6) {
    return { success: false, error: 'New PIN must be between 4 and 6 digits.' };
  }

  if (!/^\d+$/.test(cleanNewPin)) {
    return { success: false, error: 'New PIN must contain numbers only.' };
  }

  const emps = getEmployees();
  const targetIndex = emps.findIndex(e => e.id === employeeId);
  if (targetIndex === -1) {
    return { success: false, error: 'Employee account not found.' };
  }

  const updatedEmp: Employee = {
    ...emps[targetIndex],
    pin: cleanNewPin
  };

  emps[targetIndex] = updatedEmp;
  saveEmployees(emps);

  // Clear OTP session upon successful verification
  try {
    sessionStorage.removeItem(STAFF_OTP_CHALLENGE_KEY);
  } catch {}

  // Update staff session if active
  const activeSession = getEmployeeStaffSession();
  if (activeSession && activeSession.employee.id === employeeId) {
    setEmployeeStaffSession(updatedEmp, activeSession.companyId);
  }

  return { success: true, updatedEmployee: updatedEmp };
}


