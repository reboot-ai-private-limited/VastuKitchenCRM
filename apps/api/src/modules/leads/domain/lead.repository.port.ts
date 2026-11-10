import type { LeadStatus } from '@vastu/contracts';
import type { Lead, LeadListFilter, LeadPatch, NewLead } from './lead.entity.js';

export interface StuckQuery {
  before: Date;
  after: Date;
  excludeStatuses: LeadStatus[];
  limit: number;
}

export interface LeadRepositoryPort {
  findById(id: string): Promise<Lead | null>;
  findByPhone(phone: string): Promise<Lead | null>;
  /** Existing leads among these phone numbers (import duplicate check). */
  findByPhones(phones: string[]): Promise<Lead[]>;
  /** Throws `AppError.conflict` if the phone is already used by another lead. */
  create(lead: NewLead): Promise<Lead>;
  /** Throws `AppError.conflict` if a changed phone is already used. */
  update(id: string, patch: LeadPatch): Promise<Lead | null>;
  findByIds(ids: string[]): Promise<Lead[]>;
  /**
   * Open leads (not Won/Lost) whose status last changed in `(after, before)` and that are not in
   * `excludeStatuses`. Oldest first, at most `limit`. Bounded on both sides so reminder runs stay small.
   */
  findStuck(query: StuckQuery): Promise<Lead[]>;
  list(filter: LeadListFilter): Promise<{ items: Lead[]; total: number }>;
}
