import type { LeadStatus, RoleName } from '@vastu/contracts';

export interface LeadState {
  id: string;
  name: string;
  status: LeadStatus;
  statusChangedAt: Date;
  assignedToId: string | null;
}

export interface LeadActor {
  id: string;
  role: RoleName;
}

export interface LeadForProposal {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  assignedToId: string | null;
}

/**
 * The only thing another module may import from `leads/`. Deliberately small: add to it when a
 * real consumer needs something.
 */
export interface LeadsPublicContract {
  /** Calls, answered calls and talk time per employee over `[from, to)` — dashboard performance. */
  callStats(
    from: Date,
    to: Date,
  ): Promise<Array<{ userId: string; calls: number; answered: number; talkSeconds: number }>>;

  /** Current status/assignee of these leads (unknown ids are absent). For reminders. */
  getLeadStates(ids: string[]): Promise<LeadState[]>;
  /**
   * Open leads (never Won/Lost) whose status last changed between `after` and `before`, minus
   * `excludeStatuses`; oldest first, at most `limit`. For the stagnant-lead reminder.
   */
  findStuckLeads(query: {
    before: Date;
    after: Date;
    excludeStatuses: LeadStatus[];
    limit: number;
  }): Promise<LeadState[]>;

  /** The lead if `actor` may access it; otherwise throws NOT FOUND. */
  getLeadForProposal(actor: LeadActor, leadId: string): Promise<LeadForProposal>;
  /** Logs a sent proposal on the timeline and moves the lead to PROPOSAL_SENT (unless Won/Lost). */
  recordProposalSent(actor: LeadActor, leadId: string, info: { number: string }): Promise<void>;
  /** Logs that the customer opened the proposal (no actor: it happened on the public page). */
  recordProposalSeen(leadId: string, info: { number: string }): Promise<void>;
}
