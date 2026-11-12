import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangeLeadStatusBodyDto, CreateLeadBodyDto, LeadDto } from '@vastu/contracts';
import { changeLeadStatus, createLead, getLead, listLeads } from '@/lib/api/endpoints/leads';

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
