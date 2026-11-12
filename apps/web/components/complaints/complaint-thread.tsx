'use client';

import type { ComplaintCommentDto, ComplaintDto, ComplaintEventDto } from '@vastu/contracts';
import { MAX_IMAGES_PER_COMMENT } from '@vastu/contracts';
import { MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PhotoAttach, PhotoGrid } from '@/components/projects/photos';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useImageUploader } from '@/hooks/use-image-uploader';
import { ApiError } from '@/lib/api/client';
import { useAddComplaintComment, useDeleteComplaintComment } from '@/lib/api/complaints';
import { describeComplaintEvent } from '@/lib/complaints';
import { formatDate, formatTime, initials, relativeAge } from '@/lib/format';

const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);

type Entry =
  | { kind: 'event'; at: string; event: ComplaintEventDto }
  | { kind: 'comment'; at: string; comment: ComplaintCommentDto };

/**
 * What happened after it was raised, in order: status changes as small lines (the resolution with its
 * note and photos stands out) and the messages people wrote, then a quiet Reply box. Used inside the
 * chat card and inside the Complaints tab.
 */
export function ComplaintThread({ complaint: c }: { complaint: ComplaintDto }) {
  const del = useDeleteComplaintComment(c.id);
  const entries: Entry[] = [
    ...c.history
      .filter((e) => e.type !== 'RAISED')
      .map((event): Entry => ({ kind: 'event', at: event.at, event })),
    ...c.comments.map((comment): Entry => ({ kind: 'comment', at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  // The photos that came with the resolution belong to the last RESOLVED line.
  const lastResolved = [...entries]
    .reverse()
    .find((e) => e.kind === 'event' && e.event.type === 'RESOLVED');

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <ul className="space-y-2.5">
          {entries.map((e, i) =>
            e.kind === 'event' ? (
              <EventLine
                key={`e${i}`}
                event={e.event}
                images={e === lastResolved ? c.resolutionImages : []}
              />
            ) : (
              <CommentRow
                key={e.comment.id}
                comment={e.comment}
                deleting={del.isPending}
                onDelete={() =>
                  del.mutate(e.comment.id, { onError: (er) => fail(er, 'Couldn’t delete.') })
                }
              />
            ),
          )}
        </ul>
      )}
      {c.status !== 'CLOSED' && <Reply complaint={c} />}
    </div>
  );
}

function EventLine({
  event,
  images,
}: {
  event: ComplaintEventDto;
  images: ComplaintDto['resolutionImages'];
}) {
  const { title, note } = describeComplaintEvent(event);
  const resolved = event.type === 'RESOLVED';
  return (
    <li
      className={
        resolved
          ? 'bg-success-soft/50 border-success/30 space-y-1.5 rounded-lg border p-3 text-sm'
          : 'text-muted-foreground flex items-start gap-2 text-sm'
      }
    >
      {!resolved && (
        <span aria-hidden className="bg-muted-foreground/40 mt-2 size-1.5 shrink-0 rounded-full" />
      )}
      <div className="min-w-0 flex-1">
        <p className={resolved ? 'text-success font-medium' : undefined}>
          {title}{' '}
          <time
            dateTime={event.at}
            title={`${formatDate(event.at)}, ${formatTime(event.at)}`}
            className="text-muted-foreground text-xs font-normal"
          >
            · {relativeAge(event.at)}
          </time>
        </p>
        {note && <p className="text-foreground whitespace-pre-line">{note}</p>}
        {resolved && images.length > 0 && (
          <div className="mt-2 max-w-sm">
            <PhotoGrid images={images} />
          </div>
        )}
      </div>
    </li>
  );
}

function CommentRow({
  comment: m,
  onDelete,
  deleting,
}: {
  comment: ComplaintCommentDto;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="group/c flex gap-2.5">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(m.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{m.author.name}</span>
          {m.author.isCustomer && <span className="text-muted-foreground text-xs">Customer</span>}
          <time
            dateTime={m.createdAt}
            title={`${formatDate(m.createdAt)}, ${formatTime(m.createdAt)}`}
            className="text-muted-foreground text-xs"
          >
            {relativeAge(m.createdAt)}
          </time>
          {m.canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              className="text-muted-foreground hover:text-danger text-xs md:opacity-0 md:group-hover/c:opacity-100 md:focus-visible:opacity-100"
            >
              Delete
            </button>
          )}
        </p>
        {m.text && <p className="whitespace-pre-line">{m.text}</p>}
        {m.images.length > 0 && (
          <div className="mt-1.5 max-w-xs">
            <PhotoGrid images={m.images} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Hidden behind a button until you want to write, like a reply on a post. */
function Reply({ complaint }: { complaint: ComplaintDto }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const up = useImageUploader(complaint.projectId, MAX_IMAGES_PER_COMMENT);
  const add = useAddComplaintComment(complaint.id);
  const empty = text.trim() === '' && up.images.length === 0;

  if (!open)
    return (
      <button
        type="button"
        aria-label="Reply on this complaint"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
      >
        <MessageCircle className="size-3.5" aria-hidden /> Reply
      </button>
    );

  function send() {
    add.mutate(
      {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(up.images.length ? { images: up.images } : {}),
      },
      {
        onSuccess: () => {
          setText('');
          up.reset();
          setOpen(false);
        },
        onError: (e) => fail(e, 'Couldn’t send your message.'),
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Write a message"
          autoFocus
          placeholder="Add a message here…"
          rows={1}
          value={text}
          maxLength={2000}
          className="min-h-9 flex-1 border-dashed bg-transparent"
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            up.discard();
            setText('');
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="icon"
          aria-label="Send message"
          disabled={empty || up.busy || add.isPending}
          onClick={send}
        >
          <Send />
        </Button>
      </div>
      <PhotoAttach
        compact
        items={up.items}
        problem={up.problem}
        max={MAX_IMAGES_PER_COMMENT}
        onAdd={up.add}
        onRemove={up.remove}
        onRetry={up.retry}
      />
    </div>
  );
}
