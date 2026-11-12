import { CLOSED_LEAD_STATUSES, type LeadSource, type LeadStatus } from '@vastu/contracts';

export interface Lead {
  id: string;
  name: string;
  /** 10 digits, unique across leads. */
  phone: string;
  altPhone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  source: LeadSource;
  status: LeadStatus;
  /** Reset on every status change; what "stuck" is measured from. */
  statusChangedAt: Date;
  assignedToId: string | null;
  lostReason: string | null;
  /** The CUSTOMER account created when the lead was first won. */
  customerId: string | null;
  /**
   * Set when an existing customer's lead is started again for a new project; the next win makes
   * that project and clears it. Winning without it never creates a second project.
   */
  newProjectRequested: boolean;
  createdById: string | null;
  createdAt: Date;
}

export type NewLead = Omit<Lead, 'id' | 'createdAt' | 'newProjectRequested'> & {
  newProjectRequested?: boolean;
};
export type LeadPatch = Partial<Omit<Lead, 'id' | 'createdAt'>>;

/** Not finished (Won/Lost) and unchanged for longer than `days`. */
export function isStuck(
  lead: Pick<Lead, 'status' | 'statusChangedAt'>,
  days: number,
  now: Date,
): boolean {
  if (CLOSED_LEAD_STATUSES.includes(lead.status)) return false;
  return now.getTime() - lead.statusChangedAt.getTime() > days * 86_400_000;
}

export interface LeadListFilter {
  page: number;
  pageSize: number;
  search?: string | undefined;
  status?: LeadStatus | undefined;
  source?: LeadSource | undefined;
  /** `undefined` = any assignee, `null` = unassigned, string = that user. */
  assignedToId?: string | null | undefined;
  /** Only leads that have a customer account (the Customers list). */
  customersOnly?: boolean | undefined;
  /** Only leads (not Won/Lost) whose status last changed before this moment. */
  stuckBefore?: Date | undefined;
}
