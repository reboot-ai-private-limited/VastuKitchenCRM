import type { CreateLeadBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { Lead } from '../../domain/lead.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor } from '../services/leadAccess.js';

export class CreateLeadUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, input: CreateLeadBodyDto): Promise<Lead> {
    const existing = await this.leads.findByPhone(input.phone);
    if (existing) {
      throw AppError.conflict('A lead with this phone number already exists.', {
        existingLeadId: existing.id,
      });
    }

    const now = this.now();
    const lead = await this.leads.create({
      name: input.name,
      phone: input.phone,
      altPhone: input.altPhone ?? null,
      email: input.email ?? null,
      city: input.city ?? null,
      notes: input.notes ?? null,
      source: input.source,
      status: 'NEW',
      statusChangedAt: now,
      // A sales person who adds a lead owns it; Admin/Office leads wait for an assignment.
      assignedToId: actor.role === 'SALES' ? actor.id : null,
      lostReason: null,
      customerId: null,
      createdById: actor.id,
    });
    await this.activities.add({
      leadId: lead.id,
      type: 'CREATED',
      byUserId: actor.id,
      at: now,
      data: { source: lead.source },
    });
    return lead;
  }
}
