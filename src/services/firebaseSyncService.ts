import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
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
  AppUser, 
  Employee 
} from '../types';
import { STORAGE_KEYS, saveJson, loadJson, getInitialData } from './storageService';

// Firestore sync status indicator callback
type StatusCallback = (status: 'connected' | 'syncing' | 'offline' | 'error', message?: string) => void;
let statusListeners: StatusCallback[] = [];

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

// ----------------------------------------------------
// Firestore Async Writes
// ----------------------------------------------------

export async function syncConfigToFirestore(config: Config) {
  try {
    notifyStatus('syncing', 'Saving settings to Firestore...');
    const ref = doc(db, 'settings', 'config');
    await setDoc(ref, cleanObject(config), { merge: true });
    notifyStatus('connected', 'Settings synced to Cloud Firestore');
  } catch (err: any) {
    console.warn('Firestore Config Sync Error:', err);
    notifyStatus('error', err?.message || 'Failed to sync config');
  }
}

export async function syncItemToFirestore(item: Item) {
  try {
    const id = item['Item Code'] || item.Barcode;
    if (!id) return;
    const safeId = String(id).replace(/\//g, '_');
    const ref = doc(db, 'items', safeId);
    await setDoc(ref, cleanObject(item), { merge: true });
  } catch (err) {
    console.warn('Firestore Item Sync Error:', err);
  }
}

export async function syncItemsBatchToFirestore(items: Item[]) {
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
        const ref = doc(db, 'items', safeId);
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

export async function deleteItemFromFirestore(itemCode: string) {
  try {
    const safeId = String(itemCode).replace(/\//g, '_');
    const ref = doc(db, 'items', safeId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Item Error:', err);
  }
}

export async function deleteLedgerFromFirestore(ledgerName: string) {
  try {
    const safeId = String(ledgerName).replace(/\//g, '_');
    const ref = doc(db, 'ledgers', safeId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Firestore Delete Ledger Error:', err);
  }
}

export async function syncLedgerToFirestore(ledger: Ledger) {
  try {
    const id = ledger['Ledger Name'];
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = doc(db, 'ledgers', safeId);
    await setDoc(ref, cleanObject(ledger), { merge: true });
  } catch (err) {
    console.warn('Firestore Ledger Sync Error:', err);
  }
}

export async function syncSalesInvoiceToFirestore(invoice: SalesInvoice) {
  try {
    const id = invoice.invoiceNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = doc(db, 'sales_invoices', safeId);
    await setDoc(ref, cleanObject(invoice), { merge: true });
  } catch (err) {
    console.warn('Firestore Sales Invoice Sync Error:', err);
  }
}

export async function syncPurchaseInvoiceToFirestore(invoice: PurchaseInvoice) {
  try {
    const id = invoice.billNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = doc(db, 'purchase_invoices', safeId);
    await setDoc(ref, cleanObject(invoice), { merge: true });
  } catch (err) {
    console.warn('Firestore Purchase Invoice Sync Error:', err);
  }
}

export async function syncVoucherToFirestore(voucher: Voucher) {
  try {
    const id = voucher.voucherNo;
    if (!id) return;
    const safeId = id.replace(/\//g, '_');
    const ref = doc(db, 'vouchers', safeId);
    await setDoc(ref, cleanObject(voucher), { merge: true });
  } catch (err) {
    console.warn('Firestore Voucher Sync Error:', err);
  }
}

// ----------------------------------------------------
// Real-time Firestore Listeners & Initial Load
// ----------------------------------------------------

export function initFirestoreSync(onDataUpdated?: () => void) {
  notifyStatus('syncing', 'Connecting to Firestore...');

  let unsubscribes: (() => void)[] = [];

  try {
    // 1. Config listener
    const configRef = doc(db, 'settings', 'config');
    const unsubConfig = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteConfig = snapshot.data() as Config;
        const localConfig = loadJson<Config>(STORAGE_KEYS.CONFIG, {} as Config);
        saveJson(STORAGE_KEYS.CONFIG, { ...localConfig, ...remoteConfig });
        if (onDataUpdated) onDataUpdated();
      }
      notifyStatus('connected', 'Cloud Firestore Active');
    }, (err) => {
      console.warn('Firestore Listener Error (Config):', err);
      notifyStatus('error', 'Firestore connection issue');
    });
    unsubscribes.push(unsubConfig);

    // 2. Items listener with non-destructive local merge
    const itemsRef = collection(db, 'items');
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
      const remoteItems: Item[] = [];
      snapshot.forEach(docSnap => {
        remoteItems.push(docSnap.data() as Item);
      });

      const localItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, []);
      const deletedItems = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []).map(c => (c || '').trim().toLowerCase())
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
      if (mergedList.length > 0) {
        saveJson(STORAGE_KEYS.ITEMS, mergedList);
        if (onDataUpdated) onDataUpdated();
      }

      // Automatically push any unsynced local items to Firestore so they are never lost
      if (unsyncedItems.length > 0) {
        syncItemsBatchToFirestore(unsyncedItems).catch(e => {
          console.warn('Auto-sync unsynced local items to cloud:', e);
        });
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Items):', err);
    });
    unsubscribes.push(unsubItems);

    // 3. Ledgers listener with non-destructive local merge
    const ledgersRef = collection(db, 'ledgers');
    const unsubLedgers = onSnapshot(ledgersRef, (snapshot) => {
      const remoteLedgers: Ledger[] = [];
      snapshot.forEach(docSnap => {
        remoteLedgers.push(docSnap.data() as Ledger);
      });

      const localLedgers = loadJson<Ledger[]>(STORAGE_KEYS.LEDGERS, []);
      const deletedLedgers = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_LEDGERS, []).map(d => (d || '').trim().toLowerCase())
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
        saveJson(STORAGE_KEYS.LEDGERS, mergedList);
        if (onDataUpdated) onDataUpdated();
      }

      if (unsyncedLedgers.length > 0) {
        for (const l of unsyncedLedgers) {
          syncLedgerToFirestore(l).catch(() => {});
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Ledgers):', err);
    });
    unsubscribes.push(unsubLedgers);

    // 4. Sales Invoices listener with non-destructive local merge
    const salesRef = collection(db, 'sales_invoices');
    const unsubSales = onSnapshot(salesRef, (snapshot) => {
      if (!snapshot.empty) {
        const remoteSales: SalesInvoice[] = [];
        snapshot.forEach(docSnap => {
          remoteSales.push(docSnap.data() as SalesInvoice);
        });

        const localSales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
        const salesMap = new Map<string, SalesInvoice>();
        remoteSales.forEach(s => {
          const id = (s.invoiceNo || '').trim().toLowerCase();
          if (id) salesMap.set(id, s);
        });

        const unsyncedSales: SalesInvoice[] = [];
        localSales.forEach(s => {
          const id = (s.invoiceNo || '').trim().toLowerCase();
          if (id && !salesMap.has(id)) {
            salesMap.set(id, s);
            unsyncedSales.push(s);
          }
        });

        const mergedSales = Array.from(salesMap.values());
        if (mergedSales.length > 0) {
          saveJson(STORAGE_KEYS.SALES_INVOICES, mergedSales);
          if (onDataUpdated) onDataUpdated();
        }

        if (unsyncedSales.length > 0) {
          for (const s of unsyncedSales) {
            syncSalesInvoiceToFirestore(s).catch(() => {});
          }
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Sales):', err);
    });
    unsubscribes.push(unsubSales);

    // 5. Purchase Invoices listener with non-destructive local merge
    const purchaseRef = collection(db, 'purchase_invoices');
    const unsubPurchase = onSnapshot(purchaseRef, (snapshot) => {
      if (!snapshot.empty) {
        const remotePurchases: PurchaseInvoice[] = [];
        snapshot.forEach(docSnap => {
          remotePurchases.push(docSnap.data() as PurchaseInvoice);
        });

        const localPurchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
        const purchaseMap = new Map<string, PurchaseInvoice>();
        remotePurchases.forEach(p => {
          const id = (p.billNo || '').trim().toLowerCase();
          if (id) purchaseMap.set(id, p);
        });

        const unsyncedPurchases: PurchaseInvoice[] = [];
        localPurchases.forEach(p => {
          const id = (p.billNo || '').trim().toLowerCase();
          if (id && !purchaseMap.has(id)) {
            purchaseMap.set(id, p);
            unsyncedPurchases.push(p);
          }
        });

        const mergedPurchases = Array.from(purchaseMap.values());
        if (mergedPurchases.length > 0) {
          saveJson(STORAGE_KEYS.PURCHASE_INVOICES, mergedPurchases);
          if (onDataUpdated) onDataUpdated();
        }

        if (unsyncedPurchases.length > 0) {
          for (const p of unsyncedPurchases) {
            syncPurchaseInvoiceToFirestore(p).catch(() => {});
          }
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Purchases):', err);
    });
    unsubscribes.push(unsubPurchase);

    // 6. Vouchers listener with non-destructive local merge
    const vouchersRef = collection(db, 'vouchers');
    const unsubVouchers = onSnapshot(vouchersRef, (snapshot) => {
      if (!snapshot.empty) {
        const remoteVouchers: Voucher[] = [];
        snapshot.forEach(docSnap => {
          remoteVouchers.push(docSnap.data() as Voucher);
        });

        const localVouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
        const voucherMap = new Map<string, Voucher>();
        remoteVouchers.forEach(v => {
          const id = (v.voucherNo || '').trim().toLowerCase();
          if (id) voucherMap.set(id, v);
        });

        const unsyncedVouchers: Voucher[] = [];
        localVouchers.forEach(v => {
          const id = (v.voucherNo || '').trim().toLowerCase();
          if (id && !voucherMap.has(id)) {
            voucherMap.set(id, v);
            unsyncedVouchers.push(v);
          }
        });

        const mergedVouchers = Array.from(voucherMap.values());
        if (mergedVouchers.length > 0) {
          saveJson(STORAGE_KEYS.VOUCHERS, mergedVouchers);
          if (onDataUpdated) onDataUpdated();
        }

        if (unsyncedVouchers.length > 0) {
          for (const v of unsyncedVouchers) {
            syncVoucherToFirestore(v).catch(() => {});
          }
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Vouchers):', err);
    });
    unsubscribes.push(unsubVouchers);

  } catch (err: any) {
    console.error('Failed to initialize FirestoreListeners:', err);
    notifyStatus('error', err?.message || 'Failed to initialize Firestore');
  }

  return () => {
    unsubscribes.forEach(u => u());
  };
}

/**
 * Bulk upload local data to Firestore if Firestore is empty on first setup,
 * or reconcile any missing local items/ledgers with Firestore.
 */
export async function seedInitialLocalDataToFirestore() {
  try {
    const itemsRef = collection(db, 'items');
    const existingSnap = await getDocs(query(itemsRef, limit(1)));
    if (existingSnap.empty) {
      notifyStatus('syncing', 'Seeding initial data to Cloud Firestore...');

      const initial = getInitialData();

      if (initial.config) {
        await syncConfigToFirestore(initial.config);
      }

      if (initial.items && initial.items.length > 0) {
        await syncItemsBatchToFirestore(initial.items);
      }

      if (initial.ledgers && initial.ledgers.length > 0) {
        for (const ledger of initial.ledgers) {
          await syncLedgerToFirestore(ledger);
        }
      }

      const sales = loadJson<SalesInvoice[]>(STORAGE_KEYS.SALES_INVOICES, []);
      for (const s of sales) {
        await syncSalesInvoiceToFirestore(s);
      }

      const purchases = loadJson<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, []);
      for (const p of purchases) {
        await syncPurchaseInvoiceToFirestore(p);
      }

      const vouchers = loadJson<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
      for (const v of vouchers) {
        await syncVoucherToFirestore(v);
      }

      notifyStatus('connected', 'Database synced to Cloud Firestore');
    } else {
      // Reconcile: Ensure any local items that exist in localStorage but missing in Firestore are safely synced
      const localItems = loadJson<Item[]>(STORAGE_KEYS.ITEMS, []);
      const deletedItems = new Set(
        loadJson<string[]>(STORAGE_KEYS.DELETED_ITEMS, []).map(c => (c || '').trim().toLowerCase())
      );
      if (localItems.length > 0) {
        const allRemoteDocs = await getDocs(collection(db, 'items'));
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
          console.log(`Reconciling: Uploading ${missingInFirestore.length} local items to Cloud Firestore...`);
          await syncItemsBatchToFirestore(missingInFirestore);
        }
      }
      notifyStatus('connected', 'Cloud Firestore Active');
    }
  } catch (err: any) {
    console.warn('Seed/Reconcile Error:', err);
    notifyStatus('error', 'Sync reconciliation issue');
  }
}
