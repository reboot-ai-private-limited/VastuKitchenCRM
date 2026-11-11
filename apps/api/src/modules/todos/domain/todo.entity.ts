export interface StoredImage {
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

/** A named group of to-dos inside one project ("Site measurements", "Procurement"). */
export interface TodoList {
  id: string;
  projectId: string;
  name: string;
  archived: boolean;
  createdById: string;
  createdAt: Date;
}

export interface Todo {
  id: string;
  projectId: string;
  listId: string;
  title: string;
  notes: string | null;
  images: StoredImage[];
  /** Who does it. */
  assigneeIds: string[];
  /** Told when it is completed (the creator always is as well). */
  notifyOnDoneIds: string[];
  /** A calendar date `YYYY-MM-DD`, in the business timezone. No time of day. */
  dueOn: string | null;
  completedById: string | null;
  completedAt: Date | null;
  createdById: string;
  commentCount: number;
  createdAt: Date;
}

export type NewTodoList = Pick<TodoList, 'projectId' | 'name' | 'createdById'>;
export type NewTodo = Omit<
  Todo,
  'id' | 'createdAt' | 'commentCount' | 'completedById' | 'completedAt'
>;
export type TodoPatch = Partial<
  Pick<Todo, 'title' | 'notes' | 'images' | 'assigneeIds' | 'notifyOnDoneIds' | 'dueOn' | 'listId'>
>;

export interface TodoComment {
  id: string;
  todoId: string;
  projectId: string;
  authorId: string;
  text: string;
  createdAt: Date;
}
export type NewTodoComment = Omit<TodoComment, 'id' | 'createdAt'>;

export type TodoStatusFilter = 'open' | 'done' | 'all';

export interface TodoListFilter {
  projectId: string;
  listId?: string | undefined;
  status: TodoStatusFilter;
  assigneeId?: string | undefined;
}

/** Open to-dos whose due date fell in `[after, before)` (both `YYYY-MM-DD`). Oldest first. */
export interface OverdueWindow {
  before: string;
  after: string;
  limit: number;
}
