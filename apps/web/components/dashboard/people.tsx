'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DashboardPersonDto } from '@vastu/contracts';
import { EmptyState } from '@/components/common/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDuration, formatTime, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'in' | 'last' | 'calls' | 'leads' | 'proposals';

const value = (p: DashboardPersonDto, key: SortKey): number | string => {
  switch (key) {
    case 'name':
      return p.name.toLowerCase();
    case 'in':
      return p.attendance?.inAt ?? '';
    case 'last':
      return p.activity?.lastAt ?? '';
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
): DashboardPersonDto[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...people].sort((a, b) => {
    const x = value(a, key);
    const y = value(b, key);
    // People with nothing to sort on always sink to the bottom, whichever way it is sorted.
    const xe = x === '' || x === 0;
    const ye = y === '' || y === 0;
    if (key !== 'name' && xe !== ye) return xe ? 1 : -1;
    return (x < y ? -1 : x > y ? 1 : 0) * sign || a.name.localeCompare(b.name);
  });
}

const timeRange = (a: string | null, b: string | null) =>
  a && b ? `${formatTime(a)} – ${formatTime(b)}` : a ? `${formatTime(a)} –` : '—';

function Attendance({ p, multiDay }: { p: DashboardPersonDto; multiDay: boolean }) {
  const a = p.attendance;
  if (!a) return <span className="text-muted-foreground">Not tracked</span>;
  if (multiDay)
    return (
      <span className="tabular">
        {a.daysPresent} day{a.daysPresent === 1 ? '' : 's'}
      </span>
    );
  if (a.daysPresent === 0) return <span className="text-muted-foreground">Not in yet</span>;
  return <span className="tabular">{timeRange(a.inAt, a.outAt)}</span>;
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
  multiDay,
  attendanceOnly,
}: {
  people: DashboardPersonDto[];
  multiDay: boolean;
  attendanceOnly: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  const rows = useMemo(() => sortPeople(people, sort.key, sort.dir), [people, sort]);
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

  return (
    <>
      {/* Tablet and up: a table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="bg-muted text-muted-foreground text-xs">
            <tr>
              <SortHeader label="Person" k="name" sort={sort} onSort={onSort} />
              <SortHeader
                label={multiDay ? 'Attendance' : 'In – out'}
                k="in"
                sort={sort}
                onSort={onSort}
              />
              {!attendanceOnly && (
                <>
                  <SortHeader label="First – last activity" k="last" sort={sort} onSort={onSort} />
                  <SortHeader label="Calls" k="calls" sort={sort} onSort={onSort} align="right" />
                  <SortHeader label="Leads" k="leads" sort={sort} onSort={onSort} align="right" />
                  <SortHeader
                    label="Proposals"
                    k="proposals"
                    sort={sort}
                    onSort={onSort}
                    align="right"
                  />
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Feed
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.userId} className="hover:bg-primary-soft/40 h-12 border-b last:border-b-0">
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary-soft text-primary-hover text-xs font-semibold">
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.designation && (
                        <p className="text-muted-foreground truncate text-xs">{p.designation}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Attendance p={p} multiDay={multiDay} />
                </td>
                {!attendanceOnly && p.activity && (
                  <>
                    <td className="tabular px-3 py-1.5">
                      {timeRange(p.activity.firstAt, p.activity.lastAt)}
                    </td>
                    <td
                      className="tabular px-3 py-1.5 text-right"
                      title={
                        p.activity.talkSeconds
                          ? `Talk time ${formatDuration(p.activity.talkSeconds)}`
                          : undefined
                      }
                    >
                      {p.activity.calls}
                      {p.activity.calls > 0 && (
                        <span className="text-muted-foreground"> ({p.activity.answeredCalls})</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">{p.activity.leadsHandled}</td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {p.activity.proposalsGenerated}
                      {p.activity.proposalsSent > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({p.activity.proposalsSent} sent)
                        </span>
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right">
                      {p.activity.posts + p.activity.comments}
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
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary-soft text-primary-hover text-xs font-semibold">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                {p.designation && (
                  <p className="text-muted-foreground truncate text-xs">{p.designation}</p>
                )}
              </div>
              <Attendance p={p} multiDay={multiDay} />
            </div>
            {!attendanceOnly && p.activity && (
              <p className="text-muted-foreground tabular text-xs">
                Calls {p.activity.calls} ({p.activity.answeredCalls}) · Leads{' '}
                {p.activity.leadsHandled} · Proposals {p.activity.proposalsGenerated}
                {p.activity.lastAt && ` · Last ${formatTime(p.activity.lastAt)}`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
