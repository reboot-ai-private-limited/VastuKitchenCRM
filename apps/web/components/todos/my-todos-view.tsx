'use client';

import { ListChecks } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useMyTodos, useToggleTodo } from '@/lib/api/todos';
import { useAuth } from '@/lib/auth';
import { groupMine } from '@/lib/todos';
import { cn } from '@/lib/utils';
import { AssigneeStack, DueBadge, TodoCheck } from './todo-bits';

/** Everything assigned to me across projects, most urgent first. A click opens the to-do inside its project. */
export function MyTodosView() {
  const router = useRouter();
  const { user } = useAuth();
  const [showDone, setShowDone] = useState(false);
  const q = useMyTodos(showDone ? 'all' : 'open');
  const toggle = useToggleTodo();
  // Re-bucketed when data arrives; "this week" vs "later" is decided on the business calendar.
  const groups = useMemo(() => (q.data ? groupMine(q.data) : []), [q.data]);

  return (
    <PageBody>
      <PageHeader
        title="My assignments"
        description={q.data ? `${q.data.filter((t) => !t.completed).length} open` : undefined}
        actions={
          <Button
            variant={showDone ? 'secondary' : 'outline'}
            aria-pressed={showDone}
            onClick={() => setShowDone((s) => !s)}
          >
            Show completed
          </Button>
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
            title="Nothing assigned to you."
            description="When someone assigns you a to-do, it shows up here."
          />
        </div>
      ) : (
        groups.map((g) => (
          <section
            key={g.name}
            aria-label={g.name}
            className="bg-card shadow-card overflow-hidden rounded-xl border"
          >
            <h2
              className={cn(
                'border-b px-4 py-2.5 text-sm font-semibold',
                g.name === 'Overdue' && 'text-danger',
              )}
            >
              {g.name}{' '}
              <span className="text-muted-foreground tabular font-normal">· {g.todos.length}</span>
            </h2>
            <ul className="divide-y">
              {g.todos.map((t) => (
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
                    onClick={() => router.push(`/projects/${t.project.id}?tab=todos&todo=${t.id}`)}
                    className="focus-visible:ring-ring min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2"
                  >
                    <span
                      className={cn(
                        'block truncate hover:underline',
                        t.completed && 'text-muted-foreground line-through',
                      )}
                    >
                      {t.title}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {t.project.name} · {t.listName}
                    </span>
                  </button>
                  <DueBadge todo={t} />
                  <AssigneeStack people={t.assignees} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </PageBody>
  );
}
