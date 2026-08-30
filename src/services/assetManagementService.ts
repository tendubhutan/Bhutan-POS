import {
  AssetCategory,
  FixedAsset,
  Custodian,
  AssetTransfer,
  DepreciationTransaction,
  AssetDisposal,
  AssetAuditLog
} from '../types/assetManagement';
import { Ledger, Voucher } from '../types';

// Storage Keys
const KEYS = {
  CATEGORIES: 'deep_pos_am_categories',
  ASSETS: 'deep_pos_am_assets',
  CUSTODIANS: 'deep_pos_am_custodians',
  TRANSFERS: 'deep_pos_am_transfers',
  DEPRECIATIONS: 'deep_pos_am_depreciations',
  DISPOSALS: 'deep_pos_am_disposals',
  AUDIT_LOGS: 'deep_pos_am_audit_logs',
};

// Generic storage functions
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event('storage'));
}

// Generate IDs
const generateId = () => crypto.randomUUID();

const generateNumber = (prefix: string, length = 6) => {
  const num = Math.floor(Math.random() * Math.pow(10, length));
  return `${prefix}-${num.toString().padStart(length, '0')}`;
};

// Categories
export const getAssetCategories = (): AssetCategory[] => load(KEYS.CATEGORIES, []);
export const saveAssetCategories = (categories: AssetCategory[]) => save(KEYS.CATEGORIES, categories);

// Custodians
export const getCustodians = (): Custodian[] => load(KEYS.CUSTODIANS, []);
export const saveCustodians = (custodians: Custodian[]) => save(KEYS.CUSTODIANS, custodians);

// Assets
export const getAssets = (): FixedAsset[] => load(KEYS.ASSETS, []);
export const saveAssets = (assets: FixedAsset[]) => save(KEYS.ASSETS, assets);
export const saveAsset = (asset: FixedAsset, userId: string = 'system') => {
  const assets = getAssets();
  const existingIdx = assets.findIndex(a => a.id === asset.id);
  
  if (existingIdx >= 0) {
    // Add audit log
    addAuditLog({
      id: generateId(),
      assetId: asset.id,
      action: 'Updated',
      userId,
      timestamp: new Date().toISOString()
    });
    assets[existingIdx] = asset;
  } else {
    addAuditLog({
      id: generateId(),
      assetId: asset.id,
      action: 'Created',
      userId,
      timestamp: new Date().toISOString()
    });
    assets.push(asset);
  }
  
  saveAssets(assets);
};

// Transfers
export const getTransfers = (): AssetTransfer[] => load(KEYS.TRANSFERS, []);
export const saveTransfer = (transfer: AssetTransfer) => {
  const transfers = getTransfers();
  transfers.push(transfer);
  save(KEYS.TRANSFERS, transfers);
  
  // Add audit log
  addAuditLog({
    id: generateId(),
    assetId: transfer.assetId,
    action: 'Transferred',
    userId: transfer.createdBy,
    timestamp: new Date().toISOString(),
    remarks: `Transferred to Custodian: ${transfer.toCustodianId}`
  });
};

// Depreciations
export const getDepreciations = (): DepreciationTransaction[] => load(KEYS.DEPRECIATIONS, []);
export const saveDepreciation = (dep: DepreciationTransaction) => {
  const deps = getDepreciations();
  deps.push(dep);
  save(KEYS.DEPRECIATIONS, deps);
  
  // Add audit log
  if (dep.status === 'Posted') {
    addAuditLog({
      id: generateId(),
      assetId: dep.assetId,
      action: 'Depreciation Posted',
      userId: dep.postedBy || 'system',
      timestamp: new Date().toISOString(),
      remarks: `Period: ${dep.accountingPeriod}, Amount: ${dep.depreciationAmount}`
    });
  }
};

// Disposals
export const getDisposals = (): AssetDisposal[] => load(KEYS.DISPOSALS, []);
export const saveDisposal = (disposal: AssetDisposal) => {
  const disposals = getDisposals();
  disposals.push(disposal);
  save(KEYS.DISPOSALS, disposals);
  
  // Add audit log
  addAuditLog({
    id: generateId(),
    assetId: disposal.assetId,
    action: `Asset ${disposal.disposalType}`,
    userId: disposal.createdBy,
    timestamp: new Date().toISOString(),
    remarks: `Proceeds: ${disposal.saleProceeds}, Gain/Loss: ${disposal.gainLoss}`
  });
};

// Audit Logs
export const getAuditLogs = (): AssetAuditLog[] => load(KEYS.AUDIT_LOGS, []);
export const addAuditLog = (log: AssetAuditLog) => {
  const logs = getAuditLogs();
  logs.push(log);
  save(KEYS.AUDIT_LOGS, logs);
};

// Depreciation Engine
export const calculateDepreciation = (
  asset: FixedAsset,
  targetDateStr: string // YYYY-MM-DD
): {
  depreciationAmount: number;
  newAccumulated: number;
  newNbv: number;
} | null => {
  if (asset.status !== 'Active') return null;
  if (!asset.depreciationStartDate) return null;
  
  const targetDate = new Date(targetDateStr);
  const startDate = new Date(asset.depreciationStartDate);
  
  if (targetDate < startDate) return null; // No depreciation yet
  
  // This is a simplified calculation for the current period (assumes monthly)
  let annualDepreciation = 0;
  
  // Asset must always have a residual value of 1
  const residualValue = 1;
  const depreciableAmount = asset.cost - residualValue;
  
  if (asset.depreciationBasis === 'Rate' && asset.depreciationRate) {
    annualDepreciation = depreciableAmount * (asset.depreciationRate / 100);
  } else if (asset.depreciationBasis === 'Useful Life' && asset.usefulLife) {
    annualDepreciation = depreciableAmount / asset.usefulLife;
  } else {
    return null;
  }
  
  let monthlyDepreciation = annualDepreciation / 12;
  
  let currentNbv = asset.cost - asset.accumulatedDepreciation;
  
  // If fully depreciated, return 0
  if (currentNbv <= residualValue) {
    return {
      depreciationAmount: 0,
      newAccumulated: asset.accumulatedDepreciation,
      newNbv: residualValue
    };
  }
  
  // Check if this month's depreciation takes it below residual value
  if (currentNbv - monthlyDepreciation < residualValue) {
    monthlyDepreciation = currentNbv - residualValue;
  }
  
  // Round to 2 decimals
  monthlyDepreciation = Math.round(monthlyDepreciation * 100) / 100;
  
  const newAccumulated = asset.accumulatedDepreciation + monthlyDepreciation;
  const newNbv = asset.cost - newAccumulated;
  
  return {
    depreciationAmount: monthlyDepreciation,
    newAccumulated,
    newNbv
  };
};

export const formatCurrency = (amount: number) => {
  return 'Nu. ' + amount.toFixed(2);
};
