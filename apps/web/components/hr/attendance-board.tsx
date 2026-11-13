'use client';

import type { AttendanceDayDto } from '@vastu/contracts';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { ApiError } from '@/lib/api/client';
import { useBoard, useSimulateAttendance } from '@/lib/api/hr';
import { addDays, businessDate, formatDay, formatTime } from '@/lib/format';
import { ATTENDANCE_LABEL, attendanceHref, rangePresets } from '@/lib/hr';
import { DayRangeSwitch } from './day-range-switch';
import { cn } from '@/lib/utils';
import { CorrectDayDialog, RemoveDayDialog } from './correct-day-dialog';

const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

type Action = {
  kind: 'correct' | 'remove';
  userId: string;
  name: string;
  day: AttendanceDayDto;
} | null;

export function AttendanceBoard({ date }: { date: string }) {
  const router = useRouter();
  const today = businessDate();
  const q = useBoard(date);
  const simulate = useSimulateAttendance();
  const [action, setAction] = useState<Action>(null);
  const data = q.data;
  const go = (d: string) =>
    router.replace(attendanceHref({ date: d === today ? undefined : d }), { scroll: false });

  return (
    <PageBody>
      <PageHeader
        title="Attendance"
        description={
          data ? formatDay(data.date) + (data.date === today ? ' (today)' : '') : undefined
        }
        actions={
          DEMO && (
            <Button
              variant="outline"
              disabled={simulate.isPending}
              title="Fills the last 14 days with believable attendance. Never overwrites an existing day."
              onClick={() =>
                simulate.mutate(14, {
                  onSuccess: (r) =>
                    toast.success(
                      `Demo attendance: ${r.created} added, ${r.skipped} already there`,
                    ),
                  onError: (e) =>
                    toast.error(
                      e instanceof ApiError ? e.message : 'Couldn’t generate demo attendance.',
                    ),
                })
              }
            >
              {simulate.isPending ? 'Generating…' : 'Generate demo attendance'}
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <DayRangeSwitch
          mode="day"
          rangeHref={attendanceHref({ from: rangePresets(today)[0]!.from, to: today })}
          dayHref={attendanceHref({})}
        />
        <div className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous day"
            onClick={() => go(addDays(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            aria-label="Date"
            value={date}
            max={today}
            className="h-7 w-40 border-0 bg-transparent shadow-none"
            onChange={(e) => e.target.value && go(e.target.value > today ? today : e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => go(addDays(date, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        {date !== today && (
          <Button variant="ghost" onClick={() => go(today)}>
            Today
          </Button>
        )}
        {data && (
          <div
            className="ml-auto flex flex-wrap items-center gap-2 text-xs font-medium"
            aria-label="Day summary"
          >
            <span className="bg-success-soft text-success rounded-full px-2.5 py-1">
              Present {data.counts.present}
            </span>
            <span className="bg-danger-soft text-danger rounded-full px-2.5 py-1">
              Absent {data.counts.absent}
            </span>
            <span className="bg-warning-soft text-warning rounded-full px-2.5 py-1">
              Missing out {data.counts.missingOut}
            </span>
          </div>
        )}
      </div>

      {data?.offDay && (
        <p className="bg-neutral-soft text-neutral rounded-lg p-3 text-sm">
          Weekly off. Anyone who worked today still counts as present.
        </p>
      )}

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
            icon={CalendarDays}
            title="No one on attendance yet"
            description="Add employees and set how their attendance is tracked."
          />
        ) : data ? (
          <Table className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it) => {
                const d = it.day;
                return (
                  <TableRow key={it.userId}>
                    <TableCell>
                      <Link
                        href={attendanceHref({ userId: it.userId, month: data.date.slice(0, 7) })}
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
                    <TableCell className="tabular">{d.inAt ? formatTime(d.inAt) : '—'}</TableCell>
                    <TableCell className="tabular">{d.outAt ? formatTime(d.outAt) : '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusBadge kind="day" value={d.status} />
                        {d.missingOut && (
                          <TriangleAlert
                            className="text-warning size-3.5"
                            aria-label="No out time"
                          />
                        )}
                        {d.corrected && (
                          <Pencil
                            className="text-muted-foreground size-3.5"
                            aria-label="Corrected"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${it.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={attendanceHref({
                                userId: it.userId,
                                month: data.date.slice(0, 7),
                              })}
                            >
                              View month
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setAction({
                                kind: 'correct',
                                userId: it.userId,
                                name: it.name,
                                day: d,
                              })
                            }
                          >
                            {d.inAt ? 'Correct day…' : 'Enter attendance…'}
                          </DropdownMenuItem>
                          {d.inAt && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setAction({
                                  kind: 'remove',
                                  userId: it.userId,
                                  name: it.name,
                                  day: d,
                                })
                              }
                            >
                              Remove day…
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </div>

      {action?.kind === 'correct' && (
        <CorrectDayDialog
          userId={action.userId}
          name={action.name}
          date={date}
          day={action.day}
          onClose={() => setAction(null)}
        />
      )}
      {action?.kind === 'remove' && (
        <RemoveDayDialog
          userId={action.userId}
          name={action.name}
          date={date}
          onClose={() => setAction(null)}
        />
      )}
    </PageBody>
  );
}
