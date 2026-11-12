import * as Haptics from 'expo-haptics';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addTodoComment,
  completeTodo,
  getTodo,
  listMyTodos,
  listTodoComments,
  reopenTodo,
} from '@/lib/api/endpoints/todos';

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

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      done ? completeTodo(id) : reopenTodo(id),
    onSuccess: (updated) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.setQueryData(['todos', 'detail', updated.id], updated);
      void qc.invalidateQueries({ queryKey: ['todos'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
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
