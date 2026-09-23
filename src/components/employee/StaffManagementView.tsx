import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, 
  Plus, Search, Filter, QrCode, Smartphone, Share2, Copy, Check,
  MessageSquare, Send, Tag, ArrowRight, UserCheck, ShieldAlert,
  ChevronRight, RefreshCw, Eye, Edit3, Trash2, Sliders, Briefcase,
  FileSpreadsheet, Award, CalendarCheck, CheckSquare, Bell,
  Wifi, WifiOff, ShieldCheck, MapPin, Globe, Lock
} from 'lucide-react';
import { 
  getLeaveTypes, saveLeaveTypes, updateLeaveType,
  getLeaveApplications, applyForLeave, reviewLeaveApplication,
  getAttendanceRecords, employeeClockIn, employeeClockOut,
  getTaskAssignments, createTaskAssignment, updateTaskStatus, addTaskComment,
  getDedicatedEmployeePortalUrl, getEmployeePortalQrCodeUrl,
  calculateMonthlyAttendanceSummary, calculateEmployeeLeaveBalance,
  getTodayDateString, DEFAULT_LEAVE_TYPES,
  getOfficeNetworkConfig, saveOfficeNetworkConfig, verifyOfficeNetwork
} from '../../services/employeeStaffService';
import { 
  LeaveTypeConfig, LeaveApplication, AttendanceRecord, 
  TaskAssignment, TaskPriority, TaskStatus,
  OfficeNetworkSecurityConfig, NetworkVerificationResult
} from '../../types/staffPortal';
import { getEmployees } from '../../services/storageService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { Employee, Config } from '../../types';
import { GlowButton } from '../common/GlowButton';

interface StaffManagementViewProps {
  config: Config;
  onDataRefresh?: () => void;
  onNavigateToPayroll?: () => void;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({
  config,
  onDataRefresh,
  onNavigateToPayroll
}) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'tasks' | 'security' | 'portal_qr'>('attendance');
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

  // Modal states
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState<TaskAssignment | null>(null);
  const [taskCommentInput, setTaskCommentInput] = useState('');
  const [showLeavePolicyModal, setShowLeavePolicyModal] = useState(false);
  const [showNewLeaveModal, setShowNewLeaveModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  const handleSaveNetworkConfig = (updated: OfficeNetworkSecurityConfig) => {
    setNetworkConfig(updated);
    saveOfficeNetworkConfig(updated);
    setSecuritySavedToast(true);
    setTimeout(() => setSecuritySavedToast(false), 3000);
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
    const emps = getEmployees().filter(e => e.status === 'Active');
    setEmployees(emps);
    setLeaveTypesList(getLeaveTypes());
    setLeaveApplicationsList(getLeaveApplications());
    setAttendanceRecordsList(getAttendanceRecords());
    setTasksList(getTaskAssignments());
  };

  useEffect(() => {
    loadData();

    const handleDataUpdate = () => loadData();
    window.addEventListener('deep_pos_leave_types_updated', handleDataUpdate);
    window.addEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
    window.addEventListener('deep_pos_attendance_updated', handleDataUpdate);
    window.addEventListener('deep_pos_tasks_updated', handleDataUpdate);

    return () => {
      window.removeEventListener('deep_pos_leave_types_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_attendance_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_tasks_updated', handleDataUpdate);
    };
  }, []);

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

  // Leave Policy Toggle & Day Edit Handler
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

    const emp = employees.find(e => e.id === newTaskForm.assignedToEmpId);
    createTaskAssignment({
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
    });

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
    addTaskComment(showTaskDetailModal.id, taskCommentInput, {
      id: 'admin_mgr',
      name: 'Manager / GM',
      role: 'Manager'
    });
    setTaskCommentInput('');
    const updatedTasks = getTaskAssignments();
    setTasksList(updatedTasks);
    const updatedCurrent = updatedTasks.find(t => t.id === showTaskDetailModal.id);
    if (updatedCurrent) setShowTaskDetailModal(updatedCurrent);
  };

  // Handle Change Task Status
  const handleUpdateStatus = (taskId: string, newStatus: TaskStatus) => {
    updateTaskStatus(taskId, newStatus, `Status updated to ${newStatus}`, {
      id: 'admin_mgr',
      name: 'Manager / GM',
      role: 'Manager'
    });
    const updatedTasks = getTaskAssignments();
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

    const start = new Date(adminLeaveForm.startDate);
    const end = new Date(adminLeaveForm.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = adminLeaveForm.isHalfDay ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    applyForLeave({
      employeeId: emp.id,
      employeeCode: emp.empCode,
      employeeName: emp.fullName,
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      startDate: adminLeaveForm.startDate,
      endDate: adminLeaveForm.endDate,
      daysCount: days,
      isHalfDay: adminLeaveForm.isHalfDay,
      reason: adminLeaveForm.reason
    });

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
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen text-slate-800">
      {/* Top Banner / Metrics Overview */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black tracking-wide uppercase border border-blue-200">
                Staff Operations Hub
              </span>
              <span className="text-xs text-slate-400 font-mono">Live Sync</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
              <span>Attendance, Leaves & Assignments</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time employee check-in/out, standard leave balances, manager task tracking & mobile portal.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('portal_qr')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="h-4 w-4" />
              <span>Mobile Staff Link & QR</span>
            </button>

            {onNavigateToPayroll && (
              <button
                onClick={onNavigateToPayroll}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                <span>Go to Payroll Register</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Staff</div>
              <div className="text-lg font-black text-slate-900">{employees.length}</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Present Today</div>
              <div className="text-lg font-black text-emerald-700">{presentCount} <span className="text-xs text-slate-400 font-normal">/ {employees.length}</span></div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</div>
              <div className="text-lg font-black text-amber-700">{pendingLeaves.length}</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Open Tasks</div>
              <div className="text-lg font-black text-indigo-700">{openTasks.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'attendance'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Attendance Register</span>
          </button>

          <button
            onClick={() => setActiveTab('leaves')}
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer relative ${
              activeTab === 'leaves'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarCheck className="h-4 w-4" />
            <span>Leave Management & Quotas</span>
            {pendingLeaves.length > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingLeaves.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            <span>Tasks & Assignments</span>
            {openTasks.length > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                {openTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('security');
              detectCurrentIp();
            }}
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Office WiFi & Anti-Misuse Security</span>
            {networkConfig.requireOfficeNetwork && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                Active
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('portal_qr')}
            className={`px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'portal_qr'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Mobile Staff Link & QR</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {/* ============================================================== */}
        {/* TAB 1: ATTENDANCE REGISTER */}
        {/* ============================================================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">View Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="mt-0.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Quick Jump</label>
                  <button
                    onClick={() => setSelectedDate(getTodayDateString())}
                    className="mt-0.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="relative flex-1 sm:w-60">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Daily Clock In / Out Log - {selectedDate}</h3>
                  <p className="text-xs text-slate-500">Auto-recorded from Employee Mobile App & POS Terminals.</p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {employees.length} Staff Total
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4">Check In</th>
                      <th className="py-3 px-4">Check Out</th>
                      <th className="py-3 px-4">Hours</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Network / Security</th>
                      <th className="py-3 px-4">Device / Terminal</th>
                      <th className="py-3 px-4">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {employees
                      .filter(e => e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || e.empCode.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(emp => {
                        const rec = todayRecords.find(r => r.employeeId === emp.id);
                        const isPresent = rec && (rec.status === 'Present' || rec.status === 'Late');
                        const isLeave = rec && rec.status === 'On-Leave';
                        const isHalf = rec && rec.status === 'Half-Day';

                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
                                {emp.fullName.charAt(0)}
                              </div>
                              <div>
                                <div>{emp.fullName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{emp.empCode}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">{emp.designation}</td>
                            <td className="py-3 px-4">
                              {rec?.checkInTime ? (
                                <span className="font-mono font-bold text-slate-900">{rec.checkInTime}</span>
                              ) : (
                                <span className="text-slate-400 italic">Not clocked in</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {rec?.checkOutTime ? (
                                <span className="font-mono font-bold text-slate-900">{rec.checkOutTime}</span>
                              ) : (
                                <span className="text-slate-400 italic">{rec?.checkInTime ? 'Active shift' : '-'}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold">
                              {rec?.hoursWorked !== undefined ? `${rec.hoursWorked} hrs` : '-'}
                            </td>
                            <td className="py-3 px-4">
                              {isPresent ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                                   {rec?.status}
                                </span>
                              ) : isLeave ? (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200">
                                  On Approved Leave
                                </span>
                              ) : isHalf ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-200">
                                  Half Day
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black border border-slate-200">
                                  Absent / Off
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {rec?.networkVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 whitespace-nowrap">
                                  <Wifi className="h-3 w-3 text-emerald-600" />
                                  <span>{rec.networkDetails || 'Office WiFi'}</span>
                                  {rec.networkIp && <span className="opacity-75 font-mono text-[9px]">[{rec.networkIp}]</span>}
                                </span>
                              ) : rec?.checkInTime ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200 whitespace-nowrap">
                                  <span>{rec.checkInTerminal || rec.source || 'Local Terminal'}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                              {rec?.checkInTerminal || rec?.source || '-'}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                              {rec?.checkInNote || rec?.checkOutNote || '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Attendance Register Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Monthly Attendance Register for Payroll</h3>
                  <p className="text-xs text-slate-500">Working days, leaves, and Loss of Pay (LOP) calculations for salary disbursal.</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>
                        {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Month Days</th>
                      <th className="py-2.5 px-3">Standard Work Days</th>
                      <th className="py-2.5 px-3 text-emerald-700">Present Days</th>
                      <th className="py-2.5 px-3 text-purple-700">Paid Leave</th>
                      <th className="py-2.5 px-3 text-rose-700">Loss of Pay (LOP)</th>
                      <th className="py-2.5 px-3 text-blue-700">Net Payable Work Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {employees.map(emp => {
                      const summary = calculateMonthlyAttendanceSummary(emp.id, selectedYear, selectedMonth);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {emp.fullName} <span className="text-[10px] text-slate-400 font-mono">({emp.empCode})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{summary.monthTotalDays}</td>
                          <td className="py-2.5 px-3 font-mono">{summary.totalWorkingDays}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{summary.presentDays}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-purple-700">{summary.paidLeaveDays}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-700">{summary.lossOfPayDays}</td>
                          <td className="py-2.5 px-3 font-mono font-black text-blue-700">{summary.effectiveWorkingDays}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: LEAVE MANAGEMENT & QUOTAS */}
        {/* ============================================================== */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            {/* Top Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Leave Applications & Approvals</h3>
                <p className="text-xs text-slate-500">Review staff leave requests and customize standard company leave quotas.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLeavePolicyModal(true)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  <span>Configure Leave Types & Days</span>
                </button>

                <button
                  onClick={() => setShowNewLeaveModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Record Staff Leave</span>
                </button>
              </div>
            </div>

            {/* Pending Requests Alert Box */}
            {pendingLeaves.length > 0 && (
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
                        <span>Period: {app.startDate} to {app.endDate}</span>
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
            )}

            {/* Leave Balances Ledger per Employee */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <h3 className="font-black text-slate-900 text-sm">Staff Leave Balance Summary ({selectedYear})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Employee</th>
                      {leaveTypes.filter(t => t.enabled).map(t => (
                        <th key={t.id} className="py-2.5 px-3">{t.name} (Rem / Allot)</th>
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
                            return (
                              <td key={t.id} className="py-2.5 px-3 font-mono">
                                <span className="font-bold text-emerald-700">{b ? b.remaining : t.defaultDays}</span>
                                <span className="text-slate-400"> / {t.defaultDays} d</span>
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

            {/* All Leave History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm">Leave History Register</h3>
                <span className="text-xs text-slate-400 font-mono">{leaveApplications.length} Records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Employee</th>
                      <th className="py-2.5 px-4">Leave Type</th>
                      <th className="py-2.5 px-4">Start Date</th>
                      <th className="py-2.5 px-4">End Date</th>
                      <th className="py-2.5 px-4">Days</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Reason</th>
                      <th className="py-2.5 px-4">Reviewed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {leaveApplications.map(app => (
                      <tr key={app.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{app.employeeName}</td>
                        <td className="py-2.5 px-4">{app.leaveTypeName}</td>
                        <td className="py-2.5 px-4 font-mono">{app.startDate}</td>
                        <td className="py-2.5 px-4 font-mono">{app.endDate}</td>
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
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: TASKS & ASSIGNMENTS (MANAGER / GM NOTE TRACKING) */}
        {/* ============================================================== */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* Header / New Task Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <h3 className="font-black text-slate-900 text-sm">Manager & GM Task/Assignment Board</h3>
                <p className="text-xs text-slate-500">Assign operations, stock audits, and POS follow-ups to employees with 2-way comments.</p>
              </div>

              <button
                onClick={() => setShowNewTaskModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Assign New Task</span>
              </button>
            </div>

            {/* Tasks Grid by Status */}
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
                                  {task.dueDate}
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
        {/* TAB 4: OFFICE WIFI & ANTI-MISUSE SECURITY */}
        {/* ============================================================== */}
        {activeTab === 'security' && (
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
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        networkConfig.requireOfficeNetwork 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {networkConfig.requireOfficeNetwork ? 'Enforced' : 'Off'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                      Prevent staff from misusing attendance by clocking in from home, while traveling, or outside the shop. Only staff connected to the official office WiFi network can sign in or sign out.
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

              {/* Save Button Bar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Settings are stored per company tenant and enforced across all mobile sign-in requests.
                </span>
                <button
                  type="button"
                  onClick={() => handleSaveNetworkConfig(networkConfig)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Save Network Security Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: MOBILE STAFF LINK & QR CODE */}
        {/* ============================================================== */}
        {activeTab === 'portal_qr' && (
          <div className="max-w-4xl mx-auto space-y-6">
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

            <div className="space-y-3">
              {leaveTypes.map(t => (
                <div key={t.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={() => handleToggleLeaveType(t.id, t.enabled)}
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <span>{t.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">({t.code})</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{t.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">Annual Days:</label>
                    <input
                      type="number"
                      disabled={!t.enabled}
                      value={t.defaultDays}
                      onChange={e => handleUpdateLeaveDays(t.id, Number(e.target.value))}
                      className="w-16 px-2.5 py-1 text-center font-bold font-mono text-xs rounded-lg border border-slate-300 disabled:bg-slate-100 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              ))}
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
                  Assigned to <strong className="text-slate-800">{showTaskDetailModal.assignedToEmpName}</strong> • Due <span className="font-mono text-rose-600 font-bold">{showTaskDetailModal.dueDate}</span>
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

            {/* Status Change Selector */}
            <div className="flex items-center gap-2 text-xs">
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

            {/* Two-Way Comment Section */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pt-2 border-t border-slate-100 pr-1">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                <span>Discussion & Progress Notes</span>
              </div>

              {showTaskDetailModal.comments.map(c => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-900">{c.authorName} ({c.authorRole})</span>
                    <span className="text-slate-400 font-mono">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-700 leading-snug">{c.message}</p>
                </div>
              ))}

              {showTaskDetailModal.comments.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">No comments yet. Post feedback or instructions below.</p>
              )}
            </div>

            {/* Comment Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Write note or instruction..."
                value={taskCommentInput}
                onChange={e => setTaskCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={handleAddComment}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
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
    </div>
  );
};
