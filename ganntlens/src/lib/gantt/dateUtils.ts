// 日期 ↔ 像素/百分比 转换工具
// 整个 Gantt 用百分比定位（left% / width%），不用固定像素，方便响应式
// 日期字符串统一为 'YYYY-MM-DD'

/** 把 'YYYY-MM-DD' 转 Date 对象（本地时区） */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD' */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 两个日期相差的天数（b - a，向下取整） */
export function daysBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === 'string' ? parseDate(a) : a;
  const db = typeof b === 'string' ? parseDate(b) : b;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** 日期在 [rangeStart, rangeEnd] 中的百分比位置 (0-100) */
export function dateToPercent(
  date: string | Date,
  rangeStart: string,
  rangeEnd: string
): number {
  const offset = daysBetween(rangeStart, date);
  const total = daysBetween(rangeStart, rangeEnd);
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, (offset / total) * 100));
}

/** 区间 [start, end] 在 [rangeStart, rangeEnd] 中的 left% + width% */
export function rangeToPercent(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string
): { left: number; width: number } {
  const left = dateToPercent(start, rangeStart, rangeEnd);
  const right = dateToPercent(end, rangeStart, rangeEnd);
  return { left, width: Math.max(0.5, right - left) };
}

/** 月份数组（rangeStart 到 rangeEnd 包含的所有月份，每月第一天） */
export function monthsInRange(rangeStart: string, rangeEnd: string): Date[] {
  const s = parseDate(rangeStart);
  const e = parseDate(rangeEnd);
  const out: Date[] = [];
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cur <= e) {
    out.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** 取范围内的所有周（每周一） */
export function weeksInRange(rangeStart: string, rangeEnd: string): Date[] {
  const s = parseDate(rangeStart);
  const e = parseDate(rangeEnd);
  const out: Date[] = [];
  const cur = new Date(s);
  // 调整到当周或之前的周一
  const dow = cur.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  cur.setDate(cur.getDate() + offset);
  while (cur <= e) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return out;
}

/** 月份简称 */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 月份宽度占比（相对总范围天数） */
export function monthLabel(d: Date, rangeStart: string, rangeEnd: string): string {
  return `${d.getFullYear()} ${MONTH_LABELS[d.getMonth()]}`;
}

/** 在范围内的天数 */
export function rangeDays(rangeStart: string, rangeEnd: string): number {
  return daysBetween(rangeStart, rangeEnd);
}
