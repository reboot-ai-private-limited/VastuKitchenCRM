import { logger } from '@/shared/logging/logger.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type {
  ActorRef,
  Alert,
  AlertSenderPort,
  DirectoryUser,
  JourneyEntry,
  LeadInfo,
  LeadsGatewayPort,
  ProjectSettingsPort,
  ProposalsGatewayPort,
  UserDirectoryPort,
} from '../domain/ports.js';

/** Projects' only doors into the other modules: their public contracts. */

export class LeadsGateway implements LeadsGatewayPort {
  constructor(private readonly leads: LeadsPublicContract) {}

  async getLead(actor: ActorRef, leadId: string): Promise<LeadInfo> {
    const lead = await this.leads.getLeadForProposal(actor, leadId);
    return { id: lead.id, name: lead.name, phone: lead.phone, city: lead.city };
  }

  async canAccess(actor: ActorRef, leadId: string): Promise<boolean> {
    try {
      await this.leads.getLeadForProposal(actor, leadId);
      return true;
    } catch (err) {
      // "Not found" is how the leads module says "not yours". Anything else is a real fault.
      if ((err as { code?: string }).code === 'NOT_FOUND') return false;
      throw err;
    }
  }

  recordEvent(
    leadId: string,
    event: {
      type: 'PROJECT_CREATED' | 'PROJECT_CLOSED';
      projectName: string;
      byUserId: string | null;
    },
  ): Promise<void> {
    return this.leads.recordProjectEvent(leadId, event);
  }

  journey(actor: ActorRef, leadId: string): Promise<JourneyEntry[]> {
    return this.leads.getLeadJourney(actor, leadId);
  }
}

export class ProposalsGateway implements ProposalsGatewayPort {
  constructor(private readonly proposals: ProposalsPublicContract) {}

  latestSentTotal(leadId: string): Promise<number | null> {
    return this.proposals.getLatestSentTotal(leadId);
  }
}

export class IdentityUserDirectory implements UserDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  async find(ids: string[]): Promise<DirectoryUser[]> {
    if (ids.length === 0) return [];
    return this.identity.getUserSummaries(ids);
  }

  async ensureCustomer(input: { name: string; phone: string }): Promise<{ id: string }> {
    return { id: (await this.identity.createCustomer(input)).id };
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
    // A failed alert must never fail the post or comment that caused it: log it and move on.
    for (const r of results) {
      if (r.status === 'rejected')
        logger.error({ err: String(r.reason), type: alert.type }, 'project alert not delivered');
    }
  }
}

export class SettingsGateway implements ProjectSettingsPort {
  constructor(private readonly settings: SettingsPublicContract) {}

  autoCreateOnWon(): Promise<boolean> {
    return this.settings.get('projects.autoCreateOnWon');
  }
}
