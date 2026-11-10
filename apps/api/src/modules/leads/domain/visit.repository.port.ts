import type { NewVisit, Visit } from './visit.entity.js';

export interface VisitRepositoryPort {
  create(visit: NewVisit): Promise<Visit>;
  listByLead(leadId: string): Promise<Visit[]>;
}
