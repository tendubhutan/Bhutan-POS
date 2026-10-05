import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseCompany } from './supabaseTenantService';

export interface ClientStorageStats {
  companyId: string;
  companyName: string;
  totalBytes: number;
  totalRows: number;
  itemCount: number;
  voucherCount: number;
  invoiceCount: number;
  ledgerCount: number;
  settingsBytes: number;
  percentageOfTotal: number;
}

export interface SupabaseStorageOverview {
  totalBytesUsed: number;
  totalRowsCount: number;
  quotaBytes: number;
  balanceBytesRemaining: number;
  usagePercentage: number;
  clientStats: Record<string, ClientStorageStats>;
  lastScanned: number;
  activeRealtimeConnections: number;
  realtimeQuota: number;
  realtimeStatus: 'connected' | 'reconnecting' | 'offline';
  pingMs: number;
}

const STORAGE_QUOTA_KEY = 'superadmin_supabase_quota_mb';
const DEFAULT_QUOTA_MB = 500; // 500 MB Supabase Free Tier

export function getStorageQuotaMB(): number {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_QUOTA_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
  }
  return DEFAULT_QUOTA_MB;
}

export function setStorageQuotaMB(mb: number): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_QUOTA_KEY, mb.toString());
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size >= 100 ? Math.round(size) : size.toFixed(size < 10 ? 2 : 1)} ${units[i]}`;
}

export async function fetchSupabaseStorageStats(
  companies: SupabaseCompany[]
): Promise<SupabaseStorageOverview> {
  const quotaMB = getStorageQuotaMB();
  const quotaBytes = quotaMB * 1024 * 1024;
  const startPing = performance.now();

  const clientStats: Record<string, ClientStorageStats> = {};
  companies.forEach(c => {
    clientStats[c.id] = {
      companyId: c.id,
      companyName: c.company_name,
      totalBytes: 1024, // base metadata overhead
      totalRows: 1, // company row itself
      itemCount: 0,
      voucherCount: 0,
      invoiceCount: 0,
      ledgerCount: 0,
      settingsBytes: 0,
      percentageOfTotal: 0
    };
  });

  let pingMs = 28;
  let totalBytesUsed = 0;
  let totalRowsCount = 0;

  if (isSupabaseConfigured) {
    // 1. Measure live latency ping to Supabase
    try {
      await supabase.from('companies').select('id', { count: 'exact', head: true });
      pingMs = Math.max(12, Math.round(performance.now() - startPing));
    } catch {
      pingMs = 28;
    }

    // 2. Fetch tenant_settings (stores documents, configs, logos, backups, employee modules)
    try {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('company_id, record_id, data');

      (settings || []).forEach(s => {
        if (s.company_id && clientStats[s.company_id]) {
          const jsonStr = JSON.stringify(s.data || {});
          const bytes = (typeof TextEncoder !== 'undefined')
            ? new TextEncoder().encode(jsonStr).length
            : jsonStr.length;

          clientStats[s.company_id].settingsBytes += bytes;
          clientStats[s.company_id].totalBytes += bytes;
          clientStats[s.company_id].totalRows += 1;
        }
      });
    } catch (err) {
      console.warn('[SupabaseStorageStats] tenant_settings fetch warning:', err);
    }

    // 3. Fetch items count per company
    try {
      const { data: items } = await supabase
        .from('items')
        .select('company_id');

      (items || []).forEach(i => {
        if (i.company_id && clientStats[i.company_id]) {
          clientStats[i.company_id].itemCount += 1;
          clientStats[i.company_id].totalRows += 1;
          clientStats[i.company_id].totalBytes += 480; // avg Postgres item row + indices
        }
      });
    } catch (err) {
      console.warn('[SupabaseStorageStats] items fetch warning:', err);
    }

    // 4. Fetch vouchers count per company
    try {
      const { data: vouchers } = await supabase
        .from('vouchers')
        .select('company_id');

      (vouchers || []).forEach(v => {
        if (v.company_id && clientStats[v.company_id]) {
          clientStats[v.company_id].voucherCount += 1;
          clientStats[v.company_id].totalRows += 1;
          clientStats[v.company_id].totalBytes += 750; // avg Postgres double-entry voucher
        }
      });
    } catch (err) {
      console.warn('[SupabaseStorageStats] vouchers fetch warning:', err);
    }

    // 5. Fetch sales invoices count
    try {
      const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('company_id');

      (invoices || []).forEach(inv => {
        if (inv.company_id && clientStats[inv.company_id]) {
          clientStats[inv.company_id].invoiceCount += 1;
          clientStats[inv.company_id].totalRows += 1;
          clientStats[inv.company_id].totalBytes += 1200; // invoice + items payload
        }
      });
    } catch (err) {
      console.warn('[SupabaseStorageStats] sales_invoices fetch warning:', err);
    }

    // 6. Fetch ledgers count
    try {
      const { data: ledgers } = await supabase
        .from('ledgers')
        .select('company_id');

      (ledgers || []).forEach(l => {
        if (l.company_id && clientStats[l.company_id]) {
          clientStats[l.company_id].ledgerCount += 1;
          clientStats[l.company_id].totalRows += 1;
          clientStats[l.company_id].totalBytes += 350;
        }
      });
    } catch (err) {
      console.warn('[SupabaseStorageStats] ledgers fetch warning:', err);
    }
  }

  // Calculate totals and percentages
  Object.values(clientStats).forEach(cs => {
    totalBytesUsed += cs.totalBytes;
    totalRowsCount += cs.totalRows;
  });

  if (totalBytesUsed > 0) {
    Object.values(clientStats).forEach(cs => {
      cs.percentageOfTotal = parseFloat(((cs.totalBytes / totalBytesUsed) * 100).toFixed(1));
    });
  }

  const balanceBytesRemaining = Math.max(0, quotaBytes - totalBytesUsed);
  const usagePercentage = parseFloat(Math.min(100, (totalBytesUsed / quotaBytes) * 100).toFixed(2));

  return {
    totalBytesUsed,
    totalRowsCount,
    quotaBytes,
    balanceBytesRemaining,
    usagePercentage,
    clientStats,
    lastScanned: Date.now(),
    activeRealtimeConnections: Math.max(1, companies.length),
    realtimeQuota: 200, // Supabase standard tier concurrent connections
    realtimeStatus: isSupabaseConfigured ? 'connected' : 'offline',
    pingMs
  };
}
