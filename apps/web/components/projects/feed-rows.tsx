import type { ReactNode } from 'react';
import { formatDate, formatTime } from '@/lib/format';

/** "Today" / "Yesterday" / "12 Nov", for the quiet time column on the left of every row. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (same(d, yesterday)) return 'Yesterday';
  return formatDate(iso);
}

/** The left column of a feed row: when it happened, small and muted. */
export function RowTime({ iso, edited }: { iso: string; edited?: boolean }) {
  return (
    <time
      dateTime={iso}
      title={`${formatDate(iso)}, ${formatTime(iso)}`}
      className="text-muted-foreground hidden w-16 shrink-0 pt-0.5 text-xs leading-5 sm:block"
    >
      {dayLabel(iso)}
      <span className="block">{formatTime(iso)}</span>
      {edited && <span className="block">Edited</span>}
    </time>
  );
}

/** A system event ("Ravi changed the due date"): one muted line in the same column grid. */
export function ActivityRow({ iso, children }: { iso: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 border-b py-3 last:border-b-0">
      <RowTime iso={iso} />
      <p className="text-muted-foreground min-w-0 flex-1 pl-0 text-sm sm:pl-12">
        <span
          aria-hidden
          className="bg-muted-foreground/40 mr-2 inline-block size-1.5 rounded-full align-middle"
        />
        {children}
      </p>
    </li>
  );
}
