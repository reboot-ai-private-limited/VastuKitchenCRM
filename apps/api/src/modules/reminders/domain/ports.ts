import type { LeadStatus, NotificationRefDto, NotificationType } from '@vastu/contracts';

export interface SentProposal {
  id: string;
  number: string;
  leadId: string;
  customerName: string;
  sentById: string | null;
  sentAt: Date;
  firstSeenAt: Date | null;
}

export interface LeadSnapshot {
  id: string;
  name: string;
  status: LeadStatus;
  statusChangedAt: Date;
  assignedToId: string | null;
}

export interface Window {
  before: Date;
  after: Date;
  limit: number;
}

/** What reminders needs from proposals (the adapter wraps proposals' public contract). */
export interface ProposalSourcePort {
  findUnseenSent(window: Window): Promise<SentProposal[]>;
  findSeen(window: Window): Promise<SentProposal[]>;
}

/** What reminders needs from leads (the adapter wraps leads' public contract). */
export interface LeadSourcePort {
  states(ids: string[]): Promise<LeadSnapshot[]>;
  findStuck(window: Window & { excludeStatuses: LeadStatus[] }): Promise<LeadSnapshot[]>;
}

export interface OverdueTodo {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  /** `YYYY-MM-DD`. */
  dueOn: string;
  assigneeIds: string[];
  createdById: string;
}

/** What reminders needs from to-dos (the adapter wraps the to-dos public contract). */
export interface TodoSourcePort {
  /** Open, past due by the business calendar, not longer ago than `lookbackDays`. */
  findOverdue(window: { lookbackDays: number; limit: number }): Promise<OverdueTodo[]>;
}

export interface StaleComplaint {
  id: string;
  projectId: string;
  projectName: string;
  description: string;
  assignedToId: string | null;
  reopenCount: number;
  activeSince: Date;
}

/** What reminders needs from complaints (the adapter wraps the complaints public contract). */
export interface ComplaintSourcePort {
  /** Open or assigned, active since before `before`, oldest first. */
  findStale(window: { before: Date; limit: number }): Promise<StaleComplaint[]>;
}

export interface Reminder {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto;
  /** Same key + same person = delivered once, however often the job runs. */
  dedupeKey: string;
}

export interface NotifierPort {
  /** True when delivered now; false when this key had already been delivered to that person. */
  notify(reminder: Reminder): Promise<boolean>;
}

/** Fallback recipients when a reminder has no one else to go to. */
export interface AdminDirectoryPort {
  activeAdminIds(): Promise<string[]>;
}
