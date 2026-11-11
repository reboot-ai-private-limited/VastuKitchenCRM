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
}
