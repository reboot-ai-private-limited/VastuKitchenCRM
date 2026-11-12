import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProposalDto, ProposalStatus, SendProposalWhatsappBodyDto } from '@vastu/contracts';
import {
  duplicateProposal,
  getProposal,
  listProposals,
  sendProposal,
  sendProposalWhatsapp,
} from '@/lib/api/endpoints/proposals';

export const useProposalsList = (status?: ProposalStatus) =>
  useInfiniteQuery({
    queryKey: ['proposals', 'list', { status }],
    queryFn: ({ pageParam, signal }) => listProposals({ page: pageParam, status }, signal),
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
  return useMutation({
    mutationFn: (body: SendProposalWhatsappBodyDto) => sendProposalWhatsapp(id, body),
    onSuccess: (res) => after(res.proposal),
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
