'use client';

import type { ComplaintCommentDto, ComplaintDto, ComplaintEventDto } from '@vastu/contracts';
import { LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { RowTime } from '@/components/projects/feed-rows';
import { PhotoGrid } from '@/components/projects/photos';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ApiError } from '@/lib/api/client';
import { useDeleteComplaintComment } from '@/lib/api/complaints';
import { describeComplaintEvent, snippet } from '@/lib/complaints';
import { initials, relativeAge } from '@/lib/format';
import { ComplaintActions } from './complaint-panel';
import { ReplyBox } from './complaint-thread';

export type ComplaintUpdate =
  | { type: 'event'; at: string; event: ComplaintEventDto }
  | { type: 'comment'; at: string; comment: ComplaintCommentDto };

/**
 * One thing that happened on a complaint (a reply, an assignment, the resolution…), shown in the chat
 * at the time it happened, so nothing hides inside an old card. A small quoted header says which
 * complaint it is about and jumps to it. The latest update of a complaint that is still open carries
 * the buttons this person may use and a Reply box.
 */
export function ComplaintUpdateRow({
  complaint: c,
  update,
  latest,
  showResolutionPhotos,
  onJump,
}: {
  complaint: ComplaintDto;
  update: ComplaintUpdate;
  /** The newest update of this complaint: it gets the actions and Reply. */
  latest: boolean;
  /** The resolution photos belong to the newest RESOLVED line. */
  showResolutionPhotos: boolean;
  onJump: () => void;
}) {
  const del = useDeleteComplaintComment(c.id);
  const actor =
    update.type === 'comment'
      ? update.comment.author.name
      : (update.event.actor?.name ?? update.event.assignee?.name ?? 'Someone');
  const resolved = update.type === 'event' && update.event.type === 'RESOLVED';

  return (
    <li className="flex gap-3 border-b py-4 last:border-b-0">
      <RowTime iso={update.at} />
      <Avatar className="size-9 shrink-0">
        <AvatarFallback>{initials(actor)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1.5">
        <button
          type="button"
          onClick={onJump}
          aria-label={`Go to the complaint: ${snippet(c.description, 60)}`}
          className="hover:bg-muted/70 focus-visible:ring-ring bg-muted/40 border-warning/60 flex w-full max-w-md items-center gap-2 rounded-md border-l-4 px-2.5 py-1.5 text-left text-xs outline-none focus-visible:ring-2"
        >
          <LifeBuoy className="text-warning size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">Complaint</span>
            <span className="text-muted-foreground"> · {snippet(c.description, 70)}</span>
          </span>
        </button>

        {update.type === 'comment' ? (
          <div className="group/c text-sm">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{update.comment.author.name}</span>
              {update.comment.author.isCustomer && (
                <span className="text-muted-foreground text-xs">Customer</span>
              )}
              <time dateTime={update.at} className="text-muted-foreground text-xs sm:hidden">
                {relativeAge(update.at)}
              </time>
              {update.comment.canDelete && (
                <button
                  type="button"
                  disabled={del.isPending}
                  onClick={() =>
                    del.mutate(update.comment.id, {
                      onError: (e) =>
                        toast.error(e instanceof ApiError ? e.message : 'Couldn’t delete.'),
                    })
                  }
                  className="text-muted-foreground hover:text-danger text-xs md:opacity-0 md:group-hover/c:opacity-100 md:focus-visible:opacity-100"
                >
                  Delete
                </button>
              )}
            </p>
            {update.comment.text && <p className="whitespace-pre-line">{update.comment.text}</p>}
            {update.comment.images.length > 0 && (
              <div className="mt-1.5 max-w-xs">
                <PhotoGrid images={update.comment.images} />
              </div>
            )}
          </div>
        ) : (
          <EventBody event={update.event} resolved={resolved}>
            {resolved && showResolutionPhotos && c.resolutionImages.length > 0 && (
              <div className="mt-2 max-w-sm">
                <PhotoGrid images={c.resolutionImages} />
              </div>
            )}
          </EventBody>
        )}

        {latest && c.status !== 'CLOSED' && (
          <div className="space-y-2 pt-1">
            <ComplaintActions complaint={c} />
            <ReplyBox complaint={c} />
          </div>
        )}
      </div>
    </li>
  );
}

function EventBody({
  event,
  resolved,
  children,
}: {
  event: ComplaintEventDto;
  resolved: boolean;
  children?: React.ReactNode;
}) {
  const { title, note } = describeComplaintEvent(event);
  return (
    <div
      className={
        resolved
          ? 'bg-success-soft/50 border-success/30 space-y-1 rounded-lg border p-3 text-sm'
          : 'text-sm'
      }
    >
      <p className={resolved ? 'text-success font-medium' : 'font-medium'}>{title}</p>
      {note && <p className="whitespace-pre-line">{note}</p>}
      {children}
    </div>
  );
}
