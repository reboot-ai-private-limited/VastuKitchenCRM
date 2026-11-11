'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignLeadBodyDto,
  CallDto,
  ChangeLeadStatusBodyDto,
  CreateLeadBodyDto,
  LeadActivityDto,
  LeadDto,
  PaginatedDto,
  UpdateLeadBodyDto,
  VisitDto,
  UserDto,
} from '@vastu/contracts';
import type { LeadFilters } from '@/lib/leads';
import { api } from './client';

export const PAGE_SIZE = 20;

export const useLeads = (f: LeadFilters) =>
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
    mutationFn: (body: UpdateLeadBodyDto) => api<LeadDto>(`/leads/${id}`, { method: 'PATCH', body }),
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
