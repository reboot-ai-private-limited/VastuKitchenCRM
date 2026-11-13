'use client';

import {
  ArrowLeft,
  Clock,
  FileText,
  MapPin,
  MessageCircle,
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
import { useLead, useLeadCalls, useLeadTimeline, useLeadVisits } from '@/lib/api/leads';
import { useLeadProjects } from '@/lib/api/projects';
import { useProposals } from '@/lib/api/proposals';
import { ProposalChipBadge } from '@/components/proposals/proposals-view';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDuration, formatINR, formatTime, relativeAge } from '@/lib/format';
import { SOURCE_LABEL, formatPhone, leadPermissions, telUrl, whatsappUrl } from '@/lib/leads';
import { EditLeadDialog } from './edit-lead-dialog';
import { AssignDialog, StatusDialog } from './lead-dialogs';

export function LeadDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const can = leadPermissions(user?.role);
  const lead = useLead(id);
  const projects = useLeadProjects(id, lead.data?.status === 'WON');
  const [dialog, setDialog] = useState<'status' | 'assign' | 'edit' | null>(null);
  const [tab, setTab] = useState('timeline');
  // Office has no call or visit log access; those tabs are for Admin and Sales.
  const seesLogs = user?.role === 'ADMIN' || user?.role === 'SALES';
  const proposals = seesLogs;

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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {proposals && <TabsTrigger value="proposals">Proposals</TabsTrigger>}
            {seesLogs && <TabsTrigger value="calls">Calls</TabsTrigger>}
            {seesLogs && <TabsTrigger value="visits">Visits</TabsTrigger>}
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
          {seesLogs && (
            <TabsContent value="visits">
              <Panel>
                <Visits id={id} active={tab === 'visits'} />
              </Panel>
            </TabsContent>
          )}
          <TabsContent value="details">
            <Panel>
              <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
                <Field label="Phone">{formatPhone(l.phone)}</Field>
                <Field label="Alternate phone">{l.altPhone ? formatPhone(l.altPhone) : null}</Field>
                <Field label="Email">{l.email}</Field>
                <Field label="City">{l.city}</Field>
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

function Visits({ id, active }: { id: string; active: boolean }) {
  const q = useLeadVisits(id, active);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0)
    return (
      <EmptyState
        icon={MapPin}
        title="No visits logged"
        description="Visits are checked in from the phone app."
      />
    );
  return (
    <ul className="divide-y">
      {q.data.map((v) => (
        <li key={v.id} className="flex gap-3 px-4 py-3">
          <MapPin className="text-violet mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{v.user.name}</p>
            <p className="text-muted-foreground text-xs">
              {v.note ?? 'No note'} ·{' '}
              <a
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
              >
                Map
              </a>
            </p>
          </div>
          <time dateTime={v.at} className="text-muted-foreground shrink-0 text-xs">
            {formatDate(v.at)}, {formatTime(v.at)}
          </time>
        </li>
      ))}
    </ul>
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
