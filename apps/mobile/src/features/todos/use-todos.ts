import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTodoCommentBodyDto, UpdateTodoBodyDto } from '@vastu/contracts';
import {
  addTodoComment,
  deleteTodo,
  deleteTodoComment,
  getTodo,
  listMyTodos,
  listTodoComments,
  updateTodo,
} from '@/lib/api/endpoints/todos';
import { enqueueOutbox, usePendingOutbox, type TodoPayload } from '@/offline';

export const useMyTodos = (status: 'open' | 'done' | 'all' = 'open', scope?: 'mine' | 'all') =>
  useQuery({
    queryKey: ['todos', 'mine', status, scope ?? 'mine'],
    queryFn: ({ signal }) => listMyTodos(status, scope, signal),
  });

export const useTodoDetail = (id: string) =>
  useQuery({
    queryKey: ['todos', 'detail', id],
    queryFn: ({ signal }) => getTodo(id, signal),
    enabled: !!id,
  });

export const useTodoComments = (id: string) =>
  useQuery({
    queryKey: ['todos', 'comments', id],
    queryFn: ({ signal }) => listTodoComments(id, signal),
    enabled: !!id,
  });

/**
 * Tick / untick goes through the offline outbox: it is applied locally at once (see
 * usePendingTodoDone) and sent when online. The server call is an idempotent set-state.
 */
export function useToggleTodo() {
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      enqueueOutbox<TodoPayload>({
        type: done ? 'todo.complete' : 'todo.reopen',
        entityKey: `todo:${id}`,
        payload: { todoId: id },
      }),
    onSuccess: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });
}

/** The not-yet-synced tick state of a to-do: true = done, false = reopened, null = nothing waiting. */
export function usePendingTodoDone(id: string): boolean | null {
  const pending = usePendingOutbox((i) => i.entityKey === `todo:${id}`);
  const last = pending[pending.length - 1];
  return last ? last.type === 'todo.complete' : null;
}

export function useAddTodoComment(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTodoCommentBodyDto | string) =>
      addTodoComment(todoId, typeof body === 'string' ? { text: body } : body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos', 'comments', todoId] });
      void qc.invalidateQueries({ queryKey: ['todos', 'detail', todoId] });
      void qc.invalidateQueries({ queryKey: ['todos', 'mine'] });
    },
  });
}

export function useDeleteTodoComment(todoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteTodoComment(todoId, commentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos', 'comments', todoId] });
      void qc.invalidateQueries({ queryKey: ['todos', 'detail', todoId] });
    },
  });
}

export function useUpdateTodoDetail(todoId: string, projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTodoBodyDto) => updateTodo(todoId, body),
    onSuccess: (updated) => {
      qc.setQueryData(['todos', 'detail', todoId], updated);
      void qc.invalidateQueries({ queryKey: ['todos', 'mine'] });
      if (projectId) {
        void qc.invalidateQueries({ queryKey: ['projects', 'todos', projectId] });
        void qc.invalidateQueries({ queryKey: ['projects', 'todo-lists', projectId] });
      }
    },
  });
}

export function useDeleteTodoDetail(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (todoId: string) => deleteTodo(todoId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos', 'mine'] });
      if (projectId) {
        void qc.invalidateQueries({ queryKey: ['projects', 'todos', projectId] });
        void qc.invalidateQueries({ queryKey: ['projects', 'todo-lists', projectId] });
      }
    },
  });
}
