import React, { useRef, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { Config } from "../types";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  hideDesktop?: boolean;
  config: Config;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  hideDesktop = false,
  config
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
    ...(config.EnablePOS !== 'false' ? [{ id: 'pos', label: 'POS Billing', icon: ShoppingCart, shortcut: 'P' }] : []),
    ...(config.EnableNormalSale !== 'false' ? [{ id: 'normalsale', label: 'Sales Invoice (B2B)', icon: ShoppingBag, shortcut: 'N' }] : []),
    { id: 'purchase', label: 'Purchase Entry', icon: ShoppingBag, shortcut: 'U' },
    { id: 'vouchers', label: 'Vouchers', icon: BookOpen, shortcut: 'V' },
    { id: 'masters', label: 'Masters Directory', icon: FolderKanban, shortcut: 'M' },
    { id: 'barcode', label: 'Barcode Print', icon: Barcode, shortcut: 'B' },
    ...(config.EnablePayroll !== 'false' ? [{ id: 'payroll', label: 'Payroll & HR', icon: Users }] : []),
    ...(config.EnableAssetManagement !== 'false' ? [{ id: 'assets', label: 'Asset Management', icon: Building, shortcut: 'A' }] : []),
    { id: 'reports', label: 'Reports & Audit', icon: BarChart3, shortcut: 'R' },
    { id: 'settings', label: 'Settings', icon: Settings, shortcut: 'S' }
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
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col p-4 shadow-2xl transition-transform duration-300 ease-in-out ${
          hideDesktop ? '' : 'lg:static lg:translate-x-0'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              D
            </div>
            <div>
              <div className="font-black text-base tracking-wide text-white">Deep POS</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400">High Density System</div>
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
          className="flex-1 space-y-1 overflow-y-auto"
        >
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                ref={el => (itemRefs.current[idx] = el)}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <kbd
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono transition ${
                      isActive
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-800/90 text-slate-400 border border-slate-700 group-hover:text-slate-200'
                    }`}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Build info */}
        <div className="pt-3 border-t border-slate-800 px-2 text-[11px] font-mono text-slate-400 flex justify-between items-center">
          <span>v2026.08 [HD]</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </aside>
    </>
  );
};
