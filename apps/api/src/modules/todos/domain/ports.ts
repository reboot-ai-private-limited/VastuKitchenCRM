import type {
  NotificationRefDto,
  NotificationType,
  ProjectActivityType,
  ProjectStage,
  RoleName,
} from '@vastu/contracts';
import type {
  NewTodo,
  NewTodoComment,
  NewTodoList,
  OverdueWindow,
  Todo,
  TodoComment,
  TodoList,
  TodoListFilter,
  TodoPatch,
  TodoStatusFilter,
} from './todo.entity.js';

export interface TodoListRepositoryPort {
  create(list: NewTodoList): Promise<TodoList>;
  findById(id: string): Promise<TodoList | null>;
  findByIds(ids: string[]): Promise<TodoList[]>;
  update(id: string, patch: Partial<Pick<TodoList, 'name' | 'archived'>>): Promise<TodoList | null>;
  /** In the order they were made. */
  listByProject(projectId: string, includeArchived: boolean): Promise<TodoList[]>;
}

export interface TodoRepositoryPort {
  create(todo: NewTodo): Promise<Todo>;
  /** A to-do that has not been deleted. */
  findById(id: string): Promise<Todo | null>;
  update(id: string, patch: TodoPatch): Promise<Todo | null>;
  /** Marks completed if it is not yet, atomically. Null when it was already completed (or is gone). */
  complete(id: string, byId: string, at: Date): Promise<Todo | null>;
  /** Marks open again if it is completed, atomically. Null when it was not completed. */
  reopen(id: string): Promise<Todo | null>;
  softDelete(id: string): Promise<boolean>;
  list(filter: TodoListFilter): Promise<Todo[]>;
  /** Open / done to-do counts per list, for "3/8 completed". */
  countsByList(projectId: string): Promise<Map<string, { open: number; done: number }>>;
  /** Everything assigned to a person, across projects (capped). */
  listAssigned(userId: string, status: TodoStatusFilter): Promise<Todo[]>;
  findOverdue(window: OverdueWindow): Promise<Todo[]>;
  adjustCommentCount(id: string, delta: 1 | -1): Promise<void>;
}

export interface TodoCommentRepositoryPort {
  create(comment: NewTodoComment): Promise<TodoComment>;
  findById(id: string): Promise<TodoComment | null>;
  softDelete(id: string): Promise<boolean>;
  /** The whole thread, oldest first. */
  listByTodo(todoId: string): Promise<TodoComment[]>;
}

export interface ActorRef {
  id: string;
  role: RoleName;
}

export interface Membership {
  id: string;
  name: string;
  memberIds: string[];
  stage: ProjectStage;
}

/** What to-dos needs from projects (the adapter wraps projects' public contract). */
export interface ProjectsGatewayPort {
  /** Admin or member, else NOT FOUND (the customer has no to-dos). */
  membership(actor: ActorRef, projectId: string): Promise<Membership>;
  recordActivity(
    projectId: string,
    activity: { type: ProjectActivityType; actorId: string | null; data: Record<string, unknown> },
  ): Promise<void>;
  /** The projects `actor` may use as staff, with names. */
  accessible(actor: ActorRef, projectIds: string[]): Promise<Array<{ id: string; name: string }>>;
  /** Names of projects, whoever asks (for reminders). */
  names(projectIds: string[]): Promise<Array<{ id: string; name: string }>>;
}

export interface DirectoryUser {
  id: string;
  name: string;
  role: RoleName;
  active: boolean;
}

export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
}

export interface Alert {
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto;
}

/** Delivers alerts. It must never throw: a notification problem must not fail the change that caused it. */
export interface AlertSenderPort {
  send(userIds: string[], alert: Alert): Promise<void>;
}

/** "Today" as a `YYYY-MM-DD` date in the business timezone. */
export type BusinessToday = (now: Date) => string;
