'use client';

import type { PostVisibility, TimelineItemDto } from '@vastu/contracts';
import { Eye, Layers, MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useImageUploader } from '@/hooks/use-image-uploader';
import { ApiError } from '@/lib/api/client';
import { useCreatePost, usePosts, useTimeline } from '@/lib/api/projects';
import { describeProjectActivity } from '@/lib/project-activity';
import { MAX_IMAGES_PER_POST } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';
import { ActivityRow } from './feed-rows';
import { PhotoAttach } from './photos';
import { PostCard } from './post-card';

/**
 * A calm timeline, oldest at the top and the composer at the bottom, like a chat. Staff choose between
 * "Everything" (all posts plus team activity) and "Client view" (only what the customer sees). A
 * customer only ever has the client view. New posts default to team-only, so nothing reaches the
 * customer by accident.
 */
export function Feed({
  projectId,
  seesTeam,
  closed,
  isCustomer,
  finalDeliveryRequested,
  onFinalDeliveryDone,
}: {
  projectId: string;
  seesTeam: boolean;
  closed: boolean;
  isCustomer: boolean;
  /** Set by the Close dialog: open the composer ready for a final-delivery post. */
  finalDeliveryRequested: boolean;
  onFinalDeliveryDone: () => void;
}) {
  const [tab, setTab] = useState<PostVisibility>('TEAM');
  const visibility: PostVisibility = seesTeam ? tab : 'CLIENT';
  const everything = seesTeam && visibility === 'TEAM';
  const posts = usePosts(projectId, 'CLIENT', !everything);
  const timeline = useTimeline(projectId, everything);
  const q = everything ? timeline : posts;

  // The API pages newest first; the screen reads oldest first.
  const newestFirst: TimelineItemDto[] = everything
    ? (timeline.data?.pages.flatMap((p) => p.items) ?? [])
    : (posts.data?.pages.flatMap((p) => p.items) ?? []).map((post) => ({
        kind: 'POST' as const,
        at: post.createdAt,
        post,
      }));
  const items = [...newestFirst].reverse();

  // Land on the newest end when the feed first appears and after you post.
  const bottom = useRef<HTMLDivElement>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const landed = useRef(false);
  useEffect(() => {
    if (q.isPending) landed.current = false;
    else if (!landed.current) {
      landed.current = true;
      bottom.current?.scrollIntoView({ block: 'end' });
    }
  }, [q.isPending, visibility]);
  useEffect(() => {
    if (scrollTick > 0) bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [scrollTick, newestFirst.length]);

  return (
    <div className="mx-auto w-full max-w-170 space-y-3">
      {seesTeam && (
        <div className="flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Feed"
            className="bg-secondary inline-flex rounded-lg p-0.5 text-sm"
          >
            {(['TEAM', 'CLIENT'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => setTab(v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
                  tab === v ? 'bg-card shadow-card' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'TEAM' ? <Layers className="size-3.5" /> : <Eye className="size-3.5" />}
                {v === 'TEAM' ? 'Everything' : 'Client view'}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground hidden text-xs sm:block">
            {visibility === 'CLIENT'
              ? 'Exactly what the customer sees.'
              : 'Team notes and activity are only visible to staff.'}
          </p>
        </div>
      )}

      {q.isPending ? (
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : q.isError ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description={closed ? undefined : 'Share an update or a photo to get started.'}
          />
        </div>
      ) : (
        <>
          {q.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={q.isFetchingNextPage}
              onClick={() => q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
            </Button>
          )}
          <ul>
            {items.map((it) =>
              it.kind === 'POST' ? (
                <PostCard
                  key={`p${it.post.id}`}
                  projectId={projectId}
                  post={it.post}
                  closed={closed}
                  isCustomer={isCustomer}
                />
              ) : (
                <ActivityRow key={`a${it.activity.id}`} iso={it.at}>
                  <ActivityLine activity={it.activity} />
                </ActivityRow>
              ),
            )}
          </ul>
        </>
      )}

      {closed ? (
        <p className="bg-neutral-soft text-neutral rounded-lg p-3 text-sm">
          This project is closed. It takes no new posts or comments. Reopen it to continue.
        </p>
      ) : (
        <Composer
          key={String(finalDeliveryRequested)}
          projectId={projectId}
          isCustomer={isCustomer}
          finalDelivery={finalDeliveryRequested}
          onPosted={() => {
            onFinalDeliveryDone();
            setScrollTick((t) => t + 1);
          }}
        />
      )}
      <div ref={bottom} />
    </div>
  );
}

function ActivityLine({
  activity,
}: {
  activity: Extract<TimelineItemDto, { kind: 'ACTIVITY' }>['activity'];
}) {
  const d = describeProjectActivity(activity);
  return (
    <>
      <span className="text-foreground font-medium">{d.who}</span> {d.what}
      {d.subject && <>: {d.subject}</>}
    </>
  );
}

function Composer({
  projectId,
  isCustomer,
  finalDelivery,
  onPosted,
}: {
  projectId: string;
  isCustomer: boolean;
  finalDelivery: boolean;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(finalDelivery);
  const [text, setText] = useState('');
  // Team by default for staff; the toggle is explicit. Customers' posts are always Client.
  const [toClient, setToClient] = useState(false);
  const [asFinal, setAsFinal] = useState(finalDelivery);
  const up = useImageUploader(projectId, MAX_IMAGES_PER_POST);
  const create = useCreatePost(projectId);
  const clientVisible = isCustomer || toClient || asFinal;
  const empty = text.trim() === '' && up.images.length === 0;
  const needsPhoto = asFinal && up.images.length === 0;

  function post() {
    create.mutate(
      {
        ...(text.trim() ? { text: text.trim() } : {}),
        images: up.images,
        visibility: clientVisible ? 'CLIENT' : 'TEAM',
        kind: asFinal ? 'FINAL_DELIVERY' : 'UPDATE',
      },
      {
        onSuccess: () => {
          toast.success(asFinal ? 'Final delivery posted' : 'Posted');
          setText('');
          setToClient(false);
          setAsFinal(false);
          up.reset();
          setOpen(false);
          onPosted();
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Couldn’t post. Please try again.'),
      },
    );
  }

  function cancel() {
    up.discard();
    setText('');
    setToClient(false);
    setAsFinal(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border-t px-1 py-4 text-left outline-none focus-visible:ring-2 sm:pl-[4.75rem]"
      >
        <Avatar className="size-9 shrink-0">
          <AvatarFallback>{initials(user?.name ?? '?')}</AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground">
          {isCustomer ? 'Write to the team…' : 'Add a post here…'}
        </span>
      </button>
    );
  }

  return (
    <section
      className={cn('space-y-3 border-t py-4 sm:pl-[4.75rem]', asFinal && 'border-success/40')}
      aria-label="New post"
    >
      {asFinal && (
        <p className="bg-success-soft text-success rounded-md p-2.5 text-xs">
          Final delivery: add at least one photo. It is always visible to the customer, and closing
          the project needs it.
        </p>
      )}
      <Textarea
        aria-label="Write an update"
        placeholder={isCustomer ? 'Write to the team…' : 'Share an update…'}
        autoFocus
        rows={3}
        value={text}
        maxLength={5000}
        onChange={(e) => setText(e.target.value)}
      />
      <PhotoAttach
        items={up.items}
        problem={up.problem}
        max={MAX_IMAGES_PER_POST}
        onAdd={up.add}
        onRemove={up.remove}
        onRetry={up.retry}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isCustomer ? (
          <span />
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                id="post-client"
                checked={clientVisible}
                disabled={asFinal}
                onCheckedChange={(c) => setToClient(c === true)}
              />
              <Label htmlFor="post-client">Show to customer</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="post-final"
                checked={asFinal}
                onCheckedChange={(c) => setAsFinal(c === true)}
              />
              <Label htmlFor="post-final">Final delivery</Label>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={create.isPending} onClick={cancel}>
            Cancel
          </Button>
          <Button
            disabled={empty || needsPhoto || up.busy || create.isPending}
            onClick={post}
            title={needsPhoto ? 'A final delivery needs a photo' : undefined}
          >
            {create.isPending ? 'Posting…' : up.busy ? 'Uploading…' : 'Post'}
          </Button>
        </div>
      </div>
      {!isCustomer && (
        <p className="text-muted-foreground text-xs">
          {clientVisible
            ? 'This post will be visible to the customer.'
            : 'This post is for the team only.'}
        </p>
      )}
    </section>
  );
}
