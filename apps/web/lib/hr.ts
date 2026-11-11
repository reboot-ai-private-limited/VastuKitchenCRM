import {
  STAFF_ROLES,
  type AttendanceDayDto,
  type RoleName,
  type SalaryRowDto,
  type StaffRole,
} from '@vastu/contracts';
import { addDays, businessDate } from '@/lib/format';

/* ── months and dates (business calendar, never the browser's zone) ─────────── */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const isMonth = (s: string | null | undefined): s is string => !!s && MONTH_RE.test(s);
export const isDateString = (s: string | null | undefined): s is string => {
  if (!s || !DATE_RE.test(s)) return false;
  // Rejects 2026-02-31: the round trip must give the same day.
  return new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
};

/** The business month (`YYYY-MM`) of a business date or an instant. */
export const monthOf = (dateOrInstant: string | Date = new Date()): string =>
  (typeof dateOrInstant === 'string' && DATE_RE.test(dateOrInstant)
    ? dateOrInstant
    : businessDate(dateOrInstant)
  ).slice(0, 7);

export const currentMonth = (now: Date = new Date()): string => monthOf(businessDate(now));

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + by;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
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
];
/** `November 2026`. Pure string work: no Date, so no timezone shift. */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Salary and attendance cannot be looked at for a month that has not started. */
export const isFutureMonth = (month: string, today: string = businessDate()): boolean =>
  month > monthOf(today);

export const lastDayOf = (month: string): string => addDays(`${shiftMonth(month, 1)}-01`, -1);

/** Clamp a requested date into "not in the future". */
export const clampToToday = (date: string, today: string = businessDate()): string =>
  date > today ? today : date;

/* ── times: the API wants instants, people think in clock time on a business date ── */

/** India has no daylight saving, so the offset is a constant. */
const IST_OFFSET = '+05:30';

/** `2026-11-10` + `09:15` → `2026-11-10T09:15:00+05:30`. */
export const clockToInstant = (date: string, hhmm: string): string =>
  `${date}T${hhmm}:00${IST_OFFSET}`;

const clockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
/** The `HH:MM` clock time (IST) of an instant, for a `<input type="time">`. */
export const instantToClock = (instant: string): string => clockFmt.format(new Date(instant));

export const isClock = (s: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Why a correction cannot be saved, or null. Mirrors the API rules so the dialog can say it before sending. */
export function correctionProblem(input: {
  inAt: string;
  outAt: string;
  note: string;
}): string | null {
  if (!isClock(input.inAt)) return 'Enter the in time.';
  if (input.outAt !== '' && !isClock(input.outAt)) return 'Enter the out time as HH:MM.';
  if (input.outAt !== '' && input.outAt < input.inAt) return 'Out can’t be before in.';
  if (input.note.trim() === '') return 'Add a short reason for the correction.';
  return null;
}

/* ── month calendar ─────────────────────────────────────────────────────────── */

/** Monday-first grid: leading `null`s so day 1 lands under its weekday. */
export function calendarCells(days: AttendanceDayDto[]): Array<AttendanceDayDto | null> {
  if (days.length === 0) return [];
  const first = new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  return [...Array.from<null>({ length: lead }).fill(null), ...days];
}

/** The status word for a day, in plain language. */
export function dayLabel(d: AttendanceDayDto): string {
  if (d.status === 'PRESENT') return d.missingOut ? 'Present, no out time' : 'Present';
  if (d.status === 'ABSENT') return 'Absent';
  if (d.status === 'OFF') return 'Weekly off';
  return 'Upcoming';
}

export const METHOD_LABEL = {
  GPS: 'GPS check-in',
  BIOMETRIC_SIM: 'Biometric punch',
  MANUAL: 'Entered by HR',
} as const;

/* ── employees ──────────────────────────────────────────────────────────────── */

/** HR may not create or edit Admin or HR accounts (mirrors the API's policy; the API is the real gate). */
const HR_MANAGEABLE: readonly RoleName[] = ['SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'];
export const assignableRoles = (actor: RoleName | undefined): readonly StaffRole[] =>
  actor === 'ADMIN'
    ? STAFF_ROLES
    : actor === 'HR'
      ? STAFF_ROLES.filter((r) => HR_MANAGEABLE.includes(r))
      : [];
export const canManageUser = (actor: RoleName | undefined, target: RoleName): boolean =>
  actor === 'ADMIN' || (actor === 'HR' && HR_MANAGEABLE.includes(target));

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: 'Admin',
  HR: 'HR',
  SALES: 'Sales',
  DESIGNER: 'Designer',
  TECHNICIAN: 'Technician',
  OFFICE: 'Office',
  CUSTOMER: 'Customer',
};
export const ATTENDANCE_LABEL = { GPS: 'GPS', BIOMETRIC: 'Biometric' } as const;

export interface EmployeeFilters {
  search: string;
  role: StaffRole | null;
  /** `null` = everyone, otherwise only active or only inactive. */
  active: boolean | null;
  page: number;
}
export const DEFAULT_EMPLOYEE_FILTERS: EmployeeFilters = {
  search: '',
  role: null,
  active: null,
  page: 1,
};

export function parseEmployeeFilters(params: {
  get(name: string): string | null;
}): EmployeeFilters {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const role = params.get('role');
  const active = params.get('active');
  return {
    search: (params.get('q') ?? '').trim(),
    role: (STAFF_ROLES as readonly string[]).includes(role ?? '') ? (role as StaffRole) : null,
    active: active === 'true' ? true : active === 'false' ? false : null,
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}
export function employeeFiltersToSearch(f: EmployeeFilters): string {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.role) p.set('role', f.role);
  if (f.active !== null) p.set('active', String(f.active));
  if (f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Whole rupees only; empty means 0 for a new employee. Returns the number or an error message. */
export function parseRupees(
  text: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): { ok: true; value: number } | { ok: false; error: string } {
  const t = text.replace(/[,\s]/g, '');
  if (t === '')
    return allowEmpty ? { ok: true, value: 0 } : { ok: false, error: 'Enter an amount in rupees.' };
  if (!/^\d+$/.test(t)) return { ok: false, error: 'Use whole rupees, digits only.' };
  const n = Number(t);
  if (n > 100_000_000) return { ok: false, error: 'That amount is too large.' };
  return { ok: true, value: n };
}

/* ── salary ─────────────────────────────────────────────────────────────────── */

/** `21 / 23`: days present over working days. */
export const presentOverWorking = (r: Pick<SalaryRowDto, 'presentDays' | 'workingDays'>): string =>
  `${r.presentDays} / ${r.workingDays}`;

/** What the API computes (`fixed × min(present, working) ÷ working`, to the rupee), for sanity checks and tests. */
export function computePayable(
  fixedSalary: number,
  presentDays: number,
  workingDays: number,
): number {
  if (workingDays <= 0) return 0;
  return Math.round((fixedSalary * Math.min(presentDays, workingDays)) / workingDays);
}

/** The sheet's total payable, recomputed from rows (the API also sends `totals`). */
export const sumPayable = (rows: Array<Pick<SalaryRowDto, 'payable'>>): number =>
  rows.reduce((a, r) => a + r.payable, 0);

/** `salary-2026-11.csv` */
export const salaryFileName = (month: string): string => `salary-${month}.csv`;

/** The weekly-off rule in words: `SUN; SAT:1,3` → "Sun + 1st/3rd Sat". Unknown text is shown as is. */
const DAY_NAME: Record<string, string> = {
  SUN: 'Sun',
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
};
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
export function describeWeeklyOff(rule: string | null): string {
  if (!rule) return '';
  const parts = rule
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => {
      const [day, nth] = r.toUpperCase().split(':');
      const name = DAY_NAME[day ?? ''];
      if (!name) return null;
      if (!nth) return name;
      const nums = nth.split(',').map((n) => ORD[Number(n)]);
      return nums.every(Boolean) ? `${nums.join('/')} ${name}` : null;
    });
  return parts.every((p) => p !== null) ? parts.join(' + ') : rule;
}

/** `/attendance` URLs. The page reads: `date` (board day), `userId` + `month` (one person's month). */
export function attendanceHref(p: { date?: string; userId?: string; month?: string }): string {
  const q = new URLSearchParams();
  if (p.userId) q.set('userId', p.userId);
  if (p.month) q.set('month', p.month);
  if (!p.userId && p.date) q.set('date', p.date);
  const s = q.toString();
  return s ? `/attendance?${s}` : '/attendance';
}
