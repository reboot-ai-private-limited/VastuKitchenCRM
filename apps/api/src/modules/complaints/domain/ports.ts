import type {
  ComplaintCountsDto,
  NotificationRefDto,
  NotificationType,
  ProjectActivityType,
  ProjectStage,
  RoleName,
} from '@vastu/contracts';
import type { Complaint, ComplaintFilter, NewComplaint, Transition } from './complaint.entity.js';

export interface ComplaintRepositoryPort {
  create(input: NewComplaint): Promise<Complaint>;
  findById(id: string): Promise<Complaint | null>;
  /** Newest first. */
  list(
    filter: ComplaintFilter,
    page: { page: number; pageSize: number },
  ): Promise<{ items: Complaint[]; total: number }>;
  counts(filter: ComplaintFilter): Promise<ComplaintCountsDto>;
  /**
   * Applies `transition` only if the complaint is still in one of `transition.from`, in ONE atomic
   * step; null when it is not (someone else got there first) or does not exist.
   */
  transition(id: string, transition: Transition): Promise<Complaint | null>;
  /** Open or assigned and active since before `before`, oldest first. */
  findStale(before: Date, limit: number): Promise<Complaint[]>;
}

export interface ProjectBasics {
  id: string;
  name: string;
  memberIds: string[];
  customerId: string;
  stage: ProjectStage;
}

/** What complaints needs from projects (the adapter wraps projects' public contract). */
export interface ProjectsGatewayPort {
  basics(projectId: string): Promise<ProjectBasics | null>;
  names(projectIds: string[]): Promise<Array<{ id: string; name: string }>>;
  /** A timeline line on the project. Never throws: a timeline problem must not fail the action. */
  recordActivity(
    projectId: string,
    activity: { type: ProjectActivityType; actorId: string | null; data: Record<string, unknown> },
  ): Promise<void>;
}

export interface DirectoryUser {
  id: string;
  name: string;
  role: RoleName;
  active: boolean;
}

export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
  activeAdminIds(): Promise<string[]>;
}

export interface Alert {
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto;
}

/** Delivers alerts. It must never throw: a notification problem must not fail the action. */
export interface AlertSenderPort {
  send(userIds: string[], alert: Alert): Promise<void>;
}
