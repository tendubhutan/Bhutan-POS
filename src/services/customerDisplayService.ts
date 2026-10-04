import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CustomerDisplayItem {
  id: string;
  name: string;
  qty: number;
  rate: number;
  discount: number;
  amount: number;
  unit?: string;
  batchNo?: string;
  serialNos?: string[];
}

export interface CustomerDisplaySummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  itemCount: number;
  currencySymbol: string;
}

export interface CustomerDisplayState {
  companyId?: string;
  companyName: string;
  companyLogo?: string;
  terminalId: string;
  status: 'idle' | 'active' | 'payment_pending' | 'completed';
  cartItems: CustomerDisplayItem[];
  summary: CustomerDisplaySummary;
  paymentQrData?: string;
  paymentQrImage?: string;
  activeQrType?: 'primary' | 'secondary';
  lastCompletedInvoice?: {
    invoiceNo: string;
    grandTotal: number;
    paidAmount: number;
    changeAmount: number;
    paymentMode?: string;
  } | null;
  timestamp: number;
}

const STORAGE_KEY = 'deep_pos_customer_display_state';
const BROADCAST_CHANNEL_NAME = 'deep_pos_customer_display';

let defaultBc: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    defaultBc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  defaultBc = null;
}

// In-memory channel cache to reuse channels for fast broadcasting
const realtimeChannelMap = new Map<string, any>();

function getRealtimeChannel(cId: string) {
  if (!isSupabaseConfigured || !supabase) return null;
  const channelName = `customer_display_${cId}`;
  if (!realtimeChannelMap.has(channelName)) {
    const ch = supabase.channel(channelName);
    ch.subscribe();
    realtimeChannelMap.set(channelName, ch);
  }
  return realtimeChannelMap.get(channelName);
}

export function broadcastCustomerDisplayState(state: CustomerDisplayState, targetCompanyId?: string): void {
  try {
    const cId = targetCompanyId || state.companyId || 'default';
    const jsonStr = JSON.stringify({ ...state, companyId: cId });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      if (cId) {
        localStorage.setItem(`${STORAGE_KEY}_${cId}`, jsonStr);
      }
      window.dispatchEvent(new Event('customer_display_updated'));
    }

    if (defaultBc) {
      defaultBc.postMessage({ ...state, companyId: cId });
    }

    if (cId && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const companyBc = new BroadcastChannel(`${BROADCAST_CHANNEL_NAME}_${cId}`);
        companyBc.postMessage({ ...state, companyId: cId });
        setTimeout(() => companyBc.close(), 100);
      } catch {}
    }

    // Server-side Direct Relay Dispatch for Wireless Tablets
    if (typeof fetch !== 'undefined') {
      fetch('/api/customer-display/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      }).catch(() => {});
    }

    // Cross-device Wireless Sync via Supabase Broadcast
    if (isSupabaseConfigured && supabase) {
      const channel = getRealtimeChannel(cId);
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'customer_display_state',
          payload: { ...state, companyId: cId }
        }).catch((e: any) => console.warn('[CustomerDisplay] Realtime broadcast notice:', e));
      }

      // Persist live state to cloud DB so new/reconnecting tablets get instant sync
      Promise.resolve(
        supabase
          .from('tenant_settings')
          .upsert({
            company_id: cId,
            record_id: 'customer_display_live',
            data: { ...state, companyId: cId },
            updated_at: new Date().toISOString()
          })
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('[CustomerDisplay] Broadcast error:', err);
  }
}

export function getCustomerDisplayState(targetCompanyId?: string): CustomerDisplayState | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const companyRaw = targetCompanyId ? localStorage.getItem(`${STORAGE_KEY}_${targetCompanyId}`) : null;
      const mainRaw = localStorage.getItem(STORAGE_KEY);

      let companyState: CustomerDisplayState | null = companyRaw ? JSON.parse(companyRaw) : null;
      let mainState: CustomerDisplayState | null = mainRaw ? JSON.parse(mainRaw) : null;

      if (companyState && mainState) {
        return (companyState.timestamp || 0) >= (mainState.timestamp || 0) ? companyState : mainState;
      }
      return companyState || mainState;
    }
  } catch {}
  return null;
}

export async function fetchRemoteCustomerDisplayState(companyId?: string): Promise<CustomerDisplayState | null> {
  const cId = companyId || 'default';

  // 1. First try direct server relay endpoint (highest speed & reliability)
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch(`/api/customer-display/state?companyId=${encodeURIComponent(cId)}`);
      if (res.ok) {
        const serverState = await res.json();
        if (serverState && typeof serverState === 'object' && serverState.cartItems) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${STORAGE_KEY}_${cId}`, JSON.stringify(serverState));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState));
            window.dispatchEvent(new Event('customer_display_updated'));
          }
          return serverState as CustomerDisplayState;
        }
      }
    } catch {}
  }

  // 2. Fall back to Supabase DB if server endpoint is offline
  if (!isSupabaseConfigured || !supabase || !cId) return getCustomerDisplayState(cId);
  try {
    const { data: row, error } = await supabase
      .from('tenant_settings')
      .select('data')
      .eq('company_id', cId)
      .eq('record_id', 'customer_display_live')
      .maybeSingle();

    if (!error && row?.data && typeof row.data === 'object') {
      const remoteState = row.data as CustomerDisplayState;
      const localState = getCustomerDisplayState(companyId);

      if (!localState || (remoteState.timestamp || 0) >= (localState.timestamp || 0)) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`${STORAGE_KEY}_${companyId}`, JSON.stringify(remoteState));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
          window.dispatchEvent(new Event('customer_display_updated'));
        }
        return remoteState;
      }
    }
  } catch (e) {
    console.warn('[CustomerDisplay] fetchRemoteCustomerDisplayState error:', e);
  }
  return getCustomerDisplayState(companyId);
}

export function triggerCashDrawerKick(): void {
  try {
    // 1. WebUSB / WebSerial ESC/POS pulse command: ESC p 0 25 250 (\x1B\x70\x00\x19\xFA)
    const kickCommand = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

    if ('navigator' in window && 'serial' in (navigator as any)) {
      (navigator as any).serial.getPorts().then((ports: any[]) => {
        ports.forEach(async (port) => {
          try {
            await port.open({ baudRate: 9600 });
            const writer = port.writable.getWriter();
            await writer.write(kickCommand);
            writer.releaseLock();
            await port.close();
          } catch {}
        });
      }).catch(() => {});
    }

    // 2. Play physical cash register chime feedback audio
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12); // A6
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch {}

    window.dispatchEvent(new CustomEvent('cash_drawer_kicked', { detail: { timestamp: Date.now() } }));
  } catch (e) {
    console.warn('[CashDrawer] Trigger error:', e);
  }
}
