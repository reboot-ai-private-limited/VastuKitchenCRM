import type { ProjectActivityType, ProjectStage, RoleName } from '@vastu/contracts';

/** The only thing another module may import from `projects/`. */
export interface ProjectUserFeedActivity {
  userId: string;
  posts: number;
  comments: number;
  firstAt: Date;
  lastAt: Date;
}

/** Something a customer did on a project that the team may need to answer. */
export interface CustomerFeedItem {
  kind: 'POST' | 'COMMENT' | 'APPROVAL';
  at: Date;
  projectId: string;
  postId: string;
  authorId: string;
  snippet: string | null;
  hasPhotos: boolean;
}

export interface CustomerProjectSummary {
  id: string;
  name: string;
  customerId: string;
  stage: ProjectStage;
  createdAt: Date;
}

export interface ProjectsPublicContract {
  /** Read-only, for the dashboard: how many projects are in each stage. */
  countByStage(): Promise<Record<ProjectStage, number>>;
  /** Read-only, for the dashboard: posts and comments each person wrote in `[from, to)`. */
  feedActivitySummary(from: Date, to: Date): Promise<ProjectUserFeedActivity[]>;
  /** Read-only, for the dashboard: the latest customer posts, comments and approvals, newest first. */
  recentCustomerActivity(limit: number): Promise<CustomerFeedItem[]>;
  /**
   * Creates the project for a lead that was just won. IDEMPOTENT: one project per won lead, so a
   * replayed `lead.won` event creates nothing. Called by the composition root's subscriber.
   */
  createFromWonLead(event: {
    leadId: string;
    customerId: string;
    name: string;
    byUserId: string;
    /** An existing customer's lead started again: make one MORE project (not idempotent per lead). */
    again?: boolean;
  }): Promise<void>;
  /** Every project of these customers, newest first: for the Customers list and page. */
  getCustomerProjects(customerIds: string[]): Promise<CustomerProjectSummary[]>;

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
