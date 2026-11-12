import type {
  ComplaintDto,
  ComplaintStatus,
  PaginatedDto,
  RaiseComplaintBodyDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type ComplaintsQuery = {
  page: number;
  pageSize?: number;
  status?: ComplaintStatus;
  projectId?: string;
  assignedTo?: string;
};

function qs(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listComplaints = (
  pageOrQuery: number | ComplaintsQuery,
  status?: ComplaintStatus,
  signal?: AbortSignal,
) => {
  const q: ComplaintsQuery =
    typeof pageOrQuery === 'number' ? { page: pageOrQuery, status } : pageOrQuery;
  return request<PaginatedDto<ComplaintDto>>(
    'GET',
    `/complaints${qs({
      page: q.page,
      pageSize: q.pageSize ?? 20,
      status: q.status,
      projectId: q.projectId,
      assignedTo: q.assignedTo,
    })}`,
    undefined,
    { signal },
  );
};

export const getComplaint = (id: string, signal?: AbortSignal) =>
  request<ComplaintDto>('GET', `/complaints/${encodeURIComponent(id)}`, undefined, { signal });

export const raiseComplaint = (body: RaiseComplaintBodyDto) =>
  request<ComplaintDto>('POST', '/complaints', body);

export const addComment = (id: string, text: string) =>
  request<unknown>('POST', `/complaints/${encodeURIComponent(id)}/comments`, { text });

export const resolveComplaint = (id: string, note: string) =>
  request<unknown>('POST', `/complaints/${encodeURIComponent(id)}/resolve`, { note });

export const reopenComplaint = (id: string, reason: string) =>
  request<unknown>('POST', `/complaints/${encodeURIComponent(id)}/reopen`, { reason });

export const closeComplaint = (id: string, note?: string) =>
  request<unknown>('POST', `/complaints/${encodeURIComponent(id)}/close`, note ? { note } : {});
