import type { CreateTodoCommentBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type {
  ActorRef,
  TodoCommentRepositoryPort,
  TodoRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { TodoComment } from '../../domain/todo.entity.js';
import type { TodoAccessService } from '../services/todoAccess.js';
import type { TodoAlerts } from '../services/todoAlerts.js';

export interface TodoCommentView {
  comment: TodoComment;
  authorName: string;
  canDelete: boolean;
}

export class CreateTodoCommentUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly comments: TodoCommentRepositoryPort,
    private readonly todos: TodoRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly alerts: TodoAlerts,
  ) {}

  async execute(
    actor: ActorRef,
    todoId: string,
    input: CreateTodoCommentBodyDto,
  ): Promise<TodoCommentView> {
    const { todo, isAdmin } = await this.access.loadTodo(todoId, actor);

    // Who has spoken so far is read BEFORE this comment is added.
    const earlier = (await this.comments.listByTodo(todoId)).map((c) => c.authorId);
    const comment = await this.comments.create({
      todoId,
      projectId: todo.projectId,
      authorId: actor.id,
      text: input.text,
    });
    await this.todos.adjustCommentCount(todoId, 1);

    const authorName = (await this.directory.find([actor.id]))[0]?.name ?? 'Someone';
    await this.alerts.commented(todo, comment, earlier, authorName);
    return { comment, authorName, canDelete: isAdmin || comment.authorId === actor.id };
  }
}

export class ListTodoCommentsUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly comments: TodoCommentRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: ActorRef, todoId: string): Promise<TodoCommentView[]> {
    const { isAdmin } = await this.access.loadTodo(todoId, actor);
    const items = await this.comments.listByTodo(todoId);
    const users = new Map(
      (await this.directory.find([...new Set(items.map((c) => c.authorId))])).map((u) => [u.id, u]),
    );
    return items.map((comment) => ({
      comment,
      authorName: users.get(comment.authorId)?.name ?? 'Someone',
      canDelete: isAdmin || comment.authorId === actor.id,
    }));
  }
}

export class DeleteTodoCommentUseCase {
  constructor(
    private readonly access: TodoAccessService,
    private readonly comments: TodoCommentRepositoryPort,
    private readonly todos: TodoRepositoryPort,
  ) {}

  async execute(actor: ActorRef, todoId: string, commentId: string): Promise<void> {
    const { isAdmin } = await this.access.loadTodo(todoId, actor);
    const comment = await this.comments.findById(commentId);
    if (!comment || comment.todoId !== todoId) throw AppError.notFound('Comment not found.');
    if (!isAdmin && comment.authorId !== actor.id)
      throw AppError.forbidden('You can only delete your own comments.');
    if (await this.comments.softDelete(commentId)) await this.todos.adjustCommentCount(todoId, -1);
  }
}
