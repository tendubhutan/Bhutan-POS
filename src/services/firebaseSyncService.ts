import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  limit 
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

    // 2. Items listener
    const itemsRef = collection(db, 'items');
    const unsubItems = onSnapshot(itemsRef, (snapshot) => {
      const remoteItems: Item[] = [];
      snapshot.forEach(docSnap => {
        remoteItems.push(docSnap.data() as Item);
      });
      if (remoteItems.length > 0) {
        saveJson(STORAGE_KEYS.ITEMS, remoteItems);
        if (onDataUpdated) onDataUpdated();
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Items):', err);
    });
    unsubscribes.push(unsubItems);

    // 3. Ledgers listener
    const ledgersRef = collection(db, 'ledgers');
    const unsubLedgers = onSnapshot(ledgersRef, (snapshot) => {
      const remoteLedgers: Ledger[] = [];
      snapshot.forEach(docSnap => {
        remoteLedgers.push(docSnap.data() as Ledger);
      });
      if (remoteLedgers.length > 0) {
        saveJson(STORAGE_KEYS.LEDGERS, remoteLedgers);
        if (onDataUpdated) onDataUpdated();
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Ledgers):', err);
    });
    unsubscribes.push(unsubLedgers);

    // 4. Sales Invoices listener
    const salesRef = collection(db, 'sales_invoices');
    const unsubSales = onSnapshot(salesRef, (snapshot) => {
      if (!snapshot.empty) {
        const remoteSales: SalesInvoice[] = [];
        snapshot.forEach(docSnap => {
          remoteSales.push(docSnap.data() as SalesInvoice);
        });
        if (remoteSales.length > 0) {
          saveJson(STORAGE_KEYS.SALES_INVOICES, remoteSales);
          if (onDataUpdated) onDataUpdated();
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Sales):', err);
    });
    unsubscribes.push(unsubSales);

    // 5. Purchase Invoices listener
    const purchaseRef = collection(db, 'purchase_invoices');
    const unsubPurchase = onSnapshot(purchaseRef, (snapshot) => {
      if (!snapshot.empty) {
        const remotePurchases: PurchaseInvoice[] = [];
        snapshot.forEach(docSnap => {
          remotePurchases.push(docSnap.data() as PurchaseInvoice);
        });
        if (remotePurchases.length > 0) {
          saveJson(STORAGE_KEYS.PURCHASE_INVOICES, remotePurchases);
          if (onDataUpdated) onDataUpdated();
        }
      }
    }, (err) => {
      console.warn('Firestore Listener Error (Purchases):', err);
    });
    unsubscribes.push(unsubPurchase);

    // 6. Vouchers listener
    const vouchersRef = collection(db, 'vouchers');
    const unsubVouchers = onSnapshot(vouchersRef, (snapshot) => {
      if (!snapshot.empty) {
        const remoteVouchers: Voucher[] = [];
        snapshot.forEach(docSnap => {
          remoteVouchers.push(docSnap.data() as Voucher);
        });
        if (remoteVouchers.length > 0) {
          saveJson(STORAGE_KEYS.VOUCHERS, remoteVouchers);
          if (onDataUpdated) onDataUpdated();
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
 * Bulk upload local data to Firestore if Firestore is empty on first setup
 */
export async function seedInitialLocalDataToFirestore() {
  try {
    // Check if items collection already has documents in Firestore
    const itemsRef = collection(db, 'items');
    const existingSnap = await getDocs(query(itemsRef, limit(1)));
    if (!existingSnap.empty) {
      console.log('Firestore already contains items. Skipping initial seeding.');
      notifyStatus('connected', 'Cloud Firestore Active');
      return;
    }

    notifyStatus('syncing', 'Seeding initial data to Cloud Firestore...');

    const initial = getInitialData();

    if (initial.config) {
      await syncConfigToFirestore(initial.config);
    }

    if (initial.items && initial.items.length > 0) {
      for (const item of initial.items) {
        await syncItemToFirestore(item);
      }
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
  } catch (err: any) {
    console.warn('Seed Error:', err);
    notifyStatus('error', 'Seeding failed');
  }
}
