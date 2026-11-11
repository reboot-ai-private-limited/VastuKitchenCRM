import { AppError } from '@/shared/errors/AppError.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  CommentRepositoryPort,
  DirectoryUser,
  JourneyEntry,
  LeadInfo,
  LeadsGatewayPort,
  PostRepositoryPort,
  ProjectRepositoryPort,
  ProjectSettingsPort,
  ProposalsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type {
  Comment,
  NewComment,
  NewPost,
  Post,
  PostListQuery,
} from '../../domain/post.entity.js';
import type {
  NewProject,
  Project,
  ProjectListFilter,
  ProjectPatch,
} from '../../domain/project.entity.js';
import { FeedViewBuilder } from '../services/feedViews.js';
import { ProjectAccess } from '../services/projectAccess.js';
import { ProjectAlerts } from '../services/projectAlerts.js';
import { ProjectViewBuilder } from '../services/projectViews.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeProjects implements ProjectRepositoryPort {
  rows: Project[] = [];
  private seq = 0;
  async create(p: NewProject) {
    const created: Project = { ...p, id: `proj${++this.seq}`, createdAt: new Date() };
    this.rows.push(created);
    return created;
  }
  async createFromWonLead(p: NewProject & { wonLeadId: string }) {
    const existing = this.rows.find((r) => r.wonLeadId === p.wonLeadId);
    if (existing) return { project: existing, created: false };
    return { project: await this.create(p), created: true };
  }
  async findById(id: string) {
    return this.rows.find((p) => p.id === id) ?? null;
  }
  async update(id: string, patch: ProjectPatch) {
    const p = this.rows.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    return p;
  }
  async list(f: ProjectListFilter) {
    const items = this.rows.filter(
      (p) =>
        (!f.visibleTo || p.customerId === f.visibleTo || p.memberIds.includes(f.visibleTo)) &&
        (!f.leadId || p.leadId === f.leadId) &&
        (!f.customerId || p.customerId === f.customerId) &&
        (!f.designerId || p.designerId === f.designerId) &&
        (!f.stage || p.stage === f.stage),
    );
    return { items, total: items.length };
  }
}

export class FakePosts implements PostRepositoryPort {
  rows: Array<Post & { deleted: boolean }> = [];
  private seq = 0;
  /** Each post is one minute after the previous, so ordering and cursors are predictable. */
  private clock = new Date('2026-11-01T10:00:00Z').getTime();
  async create(p: NewPost) {
    const created = {
      ...p,
      id: `post${++this.seq}`,
      commentCount: 0,
      approvedById: null,
      approvedAt: null,
      createdAt: new Date((this.clock += 60_000)),
      deleted: false,
    };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((p) => p.id === id && !p.deleted) ?? null;
  }
  async softDelete(id: string) {
    const p = this.rows.find((x) => x.id === id && !x.deleted);
    if (!p) return false;
    p.deleted = true;
    return true;
  }
  async list(q: PostListQuery) {
    return this.rows
      .filter(
        (p) =>
          !p.deleted &&
          p.projectId === q.projectId &&
          q.visibilities.includes(p.visibility) &&
          (!q.before || p.createdAt < q.before),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, q.limit);
  }
  async approve(id: string, byId: string, at: Date) {
    const p = this.rows.find((x) => x.id === id && !x.deleted && x.approvedAt === null);
    if (!p) return null;
    p.approvedById = byId;
    p.approvedAt = at;
    return p;
  }
  async hasFinalDelivery(projectId: string) {
    return this.rows.some(
      (p) => p.projectId === projectId && p.kind === 'FINAL_DELIVERY' && !p.deleted,
    );
  }
  async adjustCommentCount(id: string, delta: 1 | -1) {
    const p = this.rows.find((x) => x.id === id);
    if (p) p.commentCount += delta;
  }
}

export class FakeComments implements CommentRepositoryPort {
  rows: Array<Comment & { deleted: boolean }> = [];
  private seq = 0;
  private clock = new Date('2026-11-02T10:00:00Z').getTime();
  async create(c: NewComment) {
    const created = {
      ...c,
      id: `c${++this.seq}`,
      createdAt: new Date((this.clock += 60_000)),
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
  async listByPost(postId: string) {
    return this.rows.filter((c) => c.postId === postId && !c.deleted);
  }
  async recentByPosts(postIds: string[], n: number) {
    const out = new Map<string, Comment[]>();
    for (const id of postIds) {
      const mine = this.rows.filter((c) => c.postId === id && !c.deleted);
      if (mine.length) out.set(id, mine.slice(-n));
    }
    return out;
  }
}

/** lead1 belongs to sales1. The Admin sees every lead; anyone else gets NOT FOUND, like the real module. */
export class FakeLeadsGateway implements LeadsGatewayPort {
  owners = new Map<string, string>([['lead1', 'sales1']]);
  events: Array<{ leadId: string; type: string; projectName: string; byUserId: string | null }> =
    [];
  private allowed(actor: ActorRef, leadId: string) {
    return (
      this.owners.has(leadId) && (actor.role === 'ADMIN' || this.owners.get(leadId) === actor.id)
    );
  }
  async getLead(actor: ActorRef, leadId: string): Promise<LeadInfo> {
    if (!this.allowed(actor, leadId)) throw AppError.notFound('Lead not found.');
    return { id: leadId, name: 'Mrs Rao', phone: '9876500001', city: 'Siliguri' };
  }
  async canAccess(actor: ActorRef, leadId: string) {
    return this.allowed(actor, leadId);
  }
  async recordEvent(
    leadId: string,
    e: { type: 'PROJECT_CREATED' | 'PROJECT_CLOSED'; projectName: string; byUserId: string | null },
  ) {
    this.events.push({ leadId, ...e });
  }
  async journey(actor: ActorRef, leadId: string): Promise<JourneyEntry[]> {
    if (!this.allowed(actor, leadId)) throw AppError.notFound('Lead not found.');
    return [
      {
        id: 'a1',
        type: 'CREATED',
        at: new Date('2026-10-01T10:00:00Z'),
        byUserId: 'sales1',
        byName: 'Ravi',
        data: {},
      },
      {
        id: 'a2',
        type: 'STATUS_CHANGED',
        at: new Date('2026-10-05T10:00:00Z'),
        byUserId: 'sales1',
        byName: 'Ravi',
        data: { to: 'WON' },
      },
    ];
  }
}

export class FakeProposalsGateway implements ProposalsGatewayPort {
  totals = new Map<string, number>([['lead1', 450_000]]);
  async latestSentTotal(leadId: string) {
    return this.totals.get(leadId) ?? null;
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users: DirectoryUser[] = [
    {
      id: 'admin1',
      name: 'Owner',
      phone: '9800000001',
      role: 'ADMIN',
      designation: 'Owner',
      active: true,
    },
    {
      id: 'admin2',
      name: 'Partner',
      phone: '9800000002',
      role: 'ADMIN',
      designation: 'Owner',
      active: true,
    },
    {
      id: 'designer1',
      name: 'Dev',
      phone: '9800000003',
      role: 'DESIGNER',
      designation: 'Designer',
      active: true,
    },
    {
      id: 'designer2',
      name: 'Deepa',
      phone: '9800000004',
      role: 'DESIGNER',
      designation: 'Designer',
      active: true,
    },
    {
      id: 'tech1',
      name: 'Tarun',
      phone: '9800000005',
      role: 'TECHNICIAN',
      designation: 'Technician',
      active: true,
    },
    {
      id: 'office1',
      name: 'Rita',
      phone: '9800000006',
      role: 'OFFICE',
      designation: 'Receptionist',
      active: true,
    },
    {
      id: 'sales1',
      name: 'Ravi',
      phone: '9800000007',
      role: 'SALES',
      designation: 'Telecaller',
      active: true,
    },
    {
      id: 'gone1',
      name: 'Left',
      phone: '9800000008',
      role: 'OFFICE',
      designation: null,
      active: false,
    },
    {
      id: 'cust1',
      name: 'Mrs Rao',
      phone: '9876500001',
      role: 'CUSTOMER',
      designation: null,
      active: true,
    },
    {
      id: 'cust2',
      name: 'Mr Das',
      phone: '9876500002',
      role: 'CUSTOMER',
      designation: null,
      active: true,
    },
  ];
  async find(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }
  async ensureCustomer(input: { name: string; phone: string }) {
    const existing = this.users.find((u) => u.phone === input.phone && u.role === 'CUSTOMER');
    return { id: existing?.id ?? 'cust-new' };
  }
  async activeAdminIds() {
    return this.users.filter((u) => u.role === 'ADMIN' && u.active).map((u) => u.id);
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
      url: 'https://storage.test/upload',
      method: 'POST' as const,
      fileField: 'file',
      fields: { folder },
      expiresAt: '2026-11-11T11:00:00.000Z',
    };
  }
  imageUrls(publicId: string) {
    return { url: `https://img.test/${publicId}`, thumbUrl: `https://img.test/thumb/${publicId}` };
  }
}

export class FakeSettings implements ProjectSettingsPort {
  autoCreate = true;
  async autoCreateOnWon() {
    return this.autoCreate;
  }
}

export const admin: ActorRef = { id: 'admin1', role: 'ADMIN' };
export const designer: ActorRef = { id: 'designer1', role: 'DESIGNER' };
export const designer2: ActorRef = { id: 'designer2', role: 'DESIGNER' };
export const tech: ActorRef = { id: 'tech1', role: 'TECHNICIAN' };
export const sales1: ActorRef = { id: 'sales1', role: 'SALES' };
export const cust1: ActorRef = { id: 'cust1', role: 'CUSTOMER' };
export const cust2: ActorRef = { id: 'cust2', role: 'CUSTOMER' };

export function world() {
  const projects = new FakeProjects();
  const posts = new FakePosts();
  const comments = new FakeComments();
  const leads = new FakeLeadsGateway();
  const proposals = new FakeProposalsGateway();
  const directory = new FakeDirectory();
  const sender = new FakeSender();
  const storage = new FakeStorage();
  const settings = new FakeSettings();
  const access = new ProjectAccess(projects, leads);
  const alerts = new ProjectAlerts(sender, directory);
  const projectViews = new ProjectViewBuilder(directory);
  const feedViews = new FeedViewBuilder(directory, comments, storage);
  return {
    settings,
    projects,
    posts,
    comments,
    leads,
    proposals,
    directory,
    sender,
    storage,
    access,
    alerts,
    projectViews,
    feedViews,
  };
}

/** A project for cust1 with designer1 and tech1 as members (lead1 is its lead, owned by sales1). */
export async function seedProject(w: ReturnType<typeof world>, over: Partial<NewProject> = {}) {
  return w.projects.create({
    name: "Mrs Rao's project",
    customerId: 'cust1',
    leadId: 'lead1',
    wonLeadId: null,
    siteAddress: null,
    value: null,
    stage: 'DESIGN',
    designStage: 'NOT_STARTED',
    designerId: 'designer1',
    memberIds: ['designer1', 'tech1'],
    createdById: 'admin1',
    closedAt: null,
    ...over,
  });
}
