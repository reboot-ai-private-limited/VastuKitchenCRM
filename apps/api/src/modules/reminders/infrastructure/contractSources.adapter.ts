import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { TodosPublicContract } from '@/modules/todos/todos.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type {
  AdminDirectoryPort,
  LeadSnapshot,
  LeadSourcePort,
  NotifierPort,
  OverdueTodo,
  ProposalSourcePort,
  Reminder,
  SentProposal,
  TodoSourcePort,
  Window,
} from '../domain/ports.js';
import type { LeadStatus } from '@vastu/contracts';

/** Reminders' only doors into the other modules: their public contracts. */

export class ProposalsContractSource implements ProposalSourcePort {
  constructor(private readonly proposals: ProposalsPublicContract) {}

  findUnseenSent(window: Window): Promise<SentProposal[]> {
    return this.proposals.findUnseenSent(window);
  }

  findSeen(window: Window): Promise<SentProposal[]> {
    return this.proposals.findSeen(window);
  }
}

export class LeadsContractSource implements LeadSourcePort {
  constructor(private readonly leads: LeadsPublicContract) {}

  states(ids: string[]): Promise<LeadSnapshot[]> {
    return this.leads.getLeadStates(ids);
  }

  findStuck(window: Window & { excludeStatuses: LeadStatus[] }): Promise<LeadSnapshot[]> {
    return this.leads.findStuckLeads(window);
  }
}

export class NotificationsContractNotifier implements NotifierPort {
  constructor(private readonly notifications: NotificationsPublicContract) {}

  async notify(reminder: Reminder): Promise<boolean> {
    return (await this.notifications.notify(reminder)).created;
  }
}

export class IdentityAdminDirectory implements AdminDirectoryPort {
  constructor(private readonly identity: IdentityPublicContract) {}

  activeAdminIds(): Promise<string[]> {
    return this.identity.getActiveAdminIds();
  }
}

export class TodosContractSource implements TodoSourcePort {
  constructor(private readonly todos: TodosPublicContract) {}

  findOverdue(window: { lookbackDays: number; limit: number }): Promise<OverdueTodo[]> {
    return this.todos.findOverdue(window);
  }
}
