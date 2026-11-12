'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateTodoBodyDto,
  CreateTodoCommentBodyDto,
  MyTodoDto,
  TodoCommentDto,
  TodoDto,
  TodoListDto,
  UpdateTodoBodyDto,
  UpdateTodoListBodyDto,
} from '@vastu/contracts';
import { withCompletion, withListCounts, type TodoStatusFilter } from '@/lib/todos';
import { api } from './client';

/* Query keys: ['todos','lists',projectId] · ['todos','project',projectId,assignee] · ['todos','detail',id]
   · ['todos','comments',id] · ['todos','mine',status] */

export const useTodoLists = (projectId: string) =>
  useQuery({
    queryKey: ['todos', 'lists', projectId],
    queryFn: ({ signal }) => api<TodoListDto[]>(`/projects/${projectId}/todo-lists`, { signal }),
  });

/** Every to-do of the project (open and done): Open/Done/All is a client-side filter, so the counts never disagree. */
export const useProjectTodos = (projectId: string, assignedToMe: boolean) =>
  useQuery({
    queryKey: ['todos', 'project', projectId, assignedToMe ? 'me' : 'all'],
    queryFn: ({ signal }) =>
      api<TodoDto[]>(`/projects/${projectId}/todos`, {
        query: { status: 'all', assignee: assignedToMe ? 'me' : undefined },
        signal,
      }),
  });

export const useTodo = (id: string | null) =>
  useQuery({
    queryKey: ['todos', 'detail', id],
    queryFn: ({ signal }) => api<TodoDto>(`/todos/${id}`, { signal }),
    enabled: !!id,
  });

export const useTodoComments = (id: string | null) =>
  useQuery({
    queryKey: ['todos', 'comments', id],
    queryFn: ({ signal }) => api<TodoCommentDto[]>(`/todos/${id}/comments`, { signal }),
    enabled: !!id,
  });

export const useMyTodos = (status: TodoStatusFilter, scope: 'mine' | 'all' = 'mine') =>
  useQuery({
    queryKey: ['todos', 'mine', status, scope],
    queryFn: ({ signal }) => api<MyTodoDto[]>('/todos/mine', { query: { status, scope }, signal }),
    refetchOnWindowFocus: true,
  });

function afterChange(qc: QueryClient) {
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['todos'] }),
      // Every to-do action writes a line on the project timeline; the dashboard counts overdue ones.
      qc.invalidateQueries({ queryKey: ['projects', 'timeline'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useCreateList(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<TodoListDto>(`/projects/${projectId}/todo-lists`, { method: 'POST', body: { name } }),
    onSuccess: afterChange(qc),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTodoListBodyDto & { id: string }) =>
      api<TodoListDto>(`/todo-lists/${id}`, { method: 'PATCH', body }),
    onSuccess: afterChange(qc),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      ...body
    }: Partial<CreateTodoBodyDto> & { listId: string; title: string }) =>
      api<TodoDto>(`/todo-lists/${listId}/todos`, { method: 'POST', body }),
    onSuccess: afterChange(qc),
  });
}

export function useUpdateTodo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTodoBodyDto) =>
      api<TodoDto>(`/todos/${id}`, { method: 'PATCH', body }),
    onSuccess: afterChange(qc),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/todos/${id}`, { method: 'DELETE' }),
    onSuccess: afterChange(qc),
  });
}

/**
 * Check / uncheck. The row flips at once in every cache that shows it (project lists, "my assignments",
 * the drawer, the "3/8 done" counters) and is put back with an error if the API refuses.
 * The API completes atomically and idempotently, so a double tap is harmless.
 */
export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      todo,
      done,
    }: {
      todo: Pick<TodoDto, 'id' | 'listId'>;
      done: boolean;
      by: { id: string; name: string };
    }) => api<TodoDto>(`/todos/${todo.id}/${done ? 'complete' : 'reopen'}`, { method: 'POST' }),
    onMutate: async ({ todo, done, by }) => {
      await qc.cancelQueries({ queryKey: ['todos'] });
      const snapshot = qc.getQueriesData({ queryKey: ['todos'] });
      const completed = done ? { by, at: new Date().toISOString() } : null;
      for (const [key, data] of snapshot) {
        if (!data) continue;
        const kind = key[1];
        if (kind === 'project' || kind === 'mine')
          qc.setQueryData(key, withCompletion(data as TodoDto[], todo.id, completed));
        else if (kind === 'detail' && (data as TodoDto).id === todo.id)
          qc.setQueryData(key, { ...(data as TodoDto), completed });
        else if (kind === 'lists')
          qc.setQueryData(key, withListCounts(data as TodoListDto[], todo.listId, done));
      }
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSettled: afterChange(qc),
  });
}

export function useCreateTodoComment(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTodoCommentBodyDto) =>
      api<TodoCommentDto>(`/todos/${todoId}/comments`, { method: 'POST', body }),
    onSuccess: afterChange(qc),
  });
}

export function useDeleteTodoComment(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api(`/todos/${todoId}/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: afterChange(qc),
  });
}
