'use client';

import { ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { StatusBadge } from '@/components/common/status-badge';
import { RowTime } from '@/components/projects/feed-rows';
import { PhotoGrid } from '@/components/projects/photos';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplaint } from '@/lib/api/complaints';
import { describeComplaintEvent } from '@/lib/complaints';
import { formatDate } from '@/lib/format';
import { AssignDialog, CloseDialog, ReopenDialog, ResolveDialog } from './complaint-actions';
import { ReopenedChip } from './complaints-view';

type Dialog = 'assign' | 'resolve' | 'reopen' | 'close' | null;

/**
 * A complaint opened in place (inside a project): what was reported, who has it, the actions the
 * caller may take right now, and the history as a thread. The full page at /complaints/:id stays
 * for the staff overview.
 */
export function ComplaintPanel({ id, onCollapse }: { id: string; onCollapse: () => void }) {
  const q = useComplaint(id);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <div className="space-y-3 p-4" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  const c = q.data;
  const can = c.can;
  const resolved = c.status !== 'OPEN' && c.status !== 'ASSIGNED';

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="complaint" value={c.status} />
        <ReopenedChip count={c.reopenCount} />
        <span className="text-muted-foreground text-sm">{c.customer.name}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Collapse"
          className="text-muted-foreground ml-auto"
          onClick={onCollapse}
        >
          <ChevronUp />
        </Button>
      </div>

      {/* Buttons come from `can`, never from the role: the API already decided what this person may do now. */}
      {(can.assign || can.resolve || can.reopen || can.close) && (
        <div className="flex flex-wrap items-center gap-2">
          {can.assign && (
            <Button variant="outline" size="sm" onClick={() => setDialog('assign')}>
              {c.assignedTo ? 'Reassign' : 'Assign'}
            </Button>
          )}
          {can.resolve && (
            <Button size="sm" onClick={() => setDialog('resolve')}>
              Resolve
            </Button>
          )}
          {can.reopen && (
            <Button variant="outline" size="sm" onClick={() => setDialog('reopen')}>
              Not fixed? Reopen
            </Button>
          )}
          {can.close && (
            <Button
              variant={can.reopen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDialog('close')}
            >
              Close
            </Button>
          )}
        </div>
      )}

      <dl className="space-y-3 text-sm">
        <Row label="The problem">
          <div className="space-y-2">
            <p className="whitespace-pre-line">{c.description}</p>
            <PhotoGrid images={c.images} />
          </div>
        </Row>
        <Row label="Assigned to">{c.assignedTo?.name ?? 'Unassigned'}</Row>
        {resolved && (c.resolutionNote || c.resolutionImages.length > 0) && (
          <Row label="Resolution">
            <div className="space-y-2">
              {c.resolutionNote && <p className="whitespace-pre-line">{c.resolutionNote}</p>}
              <PhotoGrid images={c.resolutionImages} />
            </div>
          </Row>
        )}
        <Row label="Raised by">
          <span className="text-muted-foreground">
            {c.raisedBy?.name ?? '—'} on {formatDate(c.createdAt)}
          </span>
        </Row>
      </dl>

      <section aria-label="History" className="border-t">
        <ol>
          {c.history.map((e, i) => {
            const { title, note } = describeComplaintEvent(e);
            return (
              <li
                key={`${e.type}-${e.at}-${i}`}
                className="flex gap-3 border-b py-3 last:border-b-0"
              >
                <RowTime iso={e.at} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{title}</p>
                  {note && <p className="text-muted-foreground whitespace-pre-line">{note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {dialog === 'assign' && <AssignDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'resolve' && <ResolveDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'reopen' && <ReopenDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'close' && <CloseDialog complaint={c} onClose={() => setDialog(null)} />}
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
    <dt className="text-muted-foreground text-xs font-semibold sm:text-sm">{label}</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);
