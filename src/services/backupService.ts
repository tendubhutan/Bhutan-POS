import {
  STORAGE_KEYS,
  loadJson,
  saveJson,
  getLedgers,
  getVouchers,
  getConfig,
  addAuditLog
} from './storageService';
import {
  getActiveCompanyId,
  fetchUserCompanies,
  fetchFinancialYears,
  DEFAULT_TENANT_COMPANY
} from './supabaseTenantService';
import { Config, Item, Ledger, Voucher, SalesInvoice, PurchaseInvoice, AppUser } from '../types';

export interface AutoBackupConfig {
  enabled: boolean;
  scheduleType: 'daily_time' | 'interval_hours' | 'on_day_close';
  dailyTime: string; // e.g. "18:00" (24h)
  intervalHours: number; // e.g. 2, 4, 6, 12
  useFolderPicker: boolean;
  folderName: string;
  lastBackupTimestamp: string;
  lastBackupFileName: string;
  lastBackupStatus: 'success' | 'failed' | 'idle';
  lastBackupErrorMessage?: string;
  backupScope: 'active_company' | 'all_companies';
  includeAuditLogs: boolean;
  notifyOnCompletion: boolean;
}

export const DEFAULT_AUTO_BACKUP_CONFIG: AutoBackupConfig = {
  enabled: true,
  scheduleType: 'daily_time',
  dailyTime: '18:00',
  intervalHours: 4,
  useFolderPicker: false,
  folderName: '',
  lastBackupTimestamp: '',
  lastBackupFileName: '',
  lastBackupStatus: 'idle',
  backupScope: 'active_company',
  includeAuditLogs: true,
  notifyOnCompletion: true
};

const AUTO_BACKUP_CONFIG_KEY = 'deep_pos_auto_backup_config';
const DB_NAME = 'deep_pos_backup_db';
const DB_STORE = 'dir_handles';
const DIR_HANDLE_KEY = 'backup_directory_handle';

// ==========================================
// IndexedDB Directory Handle Persistence
// ==========================================
function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle: any): Promise<void> {
  try {
    const db = await openBackupDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.put(handle, DIR_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save directory handle to IndexedDB:', err);
  }
}

export async function getStoredDirectoryHandle(): Promise<any | null> {
  try {
    const db = await openBackupDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(DIR_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openBackupDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.delete(DIR_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to clear directory handle:', err);
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ==========================================
// Config Management
// ==========================================
export function getAutoBackupConfig(): AutoBackupConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_AUTO_BACKUP_CONFIG;
  const raw = localStorage.getItem(AUTO_BACKUP_CONFIG_KEY);
  if (!raw) return DEFAULT_AUTO_BACKUP_CONFIG;
  try {
    return { ...DEFAULT_AUTO_BACKUP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_AUTO_BACKUP_CONFIG;
  }
}

export function saveAutoBackupConfig(config: Partial<AutoBackupConfig>): AutoBackupConfig {
  const current = getAutoBackupConfig();
  const updated = { ...current, ...config };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(updated));
  }
  return updated;
}

// ==========================================
// Select Folder using File System Access API
// ==========================================
export async function pickBackupDirectory(): Promise<{ success: boolean; folderName?: string; error?: string }> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      error: 'Direct folder selection is not supported in this browser. Backups will download to your standard computer Downloads folder.'
    };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    if (!handle) {
      return { success: false, error: 'No folder selected' };
    }

    // Verify / request permission
    if (handle.requestPermission) {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        return { success: false, error: 'Permission to write to the chosen folder was denied' };
      }
    }

    await saveDirectoryHandle(handle);
    const folderName = handle.name || 'Selected Folder';
    saveAutoBackupConfig({
      useFolderPicker: true,
      folderName: folderName
    });

    return { success: true, folderName };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Folder selection was cancelled' };
    }
    return { success: false, error: err.message || 'Failed to select folder' };
  }
}

// ==========================================
// Backup Payload Construction
// ==========================================
export interface BackupPayload {
  version: string;
  app: string;
  backupType: 'manual' | 'auto_scheduled';
  createdAt: string;
  companyId: string;
  companyName: string;
  metadata: {
    totalLedgers: number;
    totalItems: number;
    totalVouchers: number;
    totalSalesInvoices: number;
    totalPurchaseInvoices: number;
    totalQuotations: number;
    financialYearsCount: number;
    exportedBy: string;
  };
  data: Record<string, any>;
}

export function generateBackupPayload(
  scope: 'active_company' | 'all_companies' = 'active_company',
  backupType: 'manual' | 'auto_scheduled' = 'manual'
): BackupPayload {
  const activeCompId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cfg = getConfig();
  const ledgers = getLedgers();
  const items = loadJson<Item[]>(STORAGE_KEYS.ITEMS, []);
  const vouchers = getVouchers();
  const salesInvoices = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
  const purchaseInvoices = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
  const quotations = loadJson(STORAGE_KEYS.QUOTATIONS, []);
  const companies = loadJson<any[]>('registered_companies', []);
  const financialYears = loadJson<any[]>('registered_financial_years', []);

  // Collect all system keys from localStorage
  const data: Record<string, any> = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    data[key] = loadJson(key, null);
  });

  // Include tenant-specific keys if scoped
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('deep_pos_') || k.startsWith('tenant_') || k.startsWith('pos_'))) {
        if (!data[k]) {
          try {
            data[k] = JSON.parse(localStorage.getItem(k) || 'null');
          } catch {
            data[k] = localStorage.getItem(k);
          }
        }
      }
    }
  }

  // Include company & FY registry
  data['registered_companies'] = companies;
  data['registered_financial_years'] = financialYears;

  const activeUser = loadJson<AppUser | null>('deep_pos_active_user', null);

  return {
    version: '2.5',
    app: 'DeepPOS_Bhutan_Accounting_System',
    backupType,
    createdAt: new Date().toISOString(),
    companyId: activeCompId,
    companyName: cfg.CompanyName || 'Accounting Company',
    metadata: {
      totalLedgers: ledgers.length,
      totalItems: items.length,
      totalVouchers: vouchers.length,
      totalSalesInvoices: salesInvoices.length,
      totalPurchaseInvoices: purchaseInvoices.length,
      totalQuotations: quotations.length,
      financialYearsCount: financialYears.length || 1,
      exportedBy: activeUser?.fullName || 'Administrator'
    },
    data
  };
}

// ==========================================
// File Writer (Folder or Browser Download)
// ==========================================
export async function writeBackupFile(
  payload: BackupPayload
): Promise<{ success: boolean; method: 'folder' | 'download'; filename: string; targetPath: string; sizeBytes: number; error?: string }> {
  const sanitizedCompName = (payload.companyName || 'Company').replace(/[^a-zA-Z0-9_-]/g, '_');
  const d = new Date(payload.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const filename = `BACKUP_${sanitizedCompName}_${dateStr}.json`;
  
  const jsonContent = JSON.stringify(payload, null, 2);
  const sizeBytes = new Blob([jsonContent]).size;

  const cfg = getAutoBackupConfig();

  // 1. Try to write to selected folder if configured
  if (cfg.useFolderPicker && isFileSystemAccessSupported()) {
    try {
      const dirHandle = await getStoredDirectoryHandle();
      if (dirHandle) {
        // Verify write permission
        let hasPerm = false;
        if (dirHandle.queryPermission) {
          const q = await dirHandle.queryPermission({ mode: 'readwrite' });
          if (q === 'granted') {
            hasPerm = true;
          } else if (dirHandle.requestPermission) {
            const r = await dirHandle.requestPermission({ mode: 'readwrite' });
            hasPerm = (r === 'granted');
          }
        } else {
          hasPerm = true;
        }

        if (hasPerm) {
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonContent);
          await writable.close();

          return {
            success: true,
            method: 'folder',
            filename,
            targetPath: `${dirHandle.name}/${filename}`,
            sizeBytes
          };
        }
      }
    } catch (err: any) {
      console.warn('Could not write to selected directory handle, falling back to direct browser download:', err);
    }
  }

  // 2. Fallback: Trigger standard browser download
  try {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return {
      success: true,
      method: 'download',
      filename,
      targetPath: `Downloads/${filename}`,
      sizeBytes
    };
  } catch (err: any) {
    return {
      success: false,
      method: 'download',
      filename,
      targetPath: '',
      sizeBytes: 0,
      error: err.message || 'Failed to trigger file download'
    };
  }
}

// ==========================================
// Manual Backup Action
// ==========================================
export async function executeManualBackup(
  scope: 'active_company' | 'all_companies' = 'active_company'
): Promise<{ success: boolean; filename: string; method: string; targetPath: string; sizeKB: number; error?: string }> {
  try {
    const payload = generateBackupPayload(scope, 'manual');
    const res = await writeBackupFile(payload);

    if (res.success) {
      saveAutoBackupConfig({
        lastBackupTimestamp: payload.createdAt,
        lastBackupFileName: res.filename,
        lastBackupStatus: 'success',
        lastBackupErrorMessage: undefined
      });

      addAuditLog({
        action: 'ENTERED',
        module: 'Backup & Restore',
        recordId: res.filename,
        details: `Manual backup saved via ${res.method} (${(res.sizeBytes / 1024).toFixed(1)} KB) containing ${payload.metadata.totalLedgers} ledgers and ${payload.metadata.totalVouchers} vouchers.`
      });

      return {
        success: true,
        filename: res.filename,
        method: res.method,
        targetPath: res.targetPath,
        sizeKB: parseFloat((res.sizeBytes / 1024).toFixed(1))
      };
    } else {
      throw new Error(res.error || 'Failed to save backup file');
    }
  } catch (err: any) {
    saveAutoBackupConfig({
      lastBackupTimestamp: new Date().toISOString(),
      lastBackupStatus: 'failed',
      lastBackupErrorMessage: err.message || 'Manual backup failed'
    });

    return {
      success: false,
      filename: '',
      method: 'none',
      targetPath: '',
      sizeKB: 0,
      error: err.message || 'Manual backup encountered an error'
    };
  }
}

// ==========================================
// Auto-Backup Execution Routine
// ==========================================
export async function triggerAutoBackupNow(): Promise<{ success: boolean; filename: string; method: string; targetPath: string; sizeKB: number; error?: string }> {
  try {
    const cfg = getAutoBackupConfig();
    const payload = generateBackupPayload(cfg.backupScope || 'active_company', 'auto_scheduled');
    const res = await writeBackupFile(payload);

    if (res.success) {
      saveAutoBackupConfig({
        lastBackupTimestamp: payload.createdAt,
        lastBackupFileName: res.filename,
        lastBackupStatus: 'success',
        lastBackupErrorMessage: undefined
      });

      addAuditLog({
        action: 'ENTERED',
        module: 'Auto Backup',
        recordId: res.filename,
        details: `Scheduled auto-backup generated successfully (${(res.sizeBytes / 1024).toFixed(1)} KB) to ${res.targetPath}.`
      });

      // Dispatch window event for UI feedback
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('deep_pos_auto_backup_completed', {
          detail: {
            filename: res.filename,
            method: res.method,
            targetPath: res.targetPath,
            sizeKB: (res.sizeBytes / 1024).toFixed(1),
            timestamp: payload.createdAt
          }
        }));
      }

      return {
        success: true,
        filename: res.filename,
        method: res.method,
        targetPath: res.targetPath,
        sizeKB: parseFloat((res.sizeBytes / 1024).toFixed(1))
      };
    } else {
      throw new Error(res.error || 'Auto-backup write error');
    }
  } catch (err: any) {
    saveAutoBackupConfig({
      lastBackupTimestamp: new Date().toISOString(),
      lastBackupStatus: 'failed',
      lastBackupErrorMessage: err.message || 'Auto-backup failed'
    });

    return {
      success: false,
      filename: '',
      method: 'none',
      targetPath: '',
      sizeKB: 0,
      error: err.message || 'Auto-backup failed'
    };
  }
}

// ==========================================
// Background Auto-Backup Scheduler (Timer)
// ==========================================
let schedulerIntervalId: any = null;
let lastCheckedMinute: string = '';

export function initAutoBackupScheduler(): void {
  if (typeof window === 'undefined') return;
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
  }

  // Check every 25 seconds
  schedulerIntervalId = setInterval(async () => {
    try {
      const cfg = getAutoBackupConfig();
      if (!cfg.enabled) return;

      const now = new Date();
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const currentMinuteKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${currentHH}:${currentMM}`;

      // Avoid double triggering in the same minute
      if (lastCheckedMinute === currentMinuteKey) return;

      const configuredTime = cfg.dailyTime || '18:00';
      const [targetHH, targetMM] = configuredTime.split(':');

      if (currentHH === targetHH && currentMM === targetMM) {
        lastCheckedMinute = currentMinuteKey;
        console.log(`[Auto-Backup] Scheduled time ${configuredTime} matched. Executing automatic backup...`);
        await triggerAutoBackupNow();
      }
    } catch (err) {
      console.warn('[Auto-Backup] Scheduler error:', err);
    }
  }, 25000);
}

// ==========================================
// Backup Restore & Validation Logic
// ==========================================
export interface BackupValidationResult {
  valid: boolean;
  version?: string;
  companyName?: string;
  createdAt?: string;
  backupType?: string;
  metadata?: BackupPayload['metadata'];
  error?: string;
}

export function validateBackupFileContent(rawJson: string): { result: BackupValidationResult; payload?: BackupPayload } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { result: { valid: false, error: 'Invalid JSON format' } };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { result: { valid: false, error: 'File does not contain valid DeepPOS accounting data' } };
    }

    return {
      result: {
        valid: true,
        version: parsed.version || '1.0',
        companyName: parsed.companyName || parsed.companyId || 'Unknown Company',
        createdAt: parsed.createdAt || new Date().toISOString(),
        backupType: parsed.backupType || 'manual',
        metadata: parsed.metadata || {
          totalLedgers: Array.isArray(parsed.data[STORAGE_KEYS.LEDGERS]) ? parsed.data[STORAGE_KEYS.LEDGERS].length : 0,
          totalItems: Array.isArray(parsed.data[STORAGE_KEYS.ITEMS]) ? parsed.data[STORAGE_KEYS.ITEMS].length : 0,
          totalVouchers: Array.isArray(parsed.data[STORAGE_KEYS.VOUCHERS]) ? parsed.data[STORAGE_KEYS.VOUCHERS].length : 0,
          totalSalesInvoices: Array.isArray(parsed.data[STORAGE_KEYS.SALES_INVOICES]) ? parsed.data[STORAGE_KEYS.SALES_INVOICES].length : 0,
          totalPurchaseInvoices: Array.isArray(parsed.data[STORAGE_KEYS.PURCHASE_INVOICES]) ? parsed.data[STORAGE_KEYS.PURCHASE_INVOICES].length : 0,
          totalQuotations: Array.isArray(parsed.data[STORAGE_KEYS.QUOTATIONS]) ? parsed.data[STORAGE_KEYS.QUOTATIONS].length : 0,
          financialYearsCount: 1,
          exportedBy: 'Unknown'
        }
      },
      payload: parsed as BackupPayload
    };
  } catch (err: any) {
    return { result: { valid: false, error: `JSON Parse error: ${err.message}` } };
  }
}

export async function executeRestoreFromBackup(
  payload: BackupPayload,
  mode: 'overwrite_active' | 'create_new_workspace'
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    if (!payload.data || typeof payload.data !== 'object') {
      throw new Error('Invalid backup payload data');
    }

    if (mode === 'overwrite_active') {
      // Overwrite all storage keys in localStorage
      Object.keys(payload.data).forEach(key => {
        const val = payload.data[key];
        if (val !== undefined && val !== null) {
          saveJson(key, val);
        }
      });

      addAuditLog({
        action: 'ALTERED',
        module: 'Backup & Restore',
        recordId: payload.companyName,
        details: `System restored completely from backup file (${payload.createdAt}). Overwrote active operational books.`
      });

      return {
        success: true,
        message: `Successfully restored ${payload.companyName} records! All vouchers, ledgers, items, and settings are updated.`
      };
    } else {
      // Create new isolated company workspace
      const newCompanyId = `comp_${Date.now()}`;
      const newCompanyName = `${payload.companyName || 'Company'} (Restored ${new Date().toLocaleDateString()})`;

      // Store isolated keys
      if (typeof localStorage !== 'undefined') {
        Object.keys(payload.data).forEach(key => {
          const val = payload.data[key];
          if (val !== undefined && val !== null) {
            localStorage.setItem(`${key}_${newCompanyId}`, JSON.stringify(val));
          }
        });

        // Set config for new company
        const restoredCfg = payload.data[STORAGE_KEYS.CONFIG] || {};
        localStorage.setItem(`deep_pos_config_${newCompanyId}`, JSON.stringify({
          ...restoredCfg,
          CompanyName: newCompanyName
        }));
      }

      addAuditLog({
        action: 'ENTERED',
        module: 'Backup & Restore',
        recordId: newCompanyId,
        details: `Restored backup into a new isolated company workspace: "${newCompanyName}".`
      });

      return {
        success: true,
        message: `Created new restored company workspace: "${newCompanyName}". Switch to it anytime from the Company Selector.`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: '',
      error: err.message || 'Restore process failed'
    };
  }
}
