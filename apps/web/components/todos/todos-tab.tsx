'use client';

import type { ProjectDto, TodoDto, TodoListDto } from '@vastu/contracts';
import { Archive, ListChecks, MessageCircle, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import {
  useCreateList,
  useCreateTodo,
  useProjectTodos,
  useTodoLists,
  useToggleTodo,
  useUpdateList,
} from '@/lib/api/todos';
import { useAuth } from '@/lib/auth';
import { groupByList, progressLabel, progressPercent, type TodoStatusFilter } from '@/lib/todos';
import { cn } from '@/lib/utils';
import { AssigneeStack, DueBadge, TodoCheck } from './todo-bits';
import { TodoDrawer } from './todo-drawer';

const FILTERS: Array<{ id: TodoStatusFilter; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];
const fail = (e: unknown, fallback: string) =>
  toast.error(e instanceof ApiError ? e.message : fallback);

/**
 * The project's To-dos tab (team only). Optional `todoId` + `onTodoChange` make the open drawer
 * controllable from the URL (`?tab=todos&todo=<id>`); without them the tab keeps it in local state.
 * `closed` is accepted for symmetry with the feed but unused: the API still accepts to-do changes on a closed project.
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
  const [status, setStatus] = useState<TodoStatusFilter>('open');
  const [mine, setMine] = useState(false);
  const [localOpen, setLocalOpen] = useState<string | null>(null);
  const open = todoId !== undefined ? todoId : localOpen;
  const setOpen = onTodoChange ?? setLocalOpen;

  const lists = useTodoLists(projectId);
  const todos = useProjectTodos(projectId, mine);
  const createList = useCreateList(projectId);
  const [newList, setNewList] = useState('');

  const groups = lists.data && todos.data ? groupByList(lists.data, todos.data, status) : [];
  const opened = todos.data?.find((t) => t.id === open);

  function addList(e: React.FormEvent) {
    e.preventDefault();
    const name = newList.trim();
    if (!name) return;
    createList.mutate(name, {
      onSuccess: () => setNewList(''),
      onError: (er) => fail(er, 'Couldn’t add the list.'),
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Show"
          className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
        >
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              variant={status === f.id ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={status === f.id}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button
          variant={mine ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={mine}
          onClick={() => setMine((m) => !m)}
        >
          Assigned to me
        </Button>
        <form onSubmit={addList} className="ml-auto flex items-center gap-2">
          <Input
            aria-label="New list name"
            placeholder="New list…"
            className="w-40"
            value={newList}
            maxLength={120}
            onChange={(e) => setNewList(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={newList.trim() === '' || createList.isPending}
          >
            <Plus /> Add list
          </Button>
        </form>
      </div>

      {lists.isPending || todos.isPending ? (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : lists.isError || todos.isError ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState
            error={lists.error ?? todos.error}
            onRetry={() => {
              void lists.refetch();
              void todos.refetch();
            }}
          />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={ListChecks}
            title="No to-do lists yet"
            description="Add a list such as “Procurement” or “Site work”, then add to-dos to it."
          />
        </div>
      ) : (
        groups.map(({ list, todos: items }) => (
          <ListCard
            key={list.id}
            list={list}
            items={items}
            status={status}
            filtered={mine}
            onOpen={setOpen}
          />
        ))
      )}

      <TodoDrawer
        todoId={open}
        initial={opened}
        projectId={projectId}
        members={members}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function ListCard({
  list,
  items,
  status,
  filtered,
  onOpen,
}: {
  list: TodoListDto;
  items: TodoDto[];
  status: TodoStatusFilter;
  filtered: boolean;
  onOpen: (id: string) => void;
}) {
  const { user } = useAuth();
  const toggle = useToggleTodo();
  const create = useCreateTodo();
  const update = useUpdateList();
  const [title, setTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    create.mutate(
      { listId: list.id, title: t },
      { onSuccess: () => setTitle(''), onError: (er) => fail(er, 'Couldn’t add the to-do.') },
    );
  }
  function rename(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n === list.name) return setRenaming(false);
    update.mutate(
      { id: list.id, name: n },
      {
        onSuccess: () => setRenaming(false),
        onError: (er) => fail(er, 'Couldn’t rename the list.'),
      },
    );
  }

  return (
    <section
      className="bg-card shadow-card overflow-hidden rounded-xl border"
      aria-label={list.name}
    >
      <header className="space-y-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          {renaming ? (
            <form onSubmit={rename} className="flex flex-1 items-center gap-2">
              <Input
                aria-label="List name"
                autoFocus
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={update.isPending}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setName(list.name);
                  setRenaming(false);
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <>
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{list.name}</h2>
              <span className="text-muted-foreground tabular text-xs">{progressLabel(list)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Options for ${list.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenaming(true)}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      update.mutate(
                        { id: list.id, archived: true },
                        {
                          onSuccess: () => toast.success(`${list.name} archived`),
                          onError: (er) => fail(er, 'Couldn’t archive.'),
                        },
                      )
                    }
                  >
                    <Archive /> Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
        <Progress value={progressPercent(list)} aria-label={`${list.name} progress`} />
      </header>

      {items.length === 0 ? (
        <p className="text-muted-foreground px-4 py-4 text-center text-xs">
          {status === 'done'
            ? 'Nothing completed here yet.'
            : filtered
              ? 'Nothing assigned to you in this list.'
              : 'No open to-dos.'}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
              <TodoCheck
                todo={t}
                disabled={!user}
                onToggle={(done) =>
                  user &&
                  toggle.mutate(
                    { todo: t, done, by: { id: user.id, name: user.name } },
                    { onError: (e) => fail(e, 'Couldn’t update the to-do. It was put back.') },
                  )
                }
              />
              <button
                type="button"
                onClick={() => onOpen(t.id)}
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
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex items-center gap-2 border-t px-4 py-2.5">
        <Input
          aria-label={`Add a to-do to ${list.name}`}
          placeholder="Add a to-do…"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={title.trim() === '' || create.isPending}
        >
          <Plus /> Add
        </Button>
      </form>
    </section>
  );
}
