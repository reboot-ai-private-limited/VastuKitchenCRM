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
