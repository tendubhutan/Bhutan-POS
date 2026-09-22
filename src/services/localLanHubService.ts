/**
 * Local WiFi Hub (Shop LAN Mode) Service
 * Enables consecutive sequential number dispatching across multiple offline counters on the same WiFi router.
 */

import { STORAGE_KEYS, loadJson, saveJson, nextCounter, formatVoucherNumber, getVoucherTypes, canCurrentDeviceBillOffline } from './storageService';
import { getActiveCompanyId } from './supabaseTenantService';

export interface LanTerminal {
  id: string;
  name: string;
  role: string;
  ip?: string;
  lastSeen: number;
  status: 'active' | 'idle' | 'offline';
  lastDispatchedNo?: string;
}

export interface DispatchedNumberLog {
  id: string;
  number: number;
  invoiceNo: string;
  terminalId: string;
  terminalName: string;
  timestamp: string;
  type: 'pos' | 'sales' | 'voucher';
  companyId?: string;
}

export interface LanHubConfig {
  enabled: boolean;
  role: 'host' | 'client' | 'auto';
  hostUrl: string; // e.g. "http://192.168.1.100:3000" or empty for auto/local
  shopRoomCode: string; // e.g. "THIMPHU-HO"
  autoFallbackToCounter: boolean;
}

const STORAGE_LAN_CONFIG = 'shop_lan_hub_config';
const STORAGE_DISPATCHED_LOGS = 'shop_lan_dispatched_logs';

export const DEFAULT_LAN_CONFIG: LanHubConfig = {
  enabled: true,
  role: 'auto',
  hostUrl: '',
  shopRoomCode: 'SHOP-LAN',
  autoFallbackToCounter: true
};

// In-memory runtime state for Hub
let activeBroadcastChannel: BroadcastChannel | null = null;
let activeChannelCompanyId: string = '';
let registeredTerminals: Map<string, LanTerminal> = new Map();
let dispatchedLogs: DispatchedNumberLog[] = [];

// Initialize BroadcastChannel for same-network / same-host inter-tab / inter-window sync
export function initLanBroadcastChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  const currentCompanyId = getActiveCompanyId();
  
  if (activeBroadcastChannel && activeChannelCompanyId === currentCompanyId) return;

  try {
    if (activeBroadcastChannel) {
      try { activeBroadcastChannel.close(); } catch {}
      activeBroadcastChannel = null;
    }
    const channelName = `shop_wifi_lan_hub_${currentCompanyId}`;
    activeChannelCompanyId = currentCompanyId;
    activeBroadcastChannel = new BroadcastChannel(channelName);
    activeBroadcastChannel.onmessage = (event) => {
      handleLanBroadcastMessage(event.data);
    };
  } catch (err) {
    console.warn('[LAN Hub] BroadcastChannel init error:', err);
  }
}

export function getLanHubConfig(): LanHubConfig {
  return loadJson<LanHubConfig>(STORAGE_LAN_CONFIG, DEFAULT_LAN_CONFIG);
}

export function saveLanHubConfig(cfg: Partial<LanHubConfig>): LanHubConfig {
  const current = getLanHubConfig();
  const updated = { ...current, ...cfg };
  saveJson(STORAGE_LAN_CONFIG, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lan_hub_config_changed', { detail: updated }));
  }
  return updated;
}

export function getDispatchedLogs(): DispatchedNumberLog[] {
  const cId = getActiveCompanyId();
  const list = loadJson<DispatchedNumberLog[]>(STORAGE_DISPATCHED_LOGS, []);
  return list.filter(l => !l.companyId || l.companyId === cId);
}

function saveDispatchedLog(log: DispatchedNumberLog) {
  const cId = getActiveCompanyId();
  const logWithTenant = { ...log, companyId: cId };
  const list = getDispatchedLogs();
  list.unshift(logWithTenant);
  // Keep last 100 records
  if (list.length > 100) list.length = 100;
  saveJson(STORAGE_DISPATCHED_LOGS, list);
  dispatchedLogs = list;
}

/**
 * Handle incoming LAN BroadcastChannel messages
 */
function handleLanBroadcastMessage(msg: any) {
  if (!msg || !msg.type) return;
  const currentCompanyId = getActiveCompanyId();
  if (msg.companyId && msg.companyId !== currentCompanyId) {
    return; // Strict tenant isolation guard
  }

  const config = getLanHubConfig();
  const isHost = config.role === 'host' || (config.role === 'auto' && typeof window !== 'undefined' && !config.hostUrl);

  if (msg.type === 'HEARTBEAT' && msg.terminal) {
    registeredTerminals.set(msg.terminal.id, {
      ...msg.terminal,
      lastSeen: Date.now(),
      status: 'active'
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lan_terminals_updated'));
    }
  } else if (msg.type === 'REQUEST_NUMBER' && isHost) {
    // Atomically dispatch next number as host
    const { reqId, isPOS, voucherTypeId, prefix, terminalId, terminalName } = msg;
    const dispatched = generateCentralNextNumber(isPOS, voucherTypeId, prefix, terminalId, terminalName);
    
    // Broadcast back the assignment
    if (activeBroadcastChannel) {
      activeBroadcastChannel.postMessage({
        type: 'ASSIGN_NUMBER',
        reqId,
        companyId: currentCompanyId,
        dispatched
      });
    }
  } else if (msg.type === 'ASSIGN_NUMBER' && msg.dispatched) {
    saveDispatchedLog(msg.dispatched);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lan_number_dispatched', { detail: msg.dispatched }));
    }
  }
}

/**
 * Central sequential number generator on Host PC
 */
export function generateCentralNextNumber(
  isPOS: boolean = true,
  voucherTypeId?: string,
  rawPrefix?: string,
  terminalId: string = 'C1',
  terminalName: string = 'Counter 1'
): DispatchedNumberLog {
  const counterKey = voucherTypeId ? `Voucher_${voucherTypeId}` : (isPOS ? 'POSInvoice' : 'SalesInvoice');
  const num = nextCounter(counterKey);
  
  const allVTypes = getVoucherTypes();
  const matchedVt = voucherTypeId ? allVTypes.find(v => v.id === voucherTypeId) : null;
  const prefix = rawPrefix || matchedVt?.prefix || (isPOS ? 'POS-' : 'SAL-');
  
  const formattedNo = formatVoucherNumber(prefix, num, matchedVt?.zeroPadding, matchedVt?.suffix);
  
  const log: DispatchedNumberLog = {
    id: `disp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    number: num,
    invoiceNo: formattedNo,
    terminalId,
    terminalName,
    companyId: getActiveCompanyId(),
    timestamp: new Date().toISOString(),
    type: isPOS ? 'pos' : 'sales'
  };

  saveDispatchedLog(log);
  return log;
}

/**
 * Request next consecutive number over Local WiFi LAN
 */
export async function requestLanConsecutiveNumber(params: {
  isPOS?: boolean;
  voucherTypeId?: string;
  prefix?: string;
  terminalId?: string;
  terminalName?: string;
}): Promise<{ ok: boolean; invoiceNo: string; number?: number; mode: 'lan_hub' | 'fallback_local' | 'restricted_offline'; error?: string }> {
  initLanBroadcastChannel();
  const config = getLanHubConfig();
  const terminalId = params.terminalId || 'C1';
  const terminalName = params.terminalName || `Counter ${terminalId}`;
  const isPOS = params.isPOS !== false;
  const currentCompanyId = getActiveCompanyId();

  // 1. Try local HTTP server endpoint if hostUrl is configured or on same origin
  const targetHost = config.hostUrl ? config.hostUrl.replace(/\/+$/, '') : '';
  const endpoint = targetHost ? `${targetHost}/api/lan-hub/request-number` : `/api/lan-hub/request-number`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s rapid LAN timeout

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPOS,
        voucherTypeId: params.voucherTypeId,
        prefix: params.prefix,
        terminalId,
        terminalName,
        shopRoomCode: config.shopRoomCode,
        companyId: currentCompanyId
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.invoiceNo) {
        saveDispatchedLog({
          id: `disp_${Date.now()}`,
          number: data.number || 0,
          invoiceNo: data.invoiceNo,
          terminalId,
          terminalName,
          companyId: currentCompanyId,
          timestamp: new Date().toISOString(),
          type: isPOS ? 'pos' : 'sales'
        });
        return {
          ok: true,
          invoiceNo: data.invoiceNo,
          number: data.number,
          mode: 'lan_hub'
        };
      }
    }
  } catch (httpErr) {
    // HTTP local server offline or unreachable, try BroadcastChannel host fallback
  }

  // 2. Try BroadcastChannel (for multiple tabs / windows on same machine or local PWA)
  if (activeBroadcastChannel) {
    try {
      const reqId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const result = await new Promise<{ ok: boolean; invoiceNo: string; number?: number }>((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ ok: false, invoiceNo: '' });
        }, 500);

        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'ASSIGN_NUMBER' && event.data?.reqId === reqId && event.data?.dispatched) {
            clearTimeout(timeout);
            activeBroadcastChannel?.removeEventListener('message', handler);
            resolve({
              ok: true,
              invoiceNo: event.data.dispatched.invoiceNo,
              number: event.data.dispatched.number
            });
          }
        };

        activeBroadcastChannel?.addEventListener('message', handler);
        activeBroadcastChannel?.postMessage({
          type: 'REQUEST_NUMBER',
          reqId,
          companyId: currentCompanyId,
          isPOS,
          voucherTypeId: params.voucherTypeId,
          prefix: params.prefix,
          terminalId,
          terminalName
        });
      });

      if (result.ok && result.invoiceNo) {
        return { ok: true, invoiceNo: result.invoiceNo, number: result.number, mode: 'lan_hub' };
      }
    } catch {}
  }

  // 3. Offline Single Master Check
  const offlineCheck = canCurrentDeviceBillOffline();
  if (!offlineCheck.allowed) {
    return {
      ok: false,
      invoiceNo: '',
      mode: 'restricted_offline',
      error: offlineCheck.reason
    };
  }

  // 4. If current device is the designated Master Offline Counter, generate sequentially
  const localDispatched = generateCentralNextNumber(isPOS, params.voucherTypeId, params.prefix, terminalId, terminalName);
  return {
    ok: true,
    invoiceNo: localDispatched.invoiceNo,
    number: localDispatched.number,
    mode: 'fallback_local'
  };
}

export function getActiveTerminalsList(): LanTerminal[] {
  const now = Date.now();
  const list: LanTerminal[] = [];
  registeredTerminals.forEach((term) => {
    const isRecent = (now - term.lastSeen) < 30000;
    list.push({
      ...term,
      status: isRecent ? 'active' : 'offline'
    });
  });
  return list;
}

export function broadcastTerminalHeartbeat(terminalId: string, terminalName: string, role: string) {
  initLanBroadcastChannel();
  const currentCompanyId = getActiveCompanyId();
  const terminal: LanTerminal = {
    id: terminalId,
    name: terminalName,
    role,
    lastSeen: Date.now(),
    status: 'active'
  };
  registeredTerminals.set(terminalId, terminal);

  if (activeBroadcastChannel) {
    activeBroadcastChannel.postMessage({
      type: 'HEARTBEAT',
      companyId: currentCompanyId,
      terminal
    });
  }
}
