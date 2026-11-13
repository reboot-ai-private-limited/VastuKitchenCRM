import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComplaintStatus, ImageInputDto, RaiseComplaintBodyDto } from '@vastu/contracts';
import {
  addComment,
  assignComplaint,
  deleteComplaintComment,
  closeComplaint,
  getComplaint,
  listComplaints,
  raiseComplaint,
  reopenComplaint,
  resolveComplaint,
} from '@/lib/api/endpoints/complaints';

export const useComplaintsList = (status?: ComplaintStatus, projectId?: string) =>
  useInfiniteQuery({
    queryKey: ['complaints', 'list', { status, projectId }],
    queryFn: ({ pageParam, signal }) =>
      listComplaints({ page: pageParam, status, projectId }, undefined, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((c) => !seen.has(c.id) && seen.add(c.id));
    },
  });

export const useComplaintDetail = (id: string) =>
  useQuery({ queryKey: ['complaints', 'detail', id], queryFn: ({ signal }) => getComplaint(id, signal) });

export function useRaiseComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RaiseComplaintBodyDto) => raiseComplaint(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['complaints'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export type ComplaintAction = 'comment' | 'resolve' | 'reopen' | 'close';

/** One mutation for every write; the server's `can{}` decides which are offered. */
export function useComplaintAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      text,
      images,
    }: {
      action: ComplaintAction;
      text: string;
      images?: ImageInputDto[];
    }) => {
      switch (action) {
        case 'comment':
          return addComment(id, text, images);
        case 'resolve':
          return resolveComplaint(id, text, images);
        case 'reopen':
          return reopenComplaint(id, text);
        case 'close':
          return closeComplaint(id, text || undefined);
      }
    },
    // 409 means someone else just changed it: refetch either way.
    onSettled: () => void qc.invalidateQueries({ queryKey: ['complaints'] }),
  });
}

export function useAssignComplaint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assigneeId: string) => assignComplaint(id, assigneeId),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['complaints'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteComplaintComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComplaintComment(id, commentId),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['complaints', 'detail', id] }),
  });
}
