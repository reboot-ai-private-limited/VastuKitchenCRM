/** All business dates and times are in the business's timezone, never the browser's. */
export const BUSINESS_TZ = 'Asia/Kolkata';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** `₹12,50,000` (Indian grouping). The API sends whole rupees. */
export function formatINR(rupees: number): string {
  return inr.format(Math.round(rupees));
}

const trim = (n: number): string => (Math.round(n * 10) / 10).toString();

/** For tight spaces: `₹90 L`, `₹1.5 Cr`, `₹45,000`. Use the full amount in a tooltip. */
export function formatINRShort(rupees: number): string {
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? '-' : '';
  if (abs >= 10_000_000) return `${sign}₹${trim(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}₹${trim(abs / 100_000)} L`;
  return formatINR(rupees);
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `12 Nov 2026`, from an instant (ISO string or Date). */
export const formatDate = (instant: string | Date): string => dateFmt.format(new Date(instant));

/** `3:40 PM`, in IST. */
export const formatTime = (instant: string | Date): string =>
  timeFmt.format(new Date(instant)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);

/** The business calendar day (`YYYY-MM-DD`) of an instant. */
export const businessDate = (instant: string | Date = new Date()): string =>
  ymdFmt.format(new Date(instant));

/** A `YYYY-MM-DD` string moved by `days` (pure calendar arithmetic: no timezone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `12 Nov 2026` from a `YYYY-MM-DD` string (not an instant: no timezone shift). */
export function formatDay(date: string): string {
  return dateFmt.format(new Date(`${date}T12:00:00Z`));
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function relativeAge(instant: string | Date, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(instant).getTime();
  if (ms < 45_000) return 'just now';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(instant);
}

/** `45 s`, `7 min`, `1 h 20 min`: for talk time. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** Up to two initials for an avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
