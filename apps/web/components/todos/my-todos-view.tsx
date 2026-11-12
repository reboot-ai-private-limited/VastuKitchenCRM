'use client';

import type { MyTodoDto } from '@vastu/contracts';
import { ExternalLink, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useProject } from '@/lib/api/projects';
import { useMyTodos, useToggleTodo } from '@/lib/api/todos';
import { useAuth } from '@/lib/auth';
import { groupByProject } from '@/lib/todos';
import { cn } from '@/lib/utils';
import { AssigneeStack, DueBadge, TodoCheck } from './todo-bits';
import { TodoDetail } from './todo-drawer';

/** The project's to-do list, opened at this to-do, with a way back to this page. */
const inProject = (t: Pick<MyTodoDto, 'id' | 'project'>) =>
  `/projects/${t.project.id}?tab=todos&todo=${t.id}&from=/todos`;

/**
 * To-dos across projects, grouped under each project's name. Staff see what is assigned to them;
 * an Admin can switch to everyone's. A to-do opens right here with the same detail as inside the
 * project (and "Open in project" goes there, with a way back).
 */
export function MyTodosView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [everyone, setEveryone] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const scope = isAdmin && everyone ? 'all' : 'mine';
  const q = useMyTodos(showDone ? 'all' : 'open', scope);
  const toggle = useToggleTodo();
  const groups = useMemo(() => (q.data ? groupByProject(q.data) : []), [q.data]);
  const open = q.data?.filter((t) => !t.completed).length;

  return (
    <PageBody>
      <PageHeader
        title={scope === 'all' ? 'All to-dos' : 'My to-dos'}
        description={open !== undefined ? `${open} open` : undefined}
        actions={
          <>
            {isAdmin && (
              <div
                role="group"
                aria-label="Whose to-dos"
                className="bg-secondary inline-flex rounded-lg p-0.5 text-sm"
              >
                {([false, true] as const).map((all) => (
                  <button
                    key={String(all)}
                    type="button"
                    aria-pressed={everyone === all}
                    onClick={() => setEveryone(all)}
                    className={cn(
                      'rounded-md px-3 py-1 font-medium transition-colors',
                      everyone === all
                        ? 'bg-card shadow-card'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {all ? 'Everyone' : 'Mine'}
                  </button>
                ))}
              </div>
            )}
            <Button
              variant={showDone ? 'secondary' : 'outline'}
              aria-pressed={showDone}
              onClick={() => setShowDone((s) => !s)}
            >
              Show completed
            </Button>
          </>
        }
      />
      {q.isPending ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={ListChecks}
            title={scope === 'all' ? 'No to-dos yet.' : 'Nothing assigned to you.'}
            description={
              scope === 'all'
                ? 'To-dos added on any project show up here.'
                : 'When someone assigns you a to-do, it shows up here.'
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section
              key={g.project.id}
              aria-label={g.project.name}
              className="bg-card shadow-card overflow-hidden rounded-xl border"
            >
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {g.project.name}{' '}
                  <span className="text-muted-foreground tabular font-normal">
                    · {g.todos.length}
                  </span>
                  {g.overdue > 0 && (
                    <span className="text-danger ml-2 text-xs font-medium">
                      {g.overdue} overdue
                    </span>
                  )}
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/projects/${g.project.id}?tab=todos&from=/todos`}>
                    <ExternalLink /> Open project
                  </Link>
                </Button>
              </div>
              <ul className="divide-y">
                {g.todos.map((t) =>
                  t.id === openId ? (
                    <li key={t.id}>
                      <OpenTodo todo={t} onClose={() => setOpenId(null)} />
                    </li>
                  ) : (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <TodoCheck
                        todo={t}
                        disabled={!user}
                        onToggle={(done) =>
                          user &&
                          toggle.mutate(
                            { todo: t, done, by: { id: user.id, name: user.name } },
                            {
                              onError: (e) =>
                                toast.error(
                                  e instanceof ApiError
                                    ? e.message
                                    : 'Couldn’t update the to-do. It was put back.',
                                ),
                            },
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setOpenId(t.id)}
                        className={cn(
                          'focus-visible:ring-ring min-w-0 flex-1 truncate rounded-sm text-left outline-none hover:underline focus-visible:ring-2',
                          t.completed && 'text-muted-foreground line-through',
                        )}
                      >
                        {t.title}
                      </button>
                      <DueBadge todo={t} />
                      <AssigneeStack people={t.assignees} />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageBody>
  );
}

/** A to-do opened in place: loads its project's team (for the people pickers), then shows the same detail as the project. */
function OpenTodo({ todo, onClose }: { todo: MyTodoDto; onClose: () => void }) {
  const project = useProject(todo.project.id);
  return (
    <div className="bg-muted/20 border-y">
      <div className="flex justify-end px-4 pt-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={inProject(todo)}>
            <ExternalLink /> Open in project
          </Link>
        </Button>
      </div>
      {project.isPending ? (
        <div className="space-y-3 p-4" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : project.isError ? (
        <ErrorState error={project.error} onRetry={() => project.refetch()} />
      ) : (
        <TodoDetail
          todoId={todo.id}
          initial={todo}
          projectId={todo.project.id}
          members={project.data.members}
          onClose={onClose}
        />
      )}
    </div>
  );
}
