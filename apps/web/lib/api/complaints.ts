'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddComplaintCommentBodyDto,
  AssignComplaintBodyDto,
  CloseComplaintBodyDto,
  ComplaintCountsDto,
  ComplaintDto,
  PaginatedDto,
  ProjectDto,
  RaiseComplaintBodyDto,
  ReopenComplaintBodyDto,
  ResolveComplaintBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
import type { ComplaintFilters } from '@/lib/complaints';
import { api } from './client';

export const COMPLAINT_PAGE_SIZE = 20;

export const useComplaints = (f: ComplaintFilters) =>
  useQuery({
    queryKey: ['complaints', 'list', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ComplaintDto>>('/complaints', {
        query: {
          page: f.page,
          pageSize: COMPLAINT_PAGE_SIZE,
          status: f.status,
          projectId: f.projectId,
          assignedTo: f.mine ? 'me' : undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

/** Every complaint the caller may see (up to 100), for the grouped page: no paging, filtered on the server by who/where. */
export const useComplaintsAll = (f: Pick<ComplaintFilters, 'mine' | 'projectId'>) =>
  useQuery({
    queryKey: ['complaints', 'list', 'all', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ComplaintDto>>('/complaints', {
        query: {
          pageSize: 100,
          projectId: f.projectId,
          assignedTo: f.mine ? 'me' : undefined,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

export const useComplaintCounts = () =>
  useQuery({
    queryKey: ['complaints', 'counts'],
    queryFn: ({ signal }) => api<ComplaintCountsDto>('/complaints/counts', { signal }),
  });

export const useComplaint = (id: string) =>
  useQuery({
    queryKey: ['complaints', 'detail', id],
    queryFn: ({ signal }) => api<ComplaintDto>(`/complaints/${id}`, { signal }),
  });

/** Projects the caller may see, for the raise dialog and the project filter. */
export const useProjectOptions = (enabled = true) =>
  useQuery({
    queryKey: ['complaints', 'project-options'],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ProjectDto>>('/projects', { query: { pageSize: 100 }, signal }),
    enabled,
    staleTime: 60_000,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['complaints'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['projects', 'timeline'] }),
    ]);
}

export function useRaiseComplaint() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: RaiseComplaintBodyDto) =>
      api<ComplaintDto>('/complaints', { method: 'POST', body }),
    onSuccess: inv,
  });
}

const act =
  <B>(id: string, verb: 'assign' | 'resolve' | 'reopen' | 'close') =>
  (body: B) =>
    api<ComplaintDto>(`/complaints/${id}/${verb}`, { method: 'POST', body });

export function useAssignComplaint(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: act<AssignComplaintBodyDto>(id, 'assign'), onSuccess: inv });
}
export function useResolveComplaint(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: act<ResolveComplaintBodyDto>(id, 'resolve'), onSuccess: inv });
}
export function useReopenComplaint(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: act<ReopenComplaintBodyDto>(id, 'reopen'), onSuccess: inv });
}
export function useCloseComplaint(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: act<CloseComplaintBodyDto>(id, 'close'), onSuccess: inv });
}

/** After a 409 the other side already moved on: pull the latest so buttons match reality. */
export function useRefreshComplaint(id: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['complaints', 'detail', id] }),
      qc.invalidateQueries({ queryKey: ['complaints', 'list'] }),
      qc.invalidateQueries({ queryKey: ['complaints', 'counts'] }),
    ]);
}

export const signRaiseUpload = (projectId: string) =>
  api<UploadTicketDto>('/complaints/uploads/sign', { method: 'POST', body: { projectId } });
export const signResolveUpload = (complaintId: string) =>
  api<UploadTicketDto>(`/complaints/${complaintId}/uploads/sign`, { method: 'POST', body: {} });

/** The conversation: the API answers with the whole complaint, so every view of it refreshes together. */
function afterComplaintChange(qc: ReturnType<typeof useQueryClient>, id: string) {
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['complaints', 'detail', id] }),
      qc.invalidateQueries({ queryKey: ['complaints', 'list'] }),
    ]);
}

export function useAddComplaintComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddComplaintCommentBodyDto) =>
      api<ComplaintDto>(`/complaints/${id}/comments`, { method: 'POST', body }),
    onSuccess: afterComplaintChange(qc, id),
  });
}

export function useDeleteComplaintComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api<ComplaintDto>(`/complaints/${id}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: afterComplaintChange(qc, id),
  });
}
