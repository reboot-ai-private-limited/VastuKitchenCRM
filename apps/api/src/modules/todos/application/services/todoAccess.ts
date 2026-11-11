import { AppError } from '@/shared/errors/AppError.js';
import { scopeFor } from '@/shared/access/scope.js';
import type {
  ActorRef,
  Membership,
  ProjectsGatewayPort,
  TodoListRepositoryPort,
  TodoRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { Todo, TodoList } from '../../domain/todo.entity.js';

export interface TodoAccess {
  todo: Todo;
  membership: Membership;
  isAdmin: boolean;
}

/**
 * To-dos are TEAM-only: the Admin and the project's members. Anyone else (including the project's
 * customer) is told "not found", so ids cannot be probed.
 */
export class TodoAccessService {
  constructor(
    private readonly todos: TodoRepositoryPort,
    private readonly lists: TodoListRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
  ) {}

  isAdmin(actor: ActorRef): boolean {
    return scopeFor(actor.role, 'projects') === 'all';
  }

  forProject(projectId: string, actor: ActorRef): Promise<Membership> {
    return this.projects.membership(actor, projectId);
  }

  async loadList(
    listId: string,
    actor: ActorRef,
  ): Promise<{ list: TodoList; membership: Membership }> {
    const list = await this.lists.findById(listId);
    if (!list) throw AppError.notFound('List not found.');
    return { list, membership: await this.projects.membership(actor, list.projectId) };
  }

  async loadTodo(todoId: string, actor: ActorRef): Promise<TodoAccess> {
    const todo = await this.todos.findById(todoId);
    if (!todo) throw AppError.notFound('To-do not found.');
    const membership = await this.projects.membership(actor, todo.projectId);
    return { todo, membership, isAdmin: this.isAdmin(actor) };
  }
}

/**
 * Assignees and the "notify when done" people must be able to open the to-do: active staff who are
 * members of the project, or an Admin. Otherwise someone would get an alert they cannot follow.
 */
export async function assertPeople(
  directory: UserDirectoryPort,
  membership: Membership,
  ids: string[],
  field: 'assigneeIds' | 'notifyOnDoneIds',
): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const found = new Map((await directory.find(unique)).map((u) => [u.id, u]));
  unique.forEach((id, index) => {
    const user = found.get(id);
    const allowed =
      !!user &&
      user.active &&
      user.role !== 'CUSTOMER' &&
      (user.role === 'ADMIN' || membership.memberIds.includes(id));
    if (!allowed) {
      throw AppError.badRequest('Choose people who are on this project.', [
        { path: [field, index], message: 'Not an active member of this project' },
      ]);
    }
  });
  return unique;
}
