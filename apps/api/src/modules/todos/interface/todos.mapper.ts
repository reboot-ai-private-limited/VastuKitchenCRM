import type { MyTodoDto, TodoCommentDto, TodoDto, TodoListDto } from '@vastu/contracts';
import type { TodoCommentView } from '../application/usecases/comments.usecases.js';
import type { TodoListView } from '../application/usecases/lists.usecases.js';
import type { MyTodoView } from '../application/usecases/mine.usecase.js';
import type { TodoView } from '../application/services/todoViews.js';

export const toTodoDto = (v: TodoView): TodoDto => ({
  id: v.todo.id,
  projectId: v.todo.projectId,
  listId: v.todo.listId,
  title: v.todo.title,
  notes: v.todo.notes,
  images: v.images,
  assignees: v.assignees,
  notifyOnDone: v.notifyOnDone,
  dueOn: v.todo.dueOn,
  isOverdue: v.isOverdue,
  completed:
    v.todo.completedById && v.todo.completedAt
      ? {
          by: { id: v.todo.completedById, name: v.completedByName ?? 'Someone' },
          at: v.todo.completedAt.toISOString(),
        }
      : null,
  createdBy: v.createdByName ? { id: v.todo.createdById, name: v.createdByName } : null,
  commentCount: v.todo.commentCount,
  canDelete: v.canDelete,
  createdAt: v.todo.createdAt.toISOString(),
});

export const toTodoListDto = (v: TodoListView): TodoListDto => ({
  id: v.list.id,
  projectId: v.list.projectId,
  name: v.list.name,
  archived: v.list.archived,
  openCount: v.openCount,
  doneCount: v.doneCount,
  createdAt: v.list.createdAt.toISOString(),
});

export const toTodoCommentDto = (v: TodoCommentView): TodoCommentDto => ({
  id: v.comment.id,
  todoId: v.comment.todoId,
  author: { id: v.comment.authorId, name: v.authorName },
  text: v.comment.text,
  createdAt: v.comment.createdAt.toISOString(),
  canDelete: v.canDelete,
});

export const toMyTodoDto = (m: MyTodoView): MyTodoDto => ({
  ...toTodoDto(m.view),
  project: m.project,
  listName: m.listName,
  bucket: m.bucket,
});
