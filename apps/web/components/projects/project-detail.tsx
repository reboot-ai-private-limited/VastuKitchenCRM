'use client';

import { DESIGN_STAGES, type DesignStage, type ProjectDto } from '@vastu/contracts';
import { ArrowLeft, CheckCircle2, MapPin, Pencil, RotateCcw, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/client';
import { useChangeDesignStage, useChangeStage, useJourney, useProject } from '@/lib/api/projects';
import { useAuth } from '@/lib/auth';
import { formatDate, formatINR, initials, relativeAge } from '@/lib/format';
import { describeActivity } from '@/lib/lead-activity';
import { DESIGN_STAGE_LABEL, projectPermissions } from '@/lib/projects';
import { ActivityTab } from './activity-tab';
import { DesignStageChip } from './design-stage-chip';
import { Feed } from './feed';
import { CloseDialog, EditProjectDialog, InviteDialog, MembersDialog } from './project-dialogs';

type Dialog = 'edit' | 'members' | 'close' | 'invite' | null;

export function ProjectDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const q = useProject(id);
  const [tab, setTab] = useState('feed');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [finalDelivery, setFinalDelivery] = useState(false);

  if (q.isError && q.error instanceof ApiError && q.error.isNotFound) return <NotFoundView />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <PageBody>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );

  const p = q.data;
  const can = projectPermissions(user?.role, user?.id, p);
  const closed = p.stage === 'CLOSED';

  return (
    <PageBody>
      <div>
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge kind="project" value={p.stage} />
              <DesignStageChip value={p.designStage} />
              <span className="text-muted-foreground">{p.customer.name}</span>
              {p.value != null && (
                <span className="tabular font-semibold">{formatINR(p.value)}</span>
              )}
            </div>
            {p.siteAddress && (
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <MapPin className="size-3.5" aria-hidden />
                {p.siteAddress}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can.editProject && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> Edit
              </Button>
            )}
            {can.manageMembers && (
              <Button variant="outline" onClick={() => setDialog('members')}>
                <Users /> Team
              </Button>
            )}
            {can.invite && !can.isCustomer && (
              <Button variant="outline" onClick={() => setDialog('invite')}>
                <UserPlus /> Invite customer
              </Button>
            )}
            {can.isAdmin && !closed && (
              <Button onClick={() => setDialog('close')}>
                <CheckCircle2 /> Close project
              </Button>
            )}
          </div>
        </div>
      </div>

      {closed && (
        <p className="bg-neutral-soft text-neutral rounded-lg p-3 text-sm">
          Closed{p.closedAt ? ` on ${formatDate(p.closedAt)}` : ''}.{' '}
          {can.changeStage ? 'Use “Reopen” on the right to continue work.' : ''}
        </p>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        {can.summaryOnly ? (
          <Summary project={p} />
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="min-w-0">
            <TabsList>
              <TabsTrigger value="feed">Feed</TabsTrigger>
              {can.seesTeam && <TabsTrigger value="activity">Activity</TabsTrigger>}
            </TabsList>
            <TabsContent value="feed" className="mt-4">
              <Feed
                projectId={p.id}
                seesTeam={can.seesTeam}
                closed={closed}
                isCustomer={can.isCustomer}
                finalDeliveryRequested={finalDelivery}
                onFinalDeliveryDone={() => setFinalDelivery(false)}
              />
            </TabsContent>
            {can.seesTeam && (
              <TabsContent value="activity" className="mt-4">
                <div className="bg-card shadow-card overflow-hidden rounded-xl border">
                  <ActivityTab projectId={p.id} active={tab === 'activity'} />
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}
        <Rail project={p} can={can} />
      </div>

      {dialog === 'edit' && <EditProjectDialog project={p} onClose={() => setDialog(null)} />}
      {dialog === 'members' && <MembersDialog project={p} onClose={() => setDialog(null)} />}
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
    </PageBody>
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
    <aside className="bg-card shadow-card h-fit space-y-4 rounded-xl border p-4 text-sm xl:sticky xl:top-20">
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
    </aside>
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
