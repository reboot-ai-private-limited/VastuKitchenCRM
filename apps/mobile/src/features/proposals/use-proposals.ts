import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProposalBodyDto, ProposalDto, ProposalStatus, UpdateProposalBodyDto, SendProposalWhatsappBodyDto } from '@vastu/contracts';
import {
  createProposal,
  deleteProposal,
  deleteProposalTemplate,
  duplicateProposal,
  duplicateProposalTemplate,
  getProposal,
  listProposals,
  listProposalTemplates,
  sendProposal,
  sendProposalWhatsapp,
  updateProposal,
} from '@/lib/api/endpoints/proposals';

export const useProposalsList = (status?: ProposalStatus, leadId?: string) =>
  useInfiniteQuery({
    queryKey: ['proposals', 'list', { status, leadId }],
    queryFn: ({ pageParam, signal }) => listProposals({ page: pageParam, status, leadId }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

export const useProposalDetail = (id: string) =>
  useQuery({
    queryKey: ['proposals', 'detail', id],
    queryFn: ({ signal }) => getProposal(id, signal),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'SENT' ? 30_000 : false),
  });

function useAfterSend(id: string) {
  const qc = useQueryClient();
  return (proposal: ProposalDto) => {
    qc.setQueryData(['proposals', 'detail', id], proposal);
    void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/** Marks a draft as sent (freezing it) and returns the share link. */
export function useSendProposal(id: string) {
  const after = useAfterSend(id);
  return useMutation({
    mutationFn: () => sendProposal(id),
    onSuccess: (res) => after(res.proposal),
  });
}

export function useSendProposalWhatsapp(id: string) {
  const after = useAfterSend(id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendProposalWhatsappBodyDto) => sendProposalWhatsapp(id, body),
    onSuccess: (res) => after(res.proposal),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['proposals', 'detail', id] });
      void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProposal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['proposals'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useProposalTemplates = () =>
  useQuery({
    queryKey: ['proposal-templates', 'list'],
    queryFn: ({ signal }) => listProposalTemplates(signal),
    staleTime: 60_000,
  });

export function useDuplicateProposalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; name?: string }) => duplicateProposalTemplate(v.key, v.name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proposal-templates'] }),
  });
}

export function useDeleteProposalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => deleteProposalTemplate(key),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proposal-templates'] }),
  });
}

export function useDuplicateProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => duplicateProposal(id),
    onSuccess: (copy) => {
      qc.setQueryData(['proposals', 'detail', copy.id], copy);
      void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
    },
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProposalBodyDto) => createProposal(body),
    onSuccess: (p) => {
      qc.setQueryData(['proposals', 'detail', p.id], p);
      void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
    },
  });
}

export function useUpdateProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProposalBodyDto) => updateProposal(id, body),
    onSuccess: (p) => {
      qc.setQueryData(['proposals', 'detail', id], p);
      void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
    },
  });
}
