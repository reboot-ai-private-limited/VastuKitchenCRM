/** Rupee monthly targets for the demo staff, by phone: [this month, last month]. */
export const DEMO_TARGETS: Record<string, [number, number]> = {
  '9000000011': [2_500_000, 2_000_000], // Ravi: wins ₹30 L, so over target
  '9000000012': [15_000_000, 12_000_000], // Anil: wins ₹1.2 Cr, so 80%
  '9000000013': [1_500_000, 1_500_000], // Dev
  '9000000014': [1_200_000, 1_000_000], // Sneha
  '9000000015': [1_000_000, 1_000_000], // Kiran
  '9000000016': [800_000, 800_000], // Tarun
  '9000000017': [800_000, 800_000], // Bikash
  '9000000018': [500_000, 500_000], // Rita
};

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

/** `[this month, last month]` as `YYYY-MM`. */
export function targetMonths(now = new Date()): [string, string] {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return [monthOf(now), monthOf(prev)];
}
