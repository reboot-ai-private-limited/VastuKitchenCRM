import type {
  EventBus,
  LeadAssignedEvent,
  LeadCreatedEvent,
  LeadDesignCompletedEvent,
  LeadMeasurementDoneEvent,
  LeadWonEvent,
} from '@/shared/events/appEvents.js';
import type { LeadEventsPort } from '../domain/leadEvents.port.js';

export class AppEventsLeadEvents implements LeadEventsPort {
  constructor(private readonly bus: EventBus) {}

  leadWon(event: LeadWonEvent): void {
    this.bus.emit('lead.won', event);
  }

  leadCreated(event: LeadCreatedEvent): void {
    this.bus.emit('lead.created', event);
  }

  leadAssigned(event: LeadAssignedEvent): void {
    this.bus.emit('lead.assigned', event);
  }

  leadMeasurementDone(event: LeadMeasurementDoneEvent): void {
    this.bus.emit('lead.measurementDone', event);
  }

  leadDesignCompleted(event: LeadDesignCompletedEvent): void {
    this.bus.emit('lead.designCompleted', event);
  }
}
