'use client';

import type { ComplaintDto } from '@vastu/contracts';
import { LifeBuoy, MessageCircle } from 'lucide-react';
import { StatusBadge } from '@/components/common/status-badge';
import { snippet } from '@/lib/complaints';
import { relativeAge } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReopenedChip } from './complaints-view';

/** How many things happened after it was raised: status changes and messages. */
export const updateCountOf = (c: ComplaintDto): number =>
  c.history.filter((e) => e.type !== 'RAISED').length + c.comments.length;

/**
 * Complaints that are done with are tucked away behind "Show resolved". Resolved ones still waiting
 * for this person to close or reopen them stay in view, so nothing needing action disappears.
 */
export function isActiveForMe(c: ComplaintDto): boolean {
  if (c.status === 'OPEN' || c.status === 'ASSIGNED') return true;
  return c.status === 'RESOLVED' && (c.can.close || c.can.reopen);
}

/** A complaint as a gallery card: a photo, the problem in a few words, who has it and how it stands. */
export function ComplaintTile({
  complaint: c,
  onOpen,
  showProject,
}: {
  complaint: ComplaintDto;
  onOpen: () => void;
  /** Say which project it is about (when the list spans projects). */
  showProject?: boolean;
}) {
  const photo = c.images[0];
  const updates = updateCountOf(c);
  const done = c.status === 'RESOLVED' || c.status === 'CLOSED';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open complaint: ${snippet(c.description, 60)}`}
        className={cn(
          'bg-card shadow-card hover:shadow-card-hover focus-visible:ring-ring group block w-full overflow-hidden rounded-xl border text-left transition-all outline-none hover:-translate-y-px focus-visible:ring-2',
          done && 'bg-muted/40 text-muted-foreground',
        )}
      >
        <span className="bg-muted relative block aspect-video overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.thumbUrl}
              alt=""
              loading="lazy"
              className={cn('size-full object-cover', done && 'grayscale')}
            />
          ) : (
            <span className="text-muted-foreground/60 grid size-full place-items-center">
              <LifeBuoy className="size-9" aria-hidden />
            </span>
          )}
          <span className="absolute top-2 left-2 flex items-center gap-1.5">
            <StatusBadge kind="complaint" value={c.status} />
            <ReopenedChip count={c.reopenCount} />
          </span>
          {c.images.length > 1 && (
            <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              +{c.images.length - 1}
            </span>
          )}
        </span>
        <span className="block space-y-1 px-3 py-2.5">
          {showProject && (
            <span className="text-muted-foreground block truncate text-xs">{c.projectName}</span>
          )}
          <span
            className={cn('line-clamp-2 block font-medium', !done && 'text-foreground')}
            title={c.description}
          >
            {c.description}
          </span>
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              {c.assignedTo ? c.assignedTo.name : 'Unassigned'} · {relativeAge(c.createdAt)}
            </span>
            {updates > 0 && (
              <span className="inline-flex items-center gap-1" aria-label={`${updates} updates`}>
                <MessageCircle className="size-3.5" aria-hidden />
                {updates}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
