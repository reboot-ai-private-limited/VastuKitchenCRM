import type { LeadStatus } from '@vastu/contracts';
import type { Lead } from '../../domain/lead.entity.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';

export interface LeadState {
  id: string;
  name: string;
  status: LeadStatus;
  statusChangedAt: Date;
  assignedToId: string | null;
}

const toState = (l: Lead): LeadState => ({
  id: l.id,
  name: l.name,
  status: l.status,
  statusChangedAt: l.statusChangedAt,
  assignedToId: l.assignedToId,
});

/** Read-only views for the reminders module (through the public contract). */
export class ReminderQueriesUseCase {
  constructor(private readonly leads: LeadRepositoryPort) {}

  async states(ids: string[]): Promise<LeadState[]> {
    return ids.length === 0 ? [] : (await this.leads.findByIds(ids)).map(toState);
  }

  async findStuck(query: {
    before: Date;
    after: Date;
    excludeStatuses: LeadStatus[];
    limit: number;
  }): Promise<LeadState[]> {
    return (await this.leads.findStuck(query)).map(toState);
  }
}
