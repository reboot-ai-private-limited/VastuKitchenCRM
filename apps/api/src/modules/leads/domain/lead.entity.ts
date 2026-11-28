import {
  CLOSED_LEAD_STATUSES,
  type LeadProductOfInterest,
  type LeadSource,
  type LeadStatus,
} from '@vastu/contracts';

export interface Lead {
  id: string;
  name: string;
  /** Normalized phone (10 digits for India, +975/+977 for Bhutan/Nepal), unique across leads. */
  phone: string;
  altPhone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  productsOfInterest: LeadProductOfInterest[];
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
  /** Start of the latest answered call; an unanswered attempt is not contact. */
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  nextAction: string | null;
  createdAt: Date;
}

/** Fields a new lead may leave out; the repository fills in the empty value. */
type DefaultedLeadKeys =
  | 'newProjectRequested'
  | 'productsOfInterest'
  | 'lastContactedAt'
  | 'nextFollowUpAt'
  | 'nextAction';
export type NewLead = Omit<Lead, 'id' | 'createdAt' | DefaultedLeadKeys> &
  Partial<Pick<Lead, DefaultedLeadKeys>>;
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
  /** Restrict to a set of statuses (e.g. Designer team sees measurement-done onwards). */
  statuses?: readonly LeadStatus[] | undefined;
  source?: LeadSource | readonly LeadSource[] | undefined;
  product?: LeadProductOfInterest | readonly LeadProductOfInterest[] | undefined;
  /** `undefined` = any assignee, `null` = unassigned, string = that user. */
  assignedToId?: string | null | undefined;
  /** Only leads that have a customer account (the Customers list). */
  customersOnly?: boolean | undefined;
  /** Only leads (not Won/Lost) whose status last changed before this moment. */
  stuckBefore?: Date | undefined;
  /** Hide LOST leads unless explicitly requested. */
  excludeLost?: boolean | undefined;
  /** Only open leads with a follow-up before this moment, soonest first. */
  followUpBefore?: Date | undefined;
}
