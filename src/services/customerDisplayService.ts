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

export function broadcastCustomerDisplayState(state: CustomerDisplayState, targetCompanyId?: string): void {
  try {
    const cId = targetCompanyId || state.companyId;
    const jsonStr = JSON.stringify({ ...state, companyId: cId || state.companyId });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, jsonStr);
      if (cId) {
        localStorage.setItem(`${STORAGE_KEY}_${cId}`, jsonStr);
      }
      window.dispatchEvent(new Event('customer_display_updated'));
    }

    if (defaultBc) {
      defaultBc.postMessage(state);
    }

    if (cId && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const companyBc = new BroadcastChannel(`${BROADCAST_CHANNEL_NAME}_${cId}`);
        companyBc.postMessage(state);
        setTimeout(() => companyBc.close(), 100);
      } catch {}
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
