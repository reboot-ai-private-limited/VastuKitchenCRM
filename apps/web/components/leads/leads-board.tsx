'use client';

import { LEAD_STATUSES, type LeadDto, type LeadStatus } from '@vastu/contracts';
import { ChevronDown, ChevronRight, Clock, GripVertical, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useBoardColumn, useMoveLead } from '@/lib/api/leads';
import { boardLeads, boardTotal } from '@/lib/board';
import { relativeAge } from '@/lib/format';
import {
  SOURCE_LABEL,
  STATUS_LABEL,
  formatPhone,
  type LeadFilters,
  type leadPermissions,
} from '@/lib/leads';
import { cn } from '@/lib/utils';
import { StatusDialog } from './lead-dialogs';

/** Won and Lost are finished: collapsed by default so the working stages get the room. */
const COLLAPSED_BY_DEFAULT: ReadonlySet<LeadStatus> = new Set(['WON', 'LOST']);

const DOT: Record<LeadStatus, string> = {
  NEW: 'bg-info',
  CONTACTED: 'bg-info/60',
  VISIT: 'bg-violet',
  PROPOSAL_SENT: 'bg-warning',
  FOLLOW_UP: 'bg-orange',
  WON: 'bg-success',
  LOST: 'bg-danger',
};

interface PendingMove {
  lead: LeadDto;
  to: LeadStatus;
}

export function LeadsBoard({
  filters,
  can,
}: {
  filters: LeadFilters;
  can: ReturnType<typeof leadPermissions>;
}) {
  const move = useMoveLead();
  const [dragging, setDragging] = useState<LeadDto | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  /** Lost needs a reason and Won is final, so those ask first; everything else moves at once. */
  function requestMove(lead: LeadDto, to: LeadStatus) {
    setDragging(null);
    if (!can.changeStatus || lead.status === 'WON' || lead.status === to) return;
    if (to === 'LOST' || to === 'WON') {
      setPending({ lead, to });
      return;
    }
    move.mutate(
      { lead, to },
      {
        onSuccess: () => toast.success(`${lead.name} moved to ${STATUS_LABEL[to]}`),
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'Couldn’t move that lead. It was put back.',
          ),
      },
    );
  }

  return (
    <>
      <div
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 lg:-mx-6 lg:px-6"
        aria-label="Lead pipeline"
      >
        {LEAD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            filters={filters}
            can={can}
            dragging={dragging}
            onDragStart={setDragging}
            onDragEnd={() => setDragging(null)}
            onMove={requestMove}
          />
        ))}
      </div>
      {pending && (
        <StatusDialog lead={pending.lead} initial={pending.to} onClose={() => setPending(null)} />
      )}
    </>
  );
}

function Column({
  status,
  filters,
  can,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  status: LeadStatus;
  filters: LeadFilters;
  can: ReturnType<typeof leadPermissions>;
  dragging: LeadDto | null;
  onDragStart: (l: LeadDto) => void;
  onDragEnd: () => void;
  onMove: (lead: LeadDto, to: LeadStatus) => void;
}) {
  const q = useBoardColumn(status, filters);
  const [collapsed, setCollapsed] = useState(COLLAPSED_BY_DEFAULT.has(status));
  const [over, setOver] = useState(false);
  const leads = boardLeads(q.data);
  const total = boardTotal(q.data);
  // Only a different column is a valid target, and only when the person may change status at all.
  const canDrop = can.changeStatus && dragging !== null && dragging.status !== status;

  return (
    <section
      aria-label={`${STATUS_LABEL[status]}, ${total} leads`}
      onDragOver={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (canDrop && dragging) onMove(dragging, status);
      }}
      className={cn(
        'bg-muted/70 flex shrink-0 snap-start flex-col rounded-xl border border-transparent transition-colors',
        collapsed ? 'w-52 self-start' : 'w-72',
        over && 'border-primary bg-primary-soft',
        canDrop && !over && 'border-primary/30 border-dashed',
      )}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span aria-hidden className={cn('size-2 rounded-full', DOT[status])} />
        <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="bg-card text-muted-foreground tabular rounded-full border px-1.5 text-xs font-medium">
          {q.isPending ? '…' : total}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${STATUS_LABEL[status]}`}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronRight /> : <ChevronDown />}
        </Button>
      </header>

      {!collapsed && (
        <div className="flex max-h-[calc(100dvh-17rem)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {q.isPending ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} className="p-2" />
          ) : leads.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              {canDrop ? 'Drop here' : 'No leads'}
            </p>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                can={can}
                dragging={dragging?.id === lead.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onMove={onMove}
              />
            ))
          )}
          {q.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              disabled={q.isFetchingNextPage}
              onClick={() => q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? 'Loading…' : `Load more (${total - leads.length})`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function LeadCard({
  lead,
  can,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  lead: LeadDto;
  can: ReturnType<typeof leadPermissions>;
  dragging: boolean;
  onDragStart: (l: LeadDto) => void;
  onDragEnd: () => void;
  onMove: (lead: LeadDto, to: LeadStatus) => void;
}) {
  const movable = can.changeStatus && lead.status !== 'WON';
  return (
    <article
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
        onDragStart(lead);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-card shadow-card hover:shadow-card-hover group relative rounded-lg border p-3 transition-all',
        movable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-1.5">
        {movable && (
          <GripVertical className="text-muted-foreground/60 mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${lead.id}`}
            draggable={false}
            className="focus-visible:ring-ring block truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2"
          >
            {lead.name}
          </Link>
          <p className="tabular text-muted-foreground text-xs">{formatPhone(lead.phone)}</p>
        </div>
        {movable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mt-1 -mr-1"
                aria-label={`Move ${lead.name} to another stage`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(lead, s)}>
                  <span aria-hidden className={cn('size-2 rounded-full', DOT[s])} />{' '}
                  {STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5">
          {SOURCE_LABEL[lead.source]}
        </span>
        {lead.isStuck && (
          <span className="text-warning inline-flex items-center gap-1 font-medium">
            <Clock className="size-3" aria-hidden /> Stuck
          </span>
        )}
        <span className="ml-auto">{relativeAge(lead.statusChangedAt)}</span>
      </div>
      {lead.assignedTo && (
        <p className="text-muted-foreground mt-1.5 truncate text-xs">{lead.assignedTo.name}</p>
      )}
    </article>
  );
}
