/**
 * The weekly off, as a small rule an Admin can type in Settings:
 *
 *   `SUN`            every Sunday
 *   `SAT:1,3`        the 1st and 3rd Saturday of each month
 *   `THU:2`          the 2nd Thursday
 *   `SUN; SAT:1,3`   several rules, separated by `;`
 *
 * "1st Saturday" is the first Saturday of the calendar month (days 1–7), "2nd" is days 8–14, and
 * so on; a 5th one exists only in months that have five. Dates are `YYYY-MM-DD` strings and the
 * maths is plain calendar arithmetic, so it never depends on the server's timezone.
 */
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OffRule {
  weekday: Weekday;
  /** Which occurrences in the month (1–5). Empty = every one. */
  weeks: number[];
}

export type ParsedWeeklyOff = { ok: true; rules: OffRule[] } | { ok: false; problem: string };

const HINT = 'Use e.g. "SUN" or "SUN; SAT:1,3" (days: SUN MON TUE WED THU FRI SAT, weeks 1–5)';

export function parseWeeklyOff(text: string): ParsedWeeklyOff {
  const rules: OffRule[] = [];
  const parts = text
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: false, problem: `Nothing to parse. ${HINT}` };

  for (const part of parts) {
    const m = /^([A-Za-z]{3})\s*(?::\s*([\d\s,]+))?$/.exec(part);
    const day = m?.[1]?.toUpperCase() as Weekday | undefined;
    if (!m || !day || !WEEKDAYS.includes(day))
      return { ok: false, problem: `"${part}" is not a rule. ${HINT}` };
    const weeks = (m[2] ?? '')
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .map(Number);
    if (weeks.some((w) => !Number.isInteger(w) || w < 1 || w > 5))
      return { ok: false, problem: `Weeks in "${part}" must be 1 to 5. ${HINT}` };
    rules.push({ weekday: day, weeks: [...new Set(weeks)].sort() });
  }
  return { ok: true, rules };
}

/** 0 = Sunday … 6 = Saturday, for a `YYYY-MM-DD` date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isWeeklyOff(date: string, rules: OffRule[]): boolean {
  const day = weekdayOf(date);
  const dom = Number(date.slice(8, 10));
  const nth = Math.ceil(dom / 7);
  return rules.some(
    (r) => WEEKDAYS.indexOf(r.weekday) === day && (r.weeks.length === 0 || r.weeks.includes(nth)),
  );
}

/** Every date of a `YYYY-MM` month. */
export function datesOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function workingDatesOf(month: string, rules: OffRule[]): string[] {
  return datesOfMonth(month).filter((d) => !isWeeklyOff(d, rules));
}

/** Why this is not a valid `YYYY-MM`, or null. */
export const isMonth = (v: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
