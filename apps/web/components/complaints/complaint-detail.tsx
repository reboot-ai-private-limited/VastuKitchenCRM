'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { PhotoGrid } from '@/components/projects/photos';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useComplaint } from '@/lib/api/complaints';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { AssignDialog, CloseDialog, ReopenDialog, ResolveDialog } from './complaint-actions';
import { ComplaintThread } from './complaint-thread';
import { ReopenedChip } from './complaints-view';

type Dialog = 'assign' | 'resolve' | 'reopen' | 'close' | null;

export function ComplaintDetail({ id }: { id: string }) {
  const q = useComplaint(id);
  const { user } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (q.isError && q.error instanceof ApiError && q.error.isNotFound) return <NotFoundView />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending) {
    return (
      <PageBody>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </PageBody>
    );
  }
  const c = q.data;
  const can = c.can;
  // Projects are visible to staff on them and to the customer; a technician who is only assigned may not open it.
  const projectLink = user?.role !== 'TECHNICIAN';

  return (
    <PageBody>
      <div>
        <Link
          href="/complaints"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Complaints
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {projectLink ? (
                <Link href={`/projects/${c.projectId}`} className="hover:underline">
                  {c.projectName}
                </Link>
              ) : (
                c.projectName
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge kind="complaint" value={c.status} />
              <ReopenedChip count={c.reopenCount} />
              <span className="text-muted-foreground">{c.customer.name}</span>
            </div>
          </div>
          {/* Buttons come from `can`, never from the role: the API already decided what this person may do now. */}
          <div className="flex flex-wrap items-center gap-2">
            {can.assign && (
              <Button variant="outline" onClick={() => setDialog('assign')}>
                {c.assignedTo ? 'Reassign' : 'Assign'}
              </Button>
            )}
            {can.resolve && <Button onClick={() => setDialog('resolve')}>Resolve</Button>}
            {can.reopen && (
              <Button variant="outline" onClick={() => setDialog('reopen')}>
                Not fixed? Reopen
              </Button>
            )}
            {can.close && (
              <Button
                variant={can.reopen ? 'default' : 'outline'}
                onClick={() => setDialog('close')}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <section className="bg-card shadow-card space-y-3 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">The problem</h2>
            <p className="text-sm whitespace-pre-line">{c.description}</p>
            <PhotoGrid images={c.images} />
          </section>

          {c.status !== 'OPEN' &&
            c.status !== 'ASSIGNED' &&
            (c.resolutionNote || c.resolutionImages.length > 0) && (
              <section className="bg-success-soft/50 border-success/30 space-y-3 rounded-xl border p-4">
                <h2 className="text-success text-sm font-semibold">Resolution</h2>
                {c.resolutionNote && (
                  <p className="text-sm whitespace-pre-line">{c.resolutionNote}</p>
                )}
                <PhotoGrid images={c.resolutionImages} />
              </section>
            )}

          <section className="bg-card shadow-card space-y-3 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">Conversation</h2>
            <ComplaintThread complaint={c} />
          </section>
        </div>

        <aside className="bg-card shadow-card h-fit rounded-xl border p-4 text-sm lg:sticky lg:top-20">
          <h2 className="mb-2 text-sm font-semibold">Details</h2>
          <dl className="space-y-1.5">
            <Row label="Assigned to">{c.assignedTo?.name ?? 'Unassigned'}</Row>
            <Row label="Raised by">{c.raisedBy?.name ?? '—'}</Row>
            <Row label="Raised">{formatDate(c.createdAt)}</Row>
            {c.assignedAt && <Row label="Assigned">{formatDate(c.assignedAt)}</Row>}
            {c.resolvedAt && <Row label="Resolved">{formatDate(c.resolvedAt)}</Row>}
            {c.closedAt && <Row label="Closed">{formatDate(c.closedAt)}</Row>}
          </dl>
        </aside>
      </div>

      {dialog === 'assign' && <AssignDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'resolve' && <ResolveDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'reopen' && <ReopenDialog complaint={c} onClose={() => setDialog(null)} />}
      {dialog === 'close' && <CloseDialog complaint={c} onClose={() => setDialog(null)} />}
    </PageBody>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted-foreground shrink-0">{label}</dt>
    <dd className="min-w-0 text-right">{children}</dd>
  </div>
);
