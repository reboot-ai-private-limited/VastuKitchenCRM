'use client';

import type { LeadDto, ProposalDto, ProposalStatus } from '@vastu/contracts';
import { FileText, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useLeads } from '@/lib/api/leads';
import { PROPOSAL_PAGE_SIZE, useProposals } from '@/lib/api/proposals';
import { formatINR, relativeAge } from '@/lib/format';
import { DEFAULT_FILTERS, STATUS_LABEL, formatPhone } from '@/lib/leads';
import { proposalChip } from '@/lib/proposals';
import { cn } from '@/lib/utils';

const ALL = '__all__';

export function ProposalChipBadge({ p }: { p: Pick<ProposalDto, 'status' | 'firstSeenAt'> }) {
  const c = proposalChip(p);
  return <StatusBadge kind="tone" tone={c.tone} label={c.label} />;
}

export function ProposalsView() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (['DRAFT', 'SENT'] as const).find((s) => s === params.get('status')) ?? null;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const [picking, setPicking] = useState(false);
  const q = useProposals({ page, status });
  const data = q.data;

  const go = (next: { status?: ProposalStatus | null; page?: number }) => {
    const p = new URLSearchParams();
    const s = next.status === undefined ? status : next.status;
    if (s) p.set('status', s);
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    router.replace(`/proposals${p.size ? `?${p}` : ''}`, { scroll: false });
  };

  return (
    <PageBody>
      <PageHeader
        title="Proposals"
        description={
          data ? `${data.total} ${data.total === 1 ? 'proposal' : 'proposals'}` : undefined
        }
        actions={
          <Button onClick={() => setPicking(true)}>
            <Plus /> New proposal
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? ALL}
          onValueChange={(v) => go({ status: v === ALL ? null : (v as ProposalStatus), page: 1 })}
        >
          <SelectTrigger aria-label="Status" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All proposals</SelectItem>
            <SelectItem value="DRAFT">Drafts</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isError && !data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={status ? 'No proposals here' : 'No proposals yet'}
            description="Create one from a lead, then send it on WhatsApp."
            action={
              <Button onClick={() => setPicking(true)}>
                <Plus /> New proposal
              </Button>
            }
          />
        ) : data ? (
          <>
            <Table className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Sent</TableHead>
                  <TableHead className="hidden lg:table-cell">Seen</TableHead>
                  <TableHead className="hidden lg:table-cell">Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/proposals/${p.id}`}
                        className="focus-visible:ring-ring rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                      >
                        <span className="tabular">{p.number}</span>
                      </Link>
                      <span className="text-muted-foreground block text-xs">{p.customer.name}</span>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatINR(p.total)}
                    </TableCell>
                    <TableCell>
                      <ProposalChipBadge p={p} />
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {p.sentAt ? relativeAge(p.sentAt) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {p.firstSeenAt
                        ? `${relativeAge(p.firstSeenAt)} · ${p.seenCount}×`
                        : p.sentAt
                          ? 'Not yet'
                          : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {p.createdBy?.name ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
                <p className="text-muted-foreground tabular text-xs">
                  {(data.page - 1) * PROPOSAL_PAGE_SIZE + 1}–
                  {Math.min(data.page * PROPOSAL_PAGE_SIZE, data.total)} of {data.total}
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
      <LeadPicker open={picking} onOpenChange={setPicking} />
    </PageBody>
  );
}

/** A proposal belongs to a lead, so "New proposal" starts by choosing one. */
function LeadPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const search = text.trim();
  const filters = useMemo(() => ({ ...DEFAULT_FILTERS, search }), [search]);
  const leads = useLeads(filters, open);
  const items: LeadDto[] = leads.data?.items ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which lead is it for?</DialogTitle>
          <DialogDescription>Search by name, phone or city.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            autoFocus
            aria-label="Search leads"
            className="pl-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {leads.isPending ? (
            <li className="p-3">
              <Skeleton className="h-8 w-full" />
            </li>
          ) : items.length === 0 ? (
            <li className="text-muted-foreground p-4 text-center text-sm">No leads found.</li>
          ) : (
            items.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="hover:bg-primary-soft/50 focus-visible:bg-primary-soft/50 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left outline-none"
                  onClick={() => router.push(`/proposals/new?leadId=${l.id}`)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{l.name}</span>
                    <span className="tabular text-muted-foreground text-xs">
                      {formatPhone(l.phone)}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {STATUS_LABEL[l.status]}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
