'use client';

import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRange } from '@/lib/api/hr';
import { businessDate } from '@/lib/format';
import {
  ATTENDANCE_LABEL,
  MAX_RANGE_DAYS,
  attendanceHref,
  formatWorked,
  isFutureMonth,
  monthOf,
  monthLabel,
  monthRange,
  parseRange,
  rangeLabel,
  rangePresets,
  shiftMonth,
} from '@/lib/hr';
import { cn } from '@/lib/utils';
import { DayRangeSwitch } from './day-range-switch';

/**
 * Everyone's attendance over a span (`?from=&to=`): by month with the arrows, a preset, or any two
 * dates (4 Nov to 10 Nov). One row per person; a name opens their month.
 */
export function AttendanceRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const today = businessDate();
  const q = useRange(from, to);
  const data = q.data;
  const go = (f: string, t: string) =>
    router.replace(attendanceHref({ from: f, to: t }), { scroll: false });
  const month = monthOf(from);
  const exactMonth = from === `${month}-01` && to === monthRange(month, today).to;
  const stepMonth = (by: number) => {
    const r = monthRange(shiftMonth(month, by), today);
    go(r.from, r.to);
  };
  const setFrom = (v: string) => {
    if (!v) return;
    const r = parseRange(v, v > to ? v : to, today);
    // a start beyond the longest span drags the end forward to stay valid
    if (r) go(r.from, r.to);
  };
  const setTo = (v: string) => {
    if (!v) return;
    const r = parseRange(v < from ? v : from, v, today);
    if (r) go(r.from, r.to);
  };

  return (
    <PageBody>
      <PageHeader title="Attendance" description={rangeLabel(from, to)} />

      <div className="flex flex-wrap items-center gap-2">
        <DayRangeSwitch mode="range" dayHref={attendanceHref({})} rangeHref={attendanceHref({ from, to })} />
        <div className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => stepMonth(-1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={isFutureMonth(shiftMonth(month, 1), today)}
            onClick={() => stepMonth(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="bg-card shadow-card inline-flex items-center gap-1 rounded-lg border p-0.5">
          <Input
            type="date"
            aria-label="From"
            value={from}
            max={today}
            className="h-7 w-36 border-0 bg-transparent shadow-none"
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input
            type="date"
            aria-label="To"
            value={to}
            min={from}
            max={today}
            className="h-7 w-36 border-0 bg-transparent shadow-none"
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {rangePresets(today).map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <Button
              key={p.label}
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={active}
              onClick={() => go(p.from, p.to)}
            >
              {p.label}
            </Button>
          );
        })}
        {!exactMonth && (
          <span className="text-muted-foreground ml-1 text-xs">Up to {MAX_RANGE_DAYS} days</span>
        )}
        {data && (
          <span className="text-muted-foreground tabular ml-auto text-xs">
            {data.workingDays} working {data.workingDays === 1 ? 'day' : 'days'} in this range
          </span>
        )}
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isError && !data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No one on attendance yet"
            description="Add employees and set how their attendance is tracked."
          />
        ) : data ? (
          <Table className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="hidden text-right md:table-cell">Missing out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => (
                <TableRow key={it.userId}>
                  <TableCell>
                    <Link
                      href={attendanceHref({ userId: it.userId, month: to.slice(0, 7) })}
                      className="focus-visible:ring-ring rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                    >
                      {it.name}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {it.designation ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {ATTENDANCE_LABEL[it.attendanceType]}
                  </TableCell>
                  <TableCell className="tabular text-success text-right font-medium">
                    {it.present}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'tabular text-right font-medium',
                      it.absent > 0 ? 'text-danger' : 'text-muted-foreground',
                    )}
                  >
                    {it.absent}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'tabular hidden text-right md:table-cell',
                      it.missingOut > 0 ? 'text-warning font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {it.missingOut}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {it.workedMinutes > 0 ? (
                      formatWorked(it.workedMinutes)
                    ) : (
                      <span className="text-muted-foreground">0h</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </div>
    </PageBody>
  );
}
