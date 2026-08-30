export interface POSSettings {
  // 'direct' = instant add on selection/barcode with Qty=1 and keep focus on search
  // 'prompt' = move focus to Qty -> Rate -> Discount -> Enter to add
  itemAddMode: 'direct' | 'prompt';
  autoIncrementQty: boolean; // Auto-increment qty if same item is added again
  enableSoundFeedback: boolean; // Sound/beep on scan, add, and checkout
  warnLowStock: boolean; // Alert when selling items with zero/negative stock
  showQuickCashButtons: boolean; // One-click tender buttons in payment section
  autoPrintReceipt: boolean; // Auto open receipt print modal on checkout
  alwaysFocusSearch: boolean; // Keep search input focused for rapid scanning
  defaultWalkInMode: boolean; // Auto-select Walk-in Cash customer
  enableDiscount?: boolean; // Legacy/fallback key for item-wise discount
  enableItemDiscount: boolean; // Enable/disable item-wise discounts in POS
  enableBillDiscount: boolean; // Enable/disable lumpsum / bill-level discounts in POS
  enableItemDescription: boolean; // Enable/disable entering item description / remarks during sale
  showPurchasePrice?: boolean; // Show latest purchase price in item search/dropdown
}

export const DEFAULT_POS_SETTINGS: POSSettings = {
  itemAddMode: 'direct',
  autoIncrementQty: true,
  enableSoundFeedback: true,
  warnLowStock: true,
  showQuickCashButtons: true,
  autoPrintReceipt: true,
  alwaysFocusSearch: true,
  defaultWalkInMode: false,
  enableDiscount: true,
  enableItemDiscount: true,
  enableBillDiscount: true,
  enableItemDescription: false,
  showPurchasePrice: false
};

export const POS_SETTINGS_STORAGE_KEY = 'tally_pos_settings_v1';

export function loadPOSSettings(): POSSettings {
  try {
    const saved = localStorage.getItem(POS_SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const result: POSSettings = {
        ...DEFAULT_POS_SETTINGS,
        ...parsed
      };

      if (typeof parsed.enableItemDiscount === 'boolean') {
        result.enableItemDiscount = parsed.enableItemDiscount;
        result.enableDiscount = parsed.enableItemDiscount;
      } else if (typeof parsed.enableDiscount === 'boolean') {
        result.enableItemDiscount = parsed.enableDiscount;
        result.enableDiscount = parsed.enableDiscount;
      }
      if (parsed.enableBillDiscount === false) {
        result.enableBillDiscount = false;
      }

      return result;
    }
  } catch {
    // fallback
  }
  return DEFAULT_POS_SETTINGS;
}

export function savePOSSettings(settings: POSSettings): void {
  try {
    localStorage.setItem(POS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_settings_changed', { detail: settings }));
    }
  } catch {
    // fallback
  }
}
