import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeLeadStatusBodyDto,
  CreateLeadBodyDto,
  LeadDto,
  RecordCallBodyDto,
  RecordVisitBodyDto,
} from '@vastu/contracts';
import {
  changeLeadStatus,
  createLead,
  getLead,
  listCalls,
  listLeads,
  listVisits,
  recordCall,
  recordVisit,
} from '@/lib/api/endpoints/leads';

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

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLeadBodyDto) => createLead(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useChangeLeadStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeadDto['status'] | ChangeLeadStatusBodyDto) =>
      changeLeadStatus(id, typeof input === 'string' ? { status: input } : input),
    onSuccess: (lead) => {
      qc.setQueryData(['leads', 'detail', id], lead);
      void qc.invalidateQueries({ queryKey: ['leads', 'list'] });
      void qc.invalidateQueries({ queryKey: ['leads', 'today'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useLeadCalls = (id: string, enabled = true) =>
  useQuery({ queryKey: ['leads', 'calls', id], queryFn: ({ signal }) => listCalls(id, signal), enabled });

export const useLeadVisits = (id: string, enabled = true) =>
  useQuery({ queryKey: ['leads', 'visits', id], queryFn: ({ signal }) => listVisits(id, signal), enabled });

export function useRecordCall(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // TODO(outbox): enqueue instead of calling the API directly (the API dedupes a retried call by startedAt).
    mutationFn: (body: RecordCallBodyDto) => recordCall(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads', 'calls', id] });
      void qc.invalidateQueries({ queryKey: ['leads', 'detail', id] });
      void qc.invalidateQueries({ queryKey: ['leads', 'today'] });
    },
  });
}

export function useRecordVisit(id: string) {
  const qc = useQueryClient();
  return useMutation({
    // TODO(outbox): enqueue with the captured `at`. NOT idempotent: send once, never auto-retry.
    mutationFn: (body: RecordVisitBodyDto) => recordVisit(id, body),
    retry: false,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leads', 'visits', id] }),
  });
}
