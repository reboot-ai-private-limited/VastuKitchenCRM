'use client';

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  MessageCircle,
  Palette,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { TimelineThread } from '@/components/common/timeline-thread';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';
import {
  useChangeLeadStatus,
  useLead,
  useLeadCalls,
  useLeadDesigns,
  useLeadTimeline,
  useLeadVisits,
} from '@/lib/api/leads';
import { useLeadProjects } from '@/lib/api/projects';
import { useProposals } from '@/lib/api/proposals';
import { ProposalChipBadge } from '@/components/proposals/proposals-view';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDuration, formatINR, formatTime, relativeAge } from '@/lib/format';
import {
  PRODUCT_OF_INTEREST_LABEL,
  SOURCE_LABEL,
  formatPhone,
  leadPermissions,
  telUrl,
  whatsappUrl,
} from '@/lib/leads';
import { CompleteDesignDialog } from './complete-design-dialog';
import { EditLeadDialog } from './edit-lead-dialog';
import { AssignDialog, StatusDialog } from './lead-dialogs';
import { RecordVisitDialog } from './record-visit-dialog';

export function LeadDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const can = leadPermissions(user?.role);
  const lead = useLead(id);
  const changeStatus = useChangeLeadStatus();
  const projects = useLeadProjects(id, lead.data?.status === 'WON');
  const [dialog, setDialog] = useState<'status' | 'assign' | 'edit' | null>(null);
  const [tab, setTab] = useState('timeline');
  // Office has no call or visit log access; those tabs are for Admin and Sales.
  const seesLogs = user?.role === 'ADMIN' || user?.role === 'SALES';
  const proposals = seesLogs;
  const canMarkEstimateDone =
    user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'DESIGNER';

  if (lead.isError && lead.error instanceof ApiError && lead.error.isNotFound)
    return <NotFoundView />;
  if (lead.isError) return <ErrorState error={lead.error} onRetry={() => lead.refetch()} />;
  if (lead.isPending) {
    return (
      <PageBody>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </PageBody>
    );
  }
  const l = lead.data;
  const locked = l.status === 'WON';

  return (
    <PageBody>
      <div>
        <Link
          href="/leads"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Leads
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{l.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="lead" value={l.status} />
              {l.isStuck && (
                <span className="text-warning inline-flex items-center gap-1 text-xs font-medium">
                  <Clock className="size-3.5" aria-hidden /> Stuck: no movement for a while
                </span>
              )}
            </div>
            <a
              href={telUrl(l.phone)}
              className="tabular text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
            >
              <Phone className="size-3.5" aria-hidden /> {formatPhone(l.phone)}
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can.changeStatus && (
              <Button
                variant="outline"
                disabled={locked}
                title={locked ? 'Won leads are locked' : undefined}
                onClick={() => setDialog('status')}
              >
                Change status
              </Button>
            )}
            {can.edit && !locked && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> Edit
              </Button>
            )}
            {can.assign && (
              <Button variant="outline" onClick={() => setDialog('assign')}>
                Assign
              </Button>
            )}
            {can.completeDesign && !locked && (
              <Button onClick={() => setTab('design')}>
                <CheckCircle2 /> Upload design
              </Button>
            )}
            {proposals && (
              <Button asChild>
                <Link href={`/proposals/new?leadId=${l.id}`}>
                  <Plus /> Proposal
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={telUrl(l.phone)}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={whatsappUrl(l.phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>

      {l.status === 'DESIGN_ESTIMATE_SCHEDULED' && canMarkEstimateDone && (
        <div className="bg-violet-soft/60 border-violet/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
          <p className="text-sm font-medium">Estimate pending</p>
          <Button
            size="sm"
            disabled={changeStatus.isPending}
            onClick={() =>
              changeStatus.mutate(
                { id: l.id, status: 'DESIGN_ESTIMATE_DONE' },
                {
                  onSuccess: () => toast.success('Estimate marked done'),
                  onError: (er) =>
                    toast.error(er instanceof ApiError ? er.message : 'Could not update status'),
                },
              )
            }
          >
            <CheckCircle2 /> {changeStatus.isPending ? 'Updating…' : 'Mark estimate done'}
          </Button>
        </div>
      )}

      {l.status === 'DESIGN_ESTIMATE_DONE' && proposals && (
        <div className="bg-success-soft/70 border-success/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
          <p className="text-success text-sm font-medium">Ready to send proposal</p>
          <Button size="sm" asChild>
            <Link href={`/proposals/new?leadId=${l.id}`}>
              <MessageCircle /> Send WhatsApp proposal
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {proposals && <TabsTrigger value="proposals">Proposals</TabsTrigger>}
            {seesLogs && <TabsTrigger value="calls">Calls</TabsTrigger>}
            {can.viewVisits && <TabsTrigger value="visits">Visits</TabsTrigger>}
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <Panel>
              <Timeline id={id} />
            </Panel>
          </TabsContent>
          {proposals && (
            <TabsContent value="proposals">
              <Panel>
                <LeadProposals leadId={id} active={tab === 'proposals'} />
              </Panel>
            </TabsContent>
          )}
          {seesLogs && (
            <TabsContent value="calls">
              <Panel>
                <Calls id={id} active={tab === 'calls'} />
              </Panel>
            </TabsContent>
          )}
          {can.viewVisits && (
            <TabsContent value="visits">
              <Panel>
                <Visits id={id} active={tab === 'visits'} canLog={can.logVisit} />
              </Panel>
            </TabsContent>
          )}
          <TabsContent value="design">
            <Panel>
              <Designs id={id} active={tab === 'design'} canComplete={can.completeDesign} />
            </Panel>
          </TabsContent>
          <TabsContent value="details">
            <Panel>
              <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
                <Field label="Phone">{formatPhone(l.phone)}</Field>
                <Field label="Alternate phone">{l.altPhone ? formatPhone(l.altPhone) : null}</Field>
                <Field label="Email">{l.email}</Field>
                <Field label="City">{l.city}</Field>
                <Field label="Product of interest" wide>
                  {l.productsOfInterest.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5 pt-0.5">
                      {l.productsOfInterest.map((p) => (
                        <span
                          key={p}
                          className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium"
                        >
                          {PRODUCT_OF_INTEREST_LABEL[p]}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Field>
                <Field label="Notes" wide>
                  {l.notes}
                </Field>
              </dl>
            </Panel>
          </TabsContent>
        </Tabs>

        <aside className="bg-card shadow-card h-fit rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">Summary</h2>
          <dl className="space-y-3.5 text-sm">
            <Field label="Assigned to">{l.assignedTo?.name ?? 'Unassigned'}</Field>
            <Field label="Source">{SOURCE_LABEL[l.source]}</Field>
            <Field label="Status changed">{relativeAge(l.statusChangedAt)}</Field>
            <Field label="Created">{formatDate(l.createdAt)}</Field>
          </dl>
          {l.lostReason && (
            <div className="bg-danger-soft text-danger mt-4 rounded-lg p-3 text-xs">
              <p className="font-semibold">Lost because</p>
              <p className="mt-0.5">{l.lostReason}</p>
            </div>
          )}
          {locked && projects.data && projects.data.items.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-muted-foreground text-xs font-medium">Project</p>
              {projects.data.items.map((pr) => (
                <Link
                  key={pr.id}
                  href={`/projects/${pr.id}`}
                  className="text-primary block truncate text-sm font-semibold underline"
                >
                  {pr.name}
                </Link>
              ))}
            </div>
          )}
          {l.customerId && (
            <p className="text-success bg-success-soft mt-3 rounded-md p-2 text-xs">
              Customer account created. Won leads are locked.
            </p>
          )}
        </aside>
      </div>

      {dialog === 'status' && <StatusDialog lead={l} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <EditLeadDialog lead={l} onClose={() => setDialog(null)} />}
      {dialog === 'assign' && <AssignDialog lead={l} onClose={() => setDialog(null)} />}
    </PageBody>
  );
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="bg-card shadow-card mt-3 overflow-hidden rounded-xl border">{children}</div>
);

/** A label over its value; an empty value reads as a soft "Not added" instead of a bare dash. */
export const Field = ({
  label,
  children,
  wide,
}: {
  label: string;
  children?: ReactNode;
  wide?: boolean;
}) => (
  <div className={wide ? 'sm:col-span-2' : undefined}>
    <dt className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
      {label}
    </dt>
    <dd className="mt-0.5 min-w-0 break-words">
      {children ? children : <span className="text-muted-foreground/70">Not added</span>}
    </dd>
  </div>
);

export function Timeline({ id }: { id: string }) {
  const q = useLeadTimeline(id);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0) return <EmptyState icon={Clock} title="Nothing here yet" />;
  return <TimelineThread items={q.data} />;
}

function Calls({ id, active }: { id: string; active: boolean }) {
  const q = useLeadCalls(id, active);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0)
    return (
      <EmptyState
        icon={Phone}
        title="No calls logged"
        description="Calls are logged automatically by the phone app."
      />
    );
  return (
    <ul className="divide-y">
      {q.data.map((c) => (
        <li key={c.id} className="flex gap-3 px-4 py-3">
          <Phone
            className={
              c.answered
                ? 'text-success mt-0.5 size-4 shrink-0'
                : 'text-muted-foreground mt-0.5 size-4 shrink-0'
            }
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {c.answered ? `Answered, ${formatDuration(c.durationSec)}` : 'Not answered'}
            </p>
            <p className="text-muted-foreground text-xs">
              {c.user.name}
              {c.outcome ? ` · ${c.outcome.replace('_', ' ').toLowerCase()}` : ''}
              {c.note ? ` · ${c.note}` : ''}
            </p>
          </div>
          <time dateTime={c.startedAt} className="text-muted-foreground shrink-0 text-xs">
            {formatDate(c.startedAt)}, {formatTime(c.startedAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function Visits({ id, active, canLog }: { id: string; active: boolean; canLog: boolean }) {
  const q = useLeadVisits(id, active);
  const [adding, setAdding] = useState(false);

  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      {q.data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No visits logged"
          description={
            canLog
              ? 'Log a measurement or site visit with photos and videos.'
              : 'Measurement photos and videos will appear here once logged.'
          }
          action={
            canLog ? (
              <Button onClick={() => setAdding(true)}>
                <Plus /> Log visit
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-muted-foreground text-xs font-medium">
              {q.data.length} {q.data.length === 1 ? 'visit' : 'visits'}
            </span>
            {canLog && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus /> Log visit
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {q.data.map((v) => (
              <li key={v.id} className="flex gap-3 px-4 py-3">
                <MapPin className="text-violet mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{v.user.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {v.note ?? 'No note'}
                        {v.latitude != null && v.longitude != null && (
                          <>
                            {' · '}
                            <a
                              className="underline"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
                            >
                              Map
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <time dateTime={v.at} className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(v.at)}, {formatTime(v.at)}
                    </time>
                  </div>
                  {(v.media.length > 0 || v.photoUrl) && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {v.media.map((m) =>
                        m.kind === 'VIDEO' ? (
                          <video
                            key={m.publicId}
                            src={m.url}
                            poster={m.thumbUrl}
                            controls
                            preload="metadata"
                            className="bg-secondary aspect-video w-full rounded-lg border object-cover"
                          />
                        ) : (
                          <a
                            key={m.publicId}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-secondary block aspect-video overflow-hidden rounded-lg border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.thumbUrl}
                              alt="Visit photo"
                              className="size-full object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ),
                      )}
                      {v.photoUrl && (
                        <a
                          href={v.photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-secondary block aspect-video overflow-hidden rounded-lg border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.photoUrl}
                            alt="Visit photo"
                            className="size-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <RecordVisitDialog leadId={id} open={adding} onOpenChange={setAdding} />
    </>
  );
}

function Designs({
  id,
  active,
  canComplete,
}: {
  id: string;
  active: boolean;
  canComplete: boolean;
}) {
  const q = useLeadDesigns(id, active);
  const [open, setOpen] = useState(false);

  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      {q.data.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No design uploaded yet"
          description={
            canComplete
              ? 'Upload 3D renders, walkthrough videos, or drawings and mark design completed.'
              : 'Design deliverables will appear here once the designer team completes them.'
          }
          action={
            canComplete ? (
              <Button onClick={() => setOpen(true)}>
                <CheckCircle2 /> Upload design &amp; mark completed
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div>
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-muted-foreground text-xs font-medium">
              {q.data.length} {q.data.length === 1 ? 'submission' : 'submissions'}
            </span>
            {canComplete && (
              <Button size="sm" onClick={() => setOpen(true)}>
                <CheckCircle2 /> Upload design &amp; mark completed
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {q.data.map((d) => (
              <li key={d.id} className="flex gap-3 px-4 py-3">
                <Palette className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{d.user.name}</p>
                      {d.note && <p className="text-muted-foreground text-xs">{d.note}</p>}
                    </div>
                    <time dateTime={d.at} className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(d.at)}, {formatTime(d.at)}
                    </time>
                  </div>
                  {d.media.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {d.media.map((m) =>
                        m.kind === 'VIDEO' ? (
                          <video
                            key={m.publicId}
                            src={m.url}
                            poster={m.thumbUrl ?? undefined}
                            controls
                            preload="metadata"
                            className="bg-secondary aspect-video w-full rounded-lg border object-cover"
                          />
                        ) : m.kind === 'IMAGE' ? (
                          <a
                            key={m.publicId}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-secondary block aspect-video overflow-hidden rounded-lg border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.thumbUrl ?? m.url}
                              alt={m.fileName ?? 'Design render'}
                              className="size-full object-cover transition-transform hover:scale-105"
                            />
                          </a>
                        ) : (
                          <a
                            key={m.publicId}
                            href={m.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-secondary hover:bg-secondary/80 flex aspect-video flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-colors"
                          >
                            <FileText className="text-primary size-6" aria-hidden />
                            <span className="line-clamp-2 text-xs font-medium break-all">
                              {m.fileName ?? 'Design file'}
                            </span>
                            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                              <Download className="size-3" aria-hidden /> Download
                            </span>
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CompleteDesignDialog leadId={id} open={open} onOpenChange={setOpen} />
    </>
  );
}

const ListSkeleton = () => (
  <div className="space-y-3 p-4" aria-hidden>
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-9 w-full" />
    ))}
  </div>
);

function LeadProposals({ leadId, active }: { leadId: string; active: boolean }) {
  const q = useProposals({ page: 1, status: null, leadId });
  if (!active && !q.data) return null;
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No proposals yet"
        action={
          <Button asChild>
            <Link href={`/proposals/new?leadId=${leadId}`}>
              <Plus /> New proposal
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-y">
      {q.data.items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/proposals/${p.id}`}
            className="hover:bg-primary-soft/50 flex items-center gap-3 px-4 py-3"
          >
            <span className="tabular font-semibold">{p.number}</span>
            <ProposalChipBadge p={p} />
            <span className="tabular ml-auto font-medium">{formatINR(p.total)}</span>
            <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
              {p.firstSeenAt
                ? `Seen ${relativeAge(p.firstSeenAt)}`
                : p.sentAt
                  ? 'Not seen yet'
                  : 'Draft'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
