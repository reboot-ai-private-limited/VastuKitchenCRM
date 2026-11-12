'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddCustomerBodyDto,
  CustomerDto,
  ImportCustomersBodyDto,
  ImportCustomersResultDto,
  PaginatedDto,
} from '@vastu/contracts';
import { api } from './client';

export const CUSTOMER_PAGE_SIZE = 24;
export const CUSTOMER_IMPORT_BATCH = 500;

export const useCustomers = (search: string, page: number) =>
  useQuery({
    queryKey: ['customers', 'list', search, page],
    queryFn: ({ signal }) =>
      api<PaginatedDto<CustomerDto>>('/customers', {
        query: { search: search || undefined, page, pageSize: CUSTOMER_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

export const useCustomer = (id: string) =>
  useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: ({ signal }) => api<CustomerDto>(`/customers/${id}`, { signal }),
  });

/** A customer is a lead too (their record), so lists of leads and the dashboard change with them. */
function useRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['customers'] }),
      qc.invalidateQueries({ queryKey: ['leads'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useAddCustomer() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: AddCustomerBodyDto) =>
      api<CustomerDto>('/customers', { method: 'POST', body }),
    onSuccess: refresh,
  });
}

/** One batch of at most 500 rows; the dialog sends bigger files as several, in order. */
export function useImportCustomersBatch() {
  return useMutation({
    mutationFn: (body: ImportCustomersBodyDto) =>
      api<ImportCustomersResultDto>('/customers/import', { method: 'POST', body }),
  });
}

export const useRefreshCustomers = useRefresh;

export function useStartNewProject(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => api<CustomerDto>(`/customers/${id}/new-project`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
