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
