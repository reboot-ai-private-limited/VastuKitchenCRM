import type {
  AssignLeadBodyDto,
  UpdateLeadBodyDto,
  CallDto,
  ChangeLeadStatusBodyDto,
  CompleteLeadDesignBodyDto,
  CreateLeadBodyDto,
  LeadActivityDto,
  LeadDesignDto,
  LeadDto,
  LeadProductOfInterest,
  LeadSource,
  LeadStatus,
  PaginatedDto,
  RecordCallBodyDto,
  RecordVisitBodyDto,
  UploadTicketDto,
  VisitDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const LEADS_PAGE_SIZE = 20;

export type LeadsQuery = {
  page: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus;
  product?: LeadProductOfInterest | readonly LeadProductOfInterest[];
  stuck?: boolean;
  excludeLost?: boolean;
  source?: LeadSource | readonly LeadSource[];
  followUpDue?: boolean;
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
      product:
        q.product === undefined
          ? undefined
          : typeof q.product === 'string'
            ? q.product
            : q.product.length > 0
              ? q.product.join(',')
              : undefined,
      stuck: q.stuck === undefined ? undefined : String(q.stuck),
      excludeLost: q.excludeLost === undefined ? undefined : String(q.excludeLost),
      source:
        q.source === undefined
          ? undefined
          : typeof q.source === 'string'
            ? q.source
            : q.source.length > 0
              ? q.source.join(',')
              : undefined,
      followUpDue: q.followUpDue === undefined ? undefined : String(q.followUpDue),
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

export const recordCall = (id: string, body: RecordCallBodyDto) =>
  request<CallDto>('POST', `/leads/${encodeURIComponent(id)}/calls`, body);

export const listCalls = (id: string, signal?: AbortSignal) =>
  request<CallDto[]>('GET', `/leads/${encodeURIComponent(id)}/calls`, undefined, { signal });

export const recordVisit = (id: string, body: RecordVisitBodyDto) =>
  request<VisitDto>('POST', `/leads/${encodeURIComponent(id)}/visits`, body);

export const listVisits = (id: string, signal?: AbortSignal) =>
  request<VisitDto[]>('GET', `/leads/${encodeURIComponent(id)}/visits`, undefined, { signal });

export const updateLead = (id: string, body: UpdateLeadBodyDto) =>
  request<LeadDto>('PATCH', `/leads/${encodeURIComponent(id)}`, body);

export const assignLead = (id: string, body: AssignLeadBodyDto) =>
  request<LeadDto>('POST', `/leads/${encodeURIComponent(id)}/assign`, body);

/** One-time ticket to upload visit photos and videos for this lead. */
export const signVisitMedia = (id: string) =>
  request<UploadTicketDto>('POST', `/leads/${encodeURIComponent(id)}/visits/media-upload/sign`, {});

export const listDesigns = (id: string, signal?: AbortSignal) =>
  request<LeadDesignDto[]>('GET', `/leads/${encodeURIComponent(id)}/design`, undefined, { signal });

/** One-time ticket to upload design images, videos, or PDFs for this lead. */
export const signDesignMedia = (id: string) =>
  request<UploadTicketDto>('POST', `/leads/${encodeURIComponent(id)}/design/media-upload/sign`, {});

export const completeLeadDesign = (id: string, body: CompleteLeadDesignBodyDto) =>
  request<LeadDesignDto>('POST', `/leads/${encodeURIComponent(id)}/design/complete`, body);
