'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  AssignLeadBodyDto,
  CallDto,
  ChangeLeadStatusBodyDto,
  LeadStatus,
  CreateLeadBodyDto,
  LeadActivityDto,
  LeadDto,
  PaginatedDto,
  UpdateLeadBodyDto,
  VisitDto,
  UserDto,
} from '@vastu/contracts';
import type { LeadFilters } from '@/lib/leads';
import { addToBoard, movedLead, removeFromBoard, type BoardData } from '@/lib/board';
import { api } from './client';

export const PAGE_SIZE = 20;

export const useLeads = (f: LeadFilters, enabled = true) =>
  useQuery({
    queryKey: ['leads', 'list', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<LeadDto>>('/leads', {
        query: {
          page: f.page,
          pageSize: PAGE_SIZE,
          search: f.search,
          status: f.status,
          source: f.source,
          assignedTo: f.assignedTo,
          stuck: f.stuck ? 'true' : undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useLead = (id: string) =>
  useQuery({
    queryKey: ['leads', 'detail', id],
    queryFn: ({ signal }) => api<LeadDto>(`/leads/${id}`, { signal }),
  });

export const useLeadTimeline = (id: string) =>
  useQuery({
    queryKey: ['leads', 'timeline', id],
    queryFn: ({ signal }) => api<LeadActivityDto[]>(`/leads/${id}/timeline`, { signal }),
  });

/** The "assign to" picker. `/identity/users` is Admin/HR only, so only mount this for Admin. */
export const useSalesUsers = (enabled: boolean) =>
  useQuery({
    queryKey: ['users', 'sales'],
    queryFn: ({ signal }) =>
      api<PaginatedDto<UserDto>>('/identity/users', {
        query: { role: 'SALES', active: 'true', pageSize: 100 },
        signal,
      }),
    enabled,
    staleTime: 5 * 60_000,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['leads'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateLead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateLeadBodyDto) => api<LeadDto>('/leads', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateLead(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: UpdateLeadBodyDto) =>
      api<LeadDto>(`/leads/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useChangeLeadStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: ChangeLeadStatusBodyDto & { id: string }) =>
      api<LeadDto>(`/leads/${id}/status`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useAssignLead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: AssignLeadBodyDto & { id: string }) =>
      api<LeadDto>(`/leads/${id}/assign`, { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export const useLeadCalls = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['leads', 'calls', id],
    queryFn: ({ signal }) => api<CallDto[]>(`/leads/${id}/calls`, { signal }),
    enabled,
  });

export const useLeadVisits = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['leads', 'visits', id],
    queryFn: ({ signal }) => api<VisitDto[]>(`/leads/${id}/visits`, { signal }),
    enabled,
  });

export const BOARD_PAGE_SIZE = 50;

/** One board column: its own paged query, so "load more" and the count are per column. */
export const useBoardColumn = (status: LeadStatus, f: LeadFilters) =>
  useInfiniteQuery({
    queryKey: ['leads', 'board', status, f.search, f.source, f.assignedTo, f.stuck],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api<PaginatedDto<LeadDto>>('/leads', {
        query: {
          page: pageParam,
          pageSize: BOARD_PAGE_SIZE,
          status,
          search: f.search,
          source: f.source,
          assignedTo: f.assignedTo,
          stuck: f.stuck ? 'true' : undefined,
        },
        signal,
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

/** A drag that needs no extra input: moves the card at once, rolls back (and says so) if the API refuses. */
export function useMoveLead() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ lead, to }: { lead: LeadDto; to: LeadStatus }) =>
      api<LeadDto>(`/leads/${lead.id}/status`, { method: 'POST', body: { status: to } }),
    onMutate: async ({ lead, to }) => {
      await qc.cancelQueries({ queryKey: ['leads', 'board'] });
      const snapshot = qc.getQueriesData<BoardData>({ queryKey: ['leads', 'board'] });
      const moved = movedLead(lead, to);
      for (const [key, data] of snapshot) {
        if (!data) continue;
        const column = key[2];
        if (column === lead.status) qc.setQueryData<BoardData>(key, removeFromBoard(data, lead.id));
        else if (column === to) qc.setQueryData<BoardData>(key, addToBoard(data, moved));
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: invalidate,
  });
}
