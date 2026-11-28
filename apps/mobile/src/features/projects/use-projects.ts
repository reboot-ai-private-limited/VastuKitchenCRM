import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ComplaintDto,
  CreateCommentBodyDto,
  CreateFolderBodyDto,
  CreatePostBodyDto,
  CreateProjectBodyDto,
  CreateTodoBodyDto,
  DesignStage,
  ProjectStage,
  SetMembersBodyDto,
  TimelineItemDto,
  UpdateFileBodyDto,
  UpdateFolderBodyDto,
  UpdateProjectBodyDto,
  UpdateTodoBodyDto,
  UpdateTodoListBodyDto,
} from '@vastu/contracts';
import { listComplaints } from '@/lib/api/endpoints/complaints';
import {
  createProjectFolder,
  deleteFile,
  deleteFolder,
  listProjectFiles,
  listProjectFolders,
  saveFromPhotos,
  updateFile,
  updateFolder,
  type ProjectFilesQuery,
} from '@/lib/api/endpoints/docs';
import {
  approvePost,
  changeDesignStage,
  changeStage,
  closeProject,
  createComment,
  createPost,
  createProject,
  deleteComment,
  deletePost,
  getProject,
  getProjectJourney,
  getTimeline,
  inviteCustomer,
  listComments,
  listPosts,
  listProjects,
  listProjectTodos,
  setProjectMembers,
  updateProject,
} from '@/lib/api/endpoints/projects';
import {
  createTodo,
  createTodoList,
  deleteTodo,
  listProjectTodoLists,
  updateTodo,
  updateTodoList,
} from '@/lib/api/endpoints/todos';

/** The list asks for the server maximum (100) per page; the screen pages further on demand. */
const LIST_PAGE_SIZE = 100;
export const FEED_POLL_MS = 15_000;
export const COMPLAINTS_POLL_MS = 45_000;

export const useProjectsList = (
  search: string,
  stage?: ProjectStage,
  designStage?: DesignStage,
  designerId?: string,
) =>
  useInfiniteQuery({
    queryKey: ['projects', 'list', { search, stage, designStage, designerId }],
    queryFn: ({ pageParam, signal }) =>
      listProjects(
        {
          page: pageParam,
          pageSize: LIST_PAGE_SIZE,
          search: search || undefined,
          stage,
          designStage,
          designerId,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    select: (d) => {
      const seen = new Set<string>();
      return d.pages.flatMap((p) => p.items).filter((p) => !seen.has(p.id) && seen.add(p.id));
    },
  });

export const useProjectDetail = (id: string) =>
  useQuery({ queryKey: ['projects', 'detail', id], queryFn: ({ signal }) => getProject(id, signal) });

export const useProjectJourney = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['projects', 'journey', id],
    queryFn: ({ signal }) => getProjectJourney(id, signal),
    enabled,
    retry: false,
  });

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

/* ── Project To-dos ─────────────────────────────────────────────────────────── */

export const useProjectTodoLists = (id: string) =>
  useQuery({
    queryKey: ['projects', 'todo-lists', id],
    queryFn: ({ signal }) => listProjectTodoLists(id, signal),
  });

export const useProjectTodos = (id: string, status: 'open' | 'done' | 'all', assignedToMe = false) =>
  useQuery({
    queryKey: ['projects', 'todos', id, status, assignedToMe ? 'me' : 'all'],
    queryFn: ({ signal }) => listProjectTodos(id, status, signal, assignedToMe ? 'me' : undefined),
  });

function useInvalidateTodos(projectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['projects', 'todos', projectId] });
    void qc.invalidateQueries({ queryKey: ['projects', 'todo-lists', projectId] });
    void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] });
    void qc.invalidateQueries({ queryKey: ['todos'] });
  };
}

export function useCreateTodoList(projectId: string) {
  const inv = useInvalidateTodos(projectId);
  return useMutation({ mutationFn: (name: string) => createTodoList(projectId, name), onSuccess: inv });
}

export function useUpdateTodoList(projectId: string) {
  const inv = useInvalidateTodos(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTodoListBodyDto & { id: string }) => updateTodoList(id, body),
    onSuccess: inv,
  });
}

export function useCreateTodo(projectId: string) {
  const inv = useInvalidateTodos(projectId);
  return useMutation({
    mutationFn: ({ listId, ...body }: Partial<CreateTodoBodyDto> & { listId: string; title: string }) =>
      createTodo(listId, body),
    onSuccess: inv,
  });
}

export function useUpdateTodo(projectId: string) {
  const inv = useInvalidateTodos(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTodoBodyDto & { id: string }) => updateTodo(id, body),
    onSuccess: inv,
  });
}

export function useDeleteTodo(projectId: string) {
  const inv = useInvalidateTodos(projectId);
  return useMutation({ mutationFn: (todoId: string) => deleteTodo(todoId), onSuccess: inv });
}

/* ── Project Docs ───────────────────────────────────────────────────────────── */

export const useProjectFolders = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['projects', 'folders', id],
    queryFn: ({ signal }) => listProjectFolders(id, signal),
    enabled,
  });

export const useProjectFiles = (id: string, q: ProjectFilesQuery = {}) =>
  useQuery({
    queryKey: ['projects', 'files', id, q.folderId ?? null, q.search ?? '', q.shared ?? false],
    queryFn: ({ signal }) => listProjectFiles(id, q, signal),
  });

function useInvalidateDocs(projectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['projects', 'files', projectId] });
    void qc.invalidateQueries({ queryKey: ['projects', 'folders', projectId] });
    void qc.invalidateQueries({ queryKey: ['projects', 'posts', projectId] });
  };
}

export function useCreateFolder(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({
    mutationFn: (body: CreateFolderBodyDto) => createProjectFolder(projectId, body),
    onSuccess: inv,
  });
}

export function useUpdateFolder(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateFolderBodyDto & { id: string }) => updateFolder(id, body),
    onSuccess: inv,
  });
}

export function useDeleteFolder(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({ mutationFn: (folderId: string) => deleteFolder(folderId), onSuccess: inv });
}

export function useUpdateFile(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateFileBodyDto & { id: string }) => updateFile(id, body),
    onSuccess: inv,
  });
}

export function useDeleteFile(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({ mutationFn: (fileId: string) => deleteFile(fileId), onSuccess: inv });
}

export function useSaveToDocs(projectId: string) {
  const inv = useInvalidateDocs(projectId);
  return useMutation({
    mutationFn: (body: Parameters<typeof saveFromPhotos>[1]) => saveFromPhotos(projectId, body),
    onSuccess: inv,
  });
}

/* ── Posts & Comments ───────────────────────────────────────────────────────── */

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

export function useCreatePost(projectId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({
    mutationFn: (body: CreatePostBodyDto) => createPost(projectId, body),
    onSuccess: invalidate,
  });
}

export function useCreateComment(projectId: string, postId: string) {
  const invalidate = useInvalidateFeed(projectId);
  return useMutation({
    mutationFn: (body: CreateCommentBodyDto) => createComment(projectId, postId, body),
    onSuccess: invalidate,
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

/* ── Project Mutations ──────────────────────────────────────────────────────── */

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectBodyDto) => createProject(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
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

export const useUpdateProject = (id: string) =>
  useProjectChange(id, (body: UpdateProjectBodyDto) => updateProject(id, body));
export const useSetMembers = (id: string) =>
  useProjectChange(id, (body: SetMembersBodyDto) => setProjectMembers(id, body));
export const useChangeStage = (id: string) => useProjectChange(id, (s: 'DESIGN' | 'SITE') => changeStage(id, s));
export const useChangeDesignStage = (id: string) =>
  useProjectChange(id, (s: DesignStage) => changeDesignStage(id, s));
export const useCloseProject = (id: string) => useProjectChange(id, () => closeProject(id));
export const useInviteCustomer = () => useMutation({ mutationFn: (customerId: string) => inviteCustomer(customerId) });
