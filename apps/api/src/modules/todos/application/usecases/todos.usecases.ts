import type { CreateTodoBodyDto, ListTodosQueryDto, UpdateTodoBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, projectFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  ActorRef,
  DirectoryUser,
  ProjectsGatewayPort,
  TodoListRepositoryPort,
  TodoRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { StoredImage, TodoPatch } from '../../domain/todo.entity.js';
import { assertPeople, type TodoAccessService } from '../services/todoAccess.js';
import type { TodoAlerts } from '../services/todoAlerts.js';
import type { TodoView, TodoViewBuilder } from '../services/todoViews.js';

const names = (users: DirectoryUser[], ids: string[]): string[] =>
  ids.map((id) => users.find((u) => u.id === id)?.name ?? 'Someone');

/** Photos must have been uploaded into THIS project's folder (the same rule as feed posts). */
function checkImages(
  storage: StoragePort,
  projectId: string,
  images: Array<{
    publicId: string;
    width?: number | undefined;
    height?: number | undefined;
    bytes?: number | undefined;
  }>,
): StoredImage[] {
  const folder = projectFolder(storage.rootFolder, projectId);
  images.forEach((image, index) => {
    if (!isInFolder(image.publicId, folder)) {
      throw AppError.badRequest('A photo does not belong to this project.', [
        { path: ['images', index, 'publicId'], message: 'Upload photos through this project' },
      ]);
    }
  });
  const seen = new Set<string>();
  return images
    .filter((i) => !seen.has(i.publicId) && !!seen.add(i.publicId))
    .map((i) => ({
      publicId: i.publicId,
      width: i.width ?? null,
      height: i.height ?? null,
      bytes: i.bytes ?? null,
    }));
}

export class CreateTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly alerts: TodoAlerts,
    private readonly views: TodoViewBuilder,
  ) {}

  async execute(actor: ActorRef, listId: string, input: CreateTodoBodyDto): Promise<TodoView> {
    const { list, membership } = await this.access.loadList(listId, actor);
    if (list.archived)
      throw AppError.conflict('This list is archived. Unarchive it to add to-dos.');

    const assigneeIds = await assertPeople(
      this.directory,
      membership,
      input.assigneeIds,
      'assigneeIds',
    );
    const notifyOnDoneIds = await assertPeople(
      this.directory,
      membership,
      input.notifyOnDoneIds,
      'notifyOnDoneIds',
    );
    const images = checkImages(this.storage, list.projectId, input.images);

    const todo = await this.todos.create({
      projectId: list.projectId,
      listId,
      title: input.title,
      notes: input.notes ?? null,
      images,
      assigneeIds,
      notifyOnDoneIds,
      dueOn: input.dueOn ?? null,
      createdById: actor.id,
    });

    const people = await this.directory.find([actor.id, ...assigneeIds]);
    const actorName = names(people, [actor.id])[0]!;
    await this.projects.recordActivity(todo.projectId, {
      type: 'TODO_CREATED',
      actorId: actor.id,
      data: {
        todoId: todo.id,
        todoTitle: todo.title,
        listName: list.name,
        assigneeNames: names(people, assigneeIds),
        dueOn: todo.dueOn,
      },
    });
    await this.alerts.assigned(todo, assigneeIds, actorName, membership.name, actor.id);

    return (
      await this.views.build([todo], { id: actor.id, isAdmin: this.access.isAdmin(actor) })
    )[0]!;
  }
}

export class UpdateTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
    private readonly lists: TodoListRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly alerts: TodoAlerts,
    private readonly views: TodoViewBuilder,
  ) {}

  async execute(actor: ActorRef, todoId: string, input: UpdateTodoBodyDto): Promise<TodoView> {
    const { todo: before, membership, isAdmin } = await this.access.loadTodo(todoId, actor);
    // Captured now: a repository may hand back a live object that the update below mutates.
    const previous = { assigneeIds: [...before.assigneeIds], dueOn: before.dueOn };

    const patch: TodoPatch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.images !== undefined)
      patch.images = checkImages(this.storage, before.projectId, input.images);
    if (input.dueOn !== undefined) patch.dueOn = input.dueOn;
    if (input.assigneeIds !== undefined)
      patch.assigneeIds = await assertPeople(
        this.directory,
        membership,
        input.assigneeIds,
        'assigneeIds',
      );
    if (input.notifyOnDoneIds !== undefined)
      patch.notifyOnDoneIds = await assertPeople(
        this.directory,
        membership,
        input.notifyOnDoneIds,
        'notifyOnDoneIds',
      );
    if (input.listId !== undefined && input.listId !== before.listId) {
      const target = await this.lists.findById(input.listId);
      if (!target || target.projectId !== before.projectId) {
        throw AppError.badRequest('Choose a list in the same project.', [
          { path: ['listId'], message: 'Not a list of this project' },
        ]);
      }
      if (target.archived) throw AppError.conflict('That list is archived.');
      patch.listId = input.listId;
    }

    const updated = await this.todos.update(todoId, patch);
    if (!updated) throw AppError.notFound('To-do not found.');

    const actorName = (await this.directory.find([actor.id]))[0]?.name ?? 'Someone';

    if (patch.assigneeIds !== undefined) {
      const added = patch.assigneeIds.filter((id) => !previous.assigneeIds.includes(id));
      const removed = previous.assigneeIds.filter((id) => !patch.assigneeIds!.includes(id));
      if (added.length > 0 || removed.length > 0) {
        const people = await this.directory.find([...added, ...removed]);
        await this.projects.recordActivity(updated.projectId, {
          type: 'TODO_ASSIGNED',
          actorId: actor.id,
          data: {
            todoId,
            todoTitle: updated.title,
            addedNames: names(people, added),
            removedNames: names(people, removed),
          },
        });
        await this.alerts.assigned(updated, added, actorName, membership.name, actor.id);
      }
    }

    if (patch.dueOn !== undefined && patch.dueOn !== previous.dueOn) {
      await this.projects.recordActivity(updated.projectId, {
        type: 'TODO_DUE_CHANGED',
        actorId: actor.id,
        data: { todoId, todoTitle: updated.title, from: previous.dueOn, to: updated.dueOn },
      });
      await this.alerts.dueChanged(updated, actorName, actor.id, membership.name);
    }

    return (await this.views.build([updated], { id: actor.id, isAdmin }))[0]!;
  }
}

/** Idempotent: completing a completed to-do changes and announces nothing. */
export class CompleteTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly alerts: TodoAlerts,
    private readonly views: TodoViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, todoId: string): Promise<TodoView> {
    const { todo, membership, isAdmin } = await this.access.loadTodo(todoId, actor);

    // Atomic: of two simultaneous taps only one wins, and only the winner announces it.
    const completed = await this.todos.complete(todoId, actor.id, this.now());
    if (completed) {
      const actorName = (await this.directory.find([actor.id]))[0]?.name ?? 'Someone';
      await this.projects.recordActivity(completed.projectId, {
        type: 'TODO_COMPLETED',
        actorId: actor.id,
        data: { todoId, todoTitle: completed.title },
      });
      await this.alerts.completed(completed, actorName, actor.id, membership.name);
    }
    const current = completed ?? (await this.todos.findById(todoId)) ?? todo;
    return (await this.views.build([current], { id: actor.id, isAdmin }))[0]!;
  }
}

export class ReopenTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly views: TodoViewBuilder,
  ) {}

  async execute(actor: ActorRef, todoId: string): Promise<TodoView> {
    const { todo, isAdmin } = await this.access.loadTodo(todoId, actor);
    const reopened = await this.todos.reopen(todoId);
    if (reopened) {
      await this.projects.recordActivity(reopened.projectId, {
        type: 'TODO_REOPENED',
        actorId: actor.id,
        data: { todoId, todoTitle: reopened.title },
      });
    }
    const current = reopened ?? (await this.todos.findById(todoId)) ?? todo;
    return (await this.views.build([current], { id: actor.id, isAdmin }))[0]!;
  }
}

export class DeleteTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
  ) {}

  async execute(actor: ActorRef, todoId: string): Promise<void> {
    const { todo, isAdmin } = await this.access.loadTodo(todoId, actor);
    if (!isAdmin && todo.createdById !== actor.id)
      throw AppError.forbidden('You can only delete to-dos you created.');
    if (!(await this.todos.softDelete(todoId))) throw AppError.notFound('To-do not found.');
  }
}

export class GetTodoUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly views: TodoViewBuilder,
  ) {}

  async execute(actor: ActorRef, todoId: string): Promise<TodoView> {
    const { todo, isAdmin } = await this.access.loadTodo(todoId, actor);
    return (await this.views.build([todo], { id: actor.id, isAdmin }))[0]!;
  }
}

export class ListTodosUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly todos: TodoRepositoryPort,
    private readonly views: TodoViewBuilder,
  ) {}

  async execute(actor: ActorRef, projectId: string, query: ListTodosQueryDto): Promise<TodoView[]> {
    await this.access.forProject(projectId, actor);
    const items = await this.todos.list({
      projectId,
      listId: query.listId,
      status: query.status,
      assigneeId: query.assignee === 'me' ? actor.id : query.assignee,
    });
    return this.views.build(items, { id: actor.id, isAdmin: this.access.isAdmin(actor) });
  }
}
