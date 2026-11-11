'use client';

import type { ImageDto, ProjectDto, TodoCommentDto, TodoDto } from '@vastu/contracts';
import { MAX_TODO_IMAGES } from '@vastu/contracts';
import { CheckCircle2, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { PhotoAttach, PhotoGrid } from '@/components/projects/photos';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useImageUploader } from '@/hooks/use-image-uploader';
import { ApiError } from '@/lib/api/client';
import {
  useCreateTodoComment,
  useDeleteTodo,
  useDeleteTodoComment,
  useTodo,
  useTodoComments,
  useToggleTodo,
  useUpdateTodo,
} from '@/lib/api/todos';
import { useAuth } from '@/lib/auth';
import { formatDate, formatTime, initials, relativeAge } from '@/lib/format';
import { MAX_IMAGES_PER_COMMENT } from '@/lib/upload';
import { DueBadge } from './todo-bits';

type Member = ProjectDto['members'][number];
const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);
const asInput = (i: ImageDto) => ({
  publicId: i.publicId,
  ...(i.width ? { width: i.width } : {}),
  ...(i.height ? { height: i.height } : {}),
});

/** The to-do's side panel: edit, discuss, complete. Open by passing a `todoId`; closing clears it. */
export function TodoDrawer({
  todoId,
  projectId,
  members,
  onClose,
  initial,
}: {
  todoId: string | null;
  projectId: string;
  members: Member[];
  onClose: () => void;
  initial?: TodoDto;
}) {
  const q = useTodo(todoId);
  const todo = q.data ?? (initial && initial.id === todoId ? initial : undefined);
  return (
    <Sheet open={todoId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-6">{todo?.title ?? 'To-do'}</SheetTitle>
          <SheetDescription className="sr-only">
            Details and discussion for this to-do
          </SheetDescription>
        </SheetHeader>
        {q.isError && !todo ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !todo ? (
          <div className="space-y-3 px-4" aria-hidden>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          // Keyed by id so another to-do never inherits this one's half-typed form.
          <Body
            key={todo.id}
            todo={todo}
            projectId={projectId}
            members={members}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  todo,
  projectId,
  members,
  onClose,
}: {
  todo: TodoDto;
  projectId: string;
  members: Member[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const update = useUpdateTodo(todo.id);
  const toggle = useToggleTodo();
  const remove = useDeleteTodo();
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes ?? '');
  const [due, setDue] = useState(todo.dueOn ?? '');
  const [assignees, setAssignees] = useState<string[]>(todo.assignees.map((a) => a.id));
  const [notify, setNotify] = useState<string[]>(todo.notifyOnDone.map((a) => a.id));
  const [kept, setKept] = useState<ImageDto[]>(todo.images);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const up = useImageUploader(projectId, Math.max(0, MAX_TODO_IMAGES - kept.length));

  const saved = JSON.stringify([
    todo.title,
    todo.notes ?? '',
    todo.dueOn ?? '',
    todo.assignees.map((a) => a.id),
    todo.notifyOnDone.map((a) => a.id),
    todo.images.map((i) => i.publicId),
  ]);
  const now = JSON.stringify([title, notes, due, assignees, notify, kept.map((i) => i.publicId)]);
  const dirty = saved !== now || up.images.length > 0;
  const pick = (list: string[], set: (v: string[]) => void, id: string, on: boolean) =>
    set(on ? [...list, id] : list.filter((x) => x !== id));

  function save() {
    setError(null);
    update.mutate(
      {
        title: title.trim(),
        notes: notes.trim() || null,
        dueOn: due || null,
        assigneeIds: assignees,
        notifyOnDoneIds: notify,
        images: [...kept.map(asInput), ...up.images],
      },
      {
        onSuccess: (t) => {
          setKept(t.images);
          up.reset();
          toast.success('To-do saved');
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Couldn’t save. Please try again.'),
      },
    );
  }

  return (
    <div className="space-y-5 px-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={todo.completed ? 'outline' : 'default'}
          size="sm"
          disabled={toggle.isPending || !user}
          onClick={() =>
            user &&
            toggle.mutate(
              { todo, done: !todo.completed, by: { id: user.id, name: user.name } },
              { onError: (e) => fail(e, 'Couldn’t update the to-do.') },
            )
          }
        >
          {todo.completed ? (
            <>
              <RotateCcw /> Reopen
            </>
          ) : (
            <>
              <CheckCircle2 /> Mark done
            </>
          )}
        </Button>
        <DueBadge todo={todo} />
        {todo.completed && (
          <span className="text-success text-xs">
            Done by {todo.completed.by.name} · {relativeAge(todo.completed.at)}
          </span>
        )}
        {todo.canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger ml-auto"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="td-title">Title</Label>
        <Input
          id="td-title"
          value={title}
          maxLength={200}
          aria-invalid={title.trim() === ''}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="td-notes">Notes</Label>
        <Textarea
          id="td-notes"
          rows={4}
          value={notes}
          maxLength={5000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="td-due">Due date</Label>
          <Input id="td-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        {due && (
          <Button variant="ghost" size="sm" onClick={() => setDue('')}>
            <X /> Clear
          </Button>
        )}
      </div>

      <PeoplePicker
        legend="Assigned to"
        members={members}
        chosen={assignees}
        onChange={(id, on) => pick(assignees, setAssignees, id, on)}
        prefix="as"
      />
      <PeoplePicker
        legend="When done, also tell"
        hint="The person who created it is always told."
        members={members}
        chosen={notify}
        onChange={(id, on) => pick(notify, setNotify, id, on)}
        prefix="nt"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Photos</p>
        {kept.length > 0 && (
          <div className="space-y-2">
            <PhotoGrid images={kept} />
            <div className="flex flex-wrap gap-1.5">
              {kept.map((i, n) => (
                <Button
                  key={i.publicId}
                  variant="outline"
                  size="xs"
                  onClick={() => setKept(kept.filter((k) => k.publicId !== i.publicId))}
                >
                  <X /> Remove photo {n + 1}
                </Button>
              ))}
            </div>
          </div>
        )}
        <PhotoAttach
          items={up.items}
          problem={up.problem}
          max={Math.max(0, MAX_TODO_IMAGES - kept.length)}
          onAdd={up.add}
          onRemove={up.remove}
          onRetry={up.retry}
        />
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <span className="text-muted-foreground mr-auto text-xs" aria-live="polite">
          {update.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <Button
          disabled={!dirty || title.trim() === '' || up.busy || update.isPending}
          onClick={save}
        >
          {update.isPending ? 'Saving…' : up.busy ? 'Uploading…' : 'Save'}
        </Button>
      </div>

      <Discussion todoId={todo.id} projectId={projectId} />

      <Dialog open={confirmDelete} onOpenChange={(o) => !remove.isPending && setConfirmDelete(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this to-do?</DialogTitle>
            <DialogDescription>It is removed with its photos and discussion.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(todo.id, {
                  onSuccess: () => {
                    toast.success('To-do deleted');
                    onClose();
                  },
                  onError: (e) => {
                    setConfirmDelete(false);
                    fail(e, 'Couldn’t delete.');
                  },
                })
              }
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeoplePicker({
  legend,
  hint,
  members,
  chosen,
  onChange,
  prefix,
}: {
  legend: string;
  hint?: string;
  members: Member[];
  chosen: string[];
  onChange: (id: string, on: boolean) => void;
  prefix: string;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {members.length === 0 ? (
        <p className="text-muted-foreground text-xs">Add staff to the project team first.</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <Checkbox
                id={`${prefix}-${m.id}`}
                checked={chosen.includes(m.id)}
                onCheckedChange={(c) => onChange(m.id, c === true)}
              />
              <Label htmlFor={`${prefix}-${m.id}`} className="cursor-pointer font-normal">
                {m.name}
              </Label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function Discussion({ todoId, projectId }: { todoId: string; projectId: string }) {
  const q = useTodoComments(todoId);
  const [text, setText] = useState('');
  const up = useImageUploader(projectId, MAX_IMAGES_PER_COMMENT);
  const create = useCreateTodoComment(todoId);
  const del = useDeleteTodoComment(todoId);
  const empty = text.trim() === '' && up.images.length === 0;

  return (
    <section aria-label="Discussion" className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Discussion</h3>
      {q.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <p className="text-muted-foreground text-xs">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((c: TodoCommentDto) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar className="size-7">
                <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
              </Avatar>
              <div className="bg-muted min-w-0 flex-1 rounded-lg px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-xs font-semibold">{c.author.name}</p>
                  <time
                    dateTime={c.createdAt}
                    title={`${formatDate(c.createdAt)}, ${formatTime(c.createdAt)}`}
                    className="text-muted-foreground text-xs"
                  >
                    {relativeAge(c.createdAt)}
                  </time>
                  {c.canDelete && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-danger ml-auto text-xs"
                      disabled={del.isPending}
                      onClick={() =>
                        del.mutate(c.id, { onError: (e) => fail(e, 'Couldn’t delete.') })
                      }
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
          ))}
        </ul>
      )}
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
            onClick={() =>
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
              )
            }
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
    </section>
  );
}
