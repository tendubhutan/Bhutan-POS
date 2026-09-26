import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Check,
  Building,
  HelpCircle,
  FolderCheck,
  FileText,
  Cpu,
  ArrowDownToLine
} from 'lucide-react';
import {
  AutoBackupConfig,
  getAutoBackupConfig,
  saveAutoBackupConfig,
  pickBackupDirectory,
  executeManualBackup,
  triggerAutoBackupNow,
  isFileSystemAccessSupported,
  validateBackupFileContent,
  executeRestoreFromBackup,
  BackupPayload,
  BackupValidationResult,
  clearStoredDirectoryHandle
} from '../services/backupService';
import { Config, Ledger, Item, Voucher, SalesInvoice } from '../types';
import { getLedgers, getVouchers, loadJson, STORAGE_KEYS } from '../services/storageService';
import { TallyBusyMigrationView } from './TallyBusyMigrationView';

interface BackupManagerViewProps {
  config: Config;
  onDataRefresh?: () => void;
  defaultTab?: 'backup_restore' | 'migration';
}

export const BackupManagerView: React.FC<BackupManagerViewProps> = ({
  config,
  onDataRefresh,
  defaultTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'backup_restore' | 'migration'>(defaultTab || 'backup_restore');

  useEffect(() => {
    if (defaultTab) {
      setActiveSubTab(defaultTab);
    }
  }, [defaultTab]);

  const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [backupErrorMsg, setBackupErrorMsg] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<'active_company' | 'all_companies'>('active_company');
  
  // Folder picker state
  const [isPickingFolder, setIsPickingFolder] = useState<boolean>(false);
  const isDirPickerSupported = isFileSystemAccessSupported();

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [parsedPayload, setParsedPayload] = useState<BackupPayload | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreMsg, setRestoreMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [showConfirmRestoreModal, setShowConfirmRestoreModal] = useState<boolean>(false);
  const [restoreMode, setRestoreMode] = useState<'overwrite_active' | 'create_new_workspace'>('overwrite_active');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live data metrics
  const [metrics, setMetrics] = useState({
    ledgersCount: 0,
    itemsCount: 0,
    vouchersCount: 0,
    salesCount: 0
  });

  useEffect(() => {
    setMetrics({
      ledgersCount: getLedgers().length,
      itemsCount: loadJson<Item[]>(STORAGE_KEYS.ITEMS, []).length,
      vouchersCount: getVouchers().length,
      salesCount: loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []).length
    });
  }, []);

  // Listen to background auto-backup completed events
  useEffect(() => {
    const handleAutoBackupEvent = (e: any) => {
      setAutoConfig(getAutoBackupConfig());
      if (e.detail?.filename) {
        setBackupSuccessMsg(`Auto-backup completed: ${e.detail.filename} (${e.detail.sizeKB} KB)`);
        setTimeout(() => setBackupSuccessMsg(null), 6000);
      }
    };
    window.addEventListener('deep_pos_auto_backup_completed', handleAutoBackupEvent);
    return () => window.removeEventListener('deep_pos_auto_backup_completed', handleAutoBackupEvent);
  }, []);

  const handleUpdateConfig = (updates: Partial<AutoBackupConfig>) => {
    const updated = saveAutoBackupConfig(updates);
    setAutoConfig(updated);
  };

  const handleSelectFolder = async () => {
    setIsPickingFolder(true);
    setBackupErrorMsg(null);
    try {
      const res = await pickBackupDirectory();
      if (res.success) {
        setAutoConfig(getAutoBackupConfig());
        setBackupSuccessMsg(`Target backup folder set to: "${res.folderName}"`);
        setTimeout(() => setBackupSuccessMsg(null), 4500);
      } else if (res.error && res.error !== 'Folder selection was cancelled') {
        setBackupErrorMsg(res.error);
      }
    } catch (err: any) {
      setBackupErrorMsg(err.message || 'Failed to select directory');
    } finally {
      setIsPickingFolder(false);
    }
  };

  const handleClearFolder = async () => {
    await clearStoredDirectoryHandle();
    handleUpdateConfig({ useFolderPicker: false, folderName: '' });
  };

  const handleRunManualBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    setBackupErrorMsg(null);
    try {
      const res = await executeManualBackup(selectedScope);
      if (res.success) {
        setAutoConfig(getAutoBackupConfig());
        setBackupSuccessMsg(`Backup created successfully! Saved as ${res.filename} (${res.sizeKB} KB) via ${res.method === 'folder' ? 'Selected Folder' : 'Browser Download'}.`);
      } else {
        setBackupErrorMsg(res.error || 'Manual backup failed');
      }
    } catch (err: any) {
      setBackupErrorMsg(err.message || 'Backup encountered an unexpected error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRunAutoBackupTest = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg(null);
    setBackupErrorMsg(null);
    try {
      const res = await triggerAutoBackupNow();
      if (res.success) {
        setAutoConfig(getAutoBackupConfig());
        setBackupSuccessMsg(`Auto-Backup test succeeded! File saved: ${res.filename} (${res.sizeKB} KB) in ${res.targetPath}.`);
      } else {
        setBackupErrorMsg(res.error || 'Auto-backup test failed');
      }
    } catch (err: any) {
      setBackupErrorMsg(err.message || 'Auto-backup test error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreMsg(null);
    setValidationResult(null);
    setParsedPayload(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { result, payload } = validateBackupFileContent(text);
      setValidationResult(result);
      if (result.valid && payload) {
        setParsedPayload(payload);
      }
    };
    reader.onerror = () => {
      setValidationResult({ valid: false, error: 'Could not read selected file from computer' });
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedPayload) return;
    setIsRestoring(true);
    setShowConfirmRestoreModal(false);
    setRestoreMsg(null);
    try {
      const res = await executeRestoreFromBackup(parsedPayload, restoreMode);
      setRestoreMsg({ success: res.success, text: res.message || res.error || '' });
      if (res.success) {
        if (onDataRefresh) onDataRefresh();
      }
    } catch (err: any) {
      setRestoreMsg({ success: false, text: err.message || 'Restore failed' });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Sub-Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 max-w-fit shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('backup_restore')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'backup_restore'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <HardDrive className="h-4 w-4 text-blue-600" />
          <span>Local & Cloud Backups</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('migration')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'migration'
              ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="h-4 w-4 text-indigo-600" />
          <span>Tally & Busy 1-Click Migration</span>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full border border-indigo-200">New</span>
        </button>
      </div>

      {activeSubTab === 'migration' ? (
        <TallyBusyMigrationView onSuccess={onDataRefresh} />
      ) : (
        <>
          {/* Top Notification Alerts */}
      {backupSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-xs">Operation Successful</span>
            <p className="text-xs text-emerald-800 mt-0.5">{backupSuccessMsg}</p>
          </div>
          <button onClick={() => setBackupSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold p-1">✕</button>
        </div>
      )}

      {backupErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-3 shadow-xs">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-xs">Backup Error</span>
            <p className="text-xs text-rose-800 mt-0.5">{backupErrorMsg}</p>
          </div>
          <button onClick={() => setBackupErrorMsg(null)} className="text-rose-700 hover:text-rose-900 text-xs font-bold p-1">✕</button>
        </div>
      )}

      {/* Grid of Two Systems: Manual & Auto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ========================================================
            SYSTEM 1: MANUAL BACKUP TO COMPUTER
           ======================================================== */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    System 1
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 mt-0.5">Manual Backup on Computer</h2>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                1-Click Export
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Export an immediate, complete offline copy of your books, vouchers, inventory items, and customer balances directly into your computer or external USB drive.
            </p>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Select Backup Scope:</label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition ${
                  selectedScope === 'active_company'
                    ? 'bg-blue-50/70 border-blue-300 font-bold text-blue-900 ring-1 ring-blue-400/40'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    <span>Active Company Only</span>
                  </div>
                  <input
                    type="radio"
                    name="scope"
                    value="active_company"
                    checked={selectedScope === 'active_company'}
                    onChange={() => setSelectedScope('active_company')}
                    className="text-blue-600"
                  />
                </label>
                <label className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition ${
                  selectedScope === 'all_companies'
                    ? 'bg-blue-50/70 border-blue-300 font-bold text-blue-900 ring-1 ring-blue-400/40'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <span>All Master Companies</span>
                  </div>
                  <input
                    type="radio"
                    name="scope"
                    value="all_companies"
                    checked={selectedScope === 'all_companies'}
                    onChange={() => setSelectedScope('all_companies')}
                    className="text-blue-600"
                  />
                </label>
              </div>
            </div>

            {/* Live Metrics Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Live Data Contents</span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase">Ledgers</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{metrics.ledgersCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase">Items</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{metrics.itemsCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase">Vouchers</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{metrics.vouchersCount}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block uppercase">Invoices</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{metrics.salesCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              Format: <strong className="text-slate-700">JSON Archive (.json)</strong>
            </span>
            <button
              type="button"
              onClick={handleRunManualBackup}
              disabled={isBackingUp}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Generating Backup...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Backup Now to Computer</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================
            SYSTEM 2: AUTO BACKUP ON COMPUTER (SCHEDULED + FOLDER)
           ======================================================== */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    System 2
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 mt-0.5">Auto-Backup on Computer</h2>
                </div>
              </div>

              {/* Master ON/OFF Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`text-xs font-extrabold ${autoConfig.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {autoConfig.enabled ? 'Active (ON)' : 'Disabled (OFF)'}
                </span>
                <input
                  type="checkbox"
                  checked={autoConfig.enabled}
                  onChange={e => handleUpdateConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Configure automatic daily backups to write files directly to your chosen local folder or computer storage without manual intervention.
            </p>

            {/* 1. Schedule Time Picker */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">Auto-Backup Scheduled Time</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Daily 24-Hour Clock</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={autoConfig.dailyTime}
                  onChange={e => handleUpdateConfig({ dailyTime: e.target.value })}
                  disabled={!autoConfig.enabled}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                />
                <div className="text-[11px] text-slate-500 leading-tight">
                  Backs up daily at <strong className="text-slate-800 font-bold">{autoConfig.dailyTime}</strong> automatically while the application is running.
                </div>
              </div>
            </div>

            {/* 2. Folder Selection on Computer */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">Target Backup Folder on Computer</span>
                </div>
                {autoConfig.folderName ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                    <FolderCheck className="h-3 w-3" />
                    Folder Linked
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                    Downloads Folder (Default)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200/90 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700 font-mono truncate text-[11px]">
                    {autoConfig.folderName ? `📁 ${autoConfig.folderName}` : 'Downloads / Computer Drive'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isDirPickerSupported ? (
                    <button
                      type="button"
                      onClick={handleSelectFolder}
                      disabled={isPickingFolder || !autoConfig.enabled}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 cursor-pointer disabled:opacity-50"
                    >
                      {isPickingFolder ? 'Selecting...' : (autoConfig.folderName ? 'Change Folder' : 'Select Folder')}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Browser uses Downloads</span>
                  )}
                  {autoConfig.folderName && (
                    <button
                      type="button"
                      onClick={handleClearFolder}
                      className="text-slate-400 hover:text-rose-600 p-1 text-xs"
                      title="Clear custom folder"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-snug">
                {isDirPickerSupported ? (
                  <>💡 Click <strong className="text-slate-700">"Select Folder"</strong> to choose any directory (e.g. <code>D:\POS_Backups</code>). Auto-backups write directly into it without popups.</>
                ) : (
                  <>Auto-backups will download automatically to your default computer Downloads directory.</>
                )}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-slate-500">
              Last Backup: <strong className="text-slate-800">{autoConfig.lastBackupTimestamp ? new Date(autoConfig.lastBackupTimestamp).toLocaleString() : 'Never'}</strong>
            </div>
            <button
              type="button"
              onClick={handleRunAutoBackupTest}
              disabled={isBackingUp || !autoConfig.enabled}
              className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
              <span>Test Auto-Backup Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 3: RESTORE DATA FROM COMPUTER BACKUP
         ======================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Restore System from Computer Backup</h2>
              <p className="text-xs text-slate-500">Import and load any previously saved offline backup file (.json) to view or restore operational books.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-xl border border-amber-200">
            Offline Recovery
          </span>
        </div>

        {/* Restore Result Message */}
        {restoreMsg && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            restoreMsg.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {restoreMsg.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
            <div className="flex-1 text-xs">
              <span className="font-bold block">{restoreMsg.success ? 'Restoration Succeeded' : 'Restoration Failed'}</span>
              <span>{restoreMsg.text}</span>
            </div>
          </div>
        )}

        {/* File Drop / Select Area */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-blue-400 transition bg-slate-50/50">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            accept=".json,application/json"
            className="hidden"
          />
          <div className="max-w-md mx-auto space-y-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Select Backup File from Your Computer</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Supports all DeepPOS and Tally-compatible JSON archive backups</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              Browse Computer File (.json)
            </button>
            {restoreFile && (
              <div className="text-xs text-blue-700 font-mono font-bold">
                Selected: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        </div>

        {/* Validation Inspection Card */}
        {validationResult && (
          <div className={`p-4 rounded-2xl border space-y-3 ${
            validationResult.valid ? 'bg-blue-50/60 border-blue-200' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {validationResult.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                <span className="text-xs font-bold text-slate-900">
                  {validationResult.valid ? 'Backup File Verified & Ready' : 'Invalid Backup File'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Version {validationResult.version}</span>
            </div>

            {validationResult.valid && validationResult.metadata ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Company</span>
                    <span className="font-bold text-slate-800 truncate block">{validationResult.companyName}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Ledgers</span>
                    <span className="font-bold text-slate-800 font-mono">{validationResult.metadata.totalLedgers}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Vouchers</span>
                    <span className="font-bold text-slate-800 font-mono">{validationResult.metadata.totalVouchers}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block uppercase">Items</span>
                    <span className="font-bold text-slate-800 font-mono">{validationResult.metadata.totalItems}</span>
                  </div>
                </div>

                {/* Restoration Mode Selector */}
                <div className="pt-2 border-t border-blue-200/80 space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">Choose Restoration Destination:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition text-xs ${
                      restoreMode === 'overwrite_active'
                        ? 'bg-blue-100/70 border-blue-400 font-bold text-blue-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span>Overwrite Current Live Books</span>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'overwrite_active'}
                          onChange={() => setRestoreMode('overwrite_active')}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Replaces active company vouchers and accounts with this backup.
                      </span>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition text-xs ${
                      restoreMode === 'create_new_workspace'
                        ? 'bg-blue-100/70 border-blue-400 font-bold text-blue-950'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span>Restore as New Company Workspace (Safe Clone)</span>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'create_new_workspace'}
                          onChange={() => setRestoreMode('create_new_workspace')}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal">
                        Creates an isolated new company so active books remain completely untouched.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmRestoreModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Proceed with Restore</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-700">{validationResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmRestoreModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Confirm System Restore</h3>
                <p className="text-xs text-slate-500">
                  {restoreMode === 'overwrite_active'
                    ? 'You are about to overwrite your active company records.'
                    : 'A new restored company workspace will be created.'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <p>📦 <strong>Company:</strong> {validationResult?.companyName}</p>
              <p>📅 <strong>Backup Date:</strong> {validationResult?.createdAt ? new Date(validationResult.createdAt).toLocaleString() : ''}</p>
              <p>📊 <strong>Records:</strong> {validationResult?.metadata?.totalLedgers} Ledgers, {validationResult?.metadata?.totalVouchers} Vouchers, {validationResult?.metadata?.totalItems} Items</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRestoreModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Restoring...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirm & Restore Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
