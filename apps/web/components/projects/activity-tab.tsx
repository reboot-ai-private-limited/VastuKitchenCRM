'use client';

import { Activity } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimeline } from '@/lib/api/projects';
import { formatDate, formatTime, relativeAge } from '@/lib/format';
import { describeProjectActivity } from '@/lib/project-activity';

/** Posts and team activity (to-dos, files, complaints) in one stream, team only. */
export function ActivityTab({ projectId, active }: { projectId: string; active: boolean }) {
  const q = useTimeline(projectId, active);
  if (q.isPending)
    return (
      <div className="space-y-3 p-4" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data.pages.flatMap((p) => p.items);
  if (items.length === 0) return <EmptyState icon={Activity} title="No activity yet" />;
  return (
    <div>
      <ol className="divide-y">
        {items.map((it) => {
          const key = it.kind === 'POST' ? `p${it.post.id}` : `a${it.activity.id}`;
          let line: React.ReactNode;
          if (it.kind === 'POST') {
            const snippet = it.post.text
              ? it.post.text.length > 90
                ? `${it.post.text.slice(0, 90)}…`
                : it.post.text
              : `${it.post.images.length} photo${it.post.images.length === 1 ? '' : 's'}`;
            line = (
              <>
                <span className="font-medium">{it.post.author.name}</span> posted
                {it.post.kind === 'FINAL_DELIVERY' ? ' the final delivery' : ''}{' '}
                {it.post.visibility === 'TEAM' ? '(team)' : '(client)'}:{' '}
                <span className="text-muted-foreground">{snippet}</span>
              </>
            );
          } else {
            const d = describeProjectActivity(it.activity);
            line = (
              <>
                <span className="font-medium">{d.who}</span> {d.what}
                {d.subject && (
                  <>
                    : <span className="text-muted-foreground">{d.subject}</span>
                  </>
                )}
              </>
            );
          }
          return (
            <li key={key} className="flex gap-3 px-4 py-3 text-sm">
              <span aria-hidden className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
              <p className="min-w-0 flex-1">{line}</p>
              <time
                dateTime={it.at}
                className="text-muted-foreground shrink-0 text-xs"
                title={`${formatDate(it.at)}, ${formatTime(it.at)}`}
              >
                {relativeAge(it.at)}
              </time>
            </li>
          );
        })}
      </ol>
      {q.hasNextPage && (
        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={q.isFetchingNextPage}
            onClick={() => q.fetchNextPage()}
          >
            {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
          </Button>
        </div>
      )}
    </div>
  );
}
