import {
  initTenantSession,
  pushCollectionToSupabase,
  pullCollectionFromSupabase,
  getActiveTenantId
} from './tenantAuthService';
import { STORAGE_KEYS } from './storageService';
import { Item, Ledger, SalesInvoice, PurchaseInvoice, Voucher, Config } from '../types';

/**
 * Helper to safely load JSON data from localStorage.
 */
function loadLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[Sync] Failed to read localStorage key "${key}":`, err);
    return [];
  }
}

/**
 * Helper to safely load JSON object from localStorage.
 */
function loadLocalObject<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

// ----------------------------------------------------------------------------
// Specific ERP Module Push Mappers
// ----------------------------------------------------------------------------

export async function syncItemsToSupabase(items?: Item[]) {
  const data = items ?? loadLocalArray<Item>(STORAGE_KEYS.ITEMS);
  return pushCollectionToSupabase('items', data, (item) => item['Item Code'] || String(Math.random()));
}

export async function syncLedgersToSupabase(ledgers?: Ledger[]) {
  const data = ledgers ?? loadLocalArray<Ledger>(STORAGE_KEYS.LEDGERS);
  return pushCollectionToSupabase('ledgers', data, (l) => l['Ledger Name'] || String(Math.random()));
}

export async function syncSalesInvoicesToSupabase(sales?: SalesInvoice[]) {
  const data = sales ?? loadLocalArray<SalesInvoice>(STORAGE_KEYS.SALES_INVOICES);
  return pushCollectionToSupabase('sales_invoices', data, (inv) => inv.invoiceNo || String(Math.random()));
}

export async function syncPurchaseInvoicesToSupabase(purchases?: PurchaseInvoice[]) {
  const data = purchases ?? loadLocalArray<PurchaseInvoice>(STORAGE_KEYS.PURCHASE_INVOICES);
  return pushCollectionToSupabase('purchase_invoices', data, (p) => p.billNo || p.invoiceNo || String(Math.random()));
}

export async function syncVouchersToSupabase(vouchers?: Voucher[]) {
  const data = vouchers ?? loadLocalArray<Voucher>(STORAGE_KEYS.VOUCHERS);
  return pushCollectionToSupabase('vouchers', data, (v) => v.voucherNo || String(Math.random()));
}

export async function syncConfigToSupabase(config?: Config) {
  const currentConfig = config ?? loadLocalObject<Record<string, any>>(STORAGE_KEYS.CONFIG, {});
  return pushCollectionToSupabase('tenant_settings', [currentConfig], () => 'main_config');
}

// ----------------------------------------------------------------------------
// Master Cloud Sync Orchestrator
// ----------------------------------------------------------------------------

export interface MasterSyncResult {
  success: boolean;
  companyId: string;
  syncedCounts: {
    items: number;
    ledgers: number;
    salesInvoices: number;
    purchaseInvoices: number;
    vouchers: number;
    config: number;
  };
  durationMs: number;
  error?: string;
}

/**
 * Master sync function called by UI buttons or background reconcilers.
 * 1. Initializes/verifies the Supabase tenant session.
 * 2. Reads all unsynced data arrays from browser localStorage.
 * 3. Pushes each dataset into the isolated multi-tenant Supabase tables.
 */
export async function handleMasterCloudSync(
  onProgress?: (step: string, percent: number) => void
): Promise<MasterSyncResult> {
  const startTime = Date.now();

  try {
    // Step 1: Lock tenant context from authenticated user
    onProgress?.('Authenticating and locking company context...', 10);
    const session = await initTenantSession();
    const companyId = session.companyId;

    // Step 2: Push Settings / Config
    onProgress?.('Syncing company configuration...', 25);
    const configResult = await syncConfigToSupabase();

    // Step 3: Push Master Ledgers
    onProgress?.('Syncing chart of accounts & ledgers...', 40);
    const ledgersResult = await syncLedgersToSupabase();

    // Step 4: Push Master Items & Inventory
    onProgress?.('Syncing inventory items...', 60);
    const itemsResult = await syncItemsToSupabase();

    // Step 5: Push Sales & Purchase Invoices
    onProgress?.('Syncing sales & purchase invoices...', 80);
    const salesResult = await syncSalesInvoicesToSupabase();
    const purchasesResult = await syncPurchaseInvoicesToSupabase();

    // Step 6: Push Financial Vouchers
    onProgress?.('Syncing financial vouchers...', 95);
    const vouchersResult = await syncVouchersToSupabase();

    onProgress?.('Sync completed successfully!', 100);

    return {
      success: true,
      companyId,
      syncedCounts: {
        config: configResult.count,
        ledgers: ledgersResult.count,
        items: itemsResult.count,
        salesInvoices: salesResult.count,
        purchaseInvoices: purchasesResult.count,
        vouchers: vouchersResult.count
      },
      durationMs: Date.now() - startTime
    };
  } catch (error: any) {
    console.error('[Master Sync Failed]:', error);
    let errorCompanyId = 'unknown';
    try {
      errorCompanyId = getActiveTenantId();
    } catch {
      // ignore
    }
    return {
      success: false,
      companyId: errorCompanyId,
      syncedCounts: { items: 0, ledgers: 0, salesInvoices: 0, purchaseInvoices: 0, vouchers: 0, config: 0 },
      durationMs: Date.now() - startTime,
      error: error.message || 'Unknown synchronization failure'
    };
  }
}
