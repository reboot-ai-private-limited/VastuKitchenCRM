'use client';

import { type ComplaintDto } from '@vastu/contracts';
import { Eye, EyeOff, FolderOpen, LifeBuoy, Plus } from 'lucide-react';
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
import { useComplaintsAll, useProjectOptions } from '@/lib/api/complaints';
import { useAuth } from '@/lib/auth';
import {
  canRaiseComplaint,
  complaintFiltersToSearch,
  parseComplaintFilters,
  type ComplaintFilters,
} from '@/lib/complaints';
import { cn } from '@/lib/utils';
import { ComplaintPanel } from './complaint-panel';
import { ComplaintTile, isActiveForMe } from './complaint-tile';
import { RaiseDialog } from './raise-dialog';

const ALL = '__all__';

export function ReopenedChip({ count }: { count: number }) {
  return count > 0 ? <StatusBadge kind="tone" tone="orange" label={`Reopened ×${count}`} /> : null;
}

/** Where "Open project" takes you: the project's workspace with this complaint open, and a way back here. */
export const complaintInProject = (c: Pick<ComplaintDto, 'id' | 'projectId'>): string =>
  `/projects/${c.projectId}?tab=complaints&complaint=${c.id}&from=/complaints`;

export function ComplaintsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const filters = useMemo(() => parseComplaintFilters(params), [params]);
  const [raising, setRaising] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useComplaintsAll(filters);
  const projects = useProjectOptions();
  const data = q.data;
  const filtered = filters.mine || filters.projectId !== null;
  // A technician who is only assigned may not open the project, so they get no link to it.
  const canOpenProject = user?.role !== 'TECHNICIAN';

  const go = (patch: Partial<ComplaintFilters>) =>
    router.replace(`/complaints${complaintFiltersToSearch({ ...filters, page: 1, ...patch })}`, {
      scroll: false,
    });

  const items = useMemo(() => data?.items ?? [], [data]);
  const tucked = items.filter((c) => !isActiveForMe(c) && c.id !== openId).length;
  const groups = useMemo(() => {
    const byProject = new Map<string, { id: string; name: string; items: ComplaintDto[] }>();
    for (const c of items) {
      if (!(showResolved || isActiveForMe(c) || c.id === openId)) continue;
      const g = byProject.get(c.projectId) ?? { id: c.projectId, name: c.projectName, items: [] };
      g.items.push(c);
      byProject.set(c.projectId, g);
    }
    // Projects with the most still-open complaints first; inside, newest first (the API order).
    return [...byProject.values()].sort(
      (a, b) =>
        b.items.filter(isActiveForMe).length - a.items.filter(isActiveForMe).length ||
        a.name.localeCompare(b.name),
    );
  }, [items, showResolved, openId]);

  return (
    <PageBody>
      <PageHeader
        title="Complaints"
        description={
          data
            ? `${items.filter(isActiveForMe).length} need attention${tucked ? ` · ${tucked} resolved` : ''}`
            : undefined
        }
        actions={
          canRaiseComplaint(user?.role) && (
            <Button onClick={() => setRaising(true)}>
              <Plus /> Raise complaint
            </Button>
          )
        }
      />

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
        {tucked > 0 && (
          <Button
            variant="ghost"
            className="ml-auto"
            aria-pressed={showResolved}
            onClick={() => setShowResolved((s) => !s)}
          >
            {showResolved ? <EyeOff /> : <Eye />} {showResolved ? 'Hide' : 'Show'} resolved (
            {tucked})
          </Button>
        )}
      </div>

      {q.isError && !data ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={LifeBuoy}
            title={
              filtered
                ? 'No complaints match these filters'
                : items.length > 0
                  ? 'Nothing needs attention'
                  : 'No complaints'
            }
            description={
              filtered
                ? 'Clear the filters to see more.'
                : items.length > 0
                  ? 'Use “Show resolved” to see finished ones.'
                  : 'Nothing has been raised. That is good news.'
            }
          />
        </div>
      ) : (
        <div className={cn('space-y-8', q.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {groups.map((g) => (
            <section key={g.id} aria-label={g.name} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {g.name}{' '}
                  <span className="text-muted-foreground tabular font-normal">
                    · {g.items.length}
                  </span>
                </h2>
                {canOpenProject && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${g.id}?tab=complaints&from=/complaints`}>
                      <FolderOpen /> Open project
                    </Link>
                  </Button>
                )}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((c) =>
                  c.id === openId ? (
                    <li key={c.id} className="sm:col-span-2 xl:col-span-3">
                      <div className="bg-card shadow-card rounded-xl border">
                        <ComplaintPanel
                          id={c.id}
                          onCollapse={() => setOpenId(null)}
                          {...(canOpenProject ? { projectHref: complaintInProject(c) } : {})}
                        />
                      </div>
                    </li>
                  ) : (
                    <ComplaintTile key={c.id} complaint={c} onOpen={() => setOpenId(c.id)} />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
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
