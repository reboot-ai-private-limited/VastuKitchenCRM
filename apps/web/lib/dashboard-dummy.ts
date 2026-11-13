/**
 * PLACEHOLDER DATA. There is no meetings model yet, so the dashboard shows
 * stable made-up numbers (derived from the user id, so they don't jump on refresh).
 * Replace these with real API fields when those modules exist.
 */
const hash = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

/** Meetings held in the period for one person. */
export const dummyMeets = (userId: string, days: number): number =>
  (hash(`m${userId}`) % 3) + Math.max(0, Math.round(days * 0.6));

export const DUMMY_MEETINGS_TODAY = { total: 4, done: 2 };
