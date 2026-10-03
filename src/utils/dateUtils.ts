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

