import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { 
  Users, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  Plus, Search, Filter, QrCode, Smartphone, Share2, Copy, Check,
  MessageSquare, Send, Tag, ArrowRight, UserCheck, ShieldAlert,
  ChevronRight, ChevronDown, ChevronUp, RefreshCw, Eye, Edit3, Trash2, Sliders, Briefcase,
  FileSpreadsheet, Award, CalendarCheck, CheckSquare, Bell,
  Wifi, WifiOff, ShieldCheck, MapPin, Globe, Lock, Phone, KeyRound, Fingerprint, Layers, Loader2,
  Download, ExternalLink, Printer, FileText
} from 'lucide-react';
import { 
  getLeaveTypes, saveLeaveTypes, updateLeaveType,
  getLeaveApplications, applyForLeave, reviewLeaveApplication,
  getAttendanceRecords, employeeClockIn, employeeClockOut,
  getTaskAssignments, createTaskAssignment, updateTaskStatus, addTaskComment, editTaskComment,
  generateTaskWhatsAppUrl,
  getDedicatedEmployeePortalUrl, getEmployeePortalQrCodeUrl,
  calculateMonthlyAttendanceSummary, calculateEmployeeLeaveBalance,
  getTodayDateString, DEFAULT_LEAVE_TYPES,
  getOfficeNetworkConfig, saveOfficeNetworkConfig, verifyOfficeNetwork,
  resetEmployeePinToDefault, subscribeToRealtimeTasks,
  getCompanyHolidayPolicy, saveCompanyHolidayPolicy, calculateLeaveDeductionBreakdown
} from '../../services/employeeStaffService';
import { 
  exportMonthlyAttendanceToExcel,
  exportMonthlyAttendanceToPdf,
  exportDailyAttendanceToExcel,
  exportDailyAttendanceToPdf,
  exportLeaveHistoryToExcel,
  exportLeaveHistoryToPdf,
  exportTaskAssignmentsToExcel,
  exportTaskAssignmentsToPdf
} from '../../services/staffReportExportService';
import { 
  LeaveTypeConfig, LeaveApplication, AttendanceRecord, 
  TaskAssignment, TaskPriority, TaskStatus,
  OfficeNetworkSecurityConfig, NetworkVerificationResult,
  CompanyHolidayPolicy
} from '../../types/staffPortal';
import { getEmployees, syncEmployeesFromSupabase } from '../../services/storageService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { Employee, Config } from '../../types';
import { isFeatureAllowed } from '../../services/tenantFeatureService';
import { GlowButton } from '../common/GlowButton';
import { AssignmentReportView } from './AssignmentReportView';
import { HolidayPolicyModal } from './HolidayPolicyModal';
import { formatDateDMY } from '../../utils/dateUtils';
import { DailyAttendanceView, exportDailyAttendanceExcel } from './DailyAttendanceView';
import { MonthlyAttendanceRegisterView, exportMonthlyAttendanceExcel } from './MonthlyAttendanceRegisterView';

export type StaffTab = 
  | 'daily_clock' 
  | 'monthly_register' 
  | 'leaves' 
  | 'tasks' 
  | 'assignment_report' 
  | 'security' 
  | 'portal_qr';

interface StaffManagementViewProps {
  config: Config;
  onDataRefresh?: () => void;
  onNavigateToPayroll?: () => void;
  topOffset?: number;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  config,
  onDataRefresh,
  onNavigateToPayroll,
  topOffset = 0
}) => {
  const isAttendanceAllowed = isFeatureAllowed(config, 'EnableStaffAttendanceAndLeave') && config.EnableStaffAttendanceAndLeave !== 'false';
  const isAssignmentsAllowed = isFeatureAllowed(config, 'EnableStaffAssignments') && config.EnableStaffAssignments !== 'false';

  const initialTab: StaffTab = isAttendanceAllowed ? 'daily_clock' : (isAssignmentsAllowed ? 'tasks' : 'portal_qr');
  const [activeTab, setActiveTab] = useState<StaffTab>(initialTab);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Header measurement for sticky docking
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(54);

  const updateHeaderHeight = useCallback(() => {
    if (headerRef.current) {
      const h = Math.round(headerRef.current.getBoundingClientRect().height);
      if (h > 0) setHeaderHeight(h);
    }
  }, []);

  useLayoutEffect(() => {
    updateHeaderHeight();
    const timer = setTimeout(updateHeaderHeight, 100);
    if (!headerRef.current) return () => clearTimeout(timer);
    const ro = new ResizeObserver(() => updateHeaderHeight());
    ro.observe(headerRef.current);
    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [updateHeaderHeight, activeTab]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    if (isViewDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  // Auto-correct active tab if current tab is disabled by superadmin
  useEffect(() => {
    if (!isAttendanceAllowed && (activeTab === 'daily_clock' || activeTab === 'monthly_register' || activeTab === 'leaves' || activeTab === 'security')) {
      setActiveTab(isAssignmentsAllowed ? 'tasks' : 'portal_qr');
    } else if (!isAssignmentsAllowed && (activeTab === 'tasks' || activeTab === 'assignment_report')) {
      setActiveTab(isAttendanceAllowed ? 'daily_clock' : 'portal_qr');
    }
  }, [isAttendanceAllowed, isAssignmentsAllowed, activeTab]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypesList] = useState<LeaveTypeConfig[]>([]);
  const [leaveApplications, setLeaveApplicationsList] = useState<LeaveApplication[]>([]);
  const [attendanceRecords, setAttendanceRecordsList] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasksList] = useState<TaskAssignment[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [dailyStatusFilter, setDailyStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'>('ALL');

  // Sub-Pills selection states for multi-report pages
  const [leaveSubTab, setLeaveSubTab] = useState<'balances' | 'history' | 'quotas' | 'all'>('balances');
  const [portalSubTab, setPortalSubTab] = useState<'directory' | 'qr_link' | 'security'>('directory');
  const [assignmentReportViewMode, setAssignmentReportViewMode] = useState<'table' | 'workload' | 'insights' | 'kanban'>('table');

  // Header collapsing for full page report view (manual toggle only)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Total sticky offset for table headers below this header
  const stickyTopPx = topOffset + headerHeight;

  // Daily attendance quick stats
  const todayAttendanceRecords = attendanceRecords.filter(r => r.date === selectedDate);
  const dailyPresentCount = todayAttendanceRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const dailyLateCount = todayAttendanceRecords.filter(r => r.status === 'Late').length;
  const dailyLeaveCount = todayAttendanceRecords.filter(r => r.status === 'On-Leave' || r.status === 'Half-Day').length;
  const dailyAbsentCount = Math.max(0, employees.length - dailyPresentCount - dailyLeaveCount);

  // Quick date jump
  const handleQuickDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    setSelectedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  // Pro-Grade Excel & PDF Exports
  const handleExportDailyExcel = () => {
    exportDailyAttendanceToExcel({
      config,
      employees,
      attendanceRecords,
      selectedDate,
      searchQuery,
      statusFilter: dailyStatusFilter
    });
  };

  const handleExportDailyPdf = () => {
    exportDailyAttendanceToPdf({
      config,
      employees,
      attendanceRecords,
      selectedDate,
      searchQuery,
      statusFilter: dailyStatusFilter
    });
  };

  const handleExportMonthlyExcel = () => {
    exportMonthlyAttendanceToExcel({
      config,
      employees,
      selectedYear,
      selectedMonth,
      searchQuery
    });
  };

  const handleExportMonthlyPdf = () => {
    exportMonthlyAttendanceToPdf({
      config,
      employees,
      selectedYear,
      selectedMonth,
      searchQuery
    });
  };

  const handleExportLeaveExcel = () => {
    exportLeaveHistoryToExcel({
      config,
      leaveApplications
    });
  };

  const handleExportLeavePdf = () => {
    exportLeaveHistoryToPdf({
      config,
      leaveApplications
    });
  };

  const handleExportAssignmentExcel = () => {
    exportTaskAssignmentsToExcel({
      config,
      tasks
    });
  };

  const handleExportAssignmentPdf = () => {
    exportTaskAssignmentsToPdf({
      config,
      tasks
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Modal states
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState<TaskAssignment | null>(null);
  const [taskCommentInput, setTaskCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [showLeavePolicyModal, setShowLeavePolicyModal] = useState(false);
  const [showHolidayPolicyModal, setShowHolidayPolicyModal] = useState(false);
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pinResetMsg, setPinResetMsg] = useState<{ id: string; msg: string } | null>(null);

  // New Task Form
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as TaskPriority,
    assignedToEmpId: '',
    dueDate: getTodayDateString(),
    category: 'General' as TaskAssignment['category']
  });

  // Admin New Leave Application Form
  const [adminLeaveForm, setAdminLeaveForm] = useState({
    employeeId: '',
    leaveTypeId: 'annual',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    reason: '',
    isHalfDay: false
  });

  // Office Network Security State
  const [networkConfig, setNetworkConfig] = useState<OfficeNetworkSecurityConfig>(() => getOfficeNetworkConfig());
  const [detectedIp, setDetectedIp] = useState<string>('');
  const [isDetectingIp, setIsDetectingIp] = useState<boolean>(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState<boolean>(false);
  const [securitySavedToast, setSecuritySavedToast] = useState<boolean>(false);
  const [newIpInput, setNewIpInput] = useState<string>('');
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);

  const detectCurrentIp = async () => {
    setIsDetectingIp(true);
    try {
      const res = await fetch('/api/attendance/verify-network');
      if (res.ok) {
        const data = await res.json();
        setDetectedIp(data.clientIp || '');
      }
    } catch (err) {
      console.warn('Network detect error', err);
    } finally {
      setIsDetectingIp(false);
    }
  };

  const handleSaveNetworkConfig = (updated?: OfficeNetworkSecurityConfig) => {
    setIsSavingSecurity(true);
    const targetConfig = updated || networkConfig;
    
    // Automatically include any pending IP entered in the input box
    let finalAllowedIps = [...targetConfig.allowedIps];
    if (newIpInput.trim() && !finalAllowedIps.includes(newIpInput.trim())) {
      finalAllowedIps.push(newIpInput.trim());
      setNewIpInput('');
    }

    const finalConfig: OfficeNetworkSecurityConfig = {
      ...targetConfig,
      allowedIps: finalAllowedIps
    };

    const cId = getActiveCompanyId();
    setNetworkConfig(finalConfig);
    saveOfficeNetworkConfig(finalConfig, cId);

    setTimeout(() => {
      setIsSavingSecurity(false);
      setSecuritySavedToast(true);
      setTimeout(() => setSecuritySavedToast(false), 4000);
    }, 250);
  };

  const handleCaptureOfficeGps = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsCapturingGps(false);
        const updated: OfficeNetworkSecurityConfig = {
          ...networkConfig,
          officeLatitude: Number(pos.coords.latitude.toFixed(6)),
          officeLongitude: Number(pos.coords.longitude.toFixed(6))
        };
        handleSaveNetworkConfig(updated);
      },
      (err) => {
        setIsCapturingGps(false);
        alert(`Failed to capture GPS coordinates: ${err.message}`);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const loadData = () => {
    const cId = getActiveCompanyId();
    const emps = getEmployees(cId).filter(e => e.status === 'Active');
    setEmployees(emps);
    setLeaveTypesList(getLeaveTypes(cId));
    setLeaveApplicationsList(getLeaveApplications(cId));
    setAttendanceRecordsList(getAttendanceRecords(cId));
    setNetworkConfig(getOfficeNetworkConfig(cId));
    const allTasks = getTaskAssignments(cId);
    setTasksList(allTasks);
    if (showTaskDetailModal) {
      const match = allTasks.find(t => t.id === showTaskDetailModal.id);
      if (match) {
        setShowTaskDetailModal(match);
      }
    }
  };

  useEffect(() => {
    loadData();

    const cId = getActiveCompanyId();
    const unsubRealtime = subscribeToRealtimeTasks(cId);

    syncEmployeesFromSupabase(cId).then(remoteEmps => {
      if (remoteEmps && remoteEmps.length > 0) {
        setEmployees(remoteEmps.filter(e => e.status === 'Active'));
      }
    });

    const handleDataUpdate = () => loadData();
    window.addEventListener('deep_pos_employees_updated', handleDataUpdate);
    window.addEventListener('deep_pos_leave_types_updated', handleDataUpdate);
    window.addEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
    window.addEventListener('deep_pos_attendance_updated', handleDataUpdate);
    window.addEventListener('deep_pos_tasks_updated', handleDataUpdate);
    window.addEventListener('deep_pos_network_security_updated', handleDataUpdate);
    window.addEventListener('app:dataLoaded', handleDataUpdate);

    return () => {
      unsubRealtime();
      window.removeEventListener('deep_pos_employees_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_leave_types_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_attendance_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_tasks_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_network_security_updated', handleDataUpdate);
      window.removeEventListener('app:dataLoaded', handleDataUpdate);
    };
  }, []);

  // Super-fast pulse synchronization when task modal or tasks tab is active
  useEffect(() => {
    if (!showTaskDetailModal && activeTab !== 'tasks') return;
    const interval = setInterval(() => {
      const cId = getActiveCompanyId();
      const allTasks = getTaskAssignments(cId);
      setTasksList(allTasks);
      if (showTaskDetailModal) {
        const match = allTasks.find(t => t.id === showTaskDetailModal.id);
        if (match) {
          setShowTaskDetailModal(match);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [showTaskDetailModal?.id, activeTab]);

  // Summary Metrics
  const todayRecords = attendanceRecords.filter(r => r.date === selectedDate);
  const presentCount = todayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const onLeaveCount = todayRecords.filter(r => r.status === 'On-Leave' || r.status === 'Half-Day').length;
  const pendingLeaves = leaveApplications.filter(a => a.status === 'Pending');
  const openTasks = tasks.filter(t => t.status !== 'Completed');

  // Copy Dedicated Staff Portal Link
  const portalUrl = getDedicatedEmployeePortalUrl();
  const qrCodeUrl = getEmployeePortalQrCodeUrl(undefined, 280);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Leave Policy Toggle & Configuration Handler
  const handleToggleLeaveType = (typeId: string, currentEnabled: boolean) => {
    const updated = leaveTypes.map(t => t.id === typeId ? { ...t, enabled: !currentEnabled } : t);
    setLeaveTypesList(updated);
    saveLeaveTypes(updated);
  };

  const handleUpdateLeaveDays = (typeId: string, days: number) => {
    const validDays = Math.max(0, days);
    const updated = leaveTypes.map(t => t.id === typeId ? { ...t, defaultDays: validDays } : t);
    setLeaveTypesList(updated);
    saveLeaveTypes(updated);
  };

  const handleUpdateLeaveTypeConfig = (typeId: string, partial: Partial<LeaveTypeConfig>) => {
    const updated = leaveTypes.map(t => {
      if (t.id === typeId) {
        const next = { ...t, ...partial };
        if (next.allocationMode === 'daily_accrual') {
          const mRate = next.monthlyAccrualRate || 2.5;
          next.dailyAccrualRate = Number((mRate / 30.4167).toFixed(4));
          next.maxAnnualLimit = next.maxAnnualLimit || next.defaultDays || 30;
        }
        return next;
      }
      return t;
    });
    setLeaveTypesList(updated);
    saveLeaveTypes(updated);
  };

  // Handle Leave Review
  const handleReviewLeave = (appId: string, status: 'Approved' | 'Rejected') => {
    reviewLeaveApplication(appId, status, 'Manager / Administrator');
    loadData();
    if (onDataRefresh) onDataRefresh();
  };

  // Handle Create Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim() || !newTaskForm.assignedToEmpId) return;

    const cId = getActiveCompanyId();
    const emp = employees.find(e => e.id === newTaskForm.assignedToEmpId);
    const created = createTaskAssignment({
      title: newTaskForm.title.trim(),
      description: newTaskForm.description.trim(),
      priority: newTaskForm.priority,
      assignedToEmpId: newTaskForm.assignedToEmpId,
      assignedToEmpName: emp ? emp.fullName : 'Staff Member',
      assignedByUserId: 'admin_mgr',
      assignedByName: 'Operations Manager',
      assignedByRole: 'Manager',
      dueDate: newTaskForm.dueDate,
      category: newTaskForm.category
    }, cId);

    // If employee has a contact number, offer immediate WhatsApp notification
    if (emp && emp.contactNo) {
      const waUrl = generateTaskWhatsAppUrl(created, emp.contactNo, config?.CompanyName || (config as any)?.companyName);
      if (confirm(`Task ${created.taskNo} assigned to ${emp.fullName}!\n\nWould you like to send task details & deadline to their WhatsApp now?`)) {
        window.open(waUrl, '_blank');
      }
    }

    setNewTaskForm({
      title: '',
      description: '',
      priority: 'Medium',
      assignedToEmpId: '',
      dueDate: getTodayDateString(),
      category: 'General'
    });
    setShowNewTaskModal(false);
    loadData();
  };

  // Handle Add Comment
  const handleAddComment = () => {
    if (!showTaskDetailModal || !taskCommentInput.trim()) return;
    const cId = getActiveCompanyId();
    addTaskComment(showTaskDetailModal.id, taskCommentInput, {
      id: 'admin_mgr',
      name: 'Manager / GM',
      role: 'Manager'
    }, cId);
    setTaskCommentInput('');
    const updatedTasks = getTaskAssignments(cId);
    setTasksList(updatedTasks);
    const updatedCurrent = updatedTasks.find(t => t.id === showTaskDetailModal.id);
    if (updatedCurrent) setShowTaskDetailModal(updatedCurrent);
  };

  // Handle Save Edit Comment
  const handleSaveEditComment = (commentId: string, newMsg: string) => {
    if (!showTaskDetailModal || !newMsg.trim()) return;
    const cId = getActiveCompanyId();
    const edited = editTaskComment(showTaskDetailModal.id, commentId, newMsg, 'admin_mgr', cId);
    if (edited) {
      setEditingCommentId(null);
      setEditingCommentText('');
      const updatedTasks = getTaskAssignments(cId);
      setTasksList(updatedTasks);
      const updatedCurrent = updatedTasks.find(t => t.id === showTaskDetailModal.id);
      if (updatedCurrent) setShowTaskDetailModal(updatedCurrent);
    }
  };

  // Handle Change Task Status
  const handleUpdateStatus = (taskId: string, newStatus: TaskStatus) => {
    const cId = getActiveCompanyId();
    updateTaskStatus(taskId, newStatus, `Status updated to ${newStatus}`, {
      id: 'admin_mgr',
      name: 'Manager / GM',
      role: 'Manager'
    }, cId);
    const updatedTasks = getTaskAssignments(cId);
    setTasksList(updatedTasks);
    if (showTaskDetailModal && showTaskDetailModal.id === taskId) {
      const updatedCurrent = updatedTasks.find(t => t.id === taskId);
      if (updatedCurrent) setShowTaskDetailModal(updatedCurrent);
    }
  };

  // Admin Apply Leave
  const handleAdminApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminLeaveForm.employeeId || !adminLeaveForm.reason.trim()) return;
    const emp = employees.find(e => e.id === adminLeaveForm.employeeId);
    const lt = leaveTypes.find(t => t.id === adminLeaveForm.leaveTypeId);
    if (!emp || !lt) return;

    const cId = getActiveCompanyId();
    const breakdown = calculateLeaveDeductionBreakdown(
      adminLeaveForm.startDate,
      adminLeaveForm.endDate,
      adminLeaveForm.isHalfDay,
      cId
    );

    applyForLeave({
      employeeId: emp.id,
      employeeCode: emp.empCode,
      employeeName: emp.fullName,
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      startDate: adminLeaveForm.startDate,
      endDate: adminLeaveForm.endDate,
      daysCount: breakdown.effectiveDeductionDays,
      isHalfDay: adminLeaveForm.isHalfDay,
      reason: adminLeaveForm.reason
    }, cId);

    setShowNewLeaveModal(false);
    setAdminLeaveForm({
      employeeId: '',
      leaveTypeId: 'annual',
      startDate: getTodayDateString(),
      endDate: getTodayDateString(),
      reason: '',
      isHalfDay: false
    });
    loadData();
    if (onDataRefresh) onDataRefresh();
  };

  // Reset employee PIN to default 1234
  const handleResetPin = (empId: string, empName: string) => {
    const success = resetEmployeePinToDefault(empId);
    if (success) {
      setEmployees(getEmployees());
      setPinResetMsg({ id: empId, msg: `Security PIN for ${empName} was reset to default: 1234` });
      setTimeout(() => setPinResetMsg(null), 4000);
    }
  };

  const navigationItems = [
    ...(isAttendanceAllowed ? [
      {
        id: 'daily_clock' as const,
        tab: 'daily_clock' as const,
        title: 'Daily Clock In / Out Log',
        shortTitle: 'Daily Clock In/Out',
        subtitle: 'Live shifts, check-in timestamps, working hours & device security',
        icon: Clock,
        category: 'Attendance & Shifts',
      },
      {
        id: 'monthly_register' as const,
        tab: 'monthly_register' as const,
        title: 'Monthly Attendance Register',
        shortTitle: 'Monthly Register',
        subtitle: 'Working days, paid leaves, LOP & salary calculation for payroll',
        icon: CalendarCheck,
        category: 'Attendance & Shifts',
      },
      {
        id: 'leaves' as const,
        tab: 'leaves' as const,
        title: 'Leave Management & Quotas',
        shortTitle: 'Leave Management',
        subtitle: 'Approve staff leaves, manage annual quotas & holiday calendar',
        icon: Calendar,
        badgeCount: pendingLeaves.length,
        category: 'Time Off & Policy',
      }
    ] : []),
    ...(isAssignmentsAllowed ? [
      {
        id: 'tasks' as const,
        tab: 'tasks' as const,
        title: 'Tasks & Assignments',
        shortTitle: 'Tasks & Assignments',
        subtitle: 'Manager Kanban board, assignments & follow-up tracking',
        icon: CheckSquare,
        badgeCount: openTasks.length,
        category: 'Tasks & Operations',
      },
      {
        id: 'assignment_report' as const,
        tab: 'assignment_report' as const,
        title: 'Assignment Report & Analytics',
        shortTitle: 'Assignment Analytics',
        subtitle: 'Detailed employee performance matrix & workload analytics',
        icon: FileSpreadsheet,
        category: 'Tasks & Operations',
      }
    ] : []),
    ...(isAttendanceAllowed ? [
      {
        id: 'security' as const,
        tab: 'security' as const,
        title: 'Office WiFi & Anti-Misuse Security',
        shortTitle: 'Network Security',
        subtitle: 'Restrict mobile check-in to authorized store WiFi IPs & GPS',
        icon: ShieldCheck,
        isActive: networkConfig.requireOfficeNetwork,
        category: 'System & Security',
      }
    ] : []),
    {
      id: 'portal_qr' as const,
      tab: 'portal_qr' as const,
      title: 'Mobile Staff Link & QR Portal',
      shortTitle: 'Mobile Staff Portal',
      subtitle: 'Employee self-service PWA link, QR scan & PIN resets',
      icon: QrCode,
      category: 'System & Security',
    }
  ];

  const currentNav = navigationItems.find(item => item.tab === activeTab) || navigationItems[0];
  const CurrentNavIcon = currentNav?.icon || Clock;

  // Categories for dropdown
  const categories = Array.from(new Set(navigationItems.map(item => item.category)));

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-full text-slate-800">
      {/* Top Banner / Executive Navigation Header (Sticky to Top) */}
      <div 
        ref={headerRef}
        style={{ top: `${topOffset}px` }}
        className="sticky z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 py-2.5 shadow-2xs transition-all duration-200"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Top Left: Executive Dropdown Selector & Moved Report View selector (Green Arrow) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsViewDropdownOpen(prev => !prev)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer group"
                title="Switch Staff & Tasks Views"
              >
                <div className="h-6 w-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <CurrentNavIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold leading-none">
                    Staff & Tasks Menu
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white leading-tight flex items-center gap-1.5">
                    {currentNav?.shortTitle || 'Navigation'}
                    {currentNav?.badgeCount !== undefined && currentNav.badgeCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                        {currentNav.badgeCount}
                      </span>
                    )}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-white transition-transform duration-200 ml-2 ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Categorized Dropdown Menu */}
              {isViewDropdownOpen && (
                <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                    <span>Staff & Tasks Navigation</span>
                    <span className="font-mono text-slate-500">{navigationItems.length} Sections</span>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto py-1">
                    {categories.map(cat => {
                      const catItems = navigationItems.filter(i => i.category === cat);
                      return (
                        <div key={cat} className="mb-2">
                          <div className="px-3.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            {cat}
                          </div>
                          {catItems.map(item => {
                            const Icon = item.icon;
                            const isSelected = activeTab === item.tab;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setActiveTab(item.tab);
                                  setIsViewDropdownOpen(false);
                                }}
                                className={`w-full px-3.5 py-2 text-left flex items-center justify-between text-xs transition cursor-pointer ${
                                  isSelected 
                                    ? 'bg-blue-50/90 text-blue-900 font-bold border-l-3 border-blue-600' 
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-bold leading-tight">{item.title}</div>
                                    <div className="text-[10px] text-slate-400 truncate font-normal leading-tight mt-0.5">{item.subtitle}</div>
                                  </div>
                                </div>
                                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black shrink-0 ml-2">
                                    {item.badgeCount}
                                  </span>
                                )}
                                {item.isActive && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase shrink-0 ml-2">
                                    Active
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* View Mode Selector for Assignment Report (Moved up as indicated by Green Arrow) */}
            {activeTab === 'assignment_report' && (
              <div className="relative shrink-0">
                <select
                  value={assignmentReportViewMode}
                  onChange={e => setAssignmentReportViewMode(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold text-xs sm:text-sm shadow-2xs outline-none cursor-pointer hover:bg-indigo-100 transition"
                  title="Select Report View"
                >
                  <option value="table">📄 Register Table</option>
                  <option value="workload">👥 Staff Workload</option>
                  <option value="insights">📊 Category Insights</option>
                </select>
              </div>
            )}
          </div>

          {/* Dynamic Top-Right Compact Controls (Replaces previously empty yellow space) */}
          <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end flex-1 min-w-0">
            {/* Monthly Attendance Register Controls */}
            {activeTab === 'monthly_register' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>
                        {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'short' })}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="px-2.5 py-1 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>

                <div className="relative w-36 sm:w-48">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Search staff or code..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-7.5 pr-2.5 py-1 bg-slate-100 focus:bg-white rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportMonthlyExcel}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Monthly Attendance Spreadsheet"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Export Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMonthlyPdf}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download PDF Document"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print Monthly Attendance Register"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                {onNavigateToPayroll && (
                  <button
                    type="button"
                    onClick={onNavigateToPayroll}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Open Payroll Register to Process Salaries"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Process in Payroll</span>
                  </button>
                )}
              </>
            )}

            {/* Daily Clock In / Out Log Controls */}
            {activeTab === 'daily_clock' && (
              <>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleQuickDate(-1)}
                    className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
                    title="Previous Day"
                  >
                    ←
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-2 py-0.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                    {formatDateDMY(selectedDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(1)}
                    className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
                    title="Next Day"
                  >
                    →
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    selectedDate === getTodayDateString()
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Refresh Attendance Log"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>

                {/* Status Tabs */}
                <div className="hidden lg:inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
                  {[
                    { id: 'ALL' as const, label: 'All', count: employees.length },
                    { id: 'PRESENT' as const, label: 'Present', count: dailyPresentCount },
                    { id: 'LATE' as const, label: 'Late', count: dailyLateCount },
                    { id: 'LEAVE' as const, label: 'Leave', count: dailyLeaveCount },
                    { id: 'ABSENT' as const, label: 'Absent', count: dailyAbsentCount }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDailyStatusFilter(tab.id)}
                      className={`px-2 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold flex items-center gap-1 ${
                        dailyStatusFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1 py-0.2 rounded text-[10px] font-mono ${
                        dailyStatusFilter === tab.id 
                          ? 'bg-slate-100 text-slate-800' 
                          : 'bg-slate-200/70 text-slate-500'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative w-32 sm:w-40">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-7.5 pr-2.5 py-1 bg-slate-100 focus:bg-white rounded-xl border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportDailyExcel}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export Daily Attendance Log"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDailyPdf}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Daily Attendance PDF"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print Daily Attendance Log"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </>
            )}

            {/* Leave Management & Quotas Controls */}
            {activeTab === 'leaves' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHolidayPolicyModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-900 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Holidays & Offs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLeavePolicyModal(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  <span>Leave Quotas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Record Leave</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLeaveExcel}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Formatted Leave Register"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportLeavePdf}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Leave Register PDF"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print Leave Register"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </>
            )}

            {/* Tasks & Assignments Controls */}
            {activeTab === 'tasks' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('assignment_report')}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Switch to detailed performance analytics report"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Performance Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Assign New Task</span>
                </button>
              </>
            )}

            {/* Assignment Report Controls */}
            {activeTab === 'assignment_report' && (
              <>
                <button
                  type="button"
                  onClick={handleExportAssignmentExcel}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Export filtered tasks to Excel (.xlsx)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAssignmentPdf}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Download Assignment Report PDF"
                >
                  <FileText className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print Report"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Kanban Board</span>
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Refresh Data"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Office WiFi & Network Security Controls */}
            {activeTab === 'security' && (
              <>
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700">Office Network Only:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    networkConfig.requireOfficeNetwork 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {networkConfig.requireOfficeNetwork ? 'Enforced' : 'Off'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSavingSecurity}
                  onClick={() => handleSaveNetworkConfig(networkConfig)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Save Settings</span>
                </button>
              </>
            )}

            {/* Mobile Staff Link & QR Portal Controls */}
            {activeTab === 'portal_qr' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-blue-600" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>

                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Portal</span>
                </a>
              </>
            )}

            {/* Quick Collapse / Expand Panels Toggle for Max Report Area */}
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isHeaderCollapsed 
                  ? 'border-blue-400 bg-blue-50 text-blue-800' 
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
              }`}
              title={isHeaderCollapsed ? "Expand summary and filter panels" : "Collapse panels for full screen report view"}
            >
              {isHeaderCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Expand Panels</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Max Report View</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* VIEW CONTENT AREA */}
      <div className={`max-w-7xl mx-auto w-full flex-1 transition-all duration-300 ${
        isHeaderCollapsed ? 'px-2 sm:px-4 py-1.5' : 'px-4 sm:px-6 py-6'
      }`}>
        {/* ============================================================== */}
        {/* VIEW 1: DAILY CLOCK IN / OUT LOG */}
        {/* ============================================================== */}
        {activeTab === 'daily_clock' && isAttendanceAllowed && (
          <DailyAttendanceView
            config={config}
            employees={employees}
            attendanceRecords={attendanceRecords}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onRefresh={loadData}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={dailyStatusFilter}
            onStatusFilterChange={setDailyStatusFilter}
            hideHeaderToolbar={true}
            isHeaderCollapsed={isHeaderCollapsed}
            onToggleCollapse={() => setIsHeaderCollapsed(prev => !prev)}
            stickyTopPx={stickyTopPx}
          />
        )}

        {/* ============================================================== */}
        {/* VIEW 2: MONTHLY ATTENDANCE REGISTER FOR PAYROLL */}
        {/* ============================================================== */}
        {activeTab === 'monthly_register' && isAttendanceAllowed && (
          <MonthlyAttendanceRegisterView
            config={config}
            employees={employees}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            onNavigateToPayroll={onNavigateToPayroll}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            hideHeaderToolbar={true}
            isHeaderCollapsed={isHeaderCollapsed}
            onToggleCollapse={() => setIsHeaderCollapsed(prev => !prev)}
            stickyTopPx={stickyTopPx}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 2: LEAVE MANAGEMENT & QUOTAS */}
        {/* ============================================================== */}
        {activeTab === 'leaves' && isAttendanceAllowed && (
          <div className="space-y-6">
            {/* PRINT-ONLY EXECUTIVE HEADER */}
            <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-3 text-slate-900 text-center">
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
                {config?.CompanyName || 'Bhutan Retail Enterprise'}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {[
                  config?.Address || config?.CompanyAddress || 'Bhutan',
                  config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
                  config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
                ].filter(Boolean).join('  |  ')}
              </p>
              <h2 className="text-base font-bold text-emerald-800 uppercase tracking-tight mt-2">
                STAFF LEAVE APPLICATIONS & HISTORY REGISTER
              </h2>
            </div>

            {/* Pending Requests Alert Box */}
            {pendingLeaves.length > 0 && (
              <div className={`transition-all duration-300 ease-in-out ${
                isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-96 opacity-100 mb-6'
              }`}>
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>{pendingLeaves.length} Leave Application(s) Awaiting Review</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pendingLeaves.map(app => (
                      <div key={app.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{app.employeeName}</div>
                            <div className="text-[11px] text-slate-500 font-semibold">{app.leaveTypeName} • <span className="font-bold text-blue-600">{app.daysCount} Day(s)</span></div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
                            Pending
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{app.reason}"
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                          <span>Period: {formatDateDMY(app.startDate)} to {formatDateDMY(app.endDate)}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleReviewLeave(app.id, 'Approved')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleReviewLeave(app.id, 'Rejected')}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Pills Bar for Leave Management Reports */}
            <div className={`transition-all duration-300 ease-in-out ${
              isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-16 opacity-100 mb-4'
            }`}>
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/80 w-full sm:w-fit overflow-x-auto print:hidden">
                <button
                  type="button"
                  onClick={() => setLeaveSubTab('balances')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    leaveSubTab === 'balances'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Leave Balances Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeaveSubTab('history')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    leaveSubTab === 'history'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Leave Applications History</span>
                  {leaveApplications.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] font-mono font-bold">
                      {leaveApplications.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setLeaveSubTab('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    leaveSubTab === 'all'
                      ? 'bg-white text-emerald-800 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Full Consolidated View</span>
                </button>
              </div>
            </div>

            {/* Leave Balances Ledger per Employee */}
            {(leaveSubTab === 'balances' || leaveSubTab === 'all') && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <table className="w-full text-left text-xs text-slate-700 border-separate border-spacing-0">
                    <thead className="sticky z-20 shadow-xs bg-white" style={{ top: `${stickyTopPx}px` }}>
                      <tr className="bg-white">
                        <th colSpan={leaveTypes.filter(t => t.enabled).length + 1} className="px-5 py-3 text-left bg-white border-b border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-slate-900 text-sm">Staff Leave Balance Summary ({selectedYear})</h3>
                              {isHeaderCollapsed && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Full Page View
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsHeaderCollapsed(prev => !prev)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title={isHeaderCollapsed ? "Expand page header & controls" : "Collapse page header for full page report view"}
                            >
                              {isHeaderCollapsed ? (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Expand Controls</span>
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Full Page View</span>
                                </>
                              )}
                            </button>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3 bg-slate-50 border-b border-slate-200">Employee</th>
                        {leaveTypes.filter(t => t.enabled).map(t => (
                          <th key={t.id} className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <span>{t.name}</span>
                              {t.allocationMode === 'daily_accrual' ? (
                                <span className="px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[8px] font-bold font-sans">
                                  Daily Accrual ({t.monthlyAccrualRate || 2.5}d/mo)
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal font-sans text-[9px]">(Annual)</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {employees.map(emp => {
                        const balance = calculateEmployeeLeaveBalance(emp.id, selectedYear);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {emp.fullName} <span className="text-[10px] text-slate-400 font-mono">({emp.empCode})</span>
                            </td>
                            {leaveTypes.filter(t => t.enabled).map(t => {
                              const b = balance.balances[t.id];
                              const rem = b ? b.remaining : t.defaultDays;
                              const alloc = b ? b.allocated : t.defaultDays;
                              const isAccrual = t.allocationMode === 'daily_accrual';

                              return (
                                <td key={t.id} className="py-2.5 px-3 font-mono">
                                  <span className="font-bold text-emerald-700">{rem}</span>
                                  <span className="text-slate-400"> / {alloc}d</span>
                                  {isAccrual && (
                                    <span className="ml-1 text-[9px] text-indigo-600 font-sans font-bold">
                                      (Accrued)
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* All Leave History Table */}
            {(leaveSubTab === 'history' || leaveSubTab === 'all') && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <div>
                  <table className="w-full text-left text-xs text-slate-700 border-separate border-spacing-0">
                    <thead className="sticky z-20 shadow-xs bg-white" style={{ top: `${stickyTopPx}px` }}>
                      <tr className="bg-white">
                        <th colSpan={8} className="px-5 py-3 text-left bg-white border-b border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-slate-900 text-sm">Leave History Register</h3>
                              <span className="text-xs text-slate-400 font-mono">{leaveApplications.length} Records</span>
                              {isHeaderCollapsed && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Full Page View
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsHeaderCollapsed(prev => !prev)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title={isHeaderCollapsed ? "Expand page header & controls" : "Collapse page header for full page report view"}
                            >
                              {isHeaderCollapsed ? (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Expand Controls</span>
                                </>
                              ) : (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Full Page View</span>
                                </>
                              )}
                            </button>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Employee</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Leave Type</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Start Date</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">End Date</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Days</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Status</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Reason</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Reviewed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {leaveApplications.map(app => (
                        <tr key={app.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{app.employeeName}</td>
                          <td className="py-2.5 px-4">{app.leaveTypeName}</td>
                          <td className="py-2.5 px-4 font-mono">{formatDateDMY(app.startDate)}</td>
                          <td className="py-2.5 px-4 font-mono">{formatDateDMY(app.endDate)}</td>
                          <td className="py-2.5 px-4 font-bold font-mono">{app.daysCount} d</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                              app.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : app.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">{app.reason}</td>
                          <td className="py-2.5 px-4 text-[11px] text-slate-400">{app.reviewedBy || '-'}</td>
                        </tr>
                      ))}
                      {leaveApplications.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            No leave applications recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TASKS & ASSIGNMENTS (MANAGER / GM NOTE TRACKING) */}
        {/* ============================================================== */}
        {activeTab === 'tasks' && isAssignmentsAllowed && (
          <div className="space-y-6">
            {/* Tasks Grid by Status (Kanban Board) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(['Assigned', 'In Progress', 'Under Review', 'Completed'] as TaskStatus[]).map(statusCol => {
                  const colTasks = tasks.filter(t => t.status === statusCol);
                  const colBadgeColor = 
                    statusCol === 'Assigned' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                    statusCol === 'In Progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    statusCol === 'Under Review' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <div key={statusCol} className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3 flex flex-col space-y-3 min-h-[400px]">
                      <div className="flex items-center justify-between px-1">
                        <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colBadgeColor}`}>
                          {statusCol}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{colTasks.length}</span>
                      </div>

                      <div className="space-y-2.5 flex-1 overflow-y-auto">
                        {colTasks.map(task => {
                          const isOverdue = new Date(task.dueDate).getTime() < new Date().setHours(0,0,0,0) && task.status !== 'Completed';

                          return (
                            <div
                              key={task.id}
                              onClick={() => setShowTaskDetailModal(task)}
                              className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 shadow-2xs hover:shadow-sm transition cursor-pointer space-y-2"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-[10px] font-black font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {task.taskNo}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  task.priority === 'Urgent' ? 'bg-rose-100 text-rose-700' :
                                  task.priority === 'High' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                {task.title}
                              </h4>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3 text-slate-400" />
                                  <span className="font-semibold text-slate-700 truncate max-w-[90px]">{task.assignedToEmpName}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-400'}`}>
                                    {formatDateDMY(task.dueDate)}
                                  </span>
                                  {task.comments.length > 0 && (
                                    <span className="flex items-center text-[10px] text-slate-400 gap-0.5">
                                      <MessageSquare className="h-3 w-3" />
                                      {task.comments.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {colTasks.length === 0 && (
                          <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                            No tasks
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3B: DEDICATED ASSIGNMENT REPORT */}
        {/* ============================================================== */}
         {activeTab === 'assignment_report' && isAssignmentsAllowed && (
          <AssignmentReportView
            config={config}
            employees={employees}
            tasks={tasks}
            onRefreshData={loadData}
            isHeaderCollapsed={isHeaderCollapsed}
            onToggleCollapse={() => setIsHeaderCollapsed(prev => !prev)}
            stickyTopPx={stickyTopPx}
            showHeaderControls={false}
            viewMode={assignmentReportViewMode}
            onViewModeChange={setAssignmentReportViewMode}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 4: OFFICE WIFI & ANTI-MISUSE SECURITY */}
        {/* ============================================================== */}
        {activeTab === 'security' && isAttendanceAllowed && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Success Toast */}
            {securitySavedToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Office Network Security settings have been saved and applied immediately!</span>
              </div>
            )}

            {/* Main Policy Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900">
                        Office Network Attendance Restriction
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        networkConfig.requireOfficeNetwork 
                          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {networkConfig.requireOfficeNetwork ? 'Enforced (Office WiFi Only)' : 'Off (Home & Remote WiFi Allowed)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                      {networkConfig.requireOfficeNetwork
                        ? 'Office WiFi restriction is active: staff must be connected to the official office WiFi router to sign in or clock in.'
                        : 'Office WiFi restriction is turned off: staff can clock in and record daily attendance freely from their home WiFi or mobile network.'}
                    </p>
                  </div>
                </div>

                {/* Primary Enforcement Toggle */}
                <div className="flex items-center gap-3 self-end sm:self-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Enforce Office Network</span>
                  <button
                    type="button"
                    onClick={() => handleSaveNetworkConfig({
                      ...networkConfig,
                      requireOfficeNetwork: !networkConfig.requireOfficeNetwork
                    })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      networkConfig.requireOfficeNetwork ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        networkConfig.requireOfficeNetwork ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Detected Manager Connection / Quick Bind */}
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      Current Connection Detected
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black font-mono text-slate-900">
                        {detectedIp || '127.0.0.1 (Local)'}
                      </span>
                      {isDetectingIp ? (
                        <span className="text-[10px] text-blue-600 animate-pulse font-medium">Detecting...</span>
                      ) : (
                        <button
                          type="button"
                          onClick={detectCurrentIp}
                          className="text-[10px] text-blue-600 hover:text-blue-800 underline font-bold cursor-pointer"
                        >
                          Refresh IP
                        </button>
                      )}
                    </div>
                  </div>

                  {detectedIp && !networkConfig.allowedIps.includes(detectedIp) && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...networkConfig,
                          allowedIps: [...networkConfig.allowedIps, detectedIp]
                        };
                        handleSaveNetworkConfig(updated);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Whitelist Current IP as Office Network</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Configuration Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Office WiFi SSID Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    Office WiFi Name (SSID)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Shown to employees on their phone screen (e.g. <i>"Connect to Panglung_Office_WiFi to clock in"</i>).
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. Panglung_Office_5G or Shop_Router"
                    value={networkConfig.officeWifiSsid || ''}
                    onChange={e => setNetworkConfig({ ...networkConfig, officeWifiSsid: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Auto-allow Local Subnet / Shop Router LAN */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    Auto-Allow Shop WiFi Subnets
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Automatically verifies any mobile phone connected to the store WiFi router (192.168.x.x, 10.x.x.x).
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id="allowLocalLanCheck"
                      checked={networkConfig.allowLocalLan}
                      onChange={e => handleSaveNetworkConfig({ ...networkConfig, allowLocalLan: e.target.checked })}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="allowLocalLanCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Auto-Allow Standard Local WiFi Subnets (Recommended)
                    </label>
                  </div>
                </div>
              </div>

              {/* Specific Allowed IPs / Broadband Static IP */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                      Whitelisted Office Broadband / Static IPs
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add your office broadband public IP or local gateway prefix (e.g. 192.168.1.* or 103.24.50.12).
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter IP or subnet e.g. 192.168.1.* or 202.144.156.2"
                    value={newIpInput}
                    onChange={e => setNewIpInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newIpInput.trim()) {
                        e.preventDefault();
                        if (!networkConfig.allowedIps.includes(newIpInput.trim())) {
                          const updated = {
                            ...networkConfig,
                            allowedIps: [...networkConfig.allowedIps, newIpInput.trim()]
                          };
                          handleSaveNetworkConfig(updated);
                          setNewIpInput('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newIpInput.trim() && !networkConfig.allowedIps.includes(newIpInput.trim())) {
                        const updated = {
                          ...networkConfig,
                          allowedIps: [...networkConfig.allowedIps, newIpInput.trim()]
                        };
                        handleSaveNetworkConfig(updated);
                        setNewIpInput('');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Add IP
                  </button>
                </div>

                {/* Whitelist Tags */}
                {networkConfig.allowedIps.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {networkConfig.allowedIps.map((ip, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono text-xs border border-slate-200"
                      >
                        <span>{ip}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...networkConfig,
                              allowedIps: networkConfig.allowedIps.filter((_, i) => i !== idx)
                            };
                            handleSaveNetworkConfig(updated);
                          }}
                          className="hover:text-rose-600 text-slate-400 cursor-pointer ml-1 font-bold"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic">
                    No specific IP overrides configured. When "Auto-Allow Shop WiFi Subnets" is on, any employee on the store WiFi router is verified automatically.
                  </div>
                )}
              </div>

              {/* Optional Secondary Layer: Office GPS Geofencing */}
              <div className="space-y-4 pt-4 border-t border-slate-100 bg-slate-50/60 p-5 rounded-2xl border border-slate-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Secondary Security: Office GPS Geofence (Optional)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verify that employee is physically within premises coordinates (e.g. within 100 meters).
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">Require GPS</span>
                    <button
                      type="button"
                      onClick={() => handleSaveNetworkConfig({
                        ...networkConfig,
                        requireOfficeGps: !networkConfig.requireOfficeGps
                      })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        networkConfig.requireOfficeGps ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          networkConfig.requireOfficeGps ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {networkConfig.requireOfficeGps && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Office Latitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 27.4728"
                        value={networkConfig.officeLatitude ?? ''}
                        onChange={e => setNetworkConfig({ ...networkConfig, officeLatitude: parseFloat(e.target.value) || undefined })}
                        className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Office Longitude</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 89.6393"
                        value={networkConfig.officeLongitude ?? ''}
                        onChange={e => setNetworkConfig({ ...networkConfig, officeLongitude: parseFloat(e.target.value) || undefined })}
                        className="w-full mt-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 outline-none"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleCaptureOfficeGps}
                        disabled={isCapturingGps}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{isCapturingGps ? 'Capturing...' : 'Capture Current GPS'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Button Bar & Confirmation */}
              <div className="pt-5 border-t border-slate-200/80 space-y-3">
                {securitySavedToast && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Network Security rules have been saved and applied to all mobile attendance requests!</span>
                    </div>
                    <span className="text-[10px] uppercase font-black bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    Settings are stored per company tenant and enforced across all mobile sign-in & sign-out requests.
                  </span>
                  <button
                    type="button"
                    disabled={isSavingSecurity}
                    onClick={() => handleSaveNetworkConfig(networkConfig)}
                    className={`px-6 py-3 rounded-2xl font-black text-xs shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                      securitySavedToast 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-500/20 scale-[1.02]'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white ring-4 ring-blue-500/10'
                    } disabled:opacity-70`}
                  >
                    {isSavingSecurity ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving Settings...</span>
                      </>
                    ) : securitySavedToast ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Settings Saved & Enforced! ✓</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Save Network Security Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: MOBILE STAFF LINK & QR CODE */}
        {/* ============================================================== */}
        {activeTab === 'portal_qr' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Sub-Pills Bar for Mobile Staff Portal */}
            <div className={`transition-all duration-300 ease-in-out ${
              isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-16 opacity-100 mb-4'
            }`}>
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/80 w-full sm:w-fit overflow-x-auto print:hidden">
                <button
                  type="button"
                  onClick={() => setPortalSubTab('directory')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    portalSubTab === 'directory'
                      ? 'bg-white text-indigo-900 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                  <span>PIN & Biometric Directory</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPortalSubTab('qr_link')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    portalSubTab === 'qr_link'
                      ? 'bg-white text-indigo-900 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                  <span>Portal Link & QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPortalSubTab('security')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    portalSubTab === 'security'
                      ? 'bg-white text-indigo-900 shadow-xs font-black'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Security Guidelines</span>
                </button>
              </div>
            </div>

            {/* View 1: QR Code & Link Banner */}
            {(portalSubTab === 'qr_link') && (
              <div className={`transition-all duration-300 ease-in-out ${
                isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-[600px] opacity-100 mb-4'
              }`}>
                <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center gap-6">
                  {/* QR Code Container */}
                  <div className="bg-white p-4 rounded-2xl shadow-md flex flex-col items-center justify-center shrink-0">
                    <img
                      src={qrCodeUrl}
                      alt="Staff Portal QR Code"
                      className="h-44 w-44 rounded-xl object-contain shadow-2xs"
                    />
                    <span className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1">
                      <Smartphone className="h-3 w-3 text-indigo-600" />
                      Scan with Phone Camera
                    </span>
                  </div>

                  {/* Instructions & Link */}
                  <div className="space-y-4 flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase tracking-wider">
                      <Award className="h-3.5 w-3.5 text-blue-400" />
                      <span>100% Mobile Phone Friendly • PWA Installable</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                      Dedicated Employee Mobile Portal
                    </h2>

                    <p className="text-xs text-blue-100/80 leading-relaxed">
                      Employees can scan this QR code or open the link on Android or iPhone to clock in/out, view leave quotas, apply for leave, and manage tasks assigned by Managers/GMs. 
                      Zero exposure to accounting, daybook, or billing records.
                    </p>

                    {/* Direct Link Copier */}
                    <div className="bg-black/30 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={portalUrl}
                        className="bg-transparent text-xs font-mono text-white/90 flex-1 outline-none truncate px-1"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs transition flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>

                    {/* Mobile Features Highlights */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-blue-200">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>1-Tap Clock In / Out</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Real-time Leave Ledger</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Manager Comments</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View 2: Security Guidelines */}
            {(portalSubTab === 'security') && (
              <div className={`transition-all duration-300 ease-in-out ${
                isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-[600px] opacity-100 mb-4'
              }`}>
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                    <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">How Staff Sign In & Mobile Credentials Guide</h3>
                      <p className="text-xs text-slate-500">Fast mobile-number based sign-in with default PIN or Fingerprint</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600">
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                      <p><strong className="text-slate-800">Scan QR Code</strong> or open the portal URL on any Android or iPhone browser.</p>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                      <p><strong className="text-slate-800">Enter Registered Mobile Number:</strong> Staff enter their registered mobile number (no employee code needed).</p>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                      <p><strong className="text-slate-800">Default PIN (1234):</strong> First-time login uses standard default PIN <code className="bg-slate-200 px-1.5 py-0.5 rounded text-blue-800 font-mono font-bold">1234</code>.</p>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">4</span>
                      <p><strong className="text-slate-800">Reset PIN via Admin or OTP:</strong> Admins can reset forgotten PINs back to 1234 in 1 tap from the Directory tab.</p>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-900">
                      <span className="h-6 w-6 rounded-full bg-indigo-200 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">5</span>
                      <p><strong className="text-indigo-950">Biometric Login (WebAuthn):</strong> Staff can register their Fingerprint / Face ID for instant 1-tap sign-in without typing a PIN.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notification message for PIN Reset */}
            {pinResetMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{pinResetMsg.msg}</span>
                </div>
                <button onClick={() => setPinResetMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
              </div>
            )}

            {/* View 3: PIN & Biometric Directory Table */}
            {(portalSubTab === 'directory') && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs">
                <div>
                  <table className="w-full text-left text-xs border-separate border-spacing-0">
                    <thead className="sticky z-20 shadow-xs bg-white" style={{ top: `${stickyTopPx}px` }}>
                      <tr className="bg-white">
                        <th colSpan={5} className="px-5 py-3 text-left bg-white border-b border-slate-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                                <KeyRound className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm text-slate-900">Staff Mobile Credentials & PIN Directory</h3>
                                  {isHeaderCollapsed && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                      Full Page View
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500">Reset forgotten PINs back to 1234 in one tap • View Biometric status</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold text-slate-400">
                                {employees.filter(e => e.status === 'Active').length} Active Staff
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsHeaderCollapsed(prev => !prev)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title={isHeaderCollapsed ? "Expand page header & controls" : "Collapse page header for full page report view"}
                              >
                                {isHeaderCollapsed ? (
                                  <>
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Expand Controls</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Full Page View</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Employee</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Registered Mobile</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">PIN Status</th>
                        <th className="py-2.5 px-4 bg-slate-50 border-b border-slate-200">Biometrics</th>
                        <th className="py-2.5 px-4 text-right bg-slate-50 border-b border-slate-200">Admin Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.filter(e => e.status === 'Active').map(emp => {
                        const isCustom = emp.pin && emp.pin !== '1234';
                        const hasBio = emp.biometricCredentials && emp.biometricCredentials.length > 0;
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2.5 font-medium text-slate-900">
                              <div className="font-bold">{emp.fullName}</div>
                              <div className="text-[10px] text-slate-400">{emp.designation} • {emp.department}</div>
                            </td>
                            <td className="py-2.5 font-mono text-slate-700">
                              {emp.contactNo ? (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  <span>{emp.contactNo}</span>
                                </span>
                              ) : (
                                <span className="text-amber-500 italic text-[11px]">No phone registered</span>
                              )}
                            </td>
                            <td className="py-2.5">
                              {isCustom ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  <Check className="h-2.5 w-2.5" />
                                  <span>Custom PIN</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono">
                                  Default: 1234
                                </span>
                              )}
                            </td>
                            <td className="py-2.5">
                              {hasBio ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                  <Fingerprint className="h-3 w-3" />
                                  <span>Enrolled ({emp.biometricCredentials!.length})</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              {isCustom ? (
                                <button
                                  type="button"
                                  onClick={() => handleResetPin(emp.id, emp.fullName)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-[11px] font-bold transition cursor-pointer"
                                  title="Reset staff PIN to default 1234"
                                >
                                  Reset to 1234
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Ready (1234)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: CONFIGURE LEAVE TYPES & QUOTAS */}
      {/* ============================================================== */}
      {showLeavePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-base">Standard Leave Policies & Quotas</h3>
                <p className="text-xs text-slate-500">Toggle active leave types and specify annual allotted days.</p>
              </div>
              <button
                onClick={() => setShowLeavePolicyModal(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              {leaveTypes.map(t => {
                const isDailyAccrual = t.allocationMode === 'daily_accrual';
                const monthlyRate = t.monthlyAccrualRate || 2.5;

                return (
                  <div key={t.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={t.enabled}
                          onChange={() => handleToggleLeaveType(t.id, t.enabled)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{t.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 font-normal">({t.code})</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{t.description}</p>
                        </div>
                      </div>

                      {/* Mode Toggle: One-Time vs Daily Accrual */}
                      {t.enabled && (
                        <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 self-start sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleUpdateLeaveTypeConfig(t.id, { allocationMode: 'one_time' })}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                              !isDailyAccrual ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            📦 One-Time Lump Sum
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLeaveTypeConfig(t.id, { allocationMode: 'daily_accrual', monthlyAccrualRate: monthlyRate })}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                              isDailyAccrual ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            ⚡ Daily / Monthly Accrual
                          </button>
                        </div>
                      )}
                    </div>

                    {t.enabled && (
                      <div className="pt-2 border-t border-slate-200/70">
                        {!isDailyAccrual ? (
                          <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                            <div>
                              <div className="text-xs font-bold text-slate-800">Annual Allotted Quota</div>
                              <div className="text-[10px] text-slate-500">Credited all at once at the start of the year</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="365"
                                value={t.defaultDays}
                                onChange={e => handleUpdateLeaveDays(t.id, Number(e.target.value))}
                                className="w-16 px-2.5 py-1 text-center font-bold font-mono text-xs rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <span className="text-[11px] font-bold text-slate-500">Days/Yr</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Monthly Accrual Rate (Days/Month)</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    max="31"
                                    value={monthlyRate}
                                    onChange={e => handleUpdateLeaveTypeConfig(t.id, { 
                                      monthlyAccrualRate: Number(e.target.value),
                                      allocationMode: 'daily_accrual'
                                    })}
                                    className="w-20 px-2.5 py-1 text-center font-bold font-mono text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  />
                                  <span className="text-[11px] text-slate-600 font-semibold">days / month</span>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Max Annual Limit</label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={t.maxAnnualLimit || (monthlyRate * 12) || 30}
                                    onChange={e => handleUpdateLeaveTypeConfig(t.id, { 
                                      maxAnnualLimit: Number(e.target.value),
                                      allocationMode: 'daily_accrual'
                                    })}
                                    className="w-20 px-2.5 py-1 text-center font-bold font-mono text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  />
                                  <span className="text-[11px] text-slate-600 font-semibold">days max</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-[10px] text-blue-800 bg-blue-100/60 p-2 rounded-lg flex items-center justify-between">
                              <span>
                                💡 Accrual rate: ~{(monthlyRate / 30.4167).toFixed(4)} days/day. Accumulated continuously day-by-day throughout the year.
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowLeavePolicyModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ASSIGN NEW TASK */}
      {/* ============================================================== */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Assign New Task / Note</h3>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct physical inventory count in Godown 2"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign To Employee *</label>
                <select
                  required
                  value={newTaskForm.assignedToEmpId}
                  onChange={e => setNewTaskForm({ ...newTaskForm, assignedToEmpId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Instructions / Description</label>
                <textarea
                  rows={3}
                  placeholder="Detail out specific requirements, checklists, or reference numbers..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer shadow-sm"
                >
                  Create & Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: TASK DETAIL & 2-WAY COMMENT TRAIL */}
      {/* ============================================================== */}
      {showTaskDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {showTaskDetailModal.taskNo}
                </span>
                <h3 className="font-black text-slate-900 text-base mt-1">{showTaskDetailModal.title}</h3>
                <p className="text-xs text-slate-500">
                  Assigned to <strong className="text-slate-800">{showTaskDetailModal.assignedToEmpName}</strong> • Due <span className="font-mono text-rose-600 font-bold">{formatDateDMY(showTaskDetailModal.dueDate)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowTaskDetailModal(null)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
              {showTaskDetailModal.description || 'No description provided.'}
            </div>

            {/* Status Change Selector & WhatsApp Alert */}
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Current Status:</span>
                <select
                  value={showTaskDetailModal.status}
                  onChange={e => handleUpdateStatus(showTaskDetailModal.id, e.target.value as TaskStatus)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-slate-800 outline-none"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              {(() => {
                const emp = employees.find(e => e.id === showTaskDetailModal.assignedToEmpId);
                const contact = emp?.contactNo;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const waUrl = generateTaskWhatsAppUrl(showTaskDetailModal, contact, config?.CompanyName || (config as any)?.companyName);
                      window.open(waUrl, '_blank');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    title="Send task instructions & deadline to employee's WhatsApp"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>WhatsApp Staff</span>
                  </button>
                );
              })()}
            </div>

            {/* Two-Way Comment Section */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pt-2 border-t border-slate-100 pr-1">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                <span>Discussion & Progress Notes</span>
              </div>

              {showTaskDetailModal.comments.map(c => {
                const editWindowSec = Number(config?.TaskCommentEditWindowSeconds) || 15;
                const ageSec = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 1000);
                const remainingSec = Math.max(0, editWindowSec - ageSec);
                const isAuthor = true; // Managers/Admins can edit notes in this management view
                const isEditing = editingCommentId === c.id;

                return (
                  <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-900">{c.authorName} ({c.authorRole})</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono">
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {c.editedAt ? ' (edited)' : ''}
                        </span>
                        {isAuthor && !isEditing && remainingSec > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.message);
                            }}
                            className="px-2 py-0.5 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold text-[9px] transition cursor-pointer flex items-center gap-1"
                            title={`Edit comment within ${remainingSec}s`}
                          >
                            <Edit3 className="h-2.5 w-2.5" />
                            <span>Edit ({remainingSec}s)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5 pt-1">
                        <textarea
                          rows={2}
                          value={editingCommentText}
                          onChange={e => setEditingCommentText(e.target.value)}
                          onInput={(e) => {
                            const target = e.currentTarget;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
                          }}
                          className="w-full p-2 rounded-xl bg-white border border-indigo-300 text-xs text-slate-900 outline-none whitespace-pre-wrap break-words resize-none overflow-hidden"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentText('');
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditComment(c.id, editingCommentText)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{c.message}</p>
                    )}
                  </div>
                );
              })}

              {showTaskDetailModal.comments.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">No comments yet. Post feedback or instructions below.</p>
              )}
            </div>

            {/* Comment Input with Auto-Expanding Textarea */}
            <div className="flex items-end gap-2 pt-2 border-t border-slate-100">
              <textarea
                rows={1}
                placeholder="Write note or instruction..."
                value={taskCommentInput}
                onChange={e => setTaskCommentInput(e.target.value)}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (taskCommentInput.trim()) {
                      handleAddComment();
                    }
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none whitespace-pre-wrap break-words resize-none overflow-hidden min-h-[32px] max-h-[150px]"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!taskCommentInput.trim()}
                className="px-3.5 py-1.5 h-[32px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer shrink-0 shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: RECORD STAFF LEAVE (ADMIN ENTRY) */}
      {/* ============================================================== */}
      {showNewLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Record Staff Leave</h3>
              <button
                onClick={() => setShowNewLeaveModal(false)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminApplyLeave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee *</label>
                <select
                  required
                  value={adminLeaveForm.employeeId}
                  onChange={e => setAdminLeaveForm({ ...adminLeaveForm, employeeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                >
                  <option value="">Choose Employee...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.empCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Leave Type *</label>
                <select
                  required
                  value={adminLeaveForm.leaveTypeId}
                  onChange={e => setAdminLeaveForm({ ...adminLeaveForm, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                >
                  {leaveTypes.filter(t => t.enabled).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Max {t.defaultDays} d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={adminLeaveForm.startDate}
                    onChange={e => setAdminLeaveForm({ ...adminLeaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={adminLeaveForm.endDate}
                    onChange={e => setAdminLeaveForm({ ...adminLeaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter reason for leave..."
                  value={adminLeaveForm.reason}
                  onChange={e => setAdminLeaveForm({ ...adminLeaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 outline-none"
                />
              </div>

              {/* Real-time Leave Deduction Calculation Badge */}
              {adminLeaveForm.startDate && adminLeaveForm.endDate && (() => {
                const breakdown = calculateLeaveDeductionBreakdown(adminLeaveForm.startDate, adminLeaveForm.endDate, adminLeaveForm.isHalfDay, getActiveCompanyId());
                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>Total Calendar Days:</span>
                      <span className="font-mono font-bold text-slate-900">{breakdown.totalCalendarDays} Day(s)</span>
                    </div>
                    {breakdown.weeklyOffDaysCount > 0 && (
                      <div className="flex items-center justify-between text-emerald-700 font-medium">
                        <span>Weekly Offs Excluded:</span>
                        <span className="font-mono font-bold">-{breakdown.weeklyOffDaysCount} Day(s)</span>
                      </div>
                    )}
                    {breakdown.holidayDaysCount > 0 && (
                      <div className="flex items-start justify-between text-indigo-700 font-medium gap-2">
                        <span className="truncate">Holidays Excluded ({breakdown.holidayDetails.map(h => h.name).join(', ')}):</span>
                        <span className="font-mono font-bold shrink-0">-{breakdown.holidayDaysCount} Day(s)</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-black text-xs text-blue-700">
                      <span>Effective Leave Deduction:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-mono">
                        {breakdown.effectiveDeductionDays} Day(s)
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewLeaveModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer shadow-sm"
                >
                  Record Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: CONFIGURE HOLIDAYS & WEEKLY-OFF POLICY */}
      {/* ============================================================== */}
      <HolidayPolicyModal
        isOpen={showHolidayPolicyModal}
        onClose={() => setShowHolidayPolicyModal(false)}
        onPolicyUpdated={() => loadData()}
      />
    </div>
  );
};
