'use client';

import type { ComplaintDto } from '@vastu/contracts';
import { CheckCircle2, ChevronDown, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { RowTime } from '@/components/projects/feed-rows';
import { snippet } from '@/lib/complaints';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ComplaintBody } from './complaint-panel';

/**
 * A complaint in the project chat, anchored where it was raised, with its conversation underneath.
 * While it is being worked on it is a full card. Once closed it folds into a quiet summary line
 * ("Closed by Owner · fixed the hinge") that opens on click.
 */
export function ComplaintCard({ complaint: c }: { complaint: ComplaintDto }) {
  const closed = c.status === 'CLOSED';
  const [expanded, setExpanded] = useState(false);
  const closedEvent = [...c.history].reverse().find((e) => e.type === 'CLOSED');

  return (
    <li className="flex gap-3 border-b py-4 last:border-b-0">
      <RowTime iso={c.createdAt} />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
          closed ? 'bg-muted text-muted-foreground' : 'bg-warning-soft text-warning',
        )}
      >
        {closed ? <CheckCircle2 className="size-4" /> : <LifeBuoy className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {closed && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md text-left text-sm outline-none focus-visible:ring-2"
          >
            <span className="min-w-0 flex-1">
              <span className="text-foreground font-medium">Complaint closed</span>
              {closedEvent?.actor ? ` by ${closedEvent.actor.name}` : ''}
              {closedEvent ? ` on ${formatDate(closedEvent.at)}` : ''}
              <span className="block truncate">{snippet(c.description, 110)}</span>
            </span>
            <ChevronDown className="size-4 shrink-0" aria-hidden />
          </button>
        ) : (
          <div
            className={cn(
              'space-y-1 rounded-xl border p-3',
              closed ? 'bg-muted/40' : 'border-warning/30 bg-warning-soft/20',
            )}
          >
            <p className="text-sm font-semibold">
              {closed ? 'Complaint (closed)' : 'Complaint'}
              <span className="text-muted-foreground font-normal"> · {c.projectName}</span>
            </p>
            <ComplaintBody
              complaint={c}
              onCollapse={closed ? () => setExpanded(false) : undefined}
            />
          </div>
        )}
      </div>
    </li>
  );
}
