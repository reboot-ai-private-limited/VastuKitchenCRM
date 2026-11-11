import { AppError } from '@/shared/errors/AppError.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  DocFile,
  DocFileFilter,
  DocFilePatch,
  DocFolder,
  NewDocFile,
  NewDocFolder,
} from '../../domain/doc.entity.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  DirectoryUser,
  DocsSettingsPort,
  FileRepositoryPort,
  FolderRepositoryPort,
  ProjectAccess,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import { DocAlerts } from '../services/docAlerts.js';
import { DocViewBuilder } from '../services/docViews.js';
import { DocsAccessService } from '../services/docsAccess.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeFolders implements FolderRepositoryPort {
  rows: DocFolder[] = [];
  private seq = 0;
  private taken(projectId: string, parentId: string | null, name: string, exceptId?: string) {
    return this.rows.some(
      (f) =>
        f.projectId === projectId &&
        f.parentId === parentId &&
        f.name.toLowerCase() === name.trim().toLowerCase() &&
        f.id !== exceptId,
    );
  }
  async create(f: NewDocFolder) {
    if (this.taken(f.projectId, f.parentId, f.name))
      throw AppError.conflict('A folder with this name already exists here.');
    const created: DocFolder = { ...f, id: `fo${++this.seq}`, createdAt: new Date() };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((f) => f.id === id) ?? null;
  }
  async update(id: string, patch: { name?: string; parentId?: string | null }) {
    const f = this.rows.find((x) => x.id === id);
    if (!f) return null;
    const name = patch.name ?? f.name;
    const parentId = patch.parentId === undefined ? f.parentId : patch.parentId;
    if (this.taken(f.projectId, parentId, name, id))
      throw AppError.conflict('A folder with this name already exists here.');
    Object.assign(f, { name, parentId });
    return f;
  }
  async delete(id: string) {
    const i = this.rows.findIndex((f) => f.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
  async listByProject(projectId: string) {
    return this.rows.filter((f) => f.projectId === projectId);
  }
}

export class FakeFiles implements FileRepositoryPort {
  rows: Array<DocFile & { deleted: boolean }> = [];
  private seq = 0;
  async createIfNew(file: NewDocFile) {
    const existing = this.rows.find(
      (f) => f.projectId === file.projectId && f.publicId === file.publicId && !f.deleted,
    );
    if (existing) return { file: existing, created: false };
    const created = {
      ...file,
      id: `fi${++this.seq}`,
      createdAt: new Date(2026, 10, 2, 10, this.seq),
      deleted: false,
    };
    this.rows.push(created);
    return { file: created, created: true };
  }
  async findById(id: string) {
    return this.rows.find((f) => f.id === id && !f.deleted) ?? null;
  }
  async update(id: string, patch: DocFilePatch) {
    const f = this.rows.find((x) => x.id === id && !x.deleted);
    if (!f) return null;
    Object.assign(f, patch);
    return f;
  }
  async softDelete(id: string) {
    const f = this.rows.find((x) => x.id === id && !x.deleted);
    if (!f) return false;
    f.deleted = true;
    return true;
  }
  async list(q: DocFileFilter) {
    return this.rows
      .filter(
        (f) =>
          !f.deleted &&
          f.projectId === q.projectId &&
          q.visibilities.includes(f.visibility) &&
          (q.folderId === undefined || f.folderId === q.folderId) &&
          (!q.search || f.name.toLowerCase().includes(q.search.toLowerCase())),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async countByFolder(projectId: string) {
    const out = new Map<string | null, number>();
    for (const f of this.rows.filter((r) => !r.deleted && r.projectId === projectId))
      out.set(f.folderId, (out.get(f.folderId) ?? 0) + 1);
    return out;
  }
  async hasFilesIn(folderId: string) {
    return this.rows.some((f) => !f.deleted && f.folderId === folderId);
  }
}

/** proj1: members designer1, tech1; customer cust1; the Admin sees every project; anyone else gets NOT FOUND. */
export class FakeProjects implements ProjectsGatewayPort {
  members = ['designer1', 'tech1'];
  activities: Array<{
    projectId: string;
    type: string;
    actorId: string | null;
    data: Record<string, unknown>;
  }> = [];
  async access(actor: ActorRef, projectId: string): Promise<ProjectAccess> {
    const role =
      actor.role === 'ADMIN'
        ? 'ADMIN'
        : actor.id === 'cust1'
          ? 'CUSTOMER'
          : this.members.includes(actor.id)
            ? 'MEMBER'
            : null;
    if (projectId !== 'proj1' || !role) throw AppError.notFound('Project not found.');
    return {
      id: 'proj1',
      name: "Mrs Rao's project",
      memberIds: this.members,
      customerId: 'cust1',
      role,
      stage: 'DESIGN',
    };
  }
  async recordActivity(
    projectId: string,
    a: { type: string; actorId: string | null; data: Record<string, unknown> },
  ) {
    this.activities.push({ projectId, ...a });
  }
  types() {
    return this.activities.map((a) => a.type);
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users: DirectoryUser[] = [
    { id: 'admin1', name: 'Owner' },
    { id: 'designer1', name: 'Dev' },
    { id: 'designer2', name: 'Deepa' },
    { id: 'tech1', name: 'Tarun' },
    { id: 'cust1', name: 'Mrs Rao' },
  ];
  async find(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }
  async activeAdminIds() {
    return ['admin1'];
  }
}

export class FakeSettings implements DocsSettingsPort {
  mb = 10;
  async maxFileMb() {
    return this.mb;
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
  signImageUpload(folder: string) {
    return {
      url: 'img',
      method: 'POST' as const,
      fileField: 'file',
      fields: { folder },
      expiresAt: '',
    };
  }
  signFileUpload(folder: string) {
    return {
      url: 'file',
      method: 'POST' as const,
      fileField: 'file',
      fields: { folder },
      expiresAt: '',
    };
  }
  imageUrls(publicId: string) {
    return { url: `https://img.test/${publicId}`, thumbUrl: `https://img.test/t/${publicId}` };
  }
  fileUrls(publicId: string, kind: 'IMAGE' | 'FILE') {
    return {
      url: `https://f.test/${publicId}`,
      thumbUrl: kind === 'IMAGE' ? `https://f.test/t/${publicId}` : null,
      downloadUrl: `https://f.test/dl/${publicId}`,
    };
  }
}

export const admin: ActorRef = { id: 'admin1', role: 'ADMIN' };
export const designer: ActorRef = { id: 'designer1', role: 'DESIGNER' };
export const designer2: ActorRef = { id: 'designer2', role: 'DESIGNER' };
export const tech: ActorRef = { id: 'tech1', role: 'TECHNICIAN' };
export const cust: ActorRef = { id: 'cust1', role: 'CUSTOMER' };

export const FILES = 'vastu-test/projects/proj1/files';
export const PHOTOS = 'vastu-test/projects/proj1';

export function world() {
  const folders = new FakeFolders();
  const files = new FakeFiles();
  const projects = new FakeProjects();
  const directory = new FakeDirectory();
  const settings = new FakeSettings();
  const sender = new FakeSender();
  const storage = new FakeStorage();
  const access = new DocsAccessService(folders, files, projects);
  const alerts = new DocAlerts(sender, directory);
  const views = new DocViewBuilder(directory, storage);
  return { folders, files, projects, directory, settings, sender, storage, access, alerts, views };
}
