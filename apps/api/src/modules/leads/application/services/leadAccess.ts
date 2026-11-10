import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { scopeFor } from '@/shared/access/scope.js';
import type { Lead } from '../../domain/lead.entity.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';

export interface Actor {
  id: string;
  role: RoleName;
}

/**
 * Loads a lead the actor is allowed to touch. A lead outside the actor's scope is reported as
 * NOT FOUND, not forbidden, so ids of other people's leads cannot be probed.
 */
export class LeadAccess {
  constructor(private readonly leads: LeadRepositoryPort) {}

  async load(id: string, actor: Actor): Promise<Lead> {
    const lead = await this.leads.findById(id);
    if (!lead) throw AppError.notFound('Lead not found.');
    if (scopeFor(actor.role, 'leads') === 'assigned' && lead.assignedToId !== actor.id) {
      throw AppError.notFound('Lead not found.');
    }
    return lead;
  }
}
