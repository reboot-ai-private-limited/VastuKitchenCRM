'use client';

import type { CommentDto, PostDto } from '@vastu/contracts';
import { BadgeCheck, FolderInput, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useImageUploader } from '@/hooks/use-image-uploader';
import { ApiError } from '@/lib/api/client';
import {
  useApprovePost,
  useComments,
  useCreateComment,
  useDeleteComment,
  useDeletePost,
} from '@/lib/api/projects';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime, initials, relativeAge } from '@/lib/format';
import { MAX_IMAGES_PER_COMMENT } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { SaveToDocsDialog } from '@/components/docs/save-to-docs-dialog';
import { PhotoAttach, PhotoGrid } from './photos';

const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);

export function PostCard({
  projectId,
  post,
  closed,
  isCustomer = false,
}: {
  projectId: string;
  post: PostDto;
  closed: boolean;
  isCustomer?: boolean;
}) {
  const { user } = useAuth();
  const own = user?.id === post.author.id;
  const [saving, setSaving] = useState(false);
  const approve = useApprovePost(projectId);
  const del = useDeletePost(projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replying, setReplying] = useState(false);
  const thread = useComments(projectId, post.id, showAll);
  const comments: CommentDto[] = showAll && thread.data ? thread.data : post.recentComments;
  const hidden = post.commentCount - comments.length;

  return (
    <li className={cn('group flex gap-2 py-1', own ? 'flex-row-reverse' : 'flex-row')}>
      {!own && (
        <Avatar className="mt-1 size-8 shrink-0">
          <AvatarFallback className="text-xs">{initials(post.author.name)}</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[85%] min-w-0 rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%]',
          own ? 'bg-primary-soft rounded-tr-sm' : 'bg-card rounded-tl-sm border',
          post.kind === 'FINAL_DELIVERY' && 'ring-success/60 ring-2',
        )}
      >
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="text-primary font-semibold">{own ? 'You' : post.author.name}</span>
              <span className="text-muted-foreground text-xs">
                {post.author.isCustomer ? 'Customer' : (post.author.designation ?? '')}
              </span>
              {post.visibility === 'TEAM' && (
                <span className="bg-secondary text-muted-foreground rounded-full px-1.5 text-xs">
                  Team only
                </span>
              )}
              {post.kind === 'FINAL_DELIVERY' && (
                <span className="bg-success-soft text-success rounded-full px-1.5 text-xs font-medium">
                  Final delivery
                </span>
              )}
            </p>
          </div>
          {post.canDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete post"
              className="text-muted-foreground -mt-1 -mr-1 size-6 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 />
            </Button>
          )}
        </header>

        {post.text && <p className="mt-1 text-sm whitespace-pre-line">{post.text}</p>}
        {post.images.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <PhotoGrid images={post.images} />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
              onClick={() => setSaving(true)}
            >
              <FolderInput className="size-3.5" aria-hidden /> Save to Docs
            </button>
            {saving && (
              <SaveToDocsDialog
                projectId={projectId}
                photos={post.images.map((i) => ({ publicId: i.publicId, thumbUrl: i.thumbUrl }))}
                sourceVisibility={post.visibility}
                isCustomer={isCustomer}
                open
                onOpenChange={setSaving}
              />
            )}
          </div>
        )}

        {(post.approval || post.canApprove) && (
          <div className="mt-3">
            {post.approval ? (
              <p className="text-success bg-success-soft inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
                <BadgeCheck className="size-3.5" aria-hidden /> Approved by {post.approval.by.name}{' '}
                on {formatDate(post.approval.at)}
              </p>
            ) : (
              <Button
                size="sm"
                disabled={approve.isPending}
                onClick={() =>
                  approve.mutate(post.id, {
                    onSuccess: () => toast.success('Design approved'),
                    onError: (e) => fail(e, 'Couldn’t approve.'),
                  })
                }
              >
                <BadgeCheck /> {approve.isPending ? 'Approving…' : 'Approve this design'}
              </Button>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {hidden > 0 && !showAll && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium"
              onClick={() => setShowAll(true)}
            >
              <MessageCircle className="size-3.5" aria-hidden /> Show all {post.commentCount}{' '}
              comments
            </button>
          )}
          {showAll && thread.isPending && <p className="text-muted-foreground text-xs">Loading…</p>}
          {comments.length > 0 && (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <Comment key={c.id} projectId={projectId} postId={post.id} c={c} />
              ))}
            </ul>
          )}
          {!closed &&
            (replying ? (
              <CommentComposer
                projectId={projectId}
                postId={post.id}
                onDone={() => setReplying(false)}
              />
            ) : (
              <button
                type="button"
                aria-label={`Reply to ${post.author.name}`}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
                onClick={() => setReplying(true)}
              >
                <MessageCircle className="size-3.5" aria-hidden /> Reply
              </button>
            ))}
        </div>
        <time
          dateTime={post.createdAt}
          title={`${formatDate(post.createdAt)}, ${formatTime(post.createdAt)}`}
          className="text-muted-foreground mt-1 block text-right text-[11px]"
        >
          {formatTime(post.createdAt)}
        </time>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(o) => !del.isPending && setConfirmDelete(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              The post, its photos and its comments are removed for everyone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(post.id, {
                  onSuccess: () => {
                    setConfirmDelete(false);
                    toast.success('Post deleted');
                  },
                  onError: (e) => {
                    setConfirmDelete(false);
                    fail(e, 'Couldn’t delete.');
                  },
                })
              }
            >
              {del.isPending ? 'Deleting…' : 'Delete post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function Comment({ projectId, postId, c }: { projectId: string; postId: string; c: CommentDto }) {
  const del = useDeleteComment(projectId, postId);
  return (
    <li className="group/c flex gap-2.5">
      <Avatar className="size-6 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{c.author.name}</span>
          {c.author.isCustomer && <span className="text-muted-foreground text-xs">Customer</span>}
          <time dateTime={c.createdAt} className="text-muted-foreground text-xs">
            {relativeAge(c.createdAt)}
          </time>
          {c.canDelete && (
            <button
              type="button"
              className="text-muted-foreground hover:text-danger text-xs md:opacity-0 md:group-hover/c:opacity-100 md:focus-visible:opacity-100"
              disabled={del.isPending}
              onClick={() => del.mutate(c.id, { onError: (e) => fail(e, 'Couldn’t delete.') })}
            >
              Delete
            </button>
          )}
        </p>
        {c.text && <p className="whitespace-pre-line">{c.text}</p>}
        {c.images.length > 0 && (
          <div className="mt-1.5 max-w-xs">
            <PhotoGrid images={c.images} />
          </div>
        )}
      </div>
    </li>
  );
}

function CommentComposer({
  projectId,
  postId,
  onDone,
}: {
  projectId: string;
  postId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const up = useImageUploader(projectId, MAX_IMAGES_PER_COMMENT);
  const create = useCreateComment(projectId, postId);
  const empty = text.trim() === '' && up.images.length === 0;

  function send() {
    create.mutate(
      {
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(up.images.length ? { images: up.images } : {}),
      },
      {
        onSuccess: () => {
          setText('');
          up.reset();
          onDone();
        },
        onError: (e) => fail(e, 'Couldn’t post your comment.'),
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Write a comment"
          autoFocus
          placeholder="Add a comment here…"
          rows={1}
          value={text}
          maxLength={2000}
          className="bg-transparent min-h-9 flex-1 border-dashed"
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            up.discard();
            setText('');
            onDone();
          }}
        >
          Cancel
        </Button>
        <Button
          size="icon"
          aria-label="Send comment"
          disabled={empty || up.busy || create.isPending}
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
