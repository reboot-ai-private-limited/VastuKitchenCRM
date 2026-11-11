import type { ComplaintEventType, ComplaintStatus, RoleName } from '@vastu/contracts';
import type { StoredImageRef } from '@/shared/storage/attachImages.js';

export interface ComplaintEvent {
  type: ComplaintEventType;
  at: Date;
  actorId: string | null;
  /** The reason on REOPENED; the note on RESOLVED / CLOSED. */
  note: string | null;
  /** On ASSIGNED: who it went to. */
  assigneeId: string | null;
}

export interface Complaint {
  id: string;
  projectId: string;
  /** The project's customer, copied at raise time: it decides who may see the complaint. */
  customerId: string;
  description: string;
  images: StoredImageRef[];
  status: ComplaintStatus;
  raisedById: string | null;
  assignedToId: string | null;
  resolutionNote: string | null;
  resolutionImages: StoredImageRef[];
  createdAt: Date;
  /** When it last became active: created, or reopened. The overdue reminder counts from here. */
  activeSince: Date;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  reopenCount: number;
  events: ComplaintEvent[];
}

export type NewComplaint = Pick<
  Complaint,
  'projectId' | 'customerId' | 'description' | 'images' | 'raisedById'
> & { at: Date };

export interface ComplaintFilter {
  status?: ComplaintStatus;
  projectId?: string;
  assignedToId?: string;
  /** Set for people who do not see every complaint: only those they are part of. */
  involving?: string;
}

/** A state change, applied atomically only while the complaint is still in one of `from`. */
export interface Transition {
  from: ComplaintStatus[];
  set: Partial<
    Pick<
      Complaint,
      | 'status'
      | 'assignedToId'
      | 'assignedAt'
      | 'resolutionNote'
      | 'resolutionImages'
      | 'resolvedAt'
      | 'closedAt'
      | 'activeSince'
    >
  >;
  incReopen?: boolean;
  event: ComplaintEvent;
}

export interface Viewer {
  id: string;
  role: RoleName;
}
