'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CommentDto,
  CreateCommentBodyDto,
  CreatePostBodyDto,
  CreateProjectBodyDto,
  DesignStage,
  LeadActivityDto,
  PaginatedDto,
  PostDto,
  PostPageDto,
  PostVisibility,
  ProjectDto,
  SetMembersBodyDto,
  TimelinePageDto,
  UpdateProjectBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
import type { ProjectFilters } from '@/lib/projects';
import { api } from './client';

export const PROJECT_PAGE_SIZE = 12;

export const useProjects = (f: ProjectFilters, enabled = true) =>
  useQuery({
    queryKey: ['projects', 'list', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ProjectDto>>('/projects', {
        query: {
          page: f.page,
          pageSize: PROJECT_PAGE_SIZE,
          search: f.search,
          stage: f.stage,
          designStage: f.designStage,
          designerId: f.designerId,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled,
  });

/** Projects of one lead: a summary any lead owner may list (never the feeds). */
export const useLeadProjects = (leadId: string, enabled = true) =>
  useQuery({
    queryKey: ['projects', 'lead', leadId],
    queryFn: ({ signal }) =>
      api<PaginatedDto<ProjectDto>>('/projects', { query: { leadId, pageSize: 20 }, signal }),
    enabled,
  });

export const useProject = (id: string) =>
  useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: ({ signal }) => api<ProjectDto>(`/projects/${id}`, { signal }),
  });

export const useJourney = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['projects', 'journey', id],
    queryFn: ({ signal }) => api<LeadActivityDto[]>(`/projects/${id}/journey`, { signal }),
    enabled,
    retry: false,
  });

/** One feed tab, newest first, "Load older" via the cursor. */
export const usePosts = (id: string, visibility: PostVisibility) =>
  useInfiniteQuery({
    queryKey: ['projects', 'posts', id, visibility],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api<PostPageDto>(`/projects/${id}/posts`, {
        query: { visibility, before: pageParam, limit: 20 },
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useTimeline = (id: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['projects', 'timeline', id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api<TimelinePageDto>(`/projects/${id}/timeline`, {
        query: { before: pageParam, limit: 30 },
        signal,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

export const useComments = (projectId: string, postId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['projects', 'comments', projectId, postId],
    queryFn: ({ signal }) =>
      api<CommentDto[]>(`/projects/${projectId}/posts/${postId}/comments`, { signal }),
    enabled,
  });

/** Staff for the members picker. `/identity/users` is Admin/HR only: mount this for Admin only. */
export const useStaffUsers = (enabled: boolean) =>
  useQuery({
    queryKey: ['users', 'staff'],
    queryFn: ({ signal }) =>
      api<PaginatedDto<import('@vastu/contracts').UserDto>>('/identity/users', {
        query: { active: 'true', pageSize: 100 },
        signal,
      }),
    enabled,
    staleTime: 5 * 60_000,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: id ? ['projects', 'detail', id] : ['projects'] }),
      qc.invalidateQueries({ queryKey: ['projects', 'list'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['projects', 'timeline'] }),
    ]);
}

export function useCreateProject() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: CreateProjectBodyDto) =>
      api<ProjectDto>('/projects', { method: 'POST', body }),
    onSuccess: () => inv(),
  });
}
export function useUpdateProject(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: UpdateProjectBodyDto) =>
      api<ProjectDto>(`/projects/${id}`, { method: 'PATCH', body }),
    onSuccess: () => inv(id),
  });
}
export function useSetMembers(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: SetMembersBodyDto) =>
      api<ProjectDto>(`/projects/${id}/members`, { method: 'PUT', body }),
    onSuccess: () => inv(id),
  });
}
/** Also reopens a closed project. */
export function useChangeStage(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (stage: 'DESIGN' | 'SITE') =>
      api<ProjectDto>(`/projects/${id}/stage`, { method: 'POST', body: { stage } }),
    onSuccess: () => inv(id),
  });
}
export function useChangeDesignStage(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (designStage: DesignStage) =>
      api<ProjectDto>(`/projects/${id}/design-stage`, { method: 'PATCH', body: { designStage } }),
    onSuccess: () => inv(id),
  });
}
export function useCloseProject(id: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: () => api<ProjectDto>(`/projects/${id}/close`, { method: 'POST' }),
    onSuccess: () => inv(id),
  });
}
export function useInviteCustomer() {
  return useMutation({
    mutationFn: (customerId: string) =>
      api<{ url: string; expiresAt: string }>(`/identity/customers/${customerId}/invite`, {
        method: 'POST',
      }),
  });
}

export function useSignUpload(id: string) {
  return useMutation({
    mutationFn: () =>
      api<UploadTicketDto>(`/projects/${id}/uploads/sign`, { method: 'POST', body: {} }),
  });
}

function usePostMutations(id: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['projects', 'posts', id] }),
      qc.invalidateQueries({ queryKey: ['projects', 'timeline', id] }),
    ]);
  return { qc, refresh };
}
export function useCreatePost(id: string) {
  const { refresh } = usePostMutations(id);
  return useMutation({
    mutationFn: (body: Partial<CreatePostBodyDto>) =>
      api<PostDto>(`/projects/${id}/posts`, { method: 'POST', body }),
    onSuccess: refresh,
  });
}
export function useDeletePost(id: string) {
  const { refresh } = usePostMutations(id);
  return useMutation({
    mutationFn: (postId: string) => api(`/projects/${id}/posts/${postId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}
export function useApprovePost(id: string) {
  const { refresh } = usePostMutations(id);
  return useMutation({
    mutationFn: (postId: string) =>
      api(`/projects/${id}/posts/${postId}/approve`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
export function useCreateComment(id: string, postId: string) {
  const { qc, refresh } = usePostMutations(id);
  return useMutation({
    mutationFn: (body: CreateCommentBodyDto) =>
      api<CommentDto>(`/projects/${id}/posts/${postId}/comments`, { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['projects', 'comments', id, postId] });
      await refresh();
    },
  });
}
export function useDeleteComment(id: string, postId: string) {
  const { qc, refresh } = usePostMutations(id);
  return useMutation({
    mutationFn: (commentId: string) =>
      api(`/projects/${id}/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['projects', 'comments', id, postId] });
      await refresh();
    },
  });
}
