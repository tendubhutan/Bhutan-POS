import React, { useState, useEffect } from 'react';
import { RestaurantTable, RestaurantOrder, RestaurantOrderItem } from '../../types/restaurant';
import { getTables, getRestaurantOrders, sendTableOrderToKitchen, cancelRestaurantOrderItem, replaceRestaurantOrderItem, cancelEntireTableOrder } from '../../services/restaurantService';
import { Item, Config } from '../../types';
import { ShoppingCart, Send, Plus, Minus, Search, Trash2, ArrowLeft, Users, Utensils, CheckCircle2, Sparkles, AlertTriangle, ArrowRightLeft, X, Layers, Clock } from 'lucide-react';

interface WaiterPadProps {
  items: Item[];
  config: Config;
  onClose?: () => void;
  initialTableId?: string;
}

export const WaiterMobilePad: React.FC<WaiterPadProps> = ({
  items,
  config,
  onClose,
  initialTableId
}) => {
  const [tables, setTables] = useState<RestaurantTable[]>(() => getTables());
  const [orders, setOrders] = useState<RestaurantOrder[]>(() => getRestaurantOrders());
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(() => {
    const list = getTables();
    if (initialTableId) return list.find(t => t.id === initialTableId) || list[0] || null;
    return list[0] || null;
  });

  const [waiterName, setWaiterName] = useState<string>('Waiter 1');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [showOrderSuccess, setShowOrderSuccess] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');

  // Tab mode: 'add_items' | 'running_order'
  const [padTab, setPadTab] = useState<'add_items' | 'running_order'>('add_items');

  // Cancel Item Modal State
  const [itemToCancel, setItemToCancel] = useState<RestaurantOrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Customer changed mind');
  const [restockOnCancel, setRestockOnCancel] = useState<boolean>(true);

  // Replace Item Modal State
  const [itemToReplace, setItemToReplace] = useState<RestaurantOrderItem | null>(null);
  const [replacementDish, setReplacementDish] = useState<Item | null>(null);
  const [replaceReason, setReplaceReason] = useState<string>('Customer preference change');

  // Cancel Entire Order Modal
  const [showVoidOrderModal, setShowVoidOrderModal] = useState<boolean>(false);
  const [voidOrderReason, setVoidOrderReason] = useState<string>('Customer left / cancelled');

  // Cart Lines State (for new order or extra order addition)
  const [cart, setCart] = useState<{
    itemCode: string;
    itemName: string;
    unit?: string;
    qty: number;
    rate: number;
    notes?: string;
    isVeg?: boolean;
  }[]>([]);

  const currencySymbol = config.CurrencySymbol || 'Nu.';

  const refreshData = () => {
    const updatedTables = getTables();
    const updatedOrders = getRestaurantOrders();
    setTables(updatedTables);
    setOrders(updatedOrders);
    if (selectedTable) {
      const refreshedT = updatedTables.find(t => t.id === selectedTable.id);
      if (refreshedT) setSelectedTable(refreshedT);
    }
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('restaurant_data_updated', handleUpdate);
    return () => window.removeEventListener('restaurant_data_updated', handleUpdate);
  }, []);

  const activeTableOrder = selectedTable
    ? orders.find(o => o.tableId === selectedTable.id && (o.status === 'open' || o.status === 'kot_sent' || o.status === 'ready' || o.status === 'billed'))
    : null;

  // Categories list
  const categories = Array.from(new Set(items.map(i => i.Category || 'General Food').filter(Boolean)));

  const filteredItems = items.filter(i => {
    if (selectedCategory !== 'all' && i.Category !== selectedCategory) return false;
    if (searchQuery.trim() && !i['Item Name'].toLowerCase().includes(searchQuery.toLowerCase()) && !i['Item Code'].toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAddToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(line => line.itemCode === item['Item Code']);
      if (existing) {
        return prev.map(line =>
          line.itemCode === item['Item Code'] ? { ...line, qty: line.qty + 1 } : line
        );
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
        .map(line => {
          if (line.itemCode === itemCode) {
            const nextQty = line.qty + delta;
            return nextQty > 0 ? { ...line, qty: nextQty } : null;
          }
          return line;
        })
        .filter(Boolean) as typeof cart
    );
  };

  const handleUpdateNotes = (itemCode: string, notes: string) => {
    setCart(prev =>
      prev.map(line => (line.itemCode === itemCode ? { ...line, notes } : line))
    );
  };

  const cartSubtotal = cart.reduce((sum, line) => sum + line.qty * line.rate, 0);

  const handleSendKOT = () => {
    if (!selectedTable || cart.length === 0) return;

    sendTableOrderToKitchen(
      selectedTable.id,
      cart,
      waiterName,
      guestCount,
      customerNotes,
      false
    );

    setShowOrderSuccess(true);
    setCart([]);
    setCustomerNotes('');
    refreshData();
    setTimeout(() => {
      setShowOrderSuccess(false);
    }, 2500);
  };

  const handleConfirmCancelItem = () => {
    if (!selectedTable || !itemToCancel) return;
    const res = cancelRestaurantOrderItem(
      selectedTable.id,
      itemToCancel.itemCode,
      cancelReason,
      restockOnCancel,
      waiterName
    );
    if (res.success) {
      setActionSuccessMsg(res.message);
      setItemToCancel(null);
      refreshData();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } else {
      alert(res.message);
    }
  };

  const handleConfirmReplaceItem = () => {
    if (!selectedTable || !itemToReplace || !replacementDish) return;
    const res = replaceRestaurantOrderItem(
      selectedTable.id,
      itemToReplace.itemCode,
      {
        itemCode: replacementDish['Item Code'],
        itemName: replacementDish['Item Name'],
        unit: replacementDish.Unit,
        qty: itemToReplace.qty,
        rate: replacementDish['Sale Rate'] || 0
      },
      replaceReason,
      waiterName
    );
    if (res.success) {
      setActionSuccessMsg(res.message);
      setItemToReplace(null);
      setReplacementDish(null);
      refreshData();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } else {
      alert(res.message);
    }
  };

  const handleConfirmVoidEntireOrder = () => {
    if (!selectedTable) return;
    const res = cancelEntireTableOrder(
      selectedTable.id,
      voidOrderReason,
      true,
      waiterName
    );
    if (res.success) {
      setActionSuccessMsg(res.message);
      setShowVoidOrderModal(false);
      refreshData();
      setTimeout(() => setActionSuccessMsg(''), 3000);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col overflow-hidden">
      {/* Waiter Top Bar */}
      <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <span>Waiter Mobile Order Pad</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Floor Service
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">Take orders, add extra orders, cancel or replace items instantly</p>
          </div>
        </div>

        {/* Table Selector & Waiter Name */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-blue-900/60 p-1 rounded-xl border border-blue-500/40">
            <span className="text-[10px] font-bold text-blue-300 uppercase px-1">Table:</span>
            <select
              value={selectedTable?.id || ''}
              onChange={e => {
                const found = tables.find(t => t.id === e.target.value);
                if (found) setSelectedTable(found);
              }}
              className="h-8 rounded-lg bg-blue-600 text-white font-black text-xs px-2.5 outline-none cursor-pointer"
            >
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.area}) {t.status !== 'available' ? '• Occupied' : ''}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={waiterName}
            onChange={e => setWaiterName(e.target.value)}
            placeholder="Waiter"
            className="w-24 h-9 rounded-xl bg-slate-800 border border-slate-700 px-2.5 text-xs font-bold text-slate-200 outline-none"
          />
        </div>
      </div>

      {/* Success Notification Bar */}
      {actionSuccessMsg && (
        <div className="p-2.5 bg-emerald-900/90 border-b border-emerald-500 text-white text-xs font-bold text-center flex items-center justify-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Mode Selector Tabs (New/Extra Order vs Running Active Table Order) */}
      <div className="bg-slate-950 px-3.5 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setPadTab('add_items')}
            className={`px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
              padTab === 'add_items' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{activeTableOrder ? 'Add Extra Order (Running KOT)' : 'Take New Order'}</span>
          </button>
          <button
            onClick={() => setPadTab('running_order')}
            className={`px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center gap-1.5 ${
              padTab === 'running_order' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Active Table Order ({activeTableOrder ? activeTableOrder.items.filter(i => i.status !== 'cancelled').length : 0})</span>
          </button>
        </div>

        {activeTableOrder && (
          <div className="text-right flex items-center gap-2">
            <span className="text-[11px] font-bold text-amber-400">
              Active Bill: {currencySymbol} {activeTableOrder.grandTotal.toLocaleString()}
            </span>
            <button
              onClick={() => setShowVoidOrderModal(true)}
              className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/50 rounded-lg text-[10px] font-bold transition cursor-pointer"
            >
              Cancel Entire Order
            </button>
          </div>
        )}
      </div>

      {/* Main Body Grid */}
      {padTab === 'add_items' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Side: Items Catalog */}
          <div className="flex-1 flex flex-col p-3.5 space-y-3 overflow-hidden bg-slate-900 border-r border-slate-800">
            {/* Categories Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All ({items.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Field */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dish or beverage..."
                className="w-full h-8 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 outline-none focus:border-blue-500"
              />
            </div>

            {/* Dishes Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 pr-1">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.itemCode === item['Item Code']);

                return (
                  <div
                    key={item['Item Code']}
                    onClick={() => handleAddToCart(item)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between select-none ${
                      inCart
                        ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-xs text-white line-clamp-2 leading-tight">{item['Item Name']}</h4>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{item.Category || 'Food'}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-black text-xs text-amber-400">
                        {currencySymbol} {(item['Sale Rate'] || 0).toLocaleString()}
                      </span>

                      {inCart ? (
                        <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-xs rounded-full">
                          x{inCart.qty}
                        </span>
                      ) : (
                        <span className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white transition">
                          <Plus className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Running Cart & KOT Submit */}
          <div className="w-full md:w-80 lg:w-96 bg-slate-950 p-4 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col justify-between shrink-0">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-amber-400" />
                  <span>{activeTableOrder ? `Extra Items (${cart.length})` : `Order Cart (${cart.length})`}</span>
                </h3>
                <span className="text-xs font-mono font-bold text-amber-400">{selectedTable?.name || 'No Table'}</span>
              </div>

              {/* Cart Lines */}
              <div className="my-3 space-y-2.5 max-h-64 md:max-h-80 overflow-y-auto pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Tap dishes from catalog to add to order
                  </div>
                ) : (
                  cart.map(line => (
                    <div key={line.itemCode} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-white">{line.itemName}</span>
                        <span className="font-black text-xs text-amber-400 shrink-0">
                          {currencySymbol} {(line.qty * line.rate).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <input
                          type="text"
                          value={line.notes || ''}
                          onChange={e => handleUpdateNotes(line.itemCode, e.target.value)}
                          placeholder="Special instructions (e.g. Less spicy)"
                          className="flex-1 h-7 rounded-lg bg-slate-950 border border-slate-800 px-2 text-[10px] text-amber-300 placeholder:text-slate-600 outline-none"
                        />

                        <div className="flex items-center gap-1.5 shrink-0 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                          <button
                            onClick={() => handleUpdateQty(line.itemCode, -1)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-300"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="font-mono font-bold text-xs px-1 text-white">{line.qty}</span>
                          <button
                            onClick={() => handleUpdateQty(line.itemCode, 1)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-300"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* General Note */}
              {cart.length > 0 && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    placeholder="General table request..."
                    className="w-full h-8 rounded-xl bg-slate-900 border border-slate-800 px-3 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Footer Subtotal & KOT Submit */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-400">Order Subtotal:</span>
                <span className="font-black text-lg text-white">
                  {currencySymbol} {cartSubtotal.toLocaleString()}
                </span>
              </div>

              {showOrderSuccess ? (
                <div className="p-3 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>KOT Sent to Kitchen!</span>
                </div>
              ) : (
                <button
                  disabled={cart.length === 0}
                  onClick={handleSendKOT}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
                >
                  <Send className="h-4 w-4" />
                  <span>{activeTableOrder ? 'SEND EXTRA ORDER (KOT)' : 'SEND KOT TO KITCHEN'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Running Active Order Review & Modify Screen */
        <div className="flex-1 p-4 overflow-y-auto bg-slate-900 max-w-4xl mx-auto w-full">
          {!activeTableOrder ? (
            <div className="py-16 text-center text-slate-500">
              <Utensils className="h-10 w-10 mx-auto mb-2 text-slate-600" />
              <h3 className="font-bold text-slate-300 text-sm">No Active Running Order on this Table</h3>
              <p className="text-xs text-slate-500 mt-1">Switch to "Take New Order" to start placing items.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-white">{activeTableOrder.tableName} — Running Bill</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Order #{activeTableOrder.orderNo} • {activeTableOrder.waiterName} • {activeTableOrder.items.length} items
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Payable</span>
                  <div className="text-lg font-black text-amber-400">
                    {currencySymbol} {activeTableOrder.grandTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Items List with Cancel and Replace Buttons */}
              <div className="space-y-2">
                {activeTableOrder.items.map((item, idx) => {
                  const isCancelled = item.status === 'cancelled';
                  const isReplaced = item.status === 'replaced';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        isCancelled
                          ? 'bg-rose-950/40 border-rose-800/60 opacity-60'
                          : isReplaced
                          ? 'bg-amber-950/40 border-amber-800/60 opacity-70'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-xs ${isCancelled ? 'line-through text-rose-300' : 'text-white'}`}>
                            {item.itemName}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 font-mono font-bold text-xs text-amber-300">
                            x{item.qty}
                          </span>
                          {item.kotNumber && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-900/70 text-indigo-200 text-[9px] font-bold">
                              KOT #{item.kotNumber}
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black uppercase">
                              Cancelled
                            </span>
                          )}
                          {isReplaced && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                              Replaced
                            </span>
                          )}
                        </div>
                        {item.cancellationReason && (
                          <p className="text-[10px] text-rose-400 mt-0.5">Reason: {item.cancellationReason}</p>
                        )}
                        {item.replacementReason && (
                          <p className="text-[10px] text-amber-400 mt-0.5">
                            Replaced with: {item.replacedWithItemName} ({item.replacementReason})
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-200">
                          {currencySymbol} {item.amount.toFixed(2)}
                        </span>

                        {!isCancelled && !isReplaced && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setItemToReplace(item);
                                setReplacementDish(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              title="Replace this dish with another item"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              <span>Replace</span>
                            </button>

                            <button
                              onClick={() => setItemToCancel(item)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              title="Cancel this item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CANCEL ITEM REASON MODAL */}
      {itemToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-500" />
                <span>Cancel Menu Item</span>
              </h3>
              <button onClick={() => setItemToCancel(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="font-bold text-white text-sm">{itemToCancel.itemName}</div>
              <div className="text-slate-400 mt-0.5">Quantity: {itemToCancel.qty} • Table: {selectedTable?.name}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 px-3 text-xs font-semibold outline-none"
              >
                <option value="Customer changed mind">Customer changed mind</option>
                <option value="Guest left / cancelled">Guest left / cancelled</option>
                <option value="Wrong item ordered by mistake">Wrong item ordered by mistake</option>
                <option value="Delayed preparation">Delayed preparation</option>
                <option value="Kitchen 86ed / Out of ingredients">Kitchen 86ed / Out of ingredients</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="restock-box"
                checked={restockOnCancel}
                onChange={e => setRestockOnCancel(e.target.checked)}
                className="rounded border-slate-700 h-4 w-4 text-blue-600 cursor-pointer"
              />
              <label htmlFor="restock-box" className="text-xs font-semibold text-slate-300 cursor-pointer">
                Return raw ingredients to store stock (Restock)
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setItemToCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Keep Item
              </button>
              <button
                onClick={handleConfirmCancelItem}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPLACE ITEM MODAL */}
      {itemToReplace && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                <span>Replace Menu Item</span>
              </h3>
              <button onClick={() => setItemToReplace(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-[10px] font-black uppercase text-rose-400">Current Item (To Replace):</span>
              <div className="font-bold text-white text-sm">{itemToReplace.itemName}</div>
              <div className="text-slate-400 mt-0.5">Price: {currencySymbol} {itemToReplace.rate} • Qty: {itemToReplace.qty}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Select Replacement Dish</label>
              <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 p-2 space-y-1">
                {items.filter(i => i['Item Code'] !== itemToReplace.itemCode).map(dish => (
                  <div
                    key={dish['Item Code']}
                    onClick={() => setReplacementDish(dish)}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                      replacementDish?.['Item Code'] === dish['Item Code']
                        ? 'bg-blue-600 text-white font-bold'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span>{dish['Item Name']}</span>
                    <span className="font-mono font-bold">{currencySymbol} {(dish['Sale Rate'] || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Reason for Replacement</label>
              <input
                type="text"
                value={replaceReason}
                onChange={e => setReplaceReason(e.target.value)}
                placeholder="Reason (e.g. Guest preference change)"
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-xs text-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setItemToReplace(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                disabled={!replacementDish}
                onClick={handleConfirmReplaceItem}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg"
              >
                Confirm Replacement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID ENTIRE ORDER MODAL */}
      {showVoidOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <span>Void Entire Table Order</span>
              </h3>
              <button onClick={() => setShowVoidOrderModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to cancel the entire order for <strong>{selectedTable?.name}</strong>? This will release the table and alert the kitchen to stop food preparation.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Cancellation Reason</label>
              <input
                type="text"
                value={voidOrderReason}
                onChange={e => setVoidOrderReason(e.target.value)}
                placeholder="Reason (e.g. Guests left, emergency)"
                className="w-full h-9 rounded-xl bg-slate-950 border border-slate-800 px-3 text-xs text-slate-200 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowVoidOrderModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Keep Order
              </button>
              <button
                onClick={handleConfirmVoidEntireOrder}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg"
              >
                Void Order &amp; Release Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

