import type { ComplaintEventType, ComplaintStatus } from '@vastu/contracts';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { StoredImageRef } from '@/shared/storage/attachImages.js';
import type { Complaint, Viewer } from '../../domain/complaint.entity.js';
import type { ProjectsGatewayPort, UserDirectoryPort } from '../../domain/ports.js';
import type { ComplaintAbilities, ComplaintAccess } from './complaintAccess.js';

interface Person {
  id: string;
  name: string;
}
export interface ImageView {
  publicId: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
}

export interface CommentView {
  id: string;
  author: Person & { isCustomer: boolean };
  text: string | null;
  images: ImageView[];
  createdAt: Date;
  canDelete: boolean;
}

export interface ComplaintView {
  complaint: Complaint;
  status: ComplaintStatus;
  projectName: string;
  customer: Person;
  raisedBy: Person | null;
  assignedTo: Person | null;
  images: ImageView[];
  resolutionImages: ImageView[];
  history: Array<{
    type: ComplaintEventType;
    at: Date;
    actor: Person | null;
    note: string | null;
    assignee: Person | null;
  }>;
  comments: CommentView[];
  can: ComplaintAbilities;
}

export class ComplaintViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly storage: StoragePort,
    private readonly access: ComplaintAccess,
  ) {}

  async build(complaints: Complaint[], viewer: Viewer): Promise<ComplaintView[]> {
    const userIds = new Set<string>();
    for (const c of complaints) {
      userIds.add(c.customerId);
      if (c.raisedById) userIds.add(c.raisedById);
      if (c.assignedToId) userIds.add(c.assignedToId);
      for (const m of c.comments) userIds.add(m.authorId);
      for (const e of c.events) {
        if (e.actorId) userIds.add(e.actorId);
        if (e.assigneeId) userIds.add(e.assigneeId);
      }
    }
    const [users, projects] = await Promise.all([
      this.directory.find([...userIds]),
      this.projects.names([...new Set(complaints.map((c) => c.projectId))]),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const person = (id: string): Person => ({ id, name: userById.get(id)?.name ?? 'Someone' });
    const maybe = (id: string | null): Person | null => (id ? person(id) : null);
    const images = (list: StoredImageRef[]): ImageView[] =>
      list.map((i) => ({
        publicId: i.publicId,
        ...this.storage.imageUrls(i.publicId),
        width: i.width,
        height: i.height,
      }));

    return complaints.map((c) => ({
      complaint: c,
      status: c.status,
      projectName: projectName.get(c.projectId) ?? 'Project',
      customer: person(c.customerId),
      raisedBy: maybe(c.raisedById),
      assignedTo: maybe(c.assignedToId),
      images: images(c.images),
      resolutionImages: images(c.resolutionImages),
      history: c.events.map((e) => ({
        type: e.type,
        at: e.at,
        actor: maybe(e.actorId),
        note: e.note,
        assignee: maybe(e.assigneeId),
      })),
      comments: c.comments.map((m) => ({
        id: m.id,
        author: {
          ...person(m.authorId),
          isCustomer: userById.get(m.authorId)?.role === 'CUSTOMER',
        },
        text: m.text,
        images: images(m.images),
        createdAt: m.createdAt,
        canDelete: viewer.role === 'ADMIN' || m.authorId === viewer.id,
      })),
      can: this.access.abilities(c, viewer),
    }));
  }
}
