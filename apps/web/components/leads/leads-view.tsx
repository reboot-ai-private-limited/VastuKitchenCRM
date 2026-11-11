'use client';

import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadDto,
  type LeadSource,
  type LeadStatus,
} from '@vastu/contracts';
import { Clock, Columns3, MoreHorizontal, Phone, Plus, Rows3, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { PAGE_SIZE, useLeads, useSalesUsers } from '@/lib/api/leads';
import { useAuth } from '@/lib/auth';
import { relativeAge } from '@/lib/format';
import {
  DEFAULT_FILTERS,
  SOURCE_LABEL,
  STATUS_LABEL,
  filtersToSearch,
  formatPhone,
  leadPermissions,
  parseFilters,
  telUrl,
  whatsappUrl,
  type LeadFilters,
} from '@/lib/leads';
import { cn } from '@/lib/utils';
import { AddLeadSheet } from './add-lead-sheet';
import { AssignDialog, StatusDialog } from './lead-dialogs';
import { LeadsBoard } from './leads-board';

const ALL = '__all__';

type Dialog = { kind: 'status' | 'assign'; lead: LeadDto } | null;

export function LeadsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const can = leadPermissions(user?.role);
  const filters = useMemo(() => parseFilters(params), [params]);
  const [adding, setAdding] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const setFilters = useCallback(
    (patch: Partial<LeadFilters>) => {
      // Any filter change goes back to page 1; only paging keeps the page.
      const next = { ...filters, page: 1, ...patch };
      router.replace(`/leads${filtersToSearch(next)}`, { scroll: false });
    },
    [filters, router],
  );

  const clearFilters = () =>
    router.replace(`/leads${filtersToSearch({ ...DEFAULT_FILTERS, view: filters.view })}`, {
      scroll: false,
    });

  // The search box types freely and updates the URL after a short pause. The draft only counts
  // while the URL still holds the value it was typed over, so Clear or back/forward win.
  const [draft, setDraft] = useState<{ value: string; from: string } | null>(null);
  const text = draft && draft.from === filters.search ? draft.value : filters.search;
  useEffect(() => {
    if (!draft || draft.from !== filters.search || draft.value.trim() === filters.search) return;
    const t = setTimeout(() => setFilters({ search: draft.value.trim() }), 350);
    return () => clearTimeout(t);
  }, [draft, filters.search, setFilters]);

  const board = filters.view === 'board';
  const leads = useLeads(filters, !board);
  const team = useSalesUsers(can.filterByAssignee);
  const data = leads.data;
  const filtered =
    JSON.stringify({ ...filters, page: 1, view: 'table' }) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <PageBody>
      <PageHeader
        title="Leads"
        description={
          data && !board
            ? `${data.total} ${data.total === 1 ? 'lead' : 'leads'}${filtered ? ' match your filters' : ''}`
            : undefined
        }
        actions={
          <>
            <div
              role="group"
              aria-label="View"
              className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
            >
              {(['table', 'board'] as const).map((v) => (
                <Button
                  key={v}
                  variant={filters.view === v ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={filters.view === v}
                  onClick={() => setFilters({ view: v })}
                >
                  {v === 'table' ? <Rows3 /> : <Columns3 />} {v === 'table' ? 'Table' : 'Board'}
                </Button>
              ))}
            </div>
            {can.add && (
              <Button onClick={() => setAdding(true)}>
                <Plus /> Add lead
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
            aria-label="Search leads"
            placeholder="Search name, phone or city"
            className="pl-8"
            value={text}
            onChange={(e) => setDraft({ value: e.target.value, from: filters.search })}
          />
        </div>
        {!board && (
          <Select
            value={filters.status ?? ALL}
            onValueChange={(v) => setFilters({ status: v === ALL ? null : (v as LeadStatus) })}
          >
            <SelectTrigger aria-label="Status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={filters.source ?? ALL}
          onValueChange={(v) => setFilters({ source: v === ALL ? null : (v as LeadSource) })}
        >
          <SelectTrigger aria-label="Source" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can.filterByAssignee && (
          <Select
            value={filters.assignedTo ?? ALL}
            onValueChange={(v) => setFilters({ assignedTo: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Assigned to" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everyone</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {team.data?.items.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={filters.stuck ? 'secondary' : 'outline'}
          aria-pressed={filters.stuck}
          onClick={() => setFilters({ stuck: !filters.stuck })}
        >
          <Clock /> Stuck
        </Button>
        {filtered && (
          <Button variant="ghost" onClick={() => clearFilters()}>
            Clear
          </Button>
        )}
      </div>

      {board ? (
        <LeadsBoard filters={filters} can={can} />
      ) : (
        <div className="bg-card shadow-card overflow-hidden rounded-xl border">
          {leads.isError && !data ? (
            <ErrorState error={leads.error} onRetry={() => leads.refetch()} />
          ) : leads.isPending ? (
            <div className="space-y-3 p-4" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filtered ? 'No leads match these filters' : 'No leads yet'}
              description={
                filtered
                  ? 'Try clearing a filter or searching for something else.'
                  : 'Add your first lead to start the pipeline.'
              }
              action={
                filtered ? (
                  <Button variant="outline" onClick={() => clearFilters()}>
                    Clear filters
                  </Button>
                ) : can.add ? (
                  <Button onClick={() => setAdding(true)}>
                    <Plus /> Add lead
                  </Button>
                ) : undefined
              }
            />
          ) : data ? (
            <>
              <Table className={cn(leads.isPlaceholderData && 'opacity-60 transition-opacity')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Source</TableHead>
                    <TableHead className="hidden lg:table-cell">Assigned to</TableHead>
                    <TableHead className="hidden sm:table-cell">Status changed</TableHead>
                    <TableHead className="hidden xl:table-cell">Created</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      can={can}
                      onAction={(kind) => setDialog({ kind, lead })}
                    />
                  ))}
                </TableBody>
              </Table>
              <Pager
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                onPage={(page) => setFilters({ page })}
              />
            </>
          ) : null}
        </div>
      )}

      <AddLeadSheet open={adding} onOpenChange={setAdding} />
      {dialog?.kind === 'status' && (
        <StatusDialog lead={dialog.lead} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'assign' && (
        <AssignDialog lead={dialog.lead} onClose={() => setDialog(null)} />
      )}
    </PageBody>
  );
}

function LeadRow({
  lead,
  can,
  onAction,
}: {
  lead: LeadDto;
  can: ReturnType<typeof leadPermissions>;
  onAction: (kind: 'status' | 'assign') => void;
}) {
  const locked = lead.status === 'WON';
  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/leads/${lead.id}`}
          className="focus-visible:ring-ring block rounded-sm outline-none hover:underline focus-visible:ring-2"
        >
          <span className="font-semibold">{lead.name}</span>
        </Link>
        <span className="tabular text-muted-foreground block text-xs">
          {formatPhone(lead.phone)}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge kind="lead" value={lead.status} />
          {lead.isStuck && <Clock className="text-warning size-3.5" aria-label="Stuck" />}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
          {SOURCE_LABEL[lead.source]}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground hidden lg:table-cell">
        {lead.assignedTo?.name ?? 'Unassigned'}
      </TableCell>
      <TableCell className="text-muted-foreground hidden sm:table-cell">
        {relativeAge(lead.statusChangedAt)}
      </TableCell>
      <TableCell className="text-muted-foreground hidden xl:table-cell">
        {relativeAge(lead.createdAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${lead.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/leads/${lead.id}`}>Open</Link>
            </DropdownMenuItem>
            {can.changeStatus && !locked && (
              <DropdownMenuItem onSelect={() => onAction('status')}>
                Change status…
              </DropdownMenuItem>
            )}
            {can.assign && (
              <DropdownMenuItem onSelect={() => onAction('assign')}>Assign…</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={telUrl(lead.phone)}>
                <Phone /> Call
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={whatsappUrl(lead.phone)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
      <p className="text-muted-foreground tabular text-xs">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
