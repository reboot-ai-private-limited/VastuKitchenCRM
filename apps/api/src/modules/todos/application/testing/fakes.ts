import { AppError } from '@/shared/errors/AppError.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  DirectoryUser,
  Membership,
  ProjectsGatewayPort,
  TodoCommentRepositoryPort,
  TodoListRepositoryPort,
  TodoRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
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
} from '../../domain/todo.entity.js';
import { TodoAccessService } from '../services/todoAccess.js';
import { TodoAlerts } from '../services/todoAlerts.js';
import { TodoViewBuilder } from '../services/todoViews.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

const status = (t: Todo, s: TodoStatusFilter) =>
  s === 'all' || (s === 'open' ? t.completedAt === null : t.completedAt !== null);

export class FakeLists implements TodoListRepositoryPort {
  rows: TodoList[] = [];
  private seq = 0;
  async create(l: NewTodoList) {
    const created: TodoList = {
      ...l,
      id: `list${++this.seq}`,
      archived: false,
      createdAt: new Date(),
    };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((l) => l.id === id) ?? null;
  }
  async findByIds(ids: string[]) {
    return this.rows.filter((l) => ids.includes(l.id));
  }
  async update(id: string, patch: Partial<Pick<TodoList, 'name' | 'archived'>>) {
    const l = this.rows.find((x) => x.id === id);
    if (!l) return null;
    Object.assign(l, patch);
    return l;
  }
  async listByProject(projectId: string, includeArchived: boolean) {
    return this.rows.filter((l) => l.projectId === projectId && (includeArchived || !l.archived));
  }
}

export class FakeTodos implements TodoRepositoryPort {
  rows: Array<Todo & { deleted: boolean }> = [];
  private seq = 0;
  private clock = new Date('2026-11-01T10:00:00Z').getTime();
  async create(t: NewTodo) {
    const created = {
      ...t,
      id: `todo${++this.seq}`,
      commentCount: 0,
      completedById: null,
      completedAt: null,
      createdAt: new Date((this.clock += 60_000)),
      deleted: false,
    };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((t) => t.id === id && !t.deleted) ?? null;
  }
  async update(id: string, patch: TodoPatch) {
    const t = this.rows.find((x) => x.id === id && !x.deleted);
    if (!t) return null;
    Object.assign(t, patch);
    return t;
  }
  async complete(id: string, byId: string, at: Date) {
    const t = this.rows.find((x) => x.id === id && !x.deleted && x.completedAt === null);
    if (!t) return null;
    t.completedAt = at;
    t.completedById = byId;
    return t;
  }
  async reopen(id: string) {
    const t = this.rows.find((x) => x.id === id && !x.deleted && x.completedAt !== null);
    if (!t) return null;
    t.completedAt = null;
    t.completedById = null;
    return t;
  }
  async softDelete(id: string) {
    const t = this.rows.find((x) => x.id === id && !x.deleted);
    if (!t) return false;
    t.deleted = true;
    return true;
  }
  async list(f: TodoListFilter) {
    return this.rows.filter(
      (t) =>
        !t.deleted &&
        t.projectId === f.projectId &&
        (!f.listId || t.listId === f.listId) &&
        (!f.assigneeId || t.assigneeIds.includes(f.assigneeId)) &&
        status(t, f.status),
    );
  }
  async countsByList(projectId: string) {
    const out = new Map<string, { open: number; done: number }>();
    for (const t of this.rows.filter((r) => !r.deleted && r.projectId === projectId)) {
      const c = out.get(t.listId) ?? { open: 0, done: 0 };
      if (t.completedAt) c.done++;
      else c.open++;
      out.set(t.listId, c);
    }
    return out;
  }
  async listAssigned(userId: string, s: TodoStatusFilter) {
    return this.rows.filter((t) => !t.deleted && t.assigneeIds.includes(userId) && status(t, s));
  }
  async listAll(s: TodoStatusFilter) {
    return this.rows.filter((t) => !t.deleted && status(t, s));
  }
  async findOverdue(w: OverdueWindow) {
    return this.rows
      .filter(
        (t) =>
          !t.deleted &&
          t.completedAt === null &&
          t.dueOn !== null &&
          t.dueOn < w.before &&
          t.dueOn >= w.after,
      )
      .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))
      .slice(0, w.limit);
  }
  async adjustCommentCount(id: string, delta: 1 | -1) {
    const t = this.rows.find((x) => x.id === id);
    if (t) t.commentCount += delta;
  }
}

export class FakeComments implements TodoCommentRepositoryPort {
  rows: Array<TodoComment & { deleted: boolean }> = [];
  private seq = 0;
  async create(c: NewTodoComment) {
    const created = {
      ...c,
      id: `tc${++this.seq}`,
      createdAt: new Date(2026, 10, 2, 10, this.seq),
      deleted: false,
    };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((c) => c.id === id && !c.deleted) ?? null;
  }
  async softDelete(id: string) {
    const c = this.rows.find((x) => x.id === id && !x.deleted);
    if (!c) return false;
    c.deleted = true;
    return true;
  }
  async listByTodo(todoId: string) {
    return this.rows.filter((c) => c.todoId === todoId && !c.deleted);
  }
}

/** proj1: members designer1, tech1, office1. The Admin sees every project; the customer and outsiders get NOT FOUND. */
export class FakeProjects implements ProjectsGatewayPort {
  members = ['designer1', 'tech1', 'office1'];
  activities: Array<{
    projectId: string;
    type: string;
    actorId: string | null;
    data: Record<string, unknown>;
  }> = [];
  async membership(actor: ActorRef, projectId: string): Promise<Membership> {
    const ok = projectId === 'proj1' && (actor.role === 'ADMIN' || this.members.includes(actor.id));
    if (!ok) throw AppError.notFound('Project not found.');
    return { id: 'proj1', name: "Mrs Rao's project", memberIds: this.members, stage: 'DESIGN' };
  }
  async recordActivity(
    projectId: string,
    a: { type: string; actorId: string | null; data: Record<string, unknown> },
  ) {
    this.activities.push({ projectId, ...a });
  }
  async accessible(actor: ActorRef, projectIds: string[]) {
    return projectIds
      .filter((id) => id === 'proj1' && (actor.role === 'ADMIN' || this.members.includes(actor.id)))
      .map((id) => ({ id, name: "Mrs Rao's project" }));
  }
  async names(projectIds: string[]) {
    return projectIds.map((id) => ({
      id,
      name: id === 'proj1' ? "Mrs Rao's project" : 'Other project',
    }));
  }
  types() {
    return this.activities.map((a) => a.type);
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users: DirectoryUser[] = [
    { id: 'admin1', name: 'Owner', role: 'ADMIN', active: true },
    { id: 'designer1', name: 'Dev', role: 'DESIGNER', active: true },
    { id: 'designer2', name: 'Deepa', role: 'DESIGNER', active: true },
    { id: 'tech1', name: 'Tarun', role: 'TECHNICIAN', active: true },
    { id: 'office1', name: 'Rita', role: 'OFFICE', active: true },
    { id: 'gone1', name: 'Left', role: 'OFFICE', active: false },
    { id: 'cust1', name: 'Mrs Rao', role: 'CUSTOMER', active: true },
  ];
  async find(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }
}

export class FakeSender implements AlertSenderPort {
  sent: Array<{ userIds: string[]; alert: Alert }> = [];
  async send(userIds: string[], alert: Alert) {
    this.sent.push({ userIds: [...userIds].sort(), alert });
  }
  ofType(type: Alert['type']) {
    return this.sent.filter((s) => s.alert.type === type);
  }
}

export class FakeStorage implements StoragePort {
  readonly rootFolder = 'vastu-test';
  readonly deleted: string[] = [];
  async deleteAsset(publicId: string): Promise<void> {
    this.deleted.push(publicId);
  }
  signImageUpload(folder: string) {
    return {
      url: 'u',
      method: 'POST' as const,
      fileField: 'file',
      fields: { folder },
      expiresAt: '',
    };
  }
  signFileUpload(folder: string) {
    return {
      url: 'u',
      method: 'POST' as const,
      fileField: 'file',
      fields: { folder },
      expiresAt: '',
    };
  }
  fileUrls(publicId: string, kind: 'IMAGE' | 'FILE') {
    return {
      url: `https://file.test/${publicId}`,
      thumbUrl: kind === 'IMAGE' ? `https://file.test/t/${publicId}` : null,
      downloadUrl: `https://file.test/dl/${publicId}`,
    };
  }
  imageUrls(publicId: string) {
    return { url: `https://img.test/${publicId}`, thumbUrl: `https://img.test/t/${publicId}` };
  }
}

export const admin: ActorRef = { id: 'admin1', role: 'ADMIN' };
export const designer: ActorRef = { id: 'designer1', role: 'DESIGNER' };
export const designer2: ActorRef = { id: 'designer2', role: 'DESIGNER' };
export const tech: ActorRef = { id: 'tech1', role: 'TECHNICIAN' };
export const office: ActorRef = { id: 'office1', role: 'OFFICE' };
export const cust: ActorRef = { id: 'cust1', role: 'CUSTOMER' };

export const NOW = new Date('2026-11-10T10:00:00Z');
/** The business date for `now`; the real one is timezone-aware (see shared/time). */
export const today = (d: Date) => d.toISOString().slice(0, 10);

export function world() {
  const lists = new FakeLists();
  const todos = new FakeTodos();
  const comments = new FakeComments();
  const projects = new FakeProjects();
  const directory = new FakeDirectory();
  const sender = new FakeSender();
  const storage = new FakeStorage();
  const access = new TodoAccessService(todos, lists, projects);
  const alerts = new TodoAlerts(sender);
  const views = new TodoViewBuilder(directory, storage, today, () => NOW);
  return { lists, todos, comments, projects, directory, sender, storage, access, alerts, views };
}
