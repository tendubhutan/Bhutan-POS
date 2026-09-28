import { RestaurantTable, KitchenOrderTicket, RestaurantOrder, KOTItem, RestaurantOrderItem, OrderActionAudit, DayOfWeek, MealTimeSlot, SeasonType, MenuItemSchedule } from '../types/restaurant';
import { getTenantStorageKey, loadJson, saveJson, STORAGE_KEYS, getInitialData } from './storageService';
import { getActiveCompanyId } from './supabaseTenantService';
import { Item, StockLedgerEntry } from '../types';

const RESTAURANT_KEYS = {
  TABLES: 'restaurant_tables',
  ORDERS: 'restaurant_orders',
  KOTS: 'restaurant_kots',
  RECIPES: 'restaurant_recipes',
  AUDIT_LOGS: 'restaurant_action_audits',
  MENU_SCHEDULES: 'restaurant_menu_schedules'
};

const DEFAULT_TABLES: RestaurantTable[] = [
  { id: 'T1', name: 'Table 1', capacity: 4, area: 'Main Hall', status: 'available' },
  { id: 'T2', name: 'Table 2', capacity: 4, area: 'Main Hall', status: 'available' },
  { id: 'T3', name: 'Table 3', capacity: 2, area: 'Main Hall', status: 'available' },
  { id: 'T4', name: 'Table 4', capacity: 6, area: 'Main Hall', status: 'available' },
  { id: 'T5', name: 'Table 5', capacity: 4, area: 'Main Hall', status: 'available' },
  { id: 'T6', name: 'Table 6', capacity: 8, area: 'Family Section', status: 'available' },
  { id: 'VIP-1', name: 'VIP Cabin 1', capacity: 6, area: 'VIP Lounge', status: 'available' },
  { id: 'VIP-2', name: 'VIP Cabin 2', capacity: 8, area: 'VIP Lounge', status: 'available' },
  { id: 'R1', name: 'Terrace 1', capacity: 4, area: 'Roof Top', status: 'available' },
  { id: 'R2', name: 'Terrace 2', capacity: 4, area: 'Roof Top', status: 'available' }
];

export function getTables(companyId?: string): RestaurantTable[] {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.TABLES, cId);
  return loadJson(key, DEFAULT_TABLES);
}

export function saveTables(tables: RestaurantTable[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.TABLES, cId);
  saveJson(key, tables);
  notifyRestaurantUpdated();
}

export function getRestaurantOrders(companyId?: string): RestaurantOrder[] {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.ORDERS, cId);
  return loadJson(key, []);
}

export function saveRestaurantOrders(orders: RestaurantOrder[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.ORDERS, cId);
  saveJson(key, orders);
  notifyRestaurantUpdated();
}

export function getKitchenTickets(companyId?: string): KitchenOrderTicket[] {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.KOTS, cId);
  return loadJson(key, []);
}

export function saveKitchenTickets(kots: KitchenOrderTicket[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.KOTS, cId);
  saveJson(key, kots);
  notifyRestaurantUpdated();
}

export function getRestaurantAuditLogs(companyId?: string): OrderActionAudit[] {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.AUDIT_LOGS, cId);
  return loadJson(key, []);
}

export function saveRestaurantAuditLogs(logs: OrderActionAudit[], companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.AUDIT_LOGS, cId);
  saveJson(key, logs);
}

export function logOrderAction(audit: Omit<OrderActionAudit, 'id' | 'timestamp'>, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const existing = getRestaurantAuditLogs(cId);
  const newLog: OrderActionAudit = {
    ...audit,
    id: `AUD-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString()
  };
  saveRestaurantAuditLogs([newLog, ...existing.slice(0, 499)], cId);
}

function notifyRestaurantUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('restaurant_data_updated'));
  }
}

/**
 * Creates or updates a running table order and sends new KOT to Kitchen Display (KDS).
 * Auto consumes raw store ingredients when items are issued to kitchen if raw stock items exist.
 */
export function sendTableOrderToKitchen(
  tableId: string,
  items: { itemCode: string; itemName: string; unit?: string; qty: number; rate: number; notes?: string; isVeg?: boolean }[],
  waiterName: string = 'Staff',
  guestCount: number = 2,
  customerNotes?: string,
  isQROrder: boolean = false,
  companyId?: string
): { order: RestaurantOrder; kot: KitchenOrderTicket } {
  const cId = companyId || getActiveCompanyId();
  const tables = getTables(cId);
  const table = tables.find(t => t.id === tableId) || {
    id: tableId,
    name: `Table ${tableId}`,
    capacity: 4,
    area: 'Main Hall',
    status: 'available'
  };

  const orders = getRestaurantOrders(cId);
  let order = orders.find(o => o.tableId === tableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'));

  const now = new Date().toISOString();
  const kotSequence = order ? ((order.kotSequence || 1) + 1) : 1;
  const kotId = `KOT-${Date.now().toString().slice(-5)}`;
  const ticketType = order ? 'extra_order' : 'new_order';

  const kotItems: KOTItem[] = items.map(i => ({
    itemCode: i.itemCode,
    itemName: i.itemName,
    unit: i.unit,
    qty: i.qty,
    rate: i.rate,
    notes: i.notes,
    status: 'pending',
    isVeg: i.isVeg,
    kotNumber: kotSequence
  }));

  const kot: KitchenOrderTicket = {
    id: kotId,
    orderId: order?.id || `ORD-${Date.now().toString().slice(-6)}`,
    tableId: table.id,
    tableName: table.name,
    kotNumber: kotSequence,
    ticketType,
    orderType: 'dine_in',
    waiterName,
    guestCount,
    customerNotes,
    alertMessage: ticketType === 'extra_order' ? `⚡ ADD-ON / EXTRA ORDER (KOT #${kotSequence})` : undefined,
    items: kotItems,
    status: 'pending',
    createdAt: now,
    isQROrder
  };

  if (!order) {
    const orderItems: RestaurantOrderItem[] = items.map(i => ({
      itemCode: i.itemCode,
      itemName: i.itemName,
      unit: i.unit,
      qty: i.qty,
      rate: i.rate,
      amount: i.qty * i.rate,
      notes: i.notes,
      status: 'pending',
      kotId,
      kotNumber: kotSequence,
      kotTime: now,
      isVeg: i.isVeg
    }));

    const subtotal = orderItems.reduce((sum, item) => sum + item.amount, 0);

    const scAmt = (subtotal * 10) / 100;
    const taxableBase = subtotal + scAmt;
    const gstCalculated = taxableBase * 0.05;

    order = {
      id: kot.orderId,
      orderNo: `REST-${Date.now().toString().slice(-6)}`,
      tableId: table.id,
      tableName: table.name,
      orderType: 'dine_in',
      waiterName,
      guestCount,
      status: 'kot_sent',
      items: orderItems,
      activeKots: [kotId],
      kotSequence: 1,
      subtotal,
      serviceChargePct: 10,
      serviceChargeAmt: scAmt,
      gstPct: 5,
      gstAmt: gstCalculated,
      discountAmt: 0,
      grandTotal: subtotal + scAmt + gstCalculated,
      createdAt: now,
      isQROrder
    };

    orders.push(order);
  } else {
    order.kotSequence = kotSequence;
    if (!order.activeKots) order.activeKots = [];
    order.activeKots.push(kotId);

    items.forEach(newItem => {
      // Append as fresh running order item with kotNumber
      order!.items.push({
        itemCode: newItem.itemCode,
        itemName: newItem.itemName,
        unit: newItem.unit,
        qty: newItem.qty,
        rate: newItem.rate,
        amount: newItem.qty * newItem.rate,
        notes: newItem.notes,
        status: 'pending',
        kotId,
        kotNumber: kotSequence,
        kotTime: now,
        isVeg: newItem.isVeg
      });
    });

    // Recompute total with non-cancelled items
    const activeItems = order.items.filter(i => i.status !== 'cancelled');
    order.subtotal = activeItems.reduce((sum, item) => sum + item.amount, 0);
    order.serviceChargeAmt = (order.subtotal * (order.serviceChargePct || 10)) / 100;
    const taxableBase = Math.max(0, order.subtotal - (order.discountAmt || 0)) + order.serviceChargeAmt;
    order.gstAmt = taxableBase * ((order.gstPct || 5) / 100);
    order.grandTotal = order.subtotal + order.serviceChargeAmt + order.gstAmt - order.discountAmt;
    order.status = 'kot_sent';
  }

  // Update Table Status & KOT Count
  const tableIdx = tables.findIndex(t => t.id === tableId);
  if (tableIdx !== -1) {
    tables[tableIdx].status = 'kot_sent';
    tables[tableIdx].currentOrderId = order.id;
    tables[tableIdx].waiterName = waiterName;
    tables[tableIdx].guestCount = guestCount;
    tables[tableIdx].lastUpdated = now;
    tables[tableIdx].activeKotCount = order.activeKots?.length || 1;
  } else {
    tables.push({
      id: tableId,
      name: `Table ${tableId}`,
      capacity: 4,
      area: 'Main Hall',
      status: 'kot_sent',
      currentOrderId: order.id,
      waiterName,
      guestCount,
      lastUpdated: now,
      activeKotCount: 1
    });
  }

  saveTables(tables, cId);
  saveRestaurantOrders(orders, cId);

  const kots = getKitchenTickets(cId);
  kots.unshift(kot);
  saveKitchenTickets(kots, cId);

  // Auto-consume store ingredients if items exist as raw materials in inventory
  autoDeductStoreIngredientsForKOT(items, cId);

  // Audit log
  logOrderAction({
    action: ticketType === 'extra_order' ? 'extra_order' : 'extra_order',
    tableId: table.id,
    tableName: table.name,
    performedBy: waiterName,
    details: `${ticketType === 'extra_order' ? `Extra Order KOT #${kotSequence}` : 'New Order'} (${items.length} items)`
  }, cId);

  return { order, kot };
}

/**
 * Cancels a specific menu item from an active restaurant table order.
 * Recalculates Bill Total + Service Charge + 5% GST = Final Total.
 * Dispatches an instant Cancellation Alert to Kitchen KDS and optionally restocks ingredients.
 */
export function cancelRestaurantOrderItem(
  tableId: string,
  itemCode: string,
  reason: string,
  restockToStore: boolean = true,
  cancelledBy: string = 'Staff',
  companyId?: string
): { success: boolean; order?: RestaurantOrder; message: string } {
  const cId = companyId || getActiveCompanyId();
  const orders = getRestaurantOrders(cId);
  const order = orders.find(o => o.tableId === tableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'));

  if (!order) {
    return { success: false, message: 'No active order found for this table.' };
  }

  const targetItem = order.items.find(i => i.itemCode === itemCode && i.status !== 'cancelled');
  if (!targetItem) {
    return { success: false, message: 'Item not found or already cancelled.' };
  }

  const now = new Date().toISOString();
  targetItem.status = 'cancelled';
  targetItem.cancellationReason = reason;
  targetItem.cancelledAt = now;

  // Recalculate bill total without cancelled items
  const activeItems = order.items.filter(i => i.status !== 'cancelled');
  order.subtotal = activeItems.reduce((sum, i) => sum + i.amount, 0);
  order.serviceChargeAmt = (order.subtotal * (order.serviceChargePct || 10)) / 100;
  const taxableBase = Math.max(0, order.subtotal - (order.discountAmt || 0)) + order.serviceChargeAmt;
  order.gstAmt = taxableBase * ((order.gstPct || 5) / 100);
  order.grandTotal = order.subtotal + order.serviceChargeAmt + order.gstAmt - order.discountAmt;

  // Send High-Priority CANCELLED ITEM KOT ticket to Kitchen KDS
  const kotId = `KOT-VOID-${Date.now().toString().slice(-5)}`;
  const cancelKOT: KitchenOrderTicket = {
    id: kotId,
    orderId: order.id,
    tableId: order.tableId,
    tableName: order.tableName,
    kotNumber: order.kotSequence || 1,
    ticketType: 'item_cancellation',
    orderType: order.orderType,
    waiterName: cancelledBy,
    customerNotes: `Reason: ${reason}`,
    alertMessage: `❌ CANCELLED ITEM: ${targetItem.qty}x ${targetItem.itemName} (${reason})`,
    items: [],
    cancelledItems: [{
      itemCode: targetItem.itemCode,
      itemName: targetItem.itemName,
      qty: targetItem.qty,
      rate: targetItem.rate,
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: now
    }],
    status: 'completed',
    createdAt: now
  };

  const kots = getKitchenTickets(cId);
  // Mark in existing KOTs as cancelled
  kots.forEach(k => {
    if (k.orderId === order.id) {
      k.items.forEach(it => {
        if (it.itemCode === itemCode) {
          it.status = 'cancelled';
          it.cancellationReason = reason;
        }
      });
    }
  });
  kots.unshift(cancelKOT);
  saveKitchenTickets(kots, cId);

  // If restock requested, return raw materials to store
  if (restockToStore) {
    autoRestockStoreIngredientsForCancelledItem([{ itemCode: targetItem.itemCode, itemName: targetItem.itemName, qty: targetItem.qty }], cId);
  }

  saveRestaurantOrders(orders, cId);

  logOrderAction({
    action: 'cancel_item',
    tableId: order.tableId,
    tableName: order.tableName,
    itemCode: targetItem.itemCode,
    itemName: targetItem.itemName,
    qty: targetItem.qty,
    reason,
    performedBy: cancelledBy,
    restockedToStore: restockToStore,
    details: `Cancelled 1 dish: ${targetItem.itemName}. Restocked: ${restockToStore ? 'Yes' : 'No (Wastage)'}`
  }, cId);

  return { success: true, order, message: `Successfully cancelled "${targetItem.itemName}". Kitchen KDS alerted.` };
}

/**
 * Replaces an ordered menu item with another dish (e.g. customer wants different curry or drink).
 * Calculates price difference, updates table bill, and dispatches a REPLACEMENT KOT to Kitchen KDS.
 */
export function replaceRestaurantOrderItem(
  tableId: string,
  originalItemCode: string,
  newItem: { itemCode: string; itemName: string; unit?: string; qty: number; rate: number; notes?: string; isVeg?: boolean },
  reason: string,
  requestedBy: string = 'Staff',
  companyId?: string
): { success: boolean; order?: RestaurantOrder; message: string } {
  const cId = companyId || getActiveCompanyId();
  const orders = getRestaurantOrders(cId);
  const order = orders.find(o => o.tableId === tableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'));

  if (!order) {
    return { success: false, message: 'No active order found for this table.' };
  }

  const originalItem = order.items.find(i => i.itemCode === originalItemCode && i.status !== 'cancelled' && i.status !== 'replaced');
  if (!originalItem) {
    return { success: false, message: 'Original item not found in order.' };
  }

  const now = new Date().toISOString();
  originalItem.status = 'replaced';
  originalItem.replacedWithItemCode = newItem.itemCode;
  originalItem.replacedWithItemName = newItem.itemName;
  originalItem.replacedAt = now;
  originalItem.replacementReason = reason;

  // Add the replacement item
  const kotSequence = (order.kotSequence || 1) + 1;
  order.kotSequence = kotSequence;
  const kotId = `KOT-REP-${Date.now().toString().slice(-5)}`;

  const newOrderItem: RestaurantOrderItem = {
    itemCode: newItem.itemCode,
    itemName: newItem.itemName,
    unit: newItem.unit,
    qty: newItem.qty,
    rate: newItem.rate,
    amount: newItem.qty * newItem.rate,
    notes: newItem.notes || `Replaced ${originalItem.itemName}: ${reason}`,
    status: 'pending',
    kotId,
    kotNumber: kotSequence,
    kotTime: now,
    isVeg: newItem.isVeg
  };

  order.items.push(newOrderItem);

  // Recalculate bill total
  const activeItems = order.items.filter(i => i.status !== 'cancelled' && i.status !== 'replaced');
  order.subtotal = activeItems.reduce((sum, i) => sum + i.amount, 0);
  order.serviceChargeAmt = (order.subtotal * (order.serviceChargePct || 10)) / 100;
  const taxableBase = Math.max(0, order.subtotal - (order.discountAmt || 0)) + order.serviceChargeAmt;
  order.gstAmt = taxableBase * ((order.gstPct || 5) / 100);
  order.grandTotal = order.subtotal + order.serviceChargeAmt + order.gstAmt - order.discountAmt;

  // Send REPLACEMENT KOT to Kitchen KDS
  const replacementKOT: KitchenOrderTicket = {
    id: kotId,
    orderId: order.id,
    tableId: order.tableId,
    tableName: order.tableName,
    kotNumber: kotSequence,
    ticketType: 'item_replacement',
    orderType: order.orderType,
    waiterName: requestedBy,
    customerNotes: `Reason: ${reason}`,
    alertMessage: `🔄 REPLACEMENT: Cancel [${originalItem.qty}x ${originalItem.itemName}] ➔ Prepare [${newItem.qty}x ${newItem.itemName}]`,
    items: [{
      itemCode: newItem.itemCode,
      itemName: newItem.itemName,
      unit: newItem.unit,
      qty: newItem.qty,
      rate: newItem.rate,
      notes: newItem.notes,
      status: 'pending',
      isVeg: newItem.isVeg,
      kotNumber: kotSequence
    }],
    cancelledItems: [{
      itemCode: originalItem.itemCode,
      itemName: originalItem.itemName,
      qty: originalItem.qty,
      rate: originalItem.rate,
      status: 'replaced',
      replacementReason: reason
    }],
    replacedItems: [{
      original: {
        itemCode: originalItem.itemCode,
        itemName: originalItem.itemName,
        qty: originalItem.qty,
        rate: originalItem.rate,
        status: 'replaced'
      },
      replacement: {
        itemCode: newItem.itemCode,
        itemName: newItem.itemName,
        qty: newItem.qty,
        rate: newItem.rate,
        status: 'pending'
      },
      reason
    }],
    status: 'pending',
    createdAt: now
  };

  const kots = getKitchenTickets(cId);
  kots.unshift(replacementKOT);
  saveKitchenTickets(kots, cId);
  saveRestaurantOrders(orders, cId);

  // Consume store ingredients for new dish
  autoDeductStoreIngredientsForKOT([newItem], cId);

  logOrderAction({
    action: 'replace_item',
    tableId: order.tableId,
    tableName: order.tableName,
    itemCode: originalItem.itemCode,
    itemName: originalItem.itemName,
    reason,
    performedBy: requestedBy,
    details: `Replaced "${originalItem.itemName}" with "${newItem.itemName}". Diff: ${newItem.rate - originalItem.rate}`
  }, cId);

  return {
    success: true,
    order,
    message: `Replaced "${originalItem.itemName}" with "${newItem.itemName}". Kitchen KDS alerted.`
  };
}

/**
 * Voids/Cancels an entire table order (e.g. guests left before food or emergency cancellation).
 * Releases the table, creates an ORDER VOID alert in KDS, and logs audit record.
 */
export function cancelEntireTableOrder(
  tableId: string,
  reason: string,
  restockToStore: boolean = true,
  cancelledBy: string = 'Staff',
  companyId?: string
): { success: boolean; message: string } {
  const cId = companyId || getActiveCompanyId();
  const tables = getTables(cId);
  const table = tables.find(t => t.id === tableId);
  const orders = getRestaurantOrders(cId);
  const order = orders.find(o => o.tableId === tableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'));

  if (!order) {
    return { success: false, message: 'No active order found on this table to cancel.' };
  }

  const now = new Date().toISOString();
  order.status = 'cancelled';
  order.cancellationReason = reason;
  order.cancelledAt = now;
  order.cancelledBy = cancelledBy;
  order.items.forEach(i => {
    if (i.status !== 'cancelled') {
      i.status = 'cancelled';
      i.cancellationReason = reason;
      i.cancelledAt = now;
    }
  });

  // Release table
  if (table) {
    table.status = 'available';
    table.currentOrderId = undefined;
    table.waiterName = undefined;
    table.guestCount = undefined;
    table.lastUpdated = now;
    table.activeKotCount = 0;
    saveTables(tables, cId);
  }

  // Send VOID ORDER ticket to Kitchen KDS
  const kotId = `KOT-VOID-ORDER-${Date.now().toString().slice(-5)}`;
  const voidKOT: KitchenOrderTicket = {
    id: kotId,
    orderId: order.id,
    tableId: order.tableId,
    tableName: order.tableName,
    kotNumber: order.kotSequence || 1,
    ticketType: 'order_void',
    orderType: order.orderType,
    waiterName: cancelledBy,
    customerNotes: `Order Voided: ${reason}`,
    alertMessage: `🚨 ENTIRE ORDER CANCELLED / VOIDED: ${order.tableName} (${reason}) - STOP PREPARATION!`,
    items: [],
    cancelledItems: order.items.map(i => ({
      itemCode: i.itemCode,
      itemName: i.itemName,
      qty: i.qty,
      rate: i.rate,
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: now
    })),
    status: 'completed',
    createdAt: now
  };

  const kots = getKitchenTickets(cId);
  kots.forEach(k => {
    if (k.orderId === order.id) {
      k.status = 'cancelled';
      k.items.forEach(i => {
        i.status = 'cancelled';
        i.cancellationReason = reason;
      });
    }
  });
  kots.unshift(voidKOT);
  saveKitchenTickets(kots, cId);
  saveRestaurantOrders(orders, cId);

  // Optional Restock
  if (restockToStore) {
    autoRestockStoreIngredientsForCancelledItem(order.items, cId);
  }

  logOrderAction({
    action: 'cancel_order',
    tableId: order.tableId,
    tableName: order.tableName,
    reason,
    performedBy: cancelledBy,
    restockedToStore: restockToStore,
    details: `Voided entire order on ${order.tableName} (${order.items.length} items, Total: Nu. ${order.grandTotal.toFixed(2)})`
  }, cId);

  return { success: true, message: `Successfully cancelled entire order for ${order.tableName}. Table released and kitchen alerted.` };
}

/**
 * Restocks store raw ingredients when an order or item is cancelled.
 */
export function autoRestockStoreIngredientsForCancelledItem(
  items: { itemCode: string; itemName: string; qty: number }[],
  companyId?: string
): void {
  try {
    const cId = companyId || getActiveCompanyId();
    const data = getInitialData();
    const allItems = data.items;
    const now = new Date().toISOString();
    const dateIso = now.slice(0, 10);

    const newLedgerEntries: StockLedgerEntry[] = [];
    let updatedItemsCount = 0;

    items.forEach(item => {
      const storeItem = allItems.find(i => i['Item Code'] === item.itemCode || i['Item Name'].toLowerCase() === item.itemName.toLowerCase());
      if (storeItem && storeItem['Maintain Stock'] !== 'N') {
        const qtyToReturn = item.qty;
        storeItem['Current Stock'] = (storeItem['Current Stock'] || 0) + qtyToReturn;
        updatedItemsCount++;

        newLedgerEntries.push({
          DateIso: dateIso,
          'Item Code': storeItem['Item Code'],
          'Item Name': storeItem['Item Name'],
          Type: 'Kitchen Order Restock (Cancelled)',
          'Qty In': qtyToReturn,
          'Qty Out': 0,
          Balance: storeItem['Current Stock'],
          'Ref No': `KOT-CANCEL-RETURN-${dateIso}`
        });
      }
    });

    if (updatedItemsCount > 0) {
      saveJson(getTenantStorageKey(STORAGE_KEYS.ITEMS, cId), allItems);
      if (newLedgerEntries.length > 0) {
        const existingStock = loadJson<StockLedgerEntry[]>(getTenantStorageKey(STORAGE_KEYS.STOCK_LEDGER, cId), []);
        saveJson(getTenantStorageKey(STORAGE_KEYS.STOCK_LEDGER, cId), [...existingStock, ...newLedgerEntries]);
      }
    }
  } catch (err) {
    console.warn('[autoRestockStoreIngredientsForCancelledItem Error]:', err);
  }
}

/**
 * Automatically consumes raw store materials when items are issued to kitchen.
 */
export function autoDeductStoreIngredientsForKOT(
  items: { itemCode: string; itemName: string; qty: number }[],
  companyId?: string
): void {
  try {
    const cId = companyId || getActiveCompanyId();
    const data = getInitialData();
    const allItems = data.items;
    const now = new Date().toISOString();
    const dateIso = now.slice(0, 10);

    const newLedgerEntries: StockLedgerEntry[] = [];
    let updatedItemsCount = 0;

    items.forEach(orderedItem => {
      const storeItem = allItems.find(i => i['Item Code'] === orderedItem.itemCode || i['Item Name'].toLowerCase() === orderedItem.itemName.toLowerCase());
      if (storeItem && storeItem['Maintain Stock'] !== 'N') {
        const qtyToDeduct = orderedItem.qty;
        storeItem['Current Stock'] = Math.max(0, (storeItem['Current Stock'] || 0) - qtyToDeduct);
        updatedItemsCount++;

        newLedgerEntries.push({
          DateIso: dateIso,
          'Item Code': storeItem['Item Code'],
          'Item Name': storeItem['Item Name'],
          Type: 'Kitchen Store Issue',
          'Qty In': 0,
          'Qty Out': qtyToDeduct,
          Balance: storeItem['Current Stock'],
          'Ref No': `KOT-ISSUE-${dateIso}`
        });
      }
    });

    if (updatedItemsCount > 0) {
      saveJson(getTenantStorageKey(STORAGE_KEYS.ITEMS, cId), allItems);
      if (newLedgerEntries.length > 0) {
        const existingStock = loadJson<StockLedgerEntry[]>(getTenantStorageKey(STORAGE_KEYS.STOCK_LEDGER, cId), []);
        saveJson(getTenantStorageKey(STORAGE_KEYS.STOCK_LEDGER, cId), [...existingStock, ...newLedgerEntries]);
      }
    }
  } catch (err) {
    console.warn('[autoDeductStoreIngredientsForKOT Error]:', err);
  }
}

/**
 * Updates KOT status (e.g. kitchen marks food as 'ready') and updates table status to 'ready'.
 */
export function updateKOTStatus(
  kotId: string,
  newStatus: 'in_progress' | 'ready' | 'completed' | 'cancelled',
  companyId?: string
): void {
  const cId = companyId || getActiveCompanyId();
  const kots = getKitchenTickets(cId);
  const kot = kots.find(k => k.id === kotId);
  if (!kot) return;

  kot.status = newStatus;
  if (newStatus === 'ready') {
    kot.readyAt = new Date().toISOString();
    kot.items.forEach(i => (i.status = 'ready'));
  } else if (newStatus === 'completed') {
    kot.completedAt = new Date().toISOString();
    kot.items.forEach(i => (i.status = 'served'));
  }

  saveKitchenTickets(kots, cId);

  // Update associated table status to 'ready' if all pending KOTs are ready
  const tables = getTables(cId);
  const tableIdx = tables.findIndex(t => t.id === kot.tableId);
  if (tableIdx !== -1) {
    if (newStatus === 'ready') {
      tables[tableIdx].status = 'ready';
      tables[tableIdx].lastUpdated = new Date().toISOString();
      saveTables(tables, cId);
    }
  }

  // Also update running order items status
  const orders = getRestaurantOrders(cId);
  const order = orders.find(o => o.id === kot.orderId);
  if (order) {
    if (newStatus === 'ready') {
      order.status = 'ready';
      order.items.forEach(i => {
        if (i.kotId === kotId) i.status = 'ready';
      });
      saveRestaurantOrders(orders, cId);
    }
  }
}

/**
 * Transfers/Moves an active order from one table to another.
 * Example: Moving guests from Table 2 to Table 5.
 */
export function transferTableOrder(
  fromTableId: string,
  toTableId: string,
  companyId?: string
): { success: boolean; message: string } {
  const cId = companyId || getActiveCompanyId();
  const tables = getTables(cId);
  const fromTable = tables.find(t => t.id === fromTableId);
  let toTable = tables.find(t => t.id === toTableId);

  if (!fromTable) return { success: false, message: 'Source table not found.' };

  const orders = getRestaurantOrders(cId);
  const activeOrder = orders.find(
    o => o.tableId === fromTableId && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed')
  );

  if (!activeOrder) return { success: false, message: 'No active order found on the source table.' };

  if (!toTable) {
    toTable = {
      id: toTableId,
      name: `Table ${toTableId}`,
      capacity: 4,
      area: 'Main Hall',
      status: 'available'
    };
    tables.push(toTable);
  }

  // Check if destination table is occupied
  const targetActiveOrder = orders.find(
    o => o.tableId === toTableId && o.id !== activeOrder.id && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed')
  );

  if (targetActiveOrder) {
    return { success: false, message: `Target table ${toTable.name} already has an active order. Merge or clear it first.` };
  }

  // Update order table references
  const previousStatus = fromTable.status;
  activeOrder.tableId = toTable.id;
  activeOrder.tableName = toTable.name;

  // Update KOTs references
  const kots = getKitchenTickets(cId);
  kots.forEach(kot => {
    if (kot.orderId === activeOrder.id || kot.tableId === fromTableId) {
      kot.tableId = toTable!.id;
      kot.tableName = toTable!.name;
    }
  });

  // Update Table States
  fromTable.status = 'available';
  fromTable.currentOrderId = undefined;
  fromTable.waiterName = undefined;
  fromTable.guestCount = undefined;

  toTable.status = previousStatus === 'available' ? 'kot_sent' : previousStatus;
  toTable.currentOrderId = activeOrder.id;
  toTable.waiterName = activeOrder.waiterName;
  toTable.guestCount = activeOrder.guestCount;
  toTable.lastUpdated = new Date().toISOString();

  saveTables(tables, cId);
  saveRestaurantOrders(orders, cId);
  saveKitchenTickets(kots, cId);

  return { success: true, message: `Successfully moved order from ${fromTable.name} to ${toTable.name}` };
}

/**
 * Creates a Sub-Table (e.g., T4-A, T4-B) for hosting multiple separate groups at the same physical table.
 */
export function createSubTableGroup(
  parentTableId: string,
  groupLabel: string, // e.g. "Group A" or "Sub-Group 2"
  companyId?: string
): RestaurantTable {
  const cId = companyId || getActiveCompanyId();
  const tables = getTables(cId);
  const parent = tables.find(t => t.id === parentTableId);
  const parentName = parent ? parent.name : `Table ${parentTableId}`;

  const subId = `${parentTableId}-${groupLabel.replace(/\s+/g, '')}`;
  const subName = `${parentName} (${groupLabel})`;

  const existing = tables.find(t => t.id === subId);
  if (existing) return existing;

  const newSubTable: RestaurantTable = {
    id: subId,
    name: subName,
    capacity: parent ? Math.ceil(parent.capacity / 2) : 2,
    area: parent ? parent.area : 'Main Hall',
    status: 'available'
  };

  tables.push(newSubTable);
  saveTables(tables, cId);
  return newSubTable;
}

/**
 * Clears table after final checkout / bill payment.
 */
export function clearTableOrder(tableId: string, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const tables = getTables(cId);
  const tableIdx = tables.findIndex(t => t.id === tableId);
  if (tableIdx !== -1) {
    tables[tableIdx].status = 'available';
    tables[tableIdx].currentOrderId = undefined;
    tables[tableIdx].waiterName = undefined;
    tables[tableIdx].guestCount = undefined;
    tables[tableIdx].lastUpdated = new Date().toISOString();
    saveTables(tables, cId);
  }

  const orders = getRestaurantOrders(cId);
  const order = orders.find(o => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled');
  if (order) {
    order.status = 'completed';
    saveRestaurantOrders(orders, cId);
  }
}

/**
 * =========================================================================
 * MENU ITEM SCHEDULING (DAY OF WEEK, TIME SLOTS, SEASONS & IN-STOCK RULES)
 * =========================================================================
 */

export function getMenuItemSchedules(companyId?: string): Record<string, MenuItemSchedule> {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.MENU_SCHEDULES, cId);
  return loadJson<Record<string, MenuItemSchedule>>(key, {});
}

export function saveMenuItemSchedule(schedule: MenuItemSchedule, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.MENU_SCHEDULES, cId);
  const all = getMenuItemSchedules(cId);
  all[schedule.itemCode] = schedule;
  saveJson(key, all);
  notifyRestaurantUpdated();
}

export function saveAllMenuItemSchedules(schedules: Record<string, MenuItemSchedule>, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const key = getTenantStorageKey(RESTAURANT_KEYS.MENU_SCHEDULES, cId);
  saveJson(key, schedules);
  notifyRestaurantUpdated();
}

export function toggleMenuItemStock(itemCode: string, isAvailable: boolean, reason?: string, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const all = getMenuItemSchedules(cId);
  const existing = all[itemCode] || { itemCode };
  all[itemCode] = {
    ...existing,
    isAvailableNow: isAvailable,
    isUnavailable: !isAvailable,
    isHiddenFromQR: !isAvailable,
    outOfStockReason: isAvailable ? undefined : (reason || 'Not available at this time')
  };
  saveAllMenuItemSchedules(all, cId);
}

export function toggleMenuItemUnavailable(itemCode: string, isUnavailable: boolean, reason?: string, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const all = getMenuItemSchedules(cId);
  const existing = all[itemCode] || { itemCode };
  all[itemCode] = {
    ...existing,
    isUnavailable: isUnavailable,
    isAvailableNow: !isUnavailable,
    isHiddenFromQR: isUnavailable,
    outOfStockReason: isUnavailable ? (reason || 'Not available at this time') : undefined
  };
  saveAllMenuItemSchedules(all, cId);
}

export function setBatchMenuItemsUnavailable(itemCodes: string[], isUnavailable: boolean, companyId?: string): void {
  const cId = companyId || getActiveCompanyId();
  const all = getMenuItemSchedules(cId);
  itemCodes.forEach(code => {
    const existing = all[code] || { itemCode: code };
    all[code] = {
      ...existing,
      isUnavailable: isUnavailable,
      isAvailableNow: !isUnavailable,
      isHiddenFromQR: isUnavailable,
      outOfStockReason: isUnavailable ? 'Not available at this time' : undefined
    };
  });
  saveAllMenuItemSchedules(all, cId);
}

export function getCurrentDayOfWeek(date: Date = new Date()): DayOfWeek {
  const days: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

export function getCurrentSeason(date: Date = new Date()): SeasonType {
  const month = date.getMonth() + 1; // 1 to 12
  // Bhutan / Himalayan Seasonality
  // Winter: Dec, Jan, Feb (12, 1, 2)
  // Spring: Mar, Apr, May (3, 4, 5)
  // Summer / Monsoon: Jun, Jul, Aug (6, 7, 8)
  // Autumn: Sep, Oct, Nov (9, 10, 11)
  if (month === 12 || month === 1 || month === 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

export function getCurrentMealSlot(date: Date = new Date()): MealTimeSlot {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // 06:00 to 11:30 -> Breakfast (360 to 690)
  // 11:30 to 15:30 -> Lunch (690 to 930)
  // 15:30 to 18:30 -> High Tea / Evening Snacks (930 to 1110)
  // 18:30 to 23:00 -> Dinner (1110 to 1380)
  // 23:00 to 06:00 -> Late Night
  if (currentMinutes >= 360 && currentMinutes < 690) return 'breakfast';
  if (currentMinutes >= 690 && currentMinutes < 930) return 'lunch';
  if (currentMinutes >= 930 && currentMinutes < 1110) return 'tea';
  if (currentMinutes >= 1110 && currentMinutes < 1380) return 'dinner';
  return 'latenight';
}

export function getMealSlotLabel(slot: MealTimeSlot): { label: string; timeRange: string; icon: string } {
  switch (slot) {
    case 'breakfast':
      return { label: 'Breakfast Menu', timeRange: '06:00 AM - 11:30 AM', icon: '🍳' };
    case 'lunch':
      return { label: 'Lunch Menu', timeRange: '11:30 AM - 03:30 PM', icon: '☀️' };
    case 'tea':
      return { label: 'High Tea & Snacks', timeRange: '03:30 PM - 06:30 PM', icon: '☕' };
    case 'dinner':
      return { label: 'Dinner Special', timeRange: '06:30 PM - 11:00 PM', icon: '🌙' };
    case 'latenight':
      return { label: 'Late Night Menu', timeRange: '11:00 PM - 06:00 AM', icon: '🦉' };
    case 'allday':
    default:
      return { label: 'All-Day Dining', timeRange: '24 Hours', icon: '🍽️' };
  }
}

export function getSeasonLabel(season: SeasonType): { label: string; icon: string; months: string } {
  switch (season) {
    case 'summer':
      return { label: 'Summer Specials', icon: '🌴', months: 'Jun - Aug' };
    case 'monsoon':
      return { label: 'Monsoon Menu', icon: '🌧️', months: 'Jun - Aug' };
    case 'autumn':
      return { label: 'Autumn / Fall Harvest', icon: '🍂', months: 'Sep - Nov' };
    case 'winter':
      return { label: 'Winter Warmers', icon: '❄️', months: 'Dec - Feb' };
    case 'spring':
      return { label: 'Spring Specials', icon: '🌸', months: 'Mar - May' };
    case 'all':
    default:
      return { label: 'All Season', icon: '✨', months: 'Year Round' };
  }
}

/**
 * Checks whether a menu item is available right now based on day, time slot, custom hours, season, and stock flag.
 */
export function isMenuItemAvailable(
  item: Item,
  schedule?: MenuItemSchedule,
  date: Date = new Date()
): { isAvailable: boolean; reason?: string; isOutOfStock?: boolean; matchDetails?: string } {
  // If no schedule configured, default is available all days, all times, all seasons
  if (!schedule) {
    return { isAvailable: true };
  }

  // 1. Check instant unavailable / 86'd / ticked out toggle
  if (schedule.isUnavailable === true || schedule.isHiddenFromQR === true || schedule.isAvailableNow === false) {
    return {
      isAvailable: false,
      isOutOfStock: true,
      reason: schedule.outOfStockReason || 'Not available right now'
    };
  }

  const currentDay = getCurrentDayOfWeek(date);
  const currentSlot = getCurrentMealSlot(date);
  const currentSeason = getCurrentSeason(date);
  const currentMonth = date.getMonth() + 1;

  // 2. Check Day of Week
  if (schedule.availableDays && schedule.availableDays.length > 0) {
    if (!schedule.availableDays.includes(currentDay)) {
      return {
        isAvailable: false,
        reason: `Available only on ${schedule.availableDays.join(', ')} (Today is ${currentDay})`
      };
    }
  }

  // 3. Check Meal Time Slot / Custom Hours
  if (schedule.customStartTime && schedule.customEndTime) {
    const [startH, startM] = schedule.customStartTime.split(':').map(Number);
    const [endH, endM] = schedule.customEndTime.split(':').map(Number);
    const currentMins = date.getHours() * 60 + date.getMinutes();
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (currentMins < startMins || currentMins > endMins) {
      return {
        isAvailable: false,
        reason: `Available between ${schedule.customStartTime} and ${schedule.customEndTime}`
      };
    }
  } else if (schedule.mealTimeSlots && schedule.mealTimeSlots.length > 0) {
    const allowsAllDay = schedule.mealTimeSlots.includes('allday');
    if (!allowsAllDay && !schedule.mealTimeSlots.includes(currentSlot)) {
      const slotNames = schedule.mealTimeSlots.map(s => s.toUpperCase()).join(', ');
      return {
        isAvailable: false,
        reason: `Available during ${slotNames} (Current: ${currentSlot.toUpperCase()})`
      };
    }
  }

  // 4. Check Season / Seasonal Months
  if (schedule.seasonalMonths && schedule.seasonalMonths.length > 0) {
    if (!schedule.seasonalMonths.includes(currentMonth)) {
      return {
        isAvailable: false,
        reason: 'Seasonal item (not in season this month)'
      };
    }
  } else if (schedule.season && schedule.season !== 'all') {
    if (schedule.season !== currentSeason) {
      return {
        isAvailable: false,
        reason: `Seasonal dish: ${schedule.season.toUpperCase()} only (Current: ${currentSeason.toUpperCase()})`
      };
    }
  }

  return { isAvailable: true, matchDetails: schedule.specialTag };
}

/**
 * Filters a list of items to return ONLY available items for the given date/time/season.
 */
export function filterAvailableMenuItems(
  items: Item[],
  date: Date = new Date(),
  overrideSlot?: MealTimeSlot,
  overrideSeason?: SeasonType,
  schedulesMap?: Record<string, MenuItemSchedule>
): Item[] {
  const schedules = schedulesMap || getMenuItemSchedules();
  return items.filter(item => {
    const schedule = schedules[item['Item Code']];
    const check = isMenuItemAvailable(item, schedule, date);
    return check.isAvailable;
  });
}
