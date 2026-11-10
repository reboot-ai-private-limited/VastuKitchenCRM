import type { Lead, LeadListFilter, LeadPatch, NewLead } from './lead.entity.js';

export interface LeadRepositoryPort {
  findById(id: string): Promise<Lead | null>;
  findByPhone(phone: string): Promise<Lead | null>;
  /** Existing leads among these phone numbers (import duplicate check). */
  findByPhones(phones: string[]): Promise<Lead[]>;
  /** Throws `AppError.conflict` if the phone is already used by another lead. */
  create(lead: NewLead): Promise<Lead>;
  /** Throws `AppError.conflict` if a changed phone is already used. */
  update(id: string, patch: LeadPatch): Promise<Lead | null>;
  list(filter: LeadListFilter): Promise<{ items: Lead[]; total: number }>;
}
