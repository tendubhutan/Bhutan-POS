export type LeaveAllocationMode = 'one_time' | 'daily_accrual';

export interface LeaveTypeConfig {
  id: string; // 'annual' | 'casual' | 'medical' | 'maternity' | 'paternity' | 'bereavement' | custom string
  name: string;
  code: string; // e.g. AL, CL, ML, etc.
  defaultDays: number;
  enabled: boolean;
  carryForward: boolean;
  color: string;
  description?: string;
  allocationMode?: LeaveAllocationMode; // 'one_time' (annual lump-sum) | 'daily_accrual' (earned on daily/monthly basis)
  monthlyAccrualRate?: number; // e.g. 2.5 days per month
  dailyAccrualRate?: number; // e.g. 0.0822 days per day
  maxAnnualLimit?: number; // annual ceiling limit (e.g. 30 days)
}

export type WeeklyOffMode = 'saturday_sunday' | 'sunday_only' | 'none' | 'custom';

export interface CompanyHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  isRecurringYearly?: boolean;
  isGovernmentHoliday?: boolean;
  enabled: boolean;
  description?: string;
}

export interface CompanyHolidayPolicy {
  weeklyOffMode: WeeklyOffMode; // 'saturday_sunday' | 'sunday_only' | 'none' | 'custom'
  customWeeklyOffDays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  enableGovernmentHolidays: boolean; // whether govt holidays are observed
  holidays: CompanyHoliday[]; // list of active & customizable holidays
  autoExcludeHolidaysFromLeave: boolean; // default: true
  autoExcludeWeeklyOffFromLeave: boolean; // default: true
}

export interface LeaveDeductionBreakdown {
  totalCalendarDays: number;
  weeklyOffDaysCount: number;
  weeklyOffDates: string[];
  holidayDaysCount: number;
  holidayDetails: { date: string; name: string }[];
  effectiveDeductionDays: number;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveApplication {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  isHalfDay?: boolean;
  halfDaySession?: 'morning' | 'afternoon';
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface EmployeeLeaveBalance {
  employeeId: string;
  year: number;
  balances: {
    [leaveTypeId: string]: {
      allocated: number;
      used: number;
      pending: number;
      remaining: number;
      allocationMode?: LeaveAllocationMode;
      monthlyAccrualRate?: number;
      dailyAccrualRate?: number;
      daysElapsedInYear?: number;
      fullYearQuota?: number;
    };
  };
}

export type AttendanceStatus = 'Present' | 'Late' | 'Half-Day' | 'Absent' | 'On-Leave' | 'Weekly-Off' | 'Holiday';

export interface AttendanceRecord {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  checkInTerminal?: string;
  checkInNote?: string;
  checkOutNote?: string;
  hoursWorked?: number;
  status: AttendanceStatus;
  leaveApplicationId?: string;
  source: 'mobile_pwa' | 'pos_terminal' | 'manual_admin';
  networkIp?: string;
  networkVerified?: boolean;
  networkDetails?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
}

export interface OfficeNetworkSecurityConfig {
  requireOfficeNetwork: boolean;       // Restricts check in/out strictly to office network (default: true)
  officeWifiSsid?: string;             // Office WiFi name for display (e.g. Panglung_Office)
  allowedIps: string[];                // Whitelisted office IP prefixes or broadband static IP
  allowLocalLan: boolean;              // Auto-allow devices on same local LAN subnet (192.168.*, 10.*, 172.16-31.*)
  requireOfficeGps: boolean;           // Optional GPS Geofencing (requires employee within office coordinates)
  officeLatitude?: number;
  officeLongitude?: number;
  officeRadiusMeters?: number;         // Allowed radius in meters (e.g. 50m)
  allowAdminBypass?: boolean;          // Allows managers to log manually if needed
}

export interface NetworkVerificationResult {
  allowed: boolean;
  isOfficeNetwork: boolean;
  clientIp?: string;
  networkType?: 'lan' | 'broadband' | 'external' | 'cellular';
  wifiHint?: string;
  reason?: string;
  gpsVerified?: boolean;
  distanceMeters?: number;
}

export interface TaskAssignmentComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'Manager' | 'GM' | 'Admin' | 'Employee';
  message: string;
  createdAt: string;
}

export type TaskPriority = 'Urgent' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Assigned' | 'In Progress' | 'Under Review' | 'Completed' | 'Deferred';

export interface TaskAssignment {
  id: string;
  companyId?: string;
  taskNo: string; // e.g. TSK-001
  title: string;
  description: string;
  priority: TaskPriority;
  assignedToEmpId: string;
  assignedToEmpName: string;
  assignedByUserId: string;
  assignedByName: string;
  assignedByRole: string; // 'Manager' | 'GM' | 'Admin'
  startDate?: string;
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
  completedAt?: string;
  comments: TaskAssignmentComment[];
  category?: 'General' | 'POS Counter' | 'Stock & Inventory' | 'Accounts' | 'Customer Followup' | 'Administration';
  createdAt: string;
  updatedAt?: string;
}

export interface MonthlyAttendanceSummary {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  year: number;
  month: number;
  monthTotalDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  totalWorkingDays: number;
  lossOfPayDays: number;
  effectiveWorkingDays: number;
}

export interface StaffInAppNotification {
  id: string;
  companyId: string;
  employeeId: string;
  type: 'task_assigned' | 'task_comment' | 'task_status' | 'leave_status' | 'general';
  title: string;
  message: string;
  taskId?: string;
  linkTab?: 'tasks' | 'leaves' | 'clock' | 'profile';
  createdAt: string;
  read: boolean;
  priority?: 'Urgent' | 'High' | 'Medium' | 'Low';
}
