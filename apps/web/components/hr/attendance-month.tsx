'use client';

import type { AttendanceDayDto, AttendanceMonthDto } from '@vastu/contracts';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Smartphone,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useMyMonth, useUserMonth } from '@/lib/api/hr';
import { businessDate, formatDay, formatTime } from '@/lib/format';
import {
  METHOD_LABEL,
  attendanceHref,
  calendarCells,
  currentMonth,
  dayLabel,
  monthLabel,
  shiftMonth,
} from '@/lib/hr';
import { cn } from '@/lib/utils';
import { CorrectDayDialog, RemoveDayDialog } from './correct-day-dialog';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CELL: Record<AttendanceDayDto['status'], string> = {
  PRESENT: 'bg-success-soft text-success',
  ABSENT: 'bg-danger-soft text-danger',
  OFF: 'bg-neutral-soft text-neutral',
  FUTURE: 'bg-transparent text-muted-foreground',
};

/**
 * One person's month. `userId` set → Admin/HR looking at someone (can correct days); no `userId` → the
 * signed-in person's own calendar, read-only (GPS check-in happens on the phone app).
 */
export function AttendanceMonth({
  userId,
  month,
  canEdit,
  showAppHint,
}: {
  userId: string | null;
  month: string;
  canEdit: boolean;
  showAppHint: boolean;
}) {
  const router = useRouter();
  const mine = useMyMonth(month, userId === null);
  const theirs = useUserMonth(userId ?? '', month, userId !== null);
  const q = userId === null ? mine : theirs;
  const now = currentMonth();
  const go = (m: string) =>
    router.replace(
      attendanceHref({ userId: userId ?? undefined, month: m === now ? undefined : m }),
      { scroll: false },
    );

  if (q.isError && !q.data) {
    return q.error instanceof ApiError && q.error.isNotFound ? (
      <NotFoundView />
    ) : (
      <ErrorState error={q.error} onRetry={() => q.refetch()} />
    );
  }

  return (
    <PageBody>
      <div>
        {userId !== null && (
          <Link
            href="/attendance"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Attendance board
          </Link>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">
              {userId === null ? 'My attendance' : (q.data?.name ?? 'Attendance')}
            </h1>
            <p className="text-muted-foreground text-sm">{monthLabel(month)}</p>
          </div>
          <div className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => go(shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              disabled={month >= now}
              onClick={() => go(shiftMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>

      {showAppHint && (
        <p className="bg-info-soft text-info flex items-center gap-2 rounded-lg p-3 text-sm">
          <Smartphone className="size-4 shrink-0" aria-hidden /> Check in and out from the Vaastu
          app on your phone. This page is read-only.
        </p>
      )}

      {q.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : q.data ? (
        <MonthBody data={q.data} userId={userId} canEdit={canEdit} stale={q.isPlaceholderData} />
      ) : null}
    </PageBody>
  );
}

function MonthBody({
  data,
  userId,
  canEdit,
  stale,
}: {
  data: AttendanceMonthDto;
  userId: string | null;
  canEdit: boolean;
  stale: boolean;
}) {
  const today = businessDate();
  const [picked, setPicked] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'correct' | 'remove' | null>(null);
  const cells = calendarCells(data.days);
  // Default to today when it is in this month, otherwise the first day, so the panel is never empty.
  const selectedDate =
    picked && data.days.some((d) => d.date === picked)
      ? picked
      : data.days.some((d) => d.date === today)
        ? today
        : (data.days[0]?.date ?? null);
  const sel = data.days.find((d) => d.date === selectedDate) ?? null;
  const target = userId ?? data.userId;

  return (
    <div
      className={cn(
        'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]',
        stale && 'opacity-60 transition-opacity',
      )}
    >
      <section className="bg-card shadow-card rounded-xl border p-4">
        <p className="text-muted-foreground mb-3 text-sm">
          Present <span className="text-foreground tabular font-semibold">{data.presentDays}</span>{' '}
          of <span className="text-foreground tabular font-semibold">{data.workingDays}</span>{' '}
          working days
          {data.missingOutDays > 0 && (
            <span className="text-warning"> · {data.missingOutDays} with no out time</span>
          )}
        </p>
        <div
          className="grid grid-cols-7 gap-1 text-center text-xs"

          aria-label={`${monthLabel(data.month)} attendance`}
        >
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-muted-foreground py-1 font-semibold">
              {w}
            </div>
          ))}
          {cells.map((c, i) =>
            c === null ? (
              <div key={`pad${i}`} />
            ) : (
              <button
                key={c.date}
                type="button"

                aria-label={`${formatDay(c.date)}: ${dayLabel(c)}${c.corrected ? ', corrected' : ''}`}
                aria-pressed={c.date === selectedDate}
                onClick={() => setPicked(c.date)}
                className={cn(
                  'focus-visible:ring-ring relative grid aspect-square place-items-center rounded-lg text-sm font-medium outline-none focus-visible:ring-2',
                  CELL[c.status],
                  c.missingOut && 'ring-warning ring-2 ring-inset',
                  c.date === selectedDate && 'outline-primary outline-2 outline-offset-1',
                  c.date === today && 'font-bold underline decoration-2 underline-offset-4',
                )}
              >
                <span className="tabular">{Number(c.date.slice(8))}</span>
                {c.corrected && (
                  <Pencil className="absolute top-0.5 right-0.5 size-2.5" aria-hidden />
                )}
              </button>
            ),
          )}
        </div>
        <ul
          className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          aria-label="Legend"
        >
          <li className="flex items-center gap-1.5">
            <span className="bg-success-soft size-3 rounded" /> Present
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-danger-soft size-3 rounded" /> Absent
          </li>
          <li className="flex items-center gap-1.5">
            <span className="bg-neutral-soft size-3 rounded" /> Weekly off
          </li>
          <li className="flex items-center gap-1.5">
            <span className="ring-warning size-3 rounded ring-2 ring-inset" /> No out time
          </li>
          <li className="flex items-center gap-1.5">
            <Pencil className="size-3" aria-hidden /> Corrected
          </li>
        </ul>
      </section>

      <aside
        className="bg-card shadow-card space-y-3 rounded-xl border p-4 text-sm"
        aria-live="polite"
      >
        {sel ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{formatDay(sel.date)}</h2>
              <StatusBadge kind="day" value={sel.status} />
            </div>
            <dl className="space-y-1.5">
              <Row label="In">{sel.inAt ? formatTime(sel.inAt) : '—'}</Row>
              <Row label="Out">{sel.outAt ? formatTime(sel.outAt) : '—'}</Row>
              {sel.method && <Row label="Recorded by">{METHOD_LABEL[sel.method]}</Row>}
            </dl>
            {sel.missingOut && (
              <p className="text-warning flex items-center gap-1.5 text-xs">
                <TriangleAlert className="size-3.5" aria-hidden /> No out time was recorded.
              </p>
            )}
            {sel.inLocation && (
              <a
                className="text-primary inline-flex items-center gap-1 text-xs underline"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.google.com/maps?q=${sel.inLocation.lat},${sel.inLocation.lng}`}
              >
                <MapPin className="size-3.5" aria-hidden /> Check-in location
              </a>
            )}
            {sel.corrected && (
              <p className="bg-secondary rounded-md p-2 text-xs">
                <span className="font-semibold">Corrected.</span> {sel.note ?? 'No reason given.'}
              </p>
            )}
            {!sel.corrected && sel.note && (
              <p className="text-muted-foreground text-xs">{sel.note}</p>
            )}
            {canEdit && sel.status !== 'FUTURE' && sel.date <= today && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setDialog('correct')}>
                  {sel.inAt ? 'Correct day…' : 'Enter attendance…'}
                </Button>
                {sel.inAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => setDialog('remove')}
                  >
                    Remove day…
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">Pick a day.</p>
        )}
        <p className="text-muted-foreground border-t pt-3 text-xs">
          There is no leave tracking and no change history.
        </p>
      </aside>

      {dialog === 'correct' && sel && (
        <CorrectDayDialog
          key={sel.date}
          userId={target}
          name={data.name}
          date={sel.date}
          day={sel}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'remove' && sel && (
        <RemoveDayDialog
          userId={target}
          name={data.name}
          date={sel.date}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="tabular text-right">{children}</dd>
  </div>
);
