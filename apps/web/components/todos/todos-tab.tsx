'use client';

import type { ProjectDto, TodoDto } from '@vastu/contracts';
import { ListChecks, MessageCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import {
  useCreateList,
  useCreateTodo,
  useProjectTodos,
  useTodoLists,
  useToggleTodo,
} from '@/lib/api/todos';
import { useAuth } from '@/lib/auth';
import { filterByStatus, type TodoStatusFilter } from '@/lib/todos';
import { cn } from '@/lib/utils';
import { AssigneeStack, DueBadge, TodoCheck } from './todo-bits';
import { TodoDetail } from './todo-drawer';

const FILTERS: Array<{ id: TodoStatusFilter; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];
const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);

/**
 * The project's To-dos (team only): one flat list with a quick add row. Click a to-do to open it right
 * where it is. Behind the scenes every to-do still lives in a list; the project's first list is used,
 * and one is created silently the first time. `todoId` + `onTodoChange` hold the open to-do in the URL
 * (`?tab=todos&todo=<id>`) so notifications and My to-dos can deep-link; without them it stays local.
 */
export function TodosTab({
  projectId,
  members,
  todoId,
  onTodoChange,
}: {
  projectId: string;
  closed?: boolean;
  members: ProjectDto['members'];
  todoId?: string | null;
  onTodoChange?: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<TodoStatusFilter>('open');
  const [mine, setMine] = useState(false);
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const open = todoId !== undefined ? todoId : localOpen;
  const setOpen = onTodoChange ?? setLocalOpen;

  const lists = useTodoLists(projectId);
  const todos = useProjectTodos(projectId, mine);
  const createList = useCreateList(projectId);
  const create = useCreateTodo();
  const toggle = useToggleTodo();
  const [title, setTitle] = useState('');
  const adding = createList.isPending || create.isPending;

  const all = todos.data ?? [];
  // A to-do that is open stays visible even if the filter would hide it (e.g. you just completed it).
  const shown = filterByStatus(all, status).concat(
    open && !filterByStatus(all, status).some((t) => t.id === open)
      ? all.filter((t) => t.id === open)
      : [],
  );
  const doneCount = all.filter((t) => t.completed).length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    try {
      const listId = lists.data?.[0]?.id ?? (await createList.mutateAsync('To-dos')).id;
      await create.mutateAsync({ listId, title: t });
      setTitle('');
    } catch (er) {
      fail(er, 'Couldn’t add the to-do.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <form onSubmit={add} className="flex items-center gap-2">
        <Input
          aria-label="Add a to-do"
          placeholder="Add a to-do…"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={title.trim() === '' || adding}>
          <Plus /> Add
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="bg-secondary inline-flex rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={status === f.id}
              onClick={() => setStatus(f.id)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                status === f.id
                  ? 'bg-card shadow-card'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          variant={mine ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={mine}
          onClick={() => setMine((m) => !m)}
        >
          Assigned to me
        </Button>
        {all.length > 0 && (
          <span className="text-muted-foreground tabular ml-auto text-xs">
            {doneCount} of {all.length} done
          </span>
        )}
      </div>

      {todos.isPending || lists.isPending ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : todos.isError || lists.isError ? (
        <ErrorState
          error={todos.error ?? lists.error}
          onRetry={() => {
            void todos.refetch();
            void lists.refetch();
          }}
        />
      ) : shown.length === 0 ? (
        <div className="rounded-xl border">
          <EmptyState
            icon={ListChecks}
            title={
              all.length === 0
                ? 'No to-dos yet'
                : status === 'done'
                  ? 'Nothing completed yet'
                  : mine
                    ? 'Nothing assigned to you'
                    : 'All caught up'
            }
            description={all.length === 0 ? 'Add the first one above.' : undefined}
          />
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((t) =>
            t.id === open ? (
              <li key={t.id} className="py-2">
                <div className="bg-card shadow-card rounded-xl border">
                  <TodoDetail
                    todoId={t.id}
                    initial={t}
                    projectId={projectId}
                    members={members}
                    onClose={() => setOpen(null)}
                  />
                </div>
              </li>
            ) : (
              <Row
                key={t.id}
                t={t}
                onOpen={() => setOpen(t.id)}
                onToggle={(done) =>
                  user &&
                  toggle.mutate(
                    { todo: t, done, by: { id: user.id, name: user.name } },
                    { onError: (e) => fail(e, 'Couldn’t update the to-do. It was put back.') },
                  )
                }
                disabled={!user}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function Row({
  t,
  onOpen,
  onToggle,
  disabled,
}: {
  t: TodoDto;
  onOpen: () => void;
  onToggle: (done: boolean) => void;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <TodoCheck todo={t} disabled={disabled} onToggle={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-2',
          t.completed && 'text-muted-foreground line-through',
        )}
      >
        {t.title}
      </button>
      <DueBadge todo={t} />
      <AssigneeStack people={t.assignees} />
      {t.commentCount > 0 && (
        <span
          className="text-muted-foreground inline-flex items-center gap-1 text-xs"
          aria-label={`${t.commentCount} comments`}
        >
          <MessageCircle className="size-3.5" aria-hidden />
          {t.commentCount}
        </span>
      )}
      {t.images.length > 0 && (
        <span
          className="text-muted-foreground hidden text-xs sm:inline"
          aria-label={`${t.images.length} photos`}
        >
          📷 {t.images.length}
        </span>
      )}
    </li>
  );
}
