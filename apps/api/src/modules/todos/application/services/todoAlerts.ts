import type { Alert, AlertSenderPort, ProjectsGatewayPort } from '../../domain/ports.js';
import type { Todo, TodoComment } from '../../domain/todo.entity.js';

const preview = (text: string): string => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 90 ? `${t.slice(0, 87)}...` : t;
};
const without = (ids: Iterable<string>, ...excluded: Array<string | null | undefined>): string[] =>
  [...new Set(ids)].filter((id) => !excluded.includes(id));

/**
 * Who hears about what. Only the people involved: assignees, the creator, the people the creator
 * asked to be told on completion, and earlier commenters — never the person who did it, and (unlike
 * the project feed) NOT every Admin, to keep the owner's phone quiet.
 */
export class TodoAlerts {
  constructor(private readonly sender: AlertSenderPort) {}

  /** Nobody to tell (e.g. only the author was involved): do nothing rather than send an empty alert. */
  private async deliver(userIds: string[], alert: Alert): Promise<void> {
    if (userIds.length > 0) await this.sender.send(userIds, alert);
  }

  private ref(todo: Todo) {
    return { kind: 'TODO' as const, id: todo.id, projectId: todo.projectId };
  }

  assigned(
    todo: Todo,
    userIds: string[],
    actorName: string,
    projectName: string,
    actorId: string,
  ): Promise<void> {
    return this.deliver(without(userIds, actorId), {
      type: 'TODO_ASSIGNED',
      title: `Assigned to you: ${todo.title}`,
      body: `${actorName} · ${projectName}${todo.dueOn ? ` · due ${todo.dueOn}` : ''}`,
      ref: this.ref(todo),
    });
  }

  dueChanged(todo: Todo, actorName: string, actorId: string, projectName: string): Promise<void> {
    return this.deliver(without(todo.assigneeIds, actorId), {
      type: 'TODO_DUE_CHANGED',
      title: `Due date changed: ${todo.title}`,
      body: `${actorName} · ${projectName} · ${todo.dueOn ? `now due ${todo.dueOn}` : 'due date removed'}`,
      ref: this.ref(todo),
    });
  }

  /** The creator and everyone they asked to be told, except whoever completed it. */
  completed(todo: Todo, actorName: string, actorId: string, projectName: string): Promise<void> {
    return this.deliver(without([todo.createdById, ...todo.notifyOnDoneIds], actorId), {
      type: 'TODO_COMPLETED',
      title: 'To-do completed',
      body: `${actorName} completed "${todo.title}" in ${projectName}`,
      ref: this.ref(todo),
    });
  }

  commented(
    todo: Todo,
    comment: TodoComment,
    earlierCommenterIds: string[],
    authorName: string,
  ): Promise<void> {
    return this.deliver(
      without([...todo.assigneeIds, todo.createdById, ...earlierCommenterIds], comment.authorId),
      {
        type: 'TODO_COMMENT',
        title: `New comment on "${todo.title}"`,
        body: `${authorName}: ${comment.text ? preview(comment.text) : comment.images.length === 1 ? 'sent a photo' : `sent ${comment.images.length} photos`}`,
        ref: this.ref(todo),
      },
    );
  }
}

/** Kept for symmetry with other modules: resolves a project's display name for alert text. */
export async function projectNameOf(
  projects: ProjectsGatewayPort,
  projectId: string,
): Promise<string> {
  return (await projects.names([projectId]))[0]?.name ?? 'the project';
}
