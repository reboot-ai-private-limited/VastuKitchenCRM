import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { BusinessToday, DirectoryUser, UserDirectoryPort } from '../../domain/ports.js';
import type { Todo } from '../../domain/todo.entity.js';

export interface TodoView {
  todo: Todo;
  assignees: Array<{ id: string; name: string }>;
  notifyOnDone: Array<{ id: string; name: string }>;
  createdByName: string | null;
  completedByName: string | null;
  images: Array<{
    publicId: string;
    url: string;
    thumbUrl: string;
    width: number | null;
    height: number | null;
  }>;
  isOverdue: boolean;
  canDelete: boolean;
}

/** Open and past its due date, judged by the business calendar. */
export function isOverdue(todo: Pick<Todo, 'dueOn' | 'completedAt'>, today: string): boolean {
  return todo.completedAt === null && todo.dueOn !== null && todo.dueOn < today;
}

export class TodoViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly today: BusinessToday,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async build(todos: Todo[], viewer: { id: string; isAdmin: boolean }): Promise<TodoView[]> {
    const ids = new Set<string>();
    for (const t of todos) {
      t.assigneeIds.forEach((i) => ids.add(i));
      t.notifyOnDoneIds.forEach((i) => ids.add(i));
      ids.add(t.createdById);
      if (t.completedById) ids.add(t.completedById);
    }
    const users = new Map<string, DirectoryUser>(
      (await this.directory.find([...ids])).map((u) => [u.id, u]),
    );
    const person = (id: string) => ({ id, name: users.get(id)?.name ?? 'Someone' });
    const today = this.today(this.now());

    return todos.map((todo) => ({
      todo,
      assignees: todo.assigneeIds.map(person),
      notifyOnDone: todo.notifyOnDoneIds.map(person),
      createdByName: users.get(todo.createdById)?.name ?? null,
      completedByName: todo.completedById ? (users.get(todo.completedById)?.name ?? null) : null,
      images: todo.images.map((img) => ({
        publicId: img.publicId,
        ...this.storage.imageUrls(img.publicId),
        width: img.width,
        height: img.height,
      })),
      isOverdue: isOverdue(todo, today),
      canDelete: viewer.isAdmin || todo.createdById === viewer.id,
    }));
  }
}
