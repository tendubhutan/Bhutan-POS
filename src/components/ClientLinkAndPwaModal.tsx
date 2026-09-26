import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Download,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Zap,
  ExternalLink,
  ShieldCheck,
  Layers,
  Laptop,
  Radio,
  CheckCircle2,
  X,
  Share2,
  Settings,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Store,
  AlertCircle,
  RotateCcw,
  Building2,
  Lock,
  Wifi,
  WifiOff
} from 'lucide-react';
import {
  getDeviceCounterId,
  setDeviceCounterId,
  getTerminalsConfig,
  saveTerminalConfig,
  deleteTerminalConfig,
  getMaxTerminalLimit,
  setMaxTerminalLimit,
  resetTerminalsToDefault,
  getBranches
} from '../services/storageService';
import { isSuperAdmin } from '../services/authTenantContext';
import { promptPwaInstall, isPwaInstalled, subscribePwaState, canInstallPwa } from '../services/pwaService';
import { 
  getDedicatedEmployeePortalUrl, 
  getOfficeNetworkConfig, 
  saveOfficeNetworkConfig 
} from '../services/employeeStaffService';
import { getActiveCompanyId } from '../services/supabaseTenantService';
import { EzeeErpLogo } from './common/EzeeErpLogo';
import { TerminalConfig, Branch } from '../types';
import { OfficeNetworkSecurityConfig } from '../types/staffPortal';

interface ClientLinkAndPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCompanyName?: string;
  initialTab?: 'links' | 'manage' | 'pwa';
}

export const ClientLinkAndPwaModal: React.FC<ClientLinkAndPwaModalProps> = ({
  isOpen,
  onClose,
  activeCompanyName = 'Ezee ERP',
  initialTab = 'links'
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<TerminalConfig[]>(() => getTerminalsConfig());
  const [maxLimit, setLocalMaxLimit] = useState<number>(() => getMaxTerminalLimit());
  const [branches, setBranches] = useState<Branch[]>(() => getBranches());
  const [selectedPreset, setSelectedPreset] = useState<string>('C1');
  const [hasPrompt, setHasPrompt] = useState<boolean>(() => canInstallPwa());
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(() => isPwaInstalled());
  const [activeTab, setActiveTab] = useState<'links' | 'manage' | 'pwa' | 'staff'>((initialTab as any) || 'links');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Terminal Edit / Create Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<TerminalConfig>>({
    id: '',
    code: '',
    name: '',
    role: 'Cashier',
    defaultView: 'pos',
    description: '',
    tag: '',
    isActive: true
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showRestrictedNotice, setShowRestrictedNotice] = useState<boolean>(false);

  const currentDeviceId = getDeviceCounterId();

  // Load and subscribe to updates
  useEffect(() => {
    const refresh = () => {
      const list = getTerminalsConfig();
      setTerminals(list);
      setLocalMaxLimit(getMaxTerminalLimit());
      setBranches(getBranches());
      if (list.length > 0 && !list.some(t => t.id === selectedPreset || t.code === selectedPreset)) {
        setSelectedPreset(list[0].code || list[0].id);
      }
    };

    refresh();
    window.addEventListener('terminals_config_changed', refresh);
    window.addEventListener('terminal_limit_changed', refresh);
    window.addEventListener('branches_changed', refresh);

    setIsAppInstalled(isPwaInstalled());
    setHasPrompt(canInstallPwa());
    const unsubPwa = subscribePwaState(() => {
      setIsAppInstalled(isPwaInstalled());
      setHasPrompt(canInstallPwa());
    });

    return () => {
      window.removeEventListener('terminals_config_changed', refresh);
      window.removeEventListener('terminal_limit_changed', refresh);
      window.removeEventListener('branches_changed', refresh);
      unsubPwa();
    };
  }, [selectedPreset]);

  const currentCompanyId = getActiveCompanyId();
  const [staffNetworkConfig, setStaffNetworkConfig] = useState<OfficeNetworkSecurityConfig>(() => getOfficeNetworkConfig(currentCompanyId));

  useEffect(() => {
    const handleNetUpdate = (e: any) => {
      setStaffNetworkConfig(e.detail?.config || getOfficeNetworkConfig(currentCompanyId));
    };
    window.addEventListener('deep_pos_network_security_updated', handleNetUpdate);
    return () => window.removeEventListener('deep_pos_network_security_updated', handleNetUpdate);
  }, [currentCompanyId]);

  if (!isOpen) return null;

  // Active terminals count vs limit
  const activeTerminalsCount = terminals.filter(t => t.isActive).length;
  const isAtLimit = maxLimit > 0 && activeTerminalsCount >= maxLimit;

  // Base URL calculation
  const getBaseAppUrl = () => {
    if (typeof window === 'undefined') return 'https://pos.store';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}`;
  };

  const getCompanyAppUrl = () => {
    const base = getBaseAppUrl();
    return currentCompanyId ? `${base}?company=${currentCompanyId}` : base;
  };

  const generateLink = (counter: string, role: string, view: string = 'pos', branchId?: string) => {
    const base = getBaseAppUrl();
    const params = new URLSearchParams();
    if (currentCompanyId) params.set('company', currentCompanyId);
    if (counter) params.set('counter', counter);
    if (role) params.set('role', role);
    if (view && view !== 'dashboard') params.set('view', view);
    if (branchId) params.set('branch', branchId);
    return `${base}?${params.toString()}`;
  };

  const handleCopy = (key: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const handleInstallPwa = async () => {
    if (canInstallPwa()) {
      const result = await promptPwaInstall();
      if (result === 'accepted') {
        setIsAppInstalled(true);
      }
    } else {
      handleCopy('appUrl', getCompanyAppUrl());
    }
  };

  // Open Edit Terminal Modal
  const handleOpenEdit = (terminal: TerminalConfig) => {
    setEditingTerminalId(terminal.id || terminal.code);
    setFormData({
      id: terminal.id,
      code: terminal.code,
      name: terminal.name,
      role: terminal.role || 'Cashier',
      defaultView: terminal.defaultView || 'pos',
      description: terminal.description || '',
      tag: terminal.tag || '',
      color: terminal.color || '',
      branchId: terminal.branchId || '',
      branchName: terminal.branchName || '',
      isActive: terminal.isActive !== false
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Create Terminal Modal
  const handleOpenCreate = () => {
    if (isAtLimit && !isSuperAdmin()) {
      setShowRestrictedNotice(true);
      return;
    }
    if (isAtLimit) {
      setFormError(`Subscription limit reached (${maxLimit} allowed). Increase limit as Superadmin or deactivate an existing terminal first.`);
    } else {
      setFormError(null);
    }
    const nextNum = terminals.length + 1;
    setEditingTerminalId(null);
    setFormData({
      id: `C${nextNum}`,
      code: `C${nextNum}`,
      name: `Counter ${nextNum} (Billing PC)`,
      role: 'Cashier',
      defaultView: 'pos',
      description: 'Dedicated billing & checkout desk',
      tag: `Counter ${nextNum}`,
      isActive: true
    });
    setIsEditModalOpen(true);
  };

  // Save Terminal Form
  const handleSaveTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = (formData.code || '').trim().toUpperCase();
    const cleanName = (formData.name || '').trim();

    if (!cleanCode) {
      setFormError('Terminal Code / Identifier (e.g. C1, PL-01) is required.');
      return;
    }
    if (!cleanName) {
      setFormError('Terminal Name (e.g. Main Billing Desk, Counter 1) is required.');
      return;
    }

    const selectedBranch = branches.find(b => b.id === formData.branchId);

    const terminalToSave: TerminalConfig = {
      id: editingTerminalId || cleanCode,
      code: cleanCode,
      name: cleanName,
      role: formData.role || 'Cashier',
      defaultView: formData.defaultView || 'pos',
      description: formData.description || '',
      tag: formData.tag || cleanName,
      color: formData.color || 'from-indigo-600 to-blue-600',
      branchId: formData.branchId || undefined,
      branchName: selectedBranch?.name || undefined,
      isActive: formData.isActive !== false
    };

    const res = saveTerminalConfig(terminalToSave);
    if (!res.ok) {
      setFormError(res.error || 'Failed to save terminal.');
      return;
    }

    setTerminals(res.terminals);
    setIsEditModalOpen(false);
    setActionSuccess(`Terminal "${cleanName}" (${cleanCode}) saved successfully!`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Delete Terminal
  const handleDeleteTerminal = (terminal: TerminalConfig) => {
    if (!window.confirm(`Are you sure you want to delete terminal "${terminal.name}" (${terminal.code})?`)) {
      return;
    }
    const res = deleteTerminalConfig(terminal.id || terminal.code);
    if (!res.ok) {
      alert(res.error || 'Cannot delete terminal.');
      return;
    }
    setTerminals(res.terminals);
    setActionSuccess(`Terminal "${terminal.name}" deleted.`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Toggle Terminal Status
  const handleToggleTerminalStatus = (terminal: TerminalConfig) => {
    const updated: TerminalConfig = {
      ...terminal,
      isActive: !terminal.isActive
    };
    const res = saveTerminalConfig(updated);
    if (!res.ok) {
      alert(res.error || 'Cannot update terminal status.');
      return;
    }
    setTerminals(res.terminals);
  };

  // Change Subscription Limit
  const handleLimitChange = (newLimit: number) => {
    setMaxTerminalLimit(newLimit);
    setLocalMaxLimit(newLimit);
    setActionSuccess(newLimit > 0 ? `Terminal subscription limit set to ${newLimit} active terminal(s).` : 'Terminal limit set to Unlimited.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  // Reset to default presets
  const handleResetDefaults = () => {
    if (window.confirm('Reset all terminal configurations to standard default presets (Counter 1-4, Accountants, Mobile)?')) {
      const reset = resetTerminalsToDefault();
      setTerminals(reset);
      setActionSuccess('Terminals reset to default presets.');
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  // Current active preset selection
  const activeTerminalsList = terminals.filter(t => t.isActive);
  const activePreset = terminals.find(p => (p.code || p.id) === selectedPreset) || activeTerminalsList[0] || terminals[0];
  const activeLink = activePreset
    ? generateLink(activePreset.code || activePreset.id, activePreset.role, activePreset.defaultView, activePreset.branchId)
    : getBaseAppUrl();

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(activeLink)}&margin=1`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-md">
              <Laptop className="h-6 w-6 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Dedicated Client Links & Terminal Setup</h2>
                <span className="px-2 py-0.5 bg-emerald-400 text-slate-950 font-black text-[10px] rounded-full uppercase tracking-wider">
                  Zero Setup
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Rename & configure custom terminals ({activeCompanyName}), adjust tier limits, and generate instant direct links.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Notification */}
        {actionSuccess && (
          <div className="bg-emerald-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-white/80 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 sm:px-5 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'links'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span>Dedicated Client Links & QR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'manage'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Manage Terminals & Plan Limits</span>
            <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-md ${
              isAtLimit ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {activeTerminalsCount}{maxLimit > 0 ? `/${maxLimit}` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'pwa'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Install PWA Desktop App</span>
            {isAppInstalled && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                Installed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'staff'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Staff Mobile Portal & QR</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {/* TAB 1: Client Links & QR Codes */}
          {activeTab === 'links' && (
            <div className="space-y-4">
              {/* Top Row: Terminal Selection & Manage CTA */}
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Select Target Terminal / Device:
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab('manage')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Rename / Edit Terminals</span>
                </button>
              </div>

              {/* Terminals Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {terminals.map((preset) => {
                  const presetKey = preset.code || preset.id;
                  const isSelected = selectedPreset === presetKey;
                  const isCurrent = currentDeviceId === presetKey;
                  return (
                    <button
                      key={preset.id || preset.code}
                      type="button"
                      onClick={() => setSelectedPreset(presetKey)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                          : preset.isActive
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          : 'bg-slate-50/60 border-slate-200 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-black text-xs text-slate-900">
                          {preset.code || preset.id}
                        </span>
                        <div className="flex items-center gap-1">
                          {!preset.isActive && (
                            <span className="px-1 py-0.2 bg-slate-200 text-slate-600 font-bold text-[8px] rounded">
                              Off
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold text-[9px] rounded">
                              This PC
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {preset.role} • {(preset.defaultView || 'POS').toUpperCase()}
                        {preset.branchName && ` • ${preset.branchName}`}
                      </div>
                    </button>
                  );
                })}

                {/* Add Terminal Quick Card */}
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="p-2.5 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/70 text-indigo-700 font-bold text-xs flex flex-col items-center justify-center gap-1 transition cursor-pointer min-h-[76px]"
                >
                  <Plus className="h-4 w-4 text-indigo-600" />
                  <span>Add Terminal</span>
                </button>
              </div>

              {/* Active Link & QR Code Card */}
              {activePreset ? (
                <div className="p-4 bg-gradient-to-br from-slate-50 via-indigo-50/40 to-blue-50/40 rounded-2xl border border-indigo-100 space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-indigo-100">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <span>{activePreset.name}</span>
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                          [{activePreset.code || activePreset.id}]
                        </span>
                        {activePreset.branchName && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {activePreset.branchName}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500">{activePreset.description || 'Pre-assigned terminal configuration'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(activePreset)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                        title="Edit terminal name & settings"
                      >
                        <Edit2 className="h-3 w-3 text-indigo-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy('active', activeLink)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        {copiedKey === 'active' ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Dedicated URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    {/* QR Code */}
                    <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs flex flex-col items-center justify-center text-center">
                      <img
                        src={qrCodeUrl}
                        alt={`QR Code for ${activePreset.name}`}
                        className="h-32 w-32 rounded-xl object-contain shadow-2xs"
                        loading="lazy"
                      />
                      <div className="text-[10px] font-bold text-slate-600 mt-2 flex items-center gap-1">
                        <QrCode className="h-3 w-3 text-indigo-600" />
                        <span>Scan with Phone Camera</span>
                      </div>
                    </div>

                    {/* URL & Features */}
                    <div className="md:col-span-2 space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Direct Client Access URL:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={activeLink}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 shadow-2xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="p-2.5 bg-white/90 rounded-xl border border-indigo-100 space-y-1 text-xs">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                          <span>Zero-Configuration Auto-Binding</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Opening this URL on any laptop, counter terminal, or smartphone instantly sets its terminal ID to <span className="font-mono font-bold text-indigo-700">{activePreset.code || activePreset.id}</span> and launches directly into <span className="font-bold">{(activePreset.defaultView || 'pos').toUpperCase()}</span> mode.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={activeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <span>Open in New Window</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            setDeviceCounterId(activePreset.code || activePreset.id);
                            if (activePreset.branchId) {
                              // update branch if attached
                            }
                            alert(`This PC has been assigned as "${activePreset.name}" [${activePreset.code || activePreset.id}]`);
                          }}
                          className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:underline"
                        >
                          Set this PC as {activePreset.code || activePreset.id}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs text-slate-500">No active terminals available.</p>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="mt-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                  >
                    Create Terminal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Manage Terminals & Subscription Tier Limits */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              {/* Subscription Tier & Allowed Terminals Limit Card */}
              <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black text-sm text-white flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-indigo-300" />
                      <span>Authorized POS Counters Quota</span>
                    </h3>
                    <p className="text-xs text-indigo-200">
                      {isSuperAdmin()
                        ? 'Superadmin Control: Restrict allowed active cashier counters based on customer pricing tier.'
                        : 'Plan Quota: Number of cashier desks your current subscription allows you to run simultaneously.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-indigo-200 font-semibold">Active Counters:</span>
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black ${
                      isAtLimit ? 'bg-amber-400 text-slate-950' : 'bg-emerald-400 text-slate-950'
                    }`}>
                      {activeTerminalsCount} {maxLimit > 0 ? `/ ${maxLimit} Allowed` : '(Unlimited)'}
                    </span>
                  </div>
                </div>

                {/* Limit Quick Selectors (Superadmin Only) or Status Info (Client) */}
                {isSuperAdmin() ? (
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-300">Superadmin Override:</span>
                    {[
                      { label: '1 Counter', value: 1 },
                      { label: '2 Counters', value: 2 },
                      { label: '3 Counters', value: 3 },
                      { label: '4 Counters', value: 4 },
                      { label: '5 Counters', value: 5 },
                      { label: 'Unlimited', value: 0 }
                    ].map(tier => (
                      <button
                        key={tier.value}
                        type="button"
                        onClick={() => handleLimitChange(tier.value)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                          maxLimit === tier.value
                            ? 'bg-emerald-400 text-slate-950 shadow-xs'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
                    <span>
                      Subscription Limit: <strong className="text-white">{maxLimit > 0 ? `${maxLimit} Active Terminal${maxLimit > 1 ? 's' : ''}` : 'Unlimited'}</strong>
                    </span>
                    <span className="text-[11px] text-indigo-300/80">
                      Need more counters? Contact Superadmin to upgrade your tier.
                    </span>
                  </div>
                )}
              </div>

              {/* Terminals Table Controls */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                    Configured Terminals List ({terminals.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Rename IDs like C1 to custom names, assign roles, and toggle terminal access.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Reset to default presets"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New Terminal</span>
                  </button>
                </div>
              </div>

              {/* Terminals List Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Code / ID</th>
                      <th className="py-2.5 px-3">Terminal Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Landing Screen</th>
                      <th className="py-2.5 px-3">Branch</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {terminals.map((t) => {
                      const isCurrent = currentDeviceId === (t.code || t.id);
                      return (
                        <tr key={t.id || t.code} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {t.code || t.id}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span>{t.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold text-[8px] rounded">
                                  This PC
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <div className="text-[10px] font-normal text-slate-400 truncate max-w-xs">
                                {t.description}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600">
                            {t.role}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] font-semibold text-slate-700 capitalize">
                              {t.defaultView || 'pos'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {t.branchName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                <Building2 className="h-3 w-3" />
                                <span>{t.branchName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Global / Main</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleTerminalStatus(t)}
                              className={`p-1 rounded-lg transition cursor-pointer ${
                                t.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100'
                              }`}
                              title={t.isActive ? 'Active (Click to deactivate)' : 'Inactive (Click to activate)'}
                            >
                              {t.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(t)}
                                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                                title="Edit terminal configuration"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTerminal(t)}
                                className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                                title="Delete terminal"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Zero Collision Explanation */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2 text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Offline Bill Safety:</span> Each terminal's <span className="font-mono font-bold">Code</span> (e.g. <span className="font-mono">C1, C2, ACC</span>) is appended to invoice numbers during offline billing (e.g. <span className="font-mono font-bold">POS-C1-1001</span> and <span className="font-mono font-bold">POS-C2-1001</span>). This guarantees that multiple counters and accountants billing simultaneously with zero internet never collide or overwrite numbers.
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PWA Desktop App */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-3xl shadow-md space-y-3.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                      <Monitor className="h-7 w-7 text-indigo-200" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-white">Ezee ERP Desktop App (PWA)</h3>
                      <p className="text-xs text-indigo-200">
                        Everything Your Business Needs, in One Place — High-speed cashier experience with offline caching and native performance.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleInstallPwa}
                      className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-2"
                      title="Trigger browser PWA desktop application installer"
                    >
                      <Download className="h-4 w-4 stroke-[3]" />
                      <span>Install Desktop App Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy('appUrl', getBaseAppUrl())}
                      className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Copy application direct web URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedKey === 'appUrl' ? 'Copied URL!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-amber-300">⚡ Instant Load</div>
                    <div className="text-[11px] text-slate-300">Cached locally on disk for zero startup delay.</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-emerald-300">🖥️ Clean POS Window</div>
                    <div className="text-[11px] text-slate-300">Runs without browser tabs or search bar distractions.</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 space-y-0.5">
                    <div className="font-bold text-blue-300">🔌 Full Offline Suite</div>
                    <div className="text-[11px] text-slate-300">Bills continuously even during internet blackouts.</div>
                  </div>
                </div>
              </div>

              {/* Installation Guide */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  How to Install on Any Device:
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-indigo-600" />
                      <span>Windows & Mac (Chrome / Edge / Brave)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Click the <span className="font-bold text-slate-800">Install icon (⊕)</span> in the top right of your browser address bar, or click Menu (⋮) ➔ <span className="font-bold text-slate-800">"Install Ezee ERP"</span> / <span className="font-bold text-slate-800">"Create Shortcut"</span>.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="font-black text-slate-900 flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-emerald-600" />
                      <span>Mobile Phones (Android & iPhone)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      • <span className="font-bold text-slate-800">iPhone / Safari</span>: Tap the <span className="font-bold">Share</span> button ➔ tap <span className="font-bold text-slate-800">"Add to Home Screen"</span>.<br />
                      • <span className="font-bold text-slate-800">Android / Chrome</span>: Tap (⋮) ➔ tap <span className="font-bold text-slate-800">"Install App"</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Staff Mobile Portal & QR Code */}
          {activeTab === 'staff' && (() => {
            const staffUrl = getDedicatedEmployeePortalUrl();
            const staffQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(staffUrl)}`;

            return (
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-md space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white rounded-2xl border border-white/30 shadow-md">
                        <EzeeErpLogo size="sm" variant="compact" />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-white flex items-center gap-2">
                          <span>Dedicated Staff Mobile Portal</span>
                          <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase font-mono font-bold">PWA</span>
                        </h3>
                        <p className="text-xs text-blue-200">
                          Powered by Ezee ERP • Self-service attendance clock-in/out, leave applications & task assignments.
                        </p>
                      </div>
                    </div>

                    <a
                      href={staffUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open Staff Preview</span>
                    </a>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR Code */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center shrink-0">
                      <img
                        src={staffQrUrl}
                        alt="Employee Portal QR Code"
                        className="h-40 w-40 rounded-xl object-contain mx-auto shadow-2xs"
                        loading="lazy"
                      />
                      <div className="text-[11px] font-bold text-slate-700 mt-2 flex items-center justify-center gap-1">
                        <QrCode className="h-3.5 w-3.5 text-blue-600" />
                        <span>Staff Phone Scan QR</span>
                      </div>
                    </div>

                    {/* Instructions & Link */}
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">How Staff Use This Portal</h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Employees can scan this QR code with their mobile phone cameras or tap the link to open their personal portal. They can add it to their phone home screen as a native mobile app.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Dedicated Staff Portal Link
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={staffUrl}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-700 select-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy('staff_portal', staffUrl)}
                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            {copiedKey === 'staff_portal' ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Security highlight */}
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>100% Isolated From Financial Books</span>
                        </div>
                        <p className="text-slate-600">
                          Employees only see their own attendance, leave balances, and assigned tasks. POS billing, inventory, ledgers, and profits are strictly hidden and inaccessible.
                        </p>
                      </div>

                      {/* Staff Clock-In Network Enforcement Setting */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Wifi className="h-3.5 w-3.5 text-blue-600" />
                              Staff Clock-In WiFi Restriction
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              staffNetworkConfig.requireOfficeNetwork 
                                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {staffNetworkConfig.requireOfficeNetwork ? 'Office WiFi Enforced' : 'Home & Remote WiFi Allowed'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {staffNetworkConfig.requireOfficeNetwork 
                              ? 'Staff must be connected to the official office WiFi router to clock in.'
                              : 'Staff can clock in freely from their home WiFi, mobile data, or outside premises.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                          <span className="text-[11px] font-bold text-slate-600">
                            {staffNetworkConfig.requireOfficeNetwork ? 'Enforce Office' : 'Allow Home'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated: OfficeNetworkSecurityConfig = {
                                ...staffNetworkConfig,
                                requireOfficeNetwork: !staffNetworkConfig.requireOfficeNetwork
                              };
                              setStaffNetworkConfig(updated);
                              saveOfficeNetworkConfig(updated, currentCompanyId);
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              staffNetworkConfig.requireOfficeNetwork ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                staffNetworkConfig.requireOfficeNetwork ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>Multi-device retail suite ready for instant deployment.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>

      {/* Terminal Create / Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {editingTerminalId ? 'Edit Terminal' : 'Add New Terminal'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure terminal name, identifier, role & branch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveTerminal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Terminal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Panglung Main Counter, Counter 1, Grocery Desk"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-900 outline-none focus:border-indigo-600"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Code / ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. C1, PL-01, ACC"
                    value={formData.code || ''}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used in offline bill numbering</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Default Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role || 'Cashier'}
                    onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-indigo-600"
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Sales">Sales Executive</option>
                    <option value="Manager">Manager / Owner</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Landing Screen
                  </label>
                  <select
                    value={formData.defaultView || 'pos'}
                    onChange={e => setFormData({ ...formData, defaultView: e.target.value as any })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-indigo-600"
                  >
                    <option value="pos">POS Fast Billing</option>
                    <option value="normalsale">Standard Sales</option>
                    <option value="vouchers">Voucher Entry</option>
                    <option value="reports">Reports & Analytics</option>
                    <option value="dashboard">Owner Dashboard</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Branch Assignment
                  </label>
                  <select
                    value={formData.branchId || ''}
                    onChange={e => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-indigo-600"
                  >
                    <option value="">Global / All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Description / Location Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Ground floor billing terminal next to main entrance"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 text-slate-800 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-800 text-xs">Active (Available for client links & billing)</span>
                </label>
              </div>

              {/* Sample Dedicated URL Preview */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Generated Query URL:</span>
                <span className="text-xs font-mono font-bold text-indigo-700 break-all block">
                  ?counter={formData.code || 'C1'}&role={formData.role || 'Cashier'}&view={formData.defaultView || 'pos'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingTerminalId ? 'Update Terminal' : 'Create Terminal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminal Plan Limit Restriction Modal */}
      {showRestrictedNotice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs">
              <Lock className="h-6 w-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Terminal Restricted to 1 Only
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Your organization's current subscription plan is restricted to <strong>1 active terminal only</strong> ({terminals[0]?.name || 'Counter 1'}).
              </p>
              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-normal leading-relaxed text-left">
                To connect additional cash counters, accountant terminals, or mobile client links, please contact your <strong>Superadmin</strong> to upgrade your subscription plan quota.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRestrictedNotice(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                OK, Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
