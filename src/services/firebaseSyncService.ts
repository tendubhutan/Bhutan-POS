import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  limit, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Config, 
  Item, 
  Ledger, 
  SalesInvoice, 
  PurchaseInvoice, 
  Voucher,
  AppUser 
} from '../types';
import { STORAGE_KEYS, saveJson, loadJson, getInitialData } from './storageService';
import { getActiveCompanyId, DEFAULT_TENANT_COMPANY } from './supabaseTenantService';

// Firestore sync status indicator callback
type StatusCallback = (status: 'connected' | 'syncing' | 'offline' | 'error', message?: string) => void;
let statusListeners: StatusCallback[] = [];
const activeSyncQueues = new Set<string>();
let isSeedingInProgress = false;

export function subscribeFirebaseStatus(cb: StatusCallback) {
  statusListeners.push(cb);
  return () => {
    statusListeners = statusListeners.filter(l => l !== cb);
  };
}

function notifyStatus(status: 'connected' | 'syncing' | 'offline' | 'error', message?: string) {
  statusListeners.forEach(cb => cb(status, message));
}

/**
 * Clean data object for Firestore (strip undefined values)
 */
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        res[key] = cleanObject(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

function getTenantDocRef(collName: string, docId: string, customCId?: string) {
  const cId = customCId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  return doc(db, 'tenants', cId, collName, docId);
}

function getTenantCollRef(collName: string, customCId?: string) {
  const cId = customCId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  return collection(db, 'tenants', cId, collName);
}

// ----------------------------------------------------
// Firestore Async Writes (Strictly Scoped by Tenant)
// ----------------------------------------------------

export async function syncConfigToFirestore(config: Config, customCId?: string) {
  try {
    notifyStatus('syncing', 'Saving settings to Firestore...');
    const cId = customCId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
    const ref = doc(db, 'tenants', cId, 'settings', 'config');
    await setDoc(ref, cleanObject(config), { merge: true });

    // If default demo company, also save to legacy root for backward compatibility
    if (cId === DEFAULT_TENANT_COMPANY.id) {
      await setDoc(doc(db, 'settings', 'config'), cleanObject(config), { merge: true }).catch(() => {});
    }

    notifyStatus('connected', 'Settings synced to Cloud Firestore');
  } catch (err: any) {
    console.warn('Firestore Config Sync Error:', err);
    notifyStatus('error', err?.message || 'Failed to sync config');
  }
}

export async function syncItemToFirestore(item: Item, customCId?: string) {
  try {
    const id = item['Item Code'] || item.Barcode;
    if (!id) return;
    const safeId = String(id).replace(/\//g, '_');
    const ref = getTenantDocRef('items', safeId, customCId);
    await setDoc(ref, cleanObject(item), { merge: true });
  } catch (err) {
    console.warn('Firestore Item Sync Error:', err);
  }
}

export async function syncItemsBatchToFirestore(items: Item[], customCId?: string) {
  if (!items || items.length === 0) return;
  try {
    notifyStatus('syncing', `Syncing ${items.length} item(s) to Cloud Firestore...`);
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const id = item['Item Code'] || item.Barcode;
        if (!id) continue;
        const safeId = String(id).replace(/\//g, '_');
        const ref = getTenantDocRef('items', safeId, customCId);
        batch.set(ref, cleanObject(item), { merge: true });
      }
      await batch.commit();
    }
    notifyStatus('connected', `${items.length} item(s) synced to Cloud Firestore`);
  } catch (err: any) {
    console.warn('Firestore Bulk Item Sync Error:', err);
    notifyStatus('error', err?.message || 'Failed to sync items to cloud');
  }
}

export async function syncLedgersBatchToFirestore(ledgers: Ledger[], customCId?: string) {
  if (!ledgers || ledgers.length === 0) return;
  try {
    const chunkSize = 300;
    for (let i = 0; i < ledgers.length; i += chunkSize) {
      const chunk = ledgers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const ledger of chunk) {
        const id = ledger['Ledger Name'];
        if (!id) continue;
        const safeId = id.replace(/\//g, '_');
        const ref = getTenantDocRef('ledgers', safeId, customCId);
        batch.set(ref, cleanObject(ledger), { merge: true });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('Firestore Bulk Ledger Sync Error:', err);
  }
}

export async function syncSalesInvoicesBatchToFirestore(sales: SalesInvoice[], customCId?: string) {
  if (!sales || sales.length === 0) return;
  try {
    const chunkSize = 300;
    for (let i = 0; i < sales.length; i += chunkSize) {
      const chunk = sales.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const s of chunk) {
        const id = s.invoiceNo;
        if (!id) continue;
        const safeId = id.replace(/\//g, '_');
        const ref = getTenantDocRef('sales_invoices', safeId, customCId);
        batch.set(ref, cleanObject(s), { merge: true });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('Firestore Bulk Sales Sync Error:', err);
  }
}

export async function syncPurchaseInvoicesBatchToFirestore(purchases: PurchaseInvoice[], customCId?: string) {
  if (!purchases || purchases.length === 0) return;
  try {
    const chunkSize = 300;
    for (let i = 0; i < purchases.length; i += chunkSize) {
      const chunk = purchases.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const p of chunk) {
        const id = p.billNo;
        if (!id) continue;
        const safeId = id.replace(/\//g, '_');
        const ref = getTenantDocRef('purchase_invoices', safeId, customCId);
        batch.set(ref, cleanObject(p), { merge: true });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('Firestore Bulk Purchase Sync Error:', err);
  }
}

export async function syncVouchersBatchToFirestore(vouchers: Voucher[], customCId?: string) {
  if (!vouchers || vouchers.length === 0) return;
  try {
    const chunkSize = 300;
    for (let i = 0; i < vouchers.length; i += chunkSize) {
      const chunk = vouchers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const v of chunk) {
        const id = v.voucherNo;
        if (!id) continue;
        const safeId = id.replace(/\//g, '_');
        const ref = getTenantDocRef('vouchers', safeId, customCId);
        batch.set(ref, cleanObject(v), { merge: true });
      }
      await batch.commit();
    }
  } catch (err: any) {
    console.warn('Firestore Bulk Voucher Sync Error:', err);
  }
}

export async function deleteItemFromFirestore(itemCode: string, customCId?: string) {
  try {
    const safeId = String(itemCode).replace(/\//g, '_');
    const ref = getTenantDocRef('items', safeId, customCId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Item Error:', err);
  }
}

export async function deleteLedgerFromFirestore(ledgerName: string, customCId?: string) {
  try {
    const safeId = String(ledgerName).replace(/\//g, '_');
    const ref = getTenantDocRef('ledgers', safeId, customCId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Ledger Error:', err);
  }
}

export async function syncLedgerToFirestore(ledger: Ledger, customCId?: string) {
  try {
    const id = ledger['Ledger Name'];
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = getTenantDocRef('ledgers', safeId, customCId);
    await setDoc(ref, cleanObject(ledger), { merge: true });
  } catch (err) {
    console.warn('Firestore Ledger Sync Error:', err);
  }
}

export async function syncSalesInvoiceToFirestore(invoice: SalesInvoice, customCId?: string) {
  try {
    const id = invoice.invoiceNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = getTenantDocRef('sales_invoices', safeId, customCId);
    await setDoc(ref, cleanObject(invoice), { merge: true });
  } catch (err) {
    console.warn('Firestore Sales Invoice Sync Error:', err);
  }
}

export async function syncPurchaseInvoiceToFirestore(invoice: PurchaseInvoice, customCId?: string) {
  try {
    const id = invoice.billNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = getTenantDocRef('purchase_invoices', safeId, customCId);
    await setDoc(ref, cleanObject(invoice), { merge: true });
  } catch (err) {
    console.warn('Firestore Purchase Invoice Sync Error:', err);
  }
}

export async function deleteSalesInvoiceFromFirestore(invoiceNo: string, customCId?: string) {
  try {
    const safeId = String(invoiceNo).replace(/\//g, '_');
    const ref = getTenantDocRef('sales_invoices', safeId, customCId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Sales Invoice Error:', err);
  }
}

export async function deletePurchaseInvoiceFromFirestore(billNo: string, customCId?: string) {
  try {
    const safeId = String(billNo).replace(/\//g, '_');
    const ref = getTenantDocRef('purchase_invoices', safeId, customCId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Purchase Invoice Error:', err);
  }
}

export async function deleteVoucherFromFirestore(voucherNo: string, customCId?: string) {
  try {
    const safeId = String(voucherNo).replace(/\//g, '_');
    const ref = getTenantDocRef('vouchers', safeId, customCId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Voucher Error:', err);
  }
}

export async function syncVoucherToFirestore(voucher: Voucher, customCId?: string) {
  try {
    const id = voucher.voucherNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = getTenantDocRef('vouchers', safeId, customCId);
    await setDoc(ref, cleanObject(voucher), { merge: true });
  } catch (err) {
    console.warn('Firestore Voucher Sync Error:', err);
  }
}

// ----------------------------------------------------
// Real-time Firestore Listeners & Initial Load (Isolated by Tenant)
// ----------------------------------------------------

export function initFirestoreSync(onDataUpdated?: () => void, targetCompanyId?: string) {
  notifyStatus('syncing', 'Connecting to Firestore...');

  const cId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;
  const isDemo = cId === DEFAULT_TENANT_COMPANY.id;
  let unsubscribes: (() => void)[] = [];

  try {
    // 1. Config listener
    const configRef = doc(db, 'tenants', cId, 'settings', 'config');
    const unsubConfig = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteConfig = snapshot.data() as Config;
        const localConfig = loadJson<Config>(STORAGE_KEYS.CONFIG, {} as Config, cId);
        saveJson(STORAGE_KEYS.CONFIG, { ...localConfig, ...remoteConfig }, cId);
        if (onDataUpdated) onDataUpdated();
      }
      notifyStatus('connected', 'Cloud Firestore Active');
    }, (err) => {
      console.warn('Firestore Listener Error (Config):', err);
      notifyStatus('error', 'Firestore connection issue');
    });
    unsubscribes.push(unsubConfig);

    // 2. Items listener with non-destructive local merge
    const itemsRef = collection(db, 'tenants', cId, 'items');
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
      // If snapshot is empty for a non-demo company, enforce clean blank items list!
      if (snapshot.empty && !isDemo) {
        const currentLocal = loadJson<Item[]>(STORAGE_KEYS.ITEMS, [], cId);
        if (currentLocal.length > 0) {
          saveJson(STORAGE_KEYS.ITEMS, [], cId);
          if (onDataUpdated) onDataUpdated();
        }
        return;
      }

      const remoteItems: Item[] = [];
      snapshot.forEach(docSnap => {
        remoteItems.push(docSnap.data() as Item);
      });

      const localItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, [], cId);
      const deletedItems = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, [], cId).map(c => (c || '').trim().toLowerCase())
      );

      // Build map of remote items (excluding locally deleted items)
      const mergedMap = new Map<string, Item>();
      remoteItems.forEach(item => {
        const code = (item['Item Code'] || item.Barcode || '').trim().toLowerCase();
        if (code && !deletedItems.has(code)) {
          mergedMap.set(code, item);
        }
      });

      // Preserve any locally added/imported items that haven't synced to Firestore yet
      const unsyncedItems: Item[] = [];
      localItems.forEach(localItem => {
        const code = (localItem['Item Code'] || localItem.Barcode || '').trim().toLowerCase();
        if (code && !deletedItems.has(code) && !mergedMap.has(code)) {
          mergedMap.set(code, localItem);
          unsyncedItems.push(localItem);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      if (mergedList.length > 0 || isDemo) {
        saveJson(STORAGE_KEYS.ITEMS, mergedList, cId);
        if (onDataUpdated) onDataUpdated();
      }

      // Automatically push any unsynced local items to Firestore via debounced batch
      if (unsyncedItems.length > 0) {
        const queueKey = `items_${cId}`;
        if (!activeSyncQueues.has(queueKey)) {
          activeSyncQueues.add(queueKey);
          setTimeout(() => {
            syncItemsBatchToFirestore(unsyncedItems, cId)
              .catch(e => console.warn('Auto-sync unsynced local items to cloud error:', e))
              .finally(() => activeSyncQueues.delete(queueKey));
          }, 1000);
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Items):', err);
    });
    unsubscribes.push(unsubItems);

    // 3. Ledgers listener with non-destructive local merge
    const ledgersRef = collection(db, 'tenants', cId, 'ledgers');
    const unsubLedgers = onSnapshot(ledgersRef, (snapshot) => {
      if (snapshot.empty && !isDemo) {
        return;
      }

      const remoteLedgers: Ledger[] = [];
      snapshot.forEach(docSnap => {
        remoteLedgers.push(docSnap.data() as Ledger);
      });

      const localLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, [], cId);
      const deletedLedgers = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_LEDGERS, [], cId).map(d => (d || '').trim().toLowerCase())
      );

      const mergedMap = new Map<string, Ledger>();
      remoteLedgers.forEach(l => {
        const name = (l['Ledger Name'] || '').trim().toLowerCase();
        if (name && !deletedLedgers.has(name)) {
          mergedMap.set(name, l);
        }
      });

      const unsyncedLedgers: Ledger[] = [];
      localLedgers.forEach(l => {
        const name = (l['Ledger Name'] || '').trim().toLowerCase();
        if (name && !deletedLedgers.has(name) && !mergedMap.has(name)) {
          mergedMap.set(name, l);
          unsyncedLedgers.push(l);
        }
      });

      const mergedList = Array.from(mergedMap.values());
      if (mergedList.length > 0) {
        saveJson(STORAGE_KEYS.LEDGERS, mergedList, cId);
        if (onDataUpdated) onDataUpdated();
      }

      if (unsyncedLedgers.length > 0) {
        const queueKey = `ledgers_${cId}`;
        if (!activeSyncQueues.has(queueKey)) {
          activeSyncQueues.add(queueKey);
          setTimeout(() => {
            syncLedgersBatchToFirestore(unsyncedLedgers, cId)
              .catch(e => console.warn('Auto-sync unsynced ledgers error:', e))
              .finally(() => activeSyncQueues.delete(queueKey));
          }, 1000);
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Ledgers):', err);
    });
    unsubscribes.push(unsubLedgers);

    // 4. Sales Invoices listener (Isolated by Tenant)
    const salesRef = collection(db, 'tenants', cId, 'sales_invoices');
    const unsubSales = onSnapshot(salesRef, (snapshot) => {
      if (snapshot.empty && !isDemo) {
        // Client company has 0 sales in Firestore. Enforce clean 0 sales!
        const currentLocal = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], cId);
        if (currentLocal.length > 0) {
          saveJson(STORAGE_KEYS.SALES_INVOICES, [], cId);
          if (onDataUpdated) onDataUpdated();
        }
        return;
      }

      const remoteSales: SalesInvoice[] = [];
      snapshot.forEach(docSnap => {
        remoteSales.push(docSnap.data() as SalesInvoice);
      });

      const localSales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, [], cId);
      const deletedSales = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_SALES_INVOICES, [], cId).map(s => (s || '').trim().toLowerCase())
      );
      const salesMap = new Map<string, SalesInvoice>();
      remoteSales.forEach(s => {
        const id = (s.invoiceNo || '').trim().toLowerCase();
        if (id && !deletedSales.has(id)) salesMap.set(id, s);
      });

      const unsyncedSales: SalesInvoice[] = [];
      localSales.forEach(s => {
        const id = (s.invoiceNo || '').trim().toLowerCase();
        if (id && !deletedSales.has(id) && !salesMap.has(id)) {
          salesMap.set(id, s);
          unsyncedSales.push(s);
        }
      });

      const mergedSales = Array.from(salesMap.values());
      if (mergedSales.length > 0 || isDemo) {
        saveJson(STORAGE_KEYS.SALES_INVOICES, mergedSales, cId);
        if (onDataUpdated) onDataUpdated();
      }

      if (unsyncedSales.length > 0) {
        const queueKey = `sales_${cId}`;
        if (!activeSyncQueues.has(queueKey)) {
          activeSyncQueues.add(queueKey);
          setTimeout(() => {
            syncSalesInvoicesBatchToFirestore(unsyncedSales, cId)
              .catch(e => console.warn('Auto-sync unsynced sales error:', e))
              .finally(() => activeSyncQueues.delete(queueKey));
          }, 1000);
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Sales):', err);
    });
    unsubscribes.push(unsubSales);

    // 5. Purchase Invoices listener (Isolated by Tenant)
    const purchaseRef = collection(db, 'tenants', cId, 'purchase_invoices');
    const unsubPurchase = onSnapshot(purchaseRef, (snapshot) => {
      if (snapshot.empty && !isDemo) {
        const currentLocal = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], cId);
        if (currentLocal.length > 0) {
          saveJson(STORAGE_KEYS.PURCHASE_INVOICES, [], cId);
          if (onDataUpdated) onDataUpdated();
        }
        return;
      }

      const remotePurchases: PurchaseInvoice[] = [];
      snapshot.forEach(docSnap => {
        remotePurchases.push(docSnap.data() as PurchaseInvoice);
      });

      const localPurchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, [], cId);
      const deletedPurchases = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_PURCHASE_INVOICES, [], cId).map(p => (p || '').trim().toLowerCase())
      );
      const purchaseMap = new Map<string, PurchaseInvoice>();
      remotePurchases.forEach(p => {
        const id = (p.billNo || '').trim().toLowerCase();
        if (id && !deletedPurchases.has(id)) purchaseMap.set(id, p);
      });

      const unsyncedPurchases: PurchaseInvoice[] = [];
      localPurchases.forEach(p => {
        const id = (p.billNo || '').trim().toLowerCase();
        if (id && !deletedPurchases.has(id) && !purchaseMap.has(id)) {
          purchaseMap.set(id, p);
          unsyncedPurchases.push(p);
        }
      });

      const mergedPurchases = Array.from(purchaseMap.values());
      if (mergedPurchases.length > 0 || isDemo) {
        saveJson(STORAGE_KEYS.PURCHASE_INVOICES, mergedPurchases, cId);
        if (onDataUpdated) onDataUpdated();
      }

      if (unsyncedPurchases.length > 0) {
        const queueKey = `purchases_${cId}`;
        if (!activeSyncQueues.has(queueKey)) {
          activeSyncQueues.add(queueKey);
          setTimeout(() => {
            syncPurchaseInvoicesBatchToFirestore(unsyncedPurchases, cId)
              .catch(e => console.warn('Auto-sync unsynced purchases error:', e))
              .finally(() => activeSyncQueues.delete(queueKey));
          }, 1000);
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Purchases):', err);
    });
    unsubscribes.push(unsubPurchase);

    // 6. Vouchers listener (Isolated by Tenant)
    const vouchersRef = collection(db, 'tenants', cId, 'vouchers');
    const unsubVouchers = onSnapshot(vouchersRef, (snapshot) => {
      if (snapshot.empty && !isDemo) {
        // Client company has 0 vouchers in Firestore. Enforce clean 0 vouchers!
        const currentLocal = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], cId);
        if (currentLocal.length > 0) {
          saveJson(STORAGE_KEYS.VOUCHERS, [], cId);
          if (onDataUpdated) onDataUpdated();
        }
        return;
      }

      const remoteVouchers: Voucher[] = [];
      snapshot.forEach(docSnap => {
        remoteVouchers.push(docSnap.data() as Voucher);
      });

      const localVouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, [], cId);
      const deletedVouchers = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_VOUCHERS, [], cId).map(v => (v || '').trim().toLowerCase())
      );
      const voucherMap = new Map<string, Voucher>();
      remoteVouchers.forEach(v => {
        const id = (v.voucherNo || '').trim().toLowerCase();
        // For demo company, always keep remote vouchers intact
        if (id && (!isDemo ? !deletedVouchers.has(id) : true)) {
          voucherMap.set(id, v);
        }
      });

      const unsyncedVouchers: Voucher[] = [];
      localVouchers.forEach(v => {
        const id = (v.voucherNo || '').trim().toLowerCase();
        if (id && !deletedVouchers.has(id) && !voucherMap.has(id)) {
          voucherMap.set(id, v);
          unsyncedVouchers.push(v);
        }
      });

      const mergedVouchers = Array.from(voucherMap.values());
      // Save directly with explicit cId
      saveJson(STORAGE_KEYS.VOUCHERS, mergedVouchers, cId);
      
      if (onDataUpdated) onDataUpdated();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:vouchers_updated', { detail: { vouchers: mergedVouchers, companyId: cId } }));
      }

      if (unsyncedVouchers.length > 0) {
        const queueKey = `vouchers_${cId}`;
        if (!activeSyncQueues.has(queueKey)) {
          activeSyncQueues.add(queueKey);
          setTimeout(() => {
            syncVouchersBatchToFirestore(unsyncedVouchers, cId)
              .catch(e => console.warn('Auto-sync unsynced vouchers error:', e))
              .finally(() => activeSyncQueues.delete(queueKey));
          }, 1000);
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Vouchers):', err);
    });
    unsubscribes.push(unsubVouchers);

    // 7. Users listener (Isolated by Tenant)
    const usersRef = collection(db, 'tenants', cId, 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      if (!snapshot.empty) {
        const remoteUsers: AppUser[] = [];
        snapshot.forEach(docSnap => {
          remoteUsers.push(docSnap.data() as AppUser);
        });
        if (remoteUsers.length > 0) {
          saveJson(STORAGE_KEYS.USERS, remoteUsers, cId);
          if (onDataUpdated) onDataUpdated();
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Users):', err);
    });
    unsubscribes.push(unsubUsers);

  } catch (err: any) {
    console.error('Failed to initialize FirestoreListeners:', err);
    notifyStatus('error', err?.message || 'Failed to initialize Firestore');
  }

  return () => {
    unsubscribes.forEach(u => u());
  };
}

/**
 * Bulk upload local data to Firestore if Firestore is empty on first setup.
 * CRITICAL: Only seeds demo company data for DEFAULT_TENANT_COMPANY.
 * New client companies remain strictly clean and blank!
 */
export async function seedInitialLocalDataToFirestore(targetCompanyId?: string) {
  if (isSeedingInProgress) return;
  isSeedingInProgress = true;

  try {
    const cId = targetCompanyId || getActiveCompanyId() || DEFAULT_TENANT_COMPANY.id;

    // NEVER seed demo items, demo sales, or demo vouchers into a client company!
    if (cId !== DEFAULT_TENANT_COMPANY.id) {
      return;
    }

    const itemsRef = collection(db, 'tenants', cId, 'items');
    const existingSnap = await getDocs(query(itemsRef, limit(1)));
    if (existingSnap.empty) {
      notifyStatus('syncing', 'Seeding demo data to Cloud Firestore...');

      const initial = getInitialData();

      if (initial.config) {
        await syncConfigToFirestore(initial.config, cId);
      }

      if (initial.items && initial.items.length > 0) {
        await syncItemsBatchToFirestore(initial.items, cId);
      }

      if (initial.ledgers && initial.ledgers.length > 0) {
        await syncLedgersBatchToFirestore(initial.ledgers, cId);
      }

      const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
      if (sales && sales.length > 0) {
        await syncSalesInvoicesBatchToFirestore(sales, cId);
      }

      const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
      if (purchases && purchases.length > 0) {
        await syncPurchaseInvoicesBatchToFirestore(purchases, cId);
      }

      const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
      if (vouchers && vouchers.length > 0) {
        await syncVouchersBatchToFirestore(vouchers, cId);
      }

      notifyStatus('connected', 'Database synced to Cloud Firestore');
    } else {
      // Reconcile: Ensure any local items that exist in localStorage but missing in Firestore are safely synced
      const localItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, []);
      const deletedItems = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []).map(c => (c || '').trim().toLowerCase())
      );
      if (localItems.length > 0) {
        const allRemoteDocs = await getDocs(collection(db, 'tenants', cId, 'items'));
        const remoteCodes = new Set<string>();
        allRemoteDocs.forEach(d => {
          const itm = d.data() as Item;
          const c = (itm['Item Code'] || itm.Barcode || d.id || '').trim().toLowerCase();
          if (c) remoteCodes.add(c);
        });

        const missingInFirestore = localItems.filter(item => {
          const code = (item['Item Code'] || item.Barcode || '').trim().toLowerCase();
          return code && !remoteCodes.has(code) && !deletedItems.has(code);
        });

        if (missingInFirestore.length > 0) {
          await syncItemsBatchToFirestore(missingInFirestore, cId);
        }
      }
      notifyStatus('connected', 'Cloud Firestore Active');
    }
  } catch (err: any) {
    console.warn('Seed/Reconcile Error:', err);
    notifyStatus('error', 'Sync reconciliation issue');
  } finally {
    isSeedingInProgress = false;
  }
}
