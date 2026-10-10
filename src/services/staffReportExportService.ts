import XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, Config } from '../types';
import { AttendanceRecord, TaskAssignment, LeaveApplication } from '../types/staffPortal';
import { calculateMonthlyAttendanceSummary } from './employeeStaffService';
import { formatDateDMY } from '../utils/dateUtils';

// ---------------------------------------------------------------------------
// CORE EXCEL FORMATTING ENGINE (COMPACT & PROPORTIONED WITH ZERO OVERFLOW)
// ---------------------------------------------------------------------------

interface StyledExcelOptions {
  companyName: string;
  companyAddress?: string;
  reportTitle: string;
  subhead?: string;
  headers: string[];
  alignments?: ('left' | 'center' | 'right')[];
  columnWidths?: number[];
  rows: (string | number)[][];
  totalsRow?: (string | number)[];
  sheetName: string;
  fileName: string;
  numFormats?: Record<number, string>;
  headerColorHex?: string; // e.g. '0F172A'
  statusColumnIndex?: number;
}

export function buildStyledStaffExcelSheet({
  companyName,
  companyAddress,
  reportTitle,
  headers,
  alignments = [],
  columnWidths = [],
  rows,
  totalsRow,
  sheetName,
  fileName,
  numFormats = {},
  headerColorHex = '0F172A',
  statusColumnIndex
}: StyledExcelOptions) {
  const maxCols = headers.length;
  const aoa: any[][] = [];

  // Row 0: Company / Business Header Banner (padded across all maxCols)
  aoa.push([companyName || 'Business Management ERP', ...Array(Math.max(0, maxCols - 1)).fill('')]);

  // Row 1: Company Subtitle & Address / Contact details
  aoa.push([companyAddress || 'Bhutan', ...Array(Math.max(0, maxCols - 1)).fill('')]);

  // Row 2: Formal Report Title Banner
  aoa.push([reportTitle, ...Array(Math.max(0, maxCols - 1)).fill('')]);

  // Row 3: Clean Spacer Row (padded so grid is uniform)
  aoa.push(Array(maxCols).fill(''));

  // Row 4: Table Column Headers
  aoa.push(headers);

  // Rows 5+: Data Rows
  rows.forEach(r => {
    const paddedRow = [...r];
    while (paddedRow.length < maxCols) {
      paddedRow.push('');
    }
    aoa.push(paddedRow);
  });

  // Final Row: Grand Totals Summary Row (if provided)
  let totalsRowIdx = -1;
  if (totalsRow && totalsRow.length > 0) {
    totalsRowIdx = aoa.length;
    const paddedTotals = [...totalsRow];
    while (paddedTotals.length < maxCols) {
      paddedTotals.push('');
    }
    aoa.push(paddedTotals);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 1. Merge Header Rows Across All Table Columns (Rows 0, 1, 2)
  if (maxCols > 1) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } }
    ];
  }

  // 2. Set Row Heights for crisp, elegant vertical whitespace
  const rowHeights: { hpt: number }[] = [
    { hpt: 30 }, // Row 0: Company Name
    { hpt: 18 }, // Row 1: Company Address & Contact
    { hpt: 24 }, // Row 2: Formal Report Title
    { hpt: 8 },  // Row 3: Spacer
    { hpt: 26 }, // Row 4: Table Column Headers
  ];
  for (let i = 0; i < rows.length; i++) {
    rowHeights.push({ hpt: 20 }); // Data rows: comfortable 20pt height
  }
  if (totalsRowIdx >= 0) {
    rowHeights.push({ hpt: 24 }); // Totals row: 24pt height
  }
  ws['!rows'] = rowHeights;

  // 3. Compute Compact, Well-Proportioned Column Widths (Zero horizontal blowout)
  const finalColWidths = headers.map((h, cIdx) => {
    let maxLen = h ? String(h).length : 5;
    rows.forEach(r => {
      const val = r[cIdx];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });

    // Factor in totalsRow only if it's reasonably proportioned to prevent stretching narrow columns
    if (totalsRow && totalsRow[cIdx] !== undefined) {
      const valStr = String(totalsRow[cIdx]);
      if (valStr.length <= maxLen + 4 && valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    }

    const minW = columnWidths[cIdx] || 7;
    // Modest +2 padding ensures crisp fit without excessive whitespace
    return Math.max(Math.ceil(maxLen + 2), minW);
  });
  ws['!cols'] = finalColWidths.map(w => ({ wch: w }));

  // 4. Style Company Name (Row 0) — LEFT-ALIGNED so it is immediately visible from Column A
  for (let c = 0; c < maxCols; c++) {
    const cellR0 = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellR0]) ws[cellR0] = { t: 's', v: '' };
    ws[cellR0].s = {
      font: { name: 'Calibri', sz: 15, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: headerColorHex } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        top: { style: 'medium', color: { rgb: headerColorHex } },
        bottom: { style: 'thin', color: { rgb: '334155' } },
        left: c === 0 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined,
        right: c === maxCols - 1 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined
      }
    };
  }

  // 5. Style Company Subhead / Address (Row 1) — LEFT-ALIGNED
  for (let c = 0; c < maxCols; c++) {
    const cellR1 = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[cellR1]) ws[cellR1] = { t: 's', v: '' };
    ws[cellR1].s = {
      font: { name: 'Calibri', sz: 9, color: { rgb: '64748B' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: c === 0 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined,
        right: c === maxCols - 1 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined
      }
    };
  }

  // 6. Style Report Title (Row 2) — LEFT-ALIGNED
  for (let c = 0; c < maxCols; c++) {
    const cellR2 = XLSX.utils.encode_cell({ r: 2, c });
    if (!ws[cellR2]) ws[cellR2] = { t: 's', v: '' };
    ws[cellR2].s = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '1E3A8A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: {
        bottom: { style: 'medium', color: { rgb: '94A3B8' } },
        left: c === 0 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined,
        right: c === maxCols - 1 ? { style: 'medium', color: { rgb: headerColorHex } } : undefined
      }
    };
  }

  // 7. Style Spacer Row (Row 3)
  for (let c = 0; c < maxCols; c++) {
    const cellR3 = XLSX.utils.encode_cell({ r: 3, c });
    if (!ws[cellR3]) ws[cellR3] = { t: 's', v: '' };
    ws[cellR3].s = {
      fill: { fgColor: { rgb: 'FFFFFF' } }
    };
  }

  // 8. Style Table Headers (Row 4)
  for (let c = 0; c < maxCols; c++) {
    const cRef = XLSX.utils.encode_cell({ r: 4, c });
    if (ws[cRef]) {
      ws[cRef].s = {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: headerColorHex } },
        alignment: {
          horizontal: alignments[c] || 'center',
          vertical: 'center',
          wrapText: true
        },
        border: {
          top: { style: 'medium', color: { rgb: '0F172A' } },
          bottom: { style: 'medium', color: { rgb: '0F172A' } },
          left: { style: 'thin', color: { rgb: '334155' } },
          right: { style: 'thin', color: { rgb: '334155' } }
        }
      };
    }
  }

  // 9. Style Data Rows (Rows 5 .. 5 + rows.length - 1)
  const dataStart = 5;
  const dataEnd = dataStart + rows.length;
  for (let r = dataStart; r < dataEnd; r++) {
    const isEven = (r - dataStart) % 2 === 0;
    for (let c = 0; c < maxCols; c++) {
      const cRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cRef]) {
        const valStr = String(ws[cRef].v ?? '');
        const isStatusCol = c === statusColumnIndex;

        // Custom status badge colors in Excel
        let customFill: string | undefined = undefined;
        let customFontColor: string | undefined = undefined;
        let isBold = c === 1 || c === 2; // Emp code and name bold by default

        if (isStatusCol || valStr === 'Present' || valStr === 'Late' || valStr === 'Absent' || valStr === 'On-Leave' || valStr === 'Completed' || valStr === 'OVERDUE' || valStr === 'Approved' || valStr === 'Pending' || valStr === 'Rejected' || valStr === 'Done') {
          if (valStr === 'Present' || valStr === 'Completed' || valStr === 'Approved' || valStr === 'ON TIME' || valStr === 'Done') {
            customFill = isEven ? 'ECFDF5' : 'D1FAE5'; // Soft Mint
            customFontColor = '065F46'; // Emerald 800
            isBold = true;
          } else if (valStr === 'Late' || valStr === 'Pending') {
            customFill = isEven ? 'FFFBEB' : 'FEF3C7'; // Soft Amber
            customFontColor = '92400E'; // Amber 800
            isBold = true;
          } else if (valStr === 'Absent' || valStr === 'OVERDUE' || valStr === 'Rejected') {
            customFill = isEven ? 'FFF1F2' : 'FFE4E6'; // Soft Rose
            customFontColor = '9F1239'; // Rose 800
            isBold = true;
          } else if (valStr === 'On-Leave' || valStr === 'Half-Day' || valStr === 'In Progress') {
            customFill = isEven ? 'EEF2FF' : 'E0E7FF'; // Soft Indigo
            customFontColor = '3730A3'; // Indigo 800
            isBold = true;
          }
        }

        ws[cRef].s = {
          font: { 
            name: 'Calibri', 
            sz: 10, 
            color: { rgb: customFontColor || '0F172A' },
            bold: isBold
          },
          fill: { fgColor: { rgb: customFill || (isEven ? 'FFFFFF' : 'F8FAFC') } },
          alignment: {
            horizontal: alignments[c] || 'left',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };

        // Apply number format if applicable
        if (typeof ws[cRef].v === 'number') {
          if (numFormats[c]) {
            ws[cRef].z = numFormats[c];
          } else if (Number.isInteger(ws[cRef].v)) {
            ws[cRef].z = '#,##0';
          } else {
            ws[cRef].z = '#,##0.0';
          }
        }
      }
    }
  }

  // 10. Style Totals Row (if present)
  if (totalsRowIdx >= 0) {
    for (let c = 0; c < maxCols; c++) {
      const cRef = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
      if (ws[cRef]) {
        ws[cRef].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          alignment: {
            horizontal: alignments[c] || 'center',
            vertical: 'center',
            wrapText: true
          },
          border: {
            top: { style: 'thin', color: { rgb: '64748B' } },
            bottom: { style: 'double', color: { rgb: '0F172A' } }, // Formal Accounting Double Bottom Border
            left: { style: 'thin', color: { rgb: 'CBD5E1' } },
            right: { style: 'thin', color: { rgb: 'CBD5E1' } }
          }
        };

        if (typeof ws[cRef].v === 'number' && numFormats[c]) {
          ws[cRef].z = numFormats[c];
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const fullFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, fullFileName);
}

// ---------------------------------------------------------------------------
// 1. MONTHLY ATTENDANCE REGISTER EXPORT (EXCEL + PDF)
// ---------------------------------------------------------------------------

export interface MonthlyAttendanceExportParams {
  config: Config;
  employees: Employee[];
  selectedYear: number;
  selectedMonth: number;
  searchQuery?: string;
  returnDocOnly?: boolean;
}

export function exportMonthlyAttendanceToExcel({
  config,
  employees,
  selectedYear,
  selectedMonth,
  searchQuery = ''
}: MonthlyAttendanceExportParams) {
  let list = employees;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = employees.filter(emp => 
      emp.fullName.toLowerCase().includes(q) || 
      emp.empCode.toLowerCase().includes(q) ||
      (emp.designation && emp.designation.toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  }

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' });
  const monthShort = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'short' });
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Phone: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  // Concise, clear column headers that avoid forcing excessive width
  const headers = [
    'Sl No',
    'Emp Code',
    'Full Name',
    'Designation',
    'Department',
    'Month Days',
    'Work Days',
    'Present',
    'Paid Leave',
    'Loss of Pay',
    'Net Payable',
    'Attendance %'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center',
    'center',
    'left',
    'left',
    'left',
    'center',
    'center',
    'center',
    'center',
    'center',
    'center',
    'center'
  ];

  // Compact column widths perfectly scaled to human viewing
  const columnWidths = [6, 11, 18, 16, 14, 11, 10, 9, 11, 12, 12, 12];

  let sumMonthDays = 0;
  let sumStandardDays = 0;
  let sumPresentDays = 0;
  let sumPaidLeaveDays = 0;
  let sumLopDays = 0;
  let sumEffectiveDays = 0;

  const rows = list.map((emp, idx) => {
    const summary = calculateMonthlyAttendanceSummary(emp.id, selectedYear, selectedMonth);
    const attendanceRate = summary.totalWorkingDays > 0 
      ? Math.min(100, Math.round((summary.effectiveWorkingDays / summary.totalWorkingDays) * 100))
      : 0;

    sumMonthDays = summary.monthTotalDays;
    sumStandardDays += summary.totalWorkingDays;
    sumPresentDays += summary.presentDays;
    sumPaidLeaveDays += summary.paidLeaveDays;
    sumLopDays += summary.lossOfPayDays;
    sumEffectiveDays += summary.effectiveWorkingDays;

    return [
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.designation || '-',
      emp.department || '-',
      summary.monthTotalDays,
      summary.totalWorkingDays,
      summary.presentDays,
      summary.paidLeaveDays,
      summary.lossOfPayDays,
      summary.effectiveWorkingDays,
      `${attendanceRate}%`
    ];
  });

  const avgAttendance = list.length > 0 && sumStandardDays > 0
    ? Math.round((sumEffectiveDays / sumStandardDays) * 100)
    : 0;

  const totalsRow: (string | number)[] = [
    'TOTAL',
    '',
    `${list.length} Staff`,
    '',
    '',
    sumMonthDays,
    sumStandardDays,
    sumPresentDays,
    sumPaidLeaveDays,
    sumLopDays,
    sumEffectiveDays,
    `${avgAttendance}%`
  ];

  buildStyledStaffExcelSheet({
    companyName: companyName.toUpperCase(),
    companyAddress,
    reportTitle: `MONTHLY ATTENDANCE REGISTER FOR PAYROLL — ${monthName.toUpperCase()} ${selectedYear}`,
    headers,
    alignments,
    columnWidths,
    rows,
    totalsRow,
    sheetName: `${monthShort}_${selectedYear}_Attendance`,
    fileName: `Monthly_Attendance_Register_${monthShort}_${selectedYear}.xlsx`,
    headerColorHex: '0F172A',
    numFormats: {
      5: '#,##0',
      6: '#,##0',
      7: '#,##0.0',
      8: '#,##0.0',
      9: '#,##0.0',
      10: '#,##0.0'
    }
  });
}

export function exportMonthlyAttendanceToPdf({
  config,
  employees,
  selectedYear,
  selectedMonth,
  searchQuery = '',
  returnDocOnly = false
}: MonthlyAttendanceExportParams): jsPDF {
  let list = employees;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = employees.filter(emp => 
      emp.fullName.toLowerCase().includes(q) || 
      emp.empCode.toLowerCase().includes(q) ||
      (emp.designation && emp.designation.toLowerCase().includes(q))
    );
  }

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'long' });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  // Executive Top Accent Line
  doc.setFillColor(15, 23, 42); // Deep Navy Slate
  doc.rect(14, 10, 269, 2, 'F'); // Accent Line

  // Centered Header With Address & Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(companyName.toUpperCase(), 148.5, 18, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(companyAddress, 148.5, 23.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`MONTHLY ATTENDANCE REGISTER FOR PAYROLL — ${monthName.toUpperCase()} ${selectedYear}`, 148.5, 30.5, { align: 'center' });

  // Table Data
  let sumStandard = 0;
  let sumPresent = 0;
  let sumPaidLeave = 0;
  let sumLop = 0;
  let sumEffective = 0;

  const tableBody = list.map((emp, idx) => {
    const summary = calculateMonthlyAttendanceSummary(emp.id, selectedYear, selectedMonth);
    const attendanceRate = summary.totalWorkingDays > 0 
      ? Math.min(100, Math.round((summary.effectiveWorkingDays / summary.totalWorkingDays) * 100))
      : 0;

    sumStandard += summary.totalWorkingDays;
    sumPresent += summary.presentDays;
    sumPaidLeave += summary.paidLeaveDays;
    sumLop += summary.lossOfPayDays;
    sumEffective += summary.effectiveWorkingDays;

    return [
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.designation || '-',
      emp.department || '-',
      summary.monthTotalDays,
      summary.totalWorkingDays,
      summary.presentDays,
      summary.paidLeaveDays,
      summary.lossOfPayDays,
      summary.effectiveWorkingDays,
      `${attendanceRate}%`
    ];
  });

  const avgAttendance = list.length > 0 && sumStandard > 0
    ? Math.round((sumEffective / sumStandard) * 100)
    : 0;

  const tableFoot = [[
    'TOTAL',
    '',
    `${list.length} Staff Member(s)`,
    '',
    '',
    '',
    sumStandard,
    sumPresent,
    sumPaidLeave,
    sumLop,
    sumEffective,
    `${avgAttendance}%`
  ]];

  autoTable(doc, {
    startY: 35,
    head: [[
      'Sl', 'Emp Code', 'Full Name', 'Designation', 'Department', 'Month Days', 'Std Days', 'Present', 'Leave', 'LOP', 'Payable', 'Rate'
    ]],
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 42 },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'left', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 18 },
      9: { halign: 'center', cellWidth: 18 },
      10: { halign: 'center', cellWidth: 22 },
      11: { halign: 'center', cellWidth: 18 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const monthShort = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('default', { month: 'short' });
  if (!returnDocOnly) {
    doc.save(`Monthly_Attendance_Register_${monthShort}_${selectedYear}.pdf`);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// 2. DAILY CLOCK IN / OUT ATTENDANCE LOG EXPORT (EXCEL + PDF)
// ---------------------------------------------------------------------------

export interface DailyAttendanceExportParams {
  config: Config;
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  selectedDate: string;
  searchQuery?: string;
  statusFilter?: 'ALL' | 'PRESENT' | 'LATE' | 'LEAVE' | 'ABSENT';
  returnDocOnly?: boolean;
}

export function exportDailyAttendanceToExcel({
  config,
  employees,
  attendanceRecords,
  selectedDate,
  searchQuery = '',
  statusFilter = 'ALL'
}: DailyAttendanceExportParams) {
  const todayRecords = attendanceRecords.filter(r => r.date === selectedDate);
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Phone: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      emp.empCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.designation && emp.designation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.department && emp.department.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const presentCount = todayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateCount = todayRecords.filter(r => r.status === 'Late').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On-Leave' || r.status === 'Half-Day').length;
  const absentCount = Math.max(0, employees.length - presentCount - leaveCount);

  let totalHours = 0;
  // Format date strictly as DD-MM-YY
  const formattedLogDate = formatDateDMY(selectedDate);

  const rows = filteredEmployees.map((emp, idx) => {
    const rec = todayRecords.find(r => r.employeeId === emp.id);
    const hrs = rec?.hoursWorked !== undefined ? rec.hoursWorked : 0;
    totalHours += hrs;

    return [
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.designation || '-',
      emp.department || '-',
      rec?.checkInTime || 'Not Clocked In',
      rec?.checkOutTime || (rec?.checkInTime ? 'Active Shift' : '-'),
      hrs,
      rec?.status || 'Absent',
      rec?.networkVerified ? `WiFi: ${rec.networkDetails || 'Office'}` : (rec?.source || '-'),
      rec?.checkInTerminal || rec?.source || 'Mobile Web',
      rec?.checkInNote || rec?.checkOutNote || '-'
    ];
  });

  // Clean, concise headers that avoid stretching columns unnecessarily
  const headers = [
    'Sl No',
    'Emp Code',
    'Staff Name',
    'Designation',
    'Department',
    'Clock In',
    'Clock Out',
    'Hours',
    'Status',
    'Network Security',
    'Terminal',
    'Remarks'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center',
    'center',
    'left',
    'left',
    'left',
    'center',
    'center',
    'center',
    'center',
    'left',
    'left',
    'left'
  ];

  // Compact, comfortable column widths
  const columnWidths = [6, 11, 18, 18, 14, 12, 12, 8, 10, 16, 12, 16];

  const totalsRow: (string | number)[] = [
    'SUMMARY',
    '',
    `${filteredEmployees.length} Staff`,
    '',
    '',
    `In: ${presentCount}`,
    `Late: ${lateCount}`,
    totalHours,
    `${absentCount} Absent`,
    '',
    '',
    ''
  ];

  buildStyledStaffExcelSheet({
    companyName: companyName.toUpperCase(),
    companyAddress,
    reportTitle: `DAILY STAFF ATTENDANCE LOG — ${formattedLogDate}`,
    headers,
    alignments,
    columnWidths,
    rows,
    totalsRow,
    sheetName: `Daily_Log_${formattedLogDate}`,
    fileName: `Daily_Attendance_${formattedLogDate}.xlsx`,
    headerColorHex: '0F172A',
    statusColumnIndex: 8,
    numFormats: { 7: '#,##0.0' }
  });
}

export function exportDailyAttendanceToPdf({
  config,
  employees,
  attendanceRecords,
  selectedDate,
  searchQuery = '',
  statusFilter = 'ALL',
  returnDocOnly = false
}: DailyAttendanceExportParams): jsPDF {
  const todayRecords = attendanceRecords.filter(r => r.date === selectedDate);
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

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

  const presentCount = todayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
  const lateCount = todayRecords.filter(r => r.status === 'Late').length;
  const leaveCount = todayRecords.filter(r => r.status === 'On-Leave' || r.status === 'Half-Day').length;
  const absentCount = Math.max(0, employees.length - presentCount - leaveCount);
  const formattedLogDate = formatDateDMY(selectedDate);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Executive Top Accent Line
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 10, 269, 2, 'F');

  // Centered Header With Address & Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(companyName.toUpperCase(), 148.5, 18, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(companyAddress, 148.5, 23.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`DAILY STAFF ATTENDANCE LOG — ${formattedLogDate}`, 148.5, 30.5, { align: 'center' });

  let totalHrs = 0;
  const tableBody = filteredEmployees.map((emp, idx) => {
    const rec = todayRecords.find(r => r.employeeId === emp.id);
    const hrs = rec?.hoursWorked !== undefined ? rec.hoursWorked : 0;
    totalHrs += hrs;

    return [
      idx + 1,
      emp.empCode,
      emp.fullName,
      emp.designation || '-',
      emp.department || '-',
      rec?.checkInTime || 'Not In',
      rec?.checkOutTime || (rec?.checkInTime ? 'Active' : '-'),
      hrs > 0 ? `${hrs.toFixed(1)} h` : '0',
      rec?.status || 'Absent',
      rec?.networkVerified ? 'Office WiFi' : (rec?.source || '-'),
      rec?.checkInTerminal || 'Mobile Web'
    ];
  });

  const tableFoot = [[
    'TOTAL',
    '',
    `${filteredEmployees.length} Staff`,
    '',
    '',
    `Present: ${presentCount}`,
    `Late: ${lateCount}`,
    `${totalHrs.toFixed(1)} h`,
    `Leave: ${leaveCount}`,
    '',
    ''
  ]];

  autoTable(doc, {
    startY: 35,
    head: [[
      'Sl', 'Code', 'Staff Name', 'Designation', 'Department', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Network', 'Terminal'
    ]],
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 44 },
      3: { halign: 'left', cellWidth: 34 },
      4: { halign: 'left', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 18 },
      8: { halign: 'center', cellWidth: 22 },
      9: { halign: 'center', cellWidth: 24 },
      10: { halign: 'center', cellWidth: 24 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  if (!returnDocOnly) {
    doc.save(`Daily_Attendance_Log_${formattedLogDate}.pdf`);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// 3. TASK ASSIGNMENTS & PERFORMANCE REPORT EXPORT (EXCEL + PDF)
// ---------------------------------------------------------------------------

export interface TaskAssignmentExportParams {
  config: Config;
  tasks: TaskAssignment[];
  searchQuery?: string;
  filterStatus?: string;
  filterPriority?: string;
  filterCategory?: string;
  returnDocOnly?: boolean;
}

export function exportTaskAssignmentsToExcel({
  config,
  tasks,
  searchQuery = '',
  filterStatus = 'ALL',
  filterPriority = 'ALL',
  filterCategory = 'ALL'
}: TaskAssignmentExportParams) {
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Phone: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        t.title.toLowerCase().includes(q) ||
        t.taskNo.toLowerCase().includes(q) ||
        t.assignedToEmpName.toLowerCase().includes(q) ||
        t.assignedByName.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const completedCount = filteredTasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = filteredTasks.filter(t => t.status === 'In Progress' || t.status === 'Under Review').length;
  const overdueCount = filteredTasks.filter(t => {
    return new Date(t.dueDate).getTime() < new Date().setHours(0,0,0,0) && t.status !== 'Completed';
  }).length;

  const rows = filteredTasks.map((t, idx) => {
    const isOverdue = new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && t.status !== 'Completed';
    return [
      idx + 1,
      t.taskNo,
      t.createdAt ? formatDateDMY(t.createdAt) : '',
      t.category || 'General',
      t.title,
      t.description || '-',
      t.assignedToEmpName,
      `${t.assignedByName} (${t.assignedByRole})`,
      t.priority,
      formatDateDMY(t.dueDate),
      t.status,
      isOverdue ? 'OVERDUE' : 'ON TIME',
      t.completedAt ? formatDateDMY(t.completedAt) : '-',
      t.comments ? t.comments.length : 0
    ];
  });

  const headers = [
    'Sl No',
    'Task ID',
    'Date',
    'Category',
    'Assignment Title',
    'Description',
    'Assigned To',
    'Assigned By',
    'Priority',
    'Due Date',
    'Status',
    'Timeline',
    'Completed',
    'Notes'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center',
    'center',
    'center',
    'left',
    'left',
    'left',
    'left',
    'left',
    'center',
    'center',
    'center',
    'center',
    'center',
    'center'
  ];

  // Compact, legible column widths
  const columnWidths = [6, 11, 11, 12, 22, 24, 16, 16, 10, 11, 11, 11, 11, 8];

  const totalsRow: (string | number)[] = [
    'TOTAL',
    `${filteredTasks.length} Tasks`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Done: ${completedCount}`,
    `${overdueCount} Overdue`,
    `Active: ${inProgressCount}`,
    ''
  ];

  buildStyledStaffExcelSheet({
    companyName: companyName.toUpperCase(),
    companyAddress,
    reportTitle: 'STAFF OPERATIONS & TASK ASSIGNMENT REPORT',
    headers,
    alignments,
    columnWidths,
    rows,
    totalsRow,
    sheetName: 'Staff_Tasks_Report',
    fileName: `Staff_Assignment_Report_${formatDateDMY(new Date())}.xlsx`,
    headerColorHex: '1E1B4B',
    statusColumnIndex: 10
  });
}

export function exportTaskAssignmentsToPdf({
  config,
  tasks,
  searchQuery = '',
  filterStatus = 'ALL',
  filterPriority = 'ALL',
  filterCategory = 'ALL',
  returnDocOnly = false
}: TaskAssignmentExportParams): jsPDF {
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = 
        t.title.toLowerCase().includes(q) ||
        t.taskNo.toLowerCase().includes(q) ||
        t.assignedToEmpName.toLowerCase().includes(q) ||
        t.assignedByName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const completedCount = filteredTasks.filter(t => t.status === 'Completed').length;
  const overdueCount = filteredTasks.filter(t => {
    return new Date(t.dueDate).getTime() < new Date().setHours(0,0,0,0) && t.status !== 'Completed';
  }).length;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Executive Top Accent Line
  doc.setFillColor(30, 27, 75); // Deep Indigo
  doc.rect(14, 10, 269, 2, 'F');

  // Centered Header With Address & Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 27, 75);
  doc.text(companyName.toUpperCase(), 148.5, 18, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(companyAddress, 148.5, 23.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('STAFF OPERATIONS & TASK ASSIGNMENT PERFORMANCE REPORT', 148.5, 30.5, { align: 'center' });

  const tableBody = filteredTasks.map((t, idx) => {
    const isOverdue = new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && t.status !== 'Completed';
    return [
      idx + 1,
      t.taskNo,
      t.category || 'General',
      t.title,
      t.assignedToEmpName,
      t.assignedByName,
      t.priority,
      formatDateDMY(t.dueDate),
      t.status,
      isOverdue ? 'YES' : 'NO'
    ];
  });

  const tableFoot = [[
    'TOTAL',
    `${filteredTasks.length} Tasks`,
    '',
    '',
    '',
    '',
    '',
    '',
    `Completed: ${completedCount}`,
    `Overdue: ${overdueCount}`
  ]];

  autoTable(doc, {
    startY: 35,
    head: [[
      'Sl', 'Task ID', 'Category', 'Assignment Title', 'Assigned To', 'Assigned By', 'Priority', 'Due Date', 'Status', 'Overdue'
    ]],
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [30, 27, 75],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left', cellWidth: 25 },
      3: { halign: 'left', cellWidth: 65 },
      4: { halign: 'left', cellWidth: 35 },
      5: { halign: 'left', cellWidth: 32 },
      6: { halign: 'center', cellWidth: 20 },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 24 },
      9: { halign: 'center', cellWidth: 18 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  if (!returnDocOnly) {
    doc.save(`Staff_Assignment_Report_${formatDateDMY(new Date())}.pdf`);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// 4. LEAVE APPLICATIONS & HISTORY REGISTER EXPORT (EXCEL + PDF)
// ---------------------------------------------------------------------------

export interface LeaveHistoryExportParams {
  config: Config;
  leaveApplications: LeaveApplication[];
  returnDocOnly?: boolean;
}

export function exportLeaveHistoryToExcel({
  config,
  leaveApplications
}: LeaveHistoryExportParams) {
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Phone: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  const approvedCount = leaveApplications.filter(l => l.status === 'Approved').length;
  const pendingCount = leaveApplications.filter(l => l.status === 'Pending').length;
  const rejectedCount = leaveApplications.filter(l => l.status === 'Rejected').length;
  let totalDays = 0;

  const rows = leaveApplications.map((app, idx) => {
    totalDays += app.daysCount || 0;
    return [
      idx + 1,
      app.employeeId,
      app.employeeName,
      app.leaveTypeName,
      formatDateDMY(app.startDate),
      formatDateDMY(app.endDate),
      app.daysCount,
      app.status,
      app.reason || '-',
      app.reviewedBy || '-'
    ];
  });

  const headers = [
    'Sl No',
    'Emp ID',
    'Employee Name',
    'Leave Type',
    'Start Date',
    'End Date',
    'Days',
    'Status',
    'Reason / Purpose',
    'Reviewed By'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center',
    'center',
    'left',
    'left',
    'center',
    'center',
    'center',
    'center',
    'left',
    'left'
  ];

  // Compact, well-aligned column widths
  const columnWidths = [6, 11, 18, 14, 11, 11, 8, 10, 22, 14];

  const totalsRow: (string | number)[] = [
    'TOTAL',
    '',
    `${leaveApplications.length} Staff`,
    '',
    '',
    '',
    totalDays,
    `Appr: ${approvedCount}`,
    `Pend: ${pendingCount}`,
    ''
  ];

  buildStyledStaffExcelSheet({
    companyName: companyName.toUpperCase(),
    companyAddress,
    reportTitle: 'STAFF LEAVE APPLICATIONS & QUOTAS REGISTER',
    headers,
    alignments,
    columnWidths,
    rows,
    totalsRow,
    sheetName: 'Leave_Register',
    fileName: `Staff_Leave_Register_${formatDateDMY(new Date())}.xlsx`,
    headerColorHex: '065F46',
    statusColumnIndex: 7,
    numFormats: { 6: '#,##0.0' }
  });
}

export function exportLeaveHistoryToPdf({
  config,
  leaveApplications,
  returnDocOnly = false
}: LeaveHistoryExportParams): jsPDF {
  const companyName = config?.CompanyName || 'Bhutan Retail Enterprise';
  const companyAddress = [
    config?.Address || config?.CompanyAddress || 'Bhutan',
    config?.CompanyPhone ? `Tel: ${config.CompanyPhone}` : '',
    config?.CompanyEmail ? `Email: ${config.CompanyEmail}` : ''
  ].filter(Boolean).join('  |  ');

  const approvedCount = leaveApplications.filter(l => l.status === 'Approved').length;
  const pendingCount = leaveApplications.filter(l => l.status === 'Pending').length;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Executive Top Accent Line
  doc.setFillColor(6, 95, 70); // Emerald 800
  doc.rect(14, 10, 269, 2, 'F');

  // Centered Header With Address & Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text(companyName.toUpperCase(), 148.5, 18, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(companyAddress, 148.5, 23.5, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('STAFF LEAVE APPLICATIONS & HISTORY REGISTER', 148.5, 30.5, { align: 'center' });

  let totalDays = 0;
  const tableBody = leaveApplications.map((app, idx) => {
    totalDays += app.daysCount || 0;
    return [
      idx + 1,
      app.employeeName,
      app.leaveTypeName,
      formatDateDMY(app.startDate),
      formatDateDMY(app.endDate),
      `${app.daysCount} d`,
      app.status,
      app.reason || '-',
      app.reviewedBy || '-'
    ];
  });

  const tableFoot = [[
    'TOTAL',
    `${leaveApplications.length} Applications`,
    '',
    '',
    '',
    `${totalDays} Days`,
    `Approved: ${approvedCount}`,
    '',
    ''
  ]];

  autoTable(doc, {
    startY: 35,
    head: [[
      'Sl', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason / Purpose', 'Reviewed By'
    ]],
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [6, 95, 70], // Emerald 800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 45 },
      2: { halign: 'left', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 24 },
      7: { halign: 'left', cellWidth: 55 },
      8: { halign: 'left', cellWidth: 32 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  if (!returnDocOnly) {
    doc.save(`Staff_Leave_Register_${formatDateDMY(new Date())}.pdf`);
  }
  return doc;
}
