import { CLOSED_LEAD_STATUSES } from '@vastu/contracts';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';

export interface LeadForProposal {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  assignedToId: string | null;
}

/** The lead a proposal is about, if the actor may access it (else NOT FOUND, as everywhere). */
export class GetLeadForProposalUseCase {
  constructor(private readonly access: LeadAccess) {}

  async execute(actor: Actor, leadId: string): Promise<LeadForProposal> {
    const lead = await this.access.load(leadId, actor);
    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      city: lead.city,
      assignedToId: lead.assignedToId,
    };
  }
}

/**
 * A proposal was sent: log it, and move the lead to PROPOSAL_SENT unless it is already finished.
 * Sending counts as movement even when the status is already PROPOSAL_SENT (a second proposal),
 * so `statusChangedAt` is reset — otherwise the lead would look stuck right after a send.
 */
export class RecordProposalSentUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, leadId: string, info: { number: string }): Promise<void> {
    const lead = await this.access.load(leadId, actor);
    const now = this.now();
    // Captured first: a repository may hand back a live object that the update below mutates.
    const previousStatus = lead.status;
    await this.activities.add({
      leadId,
      type: 'PROPOSAL_SENT',
      byUserId: actor.id,
      at: now,
      data: { number: info.number },
    });

    if (CLOSED_LEAD_STATUSES.includes(previousStatus)) return;
    await this.leads.update(leadId, { status: 'PROPOSAL_SENT', statusChangedAt: now });
    if (previousStatus !== 'PROPOSAL_SENT') {
      await this.activities.add({
        leadId,
        type: 'STATUS_CHANGED',
        byUserId: actor.id,
        at: now,
        data: { from: previousStatus, to: 'PROPOSAL_SENT', auto: true },
      });
    }
  }
}

/** The customer opened the proposal. No actor: it happened on the public page. */
export class RecordProposalSeenUseCase {
  constructor(
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(leadId: string, info: { number: string }): Promise<void> {
    await this.activities.add({
      leadId,
      type: 'PROPOSAL_SEEN',
      byUserId: null,
      at: this.now(),
      data: { number: info.number },
    });
  }
}
