export type TableStatus = 'available' | 'occupied' | 'kot_sent' | 'ready' | 'billed';

export type RestaurantStationRole = 'waiter' | 'kitchen' | 'store' | 'billing' | 'manager' | 'admin';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type MealTimeSlot = 'breakfast' | 'lunch' | 'tea' | 'dinner' | 'latenight' | 'allday';
export type SeasonType = 'all' | 'summer' | 'monsoon' | 'autumn' | 'winter' | 'spring';

export interface MenuItemSchedule {
  itemCode: string;
  availableDays?: DayOfWeek[]; // Empty or all 7 = available all days
  mealTimeSlots?: MealTimeSlot[]; // Empty or includes 'allday' = available all day
  customStartTime?: string; // e.g. "11:30"
  customEndTime?: string; // e.g. "15:30"
  season?: SeasonType; // e.g. "all", "summer", "monsoon", "autumn", "winter", "spring"
  seasonalMonths?: number[]; // [1..12]
  isAvailableNow?: boolean; // false = unavailable / out of stock
  isUnavailable?: boolean; // true = ticked (not available at particular day/time)
  isHiddenFromQR?: boolean; // true = hidden from customer QR code
  outOfStockReason?: string;
  specialTag?: string; // e.g. "Chef's Special", "Sunday Brunch", "Winter Special", "Summer Refresh"
}

export interface RestaurantTable {
  id: string; // e.g. "T1", "T2", "VIP-1"
  name: string; // e.g. "Table 1"
  capacity: number;
  area: string; // e.g. "Main Hall", "Terrace", "VIP Room", "Bar"
  status: TableStatus;
  currentOrderId?: string;
  waiterName?: string;
  guestCount?: number;
  lastUpdated?: string;
  activeKotCount?: number;
}

export type KOTItemStatus = 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled' | 'replaced';
export type KOTStatus = 'pending' | 'in_progress' | 'ready' | 'completed' | 'cancelled';
export type KOTType = 'new_order' | 'extra_order' | 'item_cancellation' | 'item_replacement' | 'order_void';

export interface KOTItem {
  itemCode: string;
  itemName: string;
  unit?: string;
  qty: number;
  rate: number;
  notes?: string;
  status: KOTItemStatus;
  isVeg?: boolean;
  kotNumber?: number; // 1 for initial KOT, 2 for extra order #1, etc.
  cancellationReason?: string;
  cancelledAt?: string;
  replacedWithItemCode?: string;
  replacedWithItemName?: string;
  replacedAt?: string;
  replacementReason?: string;
}

export interface KitchenOrderTicket {
  id: string; // e.g. "KOT-101"
  orderId: string;
  tableId: string;
  tableName: string;
  kotNumber: number; // 1, 2, 3...
  ticketType: KOTType;
  orderType: 'dine_in' | 'takeaway' | 'room_service';
  waiterName?: string;
  guestCount?: number;
  customerNotes?: string;
  alertMessage?: string; // e.g. "⚠️ CANCELLED: 2x Chicken Chilli" or "🔄 REPLACED: 1x Beef Curry -> Paneer Butter Masala"
  items: KOTItem[];
  cancelledItems?: KOTItem[];
  replacedItems?: { original: KOTItem; replacement: KOTItem; reason?: string }[];
  status: KOTStatus;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
  isQROrder?: boolean;
}

export interface RestaurantOrderItem {
  itemCode: string;
  itemName: string;
  unit?: string;
  qty: number;
  rate: number;
  amount: number;
  notes?: string;
  status: KOTItemStatus;
  kotId?: string;
  kotNumber?: number;
  kotTime?: string;
  isVeg?: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  replacedWithItemCode?: string;
  replacedWithItemName?: string;
  replacedAt?: string;
  replacementReason?: string;
}

export interface OrderActionAudit {
  id: string;
  timestamp: string;
  action: 'cancel_order' | 'cancel_item' | 'replace_item' | 'extra_order' | 'move_table' | 'split_table';
  tableId: string;
  tableName: string;
  itemCode?: string;
  itemName?: string;
  qty?: number;
  reason?: string;
  performedBy: string;
  restockedToStore?: boolean;
  details?: string;
}

export interface RestaurantOrder {
  id: string;
  orderNo: string;
  tableId: string;
  tableName: string;
  orderType: 'dine_in' | 'takeaway' | 'room_service';
  waiterName?: string;
  guestCount?: number;
  customerName?: string;
  customerPhone?: string;
  status: 'open' | 'kot_sent' | 'ready' | 'billed' | 'completed' | 'cancelled';
  items: RestaurantOrderItem[];
  activeKots?: string[];
  kotSequence?: number; // Tracks latest KOT number (1, 2, 3...)
  subtotal: number;
  serviceChargePct: number;
  serviceChargeAmt: number;
  gstPct: number; // 5%
  gstAmt: number;
  discountAmt: number;
  grandTotal: number;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  auditLogs?: OrderActionAudit[];
  createdAt: string;
  billedAt?: string;
  isQROrder?: boolean;
}

export interface RecipeIngredient {
  rawItemCode: string;
  rawItemName: string;
  qtyPerPortion: number;
  unit: string;
}

export interface PreparedDishRecipe {
  dishItemCode: string;
  dishItemName: string;
  ingredients: RecipeIngredient[];
}
