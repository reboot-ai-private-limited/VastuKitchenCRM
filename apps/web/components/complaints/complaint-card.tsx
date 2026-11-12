'use client';

import type { ComplaintDto } from '@vastu/contracts';
import { CheckCircle2, ChevronDown, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/common/status-badge';
import { RowTime } from '@/components/projects/feed-rows';
import { PhotoGrid } from '@/components/projects/photos';
import { snippet } from '@/lib/complaints';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ComplaintActions, ComplaintBody } from './complaint-panel';
import { ComplaintThread, ReplyBox } from './complaint-thread';
import { ReopenedChip } from './complaints-view';

/**
 * The record of a complaint, anchored in the chat where it was raised: what was reported and where it
 * stands now. Everything that happens afterwards is posted as its own row at the bottom of the chat
 * (see ComplaintUpdateRow), so this card stays calm: it only counts the updates and can show the
 * whole thread on request. A complaint with no updates yet keeps its buttons and Reply here. Once
 * closed it folds into a quiet summary line.
 */
export function ComplaintCard({
  complaint: c,
  updateCount,
}: {
  complaint: ComplaintDto;
  updateCount: number;
}) {
  const closed = c.status === 'CLOSED';
  const [open, setOpen] = useState(false);
  const closedEvent = [...c.history].reverse().find((e) => e.type === 'CLOSED');

  return (
    <li id={`complaint-${c.id}`} className="flex scroll-mt-4 gap-3 border-b py-4 last:border-b-0">
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
        {closed ? (
          open ? (
            <div className="bg-muted/40 space-y-1 rounded-xl border p-3">
              <p className="text-sm font-semibold">Complaint (closed)</p>
              <ComplaintBody complaint={c} onCollapse={() => setOpen(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
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
          )
        ) : (
          <div className="border-warning/30 bg-warning-soft/20 space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Complaint</p>
              <StatusBadge kind="complaint" value={c.status} />
              <ReopenedChip count={c.reopenCount} />
              <span className="text-muted-foreground text-sm">
                {c.customer.name}
                {c.raisedBy && c.raisedBy.id !== c.customer.id
                  ? ` · raised by ${c.raisedBy.name}`
                  : ''}
              </span>
            </div>
            <p className="whitespace-pre-line">{c.description}</p>
            <div className="max-w-md">
              <PhotoGrid images={c.images} />
            </div>
            <p className="text-muted-foreground text-xs">
              {c.assignedTo ? `Assigned to ${c.assignedTo.name}` : 'Not assigned yet'} · raised{' '}
              {formatDate(c.createdAt)}
            </p>
            {updateCount === 0 ? (
              <>
                <ComplaintActions complaint={c} />
                <ReplyBox complaint={c} />
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpen((o) => !o)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
                >
                  {updateCount} {updateCount === 1 ? 'update' : 'updates'}
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', open && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {open && <ComplaintThread complaint={c} />}
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
