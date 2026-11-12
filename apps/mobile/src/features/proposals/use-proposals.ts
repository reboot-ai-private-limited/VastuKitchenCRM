import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProposalStatus } from '@vastu/contracts';
import { getProposal, listProposals, sendProposal } from '@/lib/api/endpoints/proposals';

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

export function useSendProposal(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sendProposal(id),
    onSuccess: (res) => {
      qc.setQueryData(['proposals', 'detail', id], res.proposal);
      void qc.invalidateQueries({ queryKey: ['proposals', 'list'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
