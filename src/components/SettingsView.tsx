import React, { useState, useRef, useEffect } from 'react';
import { Config, Ledger, AppUser, ModuleId, UserPermission } from '../types';
import { saveConfig, getUsers, saveUsers, setActiveUser, getActiveUser, loadJson, saveJson, STORAGE_KEYS } from '../services/storageService';
import { POSSettings, loadPOSSettings, savePOSSettings, DEFAULT_POS_SETTINGS } from '../types/posSettings';
import { playSaveSound } from '../utils/audio';
import { VoucherTypeManager } from './vouchers/VoucherTypeManager';
import { 
  Save, CheckCircle2, Shield, FileText, Image as ImageIcon, PenTool, Plus, Lock, UserCheck, RefreshCw, 
  ShoppingCart, Zap, SlidersHorizontal, AlertTriangle, Keyboard, Percent, CreditCard, RotateCcw,
  Building2, Hash, Layers, Store, Check, Sparkles, Sliders, ShieldCheck, Trash2
} from 'lucide-react';

interface SettingsViewProps {
  config: Config;
  ledgers: Ledger[];
  onDataRefresh: () => void;
}

const MODULE_LABELS: Record<ModuleId, string> = {
  pos: 'POS Billing',
  purchase: 'Purchase Entry',
  vouchers: 'Accounting Vouchers',
  masters: 'Masters Directory',
  barcode: 'Barcode Printing',
  payroll: 'Payroll & HR',
  reports: 'Reports & Intelligence',
  settings: 'Settings & Security'
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  ledgers,
  onDataRefresh
}) => {
  const [form, setForm] = useState<Config>({ ...config });
  const [counters, setCounters] = useState<Record<string, number>>(() => loadJson(STORAGE_KEYS.COUNTERS, {}));
  
  const handleCounterChange = (key: string, value: number) => {
    const nextVal = Math.max(0, value - 1);
    const updated = { ...counters, [key]: nextVal };
    setCounters(updated);
    saveJson(STORAGE_KEYS.COUNTERS, updated);
  };
  const [posSettings, setPosSettings] = useState<POSSettings>(loadPOSSettings());
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [justSavedSection, setJustSavedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'company' | 'features' | 'vouchers' | 'invoice' | 'security' | 'pos'>('company');

  // Security Users State
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [activeUser, setSystemActiveUser] = useState<AppUser>(getActiveUser());

  // Signature Pad Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newTermInput, setNewTermInput] = useState('');

  const tabs = [
    { id: 'company', label: 'Company Profile', icon: Building2, desc: 'Identity & Tax' },
    { id: 'features', label: 'General Settings', icon: Sliders, desc: 'System Modules' },
    { id: 'vouchers', label: 'Voucher Numbers', icon: Hash, desc: 'Prefixes & Modes' },
    { id: 'invoice', label: 'Invoice & Branding', icon: PenTool, desc: 'Logo & Signature' },
    { id: 'security', label: 'User Roles', icon: ShieldCheck, desc: 'Permissions' },
    { id: 'pos', label: 'POS Settings', icon: ShoppingCart, desc: 'Billing & Keys' }
  ] as const;

  const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keyboard navigation for Settings tabs (ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End, Alt+Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // If user is in a regular text field, only allow Alt + Arrow keys to switch tabs
      if (isInputFocused && !e.altKey) {
        return;
      }

      const currentIndex = tabs.findIndex(t => t.id === activeTab);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabButtonRefs.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabButtonRefs.current[prevIndex]?.focus();
      } else if (e.key === 'Home' && !isInputFocused) {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabButtonRefs.current[0]?.focus();
      } else if (e.key === 'End' && !isInputFocused) {
        e.preventDefault();
        setActiveTab(tabs[tabs.length - 1].id);
        tabButtonRefs.current[tabs.length - 1]?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  useEffect(() => {
    const loaded = getUsers();
    setUsersList(loaded);
    if (loaded.length > 0) setSelectedUser(loaded[0]);
  }, []);

  useEffect(() => {
    setPosSettings(loadPOSSettings());
  }, [activeTab]);

  const handleSaveConfig = (sectionKey: string, _label = 'Settings') => {
    setSavingSection(sectionKey);
    try {
      saveConfig(form);
      onDataRefresh();
      playSaveSound();
      setSavingSection(null);
      setJustSavedSection(sectionKey);
      setTimeout(() => {
        setJustSavedSection(prev => (prev === sectionKey ? null : prev));
      }, 2500);
    } catch {
      setSavingSection(null);
    }
  };

  const handleSavePOSSettings = (newSettings?: POSSettings) => {
    setSavingSection('pos');
    const toSave = newSettings || posSettings;
    savePOSSettings(toSave);
    setPosSettings(toSave);
    onDataRefresh();
    playSaveSound();
    setSavingSection(null);
    setJustSavedSection('pos');
    setTimeout(() => {
      setJustSavedSection(prev => (prev === 'pos' ? null : prev));
    }, 2500);
  };

  const handleResetPOSSettings = () => {
    if (confirm('Reset all POS preferences to factory defaults?')) {
      handleSavePOSSettings(DEFAULT_POS_SETTINGS);
    }
  };

  const handleSaveUsers = (updatedUsers: AppUser[]) => {
    setSavingSection('security');
    saveUsers(updatedUsers);
    setUsersList(updatedUsers);
    onDataRefresh();
    playSaveSound();
    setSavingSection(null);
    setJustSavedSection('security');
    setTimeout(() => {
      setJustSavedSection(prev => (prev === 'security' ? null : prev));
    }, 2500);
  };

  const renderSaveButton = (
    sectionKey: string,
    label: string,
    fullWidth = true,
    size: 'sm' | 'lg' = 'lg'
  ) => {
    const isSaving = savingSection === sectionKey;
    const isSaved = justSavedSection === sectionKey;

    const handleAction = () => {
      if (sectionKey === 'pos') {
        handleSavePOSSettings();
      } else if (sectionKey === 'security') {
        handleSaveUsers(usersList);
      } else {
        handleSaveConfig(sectionKey, label);
      }
    };

    return (
      <button
        type="button"
        onClick={handleAction}
        disabled={isSaving}
        className={`relative overflow-hidden font-bold cursor-pointer flex items-center justify-center gap-2 select-none transition-all duration-200 active:scale-[0.99] ${
          fullWidth ? 'w-full' : 'shrink-0'
        } ${
          size === 'lg'
            ? 'py-3.5 px-6 rounded-xl text-sm shadow-xs'
            : 'py-2 px-4 rounded-xl text-xs'
        } ${
          isSaved
            ? 'bg-emerald-600 text-white shadow-sm'
            : isSaving
            ? 'bg-orange-700/90 text-white opacity-85 cursor-wait'
            : 'bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 shadow-xs'
        }`}
      >
        {isSaving ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin text-orange-100" />
            <span>Saving...</span>
          </>
        ) : isSaved ? (
          <>
            <Check className="h-4 w-4 text-white stroke-[3]" />
            <span className="font-extrabold">Saved Successfully</span>
          </>
        ) : (
          <>
            <Save className="h-4 w-4 text-orange-100" />
            <span>Save {label}</span>
          </>
        )}
      </button>
    );
  };

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvasToImage();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setForm({ ...form, ReceiptSignatureImage: '' });
  };

  const saveCanvasToImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setForm({ ...form, ReceiptSignatureImage: dataUrl });
  };

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, ReceiptHeaderImage: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, ReceiptSignatureImage: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  // Security Matrix Helpers
  const togglePermission = (userId: string, module: ModuleId, field: keyof UserPermission) => {
    const updated = usersList.map(u => {
      if (u.id !== userId) return u;
      const permMap = u.permissions || [];
      let found = false;
      const newPerms = permMap.map(p => {
        if (p.module === module) {
          found = true;
          return { ...p, [field]: !p[field] };
        }
        return p;
      });
      if (!found) {
        newPerms.push({
          module,
          display: field === 'display',
          create: field === 'create',
          edit: field === 'edit',
          delete: field === 'delete',
          print: field === 'print'
        });
      }
      return { ...u, permissions: newPerms };
    });
    handleSaveUsers(updated);
    if (selectedUser?.id === userId) {
      const u = updated.find(x => x.id === userId);
      if (u) setSelectedUser(u);
    }
  };

  const addNewUser = () => {
    const name = prompt('Enter Full Name for the new user:') || 'New Staff';
    const newUser: AppUser = {
      id: `user_${Date.now()}`,
      username: name.toLowerCase().replace(/\s+/g, ''),
      fullName: name,
      role: 'Cashier',
      pinCode: '0000',
      status: 'Active',
      permissions: Object.keys(MODULE_LABELS).map(m => ({
        module: m as ModuleId,
        display: true,
        create: true,
        edit: false,
        delete: false,
        print: true
      }))
    };
    const updated = [...usersList, newUser];
    handleSaveUsers(updated);
    setSelectedUser(newUser);
  };

  return (
    <div className="space-y-4 max-w-6xl w-full mx-auto pb-10">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">
            <Store className="h-3.5 w-3.5" />
            <span>Admin Control Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">System Settings & Configuration</h1>
          <p className="text-xs text-slate-500 font-medium">Manage company master details, voucher prefixes, print templates, and security rules (Use ← → Arrow keys to switch tabs)</p>
        </div>

        {/* Current Active User Switcher Pill */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xs">
            <UserCheck className="h-4 w-4 text-blue-600" />
            <div className="text-xs">
              <span className="text-slate-400 text-[11px]">Logged in as: </span>
              <span className="font-bold text-slate-900">{activeUser.fullName}</span>
              <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md">
                {activeUser.role}
              </span>
            </div>
            <button
              onClick={() => {
                const u = usersList.find(x => x.id !== activeUser.id) || usersList[0];
                setActiveUser(u.id);
                setSystemActiveUser(u);
                onDataRefresh();
              }}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
              title="Switch Active Operator"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Arranged in a High-Density Responsive Grid with Arrow Key Navigation */}
      <div 
        role="tablist"
        aria-label="Settings navigation tabs"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200"
      >
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={el => (tabButtonRefs.current[idx] = el)}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-2.5 rounded-xl transition flex flex-col items-center justify-center text-center gap-1 cursor-pointer select-none group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-4 w-4 shrink-0 transition ${isActive ? 'text-white' : 'text-blue-600 group-hover:scale-110'}`} />
                <span className={`text-xs font-black tracking-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>
                  {tab.label}
                </span>
              </div>
              <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Settings Body */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
        {/* TAB 1: Company Profile */}
        {activeTab === 'company' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span>Business Identity & Banking Setup</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  These details will appear on tax invoices, thermal slips, and official statements.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Store Name</label>
                <input
                  type="text"
                  value={form.CompanyName || ''}
                  onChange={e => setForm({ ...form, CompanyName: e.target.value })}
                  placeholder="e.g. Deep POS Superstore"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Store Address / Location</label>
                <input
                  type="text"
                  value={form.Address || ''}
                  onChange={e => setForm({ ...form, Address: e.target.value })}
                  placeholder="e.g. Main Street, City Centre"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company GSTIN</label>
                <input
                  type="text"
                  value={form.CompanyGSTNo || ''}
                  onChange={e => setForm({ ...form, CompanyGSTNo: e.target.value })}
                  placeholder="e.g. 18AABCU9603R1ZM"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">TPN Number</label>
                <input
                  type="text"
                  value={form.CompanyTPNNo || ''}
                  onChange={e => setForm({ ...form, CompanyTPNNo: e.target.value })}
                  placeholder="e.g. TPN-998822"
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={form.CurrencySymbol || 'Nu.'}
                  onChange={e => setForm({ ...form, CurrencySymbol: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Default GST Rate %</label>
                <input
                  type="text"
                  value={form.GSTRate || '5'}
                  onChange={e => setForm({ ...form, GSTRate: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Primary Bank Ledger (Bank 1)</label>
                <select
                  value={form.Bank1Ledger}
                  onChange={e => setForm({ ...form, Bank1Ledger: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
                >
                  {ledgers.map(l => (
                    <option key={l['Ledger Name']} value={l['Ledger Name']}>
                      {l['Ledger Name']} ({l['Parent Group'] || 'Bank'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Secondary Bank Ledger (Bank 2)</label>
                <select
                  value={form.Bank2Ledger}
                  onChange={e => setForm({ ...form, Bank2Ledger: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
                >
                  {ledgers.map(l => (
                    <option key={l['Ledger Name']} value={l['Ledger Name']}>
                      {l['Ledger Name']} ({l['Parent Group'] || 'Bank'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>A4 Invoice Bank Printing Settings</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Print Bank Details on A4 Invoice</label>
                  <select
                    value={form.PrintBankDetailsOnInvoice ?? 'true'}
                    onChange={e => setForm({ ...form, PrintBankDetailsOnInvoice: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
                  >
                    <option value="true">Yes - Print Bank Details on A4 Invoice</option>
                    <option value="false">No - Hide Bank Details on Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Bank Account Ledger for Print</label>
                  <select
                    value={form.SelectedBankLedgerForPrint || ''}
                    onChange={e => setForm({ ...form, SelectedBankLedgerForPrint: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
                  >
                    <option value="">-- Use Custom Bank Note Below --</option>
                    {ledgers.filter(l => l.Group === 'Bank Accounts' || (l.Group || '').toLowerCase().includes('bank') || l['Bank Name']).map(l => (
                      <option key={l['Ledger Name']} value={l['Ledger Name']}>
                        {l['Ledger Name']} {l['Bank Name'] ? `(${l['Bank Name']} - A/C: ${l['Account No'] || 'N/A'})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Custom Company Bank Details Note / Fallback Text</label>
                <textarea
                  rows={3}
                  value={form.CompanyBankDetails || ''}
                  onChange={e => setForm({ ...form, CompanyBankDetails: e.target.value })}
                  placeholder="Bank Name: Bank of Bhutan&#10;Account No: 1002938491&#10;Branch: Thimphu Main"
                  className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white"
                />
              </div>
            </div>
            
            {renderSaveButton('company', 'Company Profile', true, 'lg')}
          </div>
        )}

        {/* TAB 2: Features & Toggles */}
        {activeTab === 'features' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-600" />
                  <span>System Modules & Global Toggles</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Enable or disable specialized accounting, inventory, and point-of-sale modules across the system.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* GST / Taxation Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableGST === 'true'}
                    onChange={e => setForm({ ...form, EnableGST: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable GST (Taxation Module)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Calculates and tracks GST on purchases and sales. Requires GST No.</p>
                </div>
              </label>

              {/* Serial Numbers Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableSerials === 'true'}
                    onChange={e => setForm({ ...form, EnableSerials: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Serial Numbers (Inventory)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Track individual stock items by unique IMEI or Serial No.</p>
                </div>
              </label>

              {/* Item Categories */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableCategory === 'true'}
                    onChange={e => setForm({ ...form, EnableCategory: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Item Categories</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Group items into hierarchical categories for better reporting.</p>
                </div>
              </label>
              
              {/* Normal Sale Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnableNormalSale !== 'false'}
                    onChange={e => setForm({ ...form, EnableNormalSale: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable Normal Sale (B2B)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Traditional sales entry with Order No, Delivery Note, and custom Terms.</p>
                </div>
              </label>

              {/* POS Sale Module */}
              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    checked={form.EnablePOS !== 'false'}
                    onChange={e => setForm({ ...form, EnablePOS: e.target.checked ? 'true' : 'false' })}
                  />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 text-xs">Enable POS Billing (Retail)</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Fast point-of-sale interface for retail billing.</p>
                </div>
              </label>

              {/* Payroll Module */}


              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">

                <div className="pt-0.5">

                  <input

                    type="checkbox"

                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"

                    checked={form.EnablePayroll !== "false"}

                    onChange={e => setForm({ ...form, EnablePayroll: e.target.checked ? "true" : "false" })}

                  />

                </div>

                <div>

                  <span className="font-extrabold text-slate-900 text-xs">Enable Payroll & HR Module</span>

                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Process salaries, manage employees, and handle provident funds.</p>

                </div>

              </label>



              
              {/* Discount Modules */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 transition">
                <label className="flex items-start gap-3.5 cursor-pointer">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      checked={form.EnableItemDiscount === "true"}
                      onChange={e => setForm({ ...form, EnableItemDiscount: e.target.checked ? "true" : "false" })}
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs">Enable Item-wise Discount</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Allow discounts per individual item in invoices.</p>
                  </div>
                </label>
                {form.EnableItemDiscount === "true" && (
                  <div className="ml-7 flex items-center gap-3 bg-white p-2.5 border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="ItemDiscountType" value="flat" checked={form.ItemDiscountType !== "percent"} onChange={() => setForm({...form, ItemDiscountType: 'flat'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Flat Amount (#)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="ItemDiscountType" value="percent" checked={form.ItemDiscountType === "percent"} onChange={() => setForm({...form, ItemDiscountType: 'percent'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Percentage (%)</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 transition">
                <label className="flex items-start gap-3.5 cursor-pointer">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      checked={form.EnableBillDiscount === "true"}
                      onChange={e => setForm({ ...form, EnableBillDiscount: e.target.checked ? "true" : "false" })}
                    />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-900 text-xs">Enable Bill Lumpsum Discount</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Allow a single flat or percentage discount on the entire bill.</p>
                  </div>
                </label>
                {form.EnableBillDiscount === "true" && (
                  <div className="ml-7 flex items-center gap-3 bg-white p-2.5 border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-slate-700">Type:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="BillDiscountType" value="flat" checked={form.BillDiscountType !== "percent"} onChange={() => setForm({...form, BillDiscountType: 'flat'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Flat Amount (#)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="BillDiscountType" value="percent" checked={form.BillDiscountType === "percent"} onChange={() => setForm({...form, BillDiscountType: 'percent'})} className="text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs font-semibold text-slate-600">Percentage (%)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Asset Management Module */}

              <label className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-slate-100/70 transition">

                <div className="pt-0.5">

                  <input

                    type="checkbox"

                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"

                    checked={form.EnableAssetManagement !== "false"}

                    onChange={e => setForm({ ...form, EnableAssetManagement: e.target.checked ? "true" : "false" })}

                  />

                </div>

                <div>

                  <span className="font-extrabold text-slate-900 text-xs">Enable Asset Management</span>

                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Track fixed assets, depreciation, and calculate net book values.</p>

                </div>

              </label>

            </div>



            {form.EnablePayroll !== "false" && (

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">

                {/* Employee Advances & Loans */}

                <label className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:bg-indigo-50 transition">

                  <div className="pt-0.5">

                    <input

                      type="checkbox"

                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"

                      checked={form.EnableEmployeeAdvances !== "false"}

                      onChange={e => setForm({ ...form, EnableEmployeeAdvances: e.target.checked ? "true" : "false" })}

                    />

                  </div>

                  <div>

                    <span className="font-extrabold text-indigo-900 text-xs">Detailed Employee Advances (DSA/Imprest)</span>

                    <p className="text-[10px] text-indigo-700/70 mt-0.5 leading-snug">Enable deep tracking of DSA and Imprest by individual employee ID.</p>

                  </div>

                </label>

              </div>

            )}



            {renderSaveButton('features', 'System Toggles', true, 'lg')}
          </div>
        )}

        {/* TAB 3: Voucher Numbering */}
        {activeTab === 'vouchers' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-blue-600" />
                  <span>Voucher Numbering Mode & Prefixes</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure sequential automatic voucher generation or custom manual book numbering.
                </p>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <label className="block font-black text-slate-900 text-xs">Default Reference Numbering Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setForm({ ...form, VoucherNumberingMode: 'auto' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    (form.VoucherNumberingMode || 'auto') === 'auto'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="voucherMode"
                    checked={(form.VoucherNumberingMode || 'auto') === 'auto'}
                    onChange={() => setForm({ ...form, VoucherNumberingMode: 'auto' })}
                    className="mt-0.5 text-blue-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-900 block">Automatic Sequential Numbering</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Auto-increments next sequential reference with custom prefix (e.g. PMT-1, RCT-1, JRN-1). Can still be manually edited.
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setForm({ ...form, VoucherNumberingMode: 'manual' })}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    form.VoucherNumberingMode === 'manual'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="voucherMode"
                    checked={form.VoucherNumberingMode === 'manual'}
                    onChange={() => setForm({ ...form, VoucherNumberingMode: 'manual' })}
                    className="mt-0.5 text-blue-600 h-4 w-4"
                  />
                  <div>
                    <span className="font-extrabold text-slate-900 block">Manual Numbering Default</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Requires manual entry of cheque numbers, physical book voucher numbers, or custom supplier reference codes.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voucher Prefixes Customization */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Voucher Type Prefix Codes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Payment (PMT)</label>
                    <span className="text-[10px] font-mono bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PaymentVoucherPrefix || 'PMT-')}{(counters['PaymentVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.PaymentVoucherPrefix !== undefined ? form.PaymentVoucherPrefix : 'PMT-'}
                      onChange={e => setForm({ ...form, PaymentVoucherPrefix: e.target.value })}
                      placeholder="PMT-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['PaymentVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('PaymentVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Receipt (RCT)</label>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ReceiptVoucherPrefix || 'RCT-')}{(counters['ReceiptVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.ReceiptVoucherPrefix !== undefined ? form.ReceiptVoucherPrefix : 'RCT-'}
                      onChange={e => setForm({ ...form, ReceiptVoucherPrefix: e.target.value })}
                      placeholder="RCT-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['ReceiptVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('ReceiptVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Journal (JRN)</label>
                    <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.JournalVoucherPrefix || 'JRN-')}{(counters['JournalVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.JournalVoucherPrefix !== undefined ? form.JournalVoucherPrefix : 'JRN-'}
                      onChange={e => setForm({ ...form, JournalVoucherPrefix: e.target.value })}
                      placeholder="JRN-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['JournalVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('JournalVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Contra (CTR)</label>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.ContraVoucherPrefix || 'CTR-')}{(counters['ContraVoucher'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.ContraVoucherPrefix !== undefined ? form.ContraVoucherPrefix : 'CTR-'}
                      onChange={e => setForm({ ...form, ContraVoucherPrefix: e.target.value })}
                      placeholder="CTR-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['ContraVoucher'] || 0) + 1}
                      onChange={e => handleCounterChange('ContraVoucher', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Sales Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.SalesInvoicePrefix || 'SAL-')}{(counters['SalesInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.SalesInvoicePrefix !== undefined ? form.SalesInvoicePrefix : 'SAL-'}
                      onChange={e => setForm({ ...form, SalesInvoicePrefix: e.target.value })}
                      placeholder="SAL-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['SalesInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('SalesInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">POS Invoice</label>
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.POSInvoicePrefix || 'POS-')}{(counters['POSInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.POSInvoicePrefix !== undefined ? form.POSInvoicePrefix : 'POS-'}
                      onChange={e => setForm({ ...form, POSInvoicePrefix: e.target.value })}
                      placeholder="POS-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['POSInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('POSInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Purchase Inv</label>
                    <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-2 py-0.2 rounded-full font-bold">
                      {(form.PurchaseInvoicePrefix || 'PUR-')}{(counters['PurchaseInvoice'] || 0) + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      title="Prefix"
                      value={form.PurchaseInvoicePrefix !== undefined ? form.PurchaseInvoicePrefix : 'PUR-'}
                      onChange={e => setForm({ ...form, PurchaseInvoicePrefix: e.target.value })}
                      placeholder="PUR-"
                      className="w-2/3 h-8 rounded-lg border border-slate-300 px-2.5 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                    <input
                      type="number"
                      title="Next Number"
                      value={(counters['PurchaseInvoice'] || 0) + 1}
                      onChange={e => handleCounterChange('PurchaseInvoice', Number(e.target.value))}
                      className="w-1/3 h-8 rounded-lg border border-slate-300 px-2 font-mono font-bold text-slate-800 bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {renderSaveButton('vouchers', 'Voucher Numbering', true, 'lg')}

            {/* Custom Voucher Types Manager (ERP Master) */}
            <div className="pt-4 border-t border-slate-200">
              <VoucherTypeManager onUpdated={onDataRefresh} />
            </div>
          </div>
        )}

        {/* TAB 4: Invoice & Branding */}
        {activeTab === 'invoice' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PenTool className="h-4 w-4 text-blue-600" />
                  <span>Invoice Customization & Digital Signatures</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure print templates, header logos, interactive digital signature pad, and footer terms.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Invoice Layout Template</label>
                <select
                  value={form.InvoiceTemplate || 'standard'}
                  onChange={e => setForm({ ...form, InvoiceTemplate: e.target.value as any })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-blue-600"
                >
                  <option value="standard">Standard Clean (Tax Invoice)</option>
                  <option value="modern">Modern Minimalist Accent</option>
                  <option value="classic">Classic Boxed Grid</option>
                  <option value="letterhead">Full Banner Letterhead</option>
                  <option value="compact">Compact Thermal Layout</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Default Print Paper Size</label>
                <select
                  value={form.PaperSize || '80mm'}
                  onChange={e => setForm({ ...form, PaperSize: e.target.value as any })}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 font-semibold text-slate-800 outline-none bg-white focus:border-blue-600"
                >
                  <option value="80mm">80mm Thermal Receipt (POS standard)</option>
                  <option value="58mm">58mm Mini Thermal Receipt</option>
                  <option value="A4">A4 Full Sheet (Tax Invoice)</option>
                  <option value="A5">A5 Half Sheet</option>
                </select>
              </div>
            </div>

            {/* Header Image Upload */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  <span>Invoice Header Logo / Letterhead Banner</span>
                </label>
                {form.ReceiptHeaderImage && (
                  <button
                    onClick={() => setForm({ ...form, ReceiptHeaderImage: '' })}
                    className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
              </div>

              {form.ReceiptHeaderImage ? (
                <div className="p-3 border border-slate-200 bg-white rounded-xl flex items-center justify-center">
                  <img src={form.ReceiptHeaderImage} alt="Header Logo" className="max-h-20 object-contain" />
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Upload your store logo or letterhead banner to print on top of sales receipts and payslips.</p>
              )}

              <div className="flex items-center gap-2">
                <label className="px-3.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-100 cursor-pointer transition">
                  <span>Upload Image File</span>
                  <input type="file" accept="image/*" onChange={handleHeaderImageUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  placeholder="Or enter Image URL (https://...)"
                  value={form.ReceiptHeaderImage || ''}
                  onChange={e => setForm({ ...form, ReceiptHeaderImage: e.target.value })}
                  className="flex-1 h-9 rounded-xl border border-slate-300 px-3 outline-none text-xs bg-white focus:border-blue-600"
                />
              </div>
            </div>

            {/* Digital Signature Drawing Canvas & Image Upload */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <label className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                    <PenTool className="h-4 w-4 text-blue-600" />
                    <span>Digital Signature for Receipt & Invoice Footer</span>
                  </label>
                  <p className="text-[11px] text-slate-500">Draw signature directly on screen/mouse or upload PNG image</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="px-3 py-1 rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Clear Drawing
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <div className="text-[11px] font-bold text-slate-700 mb-1">Draw with mouse / touchscreen:</div>
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={110}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-crosshair touch-none w-full max-w-[320px] h-[110px]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-700">Signature Preview / File Upload:</div>
                  {form.ReceiptSignatureImage ? (
                    <div className="p-2 border border-slate-200 bg-white rounded-xl flex items-center justify-center h-[75px]">
                      <img src={form.ReceiptSignatureImage} alt="Signature Preview" className="max-h-16 object-contain" />
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-white rounded-xl flex items-center justify-center h-[75px] text-slate-400 italic text-xs">
                      No Signature Saved
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 rounded-xl bg-slate-200 border border-slate-300 text-slate-800 font-bold hover:bg-slate-300 cursor-pointer text-xs transition">
                      <span>Upload PNG File</span>
                      <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Signatory Title</label>
                  <input
                    type="text"
                    value={form.SignatoryTitle || 'Authorized Signatory'}
                    onChange={e => setForm({ ...form, SignatoryTitle: e.target.value })}
                    className="w-full h-9 rounded-xl border border-slate-300 px-3 outline-none font-bold bg-white focus:border-blue-600"
                    placeholder="e.g. Authorized Signatory / Store Manager"
                  />
                </div>

              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Predefined Terms & Conditions (A4 Sale Invoice)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Configure two predefined Terms & Conditions: Term 1 prints automatically, while Term 2 can be toggled/selected on the print screen.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Term 1: Primary Terms (Auto-Printed)</span>
                      <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Automatic</span>
                    </label>
                    <textarea
                      rows={3}
                      value={form.FooterTerms || ''}
                      onChange={e => setForm({ ...form, FooterTerms: e.target.value })}
                      placeholder="e.g. 1. Goods once sold are non-refundable after 7 days."
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs bg-white outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Term 2: Secondary Terms (User Selects on Print)</span>
                      <span className="text-[10px] text-blue-600 font-extrabold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Selectable</span>
                    </label>
                    <textarea
                      rows={3}
                      value={form.SecondaryTerms || ''}
                      onChange={e => setForm({ ...form, SecondaryTerms: e.target.value })}
                      placeholder="e.g. 2. Warranty claims require original receipt and intact seal."
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-xs bg-white outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
              </div>

              {/* Predefined Terms & Conditions Templates */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>Predefined Terms & Conditions Presets</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Create quick-insert term templates for POS billing and Quotation/Estimate creation.
                    </p>
                  </div>
                </div>

                {/* Add new term preset input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 1. 100% advance payment required. 2. Delivery within 7 working days."
                    value={newTermInput}
                    onChange={e => setNewTermInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTermInput.trim()) {
                        e.preventDefault();
                        const currentList = Array.isArray(form.PredefinedTermsList) ? form.PredefinedTermsList : [];
                        setForm({
                          ...form,
                          PredefinedTermsList: [...currentList, newTermInput.trim()]
                        });
                        setNewTermInput('');
                      }
                    }}
                    className="flex-1 h-9 rounded-xl border border-slate-300 px-3 text-xs bg-white outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTermInput.trim()) {
                        const currentList = Array.isArray(form.PredefinedTermsList) ? form.PredefinedTermsList : [];
                        setForm({
                          ...form,
                          PredefinedTermsList: [...currentList, newTermInput.trim()]
                        });
                        setNewTermInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Preset</span>
                  </button>
                </div>

                {/* List of current presets */}
                <div className="space-y-1.5">
                  {(!form.PredefinedTermsList || form.PredefinedTermsList.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic py-1">No predefined presets saved yet. Add common terms above for fast insertion.</p>
                  ) : (
                    form.PredefinedTermsList.map((term: any, idx: number) => {
                      const text = typeof term === 'string' ? term : (term.terms || term.title || '');
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs">
                          <span className="font-medium text-slate-800 flex-1 truncate" title={text}>
                            <span className="font-bold text-slate-400 mr-2">#{idx + 1}</span>
                            {text}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (form.PredefinedTermsList || []).filter((_: any, i: number) => i !== idx);
                              setForm({ ...form, PredefinedTermsList: updated });
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Remove preset"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {renderSaveButton('invoice', 'Invoice & Branding', true, 'lg')}
          </div>
        )}

        {/* TAB 5: User Roles & Security */}
        {activeTab === 'security' && (
          <div className="space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>User Accounts & Role Permissions Matrix</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Control granular access rights (Display, Create, Edit, Delete, Print) across all software modules.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={addNewUser}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add User Account</span>
                </button>
              </div>
            </div>

            {/* User Selection Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {usersList.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`px-3.5 py-2 rounded-xl border font-bold text-xs transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    selectedUser?.id === u.id
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 text-blue-600" />
                  <span>{u.fullName}</span>
                  <span className="text-[10px] bg-blue-200/80 text-blue-900 px-1.5 py-0.2 rounded-md font-mono">{u.role}</span>
                </button>
              ))}
            </div>

            {selectedUser && (
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">User Full Name</label>
                    <input
                      type="text"
                      value={selectedUser.fullName}
                      onChange={e => {
                        const updated = usersList.map(x => x.id === selectedUser.id ? { ...x, fullName: e.target.value } : x);
                        handleSaveUsers(updated);
                        setSelectedUser({ ...selectedUser, fullName: e.target.value });
                      }}
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 bg-white outline-none font-semibold focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assigned Role</label>
                    <select
                      value={selectedUser.role}
                      onChange={e => {
                        const r = e.target.value as any;
                        const updated = usersList.map(x => x.id === selectedUser.id ? { ...x, role: r } : x);
                        handleSaveUsers(updated);
                        setSelectedUser({ ...selectedUser, role: r });
                      }}
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 bg-white outline-none font-semibold focus:border-blue-600"
                    >
                      <option value="Administrator">Administrator (Full Access)</option>
                      <option value="Manager">Manager</option>
                      <option value="Cashier">Cashier</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Custom">Custom User</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Security PIN Code</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={selectedUser.pinCode || '0000'}
                      onChange={e => {
                        const updated = usersList.map(x => x.id === selectedUser.id ? { ...x, pinCode: e.target.value } : x);
                        handleSaveUsers(updated);
                        setSelectedUser({ ...selectedUser, pinCode: e.target.value });
                      }}
                      className="w-full h-9 rounded-xl border border-slate-300 px-3 bg-white outline-none font-mono font-bold focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Granular Permission Ticks Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] font-extrabold uppercase">
                        <th className="py-2.5 px-3">Module Name</th>
                        <th className="py-2.5 px-2 text-center">Display / View</th>
                        <th className="py-2.5 px-2 text-center">Create</th>
                        <th className="py-2.5 px-2 text-center">Edit / Alter</th>
                        <th className="py-2.5 px-2 text-center">Delete</th>
                        <th className="py-2.5 px-2 text-center">Print / Export</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {(Object.keys(MODULE_LABELS) as ModuleId[]).map(modId => {
                        const perm = selectedUser.permissions?.find(p => p.module === modId) || {
                          module: modId,
                          display: selectedUser.role === 'Administrator',
                          create: selectedUser.role === 'Administrator',
                          edit: selectedUser.role === 'Administrator',
                          delete: selectedUser.role === 'Administrator',
                          print: selectedUser.role === 'Administrator'
                        };

                        return (
                          <tr key={modId} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {MODULE_LABELS[modId]}
                            </td>
                            {(['display', 'create', 'edit', 'delete', 'print'] as Array<keyof UserPermission>).map(field => {
                              if (field === 'module') return null;
                              const isChecked = Boolean(perm[field]);
                              return (
                                <td key={field} className="py-2.5 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermission(selectedUser.id, modId, field)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer focus:ring-blue-500"
                                  />
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
            )}

            {renderSaveButton('security', 'User Security Permissions', true, 'lg')}
          </div>
        )}

        {/* TAB 6: POS Settings & Shortcuts */}
        {activeTab === 'pos' && (
          <div className="space-y-5 text-xs">
            {/* Header / Save Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span>Point of Sale (POS) Preferences & Shortcuts</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure high-speed barcode modes, tender presets, item/bill discounts, and review keyboard shortcuts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPOSSettings}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>

            {/* Workflow & Operational Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Add Mode Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Barcode & Item Addition Workflow</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...posSettings, itemAddMode: 'direct' as const };
                      setPosSettings(updated);
                      handleSavePOSSettings(updated);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      posSettings.itemAddMode === 'direct'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Direct Quick-Add</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Instantly adds item with Qty=1 upon barcode scan and maintains cursor in search.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...posSettings, itemAddMode: 'prompt' as const };
                      setPosSettings(updated);
                      handleSavePOSSettings(updated);
                    }}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      posSettings.itemAddMode === 'prompt'
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                      <span>Prompt Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Focus moves through Qty → Rate → Disc → Enter to confirm line item.
                    </p>
                  </button>
                </div>
              </div>

              {/* Discount Controls Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <Percent className="h-4 w-4 text-blue-600" />
                  <span>Discount & Cart Controls</span>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.enableItemDiscount !== false}
                      onChange={e => {
                        const updated = {
                          ...posSettings,
                          enableItemDiscount: e.target.checked,
                          
                        };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Enable POS Item-wise Discount</span>
                      <p className="text-[11px] text-slate-500">
                        Shows per-item discount entry in top search and Disc column in the cart.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.enableBillDiscount !== false}
                      onChange={e => {
                        const updated = {
                          ...posSettings,
                          enableBillDiscount: e.target.checked,
                          
                        };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Enable POS Lumpsum / Bill Discount</span>
                      <p className="text-[11px] text-slate-500">
                        Shows bill-level discount tool (Flat / %) in the checkout summary.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.autoIncrementQty}
                      onChange={e => {
                        const updated = { ...posSettings, autoIncrementQty: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Auto-Increment Quantity on Repeated Scan</span>
                      <p className="text-[11px] text-slate-500">
                        Repeatedly scanning the same item increments its quantity by 1.
                      </p>                    </div>                  </label>                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.enableItemDescription !== false}
                      onChange={e => {
                        const updated = {
                          ...posSettings,
                          enableItemDescription: e.target.checked
                        };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Enable POS Item Description</span>
                      <p className="text-[11px] text-slate-500">
                        Shows per-item description entry in the cart for custom line-item notes.
                      </p>
                    </div>
                  </label>
                </div>              </div>              {/* Tender & Audio Controls */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>Checkout & Audio Feedback</span>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.showQuickCashButtons}
                      onChange={e => {
                        const updated = { ...posSettings, showQuickCashButtons: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Show Quick Cash Tender Presets</span>
                      <p className="text-[11px] text-slate-500">
                        Displays fast cash buttons (Exact, +50, +100, +500, +1000) for instant tender.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.enableSoundFeedback}
                      onChange={e => {
                        const updated = { ...posSettings, enableSoundFeedback: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Audio Sound Effects & Scan Beeps</span>
                      <p className="text-[11px] text-slate-500">
                        Plays high-frequency beep on successful barcode scan, item add, and invoice save.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.autoPrintReceipt}
                      onChange={e => {
                        const updated = { ...posSettings, autoPrintReceipt: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Auto Open Print Receipt on Settlement</span>
                      <p className="text-[11px] text-slate-500">
                        Immediately opens the thermal/A4 receipt print popup when invoice is finalized.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Stock Warning & Search Focus */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Inventory Guard & Focus Behavior</span>
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.warnLowStock}
                      onChange={e => {
                        const updated = { ...posSettings, warnLowStock: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Zero Stock Warning Badge</span>
                      <p className="text-[11px] text-slate-500">
                        Displays red alert badge on items in cart that have 0 or negative current stock.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={posSettings.alwaysFocusSearch}
                      onChange={e => {
                        const updated = { ...posSettings, alwaysFocusSearch: e.target.checked };
                        setPosSettings(updated);
                        handleSavePOSSettings(updated);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-slate-800">Keep Barcode / Search Input Focused</span>
                      <p className="text-[11px] text-slate-500">
                        Automatically refocuses the barcode search bar after completing operations for fast continuous billing.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Reference Guide */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Keyboard className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Comprehensive POS Keyboard Shortcuts Guide</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search & Entry */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">Item Entry & Scanning</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Focus Barcode / Search</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">F3 or /</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Navigate Dropdown</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">↑ / ↓</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Select & Add Item</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">Enter</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Dismiss Dropdown</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">Esc</kbd>
                    </div>
                  </div>
                </div>

                {/* Cart & Customer */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">Cart & Customer</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Focus Customer Select</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">F4</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Focus First Cart Row</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">Alt + C</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Qty +/- in Table</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">+ or -</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Remove Row in Table</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">Delete</kbd>
                    </div>
                  </div>
                </div>

                {/* Bill Operations */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="font-bold text-blue-900 text-[11px] uppercase tracking-wider">Hold & Settlement</div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Save & Settle Invoice</span>
                      <kbd className="bg-emerald-600 text-white rounded px-1.5 py-0.5 font-mono font-bold">F2</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Hold Current Bill</span>
                      <kbd className="bg-amber-500 text-white rounded px-1.5 py-0.5 font-mono font-bold">F8</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Resume Last Held Bill</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">F9</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Clear Active Cart</span>
                      <kbd className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono font-bold text-slate-800">F10</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {renderSaveButton('pos', 'POS Preferences', true, 'lg')}
          </div>
        )}
      </div>
    </div>
  );
};
