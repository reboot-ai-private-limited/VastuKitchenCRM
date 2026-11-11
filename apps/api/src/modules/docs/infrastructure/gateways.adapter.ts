import { logger } from '@/shared/logging/logger.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  DirectoryUser,
  DocsSettingsPort,
  ProjectAccess,
  ProjectsGatewayPort,
  UserDirectoryPort,
} from '../domain/ports.js';

/** Docs' only doors into the other modules: their public contracts. */

export class ProjectsGateway implements ProjectsGatewayPort {
  constructor(private readonly projects: ProjectsPublicContract) {}

  access(actor: ActorRef, projectId: string): Promise<ProjectAccess> {
    return this.projects.getProjectAccess(actor, projectId);
  }

  recordActivity(
    projectId: string,
    activity: Parameters<ProjectsGatewayPort['recordActivity']>[1],
  ): Promise<void> {
    return this.projects.recordActivity(projectId, activity);
  }
}

export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return (await this.identity.getUserSummaries(ids)).map((u) => ({ id: u.id, name: u.name }));
  }

  activeAdminIds(): Promise<string[]> {
    return this.identity.getActiveAdminIds();
  }
}

export class SettingsGateway implements DocsSettingsPort {
  constructor(private readonly settings: SettingsPublicContract) {}

  maxFileMb(): Promise<number> {
    return this.settings.get('docs.maxFileMb');
  }
}

export class NotificationsAlertSender implements AlertSenderPort {
  constructor(private readonly notifications: NotificationsPublicContract) {}

  async send(userIds: string[], alert: Alert): Promise<void> {
    const results = await Promise.allSettled(
      userIds.map((userId) => this.notifications.notify({ userId, ...alert })),
    );
    // A failed alert must never fail the upload that caused it: log it and move on.
    for (const r of results) {
      if (r.status === 'rejected')
        logger.error({ err: String(r.reason), type: alert.type }, 'document alert not delivered');
    }
  }
}
