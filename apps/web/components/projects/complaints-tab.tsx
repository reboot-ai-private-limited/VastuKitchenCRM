'use client';

import { Eye, EyeOff, LifeBuoy, Plus } from 'lucide-react';
import { useState } from 'react';
import { ComplaintPanel } from '@/components/complaints/complaint-panel';
import { ComplaintTile, isActiveForMe } from '@/components/complaints/complaint-tile';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplaints } from '@/lib/api/complaints';
import { DEFAULT_COMPLAINT_FILTERS } from '@/lib/complaints';

/** This project's complaints. The global Complaints page stays for the staff overview. */
export function ComplaintsTab({
  projectId,
  canRaise,
  onRaise,
  complaintId,
  onComplaintChange,
}: {
  projectId: string;
  canRaise: boolean;
  onRaise: () => void;
  /** The open complaint, held in the URL (`?tab=complaints&complaint=<id>`) so links can open it. */
  complaintId: string | null;
  onComplaintChange: (id: string | null) => void;
}) {
  const q = useComplaints({ ...DEFAULT_COMPLAINT_FILTERS, projectId });
  const [showResolved, setShowResolved] = useState(false);
  const items = q.data?.items;
  // A complaint opened from a link stays visible even if it would be tucked away.
  const shown = (items ?? []).filter(
    (c) => showResolved || isActiveForMe(c) || c.id === complaintId,
  );
  const tucked = (items ?? []).filter((c) => !isActiveForMe(c) && c.id !== complaintId).length;

  return (
    <section className="space-y-3" aria-label="Complaints">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Complaints</h2>
        <div className="flex items-center gap-2">
          {tucked > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={showResolved}
              onClick={() => setShowResolved((s) => !s)}
            >
              {showResolved ? <EyeOff /> : <Eye />} {showResolved ? 'Hide' : 'Show'} resolved (
              {tucked})
            </Button>
          )}
          {canRaise && (
            <Button size="sm" onClick={onRaise}>
              <Plus /> Raise complaint
            </Button>
          )}
        </div>
      </div>

      {q.isError && !items ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : shown.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={LifeBuoy}
            title={items && items.length > 0 ? 'Nothing needs attention' : 'No complaints'}
            description={
              items && items.length > 0
                ? 'Use “Show resolved” to see finished ones.'
                : 'Anything raised about this project shows up here.'
            }
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) =>
            c.id === complaintId ? (
              <li key={c.id} className="sm:col-span-2 xl:col-span-3">
                <div className="bg-card shadow-card rounded-xl border">
                  <ComplaintPanel id={c.id} onCollapse={() => onComplaintChange(null)} />
                </div>
              </li>
            ) : (
              <ComplaintTile key={c.id} complaint={c} onOpen={() => onComplaintChange(c.id)} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
