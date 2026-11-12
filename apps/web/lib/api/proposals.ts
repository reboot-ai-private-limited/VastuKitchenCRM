'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProposalBodyDto,
  PaginatedDto,
  ProposalDto,
  ProposalStatus,
  SendProposalResponseDto,
  SendProposalWhatsappBodyDto,
  SendProposalWhatsappResponseDto,
  UpdateProposalBodyDto,
} from '@vastu/contracts';
import { api } from './client';

export const PROPOSAL_PAGE_SIZE = 20;

export const useProposals = (f: {
  page: number;
  status: ProposalStatus | null;
  leadId?: string | null;
}) =>
  useQuery({
    queryKey: ['proposals', 'list', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ProposalDto>>('/proposals', {
        query: { page: f.page, pageSize: PROPOSAL_PAGE_SIZE, status: f.status, leadId: f.leadId },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

export const useProposal = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['proposals', 'detail', id],
    queryFn: ({ signal }) => api<ProposalDto>(`/proposals/${id}`, { signal }),
    enabled,
    // A sent proposal's "seen" panel should notice a customer opening it while this page is open.
    refetchInterval: (q) => (q.state.data?.status === 'SENT' ? 30_000 : false),
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['proposals'] }),
      qc.invalidateQueries({ queryKey: ['leads'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateProposalBodyDto) =>
      api<ProposalDto>('/proposals', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useUpdateProposal(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: UpdateProposalBodyDto) =>
      api<ProposalDto>(`/proposals/${id}`, { method: 'PATCH', body }),
    onSuccess: invalidate,
  });
}

export function useSendProposal(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => api<SendProposalResponseDto>(`/proposals/${id}/send`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/**
 * Sends the template message (and freezes a draft). Invalidates on failure too: the server freezes the
 * draft before it tries WhatsApp, so a failed send still changed the proposal.
 */
export function useSendProposalWhatsapp(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: SendProposalWhatsappBodyDto) =>
      api<SendProposalWhatsappResponseDto>(`/proposals/${id}/send-whatsapp`, {
        method: 'POST',
        body,
      }),
    onSettled: invalidate,
  });
}

export function useDuplicateProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<ProposalDto>(`/proposals/${id}/duplicate`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeleteProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api(`/proposals/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
