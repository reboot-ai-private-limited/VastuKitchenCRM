import type { MyTodosQueryDto, TodoBucket } from '@vastu/contracts';
import type {
  ActorRef,
  BusinessToday,
  ProjectsGatewayPort,
  TodoListRepositoryPort,
  TodoRepositoryPort,
} from '../../domain/ports.js';
import type { Todo } from '../../domain/todo.entity.js';
import type { TodoView, TodoViewBuilder } from '../services/todoViews.js';

export interface MyTodoView {
  view: TodoView;
  project: { id: string; name: string };
  listName: string;
  bucket: TodoBucket;
}

/** Where an OPEN to-do sits. (Completed ones have no urgency, so they are NO_DATE.) */
export function bucketOf(todo: Pick<Todo, 'dueOn' | 'completedAt'>, today: string): TodoBucket {
  if (todo.completedAt !== null || todo.dueOn === null) return 'NO_DATE';
  if (todo.dueOn < today) return 'OVERDUE';
  if (todo.dueOn === today) return 'TODAY';
  return 'UPCOMING';
}

const ORDER: Record<TodoBucket, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2, NO_DATE: 3 };

/** "My assignments": everything assigned to me, across projects, most urgent first. An Admin may ask for everyone's. */
export class MyTodosUseCase {
  constructor(
    private readonly todos: TodoRepositoryPort,
    private readonly lists: TodoListRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly views: TodoViewBuilder,
    private readonly today: BusinessToday,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, query: MyTodosQueryDto): Promise<MyTodoView[]> {
    const mine =
      query.scope === 'all' && actor.role === 'ADMIN'
        ? await this.todos.listAll(query.status)
        : await this.todos.listAssigned(actor.id, query.status);

    // Only projects I can still open: someone removed from a project stops seeing its to-dos.
    const accessible = new Map(
      (await this.projects.accessible(actor, [...new Set(mine.map((t) => t.projectId))])).map(
        (p) => [p.id, p],
      ),
    );
    const visible = mine.filter((t) => accessible.has(t.projectId));
    const listNames = new Map(
      (await this.lists.findByIds([...new Set(visible.map((t) => t.listId))])).map((l) => [
        l.id,
        l.name,
      ]),
    );
    const views = await this.views.build(visible, {
      id: actor.id,
      isAdmin: actor.role === 'ADMIN',
    });

    const today = this.today(this.now());
    return views
      .map((view) => ({
        view,
        project: accessible.get(view.todo.projectId)!,
        listName: listNames.get(view.todo.listId) ?? '',
        bucket: bucketOf(view.todo, today),
      }))
      .sort((a, b) => {
        if (ORDER[a.bucket] !== ORDER[b.bucket]) return ORDER[a.bucket] - ORDER[b.bucket];
        // Within a day-bucket: soonest due first; undated: newest first.
        if (a.view.todo.dueOn && b.view.todo.dueOn)
          return a.view.todo.dueOn.localeCompare(b.view.todo.dueOn);
        return b.view.todo.createdAt.getTime() - a.view.todo.createdAt.getTime();
      });
  }
}
