import React, { useState, useEffect, useRef } from 'react';
import { getInitialData, getVoucherTypes, saveLedger, getVoucherDetails, migrateExistingItemsOpeningAmount, saveConfig, setDeviceCounterId, setTerminalBranchId } from './services/storageService';
import { initSupabaseSync, subscribeSupabaseStatus, seedInitialLocalDataToSupabase } from './services/supabaseSyncService';
import { initAutoBackupScheduler } from './services/backupService';
import { Config, Item, Unit, UnitGroup, ItemGroup, Ledger, LedgerGroup, HeldBill, BarcodeQueueItem, VoucherType } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { SalesInvoiceEntry } from './components/SalesInvoiceEntry';
import { POSBilling } from './components/POSBilling';
import { QuickLedgerModal } from './components/QuickLedgerModal';
import { QuickItemModal } from './components/QuickItemModal';
import { PurchaseEntry } from './components/PurchaseEntry';
import { Vouchers } from './components/Vouchers';
import { Masters } from './components/Masters';
import { BarcodePrinting } from './components/BarcodePrinting';
import { Payroll } from './components/Payroll';
import { StaffManagementView } from './components/employee/StaffManagementView';
import { EmployeePortalApp } from './components/employee/EmployeePortalApp';
import { AssetManagementModule } from './components/assetManagement/AssetManagementModule';
import { Reports, ReportTarget } from './components/Reports';
import { SettingsView } from './components/SettingsView';
import { SchemeManagement } from './components/SchemeManagement';
import { SuperadminDashboard } from './components/SuperadminDashboard';
import { BankReconciliation } from './components/BankReconciliation';
import { DrillModal, TargetState } from './components/DrillModal';
import { QuickLedgerSearchModal } from './components/QuickLedgerSearchModal';
import { TrashModal } from './components/TrashModal';
import { BulkDeleteModal } from './components/BulkDeleteModal';
import { CompanyManagerModal } from './components/CompanyManagerModal';
import { UserAuthModal } from './components/UserAuthModal';
import { LoginGate } from './components/LoginGate';
import { getActiveUser } from './services/storageService';
import { AppUser } from './types';
import { 
  fetchUserCompanies, 
  fetchFinancialYears, 
  fetchTenantRemoteConfig,
  getActiveCompanyId, 
  setActiveCompanyId,
  getActiveFYId, 
  getDedicatedCompanyIdFromUrl,
  DEFAULT_TENANT_COMPANY,
  SupabaseCompany, 
  SupabaseFinancialYear 
} from './services/supabaseTenantService';
import { db } from './lib/firebase';
import { isFeatureAllowed } from './services/tenantFeatureService';
import { isModulePermitted } from './utils/permissionUtils';
import { Lock } from 'lucide-react';
import { 
  isSuperAdmin, 
  getCurrentTenantSession, 
  subscribeTenantSession 
} from './services/authTenantContext';

interface DrillReturnContext {
  activeDrill: { type: 'group' | 'stock' | 'ledger' | 'voucher' | 'item-profit'; targetId: string; fromDate?: string; toDate?: string };
  drillHistory: TargetState[];
  fromView: string;
}

export default function App() {
  const [viewHistory, setViewHistory] = useState<string[]>(['dashboard']);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Drilldown Modal State & History Stack
  const [drillModal, setDrillModal] = useState<{
    type: 'group' | 'stock' | 'ledger' | 'voucher' | 'item-profit' | null;
    targetId: string | null;
    fromDate?: string;
    toDate?: string;
  }>({ type: null, targetId: null });
  const [drillInitialHistory, setDrillInitialHistory] = useState<TargetState[]>([]);
  const [drillReturnContext, setDrillReturnContext] = useState<DrillReturnContext | null>(null);
  const [showGlobalLedgerSearch, setShowGlobalLedgerSearch] = useState(false);

  // Firebase status
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'syncing' | 'offline' | 'error'>('syncing');
  const [firebaseMessage, setFirebaseMessage] = useState<string>('');

  // Pre-POS Voucher Type Selection State
  const [selectedSaleVoucherType, setSelectedSaleVoucherType] = useState<VoucherType | null>(null);
  const [mastersInitialTab, setMastersInitialTab] = useState<any>('items');

  // Sequential Navigation Functions
  const navigateTo = (view: string, reportTargetOverride?: any, keepTarget?: boolean) => {
    if (!keepTarget) setVoucherTarget(null);
    if (view === 'trash') {
      setShowTrashModal(true);
      return;
    }
    // Strict permission check for direct navigation
    if (view !== 'dashboard' && !isModulePermitted(currentUser, view, 'display')) {
      return;
    }
    if (view === 'pos') {
      handleOpenPOSBilling(keepTarget);
      return;
    }
    if (view === 'reports' && reportTargetOverride !== undefined) {
      setReportTarget(reportTargetOverride);
    }
    if (view === currentView && view !== 'reports') return;
    setCurrentView(view);
    setViewHistory(prev => {
      if (prev[prev.length - 1] === view) return prev;
      return [...prev, view];
    });
  };

  const handleOpenPOSBilling = (keepTarget?: boolean) => {
    if (!keepTarget) setVoucherTarget(null);
    setSelectedSaleVoucherType(null);
    setCurrentView('pos');
    setViewHistory(prev => (prev[prev.length - 1] === 'pos' ? prev : [...prev, 'pos']));
    setIsMobileOpen(false);
  };

  const navigateBackDirect = () => {
    setVoucherTarget(null);

    // 3. If we came from a Drilldown (via Open in Entry), go back to the original view
    if (drillReturnContext) {
      const { fromView, activeDrill, drillHistory } = drillReturnContext;
      setDrillReturnContext(null);
      setCurrentView(fromView);

      // If activeDrill was a voucher, we don't re-open the exact same voucher detailed view modal
      // that we just opened in full entry! Instead, step back to its parent in drillHistory (if any).
      if (activeDrill.type === 'voucher') {
        if (drillHistory && drillHistory.length > 0) {
          const parentDrill = drillHistory[drillHistory.length - 1];
          const parentHistory = drillHistory.slice(0, -1);
          setDrillInitialHistory(parentHistory);
          setDrillModal({
            type: parentDrill.type,
            targetId: parentDrill.targetId
          });
        } else {
          setDrillModal({ type: null, targetId: null });
          setDrillInitialHistory([]);
        }
      } else {
        setDrillInitialHistory(drillHistory);
        setDrillModal({
          type: activeDrill.type,
          targetId: activeDrill.targetId
        });
      }

      setViewHistory(prev => {
        const idx = prev.lastIndexOf(fromView);
        if (idx !== -1) {
          return prev.slice(0, idx + 1);
        }
        return ['dashboard', fromView];
      });
      return;
    }

    // 4. Pop standard view history relative to currentView
    setViewHistory(prev => {
      let updated = [...prev];
      while (updated.length > 0 && updated[updated.length - 1] === currentView) {
        updated.pop();
      }
      const targetView = updated.length > 0 ? updated[updated.length - 1] : 'dashboard';
      setCurrentView(targetView);
      return updated.length > 0 ? updated : ['dashboard'];
    });
  };

  const navigateBack = (forceDirect: boolean = false) => {
    if (forceDirect === true) {
      navigateBackDirect();
      return;
    }

    if (showTrashModal) {
      setShowTrashModal(false);
      return;
    }
    if (showBulkDeleteModal) {
      setShowBulkDeleteModal(false);
      return;
    }
    if (showGlobalLedgerSearch) {
      setShowGlobalLedgerSearch(false);
      return;
    }
    if (quickLedgerModalProps.isOpen) {
      setQuickLedgerModalProps(p => ({ ...p, isOpen: false }));
      return;
    }
    if (quickItemModalProps.isOpen) {
      setQuickItemModalProps(p => ({ ...p, isOpen: false }));
      return;
    }

    // 1. If drilldown modal is open, dispatch app:back so DrillModal steps back sequentially
    if (drillModal?.type) {
      const backEvent = new CustomEvent('app:back', { cancelable: true });
      window.dispatchEvent(backEvent);
      return;
    }

    // 2. Allow active sub-screen or modal to handle back navigation first
    const backEvent = new CustomEvent('app:back', { cancelable: true });
    const notHandled = window.dispatchEvent(backEvent);
    if (!notHandled) return;

    navigateBackDirect();
  };

  // Store State
  const [config, setConfig] = useState<Config>({
    CompanyName: 'My Store',
    Address: '',
    CompanyGSTNo: '',
    CompanyTPNNo: '',
    GSTRate: '5',
    CurrencySymbol: 'Nu.',
    Bank1Ledger: 'BOB Account',
    Bank2Ledger: 'BNBL Account',
    CompanyBankDetails: '',
    EnableGST: 'true',
    EnableSerials: 'true',
    EnablePharmacyBatch: 'true',
    EnableSpareParts: 'false',
    EnableRackBin: 'true',
    EnableCompatibility: 'true',
    PrintPartNumber: 'true',
    PrintCompatibility: 'false',
    BarcodePrefix: '20',
    ReceiptHeaderImage: '',
    ReceiptSignatureImage: ''
  });
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerGroups, setLedgerGroups] = useState<LedgerGroup[]>([]);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // Drilldown Modal
  // (State declared above with drillReturnContext)

  // Direct Voucher Navigation Target (from drill-down or reports into voucher entry)
  const [voucherTarget, setVoucherTarget] = useState<{ voucherNo: string; timestamp: number; isDuplicate?: boolean } | null>(null);

  // Trash & Bulk Delete Modals
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Quick Masters Trigger
  const [openItemModalCode, setOpenItemModalCode] = useState<string | null>(null);
  const [openLedgerModalGroup, setOpenLedgerModalGroup] = useState<string | null>(null);

  // Barcode Printing Queue State
  const [barcodeQueueInitial, setBarcodeQueueInitial] = useState<BarcodeQueueItem[]>([]);
  const [quickLedgerModalProps, setQuickLedgerModalProps] = useState<{isOpen: boolean, group: string, onSelect?: (name: string) => void}>({isOpen: false, group: 'Sundry Debtors'});
  const [quickItemModalProps, setQuickItemModalProps] = useState<{isOpen: boolean, itemToEdit?: Item | null, onSelect?: (item: Item) => void}>({isOpen: false});

  // Multi-Tenant & User Auth State
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUserAuthModal, setShowUserAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    const dedicatedId = getDedicatedCompanyIdFromUrl();
    const rawLocalRole = (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('deep_pos_auth_role') ||
         localStorage.getItem('supabase_active_role') ||
         localStorage.getItem('user_role') ||
         localStorage.getItem('role') ||
         '')
      : '').toLowerCase().trim();
    const isSuper = rawLocalRole === 'superadmin' || isSuperAdmin();
    const storedAssignedCompany = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_assigned_company') : null;

    // Strict client isolation: If visiting a dedicated client link and stored credentials belong to a different company (and user is not superadmin):
    if (dedicatedId && !isSuper && storedAssignedCompany && storedAssignedCompany !== dedicatedId) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('deep_pos_auth_assigned_company');
        localStorage.removeItem('deep_pos_auth_role');
        localStorage.removeItem('deep_pos_auth_uid');
        localStorage.removeItem('deep_pos_active_user');
        localStorage.removeItem('deep_pos_active_user_id');
        localStorage.setItem('supabase_active_company_id', dedicatedId);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('bhutan_pos_session_unlocked');
        sessionStorage.removeItem('supabase_active_session_company');
      }
    }

    const base = getActiveUser();
    if (dedicatedId && !isSuper && base && base.assignedCompanyId && base.assignedCompanyId !== dedicatedId) {
      return null;
    }
    if (isSuper) {
      return {
        ...base,
        id: 'usr_superadmin',
        username: 'superadmin',
        fullName: 'Superadmin',
        role: 'superadmin' as any
      };
    }
    return base;
  });
  const [isTerminalLocked, setIsTerminalLocked] = useState<boolean>(() => {
    const dedicatedId = getDedicatedCompanyIdFromUrl();
    const rawLocalRole = (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('deep_pos_auth_role') ||
         localStorage.getItem('supabase_active_role') ||
         localStorage.getItem('user_role') ||
         localStorage.getItem('role') ||
         '')
      : '').toLowerCase().trim();
    const isSuper = rawLocalRole === 'superadmin' || isSuperAdmin();
    const storedAssignedCompany = typeof localStorage !== 'undefined' ? localStorage.getItem('deep_pos_auth_assigned_company') : null;

    // If accessing dedicated client link:
    if (dedicatedId) {
      // If user was logged in as a non-superadmin for another client:
      if (!isSuper && storedAssignedCompany && storedAssignedCompany !== dedicatedId) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('bhutan_pos_session_unlocked');
          sessionStorage.removeItem('supabase_active_session_company');
        }
        return true; // Strictly lock to show this client's login screen!
      }
      // If session in this tab was for a different company:
      const sessionCompany = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('supabase_active_session_company') : null;
      if (sessionCompany && sessionCompany !== dedicatedId && !isSuper) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('bhutan_pos_session_unlocked');
          sessionStorage.removeItem('supabase_active_session_company');
        }
        return true;
      }
      // If no valid session for this dedicatedId:
      const sessionUnlocked = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('bhutan_pos_session_unlocked') : null;
      if (sessionUnlocked !== 'true' || sessionCompany !== dedicatedId) {
        return true;
      }
    }

    // Require explicit authentication by default: lock screen until a valid session is confirmed
    const sessionUnlocked = sessionStorage.getItem('bhutan_pos_session_unlocked');
    return sessionUnlocked !== 'true';
  });
  const [activeCompany, setActiveCompany] = useState<SupabaseCompany | null>(null);
  const [activeFY, setActiveFY] = useState<SupabaseFinancialYear | null>(null);

  // Load active company and FY details
  const loadTenantDetails = async () => {
    try {
      const dedicatedId = getDedicatedCompanyIdFromUrl();
      if (dedicatedId) {
        setActiveCompanyId(dedicatedId);
      }
      const cId = getActiveCompanyId();
      const fyId = getActiveFYId();
      const { companies: comps } = await fetchUserCompanies(Boolean(dedicatedId));
      let currentC: SupabaseCompany | undefined;
      
      if (dedicatedId) {
        currentC = comps.find(c => c.id === dedicatedId) || comps[0];
        if (!currentC || currentC.id !== dedicatedId) {
          currentC = {
            id: dedicatedId,
            company_name: 'Client Workspace',
            currency_symbol: 'Nu.'
          };
        }
        // Asynchronously enrich company details from Firestore/Supabase if needed
        if (currentC.company_name === 'Client Workspace') {
          try {
            const { getDoc, doc } = await import('firebase/firestore');
            const snap = await getDoc(doc(db, 'companies', dedicatedId));
            if (snap.exists()) {
              currentC = { ...currentC, ...(snap.data() as SupabaseCompany) };
            }
          } catch {}
        }
      } else {
        currentC = comps.find(c => c.id === cId) || comps.find(c => c.id === DEFAULT_TENANT_COMPANY.id) || comps[0];
      }

      if (currentC) {
        if (currentC.id !== cId && !dedicatedId) {
          setActiveCompanyId(currentC.id);
        }
        setActiveCompany(currentC);
        // Automatically sync company profile and remote config
        const remoteCfg = await fetchTenantRemoteConfig(currentC.id);
        const data = getInitialData();
        const merged: Config = {
          ...data.config,
          ...(remoteCfg || {}),
          CompanyName: currentC.company_name || data.config.CompanyName,
          Address: currentC.address || data.config.Address,
          CompanyTPNNo: currentC.tax_payer_id || data.config.CompanyTPNNo,
          CompanyGSTNo: currentC.trade_license_no || data.config.CompanyGSTNo,
          CompanyPhone: currentC.phone || data.config.CompanyPhone,
          CompanyEmail: currentC.email || data.config.CompanyEmail,
          CurrencySymbol: currentC.currency_symbol || data.config.CurrencySymbol
        };
        saveConfig(merged);
        setConfig(merged);

        const { financialYears: fys } = await fetchFinancialYears(currentC.id);
        const currentF = fys.find(f => f.id === fyId) || fys[0];
        if (currentF) setActiveFY(currentF);
      }
    } catch (e) {
      console.warn('Error loading tenant details:', e);
    }
  };

  const supabaseUnsubRef = useRef<(() => void) | null>(null);

  const [isEmployeePortalMode, setIsEmployeePortalMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('portal') === 'employee' || p.get('portal') === 'staff' || p.get('mode') === 'staff' || p.get('mode') === 'employee';
    }
    return false;
  });

  // Dedicated Client Link URL Query Parameter Auto-Initializer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dedicatedId = getDedicatedCompanyIdFromUrl();
      if (dedicatedId) {
        setActiveCompanyId(dedicatedId);
        const storedRole = (localStorage.getItem('deep_pos_auth_role') || '').toLowerCase().trim();
        const storedAssigned = localStorage.getItem('deep_pos_auth_assigned_company');
        if (storedRole !== 'superadmin' && storedAssigned && storedAssigned !== dedicatedId) {
          localStorage.removeItem('deep_pos_auth_assigned_company');
          localStorage.removeItem('deep_pos_auth_role');
          localStorage.removeItem('deep_pos_auth_uid');
          sessionStorage.removeItem('bhutan_pos_session_unlocked');
          sessionStorage.removeItem('supabase_active_session_company');
          setIsTerminalLocked(true);
        }
      }

      const urlParams = new URLSearchParams(window.location.search);
      const counterParam = urlParams.get('counter') || urlParams.get('terminal');
      const branchParam = urlParams.get('branch');
      const viewParam = urlParams.get('view');
      const portalParam = urlParams.get('portal');
      const modeParam = urlParams.get('mode');

      if (portalParam === 'employee' || portalParam === 'staff' || modeParam === 'staff' || modeParam === 'employee') {
        setIsEmployeePortalMode(true);
      }

      if (counterParam) {
        const cleanCounter = counterParam.trim().toUpperCase();
        setDeviceCounterId(cleanCounter);
      }
      if (branchParam) {
        setTerminalBranchId(branchParam.trim());
      }
      if (viewParam) {
        const cleanView = viewParam.trim().toLowerCase();
        if (['pos', 'normalsale', 'sales', 'reports', 'masters', 'vouchers', 'dashboard', 'payroll', 'staff'].includes(cleanView)) {
          setCurrentView(cleanView);
        }
      }
    } catch (err) {
      console.warn('[Dedicated Client Link Init Error]:', err);
    }
  }, []);

  useEffect(() => {
    loadTenantDetails();
    const handleTenantChange = () => {
      loadTenantDetails();
      refreshData();
      if (supabaseUnsubRef.current) {
        supabaseUnsubRef.current();
      }
      supabaseUnsubRef.current = initSupabaseSync(() => {
        refreshData();
      });
    };

    const handleRemoteDataChanged = () => {
      refreshData();
    };

    window.addEventListener('supabase:tenant_changed', handleTenantChange);
    window.addEventListener('supabase:company_updated', handleTenantChange);
    window.addEventListener('supabase:fy_changed', handleTenantChange);
    window.addEventListener('popstate', handleTenantChange);
    window.addEventListener('app:dataLoaded', handleRemoteDataChanged);
    window.addEventListener('app:refresh-data', handleRemoteDataChanged);
    window.addEventListener('deep_pos_items_updated', handleRemoteDataChanged);
    window.addEventListener('deep_pos_sales_updated', handleRemoteDataChanged);

    const unsubSession = subscribeTenantSession(session => {
      if (session) {
        const isSuper = session.isSuperadmin || (session.role && session.role.toLowerCase() === 'superadmin');
        const activeU = getActiveUser();
        setCurrentUser(prev => {
          if (activeU && (activeU.id === session.uid || activeU.username === session.email?.split('@')[0])) {
            return activeU;
          }
          return {
            ...prev,
            ...(activeU || {}),
            id: session.uid || prev.id,
            username: isSuper ? 'superadmin' : (session.email?.split('@')[0] || prev.username),
            fullName: session.fullName || (isSuper ? 'Superadmin' : prev.fullName),
            role: (activeU?.role || session.role) as any,
            permissions: activeU?.permissions || prev.permissions
          };
        });
      }
    });

    const handlePermissionsUpdated = () => {
      const activeU = getActiveUser();
      if (activeU) {
        setCurrentUser(activeU);
      }
    };
    window.addEventListener('app:user_permissions_updated', handlePermissionsUpdated);

    return () => {
      window.removeEventListener('supabase:tenant_changed', handleTenantChange);
      window.removeEventListener('supabase:company_updated', handleTenantChange);
      window.removeEventListener('supabase:fy_changed', handleTenantChange);
      window.removeEventListener('popstate', handleTenantChange);
      window.removeEventListener('app:dataLoaded', handleRemoteDataChanged);
      window.removeEventListener('app:refresh-data', handleRemoteDataChanged);
      window.removeEventListener('deep_pos_items_updated', handleRemoteDataChanged);
      window.removeEventListener('deep_pos_sales_updated', handleRemoteDataChanged);
      window.removeEventListener('app:user_permissions_updated', handlePermissionsUpdated);
      unsubSession();
    };
  }, []);

  // State Ref to prevent stale closures in global key listeners
  const appStateRef = useRef({
    showTrashModal,
    showBulkDeleteModal,
    showGlobalLedgerSearch,
    quickLedgerModalProps,
    quickItemModalProps,
    drillModal,
    drillReturnContext,
    currentView,
    viewHistory
  });
  appStateRef.current = {
    showTrashModal,
    showBulkDeleteModal,
    showGlobalLedgerSearch,
    quickLedgerModalProps,
    quickItemModalProps,
    drillModal,
    drillReturnContext,
    currentView,
    viewHistory
  };

  const refreshData = () => {
    const data = getInitialData();
    setConfig(data.config);
    setItems(data.items);
    setUnits(data.units);
    setUnitGroups(data.unitGroups);
    setItemGroups(data.itemGroups);
    setCategories(data.categories || []);
    setLedgers(data.ledgers);
    setLedgerGroups(data.ledgerGroups);
    setHeldBills(data.heldBills);
  };


  useEffect(() => {
    const handleUpdateConfig = (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        saveConfig(e.detail);
        refreshData();
      }
    };
    window.addEventListener('app:updateConfig', handleUpdateConfig);
    return () => {
      window.removeEventListener('app:updateConfig', handleUpdateConfig);
    };
  }, []);

  useEffect(() => {
    migrateExistingItemsOpeningAmount();

    refreshData();
    
    // Subscribe to Supabase sync status updates
    const unsubStatus = subscribeSupabaseStatus((status, msg) => {
      setFirebaseStatus(status);
      if (msg) setFirebaseMessage(msg);
    });

    // Initialize real-time Supabase synchronization
    supabaseUnsubRef.current = initSupabaseSync(() => {
      refreshData();
    });

    // Seed local items & ledgers to Supabase on initial load
    seedInitialLocalDataToSupabase().catch(() => {});

    // Initialize background auto-backup timer & scheduler
    initAutoBackupScheduler();

    const handleAppNavigate = (e: any) => {
      if (e.detail?.view) {
        if (e.detail.view === 'reports') {
          const target: any = { timestamp: Date.now(), ...e.detail };
          delete target.view;
          delete target.report;

          // Legacy mappings
          const r = e.detail.report?.toLowerCase() || '';
          if (r) {
            if (r.includes('sales')) target.category = 'daily';
            else if (r.includes('stock')) target.category = 'inv';
            else if (r.includes('gst')) target.category = 'gst';
            else if (r.includes('ledger')) { target.category = 'fin'; target.finSubTab = 'LED'; target.ledgerName = e.detail.ledgerName; }
            else if (r.includes('trial')) { target.category = 'fin'; target.finSubTab = 'TB'; }
            else if (r.includes('itemwise') || r.includes('item-profit') || r.includes('item profit')) { target.category = 'inv'; target.invSubTab = 'prof'; }
            else if (r.includes('profit')) { target.category = 'fin'; target.finSubTab = 'PNL'; }
            else if (r.includes('balance')) { target.category = 'fin'; target.finSubTab = 'BS'; }
          }
          
          if (!target.category && !target.ledgerName) {
            setReportTarget(null);
            navigateTo('reports', null);
          } else {
            setReportTarget(target);
            navigateTo('reports', target);
          }
        } else {
          navigateTo(e.detail.view);
        }
      }
    };
    const handleOpenTrash = () => setShowTrashModal(true);
    const handleOpenBulkDelete = () => setShowBulkDeleteModal(true);
    const handleOpenVoucher = (e: any) => {
      if (e.detail?.refNo) {
        setDrillModal({ type: 'voucher', targetId: e.detail.refNo });
      }
    };

    const handleDirectBack = () => {
      navigateBackDirect();
    };

    const handleOpenMasters = (e: any) => {
      if (e.detail?.tab) {
        setMastersInitialTab(e.detail.tab);
      }
      navigateTo('masters');
    };

    window.addEventListener('app:navigate', handleAppNavigate);
    window.addEventListener('app:navigate-back-direct', handleDirectBack);
    window.addEventListener('app:openTrash', handleOpenTrash);
    window.addEventListener('app:openBulkDelete', handleOpenBulkDelete);
    window.addEventListener('app:openVoucher', handleOpenVoucher);
    window.addEventListener('app:open-masters', handleOpenMasters);

    return () => {
      unsubStatus();
      if (supabaseUnsubRef.current) supabaseUnsubRef.current();
      window.removeEventListener('app:navigate', handleAppNavigate);
      window.removeEventListener('app:navigate-back-direct', handleDirectBack);
      window.removeEventListener('app:openTrash', handleOpenTrash);
      window.removeEventListener('app:openBulkDelete', handleOpenBulkDelete);
      window.removeEventListener('app:openVoucher', handleOpenVoucher);
      window.removeEventListener('app:open-masters', handleOpenMasters);
    };
  }, []);

  // Global Keyboard Shortcuts (Report Shortcuts + Main Navigation)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      const rawKey = e.key ? e.key.toLowerCase() : '';
      const isKeyD = e.code === 'KeyD' || rawKey === 'd' || rawKey === '∂';
      const isKeyT = e.code === 'KeyT' || rawKey === 't' || rawKey === '†';

      // Bulk Delete Modal: Ctrl+Alt+D, Cmd+Alt+D, or Alt+Shift+D
      if (((e.ctrlKey || e.metaKey) && e.altKey && isKeyD) || (e.altKey && e.shiftKey && isKeyD)) {
        e.preventDefault();
        e.stopPropagation();
        setShowBulkDeleteModal(true);
        return;
      }

      // Trash Bin Modal: Ctrl+Alt+T or Cmd+Alt+T
      if ((e.ctrlKey || e.metaKey) && e.altKey && isKeyT) {
        e.preventDefault();
        e.stopPropagation();
        setShowTrashModal(true);
        return;
      }

      // Change Period Shortcut (Alt+F2 / Alt+D)
      if (e.altKey && (e.key === 'F2' || e.code === 'F2' || rawKey === 'd' || e.code === 'KeyD')) {
        e.preventDefault();
        e.stopPropagation();
        if (drillModal.type !== null) {
          window.dispatchEvent(new CustomEvent('app:drill-open-change-period'));
          return;
        }

        if (currentView === 'dashboard') {
          window.dispatchEvent(new CustomEvent('app:dashboard-open-change-period'));
          return;
        }

        if (currentView === 'reports') {
          window.dispatchEvent(new CustomEvent('app:open-change-period'));
          return;
        }

        const t = { category: 'daily' as const, openChangePeriod: true, timestamp: Date.now() };
        setReportTarget(t);
        navigateTo('reports', t);
        window.dispatchEvent(new CustomEvent('app:open-change-period'));
        return;
      }

      // Vouchers Shortcut (Alt+V)
      const isKeyV = e.code === 'KeyV' || rawKey === 'v' || rawKey === '√';
      if (e.altKey && !e.ctrlKey && !e.metaKey && isKeyV) {
        e.preventDefault();
        e.stopPropagation();
        navigateTo('vouchers');
        return;
      }

      // Report Shortcuts (Ctrl+D, Ctrl+G, Ctrl+L)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (rawKey === 'd' || e.code === 'KeyD') {
          e.preventDefault();
          const t = { category: 'daily' as const, timestamp: Date.now() };
          setReportTarget(t);
          navigateTo('reports', t);
          return;
        } else if (rawKey === 'g' || e.code === 'KeyG') {
          e.preventDefault();
          const t = { category: 'gst' as const, timestamp: Date.now() };
          setReportTarget(t);
          navigateTo('reports', t);
          return;
        } else if (rawKey === 'l' || e.code === 'KeyL') {
          e.preventDefault();
          setShowGlobalLedgerSearch(true);
          return;
        }
      }

      // Escape key: step back in navigation history until reaching Main Menu
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();

        // If typing inside an input/select/textarea and no modal is active, blur it first
        if (isInput && !isAnyModalOpen) {
          (activeEl as HTMLElement)?.blur?.();
        }

        navigateBack(false);
        return;
      }

      // Main Menu Alt-Key Combination Shortcuts (Alt+H, Alt+P, Alt+N, Alt+U, Alt+V, Alt+M, Alt+K, Alt+Y, Alt+E, Alt+B, Alt+R, Alt+S)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = rawKey;
        if (key === 'h' || e.code === 'KeyH' || key === '˙') {
          e.preventDefault();
          navigateTo('dashboard');
        } else if (key === 'p' || e.code === 'KeyP' || key === 'π') {
          e.preventDefault();
          navigateTo('pos');
        } else if (key === 'n' || e.code === 'KeyN' || key === '˜') {
          e.preventDefault();
          navigateTo('normalsale');
        } else if (key === 'u' || e.code === 'KeyU' || key === '¨') {
          e.preventDefault();
          navigateTo('purchase');
        } else if (key === 'v' || e.code === 'KeyV' || key === '√') {
          e.preventDefault();
          navigateTo('vouchers');
        } else if (key === 'm' || e.code === 'KeyM' || key === 'µ') {
          e.preventDefault();
          navigateTo('masters');
        } else if (key === 'o' || e.code === 'KeyO' || key === 'ø') {
          e.preventDefault();
          navigateTo('schemes');
        } else if (key === 'k' || e.code === 'KeyK' || key === '') {
          e.preventDefault();
          navigateTo('barcode');
        } else if (key === 'y' || e.code === 'KeyY' || key === '¥') {
          e.preventDefault();
          navigateTo('payroll');
        } else if (key === 'e' || e.code === 'KeyE' || key === '´') {
          e.preventDefault();
          navigateTo('assets');
        } else if (key === 'b' || e.code === 'KeyB' || key === '∫') {
          e.preventDefault();
          navigateTo('bankrecon');
        } else if (key === 'r' || e.code === 'KeyR' || key === '®') {
          e.preventDefault();
          navigateTo('reports');
        } else if (key === 's' || e.code === 'KeyS' || key === 'ß') {
          e.preventDefault();
          navigateTo('settings');
        } else if (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0' || key === 'º' || key === '§') {
          e.preventDefault();
          navigateTo('superadmin');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [drillModal.type, currentView, viewHistory]);

  const isHighDensityView = currentView === 'pos' || currentView === 'purchase' || currentView === 'normalsale' || currentView === 'vouchers' || currentView === 'schemes';

  const isAnyModalOpen = Boolean(
    drillModal.type ||
    showGlobalLedgerSearch ||
    showTrashModal ||
    showBulkDeleteModal ||
    quickLedgerModalProps.isOpen ||
    quickItemModalProps.isOpen
  );

  if (isEmployeePortalMode) {
    return (
      <EmployeePortalApp
        activeCompany={activeCompany}
        config={config}
        onExitPortal={() => {
          setIsEmployeePortalMode(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('portal');
            url.searchParams.delete('mode');
            window.history.replaceState({}, '', url.toString());
          }
        }}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={view => navigateTo(view)}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        hideDesktop={true}
        config={config}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          config={config}
          onToggleMobileMenu={() => setIsMobileOpen(!isMobileOpen)}
          onRefresh={refreshData}
          canNavigateBack={currentView !== 'dashboard' || viewHistory.length > 1 || !!drillModal.type}
          onNavigateBack={() => navigateBack(false)}
          isPosMode={true}
          firebaseStatus={firebaseStatus}
          firebaseMessage={firebaseMessage}
          onOpenCompanyManager={() => setShowCompanyModal(true)}
          activeCompanyName={activeCompany?.company_name}
          activeFYName={activeFY?.fy_name}
          currentUser={currentUser}
          onOpenUserAuthModal={() => setShowUserAuthModal(true)}
          onNavigate={view => navigateTo(view)}
          onLockTerminal={() => {
            sessionStorage.setItem('bhutan_pos_terminal_explicitly_locked', 'true');
            sessionStorage.removeItem('bhutan_pos_session_unlocked');
            setIsTerminalLocked(true);
          }}
        />

        <main className={`flex-1 ${currentView === 'reports' ? 'overflow-y-auto' : isHighDensityView ? 'p-1.5 sm:p-2 pb-1.5 overflow-hidden flex flex-col min-h-0' : 'p-3 sm:p-6 pb-6 lg:pb-8 overflow-y-auto'} relative`}>
          {currentView === 'dashboard' && (
            <Dashboard
              key={activeCompany?.id || 'default_dash'}
              config={config}
              items={items}
              ledgers={ledgers}
              onNavigate={view => navigateTo(view)}
              onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from, toDate: to })}
              onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from, toDate: to })}
              onDrillGroup={(grp, from, to) => setDrillModal({ type: 'group', targetId: grp, fromDate: from, toDate: to })}
              onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from, toDate: to })}
              onDrillReport={target => {
                const t = { ...target, timestamp: Date.now() };
                setReportTarget(t);
                navigateTo('reports', t);
              }}
              isActive={currentView === 'dashboard' && !isAnyModalOpen}
            />
          )}

          {/* POS Billing is rendered and kept active to preserve cart state */}
          <div className={currentView === 'pos' ? 'flex-1 min-h-0 flex flex-col h-full' : 'hidden'}>
            <POSBilling
              key={activeCompany?.id || 'default_pos'}
              config={config}
              items={items}
              ledgers={ledgers}
              heldBills={heldBills}
              selectedVoucherType={selectedSaleVoucherType}
              onOpenVoucherTypeModal={() => handleOpenPOSBilling()}
              onDataRefresh={refreshData}
              initialVoucherTarget={voucherTarget}
              onBack={navigateBack}
              onOpenNewItemModal={(onSelect, itemToEdit) => {
                setQuickItemModalProps({isOpen: true, itemToEdit, onSelect});
              }}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
              onEditLedger={name => {
                setOpenLedgerModalGroup('Sundry Debtors');
                navigateTo('masters');
              }}
              isActive={currentView === 'pos' && !isAnyModalOpen}
            />
          </div>

          {config.EnableNormalSale !== 'false' && isModulePermitted(currentUser, 'normalsale', 'display') && (
            <div className={currentView === 'normalsale' ? 'flex-1 min-h-0 flex flex-col h-full w-full' : 'hidden'}>
              <SalesInvoiceEntry
                key={activeCompany?.id || 'default_sales'}
                config={config}
                items={items}
                ledgers={ledgers}
                onDataRefresh={refreshData}
                initialVoucherTarget={voucherTarget}
                onBack={navigateBack}
                onOpenNewItemModal={(onSelect, itemToEdit) => setQuickItemModalProps({isOpen: true, itemToEdit, onSelect})}
                onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Debtors', onSelect})}
                isActive={currentView === 'normalsale' && !isAnyModalOpen}
              />
            </div>
          )}
          {isModulePermitted(currentUser, 'purchase', 'display') && (
            <div className={currentView === 'purchase' ? 'flex-1 min-h-0 flex flex-col h-full w-full' : 'hidden'}>
              <PurchaseEntry
                key={activeCompany?.id || 'default_purchase'}
                config={config}
                items={items}
                ledgers={ledgers}
                onDataRefresh={refreshData}
                initialVoucherTarget={voucherTarget}
                onBack={navigateBack}
                onOpenNewItemModal={(onSelect, itemToEdit) => setQuickItemModalProps({isOpen: true, itemToEdit, onSelect})}
                onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
                onPrintPurchaseBarcodes={queue => {
                  setBarcodeQueueInitial(queue);
                  navigateTo('barcode');
                }}
                isActive={currentView === 'purchase' && !isAnyModalOpen}
              />
            </div>
          )}

          {currentView === 'vouchers' && isModulePermitted(currentUser, 'vouchers', 'display') && (
            <Vouchers
              key={activeCompany?.id || 'default_vouchers'}
              config={config}
              items={items}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              onNavigateTo={navigateTo}
              onBack={navigateBack}
              onOpenNewItemModal={(onSelect, itemToEdit) => setQuickItemModalProps({isOpen: true, itemToEdit, onSelect})}
              onOpenNewLedgerModal={(group, onSelect) => setQuickLedgerModalProps({isOpen: true, group: group || 'Sundry Creditors', onSelect})}
              initialVoucherTarget={voucherTarget}
              isActive={currentView === 'vouchers' && !isAnyModalOpen}
            />
          )}

          {currentView === 'masters' && isModulePermitted(currentUser, 'masters', 'display') && (
            <Masters
              key={activeCompany?.id || 'default_masters'}
              config={config}
              items={items}
              itemGroups={itemGroups}
              units={units}
              unitGroups={unitGroups}
              categories={categories}
              ledgers={ledgers}
              ledgerGroups={ledgerGroups}
              onDataRefresh={refreshData}
              openItemModalCode={openItemModalCode}
              openLedgerModalGroup={openLedgerModalGroup}
              initialTab={mastersInitialTab}
              isActive={currentView === 'masters' && !isAnyModalOpen}
            />
          )}

          {currentView === 'schemes' && isModulePermitted(currentUser, 'schemes', 'display') && (
            <SchemeManagement
              key={activeCompany?.id || 'default_schemes'}
              currency={config.CurrencySymbol || 'Nu.'}
              onClose={() => navigateTo('dashboard')}
            />
          )}

          {currentView === 'barcode' && isModulePermitted(currentUser, 'barcode', 'display') && (
            <BarcodePrinting config={config} items={items} initialQueue={barcodeQueueInitial} />
          )}

          {currentView === 'payroll' && isFeatureAllowed(config, 'EnablePayroll') && config.EnablePayroll !== 'false' && isModulePermitted(currentUser, 'payroll', 'display') && (
            <Payroll key={activeCompany?.id || 'default_payroll'} config={config} ledgers={ledgers} onDataRefresh={refreshData} />
          )}

          {(currentView === 'staff' || currentView === 'attendance') && isModulePermitted(currentUser, 'staff', 'display') && (
            ((isFeatureAllowed(config, 'EnableStaffAttendanceAndLeave') && config.EnableStaffAttendanceAndLeave !== 'false') ||
             (isFeatureAllowed(config, 'EnableStaffAssignments') && config.EnableStaffAssignments !== 'false')) ? (
              <StaffManagementView
                key={activeCompany?.id || 'default_staff'}
                config={config}
                onDataRefresh={refreshData}
                onNavigateToPayroll={() => navigateTo('payroll')}
              />
            ) : (
              <div className="p-12 max-w-lg mx-auto text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Module Disabled for Store</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Leave Management, Attendance, and Task Assignment are currently not enabled for this client store. Please contact your platform superadmin to activate this module.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

          {currentView === 'assets' && isFeatureAllowed(config, 'EnableAssetManagement') && config.EnableAssetManagement !== 'false' && isModulePermitted(currentUser, 'masters', 'display') && (
            <AssetManagementModule 
              key={activeCompany?.id || 'default_assets'}
              config={config} 
              ledgers={ledgers} 
              onDataRefresh={refreshData} 
              onDrillVoucher={(refNo) => setDrillModal({ type: 'voucher', targetId: refNo })}
            />
          )}

          {currentView === 'reports' && isModulePermitted(currentUser, 'reports', 'display') && (
            <Reports
              key={activeCompany?.id || 'default_reports'}
              config={config}
              items={items}
              ledgers={ledgers}
              initialReportTarget={reportTarget}
              onBack={navigateBack}
              onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from, toDate: to })}
              onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from, toDate: to })}
              onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from, toDate: to })}
              onDrillItemProfit={(code, from, to) => setDrillModal({ type: 'item-profit', targetId: code, fromDate: from, toDate: to })}
              onDrillGroup={(cat, from, to) => setDrillModal({ type: 'group', targetId: cat, fromDate: from, toDate: to })}
              isActive={currentView === 'reports' && !isAnyModalOpen}
            />
          )}

          {currentView === 'bankrecon' && isModulePermitted(currentUser, 'vouchers', 'display') && <BankReconciliation />}

          {currentView === 'settings' && isModulePermitted(currentUser, 'settings', 'display') && (
            <SettingsView
              config={config}
              ledgers={ledgers}
              onDataRefresh={refreshData}
              isActive={currentView === 'settings' && !isAnyModalOpen}
            />
          )}

          {currentView === 'superadmin' && (
            <SuperadminDashboard
              currentUser={currentUser}
              onNavigate={navigateTo}
              onSwitchCompany={(c) => {
                setActiveCompany(c);
                setConfig(prev => ({
                  ...prev,
                  CompanyName: c.company_name,
                  Address: c.address || prev.Address,
                  CompanyTPNNo: c.tax_payer_id || prev.CompanyTPNNo,
                  CompanyGSTNo: c.trade_license_no || prev.CompanyGSTNo,
                  CompanyPhone: c.phone || prev.CompanyPhone,
                  CompanyEmail: c.email || prev.CompanyEmail,
                  CurrencySymbol: c.currency_symbol || prev.CurrencySymbol
                }));
                refreshData();
              }}
            />
          )}
          <QuickLedgerModal
          isOpen={quickLedgerModalProps.isOpen}
          initialGroup={quickLedgerModalProps.group}
          config={config}
          onClose={() => setQuickLedgerModalProps(prev => ({...prev, isOpen: false}))}
          onSave={(ledger) => {
            const res = saveLedger(ledger);
            if (res && res.ok === false) {
              alert(res.error || 'Failed to save ledger');
              return;
            }
            refreshData();
            setQuickLedgerModalProps(prev => ({...prev, isOpen: false}));
            if (quickLedgerModalProps.onSelect) {
              quickLedgerModalProps.onSelect(ledger['Ledger Name']);
            }
          }}
        />
        <QuickItemModal
          isOpen={quickItemModalProps.isOpen}
          itemToEdit={quickItemModalProps.itemToEdit}
          config={config}
          onClose={() => setQuickItemModalProps(prev => ({...prev, isOpen: false, itemToEdit: null}))}
          onSave={(item) => {
            refreshData();
            setQuickItemModalProps(prev => ({...prev, isOpen: false, itemToEdit: null}));
            if (quickItemModalProps.onSelect) {
              quickItemModalProps.onSelect(item);
            }
          }}
        />
        </main>
      </div>

      {showGlobalLedgerSearch && (
        <QuickLedgerSearchModal
          ledgers={ledgers}
          onClose={() => setShowGlobalLedgerSearch(false)}
          onSelect={(ledgerName) => {
            setShowGlobalLedgerSearch(false);
            setDrillModal({ type: 'ledger', targetId: ledgerName });
          }}
        />
      )}

      {/* Universal Drilldown Modal */}
      <DrillModal
        config={config}
        type={drillModal.type}
        targetId={drillModal.targetId}
        initialHistory={drillInitialHistory}
        fromDate={drillModal.fromDate}
        toDate={drillModal.toDate}
        onClose={() => {
          setDrillModal({ type: null, targetId: null, fromDate: undefined, toDate: undefined });
          setDrillInitialHistory([]);
        }}
        onRefresh={refreshData}
        onDrillVoucher={(refNo, from, to) => setDrillModal({ type: 'voucher', targetId: refNo, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onDrillLedger={(name, from, to) => setDrillModal({ type: 'ledger', targetId: name, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onDrillStock={(code, from, to) => setDrillModal({ type: 'stock', targetId: code, fromDate: from || drillModal.fromDate, toDate: to || drillModal.toDate })}
        onOpenVoucherInEntry={(refNo, vType, currentActive, currentHistory, isDuplicate) => {
          if (currentActive) {
            setDrillReturnContext({
              activeDrill: currentActive,
              drillHistory: currentHistory || [],
              fromView: currentView
            });
          }
          setDrillModal({ type: null, targetId: null });
          setDrillInitialHistory([]);
          setVoucherTarget({ voucherNo: refNo, timestamp: Date.now(), isDuplicate });
          if (vType === 'INV' || vType === 'S') {
            const details = getVoucherDetails(refNo);
            const inv = details?.header as any;
            const isNormalSale = inv && inv.isPOS !== true && (
              inv.isPOS === false || 
              inv.voucherTypeId === 'VT-SALE-NORMAL' || 
              inv.invoiceNo?.startsWith('SAL-') || 
              inv.invoiceNo?.startsWith('INV-B2B-') || 
              Boolean(inv.orderNo) || 
              Boolean(inv.deliveryNoteNo) || 
              (Boolean(inv.termsAndConditions) && !inv.invoiceNo?.startsWith('POS-'))
            );
            if (isNormalSale && config.EnableNormalSale !== 'false') {
              navigateTo('normalsale', undefined, true);
            } else {
              navigateTo('pos', undefined, true);
            }
          } else if (vType === 'PUR') {
            navigateTo('purchase', undefined, true);
          } else {
            navigateTo('vouchers', undefined, true);
          }
        }}
      />

      {/* Trash & Recycle Bin Modal */}
      <TrashModal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        onDataChanged={refreshData}
        currencySymbol={config.CurrencySymbol}
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onDataCleared={refreshData}
      />

      {/* Multi-Tenant Company & Financial Year Manager Modal */}
      <CompanyManagerModal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        onCompanySelected={(c) => {
          setActiveCompany(c);
          setConfig(prev => ({
            ...prev,
            CompanyName: c.company_name,
            Address: c.address || prev.Address,
            CompanyTPNNo: c.tax_payer_id || prev.CompanyTPNNo,
            CompanyGSTNo: c.trade_license_no || prev.CompanyGSTNo,
            CompanyPhone: c.phone || prev.CompanyPhone,
            CompanyEmail: c.email || prev.CompanyEmail,
            CurrencySymbol: c.currency_symbol || prev.CurrencySymbol
          }));
          refreshData();
        }}
      />

      {/* User Login & Role Shift Switcher Modal */}
      <UserAuthModal
        isOpen={showUserAuthModal}
        onClose={() => setShowUserAuthModal(false)}
        onUserChanged={(u) => {
          setCurrentUser(u);
          if (!isModulePermitted(u, currentView, 'display')) {
            if (isModulePermitted(u, 'pos', 'display')) {
              setCurrentView('pos');
            } else if (isModulePermitted(u, 'dashboard', 'display')) {
              setCurrentView('dashboard');
            }
          }
          refreshData();
        }}
      />

      {/* Terminal Login Gate Lock Screen */}
      {isTerminalLocked && (
        <LoginGate
          activeCompany={activeCompany}
          activeFY={activeFY}
          onUnlock={(user) => {
            sessionStorage.removeItem('bhutan_pos_terminal_explicitly_locked');
            sessionStorage.setItem('bhutan_pos_session_unlocked', 'true');
            setCurrentUser(user);
            setIsTerminalLocked(false);
            if (!isModulePermitted(user, currentView, 'display')) {
              if (isModulePermitted(user, 'pos', 'display')) {
                setCurrentView('pos');
              } else if (isModulePermitted(user, 'dashboard', 'display')) {
                setCurrentView('dashboard');
              }
            }
            loadTenantDetails();
            refreshData();
          }}
        />
      )}
    </div>
  );
}
