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

// Default PPE Categories matching Note 2 Schedule
export const DEFAULT_CATEGORIES: AssetCategory[] = [
  { id: 'cat-1', name: 'Building (Permanent Structure)', code: 'CAT-01', defaultRate: 2, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-2', name: 'Computer & Accessories', code: 'CAT-02', defaultRate: 15, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-3', name: 'Electrical Installation', code: 'CAT-03', defaultRate: 5, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-4', name: 'Furniture & Fixtures', code: 'CAT-04', defaultRate: 15, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-5', name: 'Motor Vehicles', code: 'CAT-05', defaultRate: 15, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-6', name: 'Office Equipment', code: 'CAT-06', defaultRate: 15, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-7', name: 'Studio Equipments', code: 'CAT-07', defaultRate: 15, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-8', name: 'Roads & Culverts', code: 'CAT-08', defaultRate: 3, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-9', name: 'Intangible Asset', code: 'CAT-09', defaultRate: 20, active: true, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
];

export const DEFAULT_ASSETS: FixedAsset[] = [
  {
    id: 'ast-1',
    assetId: 'AST-2025-001',
    name: 'Dell PowerEdge Server R750',
    categoryId: 'cat-2',
    subCategory: 'Computer & Accessories',
    cost: 250000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 250000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2025-01-15',
    purchaseDate: '2025-01-15',
    capitalizationDate: '2025-01-15',
    accumulatedDepreciation: 37500,
    currentPeriodDepreciation: 3125,
    netBookValue: 212500,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-2',
    assetId: 'AST-2025-002',
    name: 'MacBook Pro M3 Max Workstations',
    categoryId: 'cat-2',
    subCategory: 'Computer & Accessories',
    cost: 180000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 180000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2025-03-10',
    purchaseDate: '2025-03-10',
    capitalizationDate: '2025-03-10',
    accumulatedDepreciation: 27000,
    currentPeriodDepreciation: 2250,
    netBookValue: 153000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-03-10T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-3',
    assetId: 'AST-2025-003',
    name: 'Executive Conference Table & Chairs',
    categoryId: 'cat-4',
    subCategory: 'Furniture & Fixtures',
    cost: 120000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 120000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2025-02-01',
    purchaseDate: '2025-02-01',
    capitalizationDate: '2025-02-01',
    accumulatedDepreciation: 18000,
    currentPeriodDepreciation: 1500,
    netBookValue: 102000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-4',
    assetId: 'AST-2025-004',
    name: 'Canon Multi-Function Copier & Printer',
    categoryId: 'cat-6',
    subCategory: 'Office Equipment',
    cost: 95000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 95000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2025-01-20',
    purchaseDate: '2025-01-20',
    capitalizationDate: '2025-01-20',
    accumulatedDepreciation: 14250,
    currentPeriodDepreciation: 1187.5,
    netBookValue: 80750,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-01-20T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-5',
    assetId: 'AST-2024-001',
    name: 'Toyota Hilux Delivery Van',
    categoryId: 'cat-5',
    subCategory: 'Motor Vehicles',
    cost: 1800000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 1800000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2024-06-15',
    purchaseDate: '2024-06-15',
    capitalizationDate: '2024-06-15',
    accumulatedDepreciation: 540000,
    currentPeriodDepreciation: 22500,
    netBookValue: 1260000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2024-06-15T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-6',
    assetId: 'AST-2023-001',
    name: 'Main Office & Commercial Building',
    categoryId: 'cat-1',
    subCategory: 'Building (Permanent Structure)',
    cost: 12500000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 12500000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 2,
    residualValue: 1,
    depreciationStartDate: '2023-01-10',
    purchaseDate: '2023-01-10',
    capitalizationDate: '2023-01-10',
    accumulatedDepreciation: 750000,
    currentPeriodDepreciation: 20833.33,
    netBookValue: 11750000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2023-01-10T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-7',
    assetId: 'AST-2025-005',
    name: '100 kVA Automatic Diesel Generator',
    categoryId: 'cat-3',
    subCategory: 'Electrical Installation',
    cost: 450000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 450000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 5,
    residualValue: 1,
    depreciationStartDate: '2025-02-15',
    purchaseDate: '2025-02-15',
    capitalizationDate: '2025-02-15',
    accumulatedDepreciation: 22500,
    currentPeriodDepreciation: 1875,
    netBookValue: 427500,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-02-15T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-8',
    assetId: 'AST-2025-006',
    name: '4K Broadcast Camera & Audio Suite',
    categoryId: 'cat-7',
    subCategory: 'Studio Equipments',
    cost: 320000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 320000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 15,
    residualValue: 1,
    depreciationStartDate: '2025-04-05',
    purchaseDate: '2025-04-05',
    capitalizationDate: '2025-04-05',
    accumulatedDepreciation: 48000,
    currentPeriodDepreciation: 4000,
    netBookValue: 272000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-04-05T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  },
  {
    id: 'ast-9',
    assetId: 'AST-2025-007',
    name: 'Enterprise ERP & POS License',
    categoryId: 'cat-9',
    subCategory: 'Intangible Asset',
    cost: 500000,
    additionalCapitalizedCost: 0,
    totalCapitalizedCost: 500000,
    depreciationMethod: 'Straight Line',
    depreciationBasis: 'Rate',
    depreciationRate: 20,
    residualValue: 1,
    depreciationStartDate: '2025-01-01',
    purchaseDate: '2025-01-01',
    capitalizationDate: '2025-01-01',
    accumulatedDepreciation: 100000,
    currentPeriodDepreciation: 8333.33,
    netBookValue: 400000,
    status: 'Active',
    createdBy: 'system',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  }
];

export const DEFAULT_DEPRECIATIONS: DepreciationTransaction[] = [
  {
    id: 'dep-1',
    assetId: 'ast-1',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 215625,
    depreciationAmount: 3125,
    accumulatedDepreciation: 37500,
    closingNbv: 212500,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-2',
    assetId: 'ast-2',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 155250,
    depreciationAmount: 2250,
    accumulatedDepreciation: 27000,
    closingNbv: 153000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-3',
    assetId: 'ast-3',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 103500,
    depreciationAmount: 1500,
    accumulatedDepreciation: 18000,
    closingNbv: 102000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-4',
    assetId: 'ast-4',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 81937.5,
    depreciationAmount: 1187.5,
    accumulatedDepreciation: 14250,
    closingNbv: 80750,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-5',
    assetId: 'ast-5',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 1282500,
    depreciationAmount: 22500,
    accumulatedDepreciation: 540000,
    closingNbv: 1260000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-6',
    assetId: 'ast-6',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 11770833.33,
    depreciationAmount: 20833.33,
    accumulatedDepreciation: 750000,
    closingNbv: 11750000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-7',
    assetId: 'ast-7',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 429375,
    depreciationAmount: 1875,
    accumulatedDepreciation: 22500,
    closingNbv: 427500,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-8',
    assetId: 'ast-8',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 276000,
    depreciationAmount: 4000,
    accumulatedDepreciation: 48000,
    closingNbv: 272000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  },
  {
    id: 'dep-9',
    assetId: 'ast-9',
    financialYear: '2026',
    accountingPeriod: 'August 2026',
    depreciationDate: '2026-08-31',
    openingNbv: 408333.33,
    depreciationAmount: 8333.33,
    accumulatedDepreciation: 100000,
    closingNbv: 400000,
    journalId: 'JV-2026-08-01',
    status: 'Posted',
    postedBy: 'system',
    postedAt: '2026-08-31T23:59:59.000Z'
  }
];

// Categories
export const getAssetCategories = (): AssetCategory[] => {
  const data = load<AssetCategory[]>(KEYS.CATEGORIES, []);
  if (!data || data.length === 0) {
    save(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return data;
};
export const saveAssetCategories = (categories: AssetCategory[]) => save(KEYS.CATEGORIES, categories);

// Custodians
export const getCustodians = (): Custodian[] => load(KEYS.CUSTODIANS, []);
export const saveCustodians = (custodians: Custodian[]) => save(KEYS.CUSTODIANS, custodians);

// Assets
export const getAssets = (): FixedAsset[] => {
  const data = load<FixedAsset[]>(KEYS.ASSETS, []);
  if (!data || data.length === 0) {
    save(KEYS.ASSETS, DEFAULT_ASSETS);
    return DEFAULT_ASSETS;
  }
  return data;
};
export const saveAssets = (assets: FixedAsset[]) => save(KEYS.ASSETS, assets);

// Depreciations
export const getDepreciations = (): DepreciationTransaction[] => {
  const data = load<DepreciationTransaction[]>(KEYS.DEPRECIATIONS, []);
  if (!data || data.length === 0) {
    save(KEYS.DEPRECIATIONS, DEFAULT_DEPRECIATIONS);
    return DEFAULT_DEPRECIATIONS;
  }
  return data;
};
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

export const deleteAsset = (id: string, userId: string = 'system') => {
  const assets = getAssets();
  const filtered = assets.filter(a => a.id !== id);
  addAuditLog({
    id: generateId(),
    assetId: id,
    action: 'Deleted',
    userId,
    timestamp: new Date().toISOString()
  });
  saveAssets(filtered);
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
export type DepreciationFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';

export const getPeriodOptions = (year: string, frequency: DepreciationFrequency): string[] => {
  const y = year || '2026';
  if (frequency === 'Quarterly') {
    return [
      `Q1 ${y} (Jan - Mar)`,
      `Q2 ${y} (Apr - Jun)`,
      `Q3 ${y} (Jul - Sep)`,
      `Q4 ${y} (Oct - Dec)`
    ];
  } else if (frequency === 'Half-Yearly') {
    return [
      `H1 ${y} (Jan - Jun)`,
      `H2 ${y} (Jul - Dec)`
    ];
  } else if (frequency === 'Yearly') {
    return [
      `Full Year ${y} (Jan - Dec)`
    ];
  } else {
    // Monthly
    return [
      `January ${y}`,
      `February ${y}`,
      `March ${y}`,
      `April ${y}`,
      `May ${y}`,
      `June ${y}`,
      `July ${y}`,
      `August ${y}`,
      `September ${y}`,
      `October ${y}`,
      `November ${y}`,
      `December ${y}`,
      `Current Month`
    ];
  }
};

export const getPeriodTargetDate = (year: string, frequency: DepreciationFrequency, periodName: string): string => {
  const y = parseInt(year || '2026', 10);

  if (periodName === 'Current Month') {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  }

  if (frequency === 'Quarterly') {
    if (periodName.startsWith('Q1')) return `${y}-03-31`;
    if (periodName.startsWith('Q2')) return `${y}-06-30`;
    if (periodName.startsWith('Q3')) return `${y}-09-30`;
    if (periodName.startsWith('Q4')) return `${y}-12-31`;
  } else if (frequency === 'Half-Yearly') {
    if (periodName.startsWith('H1')) return `${y}-06-30`;
    if (periodName.startsWith('H2')) return `${y}-12-31`;
  } else if (frequency === 'Yearly') {
    return `${y}-12-31`;
  } else {
    // Monthly
    const months: Record<string, { monthIdx: number; lastDay: number }> = {
      January: { monthIdx: 0, lastDay: 31 },
      February: { monthIdx: 1, lastDay: (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28 },
      March: { monthIdx: 2, lastDay: 31 },
      April: { monthIdx: 3, lastDay: 30 },
      May: { monthIdx: 4, lastDay: 31 },
      June: { monthIdx: 5, lastDay: 30 },
      July: { monthIdx: 6, lastDay: 31 },
      August: { monthIdx: 7, lastDay: 31 },
      September: { monthIdx: 8, lastDay: 30 },
      October: { monthIdx: 9, lastDay: 31 },
      November: { monthIdx: 10, lastDay: 30 },
      December: { monthIdx: 11, lastDay: 31 }
    };

    const firstWord = periodName.split(' ')[0];
    if (months[firstWord]) {
      const mInfo = months[firstWord];
      const monthStr = String(mInfo.monthIdx + 1).padStart(2, '0');
      const dayStr = String(mInfo.lastDay).padStart(2, '0');
      return `${y}-${monthStr}-${dayStr}`;
    }
  }

  // Fallback to end of current year
  return `${y}-12-31`;
};

export const calculateDepreciation = (
  asset: FixedAsset,
  targetDateStr: string, // YYYY-MM-DD
  frequency: DepreciationFrequency = 'Monthly'
): {
  depreciationAmount: number;
  newAccumulated: number;
  newNbv: number;
} | null => {
  if (asset.status !== 'Active') return null;
  if (!asset.depreciationStartDate) return null;
  
  const targetDate = new Date(targetDateStr);
  const startDate = new Date(asset.depreciationStartDate);
  
  if (targetDate < startDate) return null; // No depreciation prior to start date
  
  let annualDepreciation = 0;
  
  // Residual value (default 1)
  const residualValue = asset.residualValue !== undefined && asset.residualValue >= 0 ? asset.residualValue : 1;
  const depreciableAmount = asset.cost - residualValue;
  if (depreciableAmount <= 0) return null;

  if (asset.depreciationMethod === 'Written Down Value' || asset.depreciationMethod === 'Reducing Balance') {
    const rate = asset.depreciationRate || (asset.usefulLife ? (100 / asset.usefulLife) : 0);
    const currentNBV = asset.cost - asset.accumulatedDepreciation;
    annualDepreciation = Math.max(0, currentNBV - residualValue) * (rate / 100);
  } else {
    // Default Straight Line Method
    if (asset.depreciationBasis === 'Rate' && asset.depreciationRate) {
      annualDepreciation = depreciableAmount * (asset.depreciationRate / 100);
    } else if (asset.depreciationBasis === 'Useful Life' && asset.usefulLife) {
      annualDepreciation = depreciableAmount / asset.usefulLife;
    } else if (asset.depreciationRate) {
      annualDepreciation = depreciableAmount * (asset.depreciationRate / 100);
    } else if (asset.usefulLife) {
      annualDepreciation = depreciableAmount / asset.usefulLife;
    } else {
      return null;
    }
  }
  
  let periodDepreciation = 0;
  if (frequency === 'Monthly') {
    periodDepreciation = annualDepreciation / 12;
  } else if (frequency === 'Quarterly') {
    periodDepreciation = annualDepreciation / 4;
  } else if (frequency === 'Half-Yearly') {
    periodDepreciation = annualDepreciation / 2;
  } else if (frequency === 'Yearly') {
    periodDepreciation = annualDepreciation;
  } else {
    periodDepreciation = annualDepreciation / 12;
  }
  
  let currentNbv = asset.cost - asset.accumulatedDepreciation;
  
  // If fully depreciated, return 0
  if (currentNbv <= residualValue) {
    return {
      depreciationAmount: 0,
      newAccumulated: asset.accumulatedDepreciation,
      newNbv: residualValue
    };
  }
  
  // Check if period depreciation exceeds remaining depreciable NBV
  if (currentNbv - periodDepreciation < residualValue) {
    periodDepreciation = currentNbv - residualValue;
  }
  
  // Round to 2 decimals
  periodDepreciation = Math.round(periodDepreciation * 100) / 100;
  
  const newAccumulated = asset.accumulatedDepreciation + periodDepreciation;
  const newNbv = Math.round((asset.cost - newAccumulated) * 100) / 100;
  
  return {
    depreciationAmount: periodDepreciation,
    newAccumulated,
    newNbv
  };
};

export const formatCurrency = (amount: number) => {
  return 'Nu. ' + amount.toFixed(2);
};
