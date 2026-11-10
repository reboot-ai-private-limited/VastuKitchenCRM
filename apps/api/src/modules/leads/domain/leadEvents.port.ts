import type { LeadAssignedEvent, LeadWonEvent } from '@/shared/events/appEvents.js';

/** How the leads module announces things to modules above it, without knowing who listens. */
export interface LeadEventsPort {
  leadWon(event: LeadWonEvent): void;
  leadAssigned(event: LeadAssignedEvent): void;
}
