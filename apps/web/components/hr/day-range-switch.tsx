import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Day | Range: the two ways Admin/HR look at everyone's attendance. */
export function DayRangeSwitch({
  mode,
  dayHref,
  rangeHref,
}: {
  mode: 'day' | 'range';
  dayHref: string;
  rangeHref: string;
}) {
  const item = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1 text-sm font-medium transition-colors',
      active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground',
    );
  return (
    <div
      role="group"
      aria-label="View"
      className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5"
    >
      <Link href={dayHref} aria-current={mode === 'day' ? 'page' : undefined} className={item(mode === 'day')}>
        Day
      </Link>
      <Link href={rangeHref} aria-current={mode === 'range' ? 'page' : undefined} className={item(mode === 'range')}>
        Range
      </Link>
    </div>
  );
}
