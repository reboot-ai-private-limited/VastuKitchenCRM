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
  const [saving, setSaving] = useState(false);
  const approve = useApprovePost(projectId);
  const del = useDeletePost(projectId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const thread = useComments(projectId, post.id, showAll);
  const comments: CommentDto[] = showAll && thread.data ? thread.data : post.recentComments;
  const hidden = post.commentCount - comments.length;

  return (
    <article
      className={cn(
        'bg-card shadow-card rounded-xl border p-4',
        post.kind === 'FINAL_DELIVERY' && 'border-success/40',
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar className="size-9">
          <AvatarFallback>{initials(post.author.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {post.author.name}
            <span className="text-muted-foreground font-normal">
              {post.author.isCustomer
                ? ' · Customer'
                : post.author.designation
                  ? ` · ${post.author.designation}`
                  : ''}
            </span>
          </p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <time
              dateTime={post.createdAt}
              title={`${formatDate(post.createdAt)}, ${formatTime(post.createdAt)}`}
            >
              {relativeAge(post.createdAt)}
            </time>
            {post.visibility === 'TEAM' && (
              <span className="bg-secondary rounded-full px-1.5">Team only</span>
            )}
            {post.kind === 'FINAL_DELIVERY' && (
              <span className="bg-success-soft text-success rounded-full px-1.5 font-medium">
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
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </header>

      {post.text && <p className="mt-3 text-sm whitespace-pre-line">{post.text}</p>}
      {post.images.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <PhotoGrid images={post.images} />
          <Button variant="ghost" size="sm" onClick={() => setSaving(true)}>
            <FolderInput /> Save to Docs
          </Button>
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
              <BadgeCheck className="size-3.5" aria-hidden /> Approved by {post.approval.by.name} on{' '}
              {formatDate(post.approval.at)}
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

      <div className="mt-4 space-y-3 border-t pt-3">
        {post.commentCount > 0 && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <MessageCircle className="size-3.5" aria-hidden /> {post.commentCount}{' '}
            {post.commentCount === 1 ? 'comment' : 'comments'}
          </p>
        )}
        {hidden > 0 && !showAll && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setShowAll(true)}>
            Show all {post.commentCount}
          </Button>
        )}
        {showAll && thread.isPending && <p className="text-muted-foreground text-xs">Loading…</p>}
        <ul className="space-y-3">
          {comments.map((c) => (
            <Comment key={c.id} projectId={projectId} postId={post.id} c={c} />
          ))}
        </ul>
        {!closed && <CommentComposer projectId={projectId} postId={post.id} />}
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
    </article>
  );
}

function Comment({ projectId, postId, c }: { projectId: string; postId: string; c: CommentDto }) {
  const del = useDeleteComment(projectId, postId);
  return (
    <li className="flex gap-2.5">
      <Avatar className="size-7">
        <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
      </Avatar>
      <div className="bg-muted min-w-0 flex-1 rounded-lg px-3 py-2">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-xs font-semibold">
            {c.author.name}
            {c.author.isCustomer && (
              <span className="text-muted-foreground font-normal"> · Customer</span>
            )}
          </p>
          <time dateTime={c.createdAt} className="text-muted-foreground text-xs">
            {relativeAge(c.createdAt)}
          </time>
          {c.canDelete && (
            <button
              type="button"
              className="text-muted-foreground hover:text-danger ml-auto text-xs"
              disabled={del.isPending}
              onClick={() => del.mutate(c.id, { onError: (e) => fail(e, 'Couldn’t delete.') })}
            >
              Delete
            </button>
          )}
        </div>
        {c.text && <p className="mt-0.5 text-sm whitespace-pre-line">{c.text}</p>}
        {c.images.length > 0 && (
          <div className="mt-2 max-w-xs">
            <PhotoGrid images={c.images} />
          </div>
        )}
      </div>
    </li>
  );
}

function CommentComposer({ projectId, postId }: { projectId: string; postId: string }) {
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
          placeholder="Write a comment…"
          rows={1}
          value={text}
          maxLength={2000}
          className="min-h-9 flex-1"
          onChange={(e) => setText(e.target.value)}
        />
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
