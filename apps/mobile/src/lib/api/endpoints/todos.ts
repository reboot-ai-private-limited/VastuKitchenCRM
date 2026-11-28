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
import { request } from '@/lib/api/client';

export const listMyTodos = (
  status: 'open' | 'done' | 'all' = 'open',
  scope?: 'mine' | 'all',
  signal?: AbortSignal,
) =>
  request<MyTodoDto[]>(
    'GET',
    `/todos/mine?status=${status}${scope === 'all' ? '&scope=all' : ''}`,
    undefined,
    { signal },
  );

export const listProjectTodoLists = (projectId: string, signal?: AbortSignal) =>
  request<TodoListDto[]>('GET', `/projects/${encodeURIComponent(projectId)}/todo-lists`, undefined, {
    signal,
  });

export const createTodoList = (projectId: string, name: string) =>
  request<TodoListDto>('POST', `/projects/${encodeURIComponent(projectId)}/todo-lists`, { name });

export const updateTodoList = (listId: string, body: UpdateTodoListBodyDto) =>
  request<TodoListDto>('PATCH', `/todo-lists/${encodeURIComponent(listId)}`, body);

export const createTodo = (listId: string, body: Partial<CreateTodoBodyDto> & { title: string }) =>
  request<TodoDto>('POST', `/todo-lists/${encodeURIComponent(listId)}/todos`, body);

export const updateTodo = (todoId: string, body: UpdateTodoBodyDto) =>
  request<TodoDto>('PATCH', `/todos/${encodeURIComponent(todoId)}`, body);

export const deleteTodo = (todoId: string) =>
  request<unknown>('DELETE', `/todos/${encodeURIComponent(todoId)}`);

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

export const deleteTodoComment = (todoId: string, commentId: string) =>
  request<unknown>(
    'DELETE',
    `/todos/${encodeURIComponent(todoId)}/comments/${encodeURIComponent(commentId)}`,
  );
