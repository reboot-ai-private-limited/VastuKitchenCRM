import type { ComplaintCountsDto } from '@vastu/contracts';

export interface StaleComplaintState {
  id: string;
  projectId: string;
  projectName: string;
  description: string;
  assignedToId: string | null;
  /** Counts a reopen as a new reminder. */
  reopenCount: number;
  activeSince: Date;
}

/** The only thing another module may import from `complaints/`. Read-only, for reminders. */
export interface ComplaintsPublicContract {
  /** Read-only, for the dashboard: how many complaints are in each status (everyone's). */
  countByStatus(): Promise<ComplaintCountsDto>;
  /** Open or assigned complaints active since before `before`, oldest first, at most `limit`. */
  findStale(window: { before: Date; limit: number }): Promise<StaleComplaintState[]>;
}
