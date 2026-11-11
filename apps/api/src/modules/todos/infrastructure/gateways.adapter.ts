import { logger } from '@/shared/logging/logger.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  DirectoryUser,
  Membership,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../domain/ports.js';

/** To-dos' only doors into the other modules: their public contracts. */

export class ProjectsGateway implements ProjectsGatewayPort {
  constructor(private readonly projects: ProjectsPublicContract) {}

  membership(actor: ActorRef, projectId: string): Promise<Membership> {
    return this.projects.getMembership(actor, projectId);
  }

  recordActivity(
    projectId: string,
    activity: Parameters<ProjectsGatewayPort['recordActivity']>[1],
  ): Promise<void> {
    return this.projects.recordActivity(projectId, activity);
  }

  accessible(actor: ActorRef, projectIds: string[]) {
    return this.projects.filterAccessible(actor, projectIds);
  }

  names(projectIds: string[]) {
    return this.projects.getProjectNames(projectIds);
  }
}

export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return this.identity.getUserSummaries(ids);
  }
}

export class NotificationsAlertSender implements AlertSenderPort {
  constructor(private readonly notifications: NotificationsPublicContract) {}

  async send(userIds: string[], alert: Alert): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.notifications.notify({ userId, ...alert })),
    );
    // A failed alert must never fail the change that caused it: log it and move on.
    for (const r of results) {
      if (r.status === 'rejected')
        logger.error({ err: String(r.reason), type: alert.type }, 'to-do alert not delivered');
    }
  }
}
