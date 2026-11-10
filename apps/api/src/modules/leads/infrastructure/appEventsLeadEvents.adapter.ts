import type { EventBus, LeadAssignedEvent, LeadWonEvent } from '@/shared/events/appEvents.js';
import type { LeadEventsPort } from '../domain/leadEvents.port.js';

export class AppEventsLeadEvents implements LeadEventsPort {
  constructor(private readonly bus: EventBus) {}

  leadWon(event: LeadWonEvent): void {
    this.bus.emit('lead.won', event);
  }

  leadAssigned(event: LeadAssignedEvent): void {
    this.bus.emit('lead.assigned', event);
  }
}
