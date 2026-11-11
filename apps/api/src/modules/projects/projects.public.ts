import type { ProjectActivityType, ProjectStage, RoleName } from '@vastu/contracts';

/** The only thing another module may import from `projects/`. */
export interface ProjectsPublicContract {
  /**
   * Creates the project for a lead that was just won. IDEMPOTENT: one project per won lead, so a
   * replayed `lead.won` event creates nothing. Called by the composition root's subscriber.
   */
  createFromWonLead(event: {
    leadId: string;
    customerId: string;
    name: string;
    byUserId: string;
  }): Promise<void>;

  /** Admin or member (never the customer): the project's name and members, or NOT FOUND. */
  getMembership(
    actor: { id: string; role: RoleName },
    projectId: string,
  ): Promise<{
    id: string;
    name: string;
    memberIds: string[];
    stage: ProjectStage;
  }>;
  /**
   * What `actor` is on this project — `ADMIN`, `MEMBER` or `CUSTOMER` — with its members and
   * customer. NOT FOUND for anyone else. (Unlike `getMembership`, the customer is allowed.)
   */
  getProjectAccess(
    actor: { id: string; role: RoleName },
    projectId: string,
  ): Promise<{
    id: string;
    name: string;
    memberIds: string[];
    customerId: string;
    role: 'ADMIN' | 'MEMBER' | 'CUSTOMER';
    stage: ProjectStage;
  }>;
  /**
   * A project's basics WITHOUT any access check — for modules that apply their own rules (e.g.
   * complaints: reception may raise one on any project). Null when there is no such project.
   */
  getProjectBasics(projectId: string): Promise<{
    id: string;
    name: string;
    memberIds: string[];
    customerId: string;
    stage: ProjectStage;
  } | null>;
  /** Names of these projects, for whoever asks (e.g. reminder text). Unknown ids are absent. */
  getProjectNames(projectIds: string[]): Promise<Array<{ id: string; name: string }>>;
  /** Adds a line to the project's team timeline. */
  recordActivity(
    projectId: string,
    activity: {
      type: ProjectActivityType;
      actorId: string | null;
      data: Record<string, unknown>;
    },
  ): Promise<void>;
  /** Of these projects, the ones `actor` may use as staff (Admin: all; otherwise a member), with names. */
  filterAccessible(
    actor: { id: string; role: RoleName },
    projectIds: string[],
  ): Promise<Array<{ id: string; name: string }>>;
}
