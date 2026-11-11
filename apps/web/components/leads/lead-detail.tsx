'use client';

import { ArrowLeft, Clock, FileText, MapPin, MessageCircle, Phone, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/client';
import { useLead, useLeadCalls, useLeadTimeline, useLeadVisits } from '@/lib/api/leads';
import { useProposals } from '@/lib/api/proposals';
import { ProposalChipBadge } from '@/components/proposals/proposals-view';
import { useAuth } from '@/lib/auth';
import { describeActivity } from '@/lib/lead-activity';
import { formatDate, formatDuration, formatINR, formatTime, relativeAge } from '@/lib/format';
import { SOURCE_LABEL, formatPhone, leadPermissions, telUrl, whatsappUrl } from '@/lib/leads';
import { AssignDialog, StatusDialog } from './lead-dialogs';

export function LeadDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const can = leadPermissions(user?.role);
  const lead = useLead(id);
  const [dialog, setDialog] = useState<'status' | 'assign' | null>(null);
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
              <span className="tabular text-muted-foreground text-sm">{formatPhone(l.phone)}</span>
            </div>
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
              <dl className="divide-y">
                <Row label="Phone">{formatPhone(l.phone)}</Row>
                <Row label="Alternate phone">{l.altPhone ? formatPhone(l.altPhone) : '—'}</Row>
                <Row label="Email">{l.email ?? '—'}</Row>
                <Row label="City">{l.city ?? '—'}</Row>
                <Row label="Notes">{l.notes ?? '—'}</Row>
              </dl>
            </Panel>
          </TabsContent>
        </Tabs>

        <aside className="bg-card shadow-card h-fit rounded-xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">Summary</h2>
          <dl className="divide-y text-sm">
            <Row label="Assigned to">{l.assignedTo?.name ?? 'Unassigned'}</Row>
            <Row label="Source">{SOURCE_LABEL[l.source]}</Row>
            <Row label="Status changed">{relativeAge(l.statusChangedAt)}</Row>
            <Row label="Created">{formatDate(l.createdAt)}</Row>
            {l.lostReason && <Row label="Lost because">{l.lostReason}</Row>}
          </dl>
          {l.customerId && (
            <p className="text-success bg-success-soft mt-3 rounded-md p-2 text-xs">
              Customer account created. Won leads are locked.
            </p>
          )}
        </aside>
      </div>

      {dialog === 'status' && <StatusDialog lead={l} onClose={() => setDialog(null)} />}
      {dialog === 'assign' && <AssignDialog lead={l} onClose={() => setDialog(null)} />}
    </PageBody>
  );
}

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="bg-card shadow-card mt-3 overflow-hidden rounded-xl border">{children}</div>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 px-0 py-2 first:pt-0 last:pb-0 [&:is(dl_dl_*)]:px-0">
    <dt className="text-muted-foreground shrink-0 text-xs font-medium">{label}</dt>
    <dd className="min-w-0 text-right break-words">{children}</dd>
  </div>
);

function Timeline({ id }: { id: string }) {
  const q = useLeadTimeline(id);
  if (q.isPending) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.length === 0) return <EmptyState icon={Clock} title="Nothing here yet" />;
  return (
    <ol className="divide-y">
      {q.data.map((a) => {
        const { title, detail } = describeActivity(a);
        return (
          <li key={a.id} className="flex gap-3 px-4 py-3">
            <span aria-hidden className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{title}</p>
              {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
            </div>
            <time
              dateTime={a.at}
              className="text-muted-foreground shrink-0 text-xs"
              title={`${formatDate(a.at)}, ${formatTime(a.at)}`}
            >
              {relativeAge(a.at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
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
