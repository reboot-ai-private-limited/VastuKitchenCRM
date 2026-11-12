import type {
  CommentDto,
  CreateCommentBodyDto,
  CreatePostBodyDto,
  DesignStage,
  PaginatedDto,
  PostDto,
  PostPageDto,
  PostVisibility,
  ProjectDto,
  ProjectStage,
  TimelinePageDto,
  TodoDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const PROJECTS_PAGE_SIZE = 20;

export type ProjectsQuery = {
  page: number;
  pageSize?: number;
  search?: string;
  stage?: ProjectStage;
  designStage?: DesignStage;
  designerId?: string;
};

function qs(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listProjects = (q: ProjectsQuery, signal?: AbortSignal) =>
  request<PaginatedDto<ProjectDto>>(
    'GET',
    `/projects${qs({
      page: q.page,
      pageSize: q.pageSize ?? PROJECTS_PAGE_SIZE,
      search: q.search,
      stage: q.stage,
      designStage: q.designStage,
      designerId: q.designerId,
    })}`,
    undefined,
    { signal },
  );

export const getProject = (id: string, signal?: AbortSignal) =>
  request<ProjectDto>('GET', `/projects/${encodeURIComponent(id)}`, undefined, { signal });

export const listPosts = (
  id: string,
  before?: string,
  signal?: AbortSignal,
  visibility?: PostVisibility,
  limit = 20,
) =>
  request<PostPageDto>(
    'GET',
    `/projects/${encodeURIComponent(id)}/posts${qs({ before, limit, visibility })}`,
    undefined,
    { signal },
  );

export const createPost = (id: string, body: CreatePostBodyDto) =>
  request<PostDto>('POST', `/projects/${encodeURIComponent(id)}/posts`, body);

export const approvePost = (projectId: string, postId: string) =>
  request<PostDto>(
    'POST',
    `/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}/approve`,
    {},
  );

export const createComment = (projectId: string, postId: string, body: CreateCommentBodyDto) =>
  request<CommentDto>(
    'POST',
    `/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}/comments`,
    body,
  );

export const getTimeline = (id: string, before?: string, signal?: AbortSignal, limit = 30) =>
  request<TimelinePageDto>(
    'GET',
    `/projects/${encodeURIComponent(id)}/timeline${qs({ before, limit })}`,
    undefined,
    { signal },
  );

export const listComments = (projectId: string, postId: string, signal?: AbortSignal) =>
  request<CommentDto[]>(
    'GET',
    `/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}/comments`,
    undefined,
    { signal },
  );

export const deletePost = (projectId: string, postId: string) =>
  request<unknown>('DELETE', `/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}`);

export const deleteComment = (projectId: string, postId: string, commentId: string) =>
  request<unknown>(
    'DELETE',
    `/projects/${encodeURIComponent(projectId)}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
  );

export const changeStage = (id: string, stage: 'DESIGN' | 'SITE') =>
  request<ProjectDto>('POST', `/projects/${encodeURIComponent(id)}/stage`, { stage });

export const changeDesignStage = (id: string, designStage: DesignStage) =>
  request<ProjectDto>('PATCH', `/projects/${encodeURIComponent(id)}/design-stage`, { designStage });

export const closeProject = (id: string) =>
  request<ProjectDto>('POST', `/projects/${encodeURIComponent(id)}/close`, {});

export const inviteCustomer = (customerId: string) =>
  request<{ url: string; expiresAt: string }>(
    'POST',
    `/identity/customers/${encodeURIComponent(customerId)}/invite`,
    {},
  );

export const listProjectTodos = (
  projectId: string,
  status: 'open' | 'done' | 'all' = 'open',
  signal?: AbortSignal,
) =>
  request<TodoDto[]>(
    'GET',
    `/projects/${encodeURIComponent(projectId)}/todos${qs({ status })}`,
    undefined,
    { signal },
  );
