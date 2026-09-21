import { Config } from '../types';
import { DEFAULT_CONFIG, getTenantStorageKey, STORAGE_KEYS } from './storageService';
import { getActiveCompanyId, DEFAULT_TENANT_COMPANY } from './supabaseTenantService';
import { syncConfigToSupabase } from './supabaseSyncService';

export interface FeatureDefinition {
  id: keyof Config;
  label: string;
  shortDesc: string;
  category: 'Billing & POS' | 'Inventory & Variants' | 'Taxation & Accounts' | 'HR, Assets & Modules';
  defaultEnabled?: boolean;
}

export const ALL_SYSTEM_FEATURES: FeatureDefinition[] = [
  // Billing & POS
  {
    id: 'EnablePOS',
    label: 'POS Billing (Retail)',
    shortDesc: 'Fast barcode counter point-of-sale interface for retail cashiers.',
    category: 'Billing & POS',
    defaultEnabled: true
  },
  {
    id: 'EnableNormalSale',
    label: 'Sales Invoice (B2B / Standard)',
    shortDesc: 'Traditional sales invoicing with Order No, Delivery Note, and custom Terms.',
    category: 'Billing & POS',
    defaultEnabled: true
  },
  {
    id: 'EnableWholesalePrice',
    label: 'Dual Pricing (Wholesale / Retail)',
    shortDesc: 'Allow defining wholesale price per item and toggling pricing tier in sales.',
    category: 'Billing & POS',
    defaultEnabled: true
  },
  {
    id: 'EnableItemDiscount',
    label: 'Item-wise Line Discount',
    shortDesc: 'Enable item line discounts (% or flat amount) on individual products.',
    category: 'Billing & POS',
    defaultEnabled: true
  },
  {
    id: 'EnableBillDiscount',
    label: 'Bill Lumpsum Discount',
    shortDesc: 'Allow a single flat or percentage discount applied on the total invoice.',
    category: 'Billing & POS',
    defaultEnabled: false
  },

  // Inventory & Variants
  {
    id: 'EnableSerials',
    label: 'Serial Numbers & IMEI Tracking',
    shortDesc: 'Track individual stock items by unique IMEI or Serial numbers.',
    category: 'Inventory & Variants',
    defaultEnabled: true
  },
  {
    id: 'EnablePharmacyBatch',
    label: 'Pharmacy Batch & Expiry Tracking',
    shortDesc: 'Track medicine batch numbers, expiry dates, and FEFO stock management.',
    category: 'Inventory & Variants',
    defaultEnabled: true
  },
  {
    id: 'EnableSpareParts',
    label: 'Auto Spare Parts & Workshop',
    shortDesc: 'Manage Part No / OEM No., physical Rack & Bin, and vehicle compatibility.',
    category: 'Inventory & Variants',
    defaultEnabled: false
  },
  {
    id: 'EnableGarmentsAndFootwear',
    label: 'Garments & Footwear (Sizes/Colors)',
    shortDesc: 'Track apparel by size matrices, color codes, and fashion variant barcodes.',
    category: 'Inventory & Variants',
    defaultEnabled: false
  },
  {
    id: 'EnableAltUnitPrice',
    label: 'Alternative Unit & Conversions',
    shortDesc: 'Multiple units of measurement, conversion factors, and unit-wise pricing.',
    category: 'Inventory & Variants',
    defaultEnabled: true
  },
  {
    id: 'EnableCategory',
    label: 'Item Categories Classification',
    shortDesc: 'Classify inventory items into hierarchical product categories.',
    category: 'Inventory & Variants',
    defaultEnabled: true
  },
  {
    id: 'EnableMultiBranch',
    label: 'Multi-Branch Management (HQ & Outstation Branches)',
    shortDesc: 'Manage Head Office and outstation branches (Thimphu, Phuntsholing, Paro). Transfers goods branch-to-branch and filters reports.',
    category: 'Inventory & Variants',
    defaultEnabled: false
  },
  {
    id: 'EnableMultiGodown',
    label: 'Multiple Godowns / Warehouses',
    shortDesc: 'Maintain separate sub-godowns, back-stores, or cold storage within a location.',
    category: 'Inventory & Variants',
    defaultEnabled: false
  },

  // Taxation & Accounts
  {
    id: 'EnableGST',
    label: 'GST Taxation Module',
    shortDesc: 'Calculates and tracks 5% GST on purchases and sales. Requires GST/TPN.',
    category: 'Taxation & Accounts',
    defaultEnabled: true
  },
  {
    id: 'EnableGSTInputTax',
    label: 'GST Purchase Input Tax Claim',
    shortDesc: 'Capture ITC claim details in Purchases and Payments for Input GST Reports.',
    category: 'Taxation & Accounts',
    defaultEnabled: false
  },
  {
    id: 'EnableBillWiseDetails',
    label: 'Bill-wise Details (Debtors/Creditors)',
    shortDesc: 'Settle outstanding invoices against payments to creditors and customer receipts.',
    category: 'Taxation & Accounts',
    defaultEnabled: true
  },
  {
    id: 'EnableBankReconciliation',
    label: 'Bank Statement Reconciliation',
    shortDesc: 'Track bank clearing dates, uncleared cheques, and reconciled balances.',
    category: 'Taxation & Accounts',
    defaultEnabled: true
  },
  {
    id: 'EnableBankTxnId',
    label: 'Bank Transaction ID / UTR Prompt',
    shortDesc: 'Prompt for bank reference / UTR transaction ID when selecting bank ledgers.',
    category: 'Taxation & Accounts',
    defaultEnabled: true
  },
  {
    id: 'IntegrateAccountsWithInventory',
    label: 'Financial Statements Inventory Integration',
    shortDesc: 'Automatically reflect Opening & Closing Stock in P&L and Balance Sheet.',
    category: 'Taxation & Accounts',
    defaultEnabled: true
  },

  // HR, Assets & Modules
  {
    id: 'EnablePayroll',
    label: 'Payroll & HR Management',
    shortDesc: 'Process employee salaries, attendance, salary slips, and provident funds.',
    category: 'HR, Assets & Modules',
    defaultEnabled: true
  },
  {
    id: 'EnableEmployeeAdvances',
    label: 'Employee Advances (DSA/Imprest)',
    shortDesc: 'Track DSA, imprest, and salary advances by individual employee.',
    category: 'HR, Assets & Modules',
    defaultEnabled: true
  },
  {
    id: 'EnableAssetManagement',
    label: 'Fixed Asset Management',
    shortDesc: 'Track fixed assets, depreciation schedules, and calculate net book values.',
    category: 'HR, Assets & Modules',
    defaultEnabled: true
  },
  {
    id: 'EnableAuditTrail',
    label: 'Audit Trail & Compliance',
    shortDesc: 'Maintain an immutable audit trail of voucher entries, edits, and deletions.',
    category: 'HR, Assets & Modules',
    defaultEnabled: true
  },
  {
    id: 'EnableAdvancedAI',
    label: 'Advanced Gemini AI Assistant',
    shortDesc: 'AI-driven conversational reporting, predictive inventory, and smart queries.',
    category: 'HR, Assets & Modules',
    defaultEnabled: false
  }
];

export interface FeaturePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  features: Record<string, boolean>;
}

export const FEATURE_PRESETS: FeaturePreset[] = [
  {
    id: 'retail',
    name: 'Standard Retail / Grocery',
    badge: '🛒 Retail',
    description: 'Fast POS cashier, standard invoicing, GST, discounts, and item categories.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: false,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: false,
      EnablePharmacyBatch: false,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: true,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: false,
      EnableBankReconciliation: false,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'electronics',
    name: 'Electronics & Mobile Store',
    badge: '📱 Electronics',
    description: 'Serial / IMEI tracking, dual pricing, bill-wise credits, POS, and GST.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: true,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: true,
      EnablePharmacyBatch: false,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: false,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: true,
      EnableBankReconciliation: false,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy & Medical Store',
    badge: '💊 Pharmacy',
    description: 'FEFO Batch & Expiry tracking, retail POS, bill-wise credits, and GST.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: false,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: false,
      EnablePharmacyBatch: true,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: false,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: true,
      EnableBankReconciliation: false,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'automobile',
    name: 'Auto Spare Parts & Workshop',
    badge: '🔧 Spare Parts',
    description: 'Part/OEM numbers, Rack & Bin storage, vehicle compatibility, and wholesale pricing.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: true,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: false,
      EnablePharmacyBatch: false,
      EnableSpareParts: true,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: true,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: true,
      EnableBankReconciliation: false,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'apparel',
    name: 'Garments & Footwear',
    badge: '👗 Fashion',
    description: 'Apparel sizes, color variants, barcode ticketing, retail POS, and GST.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: false,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: false,
      EnablePharmacyBatch: false,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: true,
      EnableAltUnitPrice: false,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: false,
      EnableBankReconciliation: false,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'wholesale',
    name: 'Wholesale & B2B Distribution',
    badge: '🏢 Wholesale',
    description: 'B2B Sales Invoices, multi-unit conversions, bill-wise accounts, and bank recon.',
    features: {
      EnablePOS: false,
      EnableNormalSale: true,
      EnableWholesalePrice: true,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: false,
      EnablePharmacyBatch: false,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: true,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: true,
      EnableBankReconciliation: true,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: true,
      EnableAdvancedAI: false
    }
  },
  {
    id: 'enterprise',
    name: 'All Features (Full Enterprise)',
    badge: '⭐ Enterprise',
    description: 'Unlocks every module: POS, B2B, Serials, Pharmacy, Parts, Payroll, and Assets.',
    features: {
      EnablePOS: true,
      EnableNormalSale: true,
      EnableWholesalePrice: true,
      EnableItemDiscount: true,
      EnableBillDiscount: true,
      EnableSerials: true,
      EnablePharmacyBatch: true,
      EnableSpareParts: true,
      EnableGarmentsAndFootwear: true,
      EnableAltUnitPrice: true,
      EnableCategory: true,
      EnableGST: true,
      EnableGSTInputTax: true,
      EnableBillWiseDetails: true,
      EnableBankReconciliation: true,
      EnableBankTxnId: true,
      IntegrateAccountsWithInventory: true,
      EnablePayroll: true,
      EnableEmployeeAdvances: true,
      EnableAssetManagement: true,
      EnableAuditTrail: true,
      EnableAdvancedAI: true
    }
  },
  {
    id: 'minimal',
    name: 'Minimal POS (Basic Cashier)',
    badge: '🧹 Minimal POS',
    description: 'Stripped down single-screen cashier counter. Completely hides all other modules.',
    features: {
      EnablePOS: true,
      EnableNormalSale: false,
      EnableWholesalePrice: false,
      EnableItemDiscount: false,
      EnableBillDiscount: false,
      EnableSerials: false,
      EnablePharmacyBatch: false,
      EnableSpareParts: false,
      EnableGarmentsAndFootwear: false,
      EnableAltUnitPrice: false,
      EnableCategory: false,
      EnableGST: false,
      EnableGSTInputTax: false,
      EnableBillWiseDetails: false,
      EnableBankReconciliation: false,
      EnableBankTxnId: false,
      IntegrateAccountsWithInventory: false,
      EnablePayroll: false,
      EnableEmployeeAdvances: false,
      EnableAssetManagement: false,
      EnableAuditTrail: false,
      EnableAdvancedAI: false
    }
  }
];

/**
 * Loads the current Config object for any specific company.
 */
export function getCompanyConfig(companyId: string): Config {
  if (!companyId) return { ...DEFAULT_CONFIG };

  const storageKey = getTenantStorageKey(STORAGE_KEYS.CONFIG, companyId);
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn(`[getCompanyConfig] Failed to parse config for company ${companyId}:`, err);
  }

  // Fallback if main config was saved under default key
  if (companyId === DEFAULT_TENANT_COMPANY.id) {
    try {
      const rawDefault = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CONFIG) : null;
      if (rawDefault) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(rawDefault) };
      }
    } catch {}
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Saves features for a company configured by the Superadmin.
 * Updates both the individual config.Enable... flags and config.superadminFeatures.
 */
export function saveCompanyFeatures(companyId: string, featureMap: Record<string, boolean>): Config {
  const currentConfig = getCompanyConfig(companyId);
  const updatedConfig: Config = {
    ...currentConfig,
    superadminFeatures: { ...(currentConfig.superadminFeatures || {}), ...featureMap }
  };

  // Synchronize top-level flags with the featureMap
  ALL_SYSTEM_FEATURES.forEach(f => {
    if (featureMap[f.id] !== undefined) {
      (updatedConfig as any)[f.id] = featureMap[f.id] ? 'true' : 'false';
    }
  });

  const storageKey = getTenantStorageKey(STORAGE_KEYS.CONFIG, companyId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey, JSON.stringify(updatedConfig));
    
    // Also update main key if this is default company or active company
    if (companyId === DEFAULT_TENANT_COMPANY.id || companyId === getActiveCompanyId()) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(updatedConfig));
      // Dispatch storage event so live app components refresh
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('configUpdated', { detail: updatedConfig }));
      window.dispatchEvent(new CustomEvent('app:updateConfig', { detail: updatedConfig }));
    }
  }

  // Sync to remote Supabase in background
  syncConfigToSupabase(updatedConfig, companyId).catch(err => {
    console.warn('[saveCompanyFeatures] Cloud sync notice:', err);
  });

  return updatedConfig;
}

/**
 * Checks whether a feature is permitted and visible for the current user.
 * - Superadmin ALWAYS has full access to view and toggle everything.
 * - For normal clients, if Superadmin turned off the feature (either in superadminFeatures or config[key] === 'false'),
 *   the feature is COMPLETELY HIDDEN from the client's UI.
 */
export function isFeatureAllowed(
  config: Config | undefined | null,
  featureKey: string,
  isSuperadminUser: boolean = false
): boolean {
  // Superadmin can see and access everything
  if (isSuperadminUser) return true;
  if (!config) return true;

  // 1. Explicit check against superadminFeatures record if set
  if (config.superadminFeatures && config.superadminFeatures[featureKey] !== undefined) {
    return config.superadminFeatures[featureKey] === true;
  }

  // 2. Fallback check against top-level config string flags
  const val = (config as any)[featureKey];
  if (featureKey === 'EnableSpareParts' || featureKey === 'EnableGarmentsAndFootwear' || featureKey === 'EnableBillDiscount') {
    return val === 'true';
  }
  return val !== 'false';
}
