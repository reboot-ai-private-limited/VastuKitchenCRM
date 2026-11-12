import type {
  AddComplaintCommentBodyDto,
  AssignComplaintBodyDto,
  CloseComplaintBodyDto,
  ComplaintCountsDto,
  ListComplaintsQueryDto,
  PaginatedDto,
  RaiseComplaintBodyDto,
  ReopenComplaintBodyDto,
  ResolveComplaintBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { projectImages } from '@/shared/storage/attachImages.js';
import { projectFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { Complaint, Transition, Viewer } from '../../domain/complaint.entity.js';
import type {
  ComplaintRepositoryPort,
  ProjectBasics,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { ComplaintAction, ComplaintAccess } from '../services/complaintAccess.js';
import { snippet, type ComplaintAlerts } from '../services/complaintAlerts.js';
import type { ComplaintView, ComplaintViewBuilder } from '../services/complaintViews.js';

/** Staff who may raise a complaint on a project they are a member of. Technicians only fix them. */
const CANNOT_RAISE = ['TECHNICIAN', 'HR'] as const;

/** Applies a rule shared by raise and its upload ticket: who may file a complaint on a project. */
export class RaiseRules {
  constructor(
    private readonly projects: ProjectsGatewayPort,
    private readonly access: ComplaintAccess,
  ) {}

  async projectFor(actor: Viewer, projectId: string): Promise<ProjectBasics> {
    if ((CANNOT_RAISE as readonly string[]).includes(actor.role))
      throw AppError.forbidden('You cannot raise a complaint.');
    const project = /^[a-f\d]{24}$/i.test(projectId) ? await this.projects.basics(projectId) : null;
    const allowed =
      !!project &&
      (actor.role === 'CUSTOMER'
        ? project.customerId === actor.id
        : this.access.seesAll(actor) || project.memberIds.includes(actor.id));
    if (!project || !allowed) throw AppError.notFound('Project not found.');
    return project;
  }
}

export class SignRaiseUploadUseCase {
  constructor(
    private readonly rules: RaiseRules,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: Viewer, projectId: string): Promise<UploadTicketDto> {
    const project = await this.rules.projectFor(actor, projectId);
    return this.storage.signImageUpload(projectFolder(this.storage.rootFolder, project.id));
  }
}

export class SignResolveUploadUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: Viewer, complaintId: string): Promise<UploadTicketDto> {
    const c = await this.access.load(complaintId, actor);
    this.access.assert(c, actor, 'resolve');
    return this.storage.signImageUpload(projectFolder(this.storage.rootFolder, c.projectId));
  }
}

export class RaiseComplaintUseCase {
  constructor(
    private readonly rules: RaiseRules,
    private readonly complaints: ComplaintRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly alerts: ComplaintAlerts,
    private readonly views: ComplaintViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Viewer, input: RaiseComplaintBodyDto): Promise<ComplaintView> {
    const project = await this.rules.projectFor(actor, input.projectId);
    const images = projectImages(this.storage, project.id, input.images);
    const created = await this.complaints.create({
      projectId: project.id,
      customerId: project.customerId,
      description: input.description,
      images,
      raisedById: actor.id,
      at: this.now(),
    });
    await this.projects.recordActivity(project.id, {
      type: 'COMPLAINT_RAISED',
      actorId: actor.id,
      data: { complaintId: created.id, summary: snippet(created.description) },
    });
    const [me] = await this.directory.find([actor.id]);
    await this.alerts.raised(created, project.name, actor.id, me?.name ?? 'Someone');
    return (await this.views.build([created], actor))[0]!;
  }
}

export class ListComplaintsUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly complaints: ComplaintRepositoryPort,
    private readonly views: ComplaintViewBuilder,
  ) {}

  async execute(actor: Viewer, q: ListComplaintsQueryDto): Promise<PaginatedDto<ComplaintView>> {
    const involving = this.access.involving(actor);
    const { items, total } = await this.complaints.list(
      {
        ...(q.status ? { status: q.status } : {}),
        ...(q.projectId ? { projectId: q.projectId } : {}),
        ...(q.assignedTo ? { assignedToId: q.assignedTo === 'me' ? actor.id : q.assignedTo } : {}),
        ...(involving ? { involving } : {}),
      },
      { page: q.page, pageSize: q.pageSize },
    );
    return {
      items: await this.views.build(items, actor),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }
}

export class CountComplaintsUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly complaints: ComplaintRepositoryPort,
  ) {}

  execute(actor: Viewer): Promise<ComplaintCountsDto> {
    const involving = this.access.involving(actor);
    return this.complaints.counts(involving ? { involving } : {});
  }
}

export class GetComplaintUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly views: ComplaintViewBuilder,
  ) {}

  async execute(actor: Viewer, id: string): Promise<ComplaintView> {
    return (await this.views.build([await this.access.load(id, actor)], actor))[0]!;
  }
}

/** The shared shape of assign / resolve / reopen / close: check, change atomically, record, tell. */
abstract class StatusChange<Input> {
  constructor(
    protected readonly access: ComplaintAccess,
    protected readonly complaints: ComplaintRepositoryPort,
    protected readonly projects: ProjectsGatewayPort,
    protected readonly directory: UserDirectoryPort,
    protected readonly views: ComplaintViewBuilder,
    protected readonly now: () => Date,
  ) {}

  protected abstract readonly action: ComplaintAction;
  protected abstract transition(
    c: Complaint,
    actor: Viewer,
    input: Input,
    at: Date,
  ): Promise<Transition>;
  protected abstract after(
    updated: Complaint,
    before: Complaint,
    actor: Viewer,
    actorName: string,
    projectName: string,
    input: Input,
  ): Promise<void>;

  async execute(actor: Viewer, id: string, input: Input): Promise<ComplaintView> {
    const before = await this.access.load(id, actor);
    this.access.assert(before, actor, this.action);
    const at = this.now();
    const change = await this.transition(before, actor, input, at);
    const updated = await this.complaints.transition(before.id, change);
    if (!updated)
      throw AppError.conflict(
        'This complaint was just changed by someone else. Refresh and retry.',
      );
    const [[me], names] = await Promise.all([
      this.directory.find([actor.id]),
      this.projects.names([updated.projectId]),
    ]);
    await this.after(
      updated,
      before,
      actor,
      me?.name ?? 'Someone',
      names[0]?.name ?? 'Project',
      input,
    );
    return (await this.views.build([updated], actor))[0]!;
  }
}

export class AssignComplaintUseCase extends StatusChange<AssignComplaintBodyDto> {
  protected readonly action = 'assign' as const;

  constructor(
    access: ComplaintAccess,
    complaints: ComplaintRepositoryPort,
    projects: ProjectsGatewayPort,
    directory: UserDirectoryPort,
    views: ComplaintViewBuilder,
    private readonly alerts: ComplaintAlerts,
    now: () => Date = () => new Date(),
  ) {
    super(access, complaints, projects, directory, views, now);
  }

  override async execute(actor: Viewer, id: string, input: AssignComplaintBodyDto) {
    const current = await this.access.load(id, actor);
    // Assigning to who already has it changes nothing: no second history line, no second alert.
    if (current.status === 'ASSIGNED' && current.assignedToId === input.assigneeId) {
      this.access.assert(current, actor, 'assign');
      return (await this.views.build([current], actor))[0]!;
    }
    return super.execute(actor, id, input);
  }

  protected async transition(
    _c: Complaint,
    actor: Viewer,
    input: AssignComplaintBodyDto,
    at: Date,
  ) {
    const [assignee] = await this.directory.find([input.assigneeId]);
    if (!assignee || !assignee.active || assignee.role === 'CUSTOMER')
      throw AppError.badRequest('Pick an active staff member.', [
        { path: ['assigneeId'], message: 'Not an active staff member' },
      ]);
    return {
      from: ['OPEN', 'ASSIGNED'] as Complaint['status'][],
      set: { status: 'ASSIGNED' as const, assignedToId: assignee.id, assignedAt: at },
      event: {
        type: 'ASSIGNED' as const,
        at,
        actorId: actor.id,
        note: null,
        assigneeId: assignee.id,
      },
    };
  }

  protected async after(
    updated: Complaint,
    _b: Complaint,
    actor: Viewer,
    _n: string,
    projectName: string,
  ) {
    const [assignee] = await this.directory.find([updated.assignedToId ?? '']);
    await this.projects.recordActivity(updated.projectId, {
      type: 'COMPLAINT_ASSIGNED',
      actorId: actor.id,
      data: {
        complaintId: updated.id,
        summary: snippet(updated.description),
        assigneeId: updated.assignedToId,
        assigneeName: assignee?.name ?? null,
      },
    });
    await this.alerts.assigned(updated, projectName, actor.id);
  }
}

export class ResolveComplaintUseCase extends StatusChange<ResolveComplaintBodyDto> {
  protected readonly action = 'resolve' as const;

  constructor(
    access: ComplaintAccess,
    complaints: ComplaintRepositoryPort,
    projects: ProjectsGatewayPort,
    directory: UserDirectoryPort,
    views: ComplaintViewBuilder,
    private readonly storage: StoragePort,
    private readonly alerts: ComplaintAlerts,
    now: () => Date = () => new Date(),
  ) {
    super(access, complaints, projects, directory, views, now);
  }

  protected async transition(
    c: Complaint,
    actor: Viewer,
    input: ResolveComplaintBodyDto,
    at: Date,
  ) {
    return {
      from: ['ASSIGNED'] as Complaint['status'][],
      set: {
        status: 'RESOLVED' as const,
        resolutionNote: input.note,
        resolutionImages: projectImages(this.storage, c.projectId, input.images),
        resolvedAt: at,
      },
      event: {
        type: 'RESOLVED' as const,
        at,
        actorId: actor.id,
        note: input.note,
        assigneeId: null,
      },
    };
  }

  protected async after(
    updated: Complaint,
    _b: Complaint,
    actor: Viewer,
    name: string,
    projectName: string,
  ) {
    await this.projects.recordActivity(updated.projectId, {
      type: 'COMPLAINT_RESOLVED',
      actorId: actor.id,
      data: { complaintId: updated.id, summary: snippet(updated.description) },
    });
    await this.alerts.resolved(updated, projectName, actor.id, name);
  }
}

export class ReopenComplaintUseCase extends StatusChange<ReopenComplaintBodyDto> {
  protected readonly action = 'reopen' as const;

  constructor(
    access: ComplaintAccess,
    complaints: ComplaintRepositoryPort,
    projects: ProjectsGatewayPort,
    directory: UserDirectoryPort,
    views: ComplaintViewBuilder,
    private readonly alerts: ComplaintAlerts,
    now: () => Date = () => new Date(),
  ) {
    super(access, complaints, projects, directory, views, now);
  }

  protected async transition(
    _c: Complaint,
    actor: Viewer,
    input: ReopenComplaintBodyDto,
    at: Date,
  ) {
    return {
      from: ['RESOLVED'] as Complaint['status'][],
      // Back to the same technician, with a clean slate for the next resolution.
      set: {
        status: 'ASSIGNED' as const,
        resolutionNote: null,
        resolutionImages: [],
        resolvedAt: null,
        activeSince: at,
      },
      incReopen: true,
      event: {
        type: 'REOPENED' as const,
        at,
        actorId: actor.id,
        note: input.reason,
        assigneeId: null,
      },
    };
  }

  protected async after(
    updated: Complaint,
    _b: Complaint,
    actor: Viewer,
    _n: string,
    projectName: string,
    input: ReopenComplaintBodyDto,
  ) {
    await this.projects.recordActivity(updated.projectId, {
      type: 'COMPLAINT_REOPENED',
      actorId: actor.id,
      data: { complaintId: updated.id, summary: snippet(updated.description) },
    });
    await this.alerts.reopened(updated, projectName, actor.id, input.reason);
  }
}

export class CloseComplaintUseCase extends StatusChange<CloseComplaintBodyDto> {
  protected readonly action = 'close' as const;

  constructor(
    access: ComplaintAccess,
    complaints: ComplaintRepositoryPort,
    projects: ProjectsGatewayPort,
    directory: UserDirectoryPort,
    views: ComplaintViewBuilder,
    private readonly alerts: ComplaintAlerts,
    now: () => Date = () => new Date(),
  ) {
    super(access, complaints, projects, directory, views, now);
  }

  protected async transition(_c: Complaint, actor: Viewer, input: CloseComplaintBodyDto, at: Date) {
    return {
      from: ['RESOLVED'] as Complaint['status'][],
      set: { status: 'CLOSED' as const, closedAt: at },
      event: {
        type: 'CLOSED' as const,
        at,
        actorId: actor.id,
        note: input.note ?? null,
        assigneeId: null,
      },
    };
  }

  protected async after(
    updated: Complaint,
    _b: Complaint,
    actor: Viewer,
    _n: string,
    projectName: string,
  ) {
    await this.projects.recordActivity(updated.projectId, {
      type: 'COMPLAINT_CLOSED',
      actorId: actor.id,
      data: { complaintId: updated.id, summary: snippet(updated.description) },
    });
    await this.alerts.closed(updated, projectName, actor.id);
  }
}

/** Open or assigned too long, for the reminders module (read-only, through the public contract). */
export class FindStaleComplaintsUseCase {
  constructor(private readonly complaints: ComplaintRepositoryPort) {}

  async execute(before: Date, limit: number) {
    return this.complaints.findStale(before, limit);
  }
}

/** Anyone who can see the complaint may write in it, until it is closed. */
export class AddComplaintCommentUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly complaints: ComplaintRepositoryPort,
    private readonly projects: ProjectsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
    private readonly alerts: ComplaintAlerts,
    private readonly views: ComplaintViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: Viewer,
    complaintId: string,
    input: AddComplaintCommentBodyDto,
  ): Promise<ComplaintView> {
    const c = await this.access.load(complaintId, actor);
    if (c.status === 'CLOSED')
      throw AppError.conflict('This complaint is closed, so it takes no new messages.');
    const images = projectImages(this.storage, c.projectId, input.images);
    const updated = await this.complaints.addComment(c.id, {
      authorId: actor.id,
      text: input.text ?? null,
      images,
      at: this.now(),
    });
    if (!updated) throw AppError.conflict('This complaint was just closed.');

    const [[me], names] = await Promise.all([
      this.directory.find([actor.id]),
      this.projects.names([c.projectId]),
    ]);
    await this.alerts.commented(
      updated,
      names[0]?.name ?? 'Project',
      actor.id,
      me?.name ?? 'Someone',
      input.text ?? 'Sent a photo',
      actor.role === 'CUSTOMER',
    );
    return (await this.views.build([updated], actor))[0]!;
  }
}

/** The author, or an Admin, removes a message. */
export class DeleteComplaintCommentUseCase {
  constructor(
    private readonly access: ComplaintAccess,
    private readonly complaints: ComplaintRepositoryPort,
    private readonly views: ComplaintViewBuilder,
  ) {}

  async execute(actor: Viewer, complaintId: string, commentId: string): Promise<ComplaintView> {
    const c = await this.access.load(complaintId, actor);
    const comment = c.comments.find((m) => m.id === commentId);
    if (!comment) throw AppError.notFound('Message not found.');
    if (actor.role !== 'ADMIN' && comment.authorId !== actor.id) throw AppError.forbidden();
    const updated = await this.complaints.removeComment(c.id, commentId);
    if (!updated) throw AppError.notFound('Message not found.');
    return (await this.views.build([updated], actor))[0]!;
  }
}
