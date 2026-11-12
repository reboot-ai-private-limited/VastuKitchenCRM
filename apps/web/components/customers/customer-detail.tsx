'use client';

import { ArrowLeft, FolderKanban, MessageCircle, Phone, Rocket, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Timeline } from '@/components/leads/lead-detail';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useCustomer, useStartNewProject } from '@/lib/api/customers';
import { initials, relativeAge } from '@/lib/format';
import { formatPhone, telUrl, whatsappUrl } from '@/lib/leads';

export function CustomerDetail({ id }: { id: string }) {
  const q = useCustomer(id);
  const router = useRouter();
  const start = useStartNewProject(id);
  const [confirm, setConfirm] = useState(false);

  if (q.isError && q.error instanceof ApiError && q.error.isNotFound) return <NotFoundView />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending)
    return (
      <PageBody>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageBody>
    );
  const c = q.data;
  // Their lead is in the pipeline for a new project: planning continues there.
  const inProgress = c.leadStatus !== 'WON' && c.leadStatus !== 'LOST';

  return (
    <PageBody>
      <Link
        href="/customers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Customers
      </Link>

      <header className="bg-card shadow-card flex flex-wrap items-start gap-4 rounded-xl border p-4">
        <Avatar className="size-14 shrink-0">
          <AvatarFallback className="text-lg">{initials(c.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-muted-foreground tabular text-sm">
            {formatPhone(c.phone)}
            {c.city ? ` · ${c.city}` : ''}
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <UserRound className="size-3.5" aria-hidden />
            {c.owner ? `Owner: ${c.owner.name}` : 'No owner'} · active{' '}
            {relativeAge(c.lastActivityAt)}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <a href={telUrl(c.phone)}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/leads/${c.leadId}`}>Open lead</Link>
          </Button>
          {!inProgress && (
            <Button onClick={() => setConfirm(true)}>
              <Rocket /> Start new project
            </Button>
          )}
        </div>
      </header>

      {inProgress && (
        <div className="border-warning/30 bg-warning-soft/30 flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
          <p className="min-w-0 flex-1">
            {c.projectsCount > 0
              ? 'A new project is being planned.'
              : 'Their first project is being planned.'}{' '}
            Visits and proposals continue on their lead, on this same timeline.
          </p>
          <StatusBadge kind="lead" value={c.leadStatus} />
          <Button size="sm" asChild>
            <Link href={`/leads/${c.leadId}`}>Continue on the lead</Link>
          </Button>
        </div>
      )}

      <section aria-label="Projects" className="space-y-3">
        <h2 className="text-sm font-semibold">
          Projects{' '}
          <span className="text-muted-foreground tabular font-normal">· {c.projectsCount}</span>
        </h2>
        {c.projects.length === 0 ? (
          <p className="text-muted-foreground bg-card shadow-card rounded-xl border p-4 text-sm">
            No project yet. Use “Start new project” to plan their first one.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {c.projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="bg-card shadow-card hover:shadow-card-hover focus-visible:ring-ring flex items-start gap-3 rounded-xl border p-4 transition-all outline-none hover:-translate-y-px focus-visible:ring-2"
                >
                  <FolderKanban
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      started {relativeAge(p.createdAt)}
                    </span>
                  </span>
                  <StatusBadge kind="project" value={p.stage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Timeline" className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Timeline</h2>
          <p className="text-muted-foreground text-xs">
            Calls, visits, proposals and projects, all in one place. It is the same as their lead’s
            timeline.
          </p>
        </div>
        <div className="bg-card shadow-card overflow-hidden rounded-xl border">
          <Timeline id={c.leadId} />
        </div>
      </section>

      <Dialog open={confirm} onOpenChange={(o) => !start.isPending && setConfirm(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new project for {c.name}?</DialogTitle>
            <DialogDescription>
              Their lead goes back to New so you can plan a visit and send a proposal. Nothing is
              copied: it stays on the same timeline, and when you mark it Won, another project is
              created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={start.isPending} onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              disabled={start.isPending}
              onClick={() =>
                start.mutate(undefined, {
                  onSuccess: (updated) => {
                    toast.success('New project started');
                    setConfirm(false);
                    router.push(`/leads/${updated.leadId}`);
                  },
                  onError: (e) => {
                    setConfirm(false);
                    toast.error(e instanceof ApiError ? e.message : 'Couldn’t start it.');
                  },
                })
              }
            >
              {start.isPending ? 'Starting…' : 'Start new project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
