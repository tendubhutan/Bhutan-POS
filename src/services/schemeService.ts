import { Scheme, Item, CartLine, SchemeSaleChannel } from '../types';
import { loadJson, saveJson, STORAGE_KEYS } from './storageService';

export const DEFAULT_SCHEMES: Scheme[] = [
  {
    id: 'scheme_weekend_groceries',
    name: 'Weekend Grocery 10% Off',
    code: 'WKND10',
    description: '10% discount on all Grocery items every Saturday and Sunday',
    status: 'active',
    appliesToSaleType: 'all',
    daysOfWeek: [0, 6], // Sunday = 0, Saturday = 6
    targetType: 'item_group',
    targetValues: ['Groceries'],
    schemeType: 'percent_discount',
    discountValue: 10,
    priority: 10,
    createdAt: new Date().toISOString()
  },
  {
    id: 'scheme_happy_hour',
    name: 'Happy Hour Beverages 15% Off',
    code: 'HAPPY15',
    description: '15% off on Beverages & General Drinks between 14:00 and 18:00 (POS)',
    status: 'active',
    appliesToSaleType: 'pos_only',
    hasTimeLimit: true,
    startTime: '14:00',
    endTime: '18:00',
    targetType: 'item_category',
    targetValues: ['General', 'Beverages'],
    schemeType: 'percent_discount',
    discountValue: 15,
    priority: 20,
    createdAt: new Date().toISOString()
  },
  {
    id: 'scheme_bulk_buyer',
    name: 'Bulk Quantity Discount (5+ Pcs)',
    code: 'BULK5',
    description: 'Flat Nu. 5 off per piece when purchasing 5 or more units of any product',
    status: 'active',
    appliesToSaleType: 'all',
    minQty: 5,
    targetType: 'all_items',
    targetValues: [],
    schemeType: 'flat_discount',
    discountValue: 5,
    priority: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 'scheme_mega_bill',
    name: 'Mega Bill Festive (Nu. 100 Off > Nu. 2,000)',
    code: 'MEGA100',
    description: 'Flat Nu. 100 off on total invoice when bill exceeds Nu. 2,000 (POS & B2B)',
    status: 'active',
    appliesToSaleType: 'all',
    targetType: 'all_items',
    targetValues: [],
    schemeType: 'bill_discount',
    minBillAmount: 2000,
    billDiscountType: 'flat',
    billDiscountValue: 100,
    priority: 5,
    createdAt: new Date().toISOString()
  }
];

export function getSchemes(companyId?: string): Scheme[] {
  return loadJson<Scheme[]>(STORAGE_KEYS.SCHEMES, DEFAULT_SCHEMES, companyId);
}

export function saveScheme(scheme: Scheme, companyId?: string): { ok: boolean; scheme: Scheme; error?: string } {
  if (!scheme.name || !scheme.name.trim()) {
    return { ok: false, scheme, error: 'Scheme Name is required.' };
  }

  const list = getSchemes(companyId);
  const nowStr = new Date().toISOString();
  let updatedList: Scheme[];

  if (scheme.id) {
    const idx = list.findIndex(s => s.id === scheme.id);
    if (idx >= 0) {
      const updated: Scheme = {
        ...list[idx],
        ...scheme,
        updatedAt: nowStr
      };
      updatedList = [...list];
      updatedList[idx] = updated;
      saveJson(STORAGE_KEYS.SCHEMES, updatedList, companyId);
      return { ok: true, scheme: updated };
    }
  }

  // Create new scheme
  const newScheme: Scheme = {
    ...scheme,
    id: scheme.id || `scheme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: nowStr,
    updatedAt: nowStr
  };
  updatedList = [newScheme, ...list];
  saveJson(STORAGE_KEYS.SCHEMES, updatedList, companyId);
  return { ok: true, scheme: newScheme };
}

export function deleteScheme(schemeId: string, companyId?: string): { ok: boolean; schemes: Scheme[] } {
  const list = getSchemes(companyId);
  const filtered = list.filter(s => s.id !== schemeId);
  saveJson(STORAGE_KEYS.SCHEMES, filtered, companyId);
  return { ok: true, schemes: filtered };
}

export function toggleSchemeStatus(schemeId: string, companyId?: string): { ok: boolean; schemes: Scheme[] } {
  const list = getSchemes(companyId);
  const updated = list.map(s => {
    if (s.id === schemeId) {
      const nextStatus: 'active' | 'inactive' = s.status === 'active' ? 'inactive' : 'active';
      return { ...s, status: nextStatus, updatedAt: new Date().toISOString() };
    }
    return s;
  });
  saveJson(STORAGE_KEYS.SCHEMES, updated, companyId);
  return { ok: true, schemes: updated };
}

/**
 * Checks if a scheme is currently active based on date range, day of week, time of day, and sale channel.
 */
export function isSchemeActiveNow(
  scheme: Scheme,
  saleType: 'pos' | 'b2b',
  now: Date = new Date()
): { active: boolean; reason?: string } {
  if (scheme.status !== 'active') {
    return { active: false, reason: 'Scheme is paused / inactive' };
  }

  // Channel check
  if (scheme.appliesToSaleType === 'pos_only' && saleType !== 'pos') {
    return { active: false, reason: 'Applies to POS billing only' };
  }
  if (scheme.appliesToSaleType === 'b2b_only' && saleType !== 'b2b') {
    return { active: false, reason: 'Applies to B2B sales invoice only' };
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  // Start Date check
  if (scheme.startDate && todayStr < scheme.startDate) {
    return { active: false, reason: `Upcoming (starts ${scheme.startDate})` };
  }

  // End Date check
  if (scheme.endDate && todayStr > scheme.endDate) {
    return { active: false, reason: `Expired on ${scheme.endDate}` };
  }

  // Day of Week check (0 = Sunday, 1 = Monday ... 6 = Saturday)
  if (scheme.daysOfWeek && scheme.daysOfWeek.length > 0) {
    const curDay = now.getDay();
    if (!scheme.daysOfWeek.includes(curDay)) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const allowedDays = scheme.daysOfWeek.map(d => dayNames[d]).join(', ');
      return { active: false, reason: `Active on ${allowedDays} only` };
    }
  }

  // Time of Day (Happy Hour) check
  if (scheme.hasTimeLimit && scheme.startTime && scheme.endTime) {
    const curHour = String(now.getHours()).padStart(2, '0');
    const curMin = String(now.getMinutes()).padStart(2, '0');
    const curTime = `${curHour}:${curMin}`;

    if (curTime < scheme.startTime || curTime > scheme.endTime) {
      return { active: false, reason: `Active between ${scheme.startTime} and ${scheme.endTime} only` };
    }
  }

  return { active: true };
}

/**
 * Checks if an item matches the target criteria of a scheme.
 */
export function doesItemMatchScheme(item: Item, scheme: Scheme): boolean {
  if (scheme.targetType === 'all_items') {
    return true;
  }

  const targets = (scheme.targetValues || []).map(v => v.trim().toLowerCase());
  if (targets.length === 0) return false;

  if (scheme.targetType === 'item') {
    const code = (item['Item Code'] || '').trim().toLowerCase();
    const name = (item['Item Name'] || '').trim().toLowerCase();
    const barcode = (item.Barcode || '').trim().toLowerCase();
    return targets.includes(code) || targets.includes(name) || targets.includes(barcode);
  }

  if (scheme.targetType === 'item_group') {
    const group = (item.Group || '').trim().toLowerCase();
    return targets.includes(group);
  }

  if (scheme.targetType === 'item_category') {
    const cat = (item.Category || '').trim().toLowerCase();
    return Boolean(cat && targets.includes(cat));
  }

  if (scheme.targetType === 'brand') {
    const brand = (item.brand || item.Brand || (item as any).manufacturer || (item as any).Manufacturer || '').trim().toLowerCase();
    return Boolean(brand && targets.includes(brand));
  }

  return false;
}

export interface ItemSchemeMatch {
  scheme: Scheme;
  discountPct: number;
  discountAmt: number;
  specialRate?: number;
  freeQty?: number;
  badgeText: string;
}

/**
 * Finds the best active scheme for an item based on channel, date/time, quantity, and priority.
 */
export function findBestItemScheme(
  item: Item,
  qty: number,
  saleType: 'pos' | 'b2b',
  now: Date = new Date(),
  schemesList?: Scheme[]
): ItemSchemeMatch | null {
  const schemes = schemesList || getSchemes();
  const absQty = Math.abs(qty);
  if (absQty <= 0) return null;

  const activeCandidates: { scheme: Scheme; match: ItemSchemeMatch }[] = [];

  for (const scheme of schemes) {
    if (scheme.schemeType === 'bill_discount') continue; // Bill schemes evaluated separately

    const activeCheck = isSchemeActiveNow(scheme, saleType, now);
    if (!activeCheck.active) continue;

    if (!doesItemMatchScheme(item, scheme)) continue;

    // Minimum Qty requirement
    if (scheme.minQty && absQty < scheme.minQty) continue;

    // Maximum Qty cap
    if (scheme.maxQty && absQty > scheme.maxQty) continue;

    const baseRate = Number(item['Sale Rate'] ?? (item as any)['Sales Rate'] ?? item.MRP ?? 0);
    let discountPct = 0;
    let discountAmt = 0;
    let specialRate: number | undefined;
    let freeQty: number | undefined;
    let badgeText = scheme.name;

    if (scheme.schemeType === 'percent_discount') {
      discountPct = Number(scheme.discountValue) || 0;
      discountAmt = (baseRate * discountPct) / 100;
      badgeText = `${scheme.name} (${discountPct}% Off)`;
    } else if (scheme.schemeType === 'flat_discount') {
      discountAmt = Number(scheme.discountValue) || 0;
      discountPct = baseRate > 0 ? (discountAmt / baseRate) * 100 : 0;
      badgeText = `${scheme.name} (-${discountAmt}/pc)`;
    } else if (scheme.schemeType === 'special_rate') {
      specialRate = Number(scheme.specialRate) || 0;
      discountAmt = Math.max(0, baseRate - specialRate);
      discountPct = baseRate > 0 ? (discountAmt / baseRate) * 100 : 0;
      badgeText = `${scheme.name} (Special: Nu. ${specialRate})`;
    } else if (scheme.schemeType === 'bogo' && scheme.buyQty && scheme.freeQty) {
      freeQty = Math.floor(absQty / scheme.buyQty) * scheme.freeQty;
      badgeText = `${scheme.name} (${freeQty} Free)`;
    }

    activeCandidates.push({
      scheme,
      match: {
        scheme,
        discountPct,
        discountAmt,
        specialRate,
        freeQty,
        badgeText
      }
    });
  }

  if (activeCandidates.length === 0) return null;

  // Sort by priority (descending), then by effective discount amount (descending)
  activeCandidates.sort((a, b) => {
    const pA = a.scheme.priority ?? 10;
    const pB = b.scheme.priority ?? 10;
    if (pB !== pA) return pB - pA;
    return b.match.discountAmt - a.match.discountAmt;
  });

  return activeCandidates[0].match;
}

export interface BillSchemeMatch {
  scheme: Scheme;
  discountAmt: number;
  discountPct?: number;
  badgeText: string;
}

/**
 * Evaluates active bill-level schemes (e.g. Spend Nu. 2,000 get Nu. 100 off).
 */
export function findBestBillScheme(
  billAmount: number,
  saleType: 'pos' | 'b2b',
  now: Date = new Date(),
  schemesList?: Scheme[]
): BillSchemeMatch | null {
  if (billAmount <= 0) return null;
  const schemes = schemesList || getSchemes();

  const candidates: { scheme: Scheme; match: BillSchemeMatch }[] = [];

  for (const scheme of schemes) {
    if (scheme.schemeType !== 'bill_discount') continue;

    const activeCheck = isSchemeActiveNow(scheme, saleType, now);
    if (!activeCheck.active) continue;

    const minAmt = Number(scheme.minBillAmount) || 0;
    if (billAmount < minAmt) continue;

    let discountAmt = 0;
    let discountPct: number | undefined;

    if (scheme.billDiscountType === 'percent') {
      discountPct = Number(scheme.billDiscountValue) || 0;
      discountAmt = (billAmount * discountPct) / 100;
    } else {
      discountAmt = Number(scheme.billDiscountValue) || 0;
    }

    candidates.push({
      scheme,
      match: {
        scheme,
        discountAmt,
        discountPct,
        badgeText: `${scheme.name} (-Nu. ${discountAmt.toFixed(2)})`
      }
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const pA = a.scheme.priority ?? 10;
    const pB = b.scheme.priority ?? 10;
    if (pB !== pA) return pB - pA;
    return b.match.discountAmt - a.match.discountAmt;
  });

  return candidates[0].match;
}

/**
 * Returns all schemes that are currently active in real-time.
 */
export function getAllActiveSchemes(
  saleType?: 'pos' | 'b2b',
  now: Date = new Date(),
  companyId?: string
): Scheme[] {
  const list = getSchemes(companyId);
  return list.filter(s => {
    if (s.status !== 'active') return false;
    if (saleType) {
      return isSchemeActiveNow(s, saleType, now).active;
    }
    const posActive = isSchemeActiveNow(s, 'pos', now).active;
    const b2bActive = isSchemeActiveNow(s, 'b2b', now).active;
    return posActive || b2bActive;
  });
}
