import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddCustomerBodyDto } from '@vastu/contracts';
import {
  addCustomer,
  getCustomer,
  listCustomers,
  startNewCustomerProject,
} from '@/lib/api/endpoints/customers';
import { getLeadTimeline } from '@/lib/api/endpoints/leads';
import { createCustomerInvite } from '@/lib/api/endpoints/users';

export const useCustomersList = (search: string) =>
  useInfiniteQuery({
    queryKey: ['customers', 'list', { search }],
    queryFn: ({ pageParam, signal }) => listCustomers(pageParam, search || undefined, signal),
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((c) => !seen.has(c.id) && seen.add(c.id));
    },
  });

export const useCustomerDetail = (id: string) =>
  useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: ({ signal }) => getCustomer(id, signal),
    enabled: !!id,
  });

export const useCustomerTimeline = (leadId?: string) =>
  useQuery({
    queryKey: ['leads', 'timeline', leadId],
    queryFn: ({ signal }) => getLeadTimeline(leadId!, signal),
    enabled: !!leadId,
  });

export function useAddCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddCustomerBodyDto) => addCustomer(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useStartNewProject(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startNewCustomerProject(customerId),
    onSuccess: (updated) => {
      qc.setQueryData(['customers', 'detail', customerId], updated);
      void qc.invalidateQueries({ queryKey: ['customers', 'list'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useInviteCustomer(customerId: string) {
  return useMutation({
    mutationFn: () => createCustomerInvite(customerId),
  });
}
