'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth';
import { businessDate, formatDay } from '@/lib/format';
import { AttentionCard } from './attention';
import { Counters, CountersSkeleton, StaffCard } from './counters';
import { PeopleBlock } from './people';
import { RecentBlock } from './recent';
import { RangePicker, type DateRange } from './range-picker';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-baseline gap-x-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function DashboardView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const isHr = user?.role === 'HR';

  // The range lives in the URL so a view can be shared and survives a refresh.
  const range: DateRange = useMemo(() => {
    const today = businessDate();
    const from = params.get('from');
    const to = params.get('to');
    const valid = (s: string | null): s is string => !!s && DATE.test(s);
    if (valid(from) && valid(to) && from <= to) return { from, to };
    return { from: today, to: today };
  }, [params]);

  const setRange = useCallback(
    (r: DateRange) => {
      const today = businessDate();
      router.replace(r.from === today && r.to === today ? '/' : `/?from=${r.from}&to=${r.to}`, { scroll: false });
    },
    [router],
  );

  // Today is the default, so omit the dates and let the API default to today (cheap, cacheable by key).
  const query = useDashboard(range);
  const d = query.data;
  const multiDay = range.from !== range.to;
  const label = multiDay ? `${formatDay(range.from)} – ${formatDay(range.to)}` : formatDay(range.from);

  const retry = () => void query.refetch();
  const failed = (name: 'counters' | 'people' | 'attention' | 'recent') => d?.errors.includes(name) ?? false;

  return (
    <PageBody>
      <PageHeader title="Dashboard" description={isHr ? `Attendance · ${label}` : label} actions={<RangePicker value={range} onChange={setRange} />} />

      {query.isError && !d ? (
        <div className="bg-card rounded-lg border">
          <ErrorState error={query.error} onRetry={retry} title="Couldn’t load the dashboard" />
        </div>
      ) : (
        <>
          {/* Counters */}
          {query.isPending ? (
            <CountersSkeleton />
          ) : isHr ? (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StaffCard staff={d?.staff ?? null} />
            </div>
          ) : d?.counters ? (
            <Counters counters={d.counters} staff={d.staff} />
          ) : (
            <div className="bg-card rounded-lg border">
              <ErrorState title="Couldn’t load the counters" onRetry={retry} />
            </div>
          )}

          {!isHr && (
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <Card title="Needs attention" subtitle="Right now">
                {query.isPending ? (
                  <CardSkeleton rows={5} />
                ) : d?.attention ? (
                  <AttentionCard attention={d.attention} />
                ) : (
                  <ErrorState title="Couldn’t load what needs attention" onRetry={retry} />
                )}
              </Card>
              <Card title="Recent customer activity">
                {query.isPending ? <CardSkeleton rows={4} /> : failed('recent') || !d?.recent ? <ErrorState title="Couldn’t load recent activity" onRetry={retry} /> : <RecentBlock items={d.recent} />}
              </Card>
            </div>
          )}

          <Card title={isHr ? 'Attendance' : 'Staff activity'} subtitle={label}>
            {query.isPending ? (
              <CardSkeleton rows={6} />
            ) : failed('people') || !d?.people ? (
              <ErrorState title="Couldn’t load staff activity" onRetry={retry} />
            ) : (
              <PeopleBlock people={d.people} multiDay={multiDay} attendanceOnly={isHr} />
            )}
          </Card>
        </>
      )}
    </PageBody>
  );
}
