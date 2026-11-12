import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTodoComment,
  getTodo,
  listMyTodos,
  listTodoComments,
} from '@/lib/api/endpoints/todos';
import { enqueueOutbox, usePendingOutbox, type TodoPayload } from '@/offline';

export const useMyTodos = (status: 'open' | 'done' | 'all' = 'open') =>
  useQuery({
    queryKey: ['todos', 'mine', status],
    queryFn: ({ signal }) => listMyTodos(status, signal),
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
    mutationFn: (text: string) => addTodoComment(todoId, { text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['todos', 'comments', todoId] });
      void qc.invalidateQueries({ queryKey: ['todos', 'detail', todoId] });
      void qc.invalidateQueries({ queryKey: ['todos', 'mine'] });
    },
  });
}
