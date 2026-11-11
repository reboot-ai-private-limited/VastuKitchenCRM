import type { CreateTodoListBodyDto, UpdateTodoListBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { ActorRef, TodoListRepositoryPort, TodoRepositoryPort } from '../../domain/ports.js';
import type { TodoList } from '../../domain/todo.entity.js';
import type { TodoAccessService } from '../services/todoAccess.js';

export interface TodoListView {
  list: TodoList;
  openCount: number;
  doneCount: number;
}

export class ListTodoListsUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly lists: TodoListRepositoryPort,
    private readonly todos: TodoRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    includeArchived: boolean,
  ): Promise<TodoListView[]> {
    await this.access.forProject(projectId, actor);
    const [lists, counts] = await Promise.all([
      this.lists.listByProject(projectId, includeArchived),
      this.todos.countsByList(projectId),
    ]);
    return lists.map((list) => ({
      list,
      openCount: counts.get(list.id)?.open ?? 0,
      doneCount: counts.get(list.id)?.done ?? 0,
    }));
  }
}

export class CreateTodoListUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly lists: TodoListRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    input: CreateTodoListBodyDto,
  ): Promise<TodoListView> {
    await this.access.forProject(projectId, actor);
    const list = await this.lists.create({ projectId, name: input.name, createdById: actor.id });
    return { list, openCount: 0, doneCount: 0 };
  }
}

/** Rename, or archive/unarchive. Archiving hides a list from the screen but deletes nothing. */
export class UpdateTodoListUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly lists: TodoListRepositoryPort,
    private readonly todos: TodoRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    listId: string,
    input: UpdateTodoListBodyDto,
  ): Promise<TodoListView> {
    const { list } = await this.access.loadList(listId, actor);
    const updated = await this.lists.update(listId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
    });
    if (!updated) throw AppError.notFound('List not found.');
    const counts = (await this.todos.countsByList(list.projectId)).get(listId);
    return { list: updated, openCount: counts?.open ?? 0, doneCount: counts?.done ?? 0 };
  }
}
