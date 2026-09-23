import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, CheckSquare, User, Smartphone, LogOut, 
  Send, MessageSquare, Plus, Check, X, AlertCircle, ChevronRight,
  Coffee, ShieldCheck, ArrowRight, Sparkles, Download, CheckCircle2,
  CalendarCheck, Timer, Briefcase, Award, Info, Wifi, WifiOff, RefreshCw, MapPin, Lock
} from 'lucide-react';
import { 
  getEmployees, saveEmployees 
} from '../../services/storageService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { getCompanyConfig, isFeatureAllowed } from '../../services/tenantFeatureService';
import { 
  getLeaveTypes, getLeaveApplications, applyForLeave, 
  calculateEmployeeLeaveBalance, getTodayDateString,
  getAttendanceRecords, employeeClockIn, employeeClockOut,
  getEmployeeTodayAttendance, getTaskAssignments, updateTaskStatus,
  addTaskComment, getEmployeeStaffSession, setEmployeeStaffSession,
  clearEmployeeStaffSession, getOfficeNetworkConfig, verifyOfficeNetwork
} from '../../services/employeeStaffService';
import { Employee, Config } from '../../types';
import { 
  LeaveTypeConfig, LeaveApplication, AttendanceRecord, 
  TaskAssignment, TaskStatus, OfficeNetworkSecurityConfig, NetworkVerificationResult
} from '../../types/staffPortal';
import { SupabaseCompany } from '../../lib/supabase';

interface EmployeePortalAppProps {
  activeCompany?: SupabaseCompany | null;
  config?: Config;
  onExitPortal?: () => void;
}

export const EmployeePortalApp: React.FC<EmployeePortalAppProps> = ({
  activeCompany,
  config,
  onExitPortal
}) => {
  const companyId = activeCompany?.id || getActiveCompanyId() || 'default';
  const effectiveConfig = config || getCompanyConfig(companyId);

  const isAttendanceAllowed = isFeatureAllowed(effectiveConfig, 'EnableStaffAttendanceAndLeave') && effectiveConfig.EnableStaffAttendanceAndLeave !== 'false';
  const isAssignmentsAllowed = isFeatureAllowed(effectiveConfig, 'EnableStaffAssignments') && effectiveConfig.EnableStaffAssignments !== 'false';
  const isPortalModuleAllowed = isAttendanceAllowed || isAssignmentsAllowed;

  const initialTab = isAttendanceAllowed ? 'clock' : (isAssignmentsAllowed ? 'tasks' : 'profile');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'clock' | 'leaves' | 'tasks' | 'profile'>(initialTab);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Auto-correct active tab if feature is turned off
  useEffect(() => {
    if (!isAttendanceAllowed && (activeTab === 'clock' || activeTab === 'leaves')) {
      setActiveTab(isAssignmentsAllowed ? 'tasks' : 'profile');
    } else if (!isAssignmentsAllowed && activeTab === 'tasks') {
      setActiveTab(isAttendanceAllowed ? 'clock' : 'profile');
    }
  }, [isAttendanceAllowed, isAssignmentsAllowed, activeTab]);
  
  // Login form state
  const [loginEmpCode, setLoginEmpCode] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);

  // Shift & Attendance State
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [shiftNote, setShiftNote] = useState('');
  const [shiftActionMsg, setShiftActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Leave state
  const [leaveTypes, setLeaveTypesList] = useState<LeaveTypeConfig[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveApplication[]>([]);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: 'annual',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    isHalfDay: false,
    reason: ''
  });

  // Task state
  const [myTasks, setMyTasks] = useState<TaskAssignment[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskAssignment | null>(null);
  const [taskCommentText, setTaskCommentText] = useState('');

  // PWA Install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Network Verification State (Office Network Enforcement)
  const [networkStatus, setNetworkStatus] = useState<NetworkVerificationResult | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState<boolean>(true);
  const [currentGpsCoords, setCurrentGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [officeSecurityConfig, setOfficeSecurityConfig] = useState<OfficeNetworkSecurityConfig>(() => getOfficeNetworkConfig(companyId));

  const runNetworkVerification = async (): Promise<NetworkVerificationResult> => {
    setIsCheckingNetwork(true);
    const cfg = getOfficeNetworkConfig(companyId);
    setOfficeSecurityConfig(cfg);

    if (!cfg.requireOfficeNetwork) {
      const allowedRes: NetworkVerificationResult = {
        allowed: true,
        isOfficeNetwork: true,
        reason: 'Office network restriction is disabled by management.'
      };
      setNetworkStatus(allowedRes);
      setIsCheckingNetwork(false);
      return allowedRes;
    }

    try {
      if (cfg.requireOfficeGps && 'geolocation' in navigator) {
        return new Promise<NetworkVerificationResult>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setCurrentGpsCoords(coords);
              const res = await verifyOfficeNetwork(coords, companyId);
              setNetworkStatus(res);
              setIsCheckingNetwork(false);
              resolve(res);
            },
            async (err) => {
              console.warn('[GPS Geofence] GPS failed or denied:', err);
              const res = await verifyOfficeNetwork(null, companyId);
              setNetworkStatus(res);
              setIsCheckingNetwork(false);
              resolve(res);
            },
            { timeout: 7000, enableHighAccuracy: true }
          );
        });
      } else {
        const res = await verifyOfficeNetwork(null, companyId);
        setNetworkStatus(res);
        setIsCheckingNetwork(false);
        return res;
      }
    } catch {
      const fallbackRes: NetworkVerificationResult = {
        allowed: false,
        isOfficeNetwork: false,
        reason: 'Network verification failed. Please ensure you are connected to the Office WiFi.'
      };
      setNetworkStatus(fallbackRes);
      setIsCheckingNetwork(false);
      return fallbackRes;
    }
  };

  // Run network check on mount and when employee logs in
  useEffect(() => {
    runNetworkVerification();
  }, [currentEmployee]);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check saved session
  useEffect(() => {
    const allEmps = getEmployees().filter(e => e.status === 'Active');
    setAvailableEmployees(allEmps);

    const session = getEmployeeStaffSession();
    if (session && session.employee) {
      // Confirm employee still exists
      const match = allEmps.find(e => e.id === session.employee.id || e.empCode === session.employee.empCode);
      if (match) {
        setCurrentEmployee(match);
      } else {
        setCurrentEmployee(session.employee);
      }
    }
  }, []);

  // Refresh Employee Data
  const loadEmployeeData = () => {
    if (!currentEmployee) return;
    const lTypes = getLeaveTypes().filter(t => t.enabled);
    setLeaveTypesList(lTypes);

    const apps = getLeaveApplications().filter(a => a.employeeId === currentEmployee.id);
    setMyLeaves(apps);

    const todayRec = getEmployeeTodayAttendance(currentEmployee.id);
    setTodayAttendance(todayRec);

    const tasks = getTaskAssignments().filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(tasks);
  };

  useEffect(() => {
    loadEmployeeData();
  }, [currentEmployee]);

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const targetEmp = availableEmployees.find(e => 
      e.empCode.trim().toLowerCase() === loginEmpCode.trim().toLowerCase() ||
      e.contactNo.trim() === loginEmpCode.trim() ||
      e.id === loginEmpCode
    );

    if (!targetEmp) {
      setLoginError('Employee Code or Phone number not recognized.');
      return;
    }

    // Default pin is 1234 or last 4 digits of phone
    const defaultPin = targetEmp.contactNo ? targetEmp.contactNo.slice(-4) : '1234';
    const validPin = (targetEmp as any).pin || defaultPin || '1234';

    if (loginPin && loginPin.trim() !== validPin && loginPin.trim() !== '1234') {
      setLoginError('Invalid PIN code. (Default PIN is 1234)');
      return;
    }

    const companyId = activeCompany?.id || getActiveCompanyId() || 'default';
    setEmployeeStaffSession(targetEmp, companyId);
    setCurrentEmployee(targetEmp);
    setLoginPin('');
    setLoginError('');
  };

  const handleLogout = () => {
    clearEmployeeStaffSession();
    setCurrentEmployee(null);
  };

  // Clock In Action
  const handleClockIn = async () => {
    if (!currentEmployee) return;

    // Check office network
    let netResult = networkStatus;
    if (officeSecurityConfig.requireOfficeNetwork) {
      netResult = await runNetworkVerification();
      if (!netResult.allowed) {
        setShiftActionMsg({ 
          type: 'error', 
          text: netResult.reason || '🚫 Access Blocked: You must be connected to the Office WiFi/Network to record attendance. Signing in from home is prohibited.' 
        });
        setTimeout(() => setShiftActionMsg(null), 5000);
        return;
      }
    }

    const res = employeeClockIn({
      employeeId: currentEmployee.id,
      employeeCode: currentEmployee.empCode,
      employeeName: currentEmployee.fullName,
      terminal: 'Staff Mobile App',
      note: shiftNote.trim(),
      source: 'mobile_pwa',
      companyId,
      networkVerification: netResult || undefined
    });

    if (res.ok && res.record) {
      setTodayAttendance(res.record);
      setShiftActionMsg({ type: 'success', text: res.message });
      setShiftNote('');
    } else {
      setShiftActionMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setShiftActionMsg(null), 4000);
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!currentEmployee) return;

    // Check office network
    let netResult = networkStatus;
    if (officeSecurityConfig.requireOfficeNetwork) {
      netResult = await runNetworkVerification();
      if (!netResult.allowed) {
        setShiftActionMsg({ 
          type: 'error', 
          text: netResult.reason || '🚫 Access Blocked: You must be connected to the Office WiFi/Network to sign out.' 
        });
        setTimeout(() => setShiftActionMsg(null), 5000);
        return;
      }
    }

    const res = employeeClockOut({
      employeeId: currentEmployee.id,
      note: shiftNote.trim(),
      companyId,
      source: 'mobile_pwa',
      networkVerification: netResult || undefined
    });

    if (res.ok && res.record) {
      setTodayAttendance(res.record);
      setShiftActionMsg({ type: 'success', text: res.message });
      setShiftNote('');
    } else {
      setShiftActionMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setShiftActionMsg(null), 4000);
  };

  // Submit Leave Application
  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee || !leaveForm.reason.trim()) return;

    const selectedType = leaveTypes.find(t => t.id === leaveForm.leaveTypeId) || leaveTypes[0];
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = leaveForm.isHalfDay ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    applyForLeave({
      employeeId: currentEmployee.id,
      employeeCode: currentEmployee.empCode,
      employeeName: currentEmployee.fullName,
      leaveTypeId: selectedType.id,
      leaveTypeName: selectedType.name,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      daysCount: days,
      isHalfDay: leaveForm.isHalfDay,
      reason: leaveForm.reason.trim()
    });

    setShowApplyLeaveModal(false);
    setLeaveForm({
      leaveTypeId: 'annual',
      startDate: getTodayDateString(),
      endDate: getTodayDateString(),
      isHalfDay: false,
      reason: ''
    });
    loadEmployeeData();
  };

  // Task Status Update
  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus) => {
    if (!currentEmployee) return;
    updateTaskStatus(taskId, newStatus, `Staff updated task status to ${newStatus}`, {
      id: currentEmployee.id,
      name: currentEmployee.fullName,
      role: 'Employee'
    });
    const updated = getTaskAssignments().filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(updated);
    if (selectedTask && selectedTask.id === taskId) {
      const match = updated.find(t => t.id === taskId);
      if (match) setSelectedTask(match);
    }
  };

  // Post Task Comment
  const handleSendComment = () => {
    if (!selectedTask || !taskCommentText.trim() || !currentEmployee) return;
    addTaskComment(selectedTask.id, taskCommentText.trim(), {
      id: currentEmployee.id,
      name: currentEmployee.fullName,
      role: 'Employee'
    });
    setTaskCommentText('');
    const updated = getTaskAssignments().filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(updated);
    const match = updated.find(t => t.id === selectedTask.id);
    if (match) setSelectedTask(match);
  };

  // Install PWA
  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    }
  };

  // Leave Balances
  const myBalances = currentEmployee ? calculateEmployeeLeaveBalance(currentEmployee.id) : null;

  // =========================================================================
  // VIEW 0: MODULE INACTIVE NOTICE (WHEN SUPERADMIN HAS DISABLED BOTH FEATURES)
  // =========================================================================
  if (!isPortalModuleAllowed) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Staff Portal Inactive</h2>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          Employee Mobile Services (Leave Management, Attendance, and Task Assignments) are not enabled for this client store. Please contact your company administrator or platform superadmin.
        </p>
        {onExitPortal && (
          <button
            onClick={onExitPortal}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
          >
            Exit Portal
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW A: LOGIN SCREEN FOR STAFF
  // =========================================================================
  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-md">
              EP
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight">{activeCompany?.company_name || 'Staff Portal'}</h1>
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Employee Mobile Gateway</span>
            </div>
          </div>

          {onExitPortal && (
            <button
              onClick={onExitPortal}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/80 cursor-pointer"
            >
              Exit
            </button>
          )}
        </div>

        {/* Center Card */}
        <div className="max-w-sm w-full mx-auto my-auto py-8">
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-5">
            <div className="text-center space-y-1">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/15 border border-blue-400/20 text-blue-400 mx-auto flex items-center justify-center mb-3">
                <Smartphone className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-black text-white">
                {isAttendanceAllowed && isAssignmentsAllowed
                  ? 'Staff Portal & Tasks'
                  : isAttendanceAllowed
                  ? 'Staff Check-In & Leaves'
                  : 'Staff Tasks & Assignments'}
              </h2>
              <p className="text-xs text-slate-400">Enter your Employee Code or Mobile to access your personal dashboard.</p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select or Enter Employee
                </label>
                <select
                  value={loginEmpCode}
                  onChange={e => setLoginEmpCode(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-blue-500 outline-none"
                >
                  <option value="">Choose your profile...</option>
                  {availableEmployees.map(emp => (
                    <option key={emp.id} value={emp.empCode}>
                      {emp.fullName} ({emp.empCode} - {emp.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  4-Digit Security PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Default: 1234"
                  value={loginPin}
                  onChange={e => setLoginPin(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono tracking-widest text-center focus:border-blue-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Access Staff Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              💡 Need help? Contact your company administrator or HR.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 pb-2">
          Protected & Encrypted • {activeCompany?.company_name || 'ERP System'}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ACTIVE EMPLOYEE MOBILE DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-20 select-none">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md">
            {currentEmployee.fullName.charAt(0)}
          </div>
          <div>
            <div className="font-black text-sm text-white leading-tight">{currentEmployee.fullName}</div>
            <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1.5">
              <span>{currentEmployee.designation}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">{currentEmployee.empCode}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {installPrompt && (
            <button
              onClick={handleInstallApp}
              className="p-2 rounded-xl bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 transition cursor-pointer"
              title="Install App to Home Screen"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 max-w-md w-full mx-auto space-y-4">
        {/* Real-time Action Flash Message */}
        {shiftActionMsg && (
          <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            shiftActionMsg.type === 'success' 
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' 
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}>
            {shiftActionMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            <span>{shiftActionMsg.text}</span>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: CLOCK IN / OUT WIDGET */}
        {/* ============================================================== */}
        {activeTab === 'clock' && isAttendanceAllowed && (
          <div className="space-y-4">
            {/* Live Clock Card */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 rounded-3xl p-6 text-center space-y-5 shadow-xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {currentTime.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <div className="text-4xl font-black tracking-tight font-mono text-white mt-1">
                  {currentTime.toLocaleTimeString()}
                </div>
              </div>

              {/* Office Network Verification Banner */}
              {officeSecurityConfig.requireOfficeNetwork && (
                <div className="py-1">
                  {isCheckingNetwork ? (
                    <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 animate-pulse">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                      <span>Verifying Office WiFi Network...</span>
                    </div>
                  ) : networkStatus?.allowed ? (
                    <div className="flex items-center justify-between py-2 px-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <Wifi className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="font-semibold truncate">
                          {officeSecurityConfig.officeWifiSsid 
                            ? `Office WiFi: ${officeSecurityConfig.officeWifiSsid}` 
                            : 'Office Network Verified'}
                        </span>
                        {networkStatus.clientIp && (
                          <span className="text-[10px] font-mono text-emerald-400/80">
                            [{networkStatus.clientIp}]
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => runNetworkVerification()}
                        className="text-[10px] text-emerald-400 hover:text-emerald-200 underline shrink-0 ml-2 cursor-pointer font-bold"
                        title="Re-verify Network"
                      >
                        Re-check
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-left text-rose-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-rose-300">
                          <WifiOff className="h-4 w-4 text-rose-400 shrink-0" />
                          <span>Office WiFi Required</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => runNetworkVerification()}
                          className="px-2 py-1 rounded-lg bg-rose-900 hover:bg-rose-800 text-[10px] font-bold text-white flex items-center gap-1 cursor-pointer transition active:scale-95"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Retry Check</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-rose-200/90 leading-relaxed">
                        {networkStatus?.reason || 'You are on cellular data or an outside network. Please connect to the office WiFi to sign in. Signing in from home is prohibited.'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Big Touch-Friendly Clock Action Button */}
              <div className="flex justify-center py-2">
                {!todayAttendance?.checkInTime ? (
                  <button
                    onClick={handleClockIn}
                    className="h-40 w-40 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-1 shadow-xl shadow-emerald-900/40 active:scale-95 transition flex flex-col items-center justify-center text-white cursor-pointer group"
                  >
                    <div className="h-full w-full rounded-full bg-slate-950/40 border border-white/20 flex flex-col items-center justify-center gap-1 group-hover:bg-transparent transition">
                      <Clock className="h-10 w-10 text-white animate-pulse" />
                      <span className="font-black text-base uppercase tracking-wider">Clock In</span>
                      <span className="text-[10px] text-emerald-200">Start Shift</span>
                    </div>
                  </button>
                ) : !todayAttendance.checkOutTime ? (
                  <button
                    onClick={handleClockOut}
                    className="h-40 w-40 rounded-full bg-gradient-to-tr from-amber-600 via-rose-500 to-rose-600 p-1 shadow-xl shadow-rose-900/40 active:scale-95 transition flex flex-col items-center justify-center text-white cursor-pointer group"
                  >
                    <div className="h-full w-full rounded-full bg-slate-950/40 border border-white/20 flex flex-col items-center justify-center gap-1 group-hover:bg-transparent transition">
                      <Timer className="h-10 w-10 text-white" />
                      <span className="font-black text-base uppercase tracking-wider">Clock Out</span>
                      <span className="text-[10px] text-rose-200">End Shift</span>
                    </div>
                  </button>
                ) : (
                  <div className="h-40 w-40 rounded-full bg-slate-900 border-2 border-emerald-500/50 flex flex-col items-center justify-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                    <span className="font-black text-sm uppercase">Shift Done</span>
                    <span className="text-[11px] text-slate-400">{todayAttendance.hoursWorked || 0} Hours</span>
                  </div>
                )}
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-slate-800">
                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">In Time</span>
                  <span className="text-sm font-black font-mono text-emerald-400">
                    {todayAttendance?.checkInTime || '--:--'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Out Time</span>
                  <span className="text-sm font-black font-mono text-rose-400">
                    {todayAttendance?.checkOutTime || (todayAttendance?.checkInTime ? 'In Progress' : '--:--')}
                  </span>
                </div>
              </div>

              {/* Shift Note Input */}
              {(!todayAttendance?.checkOutTime) && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Add shift remark / note (optional)..."
                    value={shiftNote}
                    onChange={e => setShiftNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Quick Actions & Leave Balances Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Leave Balance</h3>
                <button
                  onClick={() => setActiveTab('leaves')}
                  className="text-xs text-blue-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Apply Leave</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {leaveTypes.slice(0, 4).map(t => {
                  const b = myBalances?.balances[t.id];
                  const rem = b ? b.remaining : t.defaultDays;

                  return (
                    <div key={t.id} className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-semibold truncate">{t.name}</div>
                      <div className="text-lg font-black text-white mt-0.5">
                        {rem} <span className="text-xs font-normal text-slate-500">/ {t.defaultDays} d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MY LEAVES & APPLICATIONS */}
        {/* ============================================================== */}
        {activeTab === 'leaves' && isAttendanceAllowed && (
          <div className="space-y-4">
            {/* Top Apply Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-lg text-white">Leave Hub</h2>
                <p className="text-xs text-slate-400">View quotas and submit new leave requests.</p>
              </div>

              <button
                onClick={() => setShowApplyLeaveModal(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Apply</span>
              </button>
            </div>

            {/* Leave Balance Grid */}
            <div className="grid grid-cols-2 gap-2">
              {leaveTypes.map(t => {
                const b = myBalances?.balances[t.id];
                const rem = b ? b.remaining : t.defaultDays;

                return (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.code}</span>
                    <div className="text-xs font-black text-white">{t.name}</div>
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      {rem} <span className="text-xs text-slate-500 font-normal">days left</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* My Leave Applications History */}
            <div className="space-y-2.5 pt-2">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400">My Leave Applications</h3>

              {myLeaves.map(app => (
                <div key={app.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-black text-sm text-white">{app.leaveTypeName}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {app.startDate} to {app.endDate} ({app.daysCount} days)
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      app.status === 'Approved' ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400' :
                      app.status === 'Rejected' ? 'bg-rose-950/70 border-rose-500/40 text-rose-400' :
                      'bg-amber-950/70 border-amber-500/40 text-amber-400'
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 italic bg-slate-950/60 p-2 rounded-xl">
                    "{app.reason}"
                  </p>

                  {app.reviewedBy && (
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span>Reviewed by {app.reviewedBy}</span>
                      <span>{new Date(app.reviewedAt || '').toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}

              {myLeaves.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  No leave applications submitted yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: MY TASKS & ASSIGNMENTS (MANAGER/GM NOTES) */}
        {/* ============================================================== */}
        {activeTab === 'tasks' && isAssignmentsAllowed && (
          <div className="space-y-4">
            <div>
              <h2 className="font-black text-lg text-white">My Assignments & Tasks</h2>
              <p className="text-xs text-slate-400">Assigned by Managers and General Managers.</p>
            </div>

            <div className="space-y-3">
              {myTasks.map(task => {
                const isOverdue = new Date(task.dueDate).getTime() < new Date().setHours(0,0,0,0) && task.status !== 'Completed';

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 shadow-md space-y-2.5 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-black font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">
                        {task.taskNo}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        task.priority === 'Urgent' ? 'bg-rose-950 border border-rose-500/40 text-rose-400' :
                        task.priority === 'High' ? 'bg-amber-950 border border-amber-500/40 text-amber-400' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {task.priority}
                      </span>
                    </div>

                    <h3 className="font-black text-sm text-white">{task.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800 text-slate-400">
                      <span>Due: <strong className={isOverdue ? 'text-rose-400' : 'text-slate-300'}>{task.dueDate}</strong></span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{task.comments.length} Notes</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {myTasks.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  No active tasks assigned to you right now.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MY PROFILE & ATTENDANCE */}
        {/* ============================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl mx-auto flex items-center justify-center shadow-lg">
                {currentEmployee.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="font-black text-lg text-white">{currentEmployee.fullName}</h3>
                <p className="text-xs text-blue-400">{currentEmployee.designation} • {currentEmployee.department}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-slate-800 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Emp Code</span>
                  <span className="font-mono font-bold text-white">{currentEmployee.empCode}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Joining Date</span>
                  <span className="font-mono font-bold text-white">{currentEmployee.joiningDate || '-'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Contact</span>
                  <span className="font-mono font-bold text-white">{currentEmployee.contactNo}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">CID No</span>
                  <span className="font-mono font-bold text-white">{currentEmployee.cidNo || '-'}</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out of Staff Portal</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* BOTTOM MOBILE NAVIGATION BAR */}
      {/* ============================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 max-w-md mx-auto flex items-center justify-around py-2 px-1">
        {isAttendanceAllowed && (
          <button
            onClick={() => setActiveTab('clock')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 cursor-pointer transition ${
              activeTab === 'clock' ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            <Clock className="h-5 w-5" />
            <span>Clock</span>
          </button>
        )}

        {isAttendanceAllowed && (
          <button
            onClick={() => setActiveTab('leaves')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 cursor-pointer transition ${
              activeTab === 'leaves' ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Leaves</span>
          </button>
        )}

        {isAssignmentsAllowed && (
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 cursor-pointer transition relative ${
              activeTab === 'tasks' ? 'text-blue-400' : 'text-slate-400'
            }`}
          >
            <CheckSquare className="h-5 w-5" />
            <span>Tasks</span>
            {myTasks.filter(t => t.status !== 'Completed').length > 0 && (
              <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 cursor-pointer transition ${
            activeTab === 'profile' ? 'text-blue-400' : 'text-slate-400'
          }`}
        >
          <User className="h-5 w-5" />
          <span>Profile</span>
        </button>
      </nav>

      {/* ============================================================== */}
      {/* MODAL 1: APPLY FOR LEAVE (MOBILE VIEW) */}
      {/* ============================================================== */}
      {showApplyLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-sm text-white">Apply for Leave</h3>
              <button
                onClick={() => setShowApplyLeaveModal(false)}
                className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Leave Type *</label>
                <select
                  value={leaveForm.leaveTypeId}
                  onChange={e => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                >
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Max {t.defaultDays} d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="halfDayToggle"
                  checked={leaveForm.isHalfDay}
                  onChange={e => setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })}
                  className="rounded w-4 h-4 text-blue-600 bg-slate-950"
                />
                <label htmlFor="halfDayToggle" className="text-slate-300 font-semibold text-xs">
                  Half-Day Leave
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail reason for leave..."
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApplyLeaveModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer shadow-md"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: TASK DETAIL & 2-WAY COMMENT TRAIL (MOBILE VIEW) */}
      {/* ============================================================== */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-3.5 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-black font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-500/30 px-2 py-0.5 rounded">
                  {selectedTask.taskNo}
                </span>
                <h3 className="font-black text-sm text-white mt-1 leading-snug">{selectedTask.title}</h3>
                <span className="text-[10px] text-slate-400">Due: <strong className="text-rose-400">{selectedTask.dueDate}</strong></span>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl leading-relaxed">
              {selectedTask.description || 'No detailed instructions provided.'}
            </p>

            {/* Quick Status Buttons */}
            <div className="flex items-center gap-1.5 text-xs pt-1">
              <span className="text-slate-400 text-[10px] font-bold">Status:</span>
              <button
                onClick={() => handleTaskStatusChange(selectedTask.id, 'In Progress')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  selectedTask.status === 'In Progress' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                In Progress
              </button>
              <button
                onClick={() => handleTaskStatusChange(selectedTask.id, 'Completed')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  selectedTask.status === 'Completed' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Completed
              </button>
            </div>

            {/* Comment Thread */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2 border-t border-slate-800 pr-1 text-xs">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-blue-400" />
                <span>Notes with Manager / GM</span>
              </div>

              {selectedTask.comments.map(c => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-300">{c.authorName} ({c.authorRole})</span>
                    <span className="text-slate-500 font-mono">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-200">{c.message}</p>
                </div>
              ))}

              {selectedTask.comments.length === 0 && (
                <p className="text-[11px] text-slate-500 italic py-1">No comments yet. Send a note or question below.</p>
              )}
            </div>

            {/* Reply Input */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Reply to manager..."
                value={taskCommentText}
                onChange={e => setTaskCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendComment(); }}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSendComment}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
