import type {
  CreateTodoCommentBodyDto,
  MyTodoDto,
  TodoCommentDto,
  TodoDto,
} from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const listMyTodos = (status: 'open' | 'done' | 'all' = 'open', signal?: AbortSignal) =>
  request<MyTodoDto[]>('GET', `/todos/mine?status=${status}`, undefined, { signal });

export const getTodo = (todoId: string, signal?: AbortSignal) =>
  request<TodoDto>('GET', `/todos/${encodeURIComponent(todoId)}`, undefined, { signal });

export const completeTodo = (todoId: string) =>
  request<TodoDto>('POST', `/todos/${encodeURIComponent(todoId)}/complete`, {});

export const reopenTodo = (todoId: string) =>
  request<TodoDto>('POST', `/todos/${encodeURIComponent(todoId)}/reopen`, {});

export const listTodoComments = (todoId: string, signal?: AbortSignal) =>
  request<TodoCommentDto[]>('GET', `/todos/${encodeURIComponent(todoId)}/comments`, undefined, { signal });

export const addTodoComment = (todoId: string, body: CreateTodoCommentBodyDto) =>
  request<TodoCommentDto>('POST', `/todos/${encodeURIComponent(todoId)}/comments`, body);
