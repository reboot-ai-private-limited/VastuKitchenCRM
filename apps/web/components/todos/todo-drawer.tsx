'use client';

import type { ImageDto, ProjectDto, TodoCommentDto, TodoDto } from '@vastu/contracts';
import { MAX_TODO_IMAGES } from '@vastu/contracts';
import { Check, Trash2, X } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { formatDate, initials, relativeAge } from '@/lib/format';
import { RowTime } from '@/components/projects/feed-rows';
import { cn } from '@/lib/utils';
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
    <div className="space-y-6 px-4 pb-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={todo.completed !== null}
          aria-label={todo.completed ? 'Reopen this to-do' : 'Mark this to-do done'}
          disabled={toggle.isPending || !user}
          onClick={() =>
            user &&
            toggle.mutate(
              { todo, done: !todo.completed, by: { id: user.id, name: user.name } },
              { onError: (e) => fail(e, 'Couldn’t update the to-do.') },
            )
          }
          className={cn(
            'focus-visible:ring-ring mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border-2 transition-colors outline-none focus-visible:ring-2',
            todo.completed
              ? 'border-success bg-success text-white'
              : 'border-border hover:border-primary text-transparent hover:text-primary/40',
          )}
        >
          <Check className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <Input
            id="td-title"
            aria-label="Title"
            value={title}
            maxLength={200}
            aria-invalid={title.trim() === ''}
            onChange={(e) => setTitle(e.target.value)}
            className="h-auto border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold shadow-none focus-visible:border-input"
          />
          {todo.completed && (
            <p className="text-success mt-1 px-1 text-xs">
              Done by {todo.completed.by.name} · {relativeAge(todo.completed.at)}
            </p>
          )}
        </div>
        {todo.canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete to-do"
            className="text-muted-foreground hover:text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <dl className="space-y-4 text-sm">
        <Row label="Assigned to">
          <PeopleRow
            members={members}
            chosen={assignees}
            empty="Nobody yet"
            onChange={(id, on) => pick(assignees, setAssignees, id, on)}
          />
        </Row>
        <Row label="Due on">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="td-due"
              aria-label="Due date"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-auto"
            />
            {due && (
              <Button variant="ghost" size="xs" onClick={() => setDue('')}>
                <X /> Clear
              </Button>
            )}
            <DueBadge todo={todo} />
          </div>
        </Row>
        <Row label="When done, notify">
          <PeopleRow
            members={members}
            chosen={notify}
            empty="Just the person who added it"
            onChange={(id, on) => pick(notify, setNotify, id, on)}
          />
        </Row>
        <Row label="Notes">
          <Textarea
            aria-label="Notes"
            rows={3}
            value={notes}
            maxLength={5000}
            placeholder="Add notes…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Row>
        <Row label="Photos">
          <div className="space-y-2">
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
        </Row>
        {todo.createdBy && (
          <Row label="Added by">
            <span className="text-muted-foreground">
              {todo.createdBy.name} on {formatDate(todo.createdAt)}
            </span>
          </Row>
        )}
      </dl>

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

/** One label and its value, Basecamp style: the label is small and muted above on phones, beside on wider panels. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-muted-foreground pt-1.5 text-xs font-semibold sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The chosen people as chips; a popover holds the checklist, so the panel stays short. */
function PeopleRow({
  members,
  chosen,
  empty,
  onChange,
}: {
  members: Member[];
  chosen: string[];
  empty: string;
  onChange: (id: string, on: boolean) => void;
}) {
  const people = members.filter((m) => chosen.includes(m.id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted focus-visible:ring-ring flex min-h-9 w-full flex-wrap items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-2"
        >
          {people.length === 0 ? (
            <span className="text-muted-foreground">{empty}</span>
          ) : (
            people.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1.5">
                <Avatar className="size-6">
                  <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                </Avatar>
                {m.name}
              </span>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-1 p-2">
        {members.length === 0 ? (
          <p className="text-muted-foreground p-1 text-xs">Add staff to the project team first.</p>
        ) : (
          members.map((m) => (
            <label
              key={m.id}
              className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={chosen.includes(m.id)}
                onCheckedChange={(c) => onChange(m.id, c === true)}
              />
              {m.name}
            </label>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function Discussion({ todoId, projectId }: { todoId: string; projectId: string }) {
  const q = useTodoComments(todoId);
  const { user } = useAuth();
  const [text, setText] = useState('');
  const up = useImageUploader(projectId, MAX_IMAGES_PER_COMMENT);
  const create = useCreateTodoComment(todoId);
  const del = useDeleteTodoComment(todoId);
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
    <section aria-label="Discussion" className="border-t">
      {q.isPending ? (
        <Skeleton className="mt-4 h-12 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ul>
          {q.data.map((c: TodoCommentDto) => (
            <li key={c.id} className="group flex gap-3 border-b py-4">
              <RowTime iso={c.createdAt} />
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-semibold">{c.author.name}</span>
                  <time dateTime={c.createdAt} className="text-muted-foreground text-xs sm:hidden">
                    {relativeAge(c.createdAt)}
                  </time>
                  {c.canDelete && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-danger ml-auto text-xs md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      disabled={del.isPending}
                      onClick={() =>
                        del.mutate(c.id, { onError: (e) => fail(e, 'Couldn’t delete.') })
                      }
                    >
                      Delete
                    </button>
                  )}
                </p>
                {c.text && <p className="whitespace-pre-line">{c.text}</p>}
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
      <div className="space-y-2 py-4">
        <div className="flex items-start gap-3 sm:pl-[4.75rem]">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-[10px]">{initials(user?.name ?? '?')}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea
              aria-label="Write a comment"
              placeholder="Add a comment here…"
              rows={1}
              value={text}
              maxLength={2000}
              className="min-h-9 border-dashed bg-transparent"
              onChange={(e) => setText(e.target.value)}
            />
            <PhotoAttach
              compact
              items={up.items}
              problem={up.problem}
              max={MAX_IMAGES_PER_COMMENT}
              onAdd={up.add}
              onRemove={up.remove}
              onRetry={up.retry}
            />
            {!empty && (
              <div className="flex justify-end">
                <Button size="sm" disabled={up.busy || create.isPending} onClick={send}>
                  {create.isPending ? 'Posting…' : up.busy ? 'Uploading…' : 'Comment'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
