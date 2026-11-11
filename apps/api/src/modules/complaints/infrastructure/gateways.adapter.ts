import { logger } from '@/shared/logging/logger.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type {
  Alert,
  AlertSenderPort,
  DirectoryUser,
  ProjectBasics,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../domain/ports.js';

/** Complaints' only doors into the other modules: their public contracts. */

export class ProjectsGateway implements ProjectsGatewayPort {
  constructor(private readonly projects: ProjectsPublicContract) {}

  basics(projectId: string): Promise<ProjectBasics | null> {
    return this.projects.getProjectBasics(projectId);
  }

  names(projectIds: string[]) {
    return this.projects.getProjectNames(projectIds);
  }

  async recordActivity(
    projectId: string,
    activity: Parameters<ProjectsGatewayPort['recordActivity']>[1],
  ): Promise<void> {
    try {
      await this.projects.recordActivity(projectId, activity);
    } catch (err) {
      // A missing timeline line must never undo a complaint action.
      logger.error(
        { err: String(err), type: activity.type },
        'complaint timeline line not written',
      );
    }
  }
}

export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return (await this.identity.getUserSummaries(ids)).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      active: u.active,
    }));
  }

  activeAdminIds(): Promise<string[]> {
    return this.identity.getActiveAdminIds();
  }
}

export class NotificationsAlertSender implements AlertSenderPort {
  constructor(private readonly notifications: NotificationsPublicContract) {}

  async send(userIds: string[], alert: Alert): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.notifications.notify({ userId, ...alert })),
    );
    for (const r of results) {
      if (r.status === 'rejected')
        logger.error({ err: String(r.reason), type: alert.type }, 'complaint alert not delivered');
    }
  }
}
