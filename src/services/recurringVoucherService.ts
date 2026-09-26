import { Config, Voucher } from '../types';
import {
  saveMultiLineVoucher,
  saveVoucher,
  getVouchers,
  peekNextVoucherNo,
  getVoucherPrefix,
  loadJson,
  saveJson,
  STORAGE_KEYS
} from './storageService';

export interface RecurringVoucherSchedule {
  id: string;
  templateName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfMonth?: number; // 1-31, or 99 for 'last_day_of_month'
  dayOfWeek?: number; // 0-6 (0=Sun..6=Sat) for weekly
  voucherType: 'P' | 'R' | 'J' | 'C';
  entryMode: 'single' | 'multi';
  debitLedger?: string;
  creditLedger?: string;
  amount?: number;
  lines?: Array<{
    type: 'Dr' | 'Cr';
    ledger: string;
    amount: number;
    narration?: string;
  }>;
  narrationTemplate: string; // e.g. "Monthly Office Rent for {MONTH_NAME} {YEAR}"
  autoPostMode: 'automatic' | 'manual_review';
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  lastPostedDate?: string;
  lastPostedVoucherNo?: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringVoucherLog {
  id: string;
  scheduleId: string;
  scheduleName: string;
  voucherNo: string;
  voucherType: string;
  amount: number;
  date: string;
  narration: string;
  postedAt: string;
  status: 'success' | 'failed';
  error?: string;
}

const RECURRING_STORAGE_KEY = 'deep_pos_recurring_vouchers';
const RECURRING_LOGS_KEY = 'deep_pos_recurring_voucher_logs';

export function getRecurringVoucherSchedules(): RecurringVoucherSchedule[] {
  return loadJson<RecurringVoucherSchedule[]>(RECURRING_STORAGE_KEY, []);
}

export function saveRecurringVoucherSchedule(schedule: RecurringVoucherSchedule): { ok: boolean; error?: string } {
  try {
    const list = getRecurringVoucherSchedules();
    const idx = list.findIndex(s => s.id === schedule.id);
    if (idx >= 0) {
      list[idx] = { ...schedule, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...schedule, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    saveJson(RECURRING_STORAGE_KEY, list);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to save recurring schedule' };
  }
}

export function deleteRecurringVoucherSchedule(id: string): { ok: boolean; error?: string } {
  try {
    const list = getRecurringVoucherSchedules().filter(s => s.id !== id);
    saveJson(RECURRING_STORAGE_KEY, list);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Failed to delete recurring schedule' };
  }
}

export function toggleRecurringScheduleStatus(id: string): { ok: boolean; status?: string } {
  const list = getRecurringVoucherSchedules();
  const schedule = list.find(s => s.id === id);
  if (!schedule) return { ok: false };
  schedule.status = schedule.status === 'active' ? 'paused' : 'active';
  schedule.updatedAt = new Date().toISOString();
  saveJson(RECURRING_STORAGE_KEY, list);
  return { ok: true, status: schedule.status };
}

export function getRecurringVoucherLogs(): RecurringVoucherLog[] {
  return loadJson<RecurringVoucherLog[]>(RECURRING_LOGS_KEY, []);
}

function addRecurringLog(log: Omit<RecurringVoucherLog, 'id' | 'postedAt'>) {
  const logs = getRecurringVoucherLogs();
  logs.unshift({
    ...log,
    id: 'rclog_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    postedAt: new Date().toISOString()
  });
  // Keep last 200 logs
  saveJson(RECURRING_LOGS_KEY, logs.slice(0, 200));
}

export function renderNarrationTemplate(template: string, targetDateIso: string): string {
  if (!template) return '';
  const d = new Date(targetDateIso);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const mIdx = d.getMonth();
  const year = d.getFullYear();
  const monthName = monthNames[mIdx];
  const shortMonth = shortMonths[mIdx];
  const monthNum = String(mIdx + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  
  // Previous month
  const prevMonthIdx = (mIdx + 11) % 12;
  const prevMonthYear = mIdx === 0 ? year - 1 : year;
  const prevMonthName = monthNames[prevMonthIdx];
  
  // Quarter
  const qNum = Math.floor(mIdx / 3) + 1;
  const qStr = `Q${qNum}`;

  return template
    .replace(/{MONTH_NAME}/gi, monthName)
    .replace(/{MONTH_SHORT}/gi, shortMonth)
    .replace(/{MONTH}/gi, monthName)
    .replace(/{MM}/gi, monthNum)
    .replace(/{DD}/gi, dayNum)
    .replace(/{YEAR}/gi, String(year))
    .replace(/{PREV_MONTH}/gi, prevMonthName)
    .replace(/{PREV_YEAR}/gi, String(prevMonthYear))
    .replace(/{QUARTER}/gi, qStr)
    .replace(/{DATE}/gi, `${dayNum}/${monthNum}/${year}`);
}

export function calculateNextDueDate(
  currentDateIso: string,
  frequency: RecurringVoucherSchedule['frequency'],
  dayOfMonth: number = 1,
  dayOfWeek: number = 1
): string {
  const d = new Date(currentDateIso);
  let nextDate = new Date(d);

  if (frequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (frequency === 'monthly') {
    const targetMonth = nextDate.getMonth() + 1;
    nextDate.setMonth(targetMonth);
    if (dayOfMonth === 99) {
      // Last day of month
      const y = nextDate.getFullYear();
      const m = nextDate.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      nextDate.setDate(lastDay);
    } else {
      const maxDays = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      nextDate.setDate(Math.min(dayOfMonth, maxDays));
    }
  } else if (frequency === 'quarterly') {
    const targetMonth = nextDate.getMonth() + 3;
    nextDate.setMonth(targetMonth);
    if (dayOfMonth === 99) {
      const y = nextDate.getFullYear();
      const m = nextDate.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      nextDate.setDate(lastDay);
    } else {
      const maxDays = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
      nextDate.setDate(Math.min(dayOfMonth, maxDays));
    }
  } else if (frequency === 'yearly') {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }

  return nextDate.toISOString().split('T')[0];
}

export function executeRecurringVoucher(
  scheduleId: string,
  executionDateIso?: string
): { ok: boolean; voucherNo?: string; error?: string } {
  const list = getRecurringVoucherSchedules();
  const schedule = list.find(s => s.id === scheduleId);
  if (!schedule) return { ok: false, error: 'Recurring schedule not found.' };

  const targetDate = executionDateIso || schedule.nextDueDate || new Date().toISOString().split('T')[0];
  const renderedNarration = renderNarrationTemplate(schedule.narrationTemplate, targetDate);

  try {
    let totalAmount = 0;
    let savedNo = '';

    if (schedule.entryMode === 'multi' && schedule.lines && schedule.lines.length > 0) {
      totalAmount = schedule.lines
        .filter(l => l.type === 'Dr')
        .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

      const res = saveMultiLineVoucher({
        type: schedule.voucherType,
        date: targetDate,
        narration: renderedNarration || `Auto Recurring: ${schedule.templateName}`,
        lines: schedule.lines.map(l => ({
          type: l.type,
          ledger: l.ledger,
          amount: Number(l.amount) || 0,
          narration: l.narration ? renderNarrationTemplate(l.narration, targetDate) : undefined
        }))
      });

      if (res && res.voucherNo) {
        savedNo = res.voucherNo;
      } else {
        throw new Error('Failed to generate multi-line voucher number.');
      }
    } else {
      // Single Entry
      totalAmount = Number(schedule.amount) || 0;
      if (!schedule.debitLedger || !schedule.creditLedger || totalAmount <= 0) {
        throw new Error('Invalid single-entry debit/credit ledger or amount.');
      }

      const res = saveMultiLineVoucher({
        type: schedule.voucherType,
        date: targetDate,
        narration: renderedNarration || `Auto Recurring: ${schedule.templateName}`,
        lines: [
          { type: 'Dr', ledger: schedule.debitLedger, amount: totalAmount },
          { type: 'Cr', ledger: schedule.creditLedger, amount: totalAmount }
        ]
      });

      if (res && res.voucherNo) {
        savedNo = res.voucherNo;
      } else {
        throw new Error('Failed to generate voucher number.');
      }
    }

    // Update schedule state
    const nextDue = calculateNextDueDate(targetDate, schedule.frequency, schedule.dayOfMonth, schedule.dayOfWeek);
    schedule.lastPostedDate = targetDate;
    schedule.lastPostedVoucherNo = savedNo;
    schedule.nextDueDate = nextDue;
    
    // Check if end date reached
    if (schedule.endDate && nextDue > schedule.endDate) {
      schedule.status = 'completed';
    }
    schedule.updatedAt = new Date().toISOString();
    saveJson(RECURRING_STORAGE_KEY, list);

    addRecurringLog({
      scheduleId: schedule.id,
      scheduleName: schedule.templateName,
      voucherNo: savedNo,
      voucherType: schedule.voucherType,
      amount: totalAmount,
      date: targetDate,
      narration: renderedNarration,
      status: 'success'
    });

    return { ok: true, voucherNo: savedNo };
  } catch (err: any) {
    addRecurringLog({
      scheduleId: schedule.id,
      scheduleName: schedule.templateName,
      voucherNo: '-',
      voucherType: schedule.voucherType,
      amount: schedule.amount || 0,
      date: targetDate,
      narration: renderedNarration,
      status: 'failed',
      error: err.message || 'Execution error'
    });
    return { ok: false, error: err.message || 'Execution error' };
  }
}

export function getPendingDueRecurringVouchers(): RecurringVoucherSchedule[] {
  const today = new Date().toISOString().split('T')[0];
  const list = getRecurringVoucherSchedules();
  return list.filter(s => {
    if (s.status !== 'active') return false;
    if (s.endDate && today > s.endDate) return false;
    return s.nextDueDate <= today;
  });
}

export function processDueRecurringVouchers(): {
  postedCount: number;
  errors: string[];
  postedVouchers: Array<{ scheduleName: string; voucherNo: string; amount: number }>;
} {
  const today = new Date().toISOString().split('T')[0];
  const list = getRecurringVoucherSchedules();
  const due = list.filter(s => s.status === 'active' && s.autoPostMode === 'automatic' && s.nextDueDate <= today);
  
  let postedCount = 0;
  const errors: string[] = [];
  const postedVouchers: Array<{ scheduleName: string; voucherNo: string; amount: number }> = [];

  for (const schedule of due) {
    const res = executeRecurringVoucher(schedule.id, schedule.nextDueDate);
    if (res.ok && res.voucherNo) {
      postedCount++;
      postedVouchers.push({
        scheduleName: schedule.templateName,
        voucherNo: res.voucherNo,
        amount: schedule.amount || (schedule.lines?.filter(l => l.type === 'Dr').reduce((s, l) => s + (Number(l.amount) || 0), 0) || 0)
      });
    } else if (res.error) {
      errors.push(`${schedule.templateName}: ${res.error}`);
    }
  }

  return { postedCount, errors, postedVouchers };
}
