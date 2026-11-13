import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComplaintDto,
  CreateCommentBodyDto,
  CreatePostBodyDto,
  DesignStage,
  ProjectStage,
  TimelineItemDto,
} from '@vastu/contracts';
import { listComplaints } from '@/lib/api/endpoints/complaints';
import { listProjectFiles, saveFromPhotos } from '@/lib/api/endpoints/docs';
import {
  approvePost,
  changeDesignStage,
  changeStage,
  closeProject,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getProject,
  getTimeline,
  inviteCustomer,
  listComments,
  listPosts,
  listProjects,
  listProjectTodos,
} from '@/lib/api/endpoints/projects';

/** The list asks for the server maximum (100) per page; the screen pages further on demand. */
const LIST_PAGE_SIZE = 100;
export const FEED_POLL_MS = 15_000;
export const COMPLAINTS_POLL_MS = 45_000;

export const useProjectsList = (search: string, stage?: ProjectStage) =>
  useInfiniteQuery({
    queryKey: ['projects', 'list', { search, stage }],
    queryFn: ({ pageParam, signal }) =>
      listProjects({ page: pageParam, pageSize: LIST_PAGE_SIZE, search: search || undefined, stage }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

export const useProjectDetail = (id: string) =>
  useQuery({ queryKey: ['projects', 'detail', id], queryFn: ({ signal }) => getProject(id, signal) });

/** True while the screen is focused and the app is in the foreground: the only time we poll. */
export function useScreenActive(): boolean {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

export type FeedMode = 'ALL' | 'CLIENT';

const itemKey = (i: TimelineItemDto) => (i.kind === 'POST' ? `p:${i.post.id}` : `a:${i.activity.id}`);

async function fetchFeedPage(id: string, mode: FeedMode, before: string | undefined, signal?: AbortSignal) {
  if (mode === 'ALL') return getTimeline(id, before, signal, 30);
  const page = await listPosts(id, before, signal, 'CLIENT', 20);
  return {
    items: page.items.map((post): TimelineItemDto => ({ kind: 'POST', at: post.createdAt, post })),
    nextCursor: page.nextCursor,
  };
}

/**
 * The chat feed, newest first. `ALL` = timeline (posts + team activity), `CLIENT` = what the customer sees.
 * Older pages are loaded with the `before` cursor; page 1 is re-read every 15 s while the screen is active
 * and merged in by id, so polling never disturbs the older pages.
 */
export function useChatFeed(id: string, mode: FeedMode, active: boolean) {
  const base = ['projects', 'posts', id, mode] as const;
  const pages = useInfiniteQuery({
    queryKey: [...base, 'pages'],
    queryFn: ({ pageParam, signal }) => fetchFeedPage(id, mode, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const latest = useQuery({
    queryKey: [...base, 'latest'],
    queryFn: ({ signal }) => fetchFeedPage(id, mode, undefined, signal),
    refetchInterval: active ? FEED_POLL_MS : false,
    refetchOnMount: 'always',
  });

  const items = useMemo(() => {
    const map = new Map<string, TimelineItemDto>();
    for (const i of latest.data?.items ?? []) map.set(itemKey(i), i);
    for (const pg of pages.data?.pages ?? []) for (const i of pg.items) if (!map.has(itemKey(i))) map.set(itemKey(i), i);
    return [...map.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [latest.data, pages.data]);

  return {
    items,
    isPending: pages.isPending && latest.isPending,
    isError: pages.isError && latest.isError,
    hasNextPage: pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    fetchNextPage: () => void pages.fetchNextPage(),
    refetch: async () => {
      await Promise.all([latest.refetch(), pages.refetch()]);
    },
    isRefetching: latest.isRefetching,
  };
}

/** Complaint cards for the chat. Page size 100, following pages while some remain (cap 5 pages). */
export const useProjectComplaints = (id: string, active: boolean) =>
  useQuery({
    queryKey: ['projects', 'complaints', id],
    queryFn: async ({ signal }): Promise<ComplaintDto[]> => {
      const all: ComplaintDto[] = [];
      for (let page = 1; page <= 5; page++) {
        const res = await listComplaints({ page, pageSize: 100, projectId: id }, undefined, signal);
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0) break;
      }
      return all;
    },
    refetchInterval: active ? COMPLAINTS_POLL_MS : false,
  });

export const useProjectTodos = (id: string, status: 'open' | 'done' | 'all') =>
  useQuery({
    queryKey: ['projects', 'todos', id, status],
    queryFn: ({ signal }) => listProjectTodos(id, status, signal),
  });

export const useProjectFiles = (id: string) =>
  useQuery({ queryKey: ['projects', 'files', id], queryFn: ({ signal }) => listProjectFiles(id, {}, signal) });

export const usePostComments = (projectId: string, postId: string | null) =>
  useQuery({
    queryKey: ['projects', 'comments', projectId, postId],
    queryFn: ({ signal }) => listComments(projectId, postId as string, signal),
    enabled: !!postId,
  });

function useInvalidateFeed(projectId: string) {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] });
    void qc.invalidateQueries({ queryKey: ['projects', 'comments', projectId] });
  }, [qc, projectId]);
}

/**
 * Sends one post straight to the API. This is the single entry point for sending a post:
 * the offline agent can replace the body with an outbox enqueue without touching any screen.
 */
export function useCreatePost(projectId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({
    // TODO(outbox): enqueue the post (with its uploaded images) instead of sending directly.
    mutationFn: (body: CreatePostBodyDto) => createPost(projectId, body),
    onSuccess: invalidate,
  });
}

export function useCreateComment(projectId: string, postId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({
    // TODO(outbox): enqueue the reply instead of sending directly.
    mutationFn: (body: CreateCommentBodyDto) => createComment(projectId, postId, body),
    onSuccess: invalidate,
  });
}

export function useSaveToDocs(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof saveFromPhotos>[1]) => saveFromPhotos(projectId, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects', 'files', projectId] }),
  });
}

export function useDeletePost(projectId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({ mutationFn: (postId: string) => deletePost(projectId, postId), onSuccess: invalidate });
}

export function useDeleteComment(projectId: string, postId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(projectId, postId, commentId),
    onSuccess: invalidate,
  });
}

export function useApprovePost(projectId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({ mutationFn: (postId: string) => approvePost(projectId, postId), onSuccess: invalidate });
}

function useProjectChange<V>(projectId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects', 'detail', projectId] });
      void qc.invalidateQueries({ queryKey: ['projects', 'list'] });
      void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] });
    },
  });
}

export const useChangeStage = (id: string) => useProjectChange(id, (s: 'DESIGN' | 'SITE') => changeStage(id, s));
export const useChangeDesignStage = (id: string) =>
  useProjectChange(id, (s: DesignStage) => changeDesignStage(id, s));
export const useCloseProject = (id: string) => useProjectChange(id, () => closeProject(id));
export const useInviteCustomer = () => useMutation({ mutationFn: (customerId: string) => inviteCustomer(customerId) });

