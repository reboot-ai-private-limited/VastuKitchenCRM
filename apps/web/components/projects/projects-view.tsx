'use client';

import {
  DESIGN_STAGES,
  PROJECT_STAGES,
  type DesignStage,
  type ProjectDto,
  type ProjectStage,
} from '@vastu/contracts';
import { FolderKanban, LayoutGrid, Plus, Rows3, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { PROJECT_PAGE_SIZE, useProjects, useStaffUsers } from '@/lib/api/projects';
import { useAuth } from '@/lib/auth';
import { formatINR, formatINRShort, relativeAge } from '@/lib/format';
import {
  DESIGN_STAGE_LABEL,
  STAGE_LABEL,
  projectFiltersToSearch,
  parseProjectFilters,
  projectPermissions,
  DEFAULT_PROJECT_FILTERS,
  type ProjectFilters,
} from '@/lib/projects';
import { cn } from '@/lib/utils';
import { DesignStageChip } from './design-stage-chip';
import { NewProjectDialog } from './new-project-dialog';

const ALL = '__all__';

export function ProjectsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const can = projectPermissions(user?.role, user?.id);
  const filters = useMemo(() => parseProjectFilters(params), [params]);
  const [creating, setCreating] = useState(false);

  const setFilters = useCallback(
    (patch: Partial<ProjectFilters>) =>
      router.replace(`/projects${projectFiltersToSearch({ ...filters, page: 1, ...patch })}`, {
        scroll: false,
      }),
    [filters, router],
  );

  const [draft, setDraft] = useState<{ value: string; from: string } | null>(null);
  const text = draft && draft.from === filters.search ? draft.value : filters.search;
  useEffect(() => {
    if (!draft || draft.from !== filters.search || draft.value.trim() === filters.search) return;
    const t = setTimeout(() => setFilters({ search: draft.value.trim() }), 350);
    return () => clearTimeout(t);
  }, [draft, filters.search, setFilters]);

  const q = useProjects(filters);
  const staff = useStaffUsers(can.isAdmin);
  const designers = staff.data?.items.filter((u) => u.role === 'DESIGNER') ?? [];
  const data = q.data;
  const filtered =
    JSON.stringify({ ...filters, page: 1, view: 'cards' }) !==
    JSON.stringify(DEFAULT_PROJECT_FILTERS);
  // "Design board": the projects still waiting on the customer's design approval.
  const designBoard = filters.stage === 'DESIGN';

  return (
    <PageBody>
      <PageHeader
        title="Projects"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'project' : 'projects'}${filtered ? ' match your filters' : ''}`
            : undefined
        }
        actions={
          <>
            <div
              role="group"
              aria-label="View"
              className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
            >
              {(['cards', 'table'] as const).map((v) => (
                <Button
                  key={v}
                  variant={filters.view === v ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={filters.view === v}
                  onClick={() => setFilters({ view: v, page: filters.page })}
                >
                  {v === 'cards' ? <LayoutGrid /> : <Rows3 />} {v === 'cards' ? 'Cards' : 'Table'}
                </Button>
              ))}
            </div>
            {can.createProject && (
              <Button onClick={() => setCreating(true)}>
                <Plus /> New project
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search projects"
            placeholder="Search projects"
            className="pl-8"
            value={text}
            onChange={(e) => setDraft({ value: e.target.value, from: filters.search })}
          />
        </div>
        <Select
          value={filters.stage ?? ALL}
          onValueChange={(v) => setFilters({ stage: v === ALL ? null : (v as ProjectStage) })}
        >
          <SelectTrigger aria-label="Stage" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {PROJECT_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.designStage ?? ALL}
          onValueChange={(v) => setFilters({ designStage: v === ALL ? null : (v as DesignStage) })}
        >
          <SelectTrigger aria-label="Design stage" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any design stage</SelectItem>
            {DESIGN_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {DESIGN_STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can.isAdmin && (
          <Select
            value={filters.designerId ?? ALL}
            onValueChange={(v) => setFilters({ designerId: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Designer" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any designer</SelectItem>
              {designers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={designBoard ? 'secondary' : 'outline'}
          aria-pressed={designBoard}
          onClick={() => setFilters(designBoard ? { stage: null } : { stage: 'DESIGN' })}
        >
          Design board
        </Button>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() =>
              router.replace(
                `/projects${projectFiltersToSearch({ ...DEFAULT_PROJECT_FILTERS, view: filters.view })}`,
                { scroll: false },
              )
            }
          >
            Clear
          </Button>
        )}
      </div>

      {q.isError && !data ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={FolderKanban}
            title={filtered ? 'No projects match these filters' : 'No projects yet'}
            description={
              filtered ? 'Try clearing a filter.' : 'A project appears when a lead is won.'
            }
          />
        </div>
      ) : data ? (
        <div className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {filters.view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="bg-card shadow-card overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="hidden md:table-cell">Design</TableHead>
                    <TableHead className="hidden lg:table-cell">Designer</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Value</TableHead>
                    <TableHead className="hidden xl:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link
                          href={`/projects/${p.id}`}
                          className="focus-visible:ring-ring rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                        >
                          {p.name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {p.customer.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="project" value={p.stage} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <DesignStageChip value={p.designStage} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {p.designer?.name ?? '—'}
                      </TableCell>
                      <TableCell
                        className="tabular hidden text-right sm:table-cell"
                        title={p.value != null ? formatINR(p.value) : undefined}
                      >
                        {p.value != null ? formatINRShort(p.value) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden xl:table-cell">
                        {relativeAge(p.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-muted-foreground tabular text-xs">
                {(data.page - 1) * PROJECT_PAGE_SIZE + 1}–
                {Math.min(data.page * PROJECT_PAGE_SIZE, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setFilters({ page: data.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setFilters({ page: data.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {can.createProject && <NewProjectDialog open={creating} onOpenChange={setCreating} />}
    </PageBody>
  );
}

function ProjectCard({ p }: { p: ProjectDto }) {
  return (
    <Link
      href={`/projects/${p.id}`}
      className="bg-card shadow-card hover:shadow-card-hover focus-visible:ring-ring block rounded-xl border p-4 transition-all outline-none hover:-translate-y-px focus-visible:ring-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{p.name}</h2>
          <p className="text-muted-foreground truncate text-xs">{p.customer.name}</p>
        </div>
        <StatusBadge kind="project" value={p.stage} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DesignStageChip value={p.designStage} />
        {p.value != null && (
          <span className="tabular text-sm font-semibold" title={formatINR(p.value)}>
            {formatINRShort(p.value)}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-3 truncate text-xs">
        {p.designer ? `Designer: ${p.designer.name}` : 'No designer yet'} · {p.members.length}{' '}
        {p.members.length === 1 ? 'member' : 'members'}
      </p>
    </Link>
  );
}
