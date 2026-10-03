import React, { useState, useEffect } from 'react';
import { 
  Clock, Search, UserCheck, Wifi, RefreshCw, Calendar, 
  Download, Filter, AlertCircle, CheckCircle2, Printer, FileText,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { AttendanceRecord } from '../../types/staffPortal';
import { Employee, Config } from '../../types';
import { getTodayDateString } from '../../services/employeeStaffService';
import { formatDateDMY } from '../../utils/dateUtils';
import { 
  exportDailyAttendanceToExcel, 
  exportDailyAttendanceToPdf 
} from '../../services/staffReportExportService';

export function exportDailyAttendanceExcel(
  employees: Employee[],
  attendanceRecords: AttendanceRecord[],
  selectedDate: string,
  searchQuery = '',
  statusFilter: 'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' = 'ALL',
  config?: Config
) {
  exportDailyAttendanceToExcel({
    config: config || ({ CompanyName: 'Panglung Enterprise' } as Config),
    employees,
    attendanceRecords,
    selectedDate,
    searchQuery,
    statusFilter
  });
}

export function exportDailyAttendancePdf(
  employees: Employee[],
  attendanceRecords: AttendanceRecord[],
  selectedDate: string,
  searchQuery = '',
  statusFilter: 'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT' = 'ALL',
  config?: Config
) {
  exportDailyAttendanceToPdf({
    config: config || ({ CompanyName: 'Panglung Enterprise' } as Config),
    employees,
    attendanceRecords,
    selectedDate,
    searchQuery,
    statusFilter
  });
}

interface DailyAttendanceViewProps {
  config: Config;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: 'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT';
  onStatusFilterChange?: (filter: 'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT') => void;
  hideHeaderToolbar?: boolean;
  isHeaderCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DailyAttendanceView: React.FC<DailyAttendanceViewProps> = ({
  config,
  employees,
  attendanceRecords,
  selectedDate,
  onDateChange,
  onRefresh,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange: externalOnStatusFilterChange,
  hideHeaderToolbar = false,
  isHeaderCollapsed: propIsHeaderCollapsed,
  onToggleCollapse
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalStatusFilter, setInternalStatusFilter] = useState<'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT'>('ALL');
  const [internalIsHeaderCollapsed, setInternalIsHeaderCollapsed] = useState(false);
  const isHeaderCollapsed = propIsHeaderCollapsed !== undefined ? propIsHeaderCollapsed : internalIsHeaderCollapsed;
  const handleToggleCollapse = onToggleCollapse || (() => setInternalIsHeaderCollapsed(prev => !prev));

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.scrollTop !== undefined) {
        if (target.scrollTop > 50 && !isHeaderCollapsed) {
          if (onToggleCollapse) onToggleCollapse();
          else setInternalIsHeaderCollapsed(true);
        } else if (target.scrollTop < 10 && isHeaderCollapsed) {
          if (onToggleCollapse) onToggleCollapse();
          else setInternalIsHeaderCollapsed(false);
        }
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isHeaderCollapsed, onToggleCollapse]);

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;

  const statusFilter = externalStatusFilter !== undefined ? externalStatusFilter : internalStatusFilter;
  const setStatusFilter = externalOnStatusFilterChange || setInternalStatusFilter;

  // Filter records for selected date
  const todayRecords = attendanceRecords.filter(r => r.date === selectedDate);
  const presentCount = todayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateCount = todayRecords.filter(r => r.status === 'Late').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On-Leave' || r.status === 'Half-Day').length;
  const absentCount = Math.max(0, employees.length - presentCount - leaveCount);

  // Quick Date Navigation
  const handleQuickDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    onDateChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  };

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      emp.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const rec = todayRecords.find(r => r.employeeId === emp.id);
    const isPresent = rec && (rec.status === 'Present' || rec.status === 'Late');
    const isLate = rec && rec.status === 'Late';
    const isLeave = rec && (rec.status === 'On-Leave' || rec.status === 'Half-Day');
    const isAbsent = !rec || rec.status === 'Absent';

    if (statusFilter === 'PRESENT') return isPresent;
    if (statusFilter === 'LATE') return isLate;
    if (statusFilter === 'LEAVE') return isLeave;
    if (statusFilter === 'ABSENT') return isAbsent;
    return true;
  });

  // Export Daily Log to Excel (Styled pro-grade spreadsheet)
  const handleExportDailyExcel = () => {
    exportDailyAttendanceToExcel({
      config,
      employees,
      attendanceRecords,
      selectedDate,
      searchQuery,
      statusFilter
    });
  };

  // Export Daily Log to PDF
  const handleExportDailyPdf = () => {
    exportDailyAttendanceToPdf({
      config,
      employees,
      attendanceRecords,
      selectedDate,
      searchQuery,
      statusFilter
    });
  };

  // Print Daily Attendance Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* PRINT-ONLY EXECUTIVE HEADER */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-3 text-slate-900 text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
          {config?.CompanyName || 'Panglung Enterprise'}
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          {[
            config?.Address || config?.CompanyAddress || 'Bhutan',
            config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
            config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
          ].filter(Boolean).join('  |  ')}
        </p>
        <h2 className="text-base font-bold text-blue-700 uppercase tracking-tight mt-2">
          DAILY STAFF CLOCK-IN / OUT LOG — {formatDateDMY(selectedDate)}
        </h2>
      </div>

      {/* Filter and Control Bar (shown only when not rendered in executive top bar) */}
      {!hideHeaderToolbar && (
        <div className={`transition-all duration-300 ease-in-out ${
          isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-96 opacity-100 mb-4'
        }`}>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 print:hidden">
          {/* Date Selector & Quick Jumps */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleQuickDate(-1)}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
                title="Previous Day"
              >
                ← Prev
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => onDateChange(e.target.value)}
                className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleQuickDate(1)}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition"
                title="Next Day"
              >
                Next →
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDateChange(getTodayDateString())}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                selectedDate === getTodayDateString()
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Today
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Refresh Attendance Log"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Search, Status Tabs & Export */}
          <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
            {/* Status Filter Tabs with Counts */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              {[
                { id: 'ALL' as const, label: 'All', count: employees.length },
                { id: 'PRESENT' as const, label: 'Present', count: presentCount },
                { id: 'LATE' as const, label: 'Late', count: lateCount },
                { id: 'LEAVE' as const, label: 'On Leave', count: leaveCount },
                { id: 'ABSENT' as const, label: 'Absent', count: absentCount }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] font-bold flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    statusFilter === tab.id 
                      ? 'bg-slate-100 text-slate-800' 
                      : 'bg-slate-200/70 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-44">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff or code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 focus:bg-white rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            <button
              type="button"
              onClick={handleExportDailyExcel}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download Formatted Excel Spreadsheet"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export</span>
            </button>

            <button
              type="button"
              onClick={handleExportDailyPdf}
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download PDF Document"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Print Daily Attendance Log"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              <span>Print</span>
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Enterprise Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className={`overflow-auto transition-all duration-300 ${
          isHeaderCollapsed ? 'max-h-[calc(100vh-80px)] min-h-[450px]' : 'max-h-[calc(100vh-215px)] min-h-[350px]'
        }`}>
          <table className="w-full text-left text-xs text-slate-700 border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-white">
                <th colSpan={9} className="px-5 py-3 text-left bg-white border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm">
                        Daily Attendance Log — <span className="font-mono text-blue-700">{formatDateDMY(selectedDate)}</span>
                      </h3>
                      {isHeaderCollapsed && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          Full Page View
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        Showing {filteredEmployees.length} of {employees.length} Staff
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleCollapse}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        title={isHeaderCollapsed ? "Expand page header & controls" : "Collapse page header for full page report view"}
                      >
                        {isHeaderCollapsed ? (
                          <>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                            <span>Expand Controls</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                            <span>Full Page View</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </th>
              </tr>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Employee</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Designation</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Check In</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Check Out</th>
                <th className="py-3 px-4 text-center bg-slate-50 border-b border-slate-200">Hours</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Status</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Network & IP Security</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Terminal / Source</th>
                <th className="py-3 px-4 bg-slate-50 border-b border-slate-200">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredEmployees.map(emp => {
                const rec = todayRecords.find(r => r.employeeId === emp.id);
                const isPresent = rec && (rec.status === 'Present' || rec.status === 'Late');
                const isLate = rec && rec.status === 'Late';
                const isLeave = rec && rec.status === 'On-Leave';
                const isHalf = rec && rec.status === 'Half-Day';

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="leading-tight">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-medium">{emp.empCode}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{emp.designation || '-'}</td>
                    <td className="py-3 px-4">
                      {rec?.checkInTime ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900">{rec.checkInTime}</span>
                          {isLate && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase">
                              Late
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not clocked in</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {rec?.checkOutTime ? (
                        <span className="font-mono font-bold text-slate-900">{rec.checkOutTime}</span>
                      ) : (
                        <span className="text-slate-400 italic">
                          {rec?.checkInTime ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active shift
                            </span>
                          ) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-center">
                      {rec?.hoursWorked !== undefined && rec.hoursWorked > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px]">
                          {rec.hoursWorked} hrs
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {isPresent ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border inline-flex items-center gap-1 ${
                          isLate 
                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>{rec?.status}</span>
                        </span>
                      ) : isLeave ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 text-[10px] font-black border border-purple-200">
                          On Approved Leave
                        </span>
                      ) : isHalf ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                          Half Day
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                          Absent / Off
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {rec?.networkVerified ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 whitespace-nowrap">
                          <Wifi className="h-3 w-3 text-emerald-600" />
                          <span>{rec.networkDetails || 'Office WiFi'}</span>
                          {rec.networkIp && <span className="opacity-75 font-mono text-[9px]">[{rec.networkIp}]</span>}
                        </span>
                      ) : rec?.checkInTime ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200 whitespace-nowrap">
                          <span>{rec.checkInTerminal || rec.source || 'POS Terminal'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                      {rec?.checkInTerminal || rec?.source || '-'}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                      {rec?.checkInNote || rec?.checkOutNote || '-'}
                    </td>
                  </tr>
                );
              })}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 space-y-2">
                    <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold">No attendance records found matching current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
