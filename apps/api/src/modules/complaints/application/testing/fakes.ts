import { COMPLAINT_STATUSES, type ComplaintCountsDto } from '@vastu/contracts';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  Viewer,
  Complaint,
  ComplaintFilter,
  NewComplaint,
  Transition,
} from '../../domain/complaint.entity.js';
import type {
  Alert,
  AlertSenderPort,
  ComplaintRepositoryPort,
  DirectoryUser,
  ProjectBasics,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import { ComplaintAccess } from '../services/complaintAccess.js';
import { ComplaintAlerts } from '../services/complaintAlerts.js';
import { ComplaintViewBuilder } from '../services/complaintViews.js';
import {
  AssignComplaintUseCase,
  CloseComplaintUseCase,
  CountComplaintsUseCase,
  ListComplaintsUseCase,
  RaiseComplaintUseCase,
  RaiseRules,
  ReopenComplaintUseCase,
  ResolveComplaintUseCase,
  SignRaiseUploadUseCase,
  SignResolveUploadUseCase,
} from '../usecases/complaints.usecases.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

/** Ids look like Mongo ids (24 hex digits), because the use cases refuse anything else. */
export const hex = (n: number): string => n.toString(16).padStart(24, '0');

export class FakeComplaints implements ComplaintRepositoryPort {
  rows: Complaint[] = [];
  private seq = 0;

  async create(i: NewComplaint) {
    const c: Complaint = {
      id: hex(++this.seq + 5000),
      projectId: i.projectId,
      customerId: i.customerId,
      description: i.description,
      images: i.images,
      status: 'OPEN',
      raisedById: i.raisedById,
      assignedToId: null,
      resolutionNote: null,
      resolutionImages: [],
      createdAt: i.at,
      activeSince: i.at,
      assignedAt: null,
      resolvedAt: null,
      closedAt: null,
      reopenCount: 0,
      events: [{ type: 'RAISED', at: i.at, actorId: i.raisedById, note: null, assigneeId: null }],
    };
    this.rows.push(c);
    return structuredClone(c);
  }
  async findById(id: string) {
    const c = this.rows.find((x) => x.id === id);
    return c ? structuredClone(c) : null;
  }
  private match(f: ComplaintFilter, c: Complaint) {
    return (
      (!f.status || c.status === f.status) &&
      (!f.projectId || c.projectId === f.projectId) &&
      (!f.assignedToId || c.assignedToId === f.assignedToId) &&
      (!f.involving || [c.assignedToId, c.raisedById, c.customerId].includes(f.involving))
    );
  }
  async list(f: ComplaintFilter, page: { page: number; pageSize: number }) {
    const all = this.rows.filter((c) => this.match(f, c)).reverse();
    const start = (page.page - 1) * page.pageSize;
    return {
      items: all.slice(start, start + page.pageSize).map((c) => structuredClone(c)),
      total: all.length,
    };
  }
  async counts(f: ComplaintFilter): Promise<ComplaintCountsDto> {
    const out = Object.fromEntries(COMPLAINT_STATUSES.map((s) => [s, 0])) as ComplaintCountsDto;
    for (const c of this.rows) if (this.match(f, c)) out[c.status]++;
    return out;
  }
  async transition(id: string, t: Transition) {
    const c = this.rows.find((x) => x.id === id);
    if (!c || !t.from.includes(c.status)) return null;
    Object.assign(c, t.set);
    if (t.incReopen) c.reopenCount++;
    c.events.push(t.event);
    return structuredClone(c);
  }
  async findStale(before: Date, limit: number) {
    return this.rows
      .filter((c) => (c.status === 'OPEN' || c.status === 'ASSIGNED') && c.activeSince < before)
      .slice(0, limit)
      .map((c) => structuredClone(c));
  }
}

export class FakeProjects implements ProjectsGatewayPort {
  projects = new Map<string, ProjectBasics>();
  activities: Array<{
    projectId: string;
    type: string;
    actorId: string | null;
    data: Record<string, unknown>;
  }> = [];
  async basics(id: string) {
    return this.projects.get(id) ?? null;
  }
  async names(ids: string[]) {
    return ids.flatMap((id) => {
      const p = this.projects.get(id);
      return p ? [{ id, name: p.name }] : [];
    });
  }
  async recordActivity(
    projectId: string,
    a: { type: string; actorId: string | null; data: Record<string, unknown> },
  ) {
    this.activities.push({ projectId, ...a });
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users = new Map<string, DirectoryUser>();
  async find(ids: string[]) {
    return ids.flatMap((id) => this.users.get(id) ?? []);
  }
  async activeAdminIds() {
    return [...this.users.values()].filter((u) => u.role === 'ADMIN' && u.active).map((u) => u.id);
  }
}

export class FakeSender implements AlertSenderPort {
  sent: Array<{ userId: string } & Alert> = [];
  async send(userIds: string[], alert: Alert) {
    for (const userId of userIds) this.sent.push({ userId, ...alert });
  }
  to(userId: string, type?: string) {
    return this.sent.filter((s) => s.userId === userId && (!type || s.type === type));
  }
  clear() {
    this.sent = [];
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

export const ID = {
  admin: hex(1),
  office: hex(2),
  sales: hex(3), // a member of the project
  salesOther: hex(4), // not a member
  designer: hex(5),
  tech: hex(6),
  tech2: hex(7),
  hr: hex(8),
  customer: hex(9),
  customer2: hex(10),
  gone: hex(11), // a deactivated technician
  project: hex(100),
  otherProject: hex(101),
};
export const as = (id: string, role: Viewer['role']): Viewer => ({ id, role });
export const A = {
  admin: as(ID.admin, 'ADMIN'),
  office: as(ID.office, 'OFFICE'),
  sales: as(ID.sales, 'SALES'),
  salesOther: as(ID.salesOther, 'SALES'),
  designer: as(ID.designer, 'DESIGNER'),
  tech: as(ID.tech, 'TECHNICIAN'),
  tech2: as(ID.tech2, 'TECHNICIAN'),
  hr: as(ID.hr, 'HR'),
  customer: as(ID.customer, 'CUSTOMER'),
  customer2: as(ID.customer2, 'CUSTOMER'),
};

export const PHOTOS = `vastu-test/projects/${ID.project}`;
export const photo = (n: string) => ({ publicId: `${PHOTOS}/${n}`, width: 800, height: 600 });

export function world(now = new Date('2026-11-11T10:00:00Z')) {
  const complaints = new FakeComplaints();
  const projects = new FakeProjects();
  const directory = new FakeDirectory();
  const sender = new FakeSender();
  const storage = new FakeStorage();
  const clock = { now };

  for (const [key, a] of Object.entries(A)) {
    directory.users.set(a.id, { id: a.id, name: key, role: a.role, active: true });
  }
  directory.users.set(ID.gone, { id: ID.gone, name: 'gone', role: 'TECHNICIAN', active: false });
  projects.projects.set(ID.project, {
    id: ID.project,
    name: 'Rao Kitchen',
    memberIds: [ID.sales],
    customerId: ID.customer,
    stage: 'SITE',
  });
  projects.projects.set(ID.otherProject, {
    id: ID.otherProject,
    name: 'Das Wardrobe',
    memberIds: [],
    customerId: ID.customer2,
    stage: 'DESIGN',
  });

  const access = new ComplaintAccess(complaints);
  const alerts = new ComplaintAlerts(sender, directory);
  const views = new ComplaintViewBuilder(directory, projects, storage, access);
  const rules = new RaiseRules(projects, access);
  const tick = () => clock.now;
  return {
    complaints,
    projects,
    directory,
    sender,
    storage,
    clock,
    access,
    raise: new RaiseComplaintUseCase(
      rules,
      complaints,
      projects,
      directory,
      storage,
      alerts,
      views,
      tick,
    ),
    list: new ListComplaintsUseCase(access, complaints, views),
    counts: new CountComplaintsUseCase(access, complaints),
    assign: new AssignComplaintUseCase(
      access,
      complaints,
      projects,
      directory,
      views,
      alerts,
      tick,
    ),
    resolve: new ResolveComplaintUseCase(
      access,
      complaints,
      projects,
      directory,
      views,
      storage,
      alerts,
      tick,
    ),
    reopen: new ReopenComplaintUseCase(
      access,
      complaints,
      projects,
      directory,
      views,
      alerts,
      tick,
    ),
    close: new CloseComplaintUseCase(access, complaints, projects, directory, views, alerts, tick),
    signRaise: new SignRaiseUploadUseCase(rules, storage),
    signResolve: new SignResolveUploadUseCase(access, storage),
  };
}
