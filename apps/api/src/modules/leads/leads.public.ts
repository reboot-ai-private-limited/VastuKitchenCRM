import type { RoleName } from '@vastu/contracts';

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

  /** The lead if `actor` may access it; otherwise throws NOT FOUND. */
  getLeadForProposal(actor: LeadActor, leadId: string): Promise<LeadForProposal>;
  /** Logs a sent proposal on the timeline and moves the lead to PROPOSAL_SENT (unless Won/Lost). */
  recordProposalSent(actor: LeadActor, leadId: string, info: { number: string }): Promise<void>;
  /** Logs that the customer opened the proposal (no actor: it happened on the public page). */
  recordProposalSeen(leadId: string, info: { number: string }): Promise<void>;
}
