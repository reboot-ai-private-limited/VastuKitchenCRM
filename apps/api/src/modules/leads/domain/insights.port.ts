import type { LeadStatus } from '@vastu/contracts';

export interface UserLeadActivity {
  userId: string;
  /** Timeline entries this person made (status changes, assignments, calls, visits, proposals…). */
  actions: number;
  /** Distinct leads they acted on. */
  leadsHandled: number;
  firstAt: Date;
  lastAt: Date;
}

/** Read-only questions the dashboard asks of leads. */
export interface LeadInsightsPort {
  countsByStatus(): Promise<Record<LeadStatus, number>>;
  createdBetween(from: Date, to: Date): Promise<number>;
  activityByUser(from: Date, to: Date): Promise<UserLeadActivity[]>;
  /** Not Won/Lost, newest first. */
  openLeadIds(limit: number): Promise<string[]>;
  /** Won with the status last changed in `[from, to)`. */
  wonLeadIds(from: Date, to: Date, limit: number): Promise<string[]>;
}
