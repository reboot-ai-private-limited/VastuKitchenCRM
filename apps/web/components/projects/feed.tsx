'use client';

import type { PostVisibility } from '@vastu/contracts';
import { Eye, Lock, MessageSquare } from 'lucide-react';
import { useState } from 'react';
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
import { useCreatePost, usePosts } from '@/lib/api/projects';
import { MAX_IMAGES_PER_POST } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { PhotoAttach } from './photos';
import { PostCard } from './post-card';

/**
 * Client | Team switch (staff only), composer, posts newest first. A customer only ever has the Client
 * feed. New posts default to Team, so nothing reaches the customer by accident.
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
  const [tab, setTab] = useState<PostVisibility>('CLIENT');
  const visibility: PostVisibility = seesTeam ? tab : 'CLIENT';
  const q = usePosts(projectId, visibility);
  const posts = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto w-full max-w-170 space-y-4">
      {seesTeam && (
        <div
          role="tablist"
          aria-label="Feed"
          className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
        >
          {(['CLIENT', 'TEAM'] as const).map((v) => (
            <Button
              key={v}
              role="tab"
              aria-selected={tab === v}
              variant={tab === v ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTab(v)}
            >
              {v === 'CLIENT' ? <Eye /> : <Lock />} {v === 'CLIENT' ? 'Client' : 'Team'}
            </Button>
          ))}
        </div>
      )}
      {seesTeam && (
        <p
          className={cn(
            'rounded-md px-3 py-2 text-xs',
            visibility === 'CLIENT'
              ? 'bg-info-soft text-info'
              : 'bg-secondary text-muted-foreground',
          )}
        >
          {visibility === 'CLIENT'
            ? 'Visible to the customer.'
            : 'Only staff on this project can see this tab.'}
        </p>
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
          onPosted={onFinalDeliveryDone}
        />
      )}

      {q.isPending ? (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : q.isError ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            description={closed ? undefined : 'Share an update or a photo to get started.'}
          />
        </div>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard
              key={p.id}
              projectId={projectId}
              post={p}
              closed={closed}
              isCustomer={isCustomer}
            />
          ))}
          {q.hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              disabled={q.isFetchingNextPage}
              onClick={() => q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? 'Loading…' : 'Load older posts'}
            </Button>
          )}
        </>
      )}
    </div>
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
          onPosted();
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Couldn’t post. Please try again.'),
      },
    );
  }

  return (
    <section
      className={cn(
        'bg-card shadow-card space-y-3 rounded-xl border p-4',
        asFinal && 'border-success/40',
      )}
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
        <Button
          disabled={empty || needsPhoto || up.busy || create.isPending}
          onClick={post}
          title={needsPhoto ? 'A final delivery needs a photo' : undefined}
        >
          {create.isPending ? 'Posting…' : up.busy ? 'Uploading…' : 'Post'}
        </Button>
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
