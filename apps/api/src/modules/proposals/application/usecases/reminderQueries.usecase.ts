import type { Proposal } from '../../domain/proposal.entity.js';
import type {
  ProposalRepositoryPort,
  ReminderWindow,
} from '../../domain/proposal.repository.port.js';

export interface SentProposalState {
  id: string;
  number: string;
  leadId: string;
  customerName: string;
  sentById: string | null;
  sentAt: Date;
  firstSeenAt: Date | null;
}

const toState = (p: Proposal): SentProposalState => ({
  id: p.id,
  number: p.number,
  leadId: p.leadId,
  customerName: p.customer.name,
  sentById: p.sentById,
  // A SENT proposal always has `sentAt`; the fallback only satisfies the type.
  sentAt: p.sentAt ?? p.createdAt,
  firstSeenAt: p.firstSeenAt,
});

/** Read-only views for the reminders module (through the public contract). */
export class ProposalReminderQueriesUseCase {
  constructor(private readonly proposals: ProposalRepositoryPort) {}

  async unseen(window: ReminderWindow): Promise<SentProposalState[]> {
    return (await this.proposals.findUnseenSent(window)).map(toState);
  }

  async seen(window: ReminderWindow): Promise<SentProposalState[]> {
    return (await this.proposals.findSeen(window)).map(toState);
  }
}
