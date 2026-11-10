import type { LeadActivityType } from '@vastu/contracts';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  byUserId: string | null;
  at: Date;
  data: Record<string, unknown>;
}

export type NewLeadActivity = Omit<LeadActivity, 'id'>;
