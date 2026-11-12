import type { LeadStatus, RoleName } from '@vastu/contracts';
import type { CustomerLead } from './application/usecases/customerLeads.usecase.js';

export type { CustomerLead } from './application/usecases/customerLeads.usecase.js';

export interface LeadState {
  id: string;
  name: string;
  status: LeadStatus;
  statusChangedAt: Date;
  assignedToId: string | null;
}

export interface LeadJourneyEntry {
  id: string;
  type: string;
  at: Date;
  byUserId: string | null;
  byName: string | null;
  data: Record<string, unknown>;
}

/** How many leads are in each status, and how many were created in a period. */
export interface LeadDashboardCounts {
  byStatus: Record<LeadStatus, number>;
  createdInRange: number;
}

export interface LeadUserActivity {
  userId: string;
  actions: number;
  leadsHandled: number;
  firstAt: Date;
  lastAt: Date;
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

  /** Read-only, for the dashboard: leads per status and how many were created in `[from, to)`. */
  dashboardCounts(from: Date, to: Date): Promise<LeadDashboardCounts>;
  /** Read-only, for the dashboard: what each person did on leads in `[from, to)`. */
  activitySummary(from: Date, to: Date): Promise<LeadUserActivity[]>;
  /** Ids of leads not yet Won/Lost (newest first, at most `limit`) — to value the pipeline. */
  openLeadIds(limit: number): Promise<string[]>;
  /** Ids of leads won (status last changed) in `[from, to)`, at most `limit`. */
  wonLeadIds(from: Date, to: Date, limit: number): Promise<string[]>;
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

  /** A project was created or closed for this lead: adds it to the lead's timeline. */
  recordProjectEvent(
    leadId: string,
    event: {
      type: 'PROJECT_CREATED' | 'PROJECT_CLOSED';
      projectName: string;
      byUserId: string | null;
    },
  ): Promise<void>;
  /** The lead's story, oldest first, if `actor` may access the lead; otherwise NOT FOUND. */
  getLeadJourney(actor: LeadActor, leadId: string): Promise<LeadJourneyEntry[]>;

  /** The Customers list: leads that have an account, within what `actor` may see. */
  listCustomerLeads(
    actor: LeadActor,
    query: { search?: string; page: number; pageSize: number },
  ): Promise<{ items: CustomerLead[]; total: number }>;
  /** The lead behind a customer account, or NOT FOUND when `actor` may not see it. */
  findCustomerLead(actor: LeadActor, customerId: string): Promise<CustomerLead>;
  /** A customer added by hand or imported: creates or links their lead (see AddCustomerLeadUseCase). */
  addCustomerLead(
    actor: LeadActor,
    input: { name: string; phone: string; city: string | null; customerId: string },
  ): Promise<{ lead: CustomerLead; created: boolean }>;
  /** Puts an existing customer's lead back into the pipeline for a new project. */
  startNewProject(actor: LeadActor, customerId: string): Promise<CustomerLead>;
}
