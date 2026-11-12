'use client';

import type { ComplaintDto } from '@vastu/contracts';
import { ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { StatusBadge } from '@/components/common/status-badge';
import { PhotoGrid } from '@/components/projects/photos';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplaint } from '@/lib/api/complaints';
import { formatDate } from '@/lib/format';
import { AssignDialog, CloseDialog, ReopenDialog, ResolveDialog } from './complaint-actions';
import { ComplaintThread } from './complaint-thread';
import { ReopenedChip } from './complaints-view';

type Dialog = 'assign' | 'resolve' | 'reopen' | 'close' | null;

/**
 * The inside of a complaint: what was reported, who has it, the actions the caller may take right
 * now, and the conversation. Shown in the chat card and inline in the project's Complaints tab.
 * Pass `onCollapse` to get a collapse button.
 */
export function ComplaintBody({
  complaint: c,
  onCollapse,
}: {
  complaint: ComplaintDto;
  onCollapse?: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const can = c.can;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="complaint" value={c.status} />
        <ReopenedChip count={c.reopenCount} />
        <span className="text-muted-foreground text-sm">
          {c.customer.name}
          {c.raisedBy && c.raisedBy.id !== c.customer.id ? ` · raised by ${c.raisedBy.name}` : ''}
        </span>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse"
            className="text-muted-foreground ml-auto"
            onClick={onCollapse}
          >
            <ChevronUp />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="whitespace-pre-line">{c.description}</p>
        <div className="max-w-md">
          <PhotoGrid images={c.images} />
        </div>
        <p className="text-muted-foreground text-xs">
          {c.assignedTo ? `Assigned to ${c.assignedTo.name}` : 'Not assigned yet'} · raised{' '}
          {formatDate(c.createdAt)}
        </p>
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

      <ComplaintThread complaint={c} />

      {dialog === 'assign' && <AssignDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'resolve' && <ResolveDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'reopen' && <ReopenDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'close' && <CloseDialog complaint={c} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** A complaint loaded by id and opened in place (the project's Complaints tab). */
export function ComplaintPanel({ id, onCollapse }: { id: string; onCollapse: () => void }) {
  const q = useComplaint(id);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <div className="space-y-3 p-4" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  return (
    <div className="p-4">
      <ComplaintBody complaint={q.data} onCollapse={onCollapse} />
    </div>
  );
}
