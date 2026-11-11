import type { DesignStage, ProjectStage } from '@vastu/contracts';

export interface Project {
  id: string;
  name: string;
  /** The customer (a CUSTOMER user). One customer can have many projects. */
  customerId: string;
  /** The lead it came from, if any. A repeat customer's new project has none. */
  leadId: string | null;
  /** Set ONLY for a project auto-created when that lead was won: its unique index makes the creation idempotent. */
  wonLeadId: string | null;
  siteAddress: string | null;
  /** Rupees. */
  value: number | null;
  stage: ProjectStage;
  designStage: DesignStage;
  /** The primary designer (the "design view" filters on it). Always also in `memberIds`. */
  designerId: string | null;
  /** Staff with access to the project. The customer is separate (`customerId`). */
  memberIds: string[];
  createdById: string | null;
  closedAt: Date | null;
  createdAt: Date;
}

export type NewProject = Omit<Project, 'id' | 'createdAt'>;
export type ProjectPatch = Partial<
  Pick<
    Project,
    | 'name'
    | 'siteAddress'
    | 'value'
    | 'stage'
    | 'designStage'
    | 'designerId'
    | 'memberIds'
    | 'closedAt'
  >
>;

export interface ProjectListFilter {
  page: number;
  pageSize: number;
  search?: string | undefined;
  stage?: ProjectStage | undefined;
  designStage?: DesignStage | undefined;
  designerId?: string | undefined;
  customerId?: string | undefined;
  leadId?: string | undefined;
  /** Only projects this person belongs to (as a member or as the customer). Unset = no restriction. */
  visibleTo?: string | undefined;
}
