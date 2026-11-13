'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { DashboardPersonDto } from '@vastu/contracts';
import { EmptyState } from '@/components/common/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatINRShort, formatTime, initials } from '@/lib/format';
import { dummyMeets } from '@/lib/dashboard-dummy';
import { attendanceHref, currentMonth, monthLabel } from '@/lib/hr';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'in' | 'attendance' | 'calls' | 'leads' | 'meets' | 'proposals' | 'target';

const value = (p: DashboardPersonDto, key: SortKey, days: number): number | string => {
  switch (key) {
    case 'name':
      return p.name.toLowerCase();
    case 'in':
      return p.attendance?.inAt ?? '';
    case 'attendance':
      return p.attendance?.daysPresent ?? 0;
    case 'meets':
      return dummyMeets(p.userId, days);
    case 'target':
      return p.target && p.target.amount > 0 ? p.target.achieved / p.target.amount : 0;
    case 'calls':
      return p.activity?.calls ?? 0;
    case 'leads':
      return p.activity?.leadsHandled ?? 0;
    case 'proposals':
      return p.activity?.proposalsGenerated ?? 0;
  }
};

export function sortPeople(
  people: DashboardPersonDto[],
  key: SortKey,
  dir: 'asc' | 'desc',
  days = 1,
): DashboardPersonDto[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...people].sort((a, b) => {
    const x = value(a, key, days);
    const y = value(b, key, days);
    // People with nothing to sort on always sink to the bottom, whichever way it is sorted.
    const xe = x === '' || x === 0;
    const ye = y === '' || y === 0;
    if (key !== 'name' && xe !== ye) return xe ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * sign || a.name.localeCompare(b.name);
  });
}

/** In / Out for a single day; across a range these are the earliest in and latest out. */
const clock = (iso: string | null) => (iso ? formatTime(iso) : '—');

function Attendance({ p, days, offDay }: { p: DashboardPersonDto; days: number; offDay: boolean }) {
  const a = p.attendance;
  if (!a) return <span className="text-muted-foreground">Not tracked</span>;
  if (days > 1)
    return (
      <span className="tabular" title={`Present ${a.daysPresent} of ${days} days`}>
        {a.daysPresent}/{days}
      </span>
    );
  if (a.daysPresent > 0) return <span className="text-success font-medium">Present</span>;
  return <span className="text-muted-foreground">{offDay ? 'Off' : 'Absent'}</span>;
}

function Target({ target }: { target: DashboardPersonDto['target'] }) {
  if (!target || target.amount === 0)
    return (
      <span className="text-muted-foreground ml-auto block text-right text-xs">
        {target ? `${formatINRShort(target.achieved)} won · ` : ''}No target
      </span>
    );
  const pct = Math.round((target.achieved / target.amount) * 100);
  return (
    <div
      className="ml-auto flex w-40 items-center justify-end gap-2"
      title={`${pct}% of the ${target.month} target${target.carriedFrom ? ` (carried over from ${target.carriedFrom})` : ''}`}
    >
      <span className="tabular text-xs">
        {formatINRShort(target.achieved)} / {formatINRShort(target.amount)}
      </span>
      <span className="bg-muted h-1.5 w-10 shrink-0 overflow-hidden rounded-full" aria-hidden>
        <span
          className={cn('block h-full rounded-full', pct >= 100 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
    </div>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === k;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-3 py-2 font-medium', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded focus-visible:ring-2 focus-visible:outline-none',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden />
      </button>
    </th>
  );
}

export function PeopleBlock({
  people,
  days,
  offDay,
  attendanceOnly,
}: {
  people: DashboardPersonDto[];
  days: number;
  offDay: boolean;
  attendanceOnly: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  const rows = useMemo(() => sortPeople(people, sort.key, sort.dir, days), [people, sort, days]);
  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' || key === 'in' ? 'asc' : 'desc' },
    );

  if (people.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="No one on attendance yet"
        description="Add employees and set how their attendance is tracked."
      />
    );

  const multiDay = days > 1;
  const month = people.find((p) => p.target)?.target?.month;
  const targetLabel = month ? `Target · ${monthLabel(month)}` : 'Target';
  const Name = ({ p }: { p: DashboardPersonDto }) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary-soft text-primary-hover text-xs font-semibold">
          {initials(p.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">
          <Link
            href={attendanceHref({ userId: p.userId, month: currentMonth() })}
            className="focus-visible:ring-ring rounded-sm outline-none hover:underline focus-visible:ring-2"
          >
            {p.name}
          </Link>
        </p>
        {p.designation && <p className="text-muted-foreground truncate text-xs">{p.designation}</p>}
      </div>
    </div>
  );

  return (
    <>
      {/* Tablet and up: a table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="bg-muted text-muted-foreground text-xs">
            <tr>
              <SortHeader label="Employee" k="name" sort={sort} onSort={onSort} />
              <SortHeader label="In" k="in" sort={sort} onSort={onSort} />
              <th scope="col" className="px-3 py-2 font-medium">
                Out
              </th>
              <SortHeader label="Attendance" k="attendance" sort={sort} onSort={onSort} />
              {!attendanceOnly && (
                <>
                  <SortHeader label="Calls" k="calls" sort={sort} onSort={onSort} align="right" />
                  <SortHeader label="Leads" k="leads" sort={sort} onSort={onSort} align="right" />
                  <SortHeader label="Meets" k="meets" sort={sort} onSort={onSort} align="right" />
                  <SortHeader
                    label="Proposals"
                    k="proposals"
                    sort={sort}
                    onSort={onSort}
                    align="right"
                  />
                  <SortHeader
                    label={targetLabel}
                    k="target"
                    sort={sort}
                    onSort={onSort}
                    align="right"
                  />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.userId} className="hover:bg-primary-soft/40 h-12 border-b last:border-b-0">
                <td className="px-3 py-1.5">
                  <Name p={p} />
                </td>
                <td className="tabular px-3 py-1.5">{clock(p.attendance?.inAt ?? null)}</td>
                <td className="tabular px-3 py-1.5">{clock(p.attendance?.outAt ?? null)}</td>
                <td className="px-3 py-1.5">
                  <Attendance p={p} days={days} offDay={offDay} />
                </td>
                {!attendanceOnly && p.activity && (
                  <>
                    <td className="tabular px-3 py-1.5 text-right">
                      {p.activity.calls}
                      {p.activity.calls > 0 && (
                        <span className="text-muted-foreground"> ({p.activity.answeredCalls})</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">{p.activity.leadsHandled}</td>
                    <td className="tabular px-3 py-1.5 text-right">{dummyMeets(p.userId, days)}</td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {p.activity.proposalsGenerated}
                      {p.activity.proposalsSent > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({p.activity.proposalsSent} sent)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Target target={p.target} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <ul className="divide-y md:hidden">
        {rows.map((p) => (
          <li key={p.userId} className="space-y-1.5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <Name p={p} />
              </div>
              <Attendance p={p} days={days} offDay={offDay} />
            </div>
            {!multiDay && (
              <p className="text-muted-foreground tabular text-xs">
                In {clock(p.attendance?.inAt ?? null)} · Out {clock(p.attendance?.outAt ?? null)}
              </p>
            )}
            {!attendanceOnly && p.activity && (
              <>
                <p className="text-muted-foreground tabular text-xs">
                  Calls {p.activity.calls} ({p.activity.answeredCalls}) · Leads{' '}
                  {p.activity.leadsHandled} · Meets {dummyMeets(p.userId, days)} · Proposals{' '}
                  {p.activity.proposalsGenerated}
                </p>
                <Target target={p.target} />
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
