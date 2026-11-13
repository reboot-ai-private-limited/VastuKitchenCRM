import type {
  CreateProposalBodyDto,
  UpdateProposalBodyDto,
  PaginatedDto,
  ProposalDto,
  ProposalStatus,
  SendProposalResponseDto,
  SendProposalWhatsappBodyDto,
  SendProposalWhatsappResponseDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const PROPOSALS_PAGE_SIZE = 20;

export type ProposalsQuery = {
  page: number;
  status?: ProposalStatus;
  leadId?: string;
};

function qs(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listProposals = (q: ProposalsQuery, signal?: AbortSignal) =>
  request<PaginatedDto<ProposalDto>>(
    'GET',
    `/proposals${qs({ page: q.page, pageSize: PROPOSALS_PAGE_SIZE, status: q.status, leadId: q.leadId })}`,
    undefined,
    { signal },
  );

export const getProposal = (id: string, signal?: AbortSignal) =>
  request<ProposalDto>('GET', `/proposals/${encodeURIComponent(id)}`, undefined, { signal });

export const sendProposal = (id: string) =>
  request<SendProposalResponseDto>('POST', `/proposals/${encodeURIComponent(id)}/send`, {});

export const sendProposalWhatsapp = (id: string, body: SendProposalWhatsappBodyDto = {}) =>
  request<SendProposalWhatsappResponseDto>(
    'POST',
    `/proposals/${encodeURIComponent(id)}/send-whatsapp`,
    body,
  );

/** Copies a (possibly frozen) proposal into a new DRAFT with its own number and link. */
export const duplicateProposal = (id: string) =>
  request<ProposalDto>('POST', `/proposals/${encodeURIComponent(id)}/duplicate`, {});

export const createProposal = (body: CreateProposalBodyDto) =>
  request<ProposalDto>('POST', '/proposals', body);

/** Drafts only. */
export const updateProposal = (id: string, body: UpdateProposalBodyDto) =>
  request<ProposalDto>('PATCH', `/proposals/${encodeURIComponent(id)}`, body);
