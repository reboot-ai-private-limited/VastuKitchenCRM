import type { ProjectActivityType } from '@vastu/contracts';

/** A compact "change log" line on the project timeline. Team-only: the customer never sees these. */
export interface ProjectActivity {
  id: string;
  projectId: string;
  type: ProjectActivityType;
  actorId: string | null;
  at: Date;
  data: Record<string, unknown>;
}

export type NewProjectActivity = Omit<ProjectActivity, 'id'>;

export interface ActivityListQuery {
  projectId: string;
  before?: Date | undefined;
  limit: number;
}
