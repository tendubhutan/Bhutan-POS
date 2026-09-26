import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, RefreshCw, Store, Terminal, ShieldCheck, Database, 
  ArrowLeft, Building2, ChevronDown, UserCircle, Lock, Shield, 
  Radio, Wifi, Laptop, Download, Share2, Smartphone, Layers,
  ExternalLink, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Config, AppUser } from '../types';
import { AIAssistant } from './AIAssistant';
import { getCurrentTenantSession, isSuperAdmin as checkIsSuperAdmin } from '../services/authTenantContext';
import { getBranches, getTerminalBranchId, setTerminalBranchId } from '../services/storageService';
import { LocalLanHubModal } from './LocalLanHubModal';
import { ClientLinkAndPwaModal } from './ClientLinkAndPwaModal';

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
  onNavigate?: (view: string) => void;
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
  onLockTerminal,
  onNavigate
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

  const [terminalBranchId, setLocalTerminalBranchId] = useState<string>(() => getTerminalBranchId(config));
  const [isLanHubModalOpen, setIsLanHubModalOpen] = useState<boolean>(false);
  const [isClientLinkModalOpen, setIsClientLinkModalOpen] = useState<boolean>(false);
  const [clientLinkModalTab, setClientLinkModalTab] = useState<'links' | 'manage' | 'pwa'>('links');
  const [isConnectivityOpen, setIsConnectivityOpen] = useState<boolean>(false);
  const connectivityMenuRef = useRef<HTMLDivElement>(null);
  const branches = getBranches();

  // Close connectivity dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (connectivityMenuRef.current && !connectivityMenuRef.current.contains(e.target as Node)) {
        setIsConnectivityOpen(false);
      }
    };
    if (isConnectivityOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConnectivityOpen]);

  useEffect(() => {
    const handleBranchChanged = (e: any) => {
      if (e.detail?.branchId) {
        setLocalTerminalBranchId(e.detail.branchId);
      }
    };
    const handleOpenClientLink = (e: any) => {
      const tab = e.detail?.tab || 'links';
      setClientLinkModalTab(tab);
      setIsClientLinkModalOpen(true);
    };

    window.addEventListener('terminal:branch_changed', handleBranchChanged);
    window.addEventListener('open_client_link_modal', handleOpenClientLink);
    return () => {
      window.removeEventListener('terminal:branch_changed', handleBranchChanged);
      window.removeEventListener('open_client_link_modal', handleOpenClientLink);
    };
  }, []);

  return (
    <header className={`bg-gradient-to-r from-blue-700 via-blue-700 to-indigo-800 text-white border-b border-blue-800/80 px-2 sm:px-3.5 ${isPosMode ? 'py-1.5' : 'py-2'} flex items-center justify-between gap-1.5 sm:gap-2 shadow-md relative z-40 select-none w-full max-w-full overflow-x-hidden`}>
      {/* ========================================================= */}
      {/* ZONE 1: WORKSPACE & COMPANY IDENTITY                      */}
      {/* ========================================================= */}
      <div className="flex items-center gap-1 sm:gap-2 shrink min-w-0 max-w-[38%] lg:max-w-[42%]">
        {/* Three-line menu button: always visible in POS full-screen mode, or on mobile */}
        <button
          onClick={onToggleMobileMenu}
          className={`${isPosMode ? 'flex' : 'lg:hidden flex'} p-1.5 rounded-xl text-blue-100 hover:bg-blue-800/80 hover:text-white transition cursor-pointer shrink-0`}
          title="Toggle Navigation Menu (Alt+M)"
        >
          <Menu className="h-5 w-5" />
        </button>

        {onNavigateBack && canNavigateBack && (
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-slate-950 px-2 py-1 rounded-xl text-xs font-black shadow-xs transition active:scale-95 border border-amber-500 cursor-pointer shrink-0"
            title="Go Back to Previous Screen (Esc)"
          >
            <ArrowLeft className="h-3.5 w-3.5 stroke-[3]" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        {/* Company & Financial Year Selector Pill */}
        {isSuperAdmin && onOpenCompanyManager ? (
          <button
            type="button"
            onClick={onOpenCompanyManager}
            className="flex items-center gap-1.5 px-2 py-1 bg-blue-800/80 hover:bg-blue-900 border border-blue-500/50 hover:border-purple-400/60 rounded-xl transition text-left cursor-pointer group shadow-xs shrink min-w-0"
            title="System Administrator: Manage & Switch Companies (Alt+C)"
          >
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-purple-600/40 border border-purple-400/40 flex items-center justify-center text-purple-200 group-hover:text-white transition shrink-0">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-xs text-white tracking-wide leading-tight truncate max-w-[80px] sm:max-w-[110px] lg:max-w-[150px] xl:max-w-[190px]">
                  {activeCompanyName || config.CompanyName || 'Ezee ERP'}
                </span>
                <ChevronDown className="h-3 w-3 text-purple-300 group-hover:text-white transition shrink-0" />
              </div>
              <span className="text-[10px] text-emerald-300 font-medium font-mono leading-tight truncate">
                {activeFYName || 'FY 2026'} • <span className="text-purple-300 font-bold">SUPERADMIN</span>
              </span>
            </div>
          </button>
        ) : (
          <div 
            className="flex items-center gap-1.5 px-2 py-1 bg-blue-800/60 border border-blue-500/40 rounded-xl shadow-xs shrink min-w-0"
            title={`Assigned Tenant Workspace: ${activeCompanyName || config.CompanyName}`}
          >
            <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg bg-blue-900/60 border border-blue-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-xs text-white tracking-wide block leading-tight truncate max-w-[80px] sm:max-w-[110px] lg:max-w-[150px] xl:max-w-[190px]">
                {activeCompanyName || config.CompanyName || 'Ezee ERP'}
              </span>
              <span className="text-[10px] text-emerald-300 font-medium font-mono leading-tight flex items-center gap-1 truncate">
                <span>{activeFYName || 'FY 2026'}</span>
                <span className="text-blue-300 hidden sm:inline">• Tenant Isolated</span>
              </span>
            </div>
          </div>
        )}

        {/* Terminal Branch Selector Dropdown (when Multi-Branch is enabled) */}
        {config?.EnableMultiBranch === 'true' && (
          <div 
            className="hidden sm:flex items-center gap-1 bg-blue-900/80 border border-blue-400/40 hover:border-blue-300 px-2 py-1 rounded-xl text-xs font-bold text-white shadow-xs transition shrink min-w-0"
            title="Active Branch for this Terminal/Computer (click to switch branch)"
          >
            <Building2 className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <select
              value={terminalBranchId || config.ActiveBranchId || ''}
              onChange={(e) => {
                const newId = e.target.value;
                setLocalTerminalBranchId(newId);
                setTerminalBranchId(newId);
              }}
              className="bg-transparent text-white font-extrabold text-xs outline-none cursor-pointer pr-1 max-w-[70px] md:max-w-[100px] xl:max-w-[140px] truncate"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="text-slate-900 bg-white font-bold">
                  {b.name} {b.isHeadOffice ? '(HQ)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ZONE 2: PROMINENT CENTER SEARCH & AI ASSISTANT            */}
      {/* ========================================================= */}
      <div className="flex-1 flex justify-center items-center px-1 min-w-0 max-w-[180px] sm:max-w-[220px] md:max-w-[280px] xl:max-w-[340px] mx-auto">
        <AIAssistant />
      </div>

      {/* ========================================================= */}
      {/* ZONE 3: STATUS & ACTION UTILITIES                         */}
      {/* ========================================================= */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Full Terminal & Cloud Status Pill on large screens */}
        <div 
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/70 border border-blue-400/30 rounded-xl text-xs font-mono shadow-2xs cursor-default"
          title={`Terminal ST-01 (Shift OPEN) • Cloud Database: ${
            firebaseStatus === 'syncing' 
              ? 'Syncing with Supabase...' 
              : firebaseStatus === 'error' 
              ? (firebaseMessage || 'Supabase Sync Error') 
              : 'Supabase Real-Time Connected (Online)'
          }`}
        >
          <span className="text-blue-200 font-semibold flex items-center gap-1">
            <Terminal className="h-3 w-3 text-blue-300" />
            ST-01
          </span>
          <span className="h-3 w-[1px] bg-blue-600" />
          {firebaseStatus === 'syncing' ? (
            <span className="flex items-center gap-1 text-amber-300 text-[11px] font-sans font-bold">
              <RefreshCw className="h-3 w-3 animate-spin text-amber-300" />
              <span>Syncing</span>
            </span>
          ) : firebaseStatus === 'error' ? (
            <span className="flex items-center gap-1 text-rose-300 text-[11px] font-sans font-bold">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span>Offline</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-300 text-[11px] font-sans font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online</span>
            </span>
          )}
        </div>

        {/* Compact Terminal & Cloud Status Dot on screens below xl */}
        <div 
          className="xl:hidden flex items-center justify-center h-8 w-8 rounded-xl bg-blue-900/70 border border-blue-400/30 shadow-2xs cursor-default"
          title={`Terminal ST-01 (Shift OPEN) • Cloud Database: ${
            firebaseStatus === 'syncing' 
              ? 'Syncing with Supabase...' 
              : firebaseStatus === 'error' 
              ? (firebaseMessage || 'Supabase Sync Error') 
              : 'Supabase Real-Time Connected (Online)'
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${
            firebaseStatus === 'syncing' ? 'bg-amber-400 animate-spin' : firebaseStatus === 'error' ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
          }`} />
        </div>

        {/* Staff Attendance, Leaves & Tasks Quick Button */}
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('staff')}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-blue-800/80 hover:bg-blue-900 border border-blue-500/40 hover:border-blue-400 text-blue-100 hover:text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Staff Attendance, Leave Policies, and Tasks"
          >
            <Smartphone className="h-3.5 w-3.5 text-blue-300 shrink-0" />
            <span className="hidden sm:inline text-[11px]">Staff</span>
          </button>
        )}

        {/* Connectivity & Apps Dropdown (Client Link, PWA, WiFi LAN Hub) */}
        <div className="relative" ref={connectivityMenuRef}>
          <button
            type="button"
            onClick={() => setIsConnectivityOpen(!isConnectivityOpen)}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-bold shadow-xs transition cursor-pointer ${
              isConnectivityOpen
                ? 'bg-blue-900 border-blue-400 text-white ring-2 ring-blue-400/20'
                : 'bg-blue-800/80 hover:bg-blue-900 border-blue-500/40 hover:border-blue-400 text-blue-100 hover:text-white'
            }`}
            title="Network & Connectivity Tools (WiFi Hub, Client Link, PWA App)"
          >
            <Wifi className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
            <span className="hidden md:inline text-[11px]">Hub & Apps</span>
            <ChevronDown className={`h-3 w-3 text-blue-300 transition-transform duration-200 ${isConnectivityOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Popover */}
          {isConnectivityOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 mb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Connectivity & App Hub
                </span>
              </div>

              {/* Option 1: Client Link & Desktop PWA */}
              <button
                type="button"
                onClick={() => {
                  setClientLinkModalTab('links');
                  setIsClientLinkModalOpen(true);
                  setIsConnectivityOpen(false);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-50 transition text-left flex items-start gap-3 cursor-pointer group"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition shrink-0">
                  <Laptop className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>Client Link & Desktop App</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">PWA</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Dedicated client URL, QR codes & desktop app installation
                  </p>
                </div>
              </button>

              {/* Option 2: Shop WiFi LAN Hub */}
              <button
                type="button"
                onClick={() => {
                  setIsLanHubModalOpen(true);
                  setIsConnectivityOpen(false);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-50 transition text-left flex items-start gap-3 cursor-pointer group mt-1"
              >
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition shrink-0">
                  <Radio className="h-4 w-4 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                    <span>WiFi LAN Hub (Offline Mode)</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">LAN</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Multi-PC token synchronization & consecutive numbering
                  </p>
                </div>
              </button>

              {/* Option 3: Staff Mobile Portal */}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('staff');
                    setIsConnectivityOpen(false);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-50 transition text-left flex items-start gap-3 cursor-pointer group mt-1"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition shrink-0">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <span>Staff Mobile Portal</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Mobile</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Clock-in, biometric/PIN, leave requests & task replies
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Active User / Shift Profile Button */}
        {onOpenUserAuthModal && (
          <button
            type="button"
            onClick={onOpenUserAuthModal}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-blue-800/80 hover:bg-blue-900 border border-blue-500/40 hover:border-blue-400 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            title={isSuperAdmin ? "System Administrator Session" : "Tenant User & Session Profile"}
          >
            <UserCircle className={`h-4 w-4 shrink-0 ${isSuperAdmin ? 'text-purple-300' : 'text-emerald-300'}`} />
            <div className="hidden lg:flex flex-col items-start leading-none text-left min-w-0">
              <span className="font-bold text-[11px] text-white truncate max-w-[90px] xl:max-w-[120px]">
                {displayName}
              </span>
              <span className={`text-[9px] font-mono ${isSuperAdmin ? 'text-purple-300' : 'text-emerald-300'}`}>
                {displayRole}
              </span>
            </div>
          </button>
        )}

        {/* Lock Terminal Quick Button */}
        {onLockTerminal && (
          <button
            type="button"
            onClick={onLockTerminal}
            className="flex items-center justify-center h-8 w-8 sm:w-auto sm:px-2 sm:py-1.5 rounded-xl bg-blue-800/80 hover:bg-rose-700/80 border border-blue-500/40 hover:border-rose-400/50 text-xs font-bold text-white shadow-xs transition cursor-pointer group"
            title="Lock Terminal Screen (Alt+L)"
          >
            <Lock className="h-3.5 w-3.5 text-amber-300 group-hover:text-white transition-colors" />
            <span className="hidden xl:inline text-[11px] ml-1">Lock</span>
          </button>
        )}

        {/* Refresh Application Data Button */}
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center justify-center h-8 w-8 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-800/80 hover:bg-blue-900 border border-blue-500/40 hover:border-blue-400 text-xs font-bold text-white shadow-xs transition cursor-pointer group"
          title="Refresh Application Data (Alt+R)"
        >
          <RefreshCw className="h-3.5 w-3.5 text-blue-200 group-hover:rotate-180 transition-transform duration-500" />
          <span className="hidden xl:inline text-[11px] ml-1">Refresh</span>
        </button>
      </div>

      <LocalLanHubModal
        isOpen={isLanHubModalOpen}
        onClose={() => setIsLanHubModalOpen(false)}
      />

      <ClientLinkAndPwaModal
        isOpen={isClientLinkModalOpen}
        onClose={() => setIsClientLinkModalOpen(false)}
        activeCompanyName={activeCompanyName}
        initialTab={clientLinkModalTab}
      />
    </header>
  );
};

