import type { PostVisibility } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { scopeFor } from '@/shared/access/scope.js';
import type { ActorRef, LeadsGatewayPort, ProjectRepositoryPort } from '../../domain/ports.js';
import type { Project } from '../../domain/project.entity.js';

/**
 * What the caller IS in relation to one project — derived from the data (is this their project?),
 * never from a role name. That is what lets an Office person or an Accountant be added as a
 * member without any code knowing about their role.
 */
export interface Viewer {
  actor: ActorRef;
  /** Sees every project (the Admin). */
  isAdmin: boolean;
  /** The project's customer: sees and writes the CLIENT tab only. */
  isCustomer: boolean;
  isMember: boolean;
}

export interface Access {
  project: Project;
  viewer: Viewer;
}

export function viewerOf(project: Project, actor: ActorRef): Viewer {
  return {
    actor,
    isAdmin: scopeFor(actor.role, 'projects') === 'all',
    isCustomer: actor.id === project.customerId,
    isMember: project.memberIds.includes(actor.id),
  };
}

/** The tabs this viewer may read. The customer never sees TEAM. */
export function visibleTabs(viewer: Viewer): PostVisibility[] {
  return viewer.isCustomer ? ['CLIENT'] : ['CLIENT', 'TEAM'];
}

export class ProjectAccess {
  constructor(
    private readonly projects: ProjectRepositoryPort,
    private readonly leads: LeadsGatewayPort,
  ) {}

  /** For the feed, comments, uploads: the Admin, a member, or the customer. Anyone else: NOT FOUND. */
  async loadAsMember(id: string, actor: ActorRef): Promise<Access> {
    const project = await this.projects.findById(id);
    if (!project) throw AppError.notFound('Project not found.');
    const viewer = viewerOf(project, actor);
    if (!viewer.isAdmin && !viewer.isMember && !viewer.isCustomer) {
      throw AppError.notFound('Project not found.');
    }
    return { project, viewer };
  }

  /**
   * For the read-only summary and the lead journey: everyone above, plus anyone who may access the
   * project's lead (the Sales person who owns it). They get the summary, never the feeds.
   */
  async loadForSummary(id: string, actor: ActorRef): Promise<Access> {
    const project = await this.projects.findById(id);
    if (!project) throw AppError.notFound('Project not found.');
    const viewer = viewerOf(project, actor);
    if (viewer.isAdmin || viewer.isMember || viewer.isCustomer) return { project, viewer };
    if (project.leadId && (await this.leads.canAccess(actor, project.leadId)))
      return { project, viewer };
    throw AppError.notFound('Project not found.');
  }
}
