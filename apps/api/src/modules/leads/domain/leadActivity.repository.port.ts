import type { LeadActivity, NewLeadActivity } from './leadActivity.entity.js';

export interface LeadActivityRepositoryPort {
  add(activity: NewLeadActivity): Promise<void>;
  /** Newest first. */
  listByLead(leadId: string): Promise<LeadActivity[]>;
}
