import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Calendar, CheckSquare, User, Smartphone, LogOut, 
  Send, MessageSquare, Plus, Check, X, AlertCircle, ChevronRight,
  Coffee, ShieldCheck, ArrowRight, Sparkles, Download, CheckCircle2,
  CalendarCheck, Timer, Briefcase, Award, Info, Wifi, WifiOff, RefreshCw, MapPin, Lock,
  Phone, KeyRound, Eye, EyeOff, UserCheck, Shield, ChevronDown, Fingerprint, ScanFace,
  Bell
} from 'lucide-react';
import { 
  getEmployees, saveEmployees, syncEmployeesFromSupabase 
} from '../../services/storageService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { EzeeErpLogo } from '../common/EzeeErpLogo';
import { getCompanyConfig, isFeatureAllowed } from '../../services/tenantFeatureService';
import { 
  getLeaveTypes, getLeaveApplications, applyForLeave, 
  calculateEmployeeLeaveBalance, getTodayDateString,
  getAttendanceRecords, employeeClockIn, employeeClockOut,
  getEmployeeTodayAttendance, getTaskAssignments, updateTaskStatus,
  addTaskComment, getEmployeeStaffSession, setEmployeeStaffSession,
  clearEmployeeStaffSession, getOfficeNetworkConfig, verifyOfficeNetwork,
  fetchRemoteOfficeNetworkConfig,
  findEmployeeByMobileOrCode, updateEmployeePortalPin, normalizePhoneNumber,
  requestStaffPinResetOtp, verifyOtpAndResetPin, maskPhoneNumber,
  getStaffNotifications, markStaffNotificationRead, clearStaffNotifications,
  generateTaskWhatsAppUrl, subscribeToRealtimeTasks,
  calculateLeaveDeductionBreakdown, getCompanyHolidayPolicy
} from '../../services/employeeStaffService';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  getBiometricHardwareName,
  isEmployeeBiometricRegistered,
  registerBiometricCredential,
  authenticateWithBiometrics,
  removeBiometricCredential,
  getDeviceBiometricRegistry
} from '../../services/webAuthnService';
import { Employee, Config } from '../../types';
import { 
  LeaveTypeConfig, LeaveApplication, AttendanceRecord, 
  TaskAssignment, TaskStatus, OfficeNetworkSecurityConfig, NetworkVerificationResult,
  StaffInAppNotification, CompanyHolidayPolicy
} from '../../types/staffPortal';
import { SupabaseCompany } from '../../lib/supabase';
import { StaffPWAInstallModal } from './StaffPWAInstallModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  const urlCompanyParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('company') : null;
  const companyId = activeCompany?.id || urlCompanyParam || getActiveCompanyId() || 'default';
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
  
  // Bhutan Background Wallpaper State
  const [bgWallpaperUrl, setBgWallpaperUrl] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('bhutan_login_bg');
      if (saved) return saved;
    }
    return '/tashichho_dzong.jpg'; // Default: Authentic Tashichho Dzong, Thimphu
  });

  // Login form state
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'mobile' | 'list'>('mobile');
  const [loginError, setLoginError] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);

  // Change PIN modal & form state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showNewPinToggle, setShowNewPinToggle] = useState(false);
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Forgot / Reset PIN via Mobile OTP State
  const [showForgotPinModal, setShowForgotPinModal] = useState<boolean>(false);
  const [forgotPinStep, setForgotPinStep] = useState<'mobile' | 'otp' | 'newPin' | 'success'>('mobile');
  const [forgotPinMobileInput, setForgotPinMobileInput] = useState<string>('');
  const [forgotPinOtpInput, setForgotPinOtpInput] = useState<string>('');
  const [forgotPinNewPin, setForgotPinNewPin] = useState<string>('');
  const [forgotPinConfirmPin, setForgotPinConfirmPin] = useState<string>('');
  const [forgotPinShowDigits, setForgotPinShowDigits] = useState<boolean>(false);
  const [forgotPinError, setForgotPinError] = useState<string>('');
  const [forgotPinSuccess, setForgotPinSuccess] = useState<string>('');
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isVerifyingOtpAndResetting, setIsVerifyingOtpAndResetting] = useState<boolean>(false);
  const [otpSessionInfo, setOtpSessionInfo] = useState<{
    employeeId: string;
    employeeName: string;
    mobile: string;
    maskedMobile: string;
    expiresAt: number;
    debugOtp: string;
  } | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [simulatedSmsToast, setSimulatedSmsToast] = useState<{ otp: string; mobile: string; name: string } | null>(null);

  // OTP Countdown timer effect
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // WebAuthn Biometrics State
  const [isBioSupported, setIsBioSupported] = useState<boolean>(() => isWebAuthnSupported());
  const [isBioAvailable, setIsBioAvailable] = useState<boolean>(false);
  const [bioHardware, setBioHardware] = useState<{ name: string; type: 'face' | 'fingerprint' | 'general' }>(() => getBiometricHardwareName());
  const [isAuthenticatingBio, setIsAuthenticatingBio] = useState<boolean>(false);
  const [isRegisteringBio, setIsRegisteringBio] = useState<boolean>(false);
  const [bioEnrollSuccess, setBioEnrollSuccess] = useState<string>('');
  const [bioEnrollError, setBioEnrollError] = useState<string>('');
  const [showBioEnrollModal, setShowBioEnrollModal] = useState<boolean>(false);
  const [deviceBioRegistryCount, setDeviceBioRegistryCount] = useState<number>(0);

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
  const [taskReplySuccess, setTaskReplySuccess] = useState<string | null>(null);

  // In-App Staff Notifications
  const [staffNotifications, setStaffNotifications] = useState<StaffInAppNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // PWA Install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPWAInstallModal, setShowPWAInstallModal] = useState(false);

  // Network Verification State (Office Network Enforcement)
  const [networkStatus, setNetworkStatus] = useState<NetworkVerificationResult | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState<boolean>(true);
  const [currentGpsCoords, setCurrentGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [officeSecurityConfig, setOfficeSecurityConfig] = useState<OfficeNetworkSecurityConfig>(() => getOfficeNetworkConfig(companyId));

  const runNetworkVerification = async (): Promise<NetworkVerificationResult> => {
    setIsCheckingNetwork(true);
    let cfg = getOfficeNetworkConfig(companyId);

    // Verify with remote cloud to ensure we immediately catch when management turned off the restriction from PC
    try {
      const remoteCfg = await fetchRemoteOfficeNetworkConfig(companyId);
      if (remoteCfg) {
        cfg = remoteCfg;
      }
    } catch {}

    setOfficeSecurityConfig(cfg);

    // If network restriction is toggled OFF by admin, staff can clock in freely from home WiFi or anywhere
    if (!cfg.requireOfficeNetwork) {
      const allowedRes: NetworkVerificationResult = {
        allowed: true,
        isOfficeNetwork: true,
        networkType: 'external',
        reason: 'Office network restriction is disabled by management. Clock-in from home & any network is allowed.'
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

  // Real-time network security & office WiFi enforcement sync listener
  useEffect(() => {
    // 1. Fetch remote settings immediately on mount so mobile receives latest PC setting
    fetchRemoteOfficeNetworkConfig(companyId).then(remoteCfg => {
      if (remoteCfg) {
        setOfficeSecurityConfig(remoteCfg);
        if (!remoteCfg.requireOfficeNetwork) {
          setNetworkStatus({
            allowed: true,
            isOfficeNetwork: true,
            networkType: 'external',
            reason: 'Office network restriction is disabled by management. Clock-in from home & any network is allowed.'
          });
          setIsCheckingNetwork(false);
        } else {
          runNetworkVerification();
        }
      }
    });

    // 2. Real-time Firestore snapshot listener for instant cross-device updates
    let unsubFsTenant: (() => void) | null = null;
    let unsubFsDefault: (() => void) | null = null;

    try {
      const cId = companyId || 'default';
      const tenantDocRef = doc(db, 'tenant_office_network', cId);
      unsubFsTenant = onSnapshot(tenantDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.config) {
            const clean = { ...data.config, requireOfficeNetwork: Boolean(data.config.requireOfficeNetwork) };
            setOfficeSecurityConfig(clean);
            if (!clean.requireOfficeNetwork) {
              setNetworkStatus({
                allowed: true,
                isOfficeNetwork: true,
                networkType: 'external',
                reason: 'Office network restriction is disabled by management. Clock-in from home & any network is allowed.'
              });
              setIsCheckingNetwork(false);
            }
          }
        }
      }, (err) => console.warn('[EmployeePortalApp Firestore net listener notice]:', err));

      if (cId !== 'default') {
        const defaultDocRef = doc(db, 'tenant_office_network', 'default');
        unsubFsDefault = onSnapshot(defaultDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.config) {
              const clean = { ...data.config, requireOfficeNetwork: Boolean(data.config.requireOfficeNetwork) };
              setOfficeSecurityConfig(clean);
              if (!clean.requireOfficeNetwork) {
                setNetworkStatus({
                  allowed: true,
                  isOfficeNetwork: true,
                  networkType: 'external',
                  reason: 'Office network restriction is disabled by management. Clock-in from home & any network is allowed.'
                });
                setIsCheckingNetwork(false);
              }
            }
          }
        }, (err) => console.warn('[EmployeePortalApp Firestore default net listener notice]:', err));
      }
    } catch (e) {
      console.warn('[EmployeePortalApp Firestore listener setup notice]:', e);
    }

    // 3. Real-time event listener for instant updates across tabs/devices
    const handleNetUpdate = (e: any) => {
      const cfg = e.detail?.config || getOfficeNetworkConfig(companyId);
      setOfficeSecurityConfig(cfg);
      if (!cfg.requireOfficeNetwork) {
        setNetworkStatus({
          allowed: true,
          isOfficeNetwork: true,
          networkType: 'external',
          reason: 'Office network restriction is disabled by management. Clock-in from home & any network is allowed.'
        });
        setIsCheckingNetwork(false);
      } else {
        runNetworkVerification();
      }
    };

    window.addEventListener('deep_pos_network_security_updated', handleNetUpdate);
    return () => {
      if (unsubFsTenant) unsubFsTenant();
      if (unsubFsDefault) unsubFsDefault();
      window.removeEventListener('deep_pos_network_security_updated', handleNetUpdate);
    };
  }, [companyId]);

  // Run network check on mount and when employee logs in
  useEffect(() => {
    runNetworkVerification();
  }, [currentEmployee]);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for PWA install prompt & detect standalone mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    }
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check saved session & initialize WebAuthn
  useEffect(() => {
    const refreshEmps = (empsList?: Employee[]) => {
      const allEmps = (empsList || getEmployees(companyId)).filter(e => e.status === 'Active');
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
    };

    refreshEmps();

    // Async pull fresh employees from Supabase Cloud to ensure new PCs get the latest staff list
    syncEmployeesFromSupabase(companyId).then(remoteEmps => {
      if (remoteEmps && remoteEmps.length > 0) {
        refreshEmps(remoteEmps);
      }
    });

    const handleEmployeeUpdate = (evt: any) => {
      if (evt?.detail?.employees) {
        refreshEmps(evt.detail.employees);
      } else {
        refreshEmps();
      }
    };

    window.addEventListener('deep_pos_employees_updated', handleEmployeeUpdate);
    window.addEventListener('app:dataLoaded', () => refreshEmps());

    // Check platform biometric capability
    const checkBio = async () => {
      const supported = isWebAuthnSupported();
      setIsBioSupported(supported);
      if (supported) {
        const available = await isPlatformAuthenticatorAvailable();
        setIsBioAvailable(available);
      }
      const hw = getBiometricHardwareName();
      setBioHardware(hw);
      const registry = getDeviceBiometricRegistry();
      setDeviceBioRegistryCount(registry.length);
    };
    checkBio();

    return () => {
      window.removeEventListener('deep_pos_employees_updated', handleEmployeeUpdate);
      window.removeEventListener('app:dataLoaded', () => refreshEmps());
    };
  }, [companyId]);

  // Refresh Employee Data
  const loadEmployeeData = () => {
    if (!currentEmployee) return;
    const lTypes = getLeaveTypes(companyId).filter(t => t.enabled);
    setLeaveTypesList(lTypes);

    const apps = getLeaveApplications(companyId).filter(a => a.employeeId === currentEmployee.id);
    setMyLeaves(apps);

    const todayRec = getEmployeeTodayAttendance(currentEmployee.id, companyId);
    setTodayAttendance(todayRec);

    const tasks = getTaskAssignments(companyId).filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(tasks);
    if (selectedTask) {
      const match = tasks.find(t => t.id === selectedTask.id);
      if (match) {
        setSelectedTask(match);
      }
    }

    const notifs = getStaffNotifications(currentEmployee.id, companyId);
    setStaffNotifications(notifs);
  };

  useEffect(() => {
    loadEmployeeData();
    const unsubRealtime = subscribeToRealtimeTasks(companyId);

    const handleDataUpdate = () => loadEmployeeData();
    window.addEventListener('deep_pos_leave_types_updated', handleDataUpdate);
    window.addEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
    window.addEventListener('deep_pos_attendance_updated', handleDataUpdate);
    window.addEventListener('deep_pos_tasks_updated', handleDataUpdate);
    window.addEventListener('deep_pos_staff_notifications_updated', handleDataUpdate);

    return () => {
      unsubRealtime();
      window.removeEventListener('deep_pos_leave_types_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_leave_apps_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_attendance_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_tasks_updated', handleDataUpdate);
      window.removeEventListener('deep_pos_staff_notifications_updated', handleDataUpdate);
    };
  }, [currentEmployee, companyId]);

  // Fast pulse sync for tasks and replies when viewing assignments
  useEffect(() => {
    if (!currentEmployee || (!selectedTask && activeTab !== 'tasks')) return;
    const interval = setInterval(() => {
      loadEmployeeData();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentEmployee, selectedTask?.id, activeTab, companyId]);

  // Detected employee based on mobile number or code input
  const detectedEmployee = useMemo(() => {
    if (!loginMobile || !loginMobile.trim()) return null;
    const trimmed = loginMobile.trim();
    const normalizedInput = normalizePhoneNumber(trimmed);
    
    return availableEmployees.find(emp => {
      if (emp.contactNo) {
        const normContact = normalizePhoneNumber(emp.contactNo);
        if (normContact && normalizedInput && (normContact === normalizedInput || normContact.endsWith(normalizedInput) || normalizedInput.endsWith(normContact))) {
          return true;
        }
        if (emp.contactNo.trim() === trimmed) return true;
      }
      if (emp.empCode && emp.empCode.trim().toLowerCase() === trimmed.toLowerCase()) return true;
      if (emp.cidNo && emp.cidNo.trim().toLowerCase() === trimmed.toLowerCase()) return true;
      if (emp.id === trimmed) return true;
      return false;
    });
  }, [loginMobile, availableEmployees]);

  // Login Handler (Mobile Number First)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedInput = loginMobile.trim();
    if (!trimmedInput) {
      setLoginError('Please enter your mobile phone number.');
      return;
    }

    const targetEmp = detectedEmployee || availableEmployees.find(e => 
      (e.contactNo && normalizePhoneNumber(e.contactNo) === normalizePhoneNumber(trimmedInput)) ||
      e.contactNo.trim() === trimmedInput ||
      e.empCode.trim().toLowerCase() === trimmedInput.toLowerCase() ||
      e.id === trimmedInput
    );

    if (!targetEmp) {
      setLoginError('Mobile number not recognized in staff records. Please check the number or select your name from the staff list.');
      return;
    }

    const enteredPin = loginPin.trim();
    if (!enteredPin) {
      setLoginError('Please enter your 4-digit Security PIN (Default: 1234).');
      return;
    }

    // Default pin is 1234 or last 4 digits of phone
    const defaultFallbackPin = targetEmp.contactNo ? targetEmp.contactNo.slice(-4) : '1234';
    const validPin = targetEmp.pin || '1234';

    const isMatch = 
      enteredPin === validPin || 
      enteredPin === '1234' || 
      (defaultFallbackPin && enteredPin === defaultFallbackPin);

    if (!isMatch) {
      setLoginError('Invalid PIN code. If you have not changed your PIN yet, the default PIN is 1234.');
      return;
    }

    const companyId = activeCompany?.id || getActiveCompanyId() || 'default';
    setEmployeeStaffSession(targetEmp, companyId);
    setCurrentEmployee(targetEmp);
    setLoginPin('');
    setLoginError('');
  };

  // Change PIN Submit Handler
  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (!currentEmployee) return;

    if (!currentPinInput.trim()) {
      setChangePinError('Please enter your current PIN (Default: 1234).');
      return;
    }

    const cleanNewPin = newPinInput.trim();
    if (!cleanNewPin || cleanNewPin.length < 4 || cleanNewPin.length > 6) {
      setChangePinError('New PIN must be between 4 and 6 digits.');
      return;
    }

    if (!/^\d+$/.test(cleanNewPin)) {
      setChangePinError('New PIN must contain numeric digits only.');
      return;
    }

    if (cleanNewPin !== confirmPinInput.trim()) {
      setChangePinError('New PIN and Confirm PIN do not match.');
      return;
    }

    setIsChangingPin(true);
    const result = updateEmployeePortalPin(currentEmployee.id, currentPinInput.trim(), cleanNewPin);
    setIsChangingPin(false);

    if (!result.success) {
      setChangePinError(result.error || 'Failed to update PIN.');
      return;
    }

    if (result.updatedEmployee) {
      setCurrentEmployee(result.updatedEmployee);
      setAvailableEmployees(prev => prev.map(emp => emp.id === result.updatedEmployee!.id ? result.updatedEmployee! : emp));
    }

    setChangePinSuccess('Security PIN changed successfully! Please use this new PIN next time you sign in.');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setTimeout(() => {
      setShowChangePinModal(false);
      setChangePinSuccess('');
    }, 2500);
  };

  // WebAuthn Biometric Login Handler
  const handleBiometricLogin = async (targetEmp?: Employee) => {
    setLoginError('');
    setIsAuthenticatingBio(true);
    try {
      const empToTarget = 
        targetEmp || 
        detectedEmployee || 
        (loginMobile.trim() ? availableEmployees.find(e => {
          const norm = normalizePhoneNumber(loginMobile.trim());
          return (e.contactNo && normalizePhoneNumber(e.contactNo) === norm) || e.empCode.toLowerCase() === loginMobile.trim().toLowerCase();
        }) : undefined);

      const res = await authenticateWithBiometrics(empToTarget, availableEmployees);
      if (res.success && res.employee) {
        const companyId = activeCompany?.id || getActiveCompanyId() || 'default';
        setEmployeeStaffSession(res.employee, companyId);
        setCurrentEmployee(res.employee);
        setLoginPin('');
        setLoginError('');
      } else {
        setLoginError(res.error || 'Biometric recognition failed.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Biometric authentication was canceled.');
    } finally {
      setIsAuthenticatingBio(false);
    }
  };

  // WebAuthn Biometric Registration (Enrollment) Handler
  const handleEnrollBiometrics = async () => {
    if (!currentEmployee) return;
    setIsRegisteringBio(true);
    setBioEnrollError('');
    setBioEnrollSuccess('');
    try {
      const res = await registerBiometricCredential(currentEmployee);
      if (res.success && res.employee) {
        setCurrentEmployee(res.employee);
        setAvailableEmployees(prev => prev.map(e => e.id === res.employee!.id ? res.employee! : e));
        setDeviceBioRegistryCount(getDeviceBiometricRegistry().length);
        setBioEnrollSuccess(`Biometric recognition (${bioHardware.name}) has been enabled on this device!`);
      } else {
        setBioEnrollError(res.error || 'Failed to complete biometric setup.');
      }
    } catch (err: any) {
      setBioEnrollError(err.message || 'Biometric registration failed.');
    } finally {
      setIsRegisteringBio(false);
    }
  };

  // Remove Biometrics Handler
  const handleRemoveBiometrics = (credId?: string) => {
    if (!currentEmployee) return;
    const res = removeBiometricCredential(currentEmployee.id, credId);
    if (res.success && res.employee) {
      setCurrentEmployee(res.employee);
      setAvailableEmployees(prev => prev.map(e => e.id === res.employee!.id ? res.employee! : e));
      setDeviceBioRegistryCount(getDeviceBiometricRegistry().length);
      setBioEnrollSuccess('Biometric login credentials removed from this device.');
      setTimeout(() => setBioEnrollSuccess(''), 3000);
    }
  };

  // Forgot PIN / Reset via Mobile OTP Handlers
  const handleOpenForgotPinModal = (initialMobile?: string) => {
    const targetMobile = initialMobile || loginMobile || (detectedEmployee?.contactNo || '');
    setForgotPinMobileInput(targetMobile);
    setForgotPinOtpInput('');
    setForgotPinNewPin('');
    setForgotPinConfirmPin('');
    setForgotPinError('');
    setForgotPinSuccess('');
    setOtpSessionInfo(null);
    setForgotPinStep('mobile');
    setShowForgotPinModal(true);
  };

  const handleSendOtpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotPinError('');
    setIsRequestingOtp(true);
    try {
      const res = requestStaffPinResetOtp(forgotPinMobileInput);
      if (res.success && res.otpSession) {
        setOtpSessionInfo(res.otpSession);
        setForgotPinStep('otp');
        setOtpCountdown(30); // 30s cooldown before resend
        // Show simulated Bhutan SMS notification banner for testing convenience
        setSimulatedSmsToast({
          otp: res.otpSession.debugOtp,
          mobile: res.otpSession.mobile,
          name: res.otpSession.employeeName
        });
      } else {
        setForgotPinError(res.error || 'Failed to send OTP code.');
      }
    } catch (err: any) {
      setForgotPinError(err.message || 'Error requesting OTP.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtpAndProceed = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotPinError('');
    const clean = forgotPinOtpInput.trim().replace(/\D/g, '');
    if (clean.length !== 6) {
      setForgotPinError('Please enter the full 6-digit OTP code sent to your phone.');
      return;
    }
    if (otpSessionInfo && clean !== otpSessionInfo.debugOtp) {
      setForgotPinError('Invalid OTP code. Please check your SMS or re-enter.');
      return;
    }
    setForgotPinStep('newPin');
  };

  const handleResetPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPinError('');
    if (!otpSessionInfo) {
      setForgotPinError('OTP session expired. Please start over.');
      return;
    }
    if (forgotPinNewPin !== forgotPinConfirmPin) {
      setForgotPinError('New PIN and Confirmation PIN do not match.');
      return;
    }
    if (forgotPinNewPin.length < 4 || forgotPinNewPin.length > 6) {
      setForgotPinError('New PIN must be between 4 and 6 digits.');
      return;
    }
    if (!/^\d+$/.test(forgotPinNewPin)) {
      setForgotPinError('PIN must contain numbers only.');
      return;
    }

    setIsVerifyingOtpAndResetting(true);
    try {
      const res = verifyOtpAndResetPin(otpSessionInfo.employeeId, forgotPinOtpInput, forgotPinNewPin);
      if (res.success && res.updatedEmployee) {
        // Auto login the employee
        const companyId = activeCompany?.id || getActiveCompanyId() || 'default';
        setEmployeeStaffSession(res.updatedEmployee, companyId);
        setCurrentEmployee(res.updatedEmployee);
        setAvailableEmployees(prev => prev.map(e => e.id === res.updatedEmployee!.id ? res.updatedEmployee! : e));
        setForgotPinStep('success');
        setForgotPinSuccess('Your PIN has been successfully reset! You are now logged in.');
      } else {
        setForgotPinError(res.error || 'Failed to reset PIN.');
      }
    } catch (err: any) {
      setForgotPinError(err.message || 'Error occurred while resetting PIN.');
    } finally {
      setIsVerifyingOtpAndResetting(false);
    }
  };

  const handleLogout = () => {
    clearEmployeeStaffSession();
    setCurrentEmployee(null);
  };

  // Clock In Action
  const handleClockIn = async () => {
    if (!currentEmployee) return;

    // Check office network
    let currentCfg = getOfficeNetworkConfig(companyId);
    if (currentCfg.requireOfficeNetwork) {
      try {
        const remoteCfg = await fetchRemoteOfficeNetworkConfig(companyId);
        if (remoteCfg) currentCfg = remoteCfg;
      } catch {}
    }
    setOfficeSecurityConfig(currentCfg);

    let netResult = networkStatus;
    if (currentCfg.requireOfficeNetwork) {
      netResult = await runNetworkVerification();
      if (!netResult.allowed) {
        setShiftActionMsg({ 
          type: 'error', 
          text: netResult.reason || '🚫 Access Blocked: You must be connected to the Office WiFi/Network to record attendance.' 
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
      bypassNetworkCheck: !currentCfg.requireOfficeNetwork,
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
    let currentCfg = getOfficeNetworkConfig(companyId);
    if (currentCfg.requireOfficeNetwork) {
      try {
        const remoteCfg = await fetchRemoteOfficeNetworkConfig(companyId);
        if (remoteCfg) currentCfg = remoteCfg;
      } catch {}
    }
    setOfficeSecurityConfig(currentCfg);

    let netResult = networkStatus;
    if (currentCfg.requireOfficeNetwork) {
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
      bypassNetworkCheck: !currentCfg.requireOfficeNetwork,
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
    const breakdown = calculateLeaveDeductionBreakdown(
      leaveForm.startDate,
      leaveForm.endDate,
      leaveForm.isHalfDay,
      companyId
    );

    applyForLeave({
      employeeId: currentEmployee.id,
      employeeCode: currentEmployee.empCode,
      employeeName: currentEmployee.fullName,
      leaveTypeId: selectedType.id,
      leaveTypeName: selectedType.name,
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      daysCount: breakdown.effectiveDeductionDays,
      isHalfDay: leaveForm.isHalfDay,
      reason: leaveForm.reason.trim()
    }, companyId);

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
    }, companyId);
    const updated = getTaskAssignments(companyId).filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(updated);
    if (selectedTask && selectedTask.id === taskId) {
      const match = updated.find(t => t.id === taskId);
      if (match) setSelectedTask(match);
    }
  };

  // Post Task Comment / Reply
  const handleSendComment = () => {
    if (!selectedTask || !taskCommentText.trim() || !currentEmployee) return;
    const added = addTaskComment(selectedTask.id, taskCommentText.trim(), {
      id: currentEmployee.id,
      name: currentEmployee.fullName,
      role: 'Employee'
    }, companyId);
    setTaskCommentText('');
    const updated = getTaskAssignments(companyId).filter(t => t.assignedToEmpId === currentEmployee.id);
    setMyTasks(updated);
    if (added && selectedTask) {
      setSelectedTask({
        ...selectedTask,
        comments: [...(selectedTask.comments || []), added]
      });
      setTaskReplySuccess('Reply sent to manager successfully!');
      setTimeout(() => setTaskReplySuccess(null), 3500);
    } else {
      const match = updated.find(t => t.id === selectedTask.id);
      if (match) setSelectedTask(match);
    }
  };

  // Install PWA
  const handleInstallApp = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setInstallPrompt(null);
      } catch {
        setShowPWAInstallModal(true);
      }
    } else {
      setShowPWAInstallModal(true);
    }
  };

  // Leave Balances
  const myBalances = currentEmployee ? calculateEmployeeLeaveBalance(currentEmployee.id) : null;

  // Render Bhutan SMS OTP Notification Banner
  const renderSimulatedSmsToast = () => {
    if (!simulatedSmsToast) return null;
    return (
      <div className="fixed top-4 left-4 right-4 max-w-sm mx-auto z-50 animate-in slide-in-from-top duration-300">
        <div className="bg-slate-900/95 border-2 border-blue-500/80 rounded-2xl p-3.5 shadow-2xl text-white space-y-2.5 backdrop-blur-xl ring-4 ring-blue-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-black text-blue-300 uppercase tracking-wider">
                SMS Gateway (B-Mobile / TashiCell)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSimulatedSmsToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-xs leading-relaxed">
            <p className="text-slate-300">
              Dear <strong className="text-white">{simulatedSmsToast.name}</strong>, your Bhutan POS Verification Code is{' '}
              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold text-sm tracking-widest border border-blue-500/30">
                {simulatedSmsToast.otp}
              </span>. Valid for 10 minutes.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] text-slate-400 truncate">Sent to {simulatedSmsToast.mobile}</span>
            <button
              type="button"
              onClick={() => {
                setForgotPinOtpInput(simulatedSmsToast.otp);
                setSimulatedSmsToast(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer active:scale-95 transition"
            >
              <Sparkles className="h-3 w-3" />
              <span>Auto-fill OTP</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Forgot PIN / Reset via Mobile OTP Modal
  const renderForgotPinModal = () => {
    if (!showForgotPinModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-white space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Reset Staff PIN via OTP</h3>
                <p className="text-[10px] text-slate-400">Mobile SMS Verification</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForgotPinModal(false);
                setSimulatedSmsToast(null);
              }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar / Steps */}
          <div className="flex items-center justify-between px-2 text-[10px] font-bold">
            <span className={forgotPinStep === 'mobile' ? 'text-blue-400' : 'text-slate-500'}>1. Mobile</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className={forgotPinStep === 'otp' ? 'text-blue-400' : 'text-slate-500'}>2. Enter OTP</span>
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <span className={forgotPinStep === 'newPin' || forgotPinStep === 'success' ? 'text-blue-400' : 'text-slate-500'}>3. New PIN</span>
          </div>

          {/* Error Message */}
          {forgotPinError && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{forgotPinError}</span>
            </div>
          )}

          {/* Success Message */}
          {forgotPinSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{forgotPinSuccess}</span>
            </div>
          )}

          {/* STEP 1: MOBILE NUMBER INPUT */}
          {forgotPinStep === 'mobile' && (
            <form onSubmit={handleSendOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    autoFocus
                    placeholder="e.g. 17123456 or 77123456"
                    value={forgotPinMobileInput}
                    onChange={e => setForgotPinMobileInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono placeholder:text-slate-600 focus:border-blue-500 outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  We will send a 6-digit one-time password (OTP) via SMS to verify your identity.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPinModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRequestingOtp || !forgotPinMobileInput.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <span>{isRequestingOtp ? 'Sending SMS...' : 'Send OTP Code'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP */}
          {forgotPinStep === 'otp' && otpSessionInfo && (
            <form onSubmit={handleVerifyOtpAndProceed} className="space-y-4">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1 text-slate-300">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>{otpSessionInfo.employeeName}</span>
                  <span className="font-mono text-blue-400">{otpSessionInfo.maskedMobile}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Enter the 6-digit OTP code sent to your mobile phone.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="••••••"
                  value={forgotPinOtpInput}
                  onChange={e => setForgotPinOtpInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-3.5 rounded-2xl bg-slate-950 border border-blue-500/50 text-white font-mono text-2xl tracking-[0.4em] text-center focus:border-blue-400 outline-none shadow-inner"
                />
              </div>

              {/* Resend OTP */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setForgotPinStep('mobile')}
                  className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
                >
                  Wrong number? Change
                </button>
                {otpCountdown > 0 ? (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Resend in {otpCountdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtpSubmit}
                    disabled={isRequestingOtp}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Resend OTP</span>
                  </button>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForgotPinStep('mobile')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={forgotPinOtpInput.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <span>Verify & Continue</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: NEW PIN SETUP */}
          {forgotPinStep === 'newPin' && (
            <form onSubmit={handleResetPinSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Enter a new 4–6 digit security PIN</span>
                <button
                  type="button"
                  onClick={() => setForgotPinShowDigits(!forgotPinShowDigits)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  {forgotPinShowDigits ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{forgotPinShowDigits ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  New Security PIN (4-6 digits) *
                </label>
                <input
                  type={forgotPinShowDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="e.g. 5821"
                  value={forgotPinNewPin}
                  onChange={e => setForgotPinNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest outline-none focus:border-blue-500 text-base"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Security PIN *
                </label>
                <input
                  type={forgotPinShowDigits ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="Re-enter same PIN"
                  value={forgotPinConfirmPin}
                  onChange={e => setForgotPinConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest outline-none focus:border-blue-500 text-base"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForgotPinStep('otp')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtpAndResetting || !forgotPinNewPin || !forgotPinConfirmPin}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isVerifyingOtpAndResetting ? 'Saving...' : 'Save & Sign In'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: SUCCESS */}
          {forgotPinStep === 'success' && (
            <div className="text-center space-y-4 py-2">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">PIN Successfully Reset!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Your new security PIN is now active and you have been signed in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPinModal(false);
                  setSimulatedSmsToast(null);
                }}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition cursor-pointer"
              >
                Enter Staff Portal
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

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
      <div className="relative min-h-screen text-slate-900 flex flex-col justify-between p-4 sm:p-6 font-sans overflow-x-hidden">
        {/* Scenic Bhutan Iconic Landscape Background Wallpaper */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0 pointer-events-none transition-all duration-700 ease-in-out"
          style={{
            backgroundImage: `url('${bgWallpaperUrl}')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/60 via-slate-900/20 to-sky-900/30 backdrop-blur-[0.5px]" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between pt-2 max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-blue-200/90 shadow-md">
            <EzeeErpLogo size="sm" />
          </div>

          {onExitPortal && (
            <button
              onClick={onExitPortal}
              className="text-xs text-slate-700 font-extrabold hover:text-slate-900 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white border border-slate-200 shadow-sm cursor-pointer transition"
            >
              Exit
            </button>
          )}
        </div>

        {/* Center Card */}
        <div className="relative z-10 max-w-sm w-full mx-auto my-auto py-6">
          <div className="bg-white/95 border border-slate-200/90 rounded-3xl p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-2xl space-y-5">
            <div className="text-center space-y-2">
              
              {/* Ezee ERP Logo Banner inside Login Card */}
              <div className="flex justify-center pb-1">
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-blue-100 shadow-2xs inline-block">
                  <EzeeErpLogo size="md" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {isAttendanceAllowed && isAssignmentsAllowed
                    ? 'Staff Mobile Portal'
                    : isAttendanceAllowed
                    ? 'Staff Check-In & Leaves'
                    : 'Staff Tasks & Assignments'}
                </h2>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Sign in with your Mobile Number and 4-digit PIN.</p>
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Mode Switch: Mobile vs List */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLoginMethod('mobile')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  loginMethod === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Mobile Number</span>
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('list')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  loginMethod === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>Select Name</span>
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginMethod === 'mobile' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Your Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoFocus
                      placeholder="e.g. 17123456 or 77123456"
                      value={loginMobile}
                      onChange={e => setLoginMobile(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder:text-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Real-time Employee Detection Badge */}
                  {detectedEmployee && (
                    <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                      <UserCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{detectedEmployee.fullName}</span>
                        <span className="text-[10px] text-emerald-400/80">{detectedEmployee.designation} • {detectedEmployee.department}</span>
                      </div>
                    </div>
                  )}

                  {!detectedEmployee && loginMobile.trim().length >= 8 && (
                    <p className="mt-1.5 text-[11px] text-amber-300/90 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      <span>Number not found. Switch to "Select Name" or check with Admin.</span>
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Select Your Name
                  </label>
                  <select
                    value={loginMobile}
                    onChange={e => setLoginMobile(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Choose your profile...</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.contactNo || emp.empCode}>
                        {emp.fullName} ({emp.contactNo ? `Ph: ${emp.contactNo}` : emp.empCode}) - {emp.designation}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenForgotPinModal()}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition cursor-pointer hover:underline flex items-center gap-1"
                  >
                    <Smartphone className="h-3 w-3" />
                    <span>Forgot PIN?</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showLoginPin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="Enter PIN (Default: 1234)"
                    value={loginPin}
                    onChange={e => setLoginPin(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono tracking-widest text-center focus:border-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPin(!showLoginPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showLoginPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 leading-tight">
                  <span>💡 Default PIN: <strong className="text-white font-mono">1234</strong></span>
                  <button
                    type="button"
                    onClick={() => handleOpenForgotPinModal()}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                  >
                    Reset via OTP
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Sign In with PIN</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* WebAuthn Biometric Login Option */}
            {isBioSupported && (
              <div className="pt-3 border-t border-slate-700/60 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-wider justify-center">
                  <div className="h-px bg-slate-700 flex-1" />
                  <span>Or Biometric Fast Login</span>
                  <div className="h-px bg-slate-700 flex-1" />
                </div>

                <button
                  type="button"
                  disabled={isAuthenticatingBio}
                  onClick={() => handleBiometricLogin()}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/50 hover:from-slate-800 hover:to-indigo-900/50 border border-blue-500/40 text-blue-300 hover:text-white font-bold text-xs transition flex items-center justify-center gap-3 shadow-md group cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/30 transition shrink-0">
                    {bioHardware.type === 'face' ? <ScanFace className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
                  </div>
                  <div className="text-left leading-tight">
                    <span className="block font-black text-white text-xs">
                      {isAuthenticatingBio ? 'Verifying Biometrics...' : `Sign In with ${bioHardware.name}`}
                    </span>
                    <span className="text-[10px] text-blue-300/80 font-normal">
                      Touch sensor or look at camera (WebAuthn)
                    </span>
                  </div>
                </button>
              </div>
            )}

            <div className="pt-1 text-center text-[11px] text-slate-400 border-t border-slate-700/40">
              Bhutan Cloud POS • Employee Mobile Gateway
            </div>
          </div>

          {/* Quick PWA Install Card on Mobile Login Screen */}
          {!isInstalled && (
            <div 
              onClick={() => setShowPWAInstallModal(true)}
              className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border border-blue-500/30 text-white text-xs flex items-center justify-between cursor-pointer hover:border-blue-400/60 transition shadow-xl group"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0 group-hover:scale-105 transition">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-100 block">Install Staff Mobile App</span>
                  <span className="text-[10px] text-blue-300">1-Tap Attendance & Instant Task Alerts</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-blue-400 group-hover:translate-x-0.5 transition shrink-0" />
            </div>
          )}
        </div>

        {/* Footer with Ezee ERP Logo & Branding */}
        <div className="relative z-10 text-center text-[11px] font-semibold text-slate-300 pb-2 space-y-1">
          <div className="flex items-center justify-center gap-2 bg-slate-900/80 backdrop-blur-md py-1.5 px-3 rounded-full border border-slate-700/80 max-w-fit mx-auto shadow-sm">
            <EzeeErpLogo size="sm" variant="compact" />
            <span className="text-slate-400">•</span>
            <span className="text-slate-200">Encrypted Mobile Portal</span>
          </div>
        </div>

        {/* Staff PWA Install Modal */}
        <StaffPWAInstallModal
          isOpen={showPWAInstallModal}
          onClose={() => setShowPWAInstallModal(false)}
          installPrompt={installPrompt}
          onInstallAccepted={() => setIsInstalled(true)}
        />

        {/* Simulated SMS Alert & Forgot PIN Modal */}
        {renderSimulatedSmsToast()}
        {renderForgotPinModal()}
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ACTIVE EMPLOYEE MOBILE DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-20 select-none">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="hidden xs:block bg-white/10 p-1.5 rounded-xl border border-white/10 shrink-0">
            <EzeeErpLogo size="sm" variant="compact" />
          </div>
          <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
            {currentEmployee.fullName.charAt(0)}
          </div>
          <div>
            <div className="font-black text-sm text-white leading-tight flex items-center gap-1.5">
              <span>{currentEmployee.fullName}</span>
            </div>
            <div className="text-[11px] text-blue-400 font-semibold flex items-center gap-1.5">
              <span>{currentEmployee.designation}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">{currentEmployee.empCode}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* In-App Notifications Bell */}
          <button
            onClick={() => setShowNotificationsModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer relative"
            title="App Notifications"
          >
            <Bell className="h-4 w-4" />
            {staffNotifications.filter(n => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse shadow-sm">
                {staffNotifications.filter(n => !n.read).length}
              </span>
            )}
          </button>

          {/* PWA Install Button */}
          {!isInstalled && (
            <button
              onClick={() => setShowPWAInstallModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition cursor-pointer active:scale-95"
              title="Install Staff Mobile App"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Install</span>
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
            {/* Quick Install Banner if not installed */}
            {!isInstalled && (
              <div 
                onClick={() => setShowPWAInstallModal(true)}
                className="p-3 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 text-blue-200 text-xs flex items-center justify-between cursor-pointer hover:bg-blue-900/50 transition shadow-sm group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold block text-white">Install Staff App to Home Screen</span>
                    <span className="text-[10px] text-blue-300">1-Tap Fast Clock In & Assignment Alerts</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shrink-0 shadow-sm cursor-pointer"
                >
                  Install
                </button>
              </div>
            )}

            {/* Friendly reminder banner if still using default PIN 1234 */}
            {(!currentEmployee.pin || currentEmployee.pin === '1234') && (
              <div 
                onClick={() => {
                  setShowChangePinModal(true);
                  setChangePinError('');
                  setChangePinSuccess('');
                }}
                className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold block">Using Default PIN (1234)</span>
                    <span className="text-[10px] text-amber-300/80">Tap to set your personal secret PIN</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-400 text-amber-950 shrink-0">
                  Change PIN
                </span>
              </div>
            )}

            {/* Quick Biometric Enable Banner if supported and not yet enrolled */}
            {isBioSupported && !isEmployeeBiometricRegistered(currentEmployee.id) && (
              <div 
                onClick={handleEnrollBiometrics}
                className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between cursor-pointer hover:bg-indigo-500/20 transition shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    {bioHardware.type === 'face' ? <ScanFace className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
                  </div>
                  <div className="truncate">
                    <span className="font-bold block">Enable {bioHardware.name} Login</span>
                    <span className="text-[10px] text-indigo-300/80">Sign in with 1-tap next time (No PIN needed)</span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isRegisteringBio}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 shadow-sm cursor-pointer"
                >
                  {isRegisteringBio ? 'Enrolling...' : 'Enable'}
                </button>
              </div>
            )}

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
              {officeSecurityConfig.requireOfficeNetwork ? (
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
              ) : (
                <div className="py-1">
                  <div className="flex items-center justify-between py-2 px-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="font-semibold truncate">Network Restriction: Off (Home & Remote Clock In Allowed)</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded-full font-bold">
                      Open
                    </span>
                  </div>
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
            <div className="grid grid-cols-2 gap-2.5">
              {leaveTypes.map(t => {
                const b = myBalances?.balances[t.id];
                const rem = b ? b.remaining : t.defaultDays;
                const isDailyAccrual = t.allocationMode === 'daily_accrual' || b?.allocationMode === 'daily_accrual';

                return (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.code}</span>
                      {isDailyAccrual && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-950/80 border border-blue-500/40 text-blue-400 text-[9px] font-bold flex items-center gap-1">
                          ⚡ Daily Earned
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black text-white truncate">{t.name}</div>
                    <div className="text-lg font-black text-emerald-400 font-mono">
                      {rem} <span className="text-xs text-slate-500 font-normal">days left</span>
                    </div>
                    {isDailyAccrual && b && (
                      <div className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/60 flex items-center justify-between">
                        <span>Accrued YTD:</span>
                        <span className="font-mono font-bold text-slate-300">{b.allocated}d</span>
                      </div>
                    )}
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

            {/* Company Holidays & Weekly-Off Schedule for Staff Information */}
            {(() => {
              const policy = getCompanyHolidayPolicy(companyId);
              const activeHolidays = (policy.holidays || []).filter(h => h.enabled);
              return (
                <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white">Company Holidays & Weekly-Offs</h4>
                        <p className="text-[10px] text-slate-400">
                          {policy.weeklyOffMode === 'saturday_sunday' 
                            ? '5-Day Work Week (Sat & Sun Off)' 
                            : policy.weeklyOffMode === 'sunday_only'
                            ? '6-Day Work Week (Sunday Only Off)'
                            : 'Standard Schedule'} • Auto-excluded from leave
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                      {activeHolidays.length} Holidays
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {activeHolidays.map(h => (
                      <div key={h.id} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-200 truncate pr-2">{h.name}</span>
                        <span className="font-mono text-[10px] text-indigo-400 shrink-0">📅 {h.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-slate-400">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{task.comments ? task.comments.length : 0} Notes</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          <span>Reply</span>
                        </button>
                      </div>
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

              {/* SECURITY & PORTAL PIN CARD */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">Staff Sign-In PIN</h4>
                      <p className="text-[10px] text-slate-400">Used with mobile {currentEmployee.contactNo || ''}</p>
                    </div>
                  </div>

                  {(!currentEmployee.pin || currentEmployee.pin === '1234') ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                      Default: 1234
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Custom PIN Set</span>
                    </span>
                  )}
                </div>

                {(!currentEmployee.pin || currentEmployee.pin === '1234') && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Default PIN is in use (1234)</span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 leading-relaxed">
                      To keep your personal attendance and leaves secure, change this to a secret 4-6 digit PIN.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePinModal(true);
                      setChangePinError('');
                      setChangePinSuccess('');
                      setCurrentPinInput('');
                      setNewPinInput('');
                      setConfirmPinInput('');
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10 active:scale-98"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{(!currentEmployee.pin || currentEmployee.pin === '1234') ? 'Set Personal Security PIN' : 'Change Security PIN'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenForgotPinModal(currentEmployee.contactNo)}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-800"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                    <span>Forgot PIN? Reset via Mobile OTP</span>
                  </button>
                </div>
              </div>

              {/* BIOMETRIC AUTHENTICATION & WEBAUTHN CARD */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-5 text-left space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-sm">
                      {bioHardware.type === 'face' ? <ScanFace className="h-5 w-5" /> : <Fingerprint className="h-5 w-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Biometric Sign-In</h4>
                      <p className="text-[10px] text-slate-400">WebAuthn / FIDO2 • {bioHardware.name}</p>
                    </div>
                  </div>

                  {isEmployeeBiometricRegistered(currentEmployee.id) ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Active & Enrolled</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1 shadow-xs">
                      <Shield className="h-3 w-3" />
                      <span>Not Enabled</span>
                    </span>
                  )}
                </div>

                {bioEnrollSuccess && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="font-medium">{bioEnrollSuccess}</span>
                  </div>
                )}

                {bioEnrollError && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2.5 animate-in fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span className="font-medium">{bioEnrollError}</span>
                  </div>
                )}

                {isBioSupported ? (
                  <div className="space-y-3">
                    {isEmployeeBiometricRegistered(currentEmployee.id) ? (
                      /* Enrolled State */
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Your device is enrolled for fast hardware-backed biometric sign-in. You can authenticate using your {bioHardware.name} on the portal login screen without entering your PIN.
                        </p>

                        {currentEmployee.biometricCredentials && currentEmployee.biometricCredentials.length > 0 && (
                          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                              <span>Registered Passkeys & Devices</span>
                            </span>
                            {currentEmployee.biometricCredentials.map(cred => (
                              <div key={cred.id} className="flex items-center justify-between text-xs text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                                <div className="flex items-center gap-2 truncate">
                                  <Smartphone className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                  <span className="truncate font-medium">{cred.deviceName || 'Mobile Device Authenticator'}</span>
                                </div>
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">{new Date(cred.createdAt).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isRegisteringBio}
                            onClick={handleEnrollBiometrics}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 font-bold text-xs transition cursor-pointer text-center active:scale-98"
                          >
                            {isRegisteringBio ? 'Updating...' : 'Re-enroll / Add Device'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBiometrics()}
                            className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-xs transition cursor-pointer active:scale-98"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Not Enrolled State - Dedicated Promotion & Security Benefits Explanation */
                      <div className="space-y-3.5">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/25 space-y-2.5">
                          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                            <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                            <span>Why Enable {bioHardware.name} Sign-In?</span>
                          </div>

                          <div className="space-y-2 text-[11px] text-slate-300">
                            <div className="flex items-start gap-2">
                              <div className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[9px]">
                                🛡️
                              </div>
                              <p className="leading-snug">
                                <strong className="text-white">Hardware-Protected Security:</strong> Private keys stay locked in your device's Secure Enclave/TPM chip. Immune to keyloggers and network phishing.
                              </p>
                            </div>

                            <div className="flex items-start gap-2">
                              <div className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[9px]">
                                ⚡
                              </div>
                              <p className="leading-snug">
                                <strong className="text-white">Instant 1-Tap Access:</strong> Clock in, apply for leaves, and manage tasks in seconds without having to type or remember your PIN.
                              </p>
                            </div>

                            <div className="flex items-start gap-2">
                              <div className="h-4 w-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[9px]">
                                🔒
                              </div>
                              <p className="leading-snug">
                                <strong className="text-white">Shoulder-Surfing Proof:</strong> Prevents unauthorized access or attendance clock-ins by colleagues in busy retail/office environments.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Dedicated Biometric Enrollment Button */}
                        <button
                          type="button"
                          disabled={isRegisteringBio}
                          onClick={handleEnrollBiometrics}
                          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 disabled:opacity-50 group"
                        >
                          <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition shrink-0">
                            {bioHardware.type === 'face' ? <ScanFace className="h-3.5 w-3.5" /> : <Fingerprint className="h-3.5 w-3.5" />}
                          </div>
                          <span className="text-sm">
                            {isRegisteringBio ? 'Verifying Sensor & Enrolling...' : `Enable ${bioHardware.name} Sign-In Now`}
                          </span>
                        </button>
                        
                        <p className="text-center text-[10px] text-slate-400">
                          Takes ~5 seconds • You can still use your 4-digit PIN anytime as fallback.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      WebAuthn biometric authentication is not supported by your current browser or device. You can continue logging in securely using your 4-digit PIN.
                    </p>
                  </div>
                )}
              </div>

              {/* Install PWA Button / Status Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">Staff Mobile App (PWA)</h4>
                      <p className="text-[11px] text-slate-400">
                        {isInstalled ? 'Running as standalone installed app' : 'Install for 1-tap clock & task notifications'}
                      </p>
                    </div>
                  </div>
                  {isInstalled ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                      Installed ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPWAInstallModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Install
                    </button>
                  )}
                </div>

                {!isInstalled && (
                  <button
                    type="button"
                    onClick={() => setShowPWAInstallModal(true)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Add App to Phone Home Screen</span>
                  </button>
                )}
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
                  rows={2}
                  required
                  placeholder="Detail reason for leave..."
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                />
              </div>

              {/* Dynamic Auto-Exclusion Breakdown Badge */}
              {leaveForm.startDate && leaveForm.endDate && (() => {
                const breakdown = calculateLeaveDeductionBreakdown(leaveForm.startDate, leaveForm.endDate, leaveForm.isHalfDay, companyId);
                return (
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Calendar Days:</span>
                      <span className="font-mono font-bold text-white">{breakdown.totalCalendarDays} Day(s)</span>
                    </div>
                    {breakdown.weeklyOffDaysCount > 0 && (
                      <div className="flex items-center justify-between text-emerald-400">
                        <span>Weekly Offs Excluded:</span>
                        <span className="font-mono font-bold">-{breakdown.weeklyOffDaysCount} Day(s)</span>
                      </div>
                    )}
                    {breakdown.holidayDaysCount > 0 && (
                      <div className="flex items-start justify-between text-indigo-400 gap-2">
                        <span className="truncate">Holidays Excluded ({breakdown.holidayDetails.map(h => h.name).join(', ')}):</span>
                        <span className="font-mono font-bold shrink-0">-{breakdown.holidayDaysCount} Day(s)</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between font-black text-xs text-blue-400">
                      <span>Actual Leave Deduction:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 font-mono">
                        {breakdown.effectiveDeductionDays} Day(s)
                      </span>
                    </div>
                  </div>
                );
              })()}

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

            {/* Reply Success Feedback Toast */}
            {taskReplySuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{taskReplySuccess}</span>
              </div>
            )}

            {/* Reply Input Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendComment();
              }} 
              className="flex items-center gap-2 pt-2 border-t border-slate-800"
            >
              <input
                type="text"
                placeholder="Type your reply to manager..."
                value={taskCommentText}
                onChange={e => setTaskCommentText(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!taskCommentText.trim()}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shrink-0 active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Reply</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2B: IN-APP STAFF NOTIFICATIONS DRAWER */}
      {/* ============================================================== */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-3.5 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Notifications</h3>
                  <p className="text-[10px] text-slate-400">
                    {staffNotifications.filter(n => !n.read).length} unread alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {staffNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearStaffNotifications(currentEmployee.id, companyId);
                      setStaffNotifications([]);
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotificationsModal(false)}
                  className="h-7 w-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {staffNotifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    markStaffNotificationRead(n.id, companyId);
                    setStaffNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                    if (n.taskId) {
                      const match = myTasks.find(t => t.id === n.taskId);
                      if (match) {
                        setSelectedTask(match);
                        setShowNotificationsModal(false);
                        setActiveTab('tasks');
                      }
                    } else if (n.linkTab) {
                      setActiveTab(n.linkTab);
                      setShowNotificationsModal(false);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                    !n.read 
                      ? 'bg-slate-800/90 border-blue-500/40 shadow-sm' 
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{n.message}</p>
                  <div className="text-[9px] text-slate-500 font-mono pt-1">
                    {new Date(n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {staffNotifications.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  No notifications yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CHANGE SECURITY PIN MODAL */}
      {/* ============================================================== */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Change Security PIN</h3>
                  <p className="text-[10px] text-slate-400">Mobile: {currentEmployee.contactNo || currentEmployee.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="h-7 w-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {changePinSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{changePinSuccess}</span>
              </div>
            )}

            {changePinError && (
              <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{changePinError}</span>
              </div>
            )}

            <form onSubmit={handleChangePinSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Current PIN *
                </label>
                <input
                  type={showNewPinToggle ? 'text' : 'password'}
                  required
                  maxLength={6}
                  placeholder="Enter current PIN (Default: 1234)"
                  value={currentPinInput}
                  onChange={e => setCurrentPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Default PIN is <strong className="text-white font-mono">1234</strong> if you have never changed it.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    New PIN (4 to 6 Digits) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewPinToggle(!showNewPinToggle)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    {showNewPinToggle ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showNewPinToggle ? 'Hide Digits' : 'Show Digits'}</span>
                  </button>
                </div>
                <input
                  type={showNewPinToggle ? 'text' : 'password'}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Choose 4 to 6 digit secret PIN"
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New PIN *
                </label>
                <input
                  type={showNewPinToggle ? 'text' : 'password'}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Re-enter your new PIN"
                  value={confirmPinInput}
                  onChange={e => setConfirmPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPin}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{isChangingPin ? 'Updating...' : 'Save New PIN'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff PWA Install Modal */}
      <StaffPWAInstallModal
        isOpen={showPWAInstallModal}
        onClose={() => setShowPWAInstallModal(false)}
        installPrompt={installPrompt}
        onInstallAccepted={() => setIsInstalled(true)}
      />

      {/* Simulated SMS Alert & Forgot PIN Modal */}
      {renderSimulatedSmsToast()}
      {renderForgotPinModal()}
    </div>
  );
};
