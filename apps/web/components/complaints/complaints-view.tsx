'use client';

import { COMPLAINT_STATUSES, type ComplaintDto } from '@vastu/contracts';
import { LifeBuoy, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  COMPLAINT_PAGE_SIZE,
  useComplaintCounts,
  useComplaints,
  useProjectOptions,
} from '@/lib/api/complaints';
import { useAuth } from '@/lib/auth';
import { relativeAge } from '@/lib/format';
import {
  COMPLAINT_STATUS_LABEL,
  canRaiseComplaint,
  complaintFiltersToSearch,
  parseComplaintFilters,
  snippet,
  type ComplaintFilters,
} from '@/lib/complaints';
import { cn } from '@/lib/utils';
import { RaiseDialog } from './raise-dialog';

const ALL = '__all__';

export function ReopenedChip({ count }: { count: number }) {
  return count > 0 ? <StatusBadge kind="tone" tone="orange" label={`Reopened ×${count}`} /> : null;
}

export function ComplaintsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const filters = useMemo(() => parseComplaintFilters(params), [params]);
  const [raising, setRaising] = useState(false);
  const q = useComplaints(filters);
  const counts = useComplaintCounts();
  const projects = useProjectOptions();
  const data = q.data;
  const filtered = filters.mine || filters.projectId !== null;

  const go = (patch: Partial<ComplaintFilters>) =>
    router.replace(`/complaints${complaintFiltersToSearch({ ...filters, page: 1, ...patch })}`, {
      scroll: false,
    });
  const total = counts.data
    ? COMPLAINT_STATUSES.reduce((n, s) => n + counts.data[s], 0)
    : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Complaints"
        description={
          data ? `${data.total} ${data.total === 1 ? 'complaint' : 'complaints'}` : undefined
        }
        actions={
          canRaiseComplaint(user?.role) && (
            <Button onClick={() => setRaising(true)}>
              <Plus /> Raise complaint
            </Button>
          )
        }
      />

      <div role="tablist" aria-label="Status" className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {([null, ...COMPLAINT_STATUSES] as const).map((s) => {
          const n = s === null ? total : counts.data?.[s];
          const active = filters.status === s;
          return (
            <Button
              key={s ?? 'all'}
              role="tab"
              aria-selected={active}
              variant={active ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => go({ status: s })}
            >
              {s === null ? 'All' : COMPLAINT_STATUS_LABEL[s]}
              {n !== undefined && (
                <span className="tabular bg-card text-muted-foreground ml-1 rounded-full border px-1.5 text-xs">
                  {n}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filters.mine ? 'secondary' : 'outline'}
          aria-pressed={filters.mine}
          onClick={() => go({ mine: !filters.mine })}
        >
          Assigned to me
        </Button>
        {(projects.data?.items.length ?? 0) > 1 && (
          <Select
            value={filters.projectId ?? ALL}
            onValueChange={(v) => go({ projectId: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Project" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.data!.items.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {filtered && (
          <Button variant="ghost" onClick={() => go({ mine: false, projectId: null })}>
            Clear
          </Button>
        )}
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isError && !data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={
              filters.status || filtered ? 'No complaints match these filters' : 'No complaints'
            }
            description={
              filters.status || filtered
                ? 'Try another tab or clear the filters.'
                : 'Nothing has been raised. That is good news.'
            }
          />
        ) : data ? (
          <>
            <Table className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Assigned to</TableHead>
                  <TableHead className="hidden sm:table-cell">Raised</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <ComplaintRow key={c.id} c={c} />
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
                <p className="text-muted-foreground tabular text-xs">
                  {(data.page - 1) * COMPLAINT_PAGE_SIZE + 1}–
                  {Math.min(data.page * COMPLAINT_PAGE_SIZE, data.total)} of {data.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => go({ page: data.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => go({ page: data.page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
      {canRaiseComplaint(user?.role) && (
        <RaiseDialog
          open={raising}
          onOpenChange={setRaising}
          defaultProjectId={filters.projectId}
        />
      )}
    </PageBody>
  );
}

function ComplaintRow({ c }: { c: ComplaintDto }) {
  return (
    <TableRow>
      <TableCell className="max-w-0 min-w-56 whitespace-normal">
        <Link
          href={`/complaints/${c.id}`}
          className="focus-visible:ring-ring rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
        >
          {c.projectName}
        </Link>
        <span className="text-muted-foreground block text-xs">{c.customer.name}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {snippet(c.description)}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="complaint" value={c.status} />
          <ReopenedChip count={c.reopenCount} />
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden lg:table-cell">
        {c.assignedTo?.name ?? 'Unassigned'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden sm:table-cell">
        {relativeAge(c.createdAt)}
      </TableCell>
    </TableRow>
  );
}
