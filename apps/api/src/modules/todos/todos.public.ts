export interface OverdueTodoState {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  /** `YYYY-MM-DD`. */
  dueOn: string;
  assigneeIds: string[];
  createdById: string;
}

/** The only thing another module may import from `todos/`. Read-only, for the reminders module. */
export interface TodosPublicContract {
  /**
   * Open to-dos that are past due (by the business calendar) and not more than `lookbackDays` past
   * it, oldest first, at most `limit`.
   */
  findOverdue(window: { lookbackDays: number; limit: number }): Promise<OverdueTodoState[]>;
}
