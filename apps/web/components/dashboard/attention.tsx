'use client';

import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock,
  EyeOff,
  LifeBuoy,
  ListChecks,
  MousePointerClick,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { AttentionBlockDto, DashboardAttentionDto } from '@vastu/contracts';
import { relativeAge } from '@/lib/format';
import { refHref } from '@/lib/notifications';
import { cn } from '@/lib/utils';

type Severity = 'warning' | 'danger';

const BLOCKS: Array<{
  key: keyof DashboardAttentionDto;
  title: string;
  icon: LucideIcon;
  severity: Severity;
}> = [
  { key: 'unseenProposals', title: 'Proposals not opened', icon: EyeOff, severity: 'warning' },
  {
    key: 'noActionProposals',
    title: 'Seen, no action yet',
    icon: MousePointerClick,
    severity: 'warning',
  },
  { key: 'stagnantLeads', title: 'Stagnant leads', icon: TrendingDown, severity: 'warning' },
  {
    key: 'overdueComplaints',
    title: 'Complaints waiting too long',
    icon: LifeBuoy,
    severity: 'danger',
  },
  { key: 'overdueTodos', title: 'Overdue to-dos', icon: ListChecks, severity: 'danger' },
];

const DOT: Record<Severity, string> = { warning: 'bg-warning', danger: 'bg-danger' };
const COUNT: Record<Severity, string> = {
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

function Block({
  title,
  icon: Icon,
  severity,
  block,
}: {
  title: string;
  icon: LucideIcon;
  severity: Severity;
  block: AttentionBlockDto;
}) {
  const [open, setOpen] = useState(true);
  const empty = block.total === 0;
  return (
    <section aria-label={title} className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={empty}
        className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-2 px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="flex-1 font-medium">{title}</span>
        {empty ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <CheckCircle2 className="text-success size-4" aria-hidden /> Nothing waiting
          </span>
        ) : (
          <>
            <span
              className={cn(
                'tabular rounded-full px-2 py-0.5 text-xs font-semibold',
                COUNT[severity],
              )}
            >
              {block.capped ? `${block.total}+` : block.total}
            </span>
            <ChevronDown
              className={cn(
                'text-muted-foreground size-4 transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </>
        )}
      </button>
      {open && !empty && (
        <ul className="pb-2">
          {block.items.map((item, i) => (
            <li key={`${item.ref.kind}-${item.ref.id}-${i}`}>
              <Link
                href={refHref(item.ref)}
                className="hover:bg-primary-soft/50 focus-visible:ring-ring flex items-start gap-3 px-4 py-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[severity])}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="text-muted-foreground block text-xs">{item.detail}</span>
                </span>
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap">
                  <Clock className="size-3" aria-hidden />
                  {relativeAge(item.since)}
                </span>
              </Link>
            </li>
          ))}
          {block.total > block.items.length && (
            <li className="text-muted-foreground px-4 pt-1 pb-1 text-xs">
              Showing the oldest {block.items.length} of{' '}
              {block.capped ? `${block.total}+` : block.total}.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function AttentionCard({ attention }: { attention: DashboardAttentionDto }) {
  const total = BLOCKS.reduce((n, b) => n + attention[b.key].total, 0);
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <BellRing className="text-muted-foreground size-4" aria-hidden />
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <span className="text-muted-foreground text-xs">
          {total === 0 ? 'All clear' : `${total} item${total === 1 ? '' : 's'}`}
        </span>
      </div>
      {BLOCKS.map((b) => (
        <Block
          key={b.key}
          title={b.title}
          icon={b.icon}
          severity={b.severity}
          block={attention[b.key]}
        />
      ))}
    </div>
  );
}
