'use client';

import { LifeBuoy, Plus } from 'lucide-react';
import Link from 'next/link';
import { ReopenedChip } from '@/components/complaints/complaints-view';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplaints } from '@/lib/api/complaints';
import { relativeAge } from '@/lib/format';
import { DEFAULT_COMPLAINT_FILTERS, snippet } from '@/lib/complaints';

/** This project's complaints. The global Complaints page stays for the staff overview. */
export function ComplaintsTab({
  projectId,
  canRaise,
  onRaise,
}: {
  projectId: string;
  canRaise: boolean;
  onRaise: () => void;
}) {
  const q = useComplaints({ ...DEFAULT_COMPLAINT_FILTERS, projectId });
  const items = q.data?.items;

  return (
    <section className="space-y-3" aria-label="Complaints">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Complaints</h2>
        {canRaise && (
          <Button size="sm" onClick={onRaise}>
            <Plus /> Raise complaint
          </Button>
        )}
      </div>

      {q.isError && !items ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : items && items.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={LifeBuoy}
            title="No complaints"
            description="Anything raised about this project shows up here."
          />
        </div>
      ) : (
        <ul className="divide-y">
          {items?.map((c) => (
            <li key={c.id}>
              <Link
                href={`/complaints/${c.id}`}
                className="hover:bg-muted/50 focus-visible:ring-ring -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 outline-none focus-visible:ring-2"
              >
                <span className="text-muted-foreground w-16 shrink-0 pt-0.5 text-xs">
                  {relativeAge(c.createdAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{snippet(c.description, 120)}</span>
                  <span className="text-muted-foreground block text-xs">
                    {c.assignedTo ? `Assigned to ${c.assignedTo.name}` : 'Unassigned'}
                  </span>
                </span>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <StatusBadge kind="complaint" value={c.status} />
                  <ReopenedChip count={c.reopenCount} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
