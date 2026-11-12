'use client';

import type { PostVisibility, TimelineItemDto } from '@vastu/contracts';
import { Eye, Layers, MessageSquare, Send } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  view,
  finalDeliveryRequested,
  onFinalDeliveryDone,
}: {
  projectId: string;
  seesTeam: boolean;
  /** Which feed staff are looking at; the switch itself lives in the project's top bar. */
  view: PostVisibility;
  closed: boolean;
  isCustomer: boolean;
  /** Set by the Close dialog: open the composer ready for a final-delivery post. */
  finalDeliveryRequested: boolean;
  onFinalDeliveryDone: () => void;
}) {
  const visibility: PostVisibility = seesTeam ? view : 'CLIENT';
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

  // The feed scrolls inside its pane. It opens at the newest end; scrolling up loads older posts.
  const scroller = useRef<HTMLDivElement>(null);
  const landed = useRef(false);
  const heightBefore = useRef<number | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const toBottom = (smooth: boolean) =>
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });

  useLayoutEffect(() => {
    if (q.isPending) landed.current = false;
    else if (!landed.current) {
      landed.current = true;
      toBottom(false);
    }
  }, [q.isPending, visibility]);

  // Older posts arrive above: keep what you were reading where it was.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && heightBefore.current !== null) {
      el.scrollTop += el.scrollHeight - heightBefore.current;
      heightBefore.current = null;
    }
  }, [newestFirst.length]);

  useEffect(() => {
    if (scrollTick > 0) toBottom(true);
  }, [scrollTick, newestFirst.length]);

  const loadOlder = () => {
    const el = scroller.current;
    if (!el || !q.hasNextPage || q.isFetchingNextPage) return;
    heightBefore.current = el.scrollHeight;
    void q.fetchNextPage();
  };
  // A short first page may not reach the top of the pane: keep loading until it can scroll.
  useEffect(() => {
    const el = scroller.current;
    if (el && landed.current && el.scrollHeight <= el.clientHeight) loadOlder();
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={(e) => e.currentTarget.scrollTop < 120 && loadOlder()}
        className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-4"
      >
        <div className="mx-auto w-full max-w-170">
          {q.isPending ? (
            <div className="space-y-4 py-4" aria-hidden>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : q.isError ? (
            <div className="bg-card shadow-card my-4 rounded-xl border">
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            </div>
          ) : items.length === 0 ? (
            <div className="my-4 rounded-xl border">
              <EmptyState
                icon={MessageSquare}
                title="No posts yet"
                description={closed ? undefined : 'Share an update or a photo to get started.'}
              />
            </div>
          ) : (
            <>
              {q.isFetchingNextPage && (
                <p className="text-muted-foreground py-2 text-center text-xs">Loading older…</p>
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
        </div>
      </div>

      <div className="bg-background shrink-0 border-t">
        <div className="mx-auto w-full max-w-170">
          {closed ? (
            <p className="bg-neutral-soft text-neutral m-3 rounded-lg p-3 text-sm">
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
        </div>
      </div>
    </div>
  );
}

/** Everything | Client view: staff only. Sits in the project's top bar. */
export function FeedViewToggle({
  value,
  onChange,
}: {
  value: PostVisibility;
  onChange: (v: PostVisibility) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Feed"
      title="Team notes and activity are only visible to staff"
      className="bg-secondary inline-flex rounded-lg p-0.5 text-sm"
    >
      {(['TEAM', 'CLIENT'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
            value === v ? 'bg-card shadow-card' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'TEAM' ? <Layers className="size-3.5" /> : <Eye className="size-3.5" />}
          {v === 'TEAM' ? 'Everything' : 'Client view'}
        </button>
      ))}
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
  // The options tray opens when you start writing and closes after you post or cancel.
  const [open, setOpen] = useState(finalDelivery);
  const [text, setText] = useState('');
  // Team by default for staff; the toggle is explicit. Customers' posts are always Client.
  const [toClient, setToClient] = useState(false);
  const [asFinal, setAsFinal] = useState(finalDelivery);
  const up = useImageUploader(projectId, MAX_IMAGES_PER_POST);
  const create = useCreatePost(projectId);
  const box = useRef<HTMLTextAreaElement>(null);
  const clientVisible = isCustomer || toClient || asFinal;
  const empty = text.trim() === '' && up.images.length === 0;
  const needsPhoto = asFinal && up.images.length === 0;
  const canPost = !empty && !needsPhoto && !up.busy && !create.isPending;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  function post() {
    if (!canPost) return;
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
          setOpen(false);
          up.reset();
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

  return (
    <section aria-label="New post" className="space-y-2 px-3 py-2 sm:px-4">
      {(open || up.items.length > 0) && (
        <div className="space-y-2">
          {asFinal && (
            <p className="bg-success-soft text-success rounded-md p-2 text-xs">
              Final delivery: add at least one photo. It is always visible to the customer, and
              closing the project needs it.
            </p>
          )}
          <PhotoAttach
            button={false}
            items={up.items}
            problem={up.problem}
            max={MAX_IMAGES_PER_POST}
            onAdd={up.add}
            onRemove={up.remove}
            onRetry={up.retry}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            {isCustomer ? (
              <span />
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                <span className="text-muted-foreground text-xs">
                  {clientVisible
                    ? 'This post will be visible to the customer.'
                    : 'This post is for the team only.'}
                </span>
              </div>
            )}
            <Button variant="ghost" size="sm" disabled={create.isPending} onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <PhotoAttach
          thumbs={false}
          compact
          items={up.items}
          problem={up.problem}
          max={MAX_IMAGES_PER_POST}
          onAdd={(files) => {
            setOpen(true);
            up.add(files);
          }}
          onRemove={up.remove}
          onRetry={up.retry}
        />
        <Textarea
          ref={box}
          aria-label="Add a post"
          placeholder={isCustomer ? 'Write to the team…' : 'Add a post…'}
          rows={1}
          value={text}
          maxLength={5000}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl py-2"
          onFocus={() => setOpen(true)}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              post();
            }
          }}
        />
        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full"
          aria-label={create.isPending ? 'Posting' : 'Post'}
          disabled={!canPost}
          onClick={post}
          title={needsPhoto ? 'A final delivery needs a photo' : undefined}
        >
          <Send />
        </Button>
      </div>
    </section>
  );
}
