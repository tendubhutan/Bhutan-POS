import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  BookOpen,
  FolderKanban,
  Barcode,
  BarChart3,
  Users,
  Building,
  Settings,
  X,
  Landmark,
  ShieldCheck,
  Tags,
  Download,
  CheckCircle2,
  Smartphone,
  ChevronRight,
  ArrowLeft,
  FileText,
  Receipt,
  CreditCard,
  TrendingUp,
  PieChart,
  ListFilter,
  Layers,
  ArrowRightLeft,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { Config, AppUser } from "../types";
import { isSuperAdmin, getCurrentTenantSession } from '../services/authTenantContext';
import { isFeatureAllowed } from '../services/tenantFeatureService';
import { isModulePermitted } from '../utils/permissionUtils';
import { promptPwaInstall, isPwaInstalled, subscribePwaState, canInstallPwa } from '../services/pwaService';
import { ClientLinkAndPwaModal } from './ClientLinkAndPwaModal';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, reportTargetOverride?: any) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  hideDesktop?: boolean;
  config: Config;
  currentUser?: AppUser;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  hideDesktop = false,
  config,
  currentUser
}) => {
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isPwaInstalled());
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => canInstallPwa());
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);

  // Submenu drill-down path state (e.g. [], ['vouchers'], ['reports'], ['reports', 'fin'], etc.)
  const [menuPath, setMenuPath] = useState<string[]>([]);

  useEffect(() => {
    setIsInstalled(isPwaInstalled());
    setHasPrompt(canInstallPwa());
    const unsub = subscribePwaState(() => {
      setIsInstalled(isPwaInstalled());
      setHasPrompt(canInstallPwa());
    });
    return unsub;
  }, []);

  const handleInstallDesktopApp = async () => {
    if (canInstallPwa()) {
      const result = await promptPwaInstall();
      if (result === 'accepted') {
        setIsInstalled(true);
      }
    } else {
      setShowPwaModal(true);
    }
  };

  const isCashier = currentUser?.role === 'Cashier';
  const session = getCurrentTenantSession();
  const rawRole = (
    session?.role || 
    currentUser?.role || 
    (typeof localStorage !== 'undefined' ? (
      localStorage.getItem('deep_pos_auth_role') ||
      localStorage.getItem('supabase_active_role') ||
      localStorage.getItem('user_role') ||
      localStorage.getItem('role') ||
      ''
    ) : '')
  ).toString().toLowerCase().trim();

  const isSuperadminUser = 
    isSuperAdmin() || 
    session?.isSuperadmin === true ||
    rawRole === 'superadmin';

  const isStaffAttendanceAllowed = isFeatureAllowed(config, 'EnableStaffAttendanceAndLeave', isSuperadminUser) && config.EnableStaffAttendanceAndLeave !== 'false';
  const isStaffAssignmentsAllowed = isFeatureAllowed(config, 'EnableStaffAssignments', isSuperadminUser) && config.EnableStaffAssignments !== 'false';
  const isStaffAllowed = isStaffAttendanceAllowed || isStaffAssignmentsAllowed;

  const hasOnlyPosAccess = currentUser && !isSuperadminUser && (
    (isCashier && !currentUser.permissions?.some(p => p.module !== 'pos' && p.display)) ||
    (currentUser.permissions && currentUser.permissions.length > 0 && 
     currentUser.permissions.some(p => p.module === 'pos' && p.display) && 
     !currentUser.permissions.some(p => p.module !== 'pos' && p.display))
  );

  const isDashboardPermitted = isSuperadminUser || (!hasOnlyPosAccess && (
    isModulePermitted(currentUser, 'reports', 'display', isSuperadminUser) ||
    isModulePermitted(currentUser, 'masters', 'display', isSuperadminUser) ||
    isModulePermitted(currentUser, 'vouchers', 'display', isSuperadminUser) ||
    !isCashier
  ));

  // Function to execute navigation and auto-hide sidebar
  const handleExecuteNavigation = (view: string, target?: any) => {
    onNavigate(view, target);
    setMenuPath([]);
    onCloseMobile();
  };

  // Build items based on current menuPath
  const currentMenuItems = useMemo(() => {
    const currentDepth = menuPath.length;

    // LEVEL 0: Primary Main Menu
    if (currentDepth === 0) {
      return [
        ...(isDashboardPermitted ? [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'Alt+H', action: () => handleExecuteNavigation('dashboard') }] : []),
        ...(isFeatureAllowed(config, 'EnablePOS', isSuperadminUser) && config.EnablePOS !== 'false' && isModulePermitted(currentUser, 'pos', 'display', isSuperadminUser) ? [{ id: 'pos', label: 'POS Billing', icon: ShoppingCart, shortcut: 'Alt+P', action: () => handleExecuteNavigation('pos') }] : []),
        ...(isFeatureAllowed(config, 'EnableNormalSale', isSuperadminUser) && config.EnableNormalSale !== 'false' && isModulePermitted(currentUser, 'normalsale', 'display', isSuperadminUser) ? [{ id: 'normalsale', label: 'Sales Invoice', icon: ShoppingBag, shortcut: 'Alt+N', action: () => handleExecuteNavigation('normalsale') }] : []),
        ...(isFeatureAllowed(config, 'EnablePurchase', isSuperadminUser) && config.EnablePurchase !== 'false' && isModulePermitted(currentUser, 'purchase', 'display', isSuperadminUser) ? [{ id: 'purchase', label: 'Purchase Entry', icon: ShoppingBag, shortcut: 'Alt+U', action: () => handleExecuteNavigation('purchase') }] : []),
        
        // Vouchers Submenu Trigger
        ...(isFeatureAllowed(config, 'EnableVouchers', isSuperadminUser) && config.EnableVouchers !== 'false' && isModulePermitted(currentUser, 'vouchers', 'display', isSuperadminUser) ? [{ id: 'vouchers', label: 'Vouchers', icon: BookOpen, shortcut: 'Alt+V', hasSubmenu: true, action: () => setMenuPath(['vouchers']) }] : []),
        
        // Masters Submenu Trigger
        ...(isModulePermitted(currentUser, 'masters', 'display', isSuperadminUser) ? [{ id: 'masters', label: 'Masters', icon: FolderKanban, shortcut: 'Alt+M', hasSubmenu: true, action: () => setMenuPath(['masters']) }] : []),
        
        ...(isFeatureAllowed(config, 'EnableSchemes', isSuperadminUser) && config.EnableSchemes !== 'false' && isModulePermitted(currentUser, 'schemes', 'display', isSuperadminUser) ? [{ id: 'schemes', label: 'Schemes & Offers', icon: Tags, shortcut: 'Alt+O', action: () => handleExecuteNavigation('schemes') }] : []),
        ...(isFeatureAllowed(config, 'EnableBarcodePrinting', isSuperadminUser) && config.EnableBarcodePrinting !== 'false' && isModulePermitted(currentUser, 'barcode', 'display', isSuperadminUser) ? [{ id: 'barcode', label: 'Barcode Print', icon: Barcode, shortcut: 'Alt+K', action: () => handleExecuteNavigation('barcode') }] : []),
        ...(isFeatureAllowed(config, 'EnablePayroll', isSuperadminUser) && config.EnablePayroll !== 'false' && isModulePermitted(currentUser, 'payroll', 'display', isSuperadminUser) ? [{ id: 'payroll', label: 'Payroll & HR', icon: Users, shortcut: 'Alt+Y', action: () => handleExecuteNavigation('payroll') }] : []),
        ...(isStaffAllowed && isModulePermitted(currentUser, 'staff', 'display', isSuperadminUser) ? [{
          id: 'staff',
          label: isStaffAttendanceAllowed && isStaffAssignmentsAllowed ? 'Staff & Tasks' : isStaffAttendanceAllowed ? 'Attendance & Leaves' : 'Assignments & Tasks',
          icon: Smartphone,
          shortcut: 'Alt+A',
          action: () => handleExecuteNavigation('staff')
        }] : []),
        ...(isFeatureAllowed(config, 'EnableAssetManagement', isSuperadminUser) && config.EnableAssetManagement !== 'false' && isModulePermitted(currentUser, 'masters', 'display', isSuperadminUser) ? [{ id: 'assets', label: 'Asset Management', icon: Building, shortcut: 'Alt+E', action: () => handleExecuteNavigation('assets') }] : []),
        ...(isFeatureAllowed(config, 'EnableBankReconciliation', isSuperadminUser) && config.EnableBankReconciliation !== 'false' && isModulePermitted(currentUser, 'vouchers', 'display', isSuperadminUser) ? [{ id: 'bankrecon', label: 'Bank Reconciliation', icon: Landmark, shortcut: 'Alt+B', action: () => handleExecuteNavigation('bankrecon') }] : []),
        
        // Reports Submenu Trigger
        ...(isModulePermitted(currentUser, 'reports', 'display', isSuperadminUser) ? [{ id: 'reports', label: 'Reports', icon: BarChart3, shortcut: 'Alt+R', hasSubmenu: true, action: () => setMenuPath(['reports']) }] : []),
        
        ...(isModulePermitted(currentUser, 'settings', 'display', isSuperadminUser) ? [{ id: 'settings', label: 'Settings', icon: Settings, shortcut: 'Alt+S', action: () => handleExecuteNavigation('settings') }] : []),
        ...(isSuperadminUser ? [{ 
          id: 'superadmin', 
          label: '🏢 Superadmin Portal', 
          icon: ShieldCheck, 
          shortcut: 'Alt+0',
          isSuperBadge: true,
          action: () => handleExecuteNavigation('superadmin')
        }] : [])
      ];
    }

    // LEVEL 1: Vouchers Submenu
    if (menuPath[0] === 'vouchers') {
      return [
        { id: 'v_pos', label: 'Sales Invoice (POS)', icon: ShoppingCart, action: () => handleExecuteNavigation('pos') },
        { id: 'v_sale', label: 'Sales Invoice (Tax/Normal)', icon: ShoppingBag, action: () => handleExecuteNavigation('normalsale') },
        { id: 'v_purchase', label: 'Purchase Entry', icon: ShoppingBag, action: () => handleExecuteNavigation('purchase') },
        { id: 'v_payment', label: 'Payment Voucher', icon: CreditCard, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Payment' }) },
        { id: 'v_receipt', label: 'Receipt Voucher', icon: Receipt, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Receipt' }) },
        { id: 'v_journal', label: 'Journal Voucher', icon: BookOpen, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Journal' }) },
        { id: 'v_contra', label: 'Contra Voucher', icon: ArrowRightLeft, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Contra' }) },
        { id: 'v_credit', label: 'Credit Note', icon: FileText, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Credit Note' }) },
        { id: 'v_debit', label: 'Debit Note', icon: FileText, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Debit Note' }) },
        { id: 'v_delivery', label: 'Delivery Note', icon: FileText, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Delivery Note' }) },
        { id: 'v_quotation', label: 'Sales Quotation', icon: FileText, action: () => handleExecuteNavigation('vouchers', { voucherTypeFilter: 'Quotation' }) },
        { id: 'v_all', label: 'All Vouchers Register', icon: Layers, action: () => handleExecuteNavigation('vouchers') }
      ];
    }

    // LEVEL 1: Reports Category Submenu
    if (menuPath[0] === 'reports' && menuPath.length === 1) {
      return [
        { id: 'r_daily', label: 'Daily Columnar Report', icon: Calendar, action: () => handleExecuteNavigation('reports', { category: 'daily' }) },
        { id: 'r_fin', label: 'Financial Statements', icon: PieChart, hasSubmenu: true, action: () => setMenuPath(['reports', 'fin']) },
        { id: 'r_inv', label: 'Inventory & Stock Reports', icon: BarChart3, hasSubmenu: true, action: () => setMenuPath(['reports', 'inv']) },
        { id: 'r_reg', label: 'Registers & Books', icon: FileSpreadsheet, hasSubmenu: true, action: () => setMenuPath(['reports', 'reg']) },
        { id: 'r_audit', label: 'Audit Trail & Logs', icon: ShieldCheck, action: () => handleExecuteNavigation('reports', { category: 'audit' }) }
      ];
    }

    // LEVEL 2: Reports -> Financial Statements
    if (menuPath[0] === 'reports' && menuPath[1] === 'fin') {
      return [
        { id: 'r_fin_tb', label: 'Trial Balance', icon: PieChart, action: () => handleExecuteNavigation('reports', { category: 'fin', finSubTab: 'TB' }) },
        { id: 'r_fin_pnl', label: 'Profit & Loss Account', icon: TrendingUp, action: () => handleExecuteNavigation('reports', { category: 'fin', finSubTab: 'PNL' }) },
        { id: 'r_fin_bs', label: 'Balance Sheet', icon: Landmark, action: () => handleExecuteNavigation('reports', { category: 'fin', finSubTab: 'BS' }) },
        { id: 'r_fin_led', label: 'Ledger Statements', icon: BookOpen, action: () => handleExecuteNavigation('reports', { category: 'fin', finSubTab: 'LED' }) },
        { id: 'r_fin_rec', label: 'Receivables & Payables', icon: CreditCard, action: () => handleExecuteNavigation('reports', { category: 'fin', finSubTab: 'REC' }) }
      ];
    }

    // LEVEL 2: Reports -> Inventory & Stock Reports
    if (menuPath[0] === 'reports' && menuPath[1] === 'inv') {
      return [
        { id: 'r_inv_summary', label: 'Stock Summary & Valuation', icon: BarChart3, action: () => handleExecuteNavigation('reports', { category: 'inv', invSubTab: 'summary' }) },
        { id: 'r_inv_prof', label: 'Item Profitability Analysis', icon: TrendingUp, action: () => handleExecuteNavigation('reports', { category: 'inv', invSubTab: 'prof' }) },
        { id: 'r_inv_mov', label: 'Fast / Slow Moving Items', icon: ListFilter, action: () => handleExecuteNavigation('reports', { category: 'inv', invSubTab: 'mov' }) },
        { id: 'r_inv_serials', label: 'Serial & Batch Tracking', icon: Barcode, action: () => handleExecuteNavigation('reports', { category: 'inv', invSubTab: 'serials' }) },
        { id: 'r_inv_godown', label: 'Godown / Warehouse Stock', icon: Building, action: () => handleExecuteNavigation('reports', { category: 'inv', invSubTab: 'godown_summary' }) }
      ];
    }

    // LEVEL 2: Reports -> Registers & Books
    if (menuPath[0] === 'reports' && menuPath[1] === 'reg') {
      return [
        { id: 'r_reg_daybook', label: 'Day Book', icon: Calendar, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'daybook' }) },
        { id: 'r_reg_vouchers', label: 'All Vouchers Register', icon: Layers, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'vouchers' }) },
        { id: 'r_reg_sales', label: 'Sales Register', icon: ShoppingCart, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'sales' }) },
        { id: 'r_reg_purchases', label: 'Purchase Register', icon: ShoppingBag, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'purchases' }) },
        { id: 'r_reg_quotations', label: 'Quotations Register', icon: FileText, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'quotations' }) },
        { id: 'r_reg_delivery', label: 'Delivery Notes Register', icon: FileText, action: () => handleExecuteNavigation('reports', { category: 'reg', regSubTab: 'delivery_notes' }) }
      ];
    }

    // LEVEL 1: Masters Submenu
    if (menuPath[0] === 'masters') {
      return [
        { id: 'm_ledgers', label: 'Accounts & Ledgers', icon: BookOpen, action: () => handleExecuteNavigation('masters') },
        { id: 'm_items', label: 'Items & Products', icon: FolderKanban, action: () => handleExecuteNavigation('masters') },
        { id: 'm_schemes', label: 'Schemes & Offers', icon: Tags, action: () => handleExecuteNavigation('schemes') },
        { id: 'm_barcode', label: 'Barcode Print', icon: Barcode, action: () => handleExecuteNavigation('barcode') },
        { id: 'm_assets', label: 'Asset Management', icon: Building, action: () => handleExecuteNavigation('assets') }
      ];
    }

    return [];
  }, [menuPath, config, currentUser, isDashboardPermitted, isSuperadminUser, isStaffAllowed, isStaffAttendanceAllowed, isStaffAssignmentsAllowed]);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow key navigation between items
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      const isSidebarFocused = itemRefs.current.some(btn => btn === activeEl);

      if (isInputFocused && !e.altKey) {
        return;
      }

      if ((e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || (isSidebarFocused && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
        e.preventDefault();
        if (currentMenuItems.length === 0) return;

        const currentIndex = itemRefs.current.findIndex(btn => btn === activeEl);
        const validIndex = currentIndex === -1 ? 0 : currentIndex;

        if (e.key === 'ArrowDown') {
          const nextIndex = (validIndex + 1) % currentMenuItems.length;
          itemRefs.current[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
          const prevIndex = (validIndex - 1 + currentMenuItems.length) % currentMenuItems.length;
          itemRefs.current[prevIndex]?.focus();
        }
      }

      // Escape key to step back in menu or close
      if (e.key === 'Escape' && menuPath.length > 0) {
        e.preventDefault();
        setMenuPath(prev => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMenuItems, menuPath]);

  // Current Breadcrumb Subtitle
  const currentBreadcrumbTitle = useMemo(() => {
    if (menuPath.length === 0) return null;
    if (menuPath[0] === 'vouchers') return 'Vouchers Menu';
    if (menuPath[0] === 'masters') return 'Masters Menu';
    if (menuPath[0] === 'reports' && menuPath.length === 1) return 'Reports Menu';
    if (menuPath[0] === 'reports' && menuPath[1] === 'fin') return 'Financial Statements';
    if (menuPath[0] === 'reports' && menuPath[1] === 'inv') return 'Inventory Reports';
    if (menuPath[0] === 'reports' && menuPath[1] === 'reg') return 'Registers & Books';
    return 'Sub Menu';
  }, [menuPath]);

  return (
    <>
      {/* Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs ${hideDesktop ? '' : 'lg:hidden'}`}
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 sm:w-68 bg-slate-900 text-white flex flex-col p-3.5 shadow-2xl transition-transform duration-300 ease-in-out ${
          hideDesktop ? '' : 'lg:static lg:translate-x-0'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header with Attached Logo */}
        <div className="flex items-center justify-between px-2 py-2.5 mb-3 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setMenuPath([])}
            className="flex items-center gap-2.5 text-left group cursor-pointer hover:opacity-90 transition min-w-0 flex-1"
            title="Click to return to Primary Main Menu"
          >
            {/* Ezee ERP Vector Emblem matching uploaded official logo */}
            <svg className="h-8 w-8 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ezeeBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="ezeeCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <path 
                d="M 50 10 A 40 40 0 1 0 85 65 L 72 58 A 25 25 0 1 1 50 25 A 25 25 0 0 1 70 34 L 82 22 A 40 40 0 0 0 50 10 Z" 
                fill="url(#ezeeBlueGrad)" 
              />
              <path 
                d="M 85 42 L 95 68 L 68 62 Z" 
                fill="#0284c7" 
              />
              <rect x="34" y="36" width="28" height="8" rx="2" fill="url(#ezeeCyanGrad)" />
              <rect x="34" y="48" width="22" height="7" rx="2" fill="url(#ezeeCyanGrad)" />
              <rect x="34" y="58" width="28" height="8" rx="2" fill="url(#ezeeCyanGrad)" />
            </svg>

            <div className="flex flex-col min-w-0">
              <div className="font-black text-base tracking-wide text-white flex items-center gap-1 leading-none">
                <span>Ezee</span>
                <span className="text-blue-400">ERP</span>
              </div>
              <div className="text-[9px] font-medium text-slate-300 leading-tight truncate mt-0.5">
                Everything Your Business Needs, in One Place.
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Small Header Back Button when inside a Submenu */}
            {menuPath.length > 0 && (
              <button
                type="button"
                onClick={() => setMenuPath(prev => prev.slice(0, -1))}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 hover:text-white border border-blue-400/30 transition text-xs font-bold cursor-pointer shrink-0"
                title="Back to Previous Menu (Esc)"
              >
                <ArrowLeft className="h-3.5 w-3.5 stroke-[3]" />
                <span className="text-[11px]">Back</span>
              </button>
            )}

            <button
              onClick={onCloseMobile}
              className={`${hideDesktop ? '' : 'lg:hidden'} text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer`}
              title="Close menu (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Submenu Category Header Banner if in Submenu */}
        {currentBreadcrumbTitle && (
          <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 rounded-lg bg-blue-950/60 border border-blue-500/30 text-xs font-bold text-blue-200">
            <span className="truncate">{currentBreadcrumbTitle}</span>
            <button
              type="button"
              onClick={() => setMenuPath([])}
              className="text-[10px] text-blue-300 hover:text-white underline font-semibold cursor-pointer shrink-0 ml-2"
              title="Return to Main Menu"
            >
              Main Menu
            </button>
          </div>
        )}

        {/* Nav Items List */}
        <nav 
          role="navigation"
          aria-label="Main Application Menu"
          className="flex-1 space-y-1 overflow-y-auto pr-1"
        >
          {currentMenuItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentView === item.id && menuPath.length === 0;
            const isSuper = (item as any).isSuperBadge;
            const hasSubmenu = (item as any).hasSubmenu;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                ref={el => (itemRefs.current[idx] = el)}
                onClick={item.action}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition group cursor-pointer focus:outline-none focus-visible:ring-2 ${
                  isSuper
                    ? isActive
                      ? 'bg-amber-600 text-white shadow-lg border border-amber-400 focus-visible:ring-amber-300'
                      : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:text-amber-100 border border-amber-500/30 focus-visible:ring-amber-400'
                    : isActive
                      ? 'bg-blue-600 text-white shadow-md focus-visible:ring-blue-400'
                      : 'text-slate-300 hover:bg-slate-800/90 hover:text-white hover:border-slate-700/80 border border-transparent focus-visible:ring-blue-400'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                    isSuper 
                      ? 'text-amber-400 group-hover:text-amber-300' 
                      : isActive 
                        ? 'text-white' 
                        : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {hasSubmenu && (
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-300 transition-transform group-hover:translate-x-0.5" />
                  )}
                  {isSuper && (
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-black tracking-wider rounded bg-amber-500/25 text-amber-200 border border-amber-500/40">
                      SUPER
                    </span>
                  )}
                  {item.shortcut && !hasSubmenu && (
                    <kbd
                      className={`px-1.5 py-0.5 text-[10px] rounded font-mono whitespace-nowrap transition ${
                        isSuper
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-700/50'
                          : isActive
                            ? 'bg-blue-700 text-blue-100 border border-blue-500/50'
                            : 'bg-slate-800 text-slate-400 border border-slate-700/80 group-hover:bg-slate-700 group-hover:text-slate-100 group-hover:border-slate-600'
                      }`}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* PWA Install Desktop App Button */}
        <div className="pt-2 pb-1">
          {isInstalled ? (
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="truncate">Desktop App Active</span>
              </div>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 rounded shrink-0">
                OFFLINE
              </span>
            </div>
          ) : (
            <button
              type="button"
              id="sidebar-install-desktop-app"
              onClick={handleInstallDesktopApp}
              className="w-full group relative flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-blue-700/90 hover:from-blue-600 hover:to-indigo-600 border border-blue-400/40 hover:border-blue-300 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
              title="Install Ezee ERP to Windows Desktop (Offline Ready)"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded-lg bg-white/20 text-white group-hover:bg-white/30 transition">
                  <Download className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-black tracking-tight leading-none text-white">Install Desktop App</div>
                  <div className="text-[10px] text-blue-100 font-medium leading-tight mt-0.5">Windows & Mac PWA</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-emerald-400 text-slate-950 shadow-xs shrink-0">
                OFFLINE
              </span>
            </button>
          )}
        </div>

        {/* Footer Build info */}
        <div className="pt-3 border-t border-slate-800 px-2 text-[11px] font-mono text-slate-400 flex justify-between items-center">
          <span>v2026.08 [HD]</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </aside>

      <ClientLinkAndPwaModal
        isOpen={showPwaModal}
        onClose={() => setShowPwaModal(false)}
        initialTab="pwa"
      />
    </>
  );
};
