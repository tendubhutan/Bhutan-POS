import React, { useState, useEffect, useRef } from 'react';
import { Config } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getActiveCompanyId, DEFAULT_TENANT_COMPANY } from '../services/supabaseTenantService';
import {
  getCustomerDisplayState,
  fetchRemoteCustomerDisplayState,
  CustomerDisplayState,
  CustomerDisplayItem
} from '../services/customerDisplayService';
import {
  Monitor,
  QrCode,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Building2,
  ArrowRight,
  Receipt,
  Smartphone,
  X
} from 'lucide-react';

interface CustomerDisplayViewProps {
  config: Config;
  onClose?: () => void;
}

export const CustomerDisplayView: React.FC<CustomerDisplayViewProps> = ({ config, onClose }) => {
  const urlCompanyId = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('companyId') || new URLSearchParams(window.location.search).get('company') || getActiveCompanyId())
    : getActiveCompanyId();

  const [displayState, setDisplayState] = useState<CustomerDisplayState | null>(() => getCustomerDisplayState(urlCompanyId));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTabletQrModal, setShowTabletQrModal] = useState(false);

  // Keep a persistent hold on the "completed / thank you" screen so it is not instantly overridden by a cleared cart
  const [completedHoldState, setCompletedHoldState] = useState<CustomerDisplayState | null>(null);
  const completedTimerRef = useRef<any>(null);

  const applyNewState = (incoming: CustomerDisplayState | null) => {
    if (!incoming) return;

    // 1. Check if transaction is completed and we should trigger a hold screen
    if (incoming.status === 'completed' && incoming.lastCompletedInvoice) {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
      }
      setCompletedHoldState(incoming);
      
      // Keep displaying the thank you screen for 15 seconds, or until a new transaction starts
      completedTimerRef.current = setTimeout(() => {
        setCompletedHoldState(null);
      }, 15000);
    } 
    // 2. If cashier starts scanning a new active cart, immediately dismiss the completed screen
    else if (incoming.status === 'active' && incoming.cartItems && incoming.cartItems.length > 0) {
      if (completedTimerRef.current) {
        clearTimeout(completedTimerRef.current);
        completedTimerRef.current = null;
      }
      setCompletedHoldState(null);
    }

    // Always update displayState as the underlying model
    setDisplayState(prev => {
      if (!prev) return incoming;
      if ((incoming.timestamp || 0) >= (prev.timestamp || 0)) {
        return incoming;
      }
      return prev;
    });
  };

  // Fetch remote display state on load for wireless tablets
  useEffect(() => {
    if (urlCompanyId) {
      fetchRemoteCustomerDisplayState(urlCompanyId).then(st => {
        if (st) applyNewState(st);
      }).catch(() => {});
    }
  }, [urlCompanyId]);

  // Sync state via Supabase Realtime, BroadcastChannel, Storage Events, and Failsafe Interval
  useEffect(() => {
    const handleSync = async () => {
      const latestLocal = getCustomerDisplayState(urlCompanyId) || getCustomerDisplayState();
      applyNewState(latestLocal);
      try {
        const latestRemote = await fetchRemoteCustomerDisplayState(urlCompanyId);
        if (latestRemote) applyNewState(latestRemote);
      } catch {}
    };

    handleSync();

    // 1. Same-device BroadcastChannel
    let bcDefault: BroadcastChannel | null = null;
    let bcCompany: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bcDefault = new BroadcastChannel('deep_pos_customer_display');
        bcDefault.onmessage = (event) => {
          if (event.data) applyNewState(event.data);
        };

        if (urlCompanyId) {
          bcCompany = new BroadcastChannel(`deep_pos_customer_display_${urlCompanyId}`);
          bcCompany.onmessage = (event) => {
            if (event.data) applyNewState(event.data);
          };
        }
      }
    } catch {}

    // 2. Cross-device Wireless Real-time Sync via Supabase Realtime Channel
    let sbChannel: any = null;
    try {
      if (isSupabaseConfigured && supabase) {
        const cName = `customer_display_${urlCompanyId || 'default'}`;
        sbChannel = supabase.channel(cName);
        sbChannel
          .on('broadcast', { event: 'customer_display_state' }, (payload: any) => {
            if (payload && payload.payload) {
              applyNewState(payload.payload);
            }
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('[CustomerDisplayView] Realtime subscribe error:', err);
    }

    const interval = setInterval(handleSync, 500);

    window.addEventListener('storage', handleSync);
    window.addEventListener('customer_display_updated', handleSync);

    return () => {
      if (bcDefault) bcDefault.close();
      if (bcCompany) bcCompany.close();
      if (sbChannel && supabase) {
        try { supabase.removeChannel(sbChannel); } catch {}
      }
      clearInterval(interval);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('customer_display_updated', handleSync);
    };
  }, [urlCompanyId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const activeState = completedHoldState || displayState;

  const currSymbol = activeState?.summary?.currencySymbol || config.CurrencySymbol || 'Nu.';
  const companyName = activeState?.companyName || config.CompanyName || DEFAULT_TENANT_COMPANY.company_name;

  // Construct Dynamic Payment QR URL
  const grandTotal = activeState?.summary?.grandTotal || 0;
  const rawQrTemplate = activeState?.paymentQrData || (config as any).BankQrData || (config as any).MerchantQrCode || '';
  let paymentQrUrl = '';

  if (grandTotal > 0) {
    if (rawQrTemplate) {
      // Append or replace amount param if dynamic
      let formattedQrData = rawQrTemplate;
      if (formattedQrData.includes('{amount}')) {
        formattedQrData = formattedQrData.replace('{amount}', grandTotal.toFixed(2));
      } else if (formattedQrData.startsWith('upi://') || formattedQrData.startsWith('mbob://')) {
        formattedQrData = `${formattedQrData}&am=${grandTotal.toFixed(2)}`;
      } else {
        formattedQrData = `${formattedQrData}?amount=${grandTotal.toFixed(2)}`;
      }
      paymentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(formattedQrData)}&margin=1`;
    } else {
      // Fallback dynamic QR pay payload
      const defaultPayPayload = `PAYMENT TO ${companyName.toUpperCase()} | TOTAL: ${currSymbol} ${grandTotal.toFixed(2)}`;
      paymentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(defaultPayPayload)}&margin=1`;
    }
  }

  const items: CustomerDisplayItem[] = activeState?.cartItems || [];

  // Auto-scroll ref and hook for live checkout items (fully dynamic and responsive)
  const itemsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (itemsEndRef.current) {
      itemsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [items.length]);

  const status = activeState?.status || 'idle';
  const isCompleted = status === 'completed' && activeState?.lastCompletedInvoice;

  // Tablet Share URL
  const currentUrl = typeof window !== 'undefined'
    ? `${window.location.href.split('?')[0]}?portal=display&companyId=${encodeURIComponent(urlCompanyId || '')}`
    : '';
  const tabletQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&margin=1`;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black">
            {activeState?.companyLogo ? (
              <img src={activeState.companyLogo} alt={companyName} className="w-8 h-8 object-contain rounded-xl" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>{companyName}</span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Customer Terminal Display</span>
              {activeState?.terminalId && <span className="text-indigo-400 font-bold">({activeState.terminalId})</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTabletQrModal(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Scan with tablet or smartphone"
          >
            <Smartphone className="h-4 w-4 text-indigo-400" />
            <span className="hidden sm:inline">Connect Tablet / Wireless</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Toggle Fullscreen Mode"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-rose-900/50 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 rounded-xl transition cursor-pointer"
              title="Close Customer Display"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col">
        {/* VIEW 1: PAYMENT COMPLETED STATE */}
        {isCompleted ? (
          <div className="my-auto bg-slate-900/90 border-2 border-emerald-500/50 rounded-3xl p-8 sm:p-10 text-center max-w-2xl mx-auto space-y-6 shadow-2xl shadow-emerald-950/60 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400/60 flex items-center justify-center text-emerald-400 mx-auto animate-bounce shadow-xl">
              <CheckCircle2 className="h-12 w-12" />
            </div>

            <div className="space-y-2">
              <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-black tracking-widest uppercase shadow-sm">
                ✔ TRANSACTION COMPLETED
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
                Thank You for Shopping with Us!
              </h2>
              <p className="text-indigo-300 font-extrabold text-xl sm:text-2xl mt-1 tracking-wide">
                Please Visit Again! Have a Wonderful Day! 🌟
              </p>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 grid grid-cols-2 gap-4 text-left font-mono">
              <div>
                <span className="text-xs text-slate-400 block font-semibold">Invoice Number</span>
                <span className="text-base font-extrabold text-white">{activeState.lastCompletedInvoice?.invoiceNo}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold">Total Amount Paid</span>
                <span className="text-xl font-black text-emerald-400">
                  {currSymbol} {activeState.lastCompletedInvoice?.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {Number(activeState.lastCompletedInvoice?.changeAmount || 0) > 0 && (
                <div className="col-span-2 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm text-amber-400 font-sans font-extrabold">Change Balance Returned:</span>
                  <span className="text-xl font-black text-amber-400">
                    {currSymbol} {activeState.lastCompletedInvoice?.changeAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              <span>Display will reset automatically for the next customer</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* VIEW 2: IDLE STATE (WELCOME) */
          <div className="my-auto text-center space-y-6 max-w-lg mx-auto py-12">
            <div className="w-24 h-24 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto shadow-xl shadow-indigo-950/50">
              <ShoppingBag className="h-12 w-12" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Welcome to {companyName}</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Your scanned items, live totals, and dynamic payment QR code will appear here as the cashier rings up your purchase.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Ready for Next Checkout</span>
            </div>
          </div>
        ) : (
          /* VIEW 3: ACTIVE checkout Billed ITEM LIST + BILL SUMMARY & PAYMENT QR */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
            {/* Left Column: Billed Items List */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col min-h-0 lg:min-h-[500px] transition-all duration-300">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-indigo-400" />
                  <span className="font-extrabold text-sm text-white uppercase tracking-wider">Billed Items List</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-bold">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[260px] lg:max-h-[520px]">
                {items.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-white truncate">{item.name}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono pl-7">
                        <span>
                          {item.qty} {item.unit || 'pcs'} × {currSymbol} {item.rate.toFixed(2)}
                        </span>
                        {item.discount > 0 && (
                          <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.2 rounded text-[10px] font-bold">
                            -{currSymbol} {item.discount.toFixed(2)} Off
                          </span>
                        )}
                        {item.batchNo && <span className="text-indigo-400">Batch: {item.batchNo}</span>}
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <span className="text-base font-black text-white">
                        {currSymbol} {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                {/* Invisible Auto-Scroll Anchor */}
                <div ref={itemsEndRef} />
              </div>
            </div>

            {/* Right Column: Billing Summary & Dynamic Payment QR Code */}
            <div className="lg:col-span-5 space-y-4">
              {/* Bill Summary Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-extrabold text-sm text-slate-300 uppercase tracking-wider">Billing Summary</span>
                  <span className="text-xs text-slate-400 font-mono">LIVE TOTAL</span>
                </div>

                <div className="space-y-2.5 font-mono text-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Items Subtotal</span>
                    <span>{currSymbol} {(activeState?.summary?.subtotal || 0).toFixed(2)}</span>
                  </div>

                  {(activeState?.summary?.discountTotal || 0) > 0 && (
                    <div className="flex items-center justify-between text-emerald-400">
                      <span>Total Savings / Discount</span>
                      <span>-{currSymbol} {(activeState?.summary?.discountTotal || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {(activeState?.summary?.taxTotal || 0) > 0 && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>GST / Taxes</span>
                      <span>+{currSymbol} {(activeState?.summary?.taxTotal || 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">Payable Amount</span>
                    <span className="text-3xl font-black text-emerald-400 tracking-tight">
                      {currSymbol} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic / Uploaded Payment QR Code Card */}
              {grandTotal > 0 && (() => {
                const uploadedQrImage = (config as any).CompanyBankQrImage || (config as any).BankQrImage || (activeState?.paymentQrData?.startsWith('data:image') ? activeState.paymentQrData : '');

                return (
                  <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-5 shadow-2xl text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                      <QrCode className="h-4 w-4 text-indigo-400" />
                      <span>Scan QR to Pay {currSymbol} {grandTotal.toFixed(2)}</span>
                    </div>

                    {uploadedQrImage ? (
                      <div className="bg-white p-3 rounded-2xl inline-block shadow-xl border-2 border-indigo-400/50 max-w-[240px]">
                        <img src={uploadedQrImage} alt="Official Bank QR Code" className="w-48 h-48 object-contain mx-auto rounded-lg" />
                        <span className="text-[10px] text-slate-700 font-extrabold block mt-1.5 uppercase">Official Bank QR Code</span>
                      </div>
                    ) : paymentQrUrl ? (
                      <div className="bg-white p-3 rounded-2xl inline-block shadow-xl border-2 border-indigo-400/50">
                        <img src={paymentQrUrl} alt="Scan QR Code to Pay" className="w-48 h-48 object-contain mx-auto" />
                      </div>
                    ) : null}

                    <div className="text-[11px] text-slate-400 leading-tight">
                      <span>Scan with mobile banking app (mBoB, B-Wallet, mPAY, UPI, or Camera). Pay {currSymbol} {grandTotal.toFixed(2)}.</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer className="px-6 py-3 bg-slate-900/80 border-t border-slate-800 text-center text-xs text-slate-500 flex items-center justify-between gap-4">
        <span>{companyName} Customer Checkout Display</span>
        <span className="font-mono text-[10px]">Powered by Google AI Studio Build</span>
      </footer>

      {/* MODAL: Tablet / Wireless Pairing QR Modal */}
      {showTabletQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-indigo-400" />
                <span>Connect Wireless Tablet Display</span>
              </h3>
              <button
                onClick={() => setShowTabletQrModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Scan this QR code using an iPad, Android tablet, or smartphone on your WiFi network to open the Customer Display wirelessly.
            </p>

            <div className="bg-white p-3 rounded-2xl inline-block shadow-lg border border-slate-700">
              <img src={tabletQrUrl} alt="Tablet Connect QR Code" className="w-44 h-44 object-contain mx-auto" />
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300 break-all">
              {currentUrl}
            </div>

            <button
              onClick={() => setShowTabletQrModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
