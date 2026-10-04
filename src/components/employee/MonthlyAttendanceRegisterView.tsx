import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarCheck, Search, Download, Briefcase, 
  ChevronRight, ChevronDown, ChevronUp, AlertCircle, FileSpreadsheet, TrendingUp, Info, Printer, FileText
} from 'lucide-react';
import { Employee, Config } from '../../types';
import { calculateMonthlyAttendanceSummary } from '../../services/employeeStaffService';
import { formatDateDMY } from '../../utils/dateUtils';
import { 
  exportMonthlyAttendanceToExcel, 
  exportMonthlyAttendanceToPdf 
} from '../../services/staffReportExportService';

export function exportMonthlyAttendanceExcel(
  employees: Employee[], 
  selectedYear: number, 
  selectedMonth: number,
  searchQuery = '',
  config?: Config
) {
  exportMonthlyAttendanceToExcel({
    config: config || ({ CompanyName: 'Bhutan Retail Enterprise' } as Config),
    employees,
    selectedYear,
    selectedMonth,
    searchQuery
  });
}

export function exportMonthlyAttendancePdf(
  employees: Employee[], 
  selectedYear: number, 
  selectedMonth: number,
  searchQuery = '',
  config?: Config
) {
  exportMonthlyAttendanceToPdf({
    config: config || ({ CompanyName: 'Bhutan Retail Enterprise' } as Config),
    employees,
    selectedYear,
    selectedMonth,
    searchQuery
  });
}

interface MonthlyAttendanceRegisterViewProps {
  config: Config;
  employees: Employee[];
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onNavigateToPayroll?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hideHeaderToolbar?: boolean;
  isHeaderCollapsed?: boolean;
  onToggleCollapse?: () => void;
  stickyTopPx?: number;
}

export const MonthlyAttendanceRegisterView: React.FC<MonthlyAttendanceRegisterViewProps> = ({
  config,
  employees,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onNavigateToPayroll,
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
  hideHeaderToolbar = false,
  isHeaderCollapsed: propIsHeaderCollapsed,
  onToggleCollapse,
  stickyTopPx
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalIsHeaderCollapsed, setInternalIsHeaderCollapsed] = useState(false);
  const isHeaderCollapsed = propIsHeaderCollapsed !== undefined ? propIsHeaderCollapsed : internalIsHeaderCollapsed;
  const handleToggleCollapse = onToggleCollapse || (() => setInternalIsHeaderCollapsed(prev => !prev));
  const effectiveStickyTop = stickyTopPx !== undefined ? stickyTopPx : 54;

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;

  // Calculate monthly summaries for all employees
  const monthlyData = useMemo(() => {
    return employees.map(emp => {
      const summary = calculateMonthlyAttendanceSummary(emp.id, selectedYear, selectedMonth);
      const attendanceRate = summary.totalWorkingDays > 0 
        ? Math.min(100, Math.round((summary.effectiveWorkingDays / summary.totalWorkingDays) * 100))
        : 0;

      return {
        emp,
        summary,
        attendanceRate
      };
    });
  }, [employees, selectedYear, selectedMonth]);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return monthlyData;
    const q = searchQuery.toLowerCase();
    return monthlyData.filter(({ emp }) => 
      emp.fullName.toLowerCase().includes(q) || 
      emp.empCode.toLowerCase().includes(q) ||
      (emp.designation && emp.designation.toLowerCase().includes(q))
    );
  }, [monthlyData, searchQuery]);

  // Aggregate Company Totals
  const aggregates = useMemo(() => {
    let totalPresent = 0;
    let totalPaidLeave = 0;
    let totalLop = 0;
    let totalEffectivePayable = 0;
    let standardDays = 0;
    let monthDays = 0;

    if (monthlyData.length > 0) {
      monthDays = monthlyData[0].summary.monthTotalDays;
      standardDays = monthlyData[0].summary.totalWorkingDays;
    }

    monthlyData.forEach(({ summary }) => {
      totalPresent += summary.presentDays;
      totalPaidLeave += summary.paidLeaveDays;
      totalLop += summary.lossOfPayDays;
      totalEffectivePayable += summary.effectiveWorkingDays;
    });

    const avgAttendance = monthlyData.length > 0 && standardDays > 0
      ? Math.round((totalEffectivePayable / (monthlyData.length * standardDays)) * 100)
      : 0;

    return {
      monthDays,
      standardDays,
      totalPresent,
      totalPaidLeave,
      totalLop,
      totalEffectivePayable,
      avgAttendance
    };
  }, [monthlyData]);

  // Export to Excel (Styled pro-grade spreadsheet)
  const handleExportExcel = () => {
    exportMonthlyAttendanceToExcel({
      config,
      employees,
      selectedYear,
      selectedMonth,
      searchQuery
    });
  };

  // Export to PDF
  const handleExportPdf = () => {
    exportMonthlyAttendanceToPdf({
      config,
      employees,
      selectedYear,
      selectedMonth,
      searchQuery
    });
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* PRINT-ONLY EXECUTIVE HEADER */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-3 text-slate-900 text-center">
        <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
          {config?.CompanyName || 'Bhutan Retail Enterprise'}
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          {[
            config?.Address || config?.CompanyAddress || 'Bhutan',
            config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
            config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
          ].filter(Boolean).join('  |  ')}
        </p>
        <h2 className="text-base font-bold text-blue-700 uppercase tracking-tight mt-2">
          MONTHLY ATTENDANCE REGISTER FOR PAYROLL — {monthName.toUpperCase()} {selectedYear}
        </h2>
      </div>

      {/* Toolbar (shown only when not rendered in executive top bar) */}
      {!hideHeaderToolbar && (
        <div className={`transition-all duration-300 ease-in-out ${
          isHeaderCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none mb-0' : 'max-h-96 opacity-100 mb-4'
        }`}>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
            {/* Month & Year Pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <select
                  value={selectedMonth}
                  onChange={e => onMonthChange(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer border border-slate-200 focus:ring-2 focus:ring-blue-500"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={e => onYearChange(Number(e.target.value))}
                  className="px-3 py-1.5 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer border border-slate-200 focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2025}>2025</option>
                </select>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search employee or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 focus:bg-white rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Download Formatted Monthly Attendance Spreadsheet"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Download Official PDF Document"
              >
                <FileText className="h-3.5 w-3.5 text-rose-600" />
                <span>Save PDF</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Print Monthly Attendance Register"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span>Print</span>
              </button>

              {onNavigateToPayroll && (
                <button
                  type="button"
                  onClick={onNavigateToPayroll}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Open Payroll Register to Process Salaries"
                >
                  <Briefcase className="h-4 w-4" />
                  <span>Process in Payroll</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Width Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <table className="w-full text-left text-xs text-slate-700 border-separate border-spacing-0">
          <thead className="sticky z-20 shadow-xs bg-white" style={{ top: `${effectiveStickyTop}px` }}>
              <tr className="bg-white">
                <th colSpan={9} className="px-5 py-3.5 text-left bg-white border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-blue-600" />
                      <h3 className="font-black text-slate-900 text-xs sm:text-sm">
                        Monthly Attendance Register for Payroll — {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' })} {selectedYear}
                      </h3>
                      {isHeaderCollapsed && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                          Full Page View
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-400 font-mono">
                        {filteredData.length} Employees Registered
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
                <th className="py-3 px-3 text-center bg-slate-50 border-b border-slate-200">Month Days</th>
                <th className="py-3 px-3 text-center bg-slate-50 border-b border-slate-200">Standard Work Days</th>
                <th className="py-3 px-3 text-center text-emerald-700 bg-slate-50 border-b border-slate-200">Present Days</th>
                <th className="py-3 px-3 text-center text-purple-700 bg-slate-50 border-b border-slate-200">Paid Leave</th>
                <th className="py-3 px-3 text-center text-rose-700 bg-slate-50 border-b border-slate-200">Loss of Pay (LOP)</th>
                <th className="py-3 px-3 text-center text-blue-700 bg-slate-50 border-b border-slate-200">Net Payable Days</th>
                <th className="py-3 px-4 text-center bg-slate-50 border-b border-slate-200">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredData.map(({ emp, summary, attendanceRate }) => (
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
                  <td className="py-3 px-3 font-mono text-center text-slate-600">{summary.monthTotalDays}</td>
                  <td className="py-3 px-3 font-mono text-center font-bold text-slate-800">{summary.totalWorkingDays}</td>
                  <td className="py-3 px-3 font-mono text-center font-bold text-emerald-700 bg-emerald-50/40">
                    {summary.presentDays}
                  </td>
                  <td className="py-3 px-3 font-mono text-center font-bold text-purple-700 bg-purple-50/40">
                    {summary.paidLeaveDays}
                  </td>
                  <td className="py-3 px-3 font-mono text-center font-bold text-rose-700 bg-rose-50/40">
                    {summary.lossOfPayDays > 0 ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        {summary.lossOfPayDays}
                      </span>
                    ) : '0'}
                  </td>
                  <td className="py-3 px-3 font-mono text-center font-black text-blue-800 bg-blue-50/60 text-sm">
                    {summary.effectiveWorkingDays}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            attendanceRate >= 90 ? 'bg-emerald-500' :
                            attendanceRate >= 75 ? 'bg-blue-500' :
                            attendanceRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, attendanceRate)}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px] text-slate-700 w-8 text-right">
                        {attendanceRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 space-y-2">
                    <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold">No employee monthly calculations match current search.</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Aggregated Totals Footer */}
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-100/80 font-black text-[11px] border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase text-slate-700">
                    Total Company Summary ({filteredData.length} Staff)
                  </td>
                  <td className="py-3 px-3 font-mono text-center text-slate-600">-</td>
                  <td className="py-3 px-3 font-mono text-center text-slate-900">-</td>
                  <td className="py-3 px-3 font-mono text-center text-emerald-800">
                    {aggregates.totalPresent} d
                  </td>
                  <td className="py-3 px-3 font-mono text-center text-purple-800">
                    {aggregates.totalPaidLeave} d
                  </td>
                  <td className="py-3 px-3 font-mono text-center text-rose-800">
                    {aggregates.totalLop} d
                  </td>
                  <td className="py-3 px-3 font-mono text-center text-blue-900 text-sm">
                    {aggregates.totalEffectivePayable} d
                  </td>
                  <td className="py-3 px-4 font-mono text-center text-slate-900">
                    {aggregates.avgAttendance}% avg
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
      </div>
    </div>
  );
};
