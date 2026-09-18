import React from 'react';
import { Menu, RefreshCw, Store, Terminal, ShieldCheck, Database, ArrowLeft, Building2, ChevronDown, UserCircle, Lock, Shield } from 'lucide-react';
import { Config, AppUser } from '../types';
import { AIAssistant } from './AIAssistant';
import { getCurrentTenantSession, isSuperAdmin as checkIsSuperAdmin } from '../services/authTenantContext';

interface HeaderProps {
  config: Config;
  onToggleMobileMenu: () => void;
  onRefresh: () => void;
  canNavigateBack?: boolean;
  onNavigateBack?: () => void;
  isPosMode?: boolean;
  firebaseStatus?: 'connected' | 'syncing' | 'offline' | 'error';
  firebaseMessage?: string;
  onOpenCompanyManager?: () => void;
  activeCompanyName?: string;
  activeFYName?: string;
  currentUser?: AppUser;
  onOpenUserAuthModal?: () => void;
  onLockTerminal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onToggleMobileMenu,
  onRefresh,
  canNavigateBack,
  onNavigateBack,
  isPosMode = false,
  firebaseStatus = 'connected',
  firebaseMessage,
  onOpenCompanyManager,
  activeCompanyName,
  activeFYName,
  currentUser,
  onOpenUserAuthModal,
  onLockTerminal
}) => {
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

  const isSuperAdmin = checkIsSuperAdmin() || session?.isSuperadmin === true || rawRole === 'superadmin';

  // Compute clean display names to eliminate redundant titles like "System Administrator Administrator"
  const displayName = isSuperAdmin 
    ? (currentUser?.fullName && currentUser.fullName !== 'System Administrator' ? currentUser.fullName : 'Superadmin')
    : (currentUser?.fullName || 'User');

  const displayRole = isSuperAdmin
    ? 'SUPERADMIN'
    : (currentUser?.role === 'Administrator' ? 'ADMIN' : (currentUser?.role?.toUpperCase() || 'STAFF'));

  return (
    <header className={`bg-blue-700 text-white border-b border-blue-800 px-3 sm:px-4 ${isPosMode ? 'py-1.5' : 'py-2'} flex items-center justify-between shadow-md relative z-50`}>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Three-line menu button: always visible in POS full-screen mode, or on mobile */}
        <button
          onClick={onToggleMobileMenu}
          className={`${isPosMode ? 'flex' : 'lg:hidden flex'} p-1.5 rounded-lg text-blue-100 hover:bg-blue-800 transition cursor-pointer`}
          title="Toggle Navigation Menu (Alt+M)"
        >
          <Menu className="h-5 w-5" />
        </button>

        {onNavigateBack && canNavigateBack && (
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black shadow-xs transition active:scale-95 border border-amber-500 cursor-pointer"
            title="Go Back to Previous Screen (Esc)"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[3]" />
            <span>Back</span>
          </button>
        )}

        {/* Company & Financial Year Selector Pill */}
        {isSuperAdmin && onOpenCompanyManager ? (
          <button
            type="button"
            onClick={onOpenCompanyManager}
            className="flex items-center gap-2 px-2.5 py-1 bg-blue-800/80 hover:bg-blue-900 border border-blue-600 rounded-xl transition text-left cursor-pointer group shadow-xs"
            title="System Administrator: Manage & Switch Companies (Alt+C)"
          >
            <div className="h-7 w-7 rounded-lg bg-purple-600/40 border border-purple-400/40 flex items-center justify-center text-purple-200 group-hover:text-white transition">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide leading-tight">
                  {activeCompanyName || config.CompanyName || 'Deep POS'}
                </span>
                <ChevronDown className="h-3 w-3 text-purple-300 group-hover:text-white transition" />
              </div>
              <span className="text-[10px] text-emerald-300 font-medium font-mono leading-tight">
                {activeFYName || 'FY 2026'} • <span className="text-purple-300 font-bold">SUPERADMIN</span>
              </span>
            </div>
          </button>
        ) : (
          <div 
            className="flex items-center gap-2 px-2.5 py-1 bg-blue-800/60 border border-blue-600/60 rounded-xl shadow-xs"
            title={`Assigned Tenant Workspace: ${activeCompanyName || config.CompanyName}`}
          >
            <div className="h-7 w-7 rounded-lg bg-blue-900/60 border border-blue-500/40 flex items-center justify-center text-emerald-300">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide block leading-tight">
                {activeCompanyName || config.CompanyName || 'Deep POS'}
              </span>
              <span className="text-[10px] text-emerald-300 font-medium font-mono leading-tight flex items-center gap-1">
                <span>{activeFYName || 'FY 2026'}</span>
                <span className="text-blue-300">• Tenant Isolated</span>
              </span>
            </div>
          </div>
        )}
      </div>


      {/* High Density Status Indicators & Action Bar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 bg-blue-800/80 px-2.5 py-1 rounded-full text-xs font-mono text-blue-100 border border-blue-600/60">
          <Terminal className="h-3.5 w-3.5 text-blue-300" />
          <span>ST-01</span>
          <span className="h-3 w-[1px] bg-blue-600 mx-0.5" />
          <span className="text-emerald-300 font-bold flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> OPEN
          </span>
        </div>

        {/* Firebase Firestore Status Badge */}
        {firebaseStatus === 'syncing' ? (
          <div
            className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
            title={firebaseMessage || 'Syncing with Firestore...'}
          >
            <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-300 animate-spin" />
            <span className="hidden xs:inline">Firestore Syncing...</span>
            <span className="xs:hidden">Syncing</span>
          </div>
        ) : firebaseStatus === 'error' ? (
          <div
            className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
            title={firebaseMessage || 'Firestore sync error'}
          >
            <Database className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-rose-300" />
            <span className="hidden xs:inline">Firestore Error</span>
            <span className="xs:hidden">Error</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
            title="Cloud Firestore Real-time Persistence Active"
          >
            <Database className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-300 animate-pulse" />
            <span>FIRESTORE ONLINE</span>
          </div>
        )}

        {/* Active User / Shift Profile Button */}
        {onOpenUserAuthModal && (
          <button
            type="button"
            onClick={onOpenUserAuthModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-900 border border-blue-600 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            title={isSuperAdmin ? "System Administrator Session" : "Tenant User & Session Profile"}
          >
            <UserCircle className={`h-4 w-4 ${isSuperAdmin ? 'text-purple-300' : 'text-emerald-300'}`} />
            <div className="hidden sm:flex flex-col items-start leading-none text-left">
              <span className="font-bold text-[11px] text-white">
                {displayName}
              </span>
              <span className={`text-[9px] font-mono ${isSuperAdmin ? 'text-purple-300' : 'text-emerald-300'}`}>
                {displayRole}
              </span>
            </div>
          </button>
        )}

        {/* Lock Terminal Button */}
        {onLockTerminal && (
          <button
            type="button"
            onClick={onLockTerminal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-800 hover:bg-rose-700/80 border border-blue-600 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            title="Lock Terminal Screen (Alt+L)"
          >
            <Lock className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden md:inline text-[11px]">Lock</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-900 border border-blue-600 text-xs font-bold text-white shadow-xs transition cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 text-blue-200" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Global AI Assistant Button */}
        <AIAssistant />
      </div>
    </header>
  );
};
