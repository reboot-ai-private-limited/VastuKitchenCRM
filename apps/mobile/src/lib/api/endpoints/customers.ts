import type { AddCustomerBodyDto, CustomerDto, PaginatedDto } from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const CUSTOMERS_PAGE_SIZE = 24;

function qs(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listCustomers = (page: number, search?: string, signal?: AbortSignal) =>
  request<PaginatedDto<CustomerDto>>(
    'GET',
    `/customers${qs({ page, pageSize: CUSTOMERS_PAGE_SIZE, search })}`,
    undefined,
    { signal },
  );

export const getCustomer = (customerId: string, signal?: AbortSignal) =>
  request<CustomerDto>('GET', `/customers/${encodeURIComponent(customerId)}`, undefined, { signal });

export const addCustomer = (body: AddCustomerBodyDto) =>
  request<CustomerDto>('POST', '/customers', body);

export const startNewCustomerProject = (customerId: string) =>
  request<CustomerDto>('POST', `/customers/${encodeURIComponent(customerId)}/new-project`, {});
