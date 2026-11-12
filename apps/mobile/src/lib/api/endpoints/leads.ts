import type {
  ChangeLeadStatusBodyDto,
  CreateLeadBodyDto,
  LeadActivityDto,
  LeadDto,
  LeadStatus,
  PaginatedDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const LEADS_PAGE_SIZE = 20;

export type LeadsQuery = {
  page: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus;
  stuck?: boolean;
  assignedTo?: string;
};

function qs(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listLeads = (q: LeadsQuery, signal?: AbortSignal) =>
  request<PaginatedDto<LeadDto>>(
    'GET',
    `/leads${qs({
      page: q.page,
      pageSize: q.pageSize ?? LEADS_PAGE_SIZE,
      search: q.search,
      status: q.status,
      stuck: q.stuck === undefined ? undefined : String(q.stuck),
      assignedTo: q.assignedTo,
    })}`,
    undefined,
    { signal },
  );

export const getLead = (id: string, signal?: AbortSignal) =>
  request<LeadDto>('GET', `/leads/${encodeURIComponent(id)}`, undefined, { signal });

export const getLeadTimeline = (id: string, signal?: AbortSignal) =>
  request<LeadActivityDto[]>('GET', `/leads/${encodeURIComponent(id)}/timeline`, undefined, { signal });

export const createLead = (body: CreateLeadBodyDto) =>
  request<LeadDto>('POST', '/leads', body);

export const changeLeadStatus = (id: string, body: ChangeLeadStatusBodyDto) =>
  request<LeadDto>('POST', `/leads/${encodeURIComponent(id)}/status`, body);
