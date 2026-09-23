import React, { useRef, useEffect, useState } from 'react';
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
  Trash2,
  X,
  Landmark,
  History,
  ShieldCheck,
  Tags,
  Download,
  Monitor,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { Config, AppUser } from "../types";
import { isSuperAdmin, getCurrentTenantSession } from '../services/authTenantContext';
import { isFeatureAllowed } from '../services/tenantFeatureService';
import { promptPwaInstall, isPwaInstalled, subscribePwaState, canInstallPwa } from '../services/pwaService';
import { ClientLinkAndPwaModal } from './ClientLinkAndPwaModal';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
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
      // If browser doesn't have an active synthetic prompt (e.g. running in an iframe or Safari/Firefox),
      // open the modal with guidance & direct installation steps
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'Alt+H' },
    ...(isFeatureAllowed(config, 'EnablePOS', isSuperadminUser) && config.EnablePOS !== 'false' ? [{ id: 'pos', label: 'POS Billing', icon: ShoppingCart, shortcut: 'Alt+P' }] : []),
    ...(isFeatureAllowed(config, 'EnableNormalSale', isSuperadminUser) && config.EnableNormalSale !== 'false' ? [{ id: 'normalsale', label: 'Sales Invoice', icon: ShoppingBag, shortcut: 'Alt+N' }] : []),
    ...(!isCashier && isFeatureAllowed(config, 'EnablePurchase', isSuperadminUser) && config.EnablePurchase !== 'false' ? [{ id: 'purchase', label: 'Purchase Entry', icon: ShoppingBag, shortcut: 'Alt+U' }] : []),
    ...(!isCashier && isFeatureAllowed(config, 'EnableVouchers', isSuperadminUser) && config.EnableVouchers !== 'false' ? [{ id: 'vouchers', label: 'Vouchers', icon: BookOpen, shortcut: 'Alt+V' }] : []),
    { id: 'masters', label: 'Masters', icon: FolderKanban, shortcut: 'Alt+M' },
    ...(isFeatureAllowed(config, 'EnableSchemes', isSuperadminUser) && config.EnableSchemes !== 'false' ? [{ id: 'schemes', label: 'Schemes & Offers', icon: Tags, shortcut: 'Alt+O' }] : []),
    ...(isFeatureAllowed(config, 'EnableBarcodePrinting', isSuperadminUser) && config.EnableBarcodePrinting !== 'false' ? [{ id: 'barcode', label: 'Barcode Print', icon: Barcode, shortcut: 'Alt+K' }] : []),
    ...(!isCashier && isFeatureAllowed(config, 'EnablePayroll', isSuperadminUser) && config.EnablePayroll !== 'false' ? [{ id: 'payroll', label: 'Payroll & HR', icon: Users, shortcut: 'Alt+Y' }] : []),
    ...(!isCashier ? [{ id: 'staff', label: 'Staff & Tasks', icon: Smartphone, shortcut: 'Alt+A' }] : []),
    ...(!isCashier && isFeatureAllowed(config, 'EnableAssetManagement', isSuperadminUser) && config.EnableAssetManagement !== 'false' ? [{ id: 'assets', label: 'Asset Management', icon: Building, shortcut: 'Alt+E' }] : []),
    ...(!isCashier && isFeatureAllowed(config, 'EnableBankReconciliation', isSuperadminUser) && config.EnableBankReconciliation !== 'false' ? [{ id: 'bankrecon', label: 'Bank Reconciliation', icon: Landmark, shortcut: 'Alt+B' }] : []),
    ...(!isCashier ? [{ id: 'reports', label: 'Reports', icon: BarChart3, shortcut: 'Alt+R' }] : []),
    ...(!isCashier ? [{ id: 'settings', label: 'Settings', icon: Settings, shortcut: 'Alt+S' }] : []),
    ...(isSuperadminUser ? [{ 
      id: 'superadmin', 
      label: '🏢 Superadmin Portal', 
      icon: ShieldCheck, 
      shortcut: 'Alt+0',
      isSuperBadge: true 
    }] : [])
  ];

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow key navigation between navigation menu items (Alt+Up / Alt+Down or Up / Down when focused on sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // Check if sidebar has focus or Alt key modifier is used
      const isSidebarFocused = itemRefs.current.some(btn => btn === activeEl);

      // If user is typing in text fields, only respond to Alt+Up / Alt+Down
      if (isInputFocused && !e.altKey) {
        return;
      }

      if ((e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) || (isSidebarFocused && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) {
        e.preventDefault();
        const currentIndex = navItems.findIndex(item => item.id === currentView);
        if (currentIndex === -1) return;

        if (e.key === 'ArrowDown') {
          const nextIndex = (currentIndex + 1) % navItems.length;
          onNavigate(navItems[nextIndex].id);
          itemRefs.current[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
          const prevIndex = (currentIndex - 1 + navItems.length) % navItems.length;
          onNavigate(navItems[prevIndex].id);
          itemRefs.current[prevIndex]?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, onNavigate, navItems]);

  return (
    <>
      {/* Backdrop (Mobile, or Desktop when POS is full screen) */}
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
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              E
            </div>
            <div>
              <div className="font-black text-base tracking-wide text-white">Ezee ERP</div>
              <div className="text-[10px] font-medium text-blue-300 leading-tight">Everything Your Business Needs, in One Place.</div>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className={`${hideDesktop ? '' : 'lg:hidden'} text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer`}
            title="Close menu (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav 
          role="navigation"
          aria-label="Main Application Menu"
          className="flex-1 space-y-1 overflow-y-auto pr-1"
        >
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isSuper = (item as any).isSuperBadge;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                ref={el => (itemRefs.current[idx] = el)}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
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
                  {isSuper && (
                    <span className="px-1.5 py-0.5 text-[9px] uppercase font-black tracking-wider rounded bg-amber-500/25 text-amber-200 border border-amber-500/40">
                      SUPER
                    </span>
                  )}
                  {item.shortcut && (
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
      />
    </>
  );
};
