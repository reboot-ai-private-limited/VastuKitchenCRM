import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCommentBodyDto, CreatePostBodyDto, ProjectStage } from '@vastu/contracts';
import { createComment, createPost, getProject, listPosts, listProjects } from '@/lib/api/endpoints/projects';

export const useProjectsList = (search: string, stage?: ProjectStage) =>
  useInfiniteQuery({
    queryKey: ['projects', 'list', { search, stage }],
    queryFn: ({ pageParam, signal }) =>
      listProjects({ page: pageParam, search: search || undefined, stage }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

export const useProjectDetail = (id: string) =>
  useQuery({ queryKey: ['projects', 'detail', id], queryFn: ({ signal }) => getProject(id, signal) });

export const useProjectPosts = (id: string) =>
  useInfiniteQuery({
    queryKey: ['projects', 'posts', id],
    queryFn: ({ pageParam, signal }) => listPosts(id, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

export function useCreatePost(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePostBodyDto) => createPost(projectId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] }),
  });
}

export function useCreateComment(projectId: string, postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommentBodyDto) => createComment(projectId, postId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] }),
  });
}
