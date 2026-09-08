import React, { useState, useMemo, useEffect } from 'react';
import { Config, AuditLogEntry, AuditActionType, AppUser } from '../types';
import { 
  getAuditLogs, 
  canUserViewAuditTrail, 
  getActiveUser, 
  clearAuditLogs, 
  saveConfig,
  getUsers
} from '../services/storageService';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Filter, 
  Search, 
  Calendar, 
  User, 
  Download, 
  Printer, 
  RotateCcw, 
  FileText, 
  Trash2, 
  PlusCircle, 
  Edit3, 
  Ban, 
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';

interface AuditLogViewProps {
  config: Config;
  onConfigChange?: (newConfig: Config) => void;
  onClose?: () => void;
  compact?: boolean;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  config,
  onConfigChange,
  onClose,
  compact = false
}) => {
  const [activeUser, setActiveUserState] = useState<AppUser>(getActiveUser());
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Date Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [datePreset, setDatePreset] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Selected Log for detail modal
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  // Users list for dropdown
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);

  // Reload logs
  const reloadLogs = () => {
    setLoading(true);
    try {
      const loaded = getAuditLogs();
      setLogs(loaded);
      setAllUsers(getUsers());
      setActiveUserState(getActiveUser());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadLogs();
  }, []);

  // Check role authorization
  const isAuthorized = canUserViewAuditTrail(activeUser);

  // Handle Preset Date selection
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const formatYMD = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(formatYMD(now));
      setToDate(formatYMD(now));
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      setFromDate(formatYMD(y));
      setToDate(formatYMD(y));
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(now.getDate() - 7);
      setFromDate(formatYMD(w));
      setToDate(formatYMD(now));
    } else if (preset === 'month') {
      const m = new Date(now);
      m.setDate(1);
      setFromDate(formatYMD(m));
      setToDate(formatYMD(now));
    }
  };

  // Extract unique modules for dropdown
  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Extract unique users from logs
  const uniqueLogUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      if (l.userId) {
        map.set(l.userId, l.userName || l.userRole || l.userId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(entry => {
      // Action Filter
      if (actionFilter !== 'ALL' && entry.action !== actionFilter) {
        return false;
      }

      // User Filter
      if (userFilter !== 'ALL' && entry.userId !== userFilter && entry.userName !== userFilter) {
        return false;
      }

      // Module Filter
      if (moduleFilter !== 'ALL' && entry.module !== moduleFilter) {
        return false;
      }

      // Date Range Filter
      if (fromDate || toDate) {
        const entryDate = (entry.timestamp || '').split('T')[0];
        if (fromDate && entryDate < fromDate) return false;
        if (toDate && entryDate > toDate) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const recId = (entry.recordId || '').toLowerCase();
        const party = (entry.partyName || '').toLowerCase();
        const uName = (entry.userName || '').toLowerCase();
        const uRole = (entry.userRole || '').toLowerCase();
        const mod = (entry.module || '').toLowerCase();
        const det = (entry.details || '').toLowerCase();

        return recId.includes(q) || party.includes(q) || uName.includes(q) || uRole.includes(q) || mod.includes(q) || det.includes(q);
      }

      return true;
    });
  }, [logs, actionFilter, userFilter, moduleFilter, fromDate, toDate, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    let entered = 0;
    let altered = 0;
    let cancelled = 0;
    let deleted = 0;

    filteredLogs.forEach(l => {
      if (l.action === 'ENTERED') entered++;
      else if (l.action === 'ALTERED') altered++;
      else if (l.action === 'CANCELLED') cancelled++;
      else if (l.action === 'DELETED') deleted++;
    });

    return { total: filteredLogs.length, entered, altered, cancelled, deleted };
  }, [filteredLogs]);

  // Format timestamp helper
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No audit log records to export');
      return;
    }

    const headers = [
      'Log ID',
      'Date & Time',
      'Action',
      'Module / Doc Type',
      'Voucher / Ref No',
      'Party / Account',
      'Amount (Nu.)',
      'User Full Name',
      'User Role',
      'User ID',
      'Change Details'
    ];

    const rows = filteredLogs.map(l => [
      `"${l.id || ''}"`,
      `"${formatDateTime(l.timestamp)}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.recordId || ''}"`,
      `"${(l.partyName || '').replace(/"/g, '""')}"`,
      l.amount !== undefined ? Number(l.amount).toFixed(2) : '',
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${(l.userRole || '').replace(/"/g, '""')}"`,
      `"${l.userId || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Trail_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Audit Trail
  const handlePrint = () => {
    window.print();
  };

  // Clear Audit Logs (Administrator only)
  const handleClearLogs = () => {
    const roleLower = (activeUser.role || '').toLowerCase();
    if (!roleLower.includes('admin')) {
      alert('Only Administrators are authorized to clear audit trail logs.');
      return;
    }

    if (window.confirm('Are you sure you want to permanently clear all audit trail records? This action cannot be undone.')) {
      clearAuditLogs();
      reloadLogs();
    }
  };

  // Toggle Audit Trail status
  const handleToggleAuditTrail = (enable: boolean) => {
    const updated = {
      ...config,
      EnableAuditTrail: enable ? 'true' : 'false'
    };
    saveConfig(updated);
    if (onConfigChange) {
      onConfigChange(updated);
    }
  };

  // Action badge helper
  const renderActionBadge = (action: AuditActionType) => {
    switch (action) {
      case 'ENTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <PlusCircle className="h-3 w-3 text-emerald-600" />
            <span>ENTERED</span>
          </span>
        );
      case 'ALTERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Edit3 className="h-3 w-3 text-amber-600" />
            <span>ALTERED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            <Ban className="h-3 w-3 text-orange-600" />
            <span>CANCELLED</span>
          </span>
        );
      case 'DELETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <Trash2 className="h-3 w-3 text-rose-600" />
            <span>DELETED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            {action}
          </span>
        );
    }
  };

  // Role Restriction Check Screen
  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-white border border-rose-200 rounded-3xl shadow-lg text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            The Audit Trail & Activity Log contains sensitive security and operational records. It is exclusively restricted to <strong>Administrator</strong> and <strong>Manager</strong> roles.
          </p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-center gap-2">
          <span>Current Active User:</span>
          <span className="font-bold text-slate-900">{activeUser.fullName || activeUser.username}</span>
          <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[10px] uppercase font-bold">{activeUser.role}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition shadow-sm cursor-pointer"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const isAuditEnabled = config.EnableAuditTrail !== 'false';

  return (
    <div className="space-y-4 font-sans">
      {/* Top Banner if Audit Trail is disabled */}
      {!isAuditEnabled && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Audit Trail Logging is currently disabled in Settings.</strong> New entries, edits, cancellations, and deletions are not being recorded.
            </span>
          </div>
          <button
            onClick={() => handleToggleAuditTrail(true)}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition cursor-pointer whitespace-nowrap text-xs shadow-xs"
          >
            Enable Audit Trail
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-inner">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900">Audit Trail & Security Activity Log</h1>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Admin & Manager Exclusive
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tamper-evident operational audit trail tracking entered by, altered by, cancelled by, and deleted by history.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={reloadLogs}
            className="h-8 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            title="Refresh Audit Trail"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
            title="Print Audit Log"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>Print</span>
          </button>

          {(activeUser.role || '').toLowerCase().includes('admin') && (
            <button
              onClick={handleClearLogs}
              className="h-8 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
              title="Clear Log History (Admin only)"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Clear History</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer shadow-2xs"
              title="Close View"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div 
          onClick={() => setActionFilter('ALL')}
          className={`p-3 rounded-2xl border transition cursor-pointer shadow-2xs ${
            actionFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-semibold opacity-75">All Activity</div>
          <div className="text-xl font-extrabold mt-0.5 font-mono">{stats.total}</div>
        </div>

        <div 
          onClick={() => setActionFilter('ENTERED')}
          className={`p-3 rounded-2xl border transition cursor-pointer shadow-2xs ${
            actionFilter === 'ENTERED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50/60'
          }`}
        >
          <div className="text-[11px] font-semibold flex items-center gap-1">
            <PlusCircle className="h-3 w-3" />
            <span>Entered By</span>
          </div>
          <div className="text-xl font-extrabold mt-0.5 font-mono">{stats.entered}</div>
        </div>

        <div 
          onClick={() => setActionFilter('ALTERED')}
          className={`p-3 rounded-2xl border transition cursor-pointer shadow-2xs ${
            actionFilter === 'ALTERED' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50/60'
          }`}
        >
          <div className="text-[11px] font-semibold flex items-center gap-1">
            <Edit3 className="h-3 w-3" />
            <span>Altered By</span>
          </div>
          <div className="text-xl font-extrabold mt-0.5 font-mono">{stats.altered}</div>
        </div>

        <div 
          onClick={() => setActionFilter('CANCELLED')}
          className={`p-3 rounded-2xl border transition cursor-pointer shadow-2xs ${
            actionFilter === 'CANCELLED' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-orange-900 border-orange-200 hover:bg-orange-50/60'
          }`}
        >
          <div className="text-[11px] font-semibold flex items-center gap-1">
            <Ban className="h-3 w-3" />
            <span>Cancelled By</span>
          </div>
          <div className="text-xl font-extrabold mt-0.5 font-mono">{stats.cancelled}</div>
        </div>

        <div 
          onClick={() => setActionFilter('DELETED')}
          className={`p-3 rounded-2xl border transition cursor-pointer shadow-2xs ${
            actionFilter === 'DELETED' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-50/60'
          }`}
        >
          <div className="text-[11px] font-semibold flex items-center gap-1">
            <Trash2 className="h-3 w-3" />
            <span>Deleted By</span>
          </div>
          <div className="text-xl font-extrabold mt-0.5 font-mono">{stats.deleted}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search voucher, party, user..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          {/* Action Type Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Actions (Enter/Alter/Cancel/Delete)</option>
              <option value="ENTERED">🟢 Only Entered By</option>
              <option value="ALTERED">🟡 Only Altered By</option>
              <option value="CANCELLED">🟠 Only Cancelled By</option>
              <option value="DELETED">🔴 Only Deleted By</option>
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Modules / Documents</option>
              {uniqueModules.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Users</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username} ({u.role})
                </option>
              ))}
              {uniqueLogUsers
                .filter(lu => !allUsers.some(au => au.id === lu.id))
                .map(lu => (
                  <option key={lu.id} value={lu.id}>{lu.name}</option>
                ))}
            </select>
          </div>

          {/* Date Presets */}
          <div className="flex items-center gap-1.5">
            <select
              value={datePreset}
              onChange={e => handleDatePreset(e.target.value)}
              className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Date: Today</option>
              <option value="yesterday">Date: Yesterday</option>
              <option value="week">Date: Last 7 Days</option>
              <option value="month">Date: This Month</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Row */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">Custom Date Range:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={e => {
                setFromDate(e.target.value);
                setDatePreset('custom');
              }}
              className="h-7 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-indigo-600"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={e => {
                setToDate(e.target.value);
                setDatePreset('custom');
              }}
              className="h-7 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:border-indigo-600"
            />
          </div>

          {(actionFilter !== 'ALL' || userFilter !== 'ALL' || moduleFilter !== 'ALL' || searchQuery || fromDate || toDate) && (
            <button
              onClick={() => {
                setActionFilter('ALL');
                setUserFilter('ALL');
                setModuleFilter('ALL');
                setSearchQuery('');
                setDatePreset('all');
                setFromDate('');
                setToDate('');
              }}
              className="ml-auto text-xs text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Date & Timestamp</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Action</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Module</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Voucher / Ref No</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Party / Account</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Amount (Nu.)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Performed By</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Change Detail / Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 text-sm">No Audit Trail Records Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {logs.length === 0 
                        ? 'Operational events will be recorded here automatically when vouchers, invoices, or masters are created, modified, cancelled, or deleted.'
                        : 'Try adjusting your filters or search terms above.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(entry => {
                  const hasAmountChange = entry.prevAmount !== undefined && entry.amount !== undefined && entry.prevAmount !== entry.amount;

                  return (
                    <tr 
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="hover:bg-indigo-50/40 transition cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {formatDateTime(entry.timestamp)}
                      </td>

                      {/* Action */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {renderActionBadge(entry.action)}
                      </td>

                      {/* Module */}
                      <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-800">
                        {entry.module}
                      </td>

                      {/* Record ID / Voucher No */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono font-bold text-indigo-900 group-hover:text-indigo-600">
                        {entry.recordId || '-'}
                      </td>

                      {/* Party Name */}
                      <td className="py-2 px-3 font-medium text-slate-700 max-w-[180px] truncate" title={entry.partyName}>
                        {entry.partyName || '-'}
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                        {entry.amount !== undefined 
                          ? Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>

                      {/* Performed By (User & Role) */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] uppercase">
                            {(entry.userName || 'U')[0]}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs">{entry.userName || 'System'}</span>
                            <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                              {entry.userRole || 'User'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Change Detail / Updated Total */}
                      <td className="py-2 px-3 text-xs text-slate-600 max-w-[280px]">
                        <div className="truncate" title={entry.details}>
                          {hasAmountChange ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <span>Nu. {Number(entry.prevAmount).toFixed(2)}</span>
                              <ArrowRight className="h-3 w-3 text-amber-600" />
                              <span className="font-bold">Nu. {Number(entry.amount).toFixed(2)}</span>
                            </span>
                          ) : (
                            <span>{entry.details || '-'}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-800">{filteredLogs.length}</strong> of <strong className="text-slate-800">{logs.length}</strong> recorded audit events
          </div>
          <div className="text-[11px] text-slate-400">
            Click on any row to view complete change metadata and user footprint
          </div>
        </div>
      </div>

      {/* Detail Modal for Clicked Entry */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Audit Trail Record Footprint</h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {selectedEntry.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Action Executed</span>
                  <div className="mt-1">{renderActionBadge(selectedEntry.action)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Document / Module</span>
                  <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">{selectedEntry.module}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Voucher / Record No</span>
                  <span className="font-mono font-bold text-indigo-900 text-sm mt-0.5 block">{selectedEntry.recordId || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Transaction Amount</span>
                  <span className="font-mono font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {selectedEntry.amount !== undefined 
                      ? `Nu. ${Number(selectedEntry.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '-'}
                  </span>
                </div>
              </div>

              {/* User Footprint */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">User Security Credentials</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">User Full Name:</span>
                    <span className="font-extrabold text-slate-900">{selectedEntry.userName || 'System'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">System Role:</span>
                    <span className="font-bold text-indigo-700">{selectedEntry.userRole || 'User'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">User ID:</span>
                    <span className="font-mono text-slate-700">{selectedEntry.userId || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Exact Timestamp:</span>
                    <span className="font-mono text-slate-800">{formatDateTime(selectedEntry.timestamp)}</span>
                  </div>
                </div>
              </div>

              {/* Party Name */}
              {selectedEntry.partyName && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Party / Ledger Account</span>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800">
                    {selectedEntry.partyName}
                  </div>
                </div>
              )}

              {/* Change Details */}
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Change Detail / Updated Total</span>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedEntry.details || 'No additional change notes recorded.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
