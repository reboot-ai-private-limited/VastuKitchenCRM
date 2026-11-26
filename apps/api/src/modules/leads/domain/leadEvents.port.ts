import type {
  LeadAssignedEvent,
  LeadCreatedEvent,
  LeadDesignCompletedEvent,
  LeadMeasurementDoneEvent,
  LeadWonEvent,
} from '@/shared/events/appEvents.js';

/** How the leads module announces things to modules above it, without knowing who listens. */
export interface LeadEventsPort {
  leadWon(event: LeadWonEvent): void;
  leadAssigned(event: LeadAssignedEvent): void;
  leadCreated(event: LeadCreatedEvent): void;
  leadMeasurementDone?(event: LeadMeasurementDoneEvent): void;
  leadDesignCompleted?(event: LeadDesignCompletedEvent): void;
}
