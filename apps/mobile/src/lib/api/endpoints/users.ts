import type {
  CreateDesignationBodyDto,
  CreateUserBodyDto,
  CustomerInviteDto,
  CustomerPhonesDto,
  DesignationDto,
  PaginatedDto,
  RoleName,
  SetTargetBodyDto,
  SetUserPasswordBodyDto,
  TargetsSheetDto,
  UpdateDesignationBodyDto,
  UpdateUserBodyDto,
  UserDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type UsersQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: RoleName;
  /** `null` returns both active and deactivated users; `undefined` defaults to `true`. */
  active?: boolean | null;
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
      active: q.active === null ? undefined : q.active === undefined ? 'true' : String(q.active),
    })}`,
    undefined,
    { signal },
  );

export const createUser = (body: CreateUserBodyDto) =>
  request<UserDto>('POST', '/identity/users', body);

export const updateUser = (id: string, body: UpdateUserBodyDto) =>
  request<UserDto>('PATCH', `/identity/users/${encodeURIComponent(id)}`, body);

export const setUserPassword = (id: string, body: SetUserPasswordBodyDto) =>
  request<UserDto>('PUT', `/identity/users/${encodeURIComponent(id)}/password`, body);

export const listDesignations = (includeInactive = false, signal?: AbortSignal) =>
  request<DesignationDto[]>(
    'GET',
    `/identity/designations${includeInactive ? '?includeInactive=true' : ''}`,
    undefined,
    { signal },
  );

export const createDesignation = (body: CreateDesignationBodyDto) =>
  request<DesignationDto>('POST', '/identity/designations', body);

export const updateDesignation = (id: string, body: UpdateDesignationBodyDto) =>
  request<DesignationDto>('PATCH', `/identity/designations/${encodeURIComponent(id)}`, body);

export const getTargetsSheet = (month: string, signal?: AbortSignal) =>
  request<TargetsSheetDto>('GET', `/targets/${encodeURIComponent(month)}`, undefined, { signal });

export const setUserTarget = (month: string, userId: string, body: SetTargetBodyDto) =>
  request<TargetsSheetDto>(
    'PUT',
    `/targets/${encodeURIComponent(month)}/users/${encodeURIComponent(userId)}`,
    body,
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
