/** All business dates and times are in Asia/Kolkata (UTC+05:30), never the device zone. */
export const BUSINESS_TZ = 'Asia/Kolkata';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Shift a UTC instant by +05:30 so `.getUTC*()` yields exact IST calendar parts on every JS engine. */
function istShifted(instant: string | Date = new Date()): Date {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return new Date(d.getTime() + IST_OFFSET_MS);
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Whole rupees, Indian grouping: 1250000 -> ₹12,50,000. Hand-written so it never depends on Intl support. */
export function formatINR(n: number): string {
  const s = Math.round(Math.abs(n)).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₹${rest ? `${rest},` : ''}${last3}`;
}

const trimOne = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Short INR for counters and cards: ₹1.5 Cr, ₹90 L, else full ₹45,000. */
export function formatINRShort(rupees: number): string {
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 10_000_000) return `${sign}₹${trimOne(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}₹${trimOne(abs / 100_000)} L`;
  return formatINR(rupees);
}

/** Business calendar day `YYYY-MM-DD` in Asia/Kolkata. */
export function businessDate(instant: string | Date = new Date()): string {
  const d = istShifted(instant);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Business calendar month `YYYY-MM` in Asia/Kolkata. */
export function businessMonth(instant: string | Date = new Date()): string {
  return businessDate(instant).slice(0, 7);
}

/** Pure calendar arithmetic on `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pure calendar arithmetic on `YYYY-MM`. */
export function addMonths(month: string, delta: number): string {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const nextY = Math.floor(total / 12);
  const nextM = (total % 12) + 1;
  return `${nextY}-${pad2(nextM)}`;
}

/** `12 Nov 2026` from an ISO instant, in IST. */
export function formatDate(instant: string | Date): string {
  const d = istShifted(instant);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `12 Nov 2026` from a `YYYY-MM-DD` calendar string. */
export function formatDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `Thu, 12 Nov` from a `YYYY-MM-DD` calendar string. */
export function formatWeekdayDate(date: string = businessDate()): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** `November 2026` from a `YYYY-MM` string. */
export function formatMonthLabel(month: string): string {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  return `${MONTHS_LONG[(m - 1) % 12]} ${y}`;
}

/** `3:40 PM` from an ISO instant, in IST. */
export function formatTime(instant: string | Date): string {
  const d = istShifted(instant);
  const h24 = d.getUTCHours();
  const mins = pad2(d.getUTCMinutes());
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mins} ${period}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then `12 Nov 2026`. */
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

/** Up to two uppercase initials for an avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** `+91 98765 43210` from a 10-digit Indian phone. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** Human file size from bytes (`240 KB`, `3.2 MB`). */
export function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${trimOne(bytes / (1024 * 1024))} MB`;
}
