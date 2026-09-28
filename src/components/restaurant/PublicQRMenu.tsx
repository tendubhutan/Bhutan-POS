import React, { useState, useEffect } from 'react';
import { Item, Config } from '../../types';
import { getInitialData } from '../../services/storageService';
import { sendTableOrderToKitchen, getRestaurantOrders, getMenuItemSchedules, isMenuItemAvailable, getCurrentDayOfWeek, getCurrentMealSlot, getCurrentSeason, getMealSlotLabel, getSeasonLabel } from '../../services/restaurantService';
import { RestaurantOrder, MealTimeSlot, SeasonType, MenuItemSchedule } from '../../types/restaurant';
import { Utensils, ShoppingCart, Plus, Minus, Send, CheckCircle2, Clock, Sparkles, ChevronRight, Search, Heart, Sun, Moon, Coffee, Calendar, Leaf } from 'lucide-react';

interface PublicQRMenuProps {
  tableId?: string;
  tableName?: string;
  config?: Config;
  items?: Item[];
  onClose?: () => void;
}

export const PublicQRMenu: React.FC<PublicQRMenuProps> = ({
  tableId: propTableId,
  tableName: propTableName,
  config: propConfig,
  items: propItems,
  onClose
}) => {
  const [tableId, setTableId] = useState<string>('T1');
  const [tableName, setTableName] = useState<string>('Table 1');
  const [config, setConfig] = useState<Config>(() => propConfig || getInitialData().config);
  const [items, setItems] = useState<Item[]>(() => propItems || getInitialData().items);
  const [schedules, setSchedules] = useState<Record<string, MenuItemSchedule>>(() => getMenuItemSchedules());

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSlotFilter, setSelectedSlotFilter] = useState<'current_available' | 'all' | MealTimeSlot>('current_available');

  const [cart, setCart] = useState<{
    itemCode: string;
    itemName: string;
    unit?: string;
    qty: number;
    rate: number;
    notes?: string;
    isVeg?: boolean;
  }[]>([]);

  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [orderSent, setOrderSent] = useState<boolean>(false);
  const [runningOrder, setRunningOrder] = useState<RestaurantOrder | null>(null);

  const currentDay = getCurrentDayOfWeek();
  const currentSlot = getCurrentMealSlot();
  const currentSeason = getCurrentSeason();
  const slotInfo = getMealSlotLabel(currentSlot);
  const seasonInfo = getSeasonLabel(currentSeason);

  useEffect(() => {
    // Check URL parameters for table
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTable = params.get('table') || params.get('qr') || params.get('tableId');
      if (urlTable) {
        setTableId(urlTable);
        setTableName(`Table ${urlTable}`);
      } else if (propTableId) {
        setTableId(propTableId);
        setTableName(propTableName || `Table ${propTableId}`);
      }
    }
    setSchedules(getMenuItemSchedules());

    const handleSync = () => {
      setSchedules(getMenuItemSchedules());
      setItems(propItems || getInitialData().items);
    };
    window.addEventListener('restaurant_data_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('restaurant_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [propTableId, propTableName, propItems]);

  useEffect(() => {
    const orders = getRestaurantOrders();
    const active = orders.find(o => o.tableId === tableId && o.status !== 'completed' && o.status !== 'cancelled');
    if (active) setRunningOrder(active);
  }, [tableId, orderSent]);

  const currencySymbol = config.CurrencySymbol || 'Nu.';

  // Categories list (only for available items)
  const availableItems = items.filter(item => {
    const schedule = schedules[item['Item Code']];
    const availability = isMenuItemAvailable(item, schedule);
    if (schedule?.isUnavailable === true || schedule?.isHiddenFromQR === true || schedule?.isAvailableNow === false || !availability.isAvailable) {
      return false;
    }
    return true;
  });

  const categories = Array.from(new Set(availableItems.map(i => i.Category || 'General Food').filter(Boolean)));

  // Filter items: strictly show ONLY available items when customer scans QR Code
  const evaluatedItems = items.map(item => {
    const schedule = schedules[item['Item Code']];
    const availability = isMenuItemAvailable(item, schedule);
    return {
      item,
      schedule,
      isAvailable: availability.isAvailable,
      reason: availability.reason,
      isOutOfStock: availability.isOutOfStock,
      specialTag: schedule?.specialTag || availability.matchDetails
    };
  });

  const filteredItems = evaluatedItems.filter(({ item, schedule, isAvailable }) => {
    // Strictly hide ticked / unavailable items from QR Code Menu
    if (schedule?.isUnavailable === true || schedule?.isHiddenFromQR === true || schedule?.isAvailableNow === false || !isAvailable) {
      return false;
    }

    if (selectedCategory !== 'all' && item.Category !== selectedCategory) return false;
    if (searchQuery.trim() && !item['Item Name'].toLowerCase().includes(searchQuery.toLowerCase()) && !item['Item Code'].toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAddToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(l => l.itemCode === item['Item Code']);
      if (existing) {
        return prev.map(l => (l.itemCode === item['Item Code'] ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          itemCode: item['Item Code'],
          itemName: item['Item Name'],
          unit: item.Unit,
          qty: 1,
          rate: item['Sale Rate'] || 0,
          notes: ''
        }
      ];
    });
  };

  const handleUpdateQty = (itemCode: string, delta: number) => {
    setCart(prev =>
      prev
        .map(l => {
          if (l.itemCode === itemCode) {
            const nextQty = l.qty + delta;
            return nextQty > 0 ? { ...l, qty: nextQty } : null;
          }
          return l;
        })
        .filter(Boolean) as typeof cart
    );
  };

  const cartSubtotal = cart.reduce((sum, l) => sum + l.qty * l.rate, 0);

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;

    sendTableOrderToKitchen(
      tableId,
      cart,
      'QR Customer',
      2,
      customerNotes,
      true
    );

    setOrderSent(true);
    setCart([]);
    setCustomerNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden max-w-md mx-auto shadow-2xl border-x border-slate-800 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 p-4 text-white shrink-0 shadow-lg relative">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-xs">
                DIGITAL MENU • {tableName}
              </span>
              <span className="text-[10px] font-bold bg-amber-400/30 text-amber-100 px-2 py-0.5 rounded-full">
                {currentDay}
              </span>
            </div>
            <h1 className="text-xl font-black tracking-tight mt-1">{config.CompanyName || 'Ezee Restaurant'}</h1>
            <p className="text-[11px] text-amber-100 font-medium">Scan, Select &amp; Order directly to Kitchen</p>
          </div>

          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black shadow-inner">
            <Utensils className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Dynamic Meal Slot & Season Live Banner */}
        <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1.5 text-amber-100">
            <span className="text-sm">{slotInfo.icon}</span>
            <span>{slotInfo.label}</span>
            <span className="text-[10px] text-white/80 font-mono">({slotInfo.timeRange})</span>
          </div>
          <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-lg text-amber-200 text-[10px]">
            <span>{seasonInfo.icon}</span>
            <span>{seasonInfo.label}</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-white/80 hover:text-white text-xs px-2 py-1 bg-black/20 rounded-lg cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-3 bg-slate-900">
        {orderSent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Order Sent to Kitchen!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Your food order for <span className="text-amber-400 font-bold">{tableName}</span> is now being prepared by our chef.
              </p>
            </div>

            <button
              onClick={() => setOrderSent(false)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer shadow-md active:scale-95 transition"
            >
              Order More Items
            </button>
          </div>
        ) : (
          <>
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Available Dishes ({filteredItems.length})
              </button>
              {categories.map(cat => {
                const countInCat = availableItems.filter(i => i.Category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {cat} ({countInCat})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search food, beverage or special dish..."
                className="w-full h-8 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            {/* Menu Dish Cards List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  <p className="font-bold text-slate-300">No dishes available for this schedule.</p>
                  <p className="text-[11px] mt-1">Try selecting "Active Menu Now" or browsing all categories.</p>
                </div>
              ) : (
                filteredItems.map(({ item, schedule, isAvailable, reason, isOutOfStock, specialTag }) => {
                  const inCart = cart.find(l => l.itemCode === item['Item Code']);

                  return (
                    <div
                      key={item['Item Code']}
                      className={`p-3 rounded-2xl bg-slate-950 border transition shadow-xs ${
                        !isAvailable ? 'opacity-60 border-slate-800/40' : 'border-slate-800 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-white leading-tight">{item['Item Name']}</span>
                            {specialTag && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {specialTag}
                              </span>
                            )}
                            {schedule?.season && schedule.season !== 'all' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                ❄️ {schedule.season}
                              </span>
                            )}
                          </div>
                          
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{item.Category || 'Main Dish'}</span>

                          {!isAvailable && reason && (
                            <div className="text-[10px] text-rose-400 font-medium mt-1 flex items-center gap-1">
                              <span>⚠️ {reason}</span>
                            </div>
                          )}

                          <span className="text-xs font-black text-amber-400 mt-1 block">
                            {currencySymbol} {(item['Sale Rate'] || 0).toLocaleString()}
                          </span>
                        </div>

                        <div className="shrink-0">
                          {!isAvailable ? (
                            <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-500 text-[10px] font-bold border border-slate-700">
                              {isOutOfStock ? 'Sold Out' : 'Unavailable'}
                            </span>
                          ) : inCart ? (
                            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 p-1 rounded-xl">
                              <button
                                onClick={() => handleUpdateQty(item['Item Code'], -1)}
                                className="p-1 text-amber-300 hover:bg-amber-500/30 rounded-lg cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="font-black text-xs text-amber-300 px-1">{inCart.qty}</span>
                              <button
                                onClick={() => handleUpdateQty(item['Item Code'], 1)}
                                className="p-1 text-amber-300 hover:bg-amber-500/30 rounded-lg cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-md"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>ADD</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Cart Tray Footer */}
      {!orderSent && cart.length > 0 && (
        <div className="bg-slate-950 p-4 border-t border-slate-800 space-y-2.5 shrink-0 shadow-2xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-400">{cart.length} Selected Dish(es)</span>
            <span className="font-black text-base text-amber-400">
              {currencySymbol} {cartSubtotal.toLocaleString()}
            </span>
          </div>

          <input
            type="text"
            value={customerNotes}
            onChange={e => setCustomerNotes(e.target.value)}
            placeholder="Special instructions (e.g. Less spicy, extra sauce)..."
            className="w-full h-8 rounded-xl bg-slate-900 border border-slate-800 px-3 text-xs text-slate-200 outline-none focus:border-amber-500"
          />

          <button
            onClick={handlePlaceOrder}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
          >
            <Send className="h-4 w-4" />
            <span>PLACE ORDER FOR {tableName.toUpperCase()}</span>
          </button>
        </div>
      )}
    </div>
  );
};

