import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  initTenantSession,
  pushCollectionToSupabase,
  pullCollectionFromSupabase,
  getActiveTenantId
} from './tenantAuthService';
import { STORAGE_KEYS } from './storageService';
import { Item, Ledger, SalesInvoice, PurchaseInvoice, Voucher, Config } from '../types';
import { getActiveCompanyId, DEFAULT_TENANT_COMPANY, ensureCompanyExists } from './supabaseTenantService';

// Cloud Sync Connection State
export type SupabaseStatus = 'connected' | 'syncing' | 'offline' | 'error';
type StatusListener = (status: SupabaseStatus, message?: string) => void;

const statusListeners = new Set<StatusListener>();
let currentStatus: SupabaseStatus = 'syncing';
let currentStatusMessage = 'Connecting to Supabase cloud...';

export function getSupabaseStatus(): { status: SupabaseStatus; message: string } {
  return { status: currentStatus, message: currentStatusMessage };
}

export function subscribeSupabaseStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentStatus, currentStatusMessage);
  return () => {
    statusListeners.delete(listener);
  };
}

function updateStatus(status: SupabaseStatus, message: string) {
  currentStatus = status;
  currentStatusMessage = message;
  statusListeners.forEach(listener => {
    try {
      listener(status, message);
    } catch (e) {
      console.warn('Status listener notification warning:', e);
    }
  });
}

/**
 * Helper to safely load JSON data from localStorage for a specific company
 */
function loadLocalArray<T>(key: string, companyId?: string): T[] {
  try {
    const cId = companyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
    const effectiveKey = `${key}_${cId}`;
    const raw = localStorage.getItem(effectiveKey) || localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[SupabaseSync] Failed to read localStorage key "${key}":`, err);
    return [];
  }
}

/**
 * Helper to safely save JSON data to localStorage for a specific company
 */
function saveLocalArray<T>(key: string, data: T[], companyId?: string): void {
  try {
    const cId = companyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
    const effectiveKey = `${key}_${cId}`;
    localStorage.setItem(effectiveKey, JSON.stringify(data));
  } catch (err) {
    console.warn(`[SupabaseSync] Failed to save localStorage key "${key}":`, err);
  }
}

// ----------------------------------------------------------------------------
// SINGLE & BATCH ITEM SYNC
// ----------------------------------------------------------------------------

export async function syncItemToSupabase(item: Item, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured || !item) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const itemCode = (item['Item Code'] || (item as any).code || (item as any).itemCode || '').trim();
  if (!itemCode) return;

  const itemName = (item['Item Name'] || (item as any).name || (item as any).itemName || itemCode).trim();
  const safeData: Item = {
    ...item,
    'Item Code': itemCode,
    'Item Name': itemName,
    'Print Name': (item['Print Name'] || itemName).trim(),
    Group: (item.Group || (item as any).group || 'General').trim(),
    Unit: (item.Unit || (item as any).unit || 'Pcs').trim(),
    Barcode: (item.Barcode || (item as any).barcode || itemCode).trim(),
    'Purchase Rate': Number(item['Purchase Rate']) || 0,
    'Sale Rate': Number(item['Sale Rate']) || 0,
    MRP: Number(item.MRP) || Number(item['Sale Rate']) || 0,
    'GST %': Number(item['GST %']) || 0,
    'Zero Rated (Y/N)': item['Zero Rated (Y/N)'] === 'Y' ? 'Y' : 'N',
    'Is Serialized': item['Is Serialized'] === 'Y' ? 'Y' : 'N',
    'Opening Stock': Number(item['Opening Stock']) || 0,
    'Current Stock': Number(item['Current Stock']) || 0,
    'Reorder Level': Number(item['Reorder Level']) || 0
  };

  const payload: Record<string, any> = {
    company_id: companyId,
    record_id: itemCode,
    item_code: itemCode,
    item_name: itemName,
    data: safeData,
    updated_at: new Date().toISOString()
  };

  try {
    // Ensure parent company exists in companies table before inserting item
    await ensureCompanyExists(companyId);

    let res = await supabase.from('items').upsert(payload, { onConflict: 'company_id, record_id' });
    if (res.error) {
      console.warn('[Supabase Sync Item Notice]:', res.error.message);
      // If table is named 'Item' (singular/capitalized)
      if (res.error.message.includes('relation') && (res.error.message.includes('items') || res.error.message.includes('Item'))) {
        res = await supabase.from('Item').upsert(payload, { onConflict: 'company_id, record_id' });
      }
      // If column mismatch on flat fields, retry purely with JSONB data
      if (res.error && (res.error.message.includes('column') || res.error.message.includes('schema'))) {
        res = await supabase.from('items').upsert({
          company_id: companyId,
          record_id: itemCode,
          data: safeData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'company_id, record_id' });
      }
      if (res.error) {
        console.error('[Supabase Item Sync Error]:', res.error.message, res.error.details);
      }
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Item Error]:', err?.message || err);
  }
}

export async function syncItemsBatchToSupabase(items: Item[], targetCompanyId?: string): Promise<void> {
  if (!items || items.length === 0 || !isSupabaseConfigured) return;
  for (const it of items) {
    await syncItemToSupabase(it, targetCompanyId);
  }
}

export async function deleteItemFromSupabase(itemCode: string, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cleanCode = (itemCode || '').trim();
  if (!cleanCode) return;

  try {
    let res = await supabase
      .from('items')
      .delete()
      .match({ company_id: companyId, record_id: cleanCode });

    if (res.error && res.error.message.includes('relation')) {
      await supabase
        .from('Item')
        .delete()
        .match({ company_id: companyId, record_id: cleanCode });
    }
  } catch (err: any) {
    console.warn('[Supabase Delete Item Error]:', err?.message || err);
  }
}

// ----------------------------------------------------------------------------
// SINGLE & BATCH LEDGER SYNC
// ----------------------------------------------------------------------------

export async function syncLedgerToSupabase(ledger: Ledger, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured || !ledger) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const ledgerName = (ledger['Ledger Name'] || (ledger as any).name || (ledger as any).ledgerName || '').trim();
  if (!ledgerName) return;

  const group = (ledger.Group || (ledger as any).group || 'Sundry Debtors').trim();
  const safeData: Ledger = {
    ...ledger,
    'Ledger Name': ledgerName,
    Group: group,
    'Opening Balance': Number(ledger['Opening Balance']) || 0,
    'Current Balance': Number(ledger['Current Balance']) || 0,
    'Balance Type (Dr/Cr)': ledger['Balance Type (Dr/Cr)'] === 'Cr' ? 'Cr' : 'Dr'
  };

  const payload: Record<string, any> = {
    company_id: companyId,
    record_id: ledgerName,
    ledger_name: ledgerName,
    name: ledgerName,
    group: group,
    data: safeData,
    updated_at: new Date().toISOString()
  };

  try {
    let res = await supabase.from('ledgers').upsert(payload, { onConflict: 'company_id, record_id' });
    if (res.error) {
      if (res.error.message.includes('relation')) {
        res = await supabase.from('Ledger').upsert(payload, { onConflict: 'company_id, record_id' });
      }
      if (res.error && (res.error.message.includes('column') || res.error.message.includes('schema'))) {
        await supabase.from('ledgers').upsert({
          company_id: companyId,
          record_id: ledgerName,
          data: safeData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'company_id, record_id' });
      }
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Ledger Error]:', err?.message || err);
  }
}

export async function deleteLedgerFromSupabase(ledgerName: string, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cleanName = (ledgerName || '').trim();
  if (!cleanName) return;

  try {
    let res = await supabase
      .from('ledgers')
      .delete()
      .match({ company_id: companyId, record_id: cleanName });

    if (res.error && res.error.message.includes('relation')) {
      await supabase
        .from('Ledger')
        .delete()
        .match({ company_id: companyId, record_id: cleanName });
    }
  } catch (err: any) {
    console.warn('[Supabase Delete Ledger Error]:', err?.message || err);
  }
}

// ----------------------------------------------------------------------------
// SALES & PURCHASE INVOICE SYNC
// ----------------------------------------------------------------------------

export async function syncSalesInvoiceToSupabase(invoice: SalesInvoice, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured || !invoice) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const invNo = (invoice.invoiceNo || (invoice as any).billNo || '').trim();
  if (!invNo) return;

  const payload: Record<string, any> = {
    company_id: companyId,
    record_id: invNo,
    invoice_no: invNo,
    date: invoice.date || new Date().toISOString().slice(0, 10),
    customer_name: (invoice.customer?.name || invoice.customer?.ledger || 'Walk-in / Cash Customer').trim(),
    total_amount: Number(invoice.total) || 0,
    tax_amount: Number(invoice.gstAmt) || 0,
    payment_mode: invoice.cash ? 'Cash' : (invoice.bank1 || invoice.bank2) ? 'Bank' : 'Credit',
    status: invoice.status || 'Paid',
    data: invoice,
    updated_at: new Date().toISOString()
  };

  try {
    let res = await supabase.from('sales_invoices').upsert(payload, { onConflict: 'company_id, record_id' });
    if (res.error && (res.error.message.includes('column') || res.error.message.includes('schema'))) {
      await supabase.from('sales_invoices').upsert({
        company_id: companyId,
        record_id: invNo,
        data: invoice,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id, record_id' });
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Sales Invoice Error]:', err?.message || err);
  }
}

export async function deleteSalesInvoiceFromSupabase(invoiceNo: string, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cleanNo = (invoiceNo || '').trim();
  if (!cleanNo) return;

  try {
    await supabase
      .from('sales_invoices')
      .delete()
      .match({ company_id: companyId, record_id: cleanNo });
  } catch (err: any) {
    console.warn('[Supabase Delete Sales Invoice Error]:', err?.message || err);
  }
}

export async function syncPurchaseInvoiceToSupabase(purchase: PurchaseInvoice, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured || !purchase) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const billNo = (purchase.billNo || purchase.invoiceNo || '').trim();
  if (!billNo) return;

  const payload: Record<string, any> = {
    company_id: companyId,
    record_id: billNo,
    invoice_no: billNo,
    date: purchase.date || new Date().toISOString().slice(0, 10),
    supplier_name: (purchase.supplier?.name || purchase.supplier?.ledger || 'Standard Supplier').trim(),
    total_amount: Number(purchase.total) || 0,
    tax_amount: Number(purchase.gstAmt) || 0,
    status: purchase.status || 'Paid',
    data: purchase,
    updated_at: new Date().toISOString()
  };

  try {
    let res = await supabase.from('purchase_invoices').upsert(payload, { onConflict: 'company_id, record_id' });
    if (res.error && (res.error.message.includes('column') || res.error.message.includes('schema'))) {
      await supabase.from('purchase_invoices').upsert({
        company_id: companyId,
        record_id: billNo,
        data: purchase,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id, record_id' });
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Purchase Invoice Error]:', err?.message || err);
  }
}

export async function deletePurchaseInvoiceFromSupabase(billNo: string, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cleanNo = (billNo || '').trim();
  if (!cleanNo) return;

  try {
    await supabase
      .from('purchase_invoices')
      .delete()
      .match({ company_id: companyId, record_id: cleanNo });
  } catch (err: any) {
    console.warn('[Supabase Delete Purchase Invoice Error]:', err?.message || err);
  }
}

// ----------------------------------------------------------------------------
// FINANCIAL VOUCHER SYNC
// ----------------------------------------------------------------------------

export async function syncVoucherToSupabase(voucher: Voucher, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured || !voucher) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const vNo = (voucher.voucherNo || '').trim();
  if (!vNo) return;

  const payload: Record<string, any> = {
    company_id: companyId,
    record_id: vNo,
    voucher_no: vNo,
    date: voucher.date || new Date().toISOString().slice(0, 10),
    voucher_type: voucher.type || 'P',
    amount: Number(voucher.amount) || Number(voucher.totalAmount) || 0,
    data: voucher,
    updated_at: new Date().toISOString()
  };

  try {
    let res = await supabase.from('vouchers').upsert(payload, { onConflict: 'company_id, record_id' });
    if (res.error && (res.error.message.includes('column') || res.error.message.includes('schema'))) {
      await supabase.from('vouchers').upsert({
        company_id: companyId,
        record_id: vNo,
        data: voucher,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id, record_id' });
    }
  } catch (err: any) {
    console.warn('[Supabase Sync Voucher Error]:', err?.message || err);
  }
}

export async function deleteVoucherFromSupabase(voucherNo: string, targetCompanyId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const cleanNo = (voucherNo || '').trim();
  if (!cleanNo) return;

  try {
    await supabase
      .from('vouchers')
      .delete()
      .match({ company_id: companyId, record_id: cleanNo });
  } catch (err: any) {
    console.warn('[Supabase Delete Voucher Error]:', err?.message || err);
  }
}

// ----------------------------------------------------------------------------
// CONFIG / SETTINGS SYNC
// ----------------------------------------------------------------------------

export async function syncConfigToSupabase(config?: Config, targetCompanyId?: string): Promise<{ count: number }> {
  if (!isSupabaseConfigured) return { count: 1 };
  const companyId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const currentConfig = config || {};

  try {
    await supabase.from('tenant_settings').upsert({
      company_id: companyId,
      record_id: 'main_config',
      data: currentConfig,
      updated_at: new Date().toISOString()
    }, { onConflict: 'company_id, record_id' });
    return { count: 1 };
  } catch (err: any) {
    console.warn('[Supabase Sync Config Error]:', err?.message || err);
    return { count: 0 };
  }
}

// ----------------------------------------------------------------------------
// INITIAL SEED & AUTOMATIC BACKGROUND SYNC ORCHESTRATION
// ----------------------------------------------------------------------------

export async function seedInitialLocalDataToSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;

  try {
    // Check if remote items already exist
    const { data: remoteItems } = await supabase
      .from('items')
      .select('record_id')
      .eq('company_id', companyId)
      .limit(1);

    if (!remoteItems || remoteItems.length === 0) {
      const localItems = loadLocalArray<Item>(STORAGE_KEYS.ITEMS, companyId);
      if (localItems.length > 0) {
        console.log(`[SupabaseSync] Seeding ${localItems.length} local items to Supabase for tenant:`, companyId);
        await syncItemsBatchToSupabase(localItems, companyId);
      }
    }

    // Check if remote ledgers exist
    const { data: remoteLedgers } = await supabase
      .from('ledgers')
      .select('record_id')
      .eq('company_id', companyId)
      .limit(1);

    if (!remoteLedgers || remoteLedgers.length === 0) {
      const localLedgers = loadLocalArray<Ledger>(STORAGE_KEYS.LEDGERS, companyId);
      if (localLedgers.length > 0) {
        for (const l of localLedgers) {
          await syncLedgerToSupabase(l, companyId);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Supabase Seed Warning]:', err?.message || err);
  }
}

/**
 * Initializes Supabase real-time synchronization.
 * Pulls latest items, ledgers, vouchers, etc., for the active tenant, updates local storage,
 * and sets up real-time listener for remote changes.
 */
export function initSupabaseSync(onDataLoaded?: () => void): () => void {
  if (!isSupabaseConfigured) {
    updateStatus('offline', 'Supabase configuration credentials not found. Running in local offline mode.');
    return () => {};
  }

  let isSubscribed = true;
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;

  updateStatus('syncing', 'Syncing data with Supabase...');

  const pullTenantData = async () => {
    try {
      // 1. Pull Items
      const { data: sbItems, error: itErr } = await supabase
        .from('items')
        .select('data')
        .eq('company_id', companyId);

      if (!itErr && sbItems && sbItems.length > 0) {
        const loadedItems: Item[] = sbItems.map(row => row.data).filter(Boolean);
        if (loadedItems.length > 0) {
          saveLocalArray(STORAGE_KEYS.ITEMS, loadedItems, companyId);
        }
      } else {
        // If remote is empty, seed from local
        await seedInitialLocalDataToSupabase();
      }

      // 2. Pull Ledgers
      const { data: sbLedgers, error: lgErr } = await supabase
        .from('ledgers')
        .select('data')
        .eq('company_id', companyId);

      if (!lgErr && sbLedgers && sbLedgers.length > 0) {
        const loadedLedgers: Ledger[] = sbLedgers.map(row => row.data).filter(Boolean);
        if (loadedLedgers.length > 0) {
          saveLocalArray(STORAGE_KEYS.LEDGERS, loadedLedgers, companyId);
        }
      }

      // 3. Pull Vouchers
      const { data: sbVouchers, error: vchErr } = await supabase
        .from('vouchers')
        .select('data')
        .eq('company_id', companyId);

      if (!vchErr && sbVouchers && sbVouchers.length > 0) {
        const loadedVouchers: Voucher[] = sbVouchers.map(row => row.data).filter(Boolean);
        if (loadedVouchers.length > 0) {
          saveLocalArray(STORAGE_KEYS.VOUCHERS, loadedVouchers, companyId);
        }
      }

      // 4. Pull Sales Invoices
      const { data: sbSales, error: sErr } = await supabase
        .from('sales_invoices')
        .select('data')
        .eq('company_id', companyId);

      if (!sErr && sbSales && sbSales.length > 0) {
        const loadedSales: SalesInvoice[] = sbSales.map(row => row.data).filter(Boolean);
        if (loadedSales.length > 0) {
          saveLocalArray(STORAGE_KEYS.SALES_INVOICES, loadedSales, companyId);
        }
      }

      if (isSubscribed) {
        updateStatus('connected', 'Supabase Cloud Connected & Synced');
        onDataLoaded?.();
      }
    } catch (err: any) {
      console.warn('[Supabase Pull Error]:', err?.message || err);
      if (isSubscribed) {
        updateStatus('connected', 'Offline-First Cache Active');
        onDataLoaded?.();
      }
    }
  };

  pullTenantData();

  // Set up Supabase Realtime channel subscription for multi-terminal sync
  const channel = supabase
    .channel(`tenant-${companyId}-sync`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', filter: `company_id=eq.${companyId}` },
      (payload) => {
        console.log('[Supabase Realtime Event Received]:', payload.table, payload.eventType);
        pullTenantData();
      }
    )
    .subscribe();

  return () => {
    isSubscribed = false;
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------------------------------
// FULL COLLECTION BULK PUSH MAPPERS (For Master Cloud Sync)
// ----------------------------------------------------------------------------

export async function syncItemsToSupabase(items?: Item[]): Promise<{ count: number }> {
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const rawData = items ?? loadLocalArray<Item>(STORAGE_KEYS.ITEMS, companyId);
  await syncItemsBatchToSupabase(rawData, companyId);
  return { count: rawData.length };
}

export async function syncLedgersToSupabase(ledgers?: Ledger[]): Promise<{ count: number }> {
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const rawData = ledgers ?? loadLocalArray<Ledger>(STORAGE_KEYS.LEDGERS, companyId);
  for (const l of rawData) {
    await syncLedgerToSupabase(l, companyId);
  }
  return { count: rawData.length };
}

export async function syncSalesInvoicesToSupabase(sales?: SalesInvoice[]): Promise<{ count: number }> {
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const rawData = sales ?? loadLocalArray<SalesInvoice>(STORAGE_KEYS.SALES_INVOICES, companyId);
  for (const s of rawData) {
    await syncSalesInvoiceToSupabase(s, companyId);
  }
  return { count: rawData.length };
}

export async function syncPurchaseInvoicesToSupabase(purchases?: PurchaseInvoice[]): Promise<{ count: number }> {
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const rawData = purchases ?? loadLocalArray<PurchaseInvoice>(STORAGE_KEYS.PURCHASE_INVOICES, companyId);
  for (const p of rawData) {
    await syncPurchaseInvoiceToSupabase(p, companyId);
  }
  return { count: rawData.length };
}

export async function syncVouchersToSupabase(vouchers?: Voucher[]): Promise<{ count: number }> {
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const rawData = vouchers ?? loadLocalArray<Voucher>(STORAGE_KEYS.VOUCHERS, companyId);
  for (const v of rawData) {
    await syncVoucherToSupabase(v, companyId);
  }
  return { count: rawData.length };
}

// ----------------------------------------------------------------------------
// MASTER CLOUD SYNC ORCHESTRATOR
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

export async function handleMasterCloudSync(
  onProgress?: (step: string, percent: number) => void
): Promise<MasterSyncResult> {
  const startTime = Date.now();
  const companyId = getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;

  try {
    onProgress?.('Verifying Supabase connection...', 15);
    updateStatus('syncing', 'Running Master Cloud Sync with Supabase...');

    onProgress?.('Syncing company configuration...', 30);
    const configResult = await syncConfigToSupabase(undefined, companyId);

    onProgress?.('Syncing master chart of accounts & ledgers...', 45);
    const ledgersResult = await syncLedgersToSupabase();

    onProgress?.('Syncing master inventory items...', 65);
    const itemsResult = await syncItemsToSupabase();

    onProgress?.('Syncing sales & purchase invoices...', 80);
    const salesResult = await syncSalesInvoicesToSupabase();
    const purchasesResult = await syncPurchaseInvoicesToSupabase();

    onProgress?.('Syncing financial vouchers...', 95);
    const vouchersResult = await syncVouchersToSupabase();

    onProgress?.('Supabase Cloud Sync completed successfully!', 100);
    updateStatus('connected', 'Supabase Cloud Synced');

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
    updateStatus('error', error?.message || 'Sync failed');
    return {
      success: false,
      companyId,
      syncedCounts: { items: 0, ledgers: 0, salesInvoices: 0, purchaseInvoices: 0, vouchers: 0, config: 0 },
      durationMs: Date.now() - startTime,
      error: error?.message || 'Unknown synchronization failure'
    };
  }
}
