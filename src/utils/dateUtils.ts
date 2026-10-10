/**
 * Universal Date Formatting Utility for entire application
 * Standard strict format: DD-MM-YY (e.g., 03-10-26)
 */

export function formatDateDMY(d: any): string {
  if (!d) return '-';
  if (typeof d === 'string') {
    const s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const parts = s.slice(0, 10).split('-');
      const y = parts[0];
      const yy = y.length === 4 ? y.slice(2) : y;
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${yy}`;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      const parts = s.split('-');
      return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2].slice(-2)}`;
    }
    if (/^\d{2}-\d{2}-\d{2}$/.test(s)) {
      return s;
    }
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(-2);
  return `${day}-${month}-${yy}`;
}

export const formatDate = formatDateDMY;

export function formatDateTimeDMY(d: any): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(-2);
  const hours = String(dt.getHours()).padStart(2, '0');
  const minutes = String(dt.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${yy} ${hours}:${minutes}`;
}

export function getDashboardDefaultDates(config?: any, activeFY?: any): { fromDate: string; toDate: string } {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const mode = config?.DashboardDateRangeMode || 'fytd';

  if (mode === 'today') {
    return { fromDate: todayStr, toDate: todayStr };
  }

  if (mode === 'this_month') {
    const y = today.getFullYear();
    const m = pad(today.getMonth() + 1);
    return { fromDate: `${y}-${m}-01`, toDate: todayStr };
  }

  if (mode === 'last_30_days') {
    const d30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d30Str = `${d30.getFullYear()}-${pad(d30.getMonth() + 1)}-${pad(d30.getDate())}`;
    return { fromDate: d30Str, toDate: todayStr };
  }

  if (mode === 'calendar_year') {
    const y = today.getFullYear();
    return { fromDate: `${y}-01-01`, toDate: todayStr };
  }

  // Default mode: 'fytd' (Current Financial Year To Date)
  if (activeFY && activeFY.start_date) {
    const fyStartStr = String(activeFY.start_date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fyStartStr)) {
      return { fromDate: fyStartStr, toDate: todayStr };
    }
  }

  const fyMonth = parseInt(config?.FinancialYearStartMonth || '4', 10) || 4;
  const curYear = today.getFullYear();
  const curMonth = today.getMonth() + 1; // 1 to 12

  let fyStartYear = curYear;
  if (curMonth < fyMonth) {
    fyStartYear = curYear - 1;
  }

  const mm = pad(fyMonth);
  const fromDate = `${fyStartYear}-${mm}-01`;

  return { fromDate, toDate: todayStr };
}


