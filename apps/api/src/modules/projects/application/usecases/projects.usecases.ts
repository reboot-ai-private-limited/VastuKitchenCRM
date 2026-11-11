import type {
  CreateProjectBodyDto,
  ListProjectsQueryDto,
  SetMembersBodyDto,
  UpdateProjectBodyDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { scopeFor } from '@/shared/access/scope.js';
import type {
  ActorRef,
  LeadsGatewayPort,
  ProjectRepositoryPort,
  PostRepositoryPort,
  ProposalsGatewayPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { Project } from '../../domain/project.entity.js';
import type { ProjectAlerts } from '../services/projectAlerts.js';
import type { ProjectAccess } from '../services/projectAccess.js';
import type { ProjectView, ProjectViewBuilder } from '../services/projectViews.js';

const one = async (views: ProjectViewBuilder, project: Project): Promise<ProjectView> =>
  (await views.build([project]))[0]!;

/** Manual creation (Admin): for an existing customer, or for a lead (its customer is found or created). */
export class CreateProjectUseCase {
  constructor(
    private readonly projects: ProjectRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly proposals: ProposalsGatewayPort,
    private readonly directory: UserDirectoryPort,
    private readonly alerts: ProjectAlerts,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(actor: ActorRef, input: CreateProjectBodyDto): Promise<ProjectView> {
    let customerId: string;
    let leadId: string | null = null;

    if (input.leadId) {
      const lead = await this.leads.getLead(actor, input.leadId);
      customerId = (await this.directory.ensureCustomer({ name: lead.name, phone: lead.phone })).id;
      leadId = lead.id;
    } else {
      const [customer] = await this.directory.find([input.customerId!]);
      if (!customer || customer.role !== 'CUSTOMER' || !customer.active) {
        throw AppError.badRequest('Choose an existing customer.', [
          { path: ['customerId'], message: 'Not an active customer' },
        ]);
      }
      customerId = customer.id;
    }

    const project = await this.projects.create({
      name: input.name,
      customerId,
      leadId,
      wonLeadId: null,
      siteAddress: input.siteAddress ?? null,
      value: input.value ?? (leadId ? await this.proposals.latestSentTotal(leadId) : null),
      stage: 'DESIGN',
      designStage: 'NOT_STARTED',
      designerId: null,
      memberIds: [],
      createdById: actor.id,
      closedAt: null,
    });

    if (leadId) {
      await this.leads.recordEvent(leadId, {
        type: 'PROJECT_CREATED',
        projectName: project.name,
        byUserId: actor.id,
      });
    }
    await this.alerts.projectCreated(project, actor.id);
    return one(this.views, project);
  }
}

/**
 * Reacts to `lead.won` (wired at the composition root). IDEMPOTENT: one project per won lead, so
 * a replayed event creates nothing. A repeat customer's later project is made manually instead.
 */
export class CreateProjectFromWonLeadUseCase {
  constructor(
    private readonly projects: ProjectRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly proposals: ProposalsGatewayPort,
    private readonly alerts: ProjectAlerts,
  ) {}

  async execute(event: {
    leadId: string;
    customerId: string;
    name: string;
    byUserId: string;
  }): Promise<void> {
    const { project, created } = await this.projects.createFromWonLead({
      name: `${event.name}'s project`,
      customerId: event.customerId,
      leadId: event.leadId,
      wonLeadId: event.leadId,
      siteAddress: null,
      value: await this.proposals.latestSentTotal(event.leadId),
      stage: 'DESIGN',
      designStage: 'NOT_STARTED',
      designerId: null,
      memberIds: [],
      createdById: event.byUserId,
      closedAt: null,
    });
    if (!created) return;

    await this.leads.recordEvent(event.leadId, {
      type: 'PROJECT_CREATED',
      projectName: project.name,
      byUserId: event.byUserId,
    });
    await this.alerts.projectCreated(project);
  }
}

export class ListProjectsUseCase {
  constructor(
    private readonly projects: ProjectRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    query: ListProjectsQueryDto,
  ): Promise<{ items: ProjectView[]; total: number }> {
    const isAdmin = scopeFor(actor.role, 'projects') === 'all';
    // Someone who may access the lead (the Admin, the Sales person who owns it) can list that
    // lead's projects as a summary. Everyone else sees only projects they belong to.
    const viaLead = query.leadId ? await this.leads.canAccess(actor, query.leadId) : false;

    const { items, total } = await this.projects.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      stage: query.stage,
      designStage: query.designStage,
      designerId: query.designerId,
      customerId: query.customerId,
      leadId: query.leadId,
      visibleTo: isAdmin || viaLead ? undefined : actor.id,
    });
    return { items: await this.views.build(items), total };
  }
}

export class GetProjectUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(actor: ActorRef, id: string): Promise<ProjectView> {
    return one(this.views, (await this.access.loadForSummary(id, actor)).project);
  }
}

export class UpdateProjectUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(actor: ActorRef, id: string, input: UpdateProjectBodyDto): Promise<ProjectView> {
    await this.access.loadAsMember(id, actor);
    const updated = await this.projects.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.siteAddress !== undefined ? { siteAddress: input.siteAddress } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
    });
    if (!updated) throw AppError.notFound('Project not found.');
    return one(this.views, updated);
  }
}

/** Replaces the member list (Admin). Only active staff can be members; never a customer. */
export class SetMembersUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly alerts: ProjectAlerts,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(actor: ActorRef, id: string, input: SetMembersBodyDto): Promise<ProjectView> {
    const { project } = await this.access.loadAsMember(id, actor);

    // The designer is always a member too.
    const wanted = [
      ...new Set([...input.memberIds, ...(input.designerId ? [input.designerId] : [])]),
    ];
    const found = await this.directory.find(wanted);
    const byId = new Map(found.map((u) => [u.id, u]));
    for (const userId of wanted) {
      const user = byId.get(userId);
      if (!user || !user.active || user.role === 'CUSTOMER') {
        throw AppError.badRequest('Members must be active staff.', [
          { path: ['memberIds'], message: `${userId} is not an active staff member` },
        ]);
      }
    }

    const previous = new Set(project.memberIds);
    const updated = await this.projects.update(id, {
      memberIds: wanted,
      designerId: input.designerId,
    });
    if (!updated) throw AppError.notFound('Project not found.');

    await this.alerts.membersAdded(
      updated,
      wanted.filter((m) => !previous.has(m)),
      actor.id,
    );
    return one(this.views, updated);
  }
}

export class ChangeStageUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly views: ProjectViewBuilder,
  ) {}

  /** DESIGN ↔ SITE. Also how a closed project is reopened: it clears `closedAt`. */
  async execute(actor: ActorRef, id: string, stage: 'DESIGN' | 'SITE'): Promise<ProjectView> {
    await this.access.loadAsMember(id, actor);
    const updated = await this.projects.update(id, { stage, closedAt: null });
    if (!updated) throw AppError.notFound('Project not found.');
    return one(this.views, updated);
  }
}

export class ChangeDesignStageUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly views: ProjectViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    id: string,
    designStage: Project['designStage'],
  ): Promise<ProjectView> {
    const { project, viewer } = await this.access.loadAsMember(id, actor);
    // The Admin, or the project's own designer. Decided by the data, not by a role name.
    if (!viewer.isAdmin && project.designerId !== actor.id) throw AppError.forbidden();
    const updated = await this.projects.update(id, { designStage });
    if (!updated) throw AppError.notFound('Project not found.');
    return one(this.views, updated);
  }
}

/** Closing the deal needs the Final Delivery photo, as the business flow says. */
export class CloseProjectUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly posts: PostRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly alerts: ProjectAlerts,
    private readonly views: ProjectViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, id: string): Promise<ProjectView> {
    const { project } = await this.access.loadAsMember(id, actor);
    if (project.stage === 'CLOSED') throw AppError.conflict('This project is already closed.');
    if (!(await this.posts.hasFinalDelivery(id))) {
      throw AppError.conflict('Add a Final Delivery post with photos before closing the project.');
    }

    const updated = await this.projects.update(id, { stage: 'CLOSED', closedAt: this.now() });
    if (!updated) throw AppError.notFound('Project not found.');
    if (updated.leadId) {
      await this.leads.recordEvent(updated.leadId, {
        type: 'PROJECT_CLOSED',
        projectName: updated.name,
        byUserId: actor.id,
      });
    }
    await this.alerts.closed(updated, actor.id);
    return one(this.views, updated);
  }
}
