export interface SentProposalState {
  id: string;
  number: string;
  leadId: string;
  customerName: string;
  /** Who sent it, i.e. who a reminder falls back to when the lead has no assignee. */
  sentById: string | null;
  sentAt: Date;
  firstSeenAt: Date | null;
}

export interface ReminderWindow {
  before: Date;
  after: Date;
  limit: number;
}

/**
 * The only thing another module may import from `proposals/`. Read-only views for the reminders
 * module; both are bounded on both sides so a run stays small however old the data gets.
 */
export interface ProposalsPublicContract {
  /** Sent, never opened, `sentAt` in `(after, before)`. Oldest first. */
  findUnseenSent(window: ReminderWindow): Promise<SentProposalState[]>;
  /** Sent and opened, `firstSeenAt` in `(after, before)`. Oldest first. */
  findSeen(window: ReminderWindow): Promise<SentProposalState[]>;
  /** Read-only, for the dashboard: proposals each person made and sent in `[from, to)`. */
  activitySummary(
    from: Date,
    to: Date,
  ): Promise<
    Array<{ userId: string; generated: number; sent: number; firstAt: Date; lastAt: Date }>
  >;
  /** Read-only, for the dashboard: the latest SENT proposal total of each of these leads (rupees). */
  latestSentTotals(leadIds: string[]): Promise<Array<{ leadId: string; total: number }>>;
  /** Total (whole rupees) of the lead's most recently sent proposal, or null if none was sent. */
  getLatestSentTotal(leadId: string): Promise<number | null>;
}
