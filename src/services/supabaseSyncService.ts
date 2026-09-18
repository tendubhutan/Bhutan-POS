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
// Specific ERP Module Push Mappers with Protective NOT-NULL Safeguards
// ----------------------------------------------------------------------------

export async function syncItemsToSupabase(items?: Item[]) {
  const rawData = items ?? loadLocalArray<Item>(STORAGE_KEYS.ITEMS);
  const safeData = rawData.map((item, index) => {
    const itemCode = (item['Item Code'] || (item as any).code || (item as any).itemCode || `ITEM-${Date.now()}-${index + 1}`).trim();
    const itemName = (item['Item Name'] || (item as any).name || (item as any).itemName || itemCode || 'Unnamed Item Record').trim();
    const printName = (item['Print Name'] || itemName).trim();
    const group = (item.Group || (item as any).group || 'General').trim();
    const unit = (item.Unit || (item as any).unit || 'Pcs').trim();
    const barcode = (item.Barcode || (item as any).barcode || itemCode).trim();

    return {
      ...item,
      'Item Code': itemCode,
      'Item Name': itemName,
      'Print Name': printName,
      Group: group,
      Unit: unit,
      Barcode: barcode,
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
  });

  return pushCollectionToSupabase('items', safeData, (item) => item['Item Code']);
}

export async function syncLedgersToSupabase(ledgers?: Ledger[]) {
  const rawData = ledgers ?? loadLocalArray<Ledger>(STORAGE_KEYS.LEDGERS);
  const safeData = rawData.map((ledger, index) => {
    // Robust resolution of ledger name
    const ledgerName = (
      ledger['Ledger Name'] ||
      (ledger as any).name ||
      (ledger as any).ledgerName ||
      (ledger as any).ledger_name ||
      `Unnamed Ledger ${index + 1}`
    ).trim();

    const group = (
      ledger.Group ||
      (ledger as any).group ||
      (ledger as any).parentGroup ||
      (ledger as any).parent_group ||
      'Sundry Debtors'
    ).trim();

    return {
      ...ledger,
      'Ledger Name': ledgerName || 'Unnamed Ledger Record',
      Group: group || 'Sundry Debtors',
      'Opening Balance': Number(ledger['Opening Balance']) || 0,
      'Current Balance': Number(ledger['Current Balance']) || 0,
      'Balance Type (Dr/Cr)': ledger['Balance Type (Dr/Cr)'] === 'Cr' ? 'Cr' : 'Dr'
    };
  });

  return pushCollectionToSupabase('ledgers', safeData, (l) => l['Ledger Name']);
}

export async function syncSalesInvoicesToSupabase(sales?: SalesInvoice[]) {
  const rawData = sales ?? loadLocalArray<SalesInvoice>(STORAGE_KEYS.SALES_INVOICES);
  const safeData = rawData.map((inv, index) => {
    const invoiceNo = (inv.invoiceNo || (inv as any).billNo || `INV-${Date.now()}-${index + 1}`).trim();
    const date = inv.date || new Date().toISOString().slice(0, 10);
    const customer = inv.customer || {
      name: 'Walk-in / Cash Customer',
      ledger: 'Cash-in-Hand'
    };
    const customerName = (customer.name || customer.ledger || 'Walk-in / Cash Customer').trim();
    const customerLedger = (customer.ledger || customer.name || 'Cash-in-Hand').trim();

    return {
      ...inv,
      invoiceNo,
      date,
      customer: {
        ...customer,
        name: customerName,
        ledger: customerLedger
      },
      taxable: Number(inv.taxable) || 0,
      zeroRated: Number(inv.zeroRated) || 0,
      gstAmt: Number(inv.gstAmt) || 0,
      total: Number(inv.total) || 0,
      cash: Number(inv.cash) || 0,
      bank1: Number(inv.bank1) || 0,
      bank2: Number(inv.bank2) || 0,
      credit: Number(inv.credit) || 0,
      status: inv.status || 'Paid',
      items: Array.isArray(inv.items)
        ? inv.items.map((it, itemIdx) => {
            const itCode = (it['Item Code'] || (it as any).itemCode || `ITEM-${itemIdx + 1}`).trim();
            const itName = (it['Item Name'] || (it as any).itemName || itCode || 'Item Line').trim();
            return {
              ...it,
              'Item Code': itCode,
              'Item Name': itName,
              Qty: Number(it.Qty) || 1,
              Rate: Number(it.Rate) || 0,
              Discount: Number(it.Discount) || 0,
              'Taxable Value': Number(it['Taxable Value']) || 0,
              'GST %': Number(it['GST %']) || 0,
              'GST Amount': Number(it['GST Amount']) || 0,
              'Line Total': Number(it['Line Total']) || 0,
              'Zero Rated (Y/N)': it['Zero Rated (Y/N)'] === 'Y' ? 'Y' : 'N'
            };
          })
        : []
    };
  });

  return pushCollectionToSupabase('sales_invoices', safeData, (inv) => inv.invoiceNo);
}

export async function syncPurchaseInvoicesToSupabase(purchases?: PurchaseInvoice[]) {
  const rawData = purchases ?? loadLocalArray<PurchaseInvoice>(STORAGE_KEYS.PURCHASE_INVOICES);
  const safeData = rawData.map((p, index) => {
    const billNo = (p.billNo || p.invoiceNo || (p as any).supplierBillNo || `PUR-${Date.now()}-${index + 1}`).trim();
    const date = p.date || new Date().toISOString().slice(0, 10);
    const supplier = p.supplier || {
      name: 'Standard Supplier',
      ledger: 'Sundry Creditors'
    };
    const supplierName = (supplier.name || supplier.ledger || 'Standard Supplier').trim();
    const supplierLedger = (supplier.ledger || supplier.name || 'Sundry Creditors').trim();

    return {
      ...p,
      billNo,
      date,
      supplier: {
        ...supplier,
        name: supplierName,
        ledger: supplierLedger
      },
      taxable: Number(p.taxable) || 0,
      zeroRated: Number(p.zeroRated) || 0,
      gstAmt: Number(p.gstAmt) || 0,
      total: Number(p.total) || 0,
      cash: Number(p.cash) || 0,
      bank1: Number(p.bank1) || 0,
      bank2: Number(p.bank2) || 0,
      credit: Number(p.credit) || 0,
      status: p.status || 'Paid',
      items: Array.isArray(p.items)
        ? p.items.map((it, itemIdx) => {
            const itCode = (it['Item Code'] || (it as any).itemCode || `ITEM-${itemIdx + 1}`).trim();
            const itName = (it['Item Name'] || (it as any).itemName || itCode || 'Item Line').trim();
            return {
              ...it,
              'Item Code': itCode,
              'Item Name': itName,
              Qty: Number(it.Qty) || 1,
              Rate: Number(it.Rate) || 0,
              Discount: Number(it.Discount) || 0,
              'Taxable Value': Number(it['Taxable Value']) || 0,
              'GST %': Number(it['GST %']) || 0,
              'GST Amount': Number(it['GST Amount']) || 0,
              'Line Total': Number(it['Line Total']) || 0,
              'Zero Rated (Y/N)': it['Zero Rated (Y/N)'] === 'Y' ? 'Y' : 'N'
            };
          })
        : []
    };
  });

  return pushCollectionToSupabase('purchase_invoices', safeData, (p) => p.billNo);
}

export async function syncVouchersToSupabase(vouchers?: Voucher[]) {
  const rawData = vouchers ?? loadLocalArray<Voucher>(STORAGE_KEYS.VOUCHERS);
  const safeData = rawData.map((v, index) => {
    const voucherNo = (v.voucherNo || `VCH-${Date.now()}-${index + 1}`).trim();
    const date = v.date || new Date().toISOString().slice(0, 10);
    const type = v.type || 'P';
    const narration = (v.narration || `${v.voucherTypeName || type} Transaction`).trim();

    return {
      ...v,
      voucherNo,
      date,
      type,
      narration,
      amount: Number(v.amount) || Number(v.totalAmount) || 0,
      lines: Array.isArray(v.lines)
        ? v.lines.map((line) => ({
            ...line,
            ledger: (line.ledger || 'General Account').trim(),
            amount: Number(line.amount) || 0,
            type: line.type === 'Cr' ? 'Cr' : 'Dr'
          }))
        : []
    };
  });

  return pushCollectionToSupabase('vouchers', safeData, (v) => v.voucherNo);
}

export async function syncConfigToSupabase(config?: Config) {
  const currentConfig = config ?? loadLocalObject<Record<string, any>>(STORAGE_KEYS.CONFIG, {});
  const safeConfig = {
    CompanyName: 'Bhutan Retail Enterprise',
    CurrencySymbol: 'Nu.',
    ...currentConfig
  };
  return pushCollectionToSupabase('tenant_settings', [safeConfig], () => 'main_config');
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
