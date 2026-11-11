import { addDays } from '@/shared/time/businessDate.js';
import type { BusinessToday, ProjectsGatewayPort, TodoRepositoryPort } from '../../domain/ports.js';
import type { Todo } from '../../domain/todo.entity.js';

export interface OverdueTodo {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  dueOn: string;
  assigneeIds: string[];
  createdById: string;
}

/**
 * Read-only, for the reminders module: open to-dos due before today (in the business timezone) and
 * not longer ago than `lookbackDays`, so the work stays small however old the data gets.
 */
export class FindOverdueTodosUseCase {
  constructor(
    private readonly todos: TodoRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly today: BusinessToday,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(window: { lookbackDays: number; limit: number }): Promise<OverdueTodo[]> {
    const today = this.today(this.now());
    const found: Todo[] = await this.todos.findOverdue({
      before: today,
      after: addDays(today, -window.lookbackDays),
      limit: window.limit,
    });
    const names = new Map(
      (await this.projects.names([...new Set(found.map((t) => t.projectId))])).map((p) => [
        p.id,
        p.name,
      ]),
    );
    return found.map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: names.get(t.projectId) ?? 'the project',
      dueOn: t.dueOn!,
      assigneeIds: t.assigneeIds,
      createdById: t.createdById,
    }));
  }
}
