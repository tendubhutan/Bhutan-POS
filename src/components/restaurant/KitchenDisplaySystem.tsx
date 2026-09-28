import React, { useState, useEffect } from 'react';
import { KitchenOrderTicket } from '../../types/restaurant';
import { getKitchenTickets, updateKOTStatus } from '../../services/restaurantService';
import { Utensils, CheckCircle2, Clock, AlertCircle, RefreshCw, X, Bell, Flame, AlertTriangle, ArrowRightLeft, Sparkles, Check } from 'lucide-react';
import { playWarningTone, playSuccessChime } from '../../utils/audio';

interface KDSProps {
  onClose?: () => void;
}

export const KitchenDisplaySystem: React.FC<KDSProps> = ({ onClose }) => {
  const [tickets, setTickets] = useState<KitchenOrderTicket[]>(() => getKitchenTickets());
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready' | 'alerts'>('pending');
  const [itemPrepState, setItemPrepState] = useState<Record<string, 'cooking' | 'ready'>>({});

  const refreshKOTs = () => {
    setTickets(getKitchenTickets());
  };

  useEffect(() => {
    refreshKOTs();
    const handleUpdate = () => {
      refreshKOTs();
      try {
        playSuccessChime();
      } catch {}
    };
    window.addEventListener('restaurant_data_updated', handleUpdate);
    const interval = setInterval(() => {
      setTickets(getKitchenTickets());
    }, 8000);
    return () => {
      window.removeEventListener('restaurant_data_updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleMarkReady = (kotId: string) => {
    updateKOTStatus(kotId, 'ready');
    refreshKOTs();
  };

  const handleMarkCompleted = (kotId: string) => {
    updateKOTStatus(kotId, 'completed');
    refreshKOTs();
  };

  const toggleItemReady = (ticketId: string, itemIdx: number) => {
    const key = `${ticketId}_${itemIdx}`;
    setItemPrepState(prev => ({
      ...prev,
      [key]: prev[key] === 'ready' ? 'cooking' : 'ready'
    }));
  };

  const alertTickets = tickets.filter(t => t.ticketType === 'item_cancellation' || t.ticketType === 'item_replacement' || t.ticketType === 'order_void');

  const filteredTickets = tickets.filter(t => {
    if (filter === 'alerts') return t.ticketType === 'item_cancellation' || t.ticketType === 'item_replacement' || t.ticketType === 'order_void';
    if (filter === 'pending') return (t.status === 'pending' || t.status === 'in_progress') && t.ticketType !== 'item_cancellation' && t.ticketType !== 'order_void';
    if (filter === 'ready') return t.status === 'ready';
    return true;
  });

  const getElapsedTime = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(elapsedMs / 60000);
    if (mins < 1) return 'Just now';
    return `${mins} min ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-3 sm:p-5 overflow-hidden">
      {/* KDS Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 text-slate-950 font-black shadow-lg animate-pulse">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Kitchen Display System (KDS)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold border border-amber-500/30">
                CHEF LIVE VIEW
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Real-time KOT tickets, running order add-ons &amp; cancellation alerts (Zero Billing/Financial Data)</p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending / Cooking ({tickets.filter(t => (t.status === 'pending' || t.status === 'in_progress') && t.ticketType !== 'item_cancellation' && t.ticketType !== 'order_void').length})
            </button>
            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'ready' ? 'bg-emerald-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ready ({tickets.filter(t => t.status === 'ready').length})
            </button>
            {alertTickets.length > 0 && (
              <button
                onClick={() => setFilter('alerts')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  filter === 'alerts' ? 'bg-rose-600 text-white shadow-md font-black' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Alerts ({alertTickets.length})</span>
              </button>
            )}
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'all' ? 'bg-blue-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={refreshKOTs}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title="Refresh KOTs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
              title="Close KDS"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Global Alert Banner for Recent Order Cancellations / Replacements */}
      {alertTickets.length > 0 && (
        <div className="mt-3 p-2.5 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 animate-bounce" />
            <span>
              <strong>KITCHEN ALERT:</strong> {alertTickets[0].alertMessage || 'Item modified or cancelled by staff/waiter.'}
            </span>
          </div>
          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-rose-500 text-white shrink-0">
            {alertTickets[0].tableName}
          </span>
        </div>
      )}

      {/* Tickets Grid */}
      <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-500 text-center">
            <Utensils className="h-12 w-12 text-slate-700 mb-2" />
            <h3 className="font-bold text-slate-400 text-base">No Kitchen Tickets in this view</h3>
            <p className="text-xs text-slate-600 mt-0.5">Orders sent from tables or waiter pad will pop up here live.</p>
          </div>
        ) : (
          filteredTickets.map(kot => {
            const isReady = kot.status === 'ready';
            const isQROrder = kot.isQROrder;
            const isCancelled = kot.ticketType === 'item_cancellation' || kot.ticketType === 'order_void';
            const isReplaced = kot.ticketType === 'item_replacement';
            const isExtraOrder = kot.ticketType === 'extra_order' || (kot.kotNumber && kot.kotNumber > 1);

            return (
              <div
                key={kot.id}
                className={`rounded-2xl border-2 p-4 flex flex-col justify-between shadow-xl transition-all ${
                  isCancelled
                    ? 'bg-rose-950/70 border-rose-500 ring-2 ring-rose-500/40'
                    : isReplaced
                    ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/40'
                    : isReady
                    ? 'bg-emerald-950/60 border-emerald-500'
                    : isExtraOrder
                    ? 'bg-indigo-950/70 border-indigo-400 ring-2 ring-indigo-400/30'
                    : isQROrder
                    ? 'bg-purple-950/50 border-purple-500'
                    : 'bg-slate-900 border-amber-500/70'
                }`}
              >
                <div>
                  {/* KOT Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-lg text-white tracking-tight">{kot.tableName}</span>
                        {isExtraOrder && (
                          <span className="px-1.5 py-0.5 bg-indigo-500 text-white rounded text-[9px] font-black uppercase tracking-wider animate-pulse">
                            ⚡ EXTRA #{kot.kotNumber || 2}
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black uppercase tracking-wider">
                            ⛔ CANCELLED
                          </span>
                        )}
                        {isReplaced && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded text-[9px] font-black uppercase tracking-wider">
                            🔄 REPLACED
                          </span>
                        )}
                        {isQROrder && (
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded text-[9px] font-bold">
                            QR GUEST
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Waiter: <span className="text-slate-200 font-bold">{kot.waiterName || 'Staff'}</span>
                        {kot.guestCount && <span className="text-slate-400 ml-1.5">• {kot.guestCount} Guests</span>}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-xs text-amber-400 block">{kot.id}</span>
                      <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1 font-mono mt-0.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {getElapsedTime(kot.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Alert Message Banner if any */}
                  {kot.alertMessage && (
                    <div className={`my-2 p-2 rounded-xl text-xs font-bold border ${
                      isCancelled
                        ? 'bg-rose-900/60 border-rose-500 text-rose-200'
                        : isReplaced
                        ? 'bg-amber-900/60 border-amber-400 text-amber-200'
                        : 'bg-indigo-900/60 border-indigo-400 text-indigo-200'
                    }`}>
                      {kot.alertMessage}
                    </div>
                  )}

                  {/* Customer Notes */}
                  {kot.customerNotes && !kot.alertMessage && (
                    <div className="my-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                      Note: {kot.customerNotes}
                    </div>
                  )}

                  {/* Cancelled Items List (if this ticket represents cancellations) */}
                  {kot.cancelledItems && kot.cancelledItems.length > 0 && (
                    <div className="my-2 p-2 rounded-xl bg-rose-950/80 border border-rose-600/60 space-y-1">
                      <div className="text-[10px] font-black uppercase text-rose-400 tracking-wider">Do Not Prepare (Cancelled):</div>
                      {kot.cancelledItems.map((cIt, cIdx) => (
                        <div key={cIdx} className="flex items-center justify-between text-xs text-rose-200 line-through">
                          <span>{cIt.itemName}</span>
                          <span className="font-bold">x{cIt.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Items List */}
                  {kot.items.length > 0 && (
                    <div className="my-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                      {kot.items.map((item, idx) => {
                        const isDone = itemPrepState[`${kot.id}_${idx}`] === 'ready';
                        return (
                          <div 
                            key={idx} 
                            onClick={() => toggleItemReady(kot.id, idx)}
                            className={`flex items-start justify-between gap-2 p-2 rounded-xl border cursor-pointer transition ${
                              isDone
                                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-100'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {item.isVeg !== undefined && (
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                )}
                                <span className={`font-bold text-xs ${isDone ? 'line-through text-emerald-300' : 'text-slate-100'}`}>
                                  {item.itemName}
                                </span>
                              </div>
                              {item.notes && (
                                <p className="text-[10px] text-amber-400 font-semibold italic mt-0.5">
                                  * {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 bg-slate-800 rounded font-black text-xs text-amber-300">
                                x{item.qty}
                              </span>
                              {isDone && <Check className="h-4 w-4 text-emerald-400" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Status Action Buttons */}
                <div className="pt-2 border-t border-slate-800">
                  {isCancelled ? (
                    <div className="text-center py-2 text-xs font-bold text-rose-400">
                      Cancelled by Service Staff
                    </div>
                  ) : isReady ? (
                    <button
                      onClick={() => handleMarkCompleted(kot.id)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>SERVED / COMPLETE</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkReady(kot.id)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
                    >
                      <Bell className="h-4 w-4" />
                      <span>MARK FOOD READY</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

