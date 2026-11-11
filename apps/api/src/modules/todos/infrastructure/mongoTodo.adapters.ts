import { Types, isValidObjectId, type HydratedDocument } from 'mongoose';
import type {
  TodoCommentRepositoryPort,
  TodoListRepositoryPort,
  TodoRepositoryPort,
} from '../domain/ports.js';
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
} from '../domain/todo.entity.js';
import {
  TodoCommentModel,
  TodoListModel,
  TodoModel,
  type TodoCommentDoc,
  type TodoDoc,
  type TodoListDoc,
} from './todo.schemas.js';

const idOrNull = (v: { toString(): string } | null): string | null => (v ? v.toString() : null);

const toList = (d: HydratedDocument<TodoListDoc>): TodoList => ({
  id: d.id as string,
  projectId: d.projectId.toString(),
  name: d.name,
  archived: d.archived,
  createdById: d.createdById.toString(),
  createdAt: d.createdAt,
});

const toTodo = (d: HydratedDocument<TodoDoc>): Todo => ({
  id: d.id as string,
  projectId: d.projectId.toString(),
  listId: d.listId.toString(),
  title: d.title,
  notes: d.notes,
  images: d.images.map((i) => ({
    publicId: i.publicId,
    width: i.width,
    height: i.height,
    bytes: i.bytes,
  })),
  assigneeIds: d.assigneeIds.map((a) => a.toString()),
  notifyOnDoneIds: d.notifyOnDoneIds.map((a) => a.toString()),
  dueOn: d.dueOn,
  completedById: idOrNull(d.completedById),
  completedAt: d.completedAt,
  createdById: d.createdById.toString(),
  commentCount: d.commentCount,
  createdAt: d.createdAt,
});

const toComment = (d: HydratedDocument<TodoCommentDoc>): TodoComment => ({
  id: d.id as string,
  todoId: d.todoId.toString(),
  projectId: d.projectId.toString(),
  authorId: d.authorId.toString(),
  text: d.text,
  images: d.images.map((i) => ({
    publicId: i.publicId,
    width: i.width,
    height: i.height,
    bytes: i.bytes,
  })),
  createdAt: d.createdAt,
});

/** At most this many to-dos are returned for one person's "my assignments". */
const MINE_LIMIT = 500;

export class MongoTodoListRepository implements TodoListRepositoryPort {
  async create(list: NewTodoList): Promise<TodoList> {
    return toList(await TodoListModel.create({ ...list, position: Date.now() }));
  }

  async findById(id: string): Promise<TodoList | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoListModel.findById(id);
    return doc ? toList(doc) : null;
  }

  async findByIds(ids: string[]): Promise<TodoList[]> {
    const valid = ids.filter((id) => isValidObjectId(id));
    return (await TodoListModel.find({ _id: { $in: valid } })).map(toList);
  }

  async update(
    id: string,
    patch: Partial<Pick<TodoList, 'name' | 'archived'>>,
  ): Promise<TodoList | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoListModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return doc ? toList(doc) : null;
  }

  async listByProject(projectId: string, includeArchived: boolean): Promise<TodoList[]> {
    if (!isValidObjectId(projectId)) return [];
    const filter: Record<string, unknown> = { projectId };
    if (!includeArchived) filter['archived'] = false;
    return (await TodoListModel.find(filter).sort({ position: 1, _id: 1 })).map(toList);
  }
}

export class MongoTodoRepository implements TodoRepositoryPort {
  async create(todo: NewTodo): Promise<Todo> {
    return toTodo(await TodoModel.create({ ...todo, position: Date.now() }));
  }

  async findById(id: string): Promise<Todo | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoModel.findOne({ _id: id, deletedAt: null });
    return doc ? toTodo(doc) : null;
  }

  async update(id: string, patch: TodoPatch): Promise<Todo | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: patch },
      { new: true },
    );
    return doc ? toTodo(doc) : null;
  }

  async complete(id: string, byId: string, at: Date): Promise<Todo | null> {
    if (!isValidObjectId(id)) return null;
    // `completedAt: null` in the filter: only the first completion matches, so only it can announce.
    const doc = await TodoModel.findOneAndUpdate(
      { _id: id, deletedAt: null, completedAt: null },
      { $set: { completedAt: at, completedById: byId } },
      { new: true },
    );
    return doc ? toTodo(doc) : null;
  }

  async reopen(id: string): Promise<Todo | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoModel.findOneAndUpdate(
      { _id: id, deletedAt: null, completedAt: { $ne: null } },
      { $set: { completedAt: null, completedById: null } },
      { new: true },
    );
    return doc ? toTodo(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await TodoModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async list(f: TodoListFilter): Promise<Todo[]> {
    if (!isValidObjectId(f.projectId)) return [];
    const filter: Record<string, unknown> = { projectId: f.projectId, deletedAt: null };
    if (f.listId) {
      if (!isValidObjectId(f.listId)) return [];
      filter['listId'] = f.listId;
    }
    if (f.assigneeId) {
      if (!isValidObjectId(f.assigneeId)) return [];
      filter['assigneeIds'] = f.assigneeId;
    }
    applyStatus(filter, f.status);
    return (await TodoModel.find(filter).sort({ listId: 1, position: 1, _id: 1 }).limit(1000)).map(
      toTodo,
    );
  }

  async countsByList(projectId: string): Promise<Map<string, { open: number; done: number }>> {
    const out = new Map<string, { open: number; done: number }>();
    if (!isValidObjectId(projectId)) return out;
    const rows = await TodoModel.aggregate<{
      _id: { listId: Types.ObjectId; done: boolean };
      n: number;
    }>([
      { $match: { projectId: new Types.ObjectId(projectId), deletedAt: null } },
      {
        $group: {
          _id: { listId: '$listId', done: { $ne: ['$completedAt', null] } },
          n: { $sum: 1 },
        },
      },
    ]);
    for (const r of rows) {
      const key = r._id.listId.toString();
      const c = out.get(key) ?? { open: 0, done: 0 };
      if (r._id.done) c.done = r.n;
      else c.open = r.n;
      out.set(key, c);
    }
    return out;
  }

  async listAssigned(userId: string, status: TodoStatusFilter): Promise<Todo[]> {
    if (!isValidObjectId(userId)) return [];
    const filter: Record<string, unknown> = { assigneeIds: userId, deletedAt: null };
    applyStatus(filter, status);
    return (await TodoModel.find(filter).sort({ createdAt: -1 }).limit(MINE_LIMIT)).map(toTodo);
  }

  async findOverdue(w: OverdueWindow): Promise<Todo[]> {
    const docs = await TodoModel.find({
      deletedAt: null,
      completedAt: null,
      // String dates compare correctly: `2026-11-09` < `2026-11-14`.
      dueOn: { $lt: w.before, $gte: w.after },
    })
      .sort({ dueOn: 1 })
      .limit(w.limit);
    return docs.map(toTodo);
  }

  async adjustCommentCount(id: string, delta: 1 | -1): Promise<void> {
    if (!isValidObjectId(id)) return;
    await TodoModel.updateOne({ _id: id }, { $inc: { commentCount: delta } });
  }
}

function applyStatus(filter: Record<string, unknown>, status: TodoStatusFilter): void {
  if (status === 'open') filter['completedAt'] = null;
  else if (status === 'done') filter['completedAt'] = { $ne: null };
}

export class MongoTodoCommentRepository implements TodoCommentRepositoryPort {
  async create(comment: NewTodoComment): Promise<TodoComment> {
    return toComment(await TodoCommentModel.create(comment));
  }

  async findById(id: string): Promise<TodoComment | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await TodoCommentModel.findOne({ _id: id, deletedAt: null });
    return doc ? toComment(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await TodoCommentModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async listByTodo(todoId: string): Promise<TodoComment[]> {
    if (!isValidObjectId(todoId)) return [];
    return (
      await TodoCommentModel.find({ todoId, deletedAt: null })
        .sort({ createdAt: 1, _id: 1 })
        .limit(500)
    ).map(toComment);
  }
}
