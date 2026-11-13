'use client';

import {
  DESIGN_STAGES,
  type DesignStage,
  type PostVisibility,
  type ProjectDto,
} from '@vastu/contracts';
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  UserPlus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { StatusBadge } from '@/components/common/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApiError } from '@/lib/api/client';
import { useChangeDesignStage, useChangeStage, useJourney, useProject } from '@/lib/api/projects';
import { useAuth } from '@/lib/auth';
import { formatDate, formatINR, initials, relativeAge } from '@/lib/format';
import { describeActivity } from '@/lib/lead-activity';
import { DESIGN_STAGE_LABEL, projectPermissions } from '@/lib/projects';
import { RaiseDialog } from '@/components/complaints/raise-dialog';
import { DocsTab } from '@/components/docs/docs-tab';
import { TodosTab } from '@/components/todos/todos-tab';
import { canRaiseComplaint } from '@/lib/complaints';
import { ComplaintsTab } from './complaints-tab';
import { SECTION_META, type WorkspaceSection } from './workspace-nav';
import { DesignStageChip } from './design-stage-chip';
import { Feed, FeedViewToggle } from './feed';
import { CloseDialog, EditProjectDialog, InviteDialog, MembersDialog } from './project-dialogs';

type Dialog = 'edit' | 'members' | 'close' | 'invite' | 'complaint' | null;
/** Pages that may send you into a project; the back link returns to them. */
const BACK_LINKS = [
  { href: '/complaints', label: 'Complaints' },
  { href: '/todos', label: 'My to-dos' },
];
const SECTIONS: readonly WorkspaceSection[] = ['feed', 'todos', 'complaints', 'docs'];

export function ProjectDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const q = useProject(id);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The tab and an open to-do live in the URL, so notifications and the My to-dos page can deep-link.
  const wanted = params.get('tab');
  const todoParam = params.get('todo');
  const complaintParam = params.get('complaint');
  // Opened from the Complaints or My to-dos page: the back link goes there (same-site paths only).
  const from = params.get('from');
  const back = BACK_LINKS.find((b) => from === b.href) ?? { href: '/projects', label: 'Projects' };
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const [dialog, setDialog] = useState<Dialog>(null);
  const [finalDelivery, setFinalDelivery] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [feedView, setFeedView] = useState<PostVisibility>('TEAM');

  if (q.isError && q.error instanceof ApiError && q.error.isNotFound) return <NotFoundView />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );

  const p = q.data;
  const can = projectPermissions(user?.role, user?.id, p);
  const allowed = SECTIONS.filter((t) => (t === 'todos' ? can.seesTeam : true));
  // Chat is what opens by default.
  const tab: WorkspaceSection = allowed.find((t) => t === wanted) ?? 'feed';
  const setTab = (t: string) =>
    setParams({ tab: t === 'feed' ? null : t, todo: null, complaint: null });
  const raisable = canRaiseComplaint(user?.role) && !can.summaryOnly;
  const closed = p.stage === 'CLOSED';

  const showSections = !can.summaryOnly;
  const hasMenu =
    showSections ||
    can.editProject ||
    can.manageMembers ||
    (can.invite && !can.isCustomer) ||
    (can.isAdmin && !closed);

  return (
    <div className="flex h-full flex-col">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2 sm:px-4">
          <Link
            href={back.href}
            aria-label={`Back to ${back.label}`}
            className="text-muted-foreground hover:text-foreground -ml-1 inline-flex shrink-0 items-center"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="max-w-full truncate text-base font-semibold">{p.name}</h1>
            <span className="text-muted-foreground truncate text-sm">{p.customer.name}</span>
            <StatusBadge kind="project" value={p.stage} />
            <DesignStageChip value={p.designStage} />
          </div>
          <div className="flex items-center gap-2">
            {tab === 'feed' && can.seesTeam && !can.summaryOnly && (
              <FeedViewToggle value={feedView} onChange={setFeedView} />
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Project info"
              onClick={() => setInfoOpen(true)}
            >
              <Info />
            </Button>
            {hasMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Project actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {showSections &&
                    allowed.map((s) => {
                      const meta = SECTION_META[s];
                      return (
                        <DropdownMenuItem
                          key={s}
                          onSelect={() => setTab(s)}
                          className={s === tab ? 'bg-primary-soft text-primary' : undefined}
                        >
                          <meta.icon /> {meta.label}
                        </DropdownMenuItem>
                      );
                    })}
                  {showSections &&
                    (can.editProject ||
                      can.manageMembers ||
                      (can.invite && !can.isCustomer) ||
                      (can.isAdmin && !closed)) && <DropdownMenuSeparator />}
                  {can.editProject && (
                    <DropdownMenuItem onSelect={() => setDialog('edit')}>
                      <Pencil /> Edit project
                    </DropdownMenuItem>
                  )}
                  {can.manageMembers && (
                    <DropdownMenuItem onSelect={() => setDialog('members')}>
                      <Users /> Team
                    </DropdownMenuItem>
                  )}
                  {can.invite && !can.isCustomer && (
                    <DropdownMenuItem onSelect={() => setDialog('invite')}>
                      <UserPlus /> Invite customer
                    </DropdownMenuItem>
                  )}
                  {can.isAdmin && !closed && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDialog('close')}>
                        <CheckCircle2 /> Close project
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        {can.summaryOnly ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <Summary project={p} />
          </div>
        ) : tab === 'feed' ? (
          <Feed
            projectId={p.id}
            seesTeam={can.seesTeam}
            view={feedView}
            closed={closed}
            isCustomer={can.isCustomer}
            finalDeliveryRequested={finalDelivery}
            onFinalDeliveryDone={() => setFinalDelivery(false)}
            onOpenComplaint={(id) => setParams({ tab: 'complaints', complaint: id })}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'todos' && can.seesTeam && (
              <TodosTab
                projectId={p.id}
                closed={closed}
                members={p.members}
                todoId={todoParam}
                onTodoChange={(id) => setParams({ tab: 'todos', todo: id })}
              />
            )}
            {tab === 'complaints' && (
              <ComplaintsTab
                projectId={p.id}
                canRaise={raisable && !closed}
                onRaise={() => setDialog('complaint')}
                complaintId={complaintParam}
                onComplaintChange={(id) => setParams({ tab: 'complaints', complaint: id })}
              />
            )}
            {tab === 'docs' && (
              <DocsTab
                projectId={p.id}
                closed={closed}
                isAdmin={can.isAdmin}
                isCustomer={can.isCustomer}
              />
            )}
          </div>
        )}
      </section>

      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Project info</SheetTitle>
            <SheetDescription className="sr-only">
              Stage, team and details for this project
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <Rail project={p} can={can} />
          </div>
        </SheetContent>
      </Sheet>

      {dialog === 'edit' && <EditProjectDialog project={p} onClose={() => setDialog(null)} />}
      {dialog === 'members' && <MembersDialog project={p} onClose={() => setDialog(null)} />}
      <RaiseDialog
        open={dialog === 'complaint'}
        onOpenChange={(o) => setDialog(o ? 'complaint' : null)}
        defaultProjectId={p.id}
        onRaised={(id) => setParams({ tab: 'complaints', complaint: id })}
      />
      {dialog === 'invite' && <InviteDialog project={p} onClose={() => setDialog(null)} />}
      {dialog === 'close' && (
        <CloseDialog
          project={p}
          onClose={() => setDialog(null)}
          onNeedFinalDelivery={() => {
            setTab('feed');
            setFinalDelivery(true);
          }}
        />
      )}
    </div>
  );
}

function Rail({
  project: p,
  can,
}: {
  project: ProjectDto;
  can: ReturnType<typeof projectPermissions>;
}) {
  const stage = useChangeStage(p.id);
  const design = useChangeDesignStage(p.id);
  const closed = p.stage === 'CLOSED';
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'Couldn’t change that.');
  return (
    <div className="space-y-4 text-sm">
      {(can.changeStage || can.changeDesignStage) && (
        <div className="space-y-3">
          {can.changeStage && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-semibold">Stage</p>
              {closed ? (
                <div className="flex flex-wrap gap-2">
                  {(['SITE', 'DESIGN'] as const).map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      disabled={stage.isPending}
                      onClick={() =>
                        stage.mutate(s, {
                          onSuccess: () => toast.success('Project reopened'),
                          onError,
                        })
                      }
                    >
                      <RotateCcw /> Reopen as {s === 'SITE' ? 'Site' : 'Design'}
                    </Button>
                  ))}
                </div>
              ) : (
                <Select
                  value={p.stage}
                  disabled={stage.isPending}
                  onValueChange={(v) =>
                    stage.mutate(v as 'DESIGN' | 'SITE', {
                      onSuccess: () => toast.success('Stage updated'),
                      onError,
                    })
                  }
                >
                  <SelectTrigger aria-label="Stage" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESIGN">Design</SelectItem>
                    <SelectItem value="SITE">Site</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {can.changeDesignStage && !closed && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-semibold">Design stage</p>
              <Select
                value={p.designStage}
                disabled={design.isPending}
                onValueChange={(v) =>
                  design.mutate(v as DesignStage, {
                    onSuccess: () => toast.success('Design stage updated'),
                    onError,
                  })
                }
              >
                <SelectTrigger aria-label="Design stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {DESIGN_STAGE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold">Team</p>
        {p.members.length === 0 ? (
          <p className="text-muted-foreground text-xs">No staff added yet.</p>
        ) : (
          <ul className="space-y-2">
            {p.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {m.name}
                  {p.designer?.id === m.id && (
                    <span className="text-violet ml-1 text-xs font-medium">Designer</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="space-y-1.5 border-t pt-3">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Customer</dt>
          <dd className="text-right">{p.customer.name}</dd>
        </div>
        {p.siteAddress && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Site</dt>
            <dd className="text-right">{p.siteAddress}</dd>
          </div>
        )}
        {p.value != null && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Value</dt>
            <dd className="tabular text-right font-semibold">{formatINR(p.value)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Created</dt>
          <dd>{formatDate(p.createdAt)}</dd>
        </div>
        {p.closedAt && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Closed</dt>
            <dd>{formatDate(p.closedAt)}</dd>
          </div>
        )}
      </dl>
      {p.leadId && !can.isCustomer && (
        <Link href={`/leads/${p.leadId}`} className="text-primary block text-xs underline">
          Lead journey →
        </Link>
      )}
    </div>
  );
}

/** A Sales person who owns the lead but is not on the project: facts and the lead's story, no feeds. */
function Summary({ project: p }: { project: ProjectDto }) {
  const journey = useJourney(p.id, !!p.leadId);
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Lead journey</h2>
        <p className="text-muted-foreground text-xs">Project feeds are for the project team.</p>
      </div>
      {journey.isPending ? (
        <div className="p-4">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : journey.isError ? (
        <ErrorState error={journey.error} onRetry={() => journey.refetch()} />
      ) : (
        <ol className="divide-y">
          {journey.data.map((a) => {
            const { title, detail } = describeActivity(a);
            return (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <span aria-hidden className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
                </div>
                <time dateTime={a.at} className="text-muted-foreground shrink-0 text-xs">
                  {relativeAge(a.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
