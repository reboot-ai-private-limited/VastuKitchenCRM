import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeLeadStatusBodyDto,
  CreateLeadBodyDto,
  LeadDto,
  RecordCallBodyDto,
  RecordVisitBodyDto,
  UpdateLeadBodyDto,
} from '@vastu/contracts';
import {
  assignLead,
  createLead,
  getLead,
  getLeadTimeline,
  listCalls,
  listLeads,
  listVisits,
  updateLead,
} from '@/lib/api/endpoints/leads';
import { listProposals } from '@/lib/api/endpoints/proposals';
import { listUsers } from '@/lib/api/endpoints/users';
import { NetworkError } from '@/lib/api/client';
import { enqueueOutbox, usePendingOutbox, type OutboxItem } from '@/offline';

/** Outbox entity key for everything queued against one lead (replayed in order). */
export const leadKey = (id: string) => `lead:${id}`;

/** Pending (unsynced) outbox rows for a lead; pass `type` prefixes to narrow. */
export function usePendingForLead(id: string, ...types: string[]): OutboxItem[] {
  return usePendingOutbox((i) => i.entityKey === leadKey(id) && (types.length === 0 || types.includes(i.type)));
}

export const useLeadsList = (search: string, status?: LeadDto['status']) =>
  useInfiniteQuery({
    queryKey: ['leads', 'list', { search, status }],
    queryFn: ({ pageParam, signal }) =>
      listLeads({ page: pageParam, search: search || undefined, status }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      // Rows shift between pages: de-dupe by id.
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((l) => !seen.has(l.id) && seen.add(l.id));
    },
  });

export const useLeadDetail = (id: string) =>
  useQuery({ queryKey: ['leads', 'detail', id], queryFn: ({ signal }) => getLead(id, signal) });

export const useLeadTimeline = (id: string) =>
  useQuery({ queryKey: ['leads', 'timeline', id], queryFn: ({ signal }) => getLeadTimeline(id, signal) });

export const useLeadProposals = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['proposals', 'by-lead', id],
    queryFn: ({ signal }) => listProposals({ page: 1, leadId: id }, signal),
    enabled,
  });

export const useSalesUsers = (enabled: boolean) =>
  useQuery({
    queryKey: ['users', 'sales'],
    queryFn: ({ signal }) => listUsers({ role: 'SALES', pageSize: 100 }, signal),
    enabled,
    staleTime: 5 * 60_000,
  });

/**
 * Add a lead. Online it goes straight to the API (so the caller can open the new lead and a 409
 * surfaces its `existingLeadId`); with no connection it is queued as `lead.create` and
 * `queued` is true. A 409 on a later replay is reported by the outbox drop alert.
 */
export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateLeadBodyDto): Promise<{ lead?: LeadDto; queued: boolean }> => {
      try {
        return { lead: await createLead(body), queued: false };
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        await enqueueOutbox({ type: 'lead.create', entityKey: `lead-new:${body.phone}`, payload: { body } });
        return { queued: true };
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Queue a status change (optimistic on the detail cache; replayed in order per lead). */
export function useChangeLeadStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadDto['status'] | ChangeLeadStatusBodyDto) => {
      const body = typeof input === 'string' ? { status: input } : input;
      await enqueueOutbox({ type: 'lead.status', entityKey: leadKey(id), payload: { leadId: id, body } });
      return body;
    },
    onSuccess: (body) => {
      qc.setQueryData<LeadDto>(['leads', 'detail', id], (old) =>
        old ? { ...old, status: body.status, isStuck: false, lostReason: body.lostReason ?? old.lostReason } : old,
      );
    },
  });
}

export const useLeadCalls = (id: string, enabled = true) =>
  useQuery({ queryKey: ['leads', 'calls', id], queryFn: ({ signal }) => listCalls(id, signal), enabled });

export const useLeadVisits = (id: string, enabled = true) =>
  useQuery({ queryKey: ['leads', 'visits', id], queryFn: ({ signal }) => listVisits(id, signal), enabled });

/** Queue a call log. Safe to replay: the API dedupes on startedAt. */
export function useRecordCall(id: string) {
  return useMutation({
    mutationFn: (body: Omit<RecordCallBodyDto, 'startedAt'> & { startedAt: Date }) =>
      enqueueOutbox({
        type: 'call.record',
        entityKey: leadKey(id),
        payload: { leadId: id, body: { ...body, startedAt: body.startedAt.toISOString() } },
        capturedAt: body.startedAt.getTime(),
      }),
  });
}

/** Queue a visit with its captured time. NOT idempotent: the outbox never auto-retries it on an ambiguous failure. */
export function useRecordVisit(id: string) {
  return useMutation({
    mutationFn: (body: Omit<RecordVisitBodyDto, 'at'> & { at: Date }) =>
      enqueueOutbox({
        type: 'visit.log',
        entityKey: leadKey(id),
        payload: { leadId: id, body: { ...body, at: body.at.toISOString() } },
        capturedAt: body.at.getTime(),
      }),
    retry: false,
  });
}

function useLeadWrite<V>(id: string, fn: (v: V) => Promise<LeadDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (lead) => {
      qc.setQueryData(['leads', 'detail', id], lead);
      void qc.invalidateQueries({ queryKey: ['leads', 'list'] });
      void qc.invalidateQueries({ queryKey: ['leads', 'timeline', id] });
    },
  });
}

export const useUpdateLead = (id: string) => useLeadWrite<UpdateLeadBodyDto>(id, (b) => updateLead(id, b));
/** ADMIN only. `null` unassigns. */
export const useAssignLead = (id: string) =>
  useLeadWrite<string | null>(id, (userId) => assignLead(id, { userId }));
