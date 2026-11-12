'use client';

import type { ProjectDto } from '@vastu/contracts';
import { Eye, EyeOff, FolderKanban, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectGrid } from '@/lib/api/projects';
import { useAuth } from '@/lib/auth';
import { formatINRShort, relativeAge } from '@/lib/format';
import { projectPermissions } from '@/lib/projects';
import { cn } from '@/lib/utils';
import { DesignStageChip } from './design-stage-chip';
import { NewProjectDialog } from './new-project-dialog';

/** Admin and sales choose between many projects; everyone else usually has just one. */
const CHOOSES_PROJECTS = ['ADMIN', 'SALES'];

const byNewest = (a: ProjectDto, b: ProjectDto) => b.createdAt.localeCompare(a.createdAt);

export function ProjectsView() {
  const router = useRouter();
  const { user } = useAuth();
  const can = projectPermissions(user?.role, user?.id);
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useProjectGrid(search);
  const items = q.data?.items;
  const { ongoing, closed } = useMemo(
    () => ({
      ongoing: (items ?? []).filter((p) => p.stage !== 'CLOSED').sort(byNewest),
      closed: (items ?? []).filter((p) => p.stage === 'CLOSED').sort(byNewest),
    }),
    [items],
  );

  // One project and nothing to choose: open it directly, like a chat app.
  const only = !search && items?.length === 1 ? items[0] : null;
  const skipList = !!only && !!user && !CHOOSES_PROJECTS.includes(user.role);
  useEffect(() => {
    if (skipList && only) router.replace(`/projects/${only.id}`);
  }, [skipList, only, router]);

  const nothing = !!items && ongoing.length === 0 && (!showClosed || closed.length === 0);

  return (
    <PageBody>
      <PageHeader
        title="Projects"
        description={
          items
            ? `${ongoing.length} ongoing${closed.length ? ` · ${closed.length} closed` : ''}`
            : undefined
        }
        actions={
          can.createProject && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New project
            </Button>
          )
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
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {closed.length > 0 && (
          <Button
            variant="ghost"
            aria-pressed={showClosed}
            onClick={() => setShowClosed((s) => !s)}
          >
            {showClosed ? <EyeOff /> : <Eye />} {showClosed ? 'Hide' : 'Show'} closed (
            {closed.length})
          </Button>
        )}
      </div>

      {q.isError && !items ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.isPending || skipList ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : nothing ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={FolderKanban}
            title={search ? 'No projects match your search' : 'No ongoing projects'}
            description={
              search
                ? 'Try a different name.'
                : closed.length
                  ? 'Use “Show closed” to see finished ones.'
                  : 'A project appears when a lead is won.'
            }
          />
        </div>
      ) : (
        <div className={cn('space-y-6', q.isPlaceholderData && 'opacity-60 transition-opacity')}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ongoing.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
          {showClosed && closed.length > 0 && (
            <section aria-label="Closed projects" className="space-y-3">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Closed
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {closed.map((p) => (
                  <ProjectCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      {can.createProject && <NewProjectDialog open={creating} onOpenChange={setCreating} />}
    </PageBody>
  );
}

function ProjectCard({ p }: { p: ProjectDto }) {
  const closed = p.stage === 'CLOSED';
  return (
    <Link
      href={`/projects/${p.id}`}
      aria-label={closed ? `${p.name} (closed)` : p.name}
      className={cn(
        'focus-visible:ring-ring block rounded-xl border p-4 transition-all outline-none focus-visible:ring-2',
        closed
          ? 'bg-muted/40 text-muted-foreground hover:bg-muted/60 grayscale'
          : 'bg-card shadow-card hover:shadow-card-hover hover:-translate-y-px',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className={cn('truncate font-semibold', !closed && 'text-foreground')}>{p.name}</h2>
          <p className="truncate text-xs">{p.customer.name}</p>
        </div>
        <StatusBadge kind="project" value={p.stage} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DesignStageChip value={p.designStage} />
        {p.value != null && !closed && (
          <span className="tabular text-foreground text-sm font-semibold">
            {formatINRShort(p.value)}
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-xs">
        {p.designer ? p.designer.name : 'No designer yet'} · opened {relativeAge(p.createdAt)}
      </p>
    </Link>
  );
}
