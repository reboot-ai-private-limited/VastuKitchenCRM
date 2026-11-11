/**
 * Calendar dates in the BUSINESS's timezone. "Due on the 14th" means the 14th as people there
 * live it: at 11 pm in Siliguri on the 14th the to-do is still due today, even though it is already
 * the 15th in UTC. Dates travel as `YYYY-MM-DD` strings, which sort and compare correctly.
 */
export function todayIn(timeZone: string, now: Date): string {
  // The `en-CA` locale formats a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `date` moved by `days` (negative = earlier), as `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The instant at which the clocks in `timeZone` read `hhmm` on `date` (`YYYY-MM-DD`). Used to turn
 * "9:05 in Siliguri on the 3rd" into a real moment, whatever timezone the server runs in.
 */
export function atLocalTime(timeZone: string, date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, m);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (shown - guess));
}
