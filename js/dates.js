// Local-time date helpers. Dates are "YYYY-MM-DD" strings in local time. Never use UTC conversions.

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str, n) {
  const d = parseDate(str);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function isValidDateStr(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateStr(parseDate(str)) === str;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function weekdayShort(str) {
  return WEEKDAYS[parseDate(str).getDay()];
}

export function dayNumber(str) {
  return parseDate(str).getDate();
}

export function monthTitle(year, month) {
  return `${MONTHS[month]} ${year}`;
}

/** e.g. "Thu 19 Nov" (adds the year when it differs from today's). */
export function formatShort(str, today = todayStr()) {
  const d = parseDate(str);
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return str.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

/** "Today", "Tomorrow" or "Thursday 19 November". */
export function formatLong(str, today = todayStr()) {
  if (str === today) return 'Today';
  if (str === addDays(today, 1)) return 'Tomorrow';
  const d = parseDate(str);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const base = `${days[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return str.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

/** The 7-day meal window: today plus the following 6 days. */
export function weekWindow(today) {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

/**
 * Month grid starting on Monday. Returns an array of weeks, each an array of 7
 * cells: { date: "YYYY-MM-DD", inMonth: boolean }.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - offset);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const grid = [];
  for (let w = 0; w < weeks; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      row.push({ date: toDateStr(d), inMonth: d.getMonth() === month });
    }
    grid.push(row);
  }
  return grid;
}

export const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
