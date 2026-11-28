import type {
  CustomerInviteDto,
  CustomerPhonesDto,
  PaginatedDto,
  RoleName,
  UserDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type UsersQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: RoleName;
  active?: boolean;
};

function qs(params: Record<string, string | number | boolean | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listUsers = (q: UsersQuery = {}, signal?: AbortSignal) =>
  request<PaginatedDto<UserDto>>(
    'GET',
    `/identity/users${qs({
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 50,
      search: q.search,
      role: q.role,
      active: q.active === undefined ? 'true' : String(q.active),
    })}`,
    undefined,
    { signal },
  );

export const createCustomerInvite = (customerId: string) =>
  request<CustomerInviteDto>('POST', `/identity/customers/${encodeURIComponent(customerId)}/invite`, {});

export const getCustomerPhones = (customerId: string, signal?: AbortSignal) =>
  request<CustomerPhonesDto>(
    'GET',
    `/identity/customers/${encodeURIComponent(customerId)}/phones`,
    undefined,
    { signal },
  );

export const addCustomerPhone = (customerId: string, phone: string) =>
  request<CustomerPhonesDto>(
    'POST',
    `/identity/customers/${encodeURIComponent(customerId)}/phones`,
    { phone },
  );

export const removeCustomerPhone = (customerId: string, phone: string) =>
  request<CustomerPhonesDto>(
    'DELETE',
    `/identity/customers/${encodeURIComponent(customerId)}/phones/${encodeURIComponent(phone)}`,
  );
