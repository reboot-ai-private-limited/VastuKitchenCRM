import type { EventBus, ProposalSeenEvent } from '@/shared/events/appEvents.js';
import type { ProposalEventsPort } from '../domain/proposalEvents.port.js';

export class AppEventsProposalEvents implements ProposalEventsPort {
  constructor(private readonly bus: EventBus) {}

  proposalSeen(event: ProposalSeenEvent): void {
    this.bus.emit('proposal.seen', event);
  }
}
