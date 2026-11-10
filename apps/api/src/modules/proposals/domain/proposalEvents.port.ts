import type { ProposalSeenEvent } from '@/shared/events/appEvents.js';

/** How proposals announces things to modules above it (notifications, reminders). */
export interface ProposalEventsPort {
  proposalSeen(event: ProposalSeenEvent): void;
}
