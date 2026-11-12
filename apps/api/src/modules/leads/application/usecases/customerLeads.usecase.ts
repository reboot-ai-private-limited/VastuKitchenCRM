import type { LeadSource, LeadStatus } from '@vastu/contracts';
import { scopeFor } from '@/shared/access/scope.js';
import { AppError } from '@/shared/errors/AppError.js';
import type { Lead } from '../../domain/lead.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor } from '../services/leadAccess.js';

/** A lead that has a customer account: the person's record, and the home of their timeline. */
export interface CustomerLead {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  customerId: string;
  status: LeadStatus;
  source: LeadSource;
  statusChangedAt: Date;
  assignedToId: string | null;
  createdAt: Date;
}

const toCustomerLead = (l: Lead): CustomerLead => ({
  id: l.id,
  name: l.name,
  phone: l.phone,
  city: l.city,
  customerId: l.customerId!,
  status: l.status,
  source: l.source,
  statusChangedAt: l.statusChangedAt,
  assignedToId: l.assignedToId,
  createdAt: l.createdAt,
});

const sees = (actor: Actor, lead: Lead): boolean =>
  scopeFor(actor.role, 'leads') !== 'assigned' || lead.assignedToId === actor.id;

/** The Customers list: leads with an account, narrowed like every lead list (a Sales person sees their own). */
export class ListCustomerLeadsUseCase {
  constructor(private readonly leads: LeadRepositoryPort) {}

  async execute(
    actor: Actor,
    q: { search?: string; page: number; pageSize: number },
  ): Promise<{ items: CustomerLead[]; total: number }> {
    const assigned = scopeFor(actor.role, 'leads') === 'assigned';
    const { items, total } = await this.leads.list({
      page: q.page,
      pageSize: q.pageSize,
      customersOnly: true,
      ...(q.search ? { search: q.search } : {}),
      ...(assigned ? { assignedToId: actor.id } : {}),
    });
    return { items: items.filter((l) => l.customerId).map(toCustomerLead), total };
  }
}

/** One customer's lead; a lead outside the actor's scope is NOT FOUND, like everywhere else. */
export class FindCustomerLeadUseCase {
  constructor(private readonly leads: LeadRepositoryPort) {}

  async execute(actor: Actor, customerId: string): Promise<CustomerLead> {
    const lead = await this.leads.findByCustomerId(customerId);
    if (!lead || !sees(actor, lead)) throw AppError.notFound('Customer not found.');
    return toCustomerLead(lead);
  }
}

/**
 * A customer added by hand or imported. A phone has one lead, so that lead is the person's record:
 *  - no lead yet: one is created as WON (they are already a customer), without making a project;
 *  - a lead exists without an account: it is linked, and if it is still open, its win will make a
 *    project (`newProjectRequested`);
 *  - a lead exists that already belongs to this customer: nothing changes.
 */
export class AddCustomerLeadUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: Actor,
    input: { name: string; phone: string; city: string | null; customerId: string },
  ): Promise<{ lead: CustomerLead; created: boolean }> {
    const existing = await this.leads.findByPhone(input.phone);
    if (existing) {
      if (existing.customerId && existing.customerId !== input.customerId) {
        throw AppError.conflict('This phone number belongs to another customer.');
      }
      if (existing.customerId) return { lead: toCustomerLead(existing), created: false };
      const linked = await this.leads.update(existing.id, {
        customerId: input.customerId,
        newProjectRequested: existing.status !== 'WON',
      });
      return { lead: toCustomerLead(linked ?? existing), created: false };
    }

    const now = this.now();
    const lead = await this.leads.create({
      name: input.name,
      phone: input.phone,
      altPhone: null,
      email: null,
      city: input.city,
      notes: null,
      source: 'EXISTING_CUSTOMER',
      status: 'WON',
      statusChangedAt: now,
      assignedToId: actor.role === 'SALES' ? actor.id : null,
      lostReason: null,
      customerId: input.customerId,
      createdById: actor.id,
    });
    await this.activities.add({
      leadId: lead.id,
      type: 'CREATED',
      byUserId: actor.id,
      at: now,
      data: { source: lead.source },
    });
    return { lead: toCustomerLead(lead), created: true };
  }
}

/**
 * "Start new project" for an existing customer: their lead goes back into the pipeline as NEW, on
 * the same timeline, and its next win makes another project. Already started: nothing changes.
 */
export class StartNewProjectUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, customerId: string): Promise<CustomerLead> {
    const lead = await this.leads.findByCustomerId(customerId);
    if (!lead || !sees(actor, lead)) throw AppError.notFound('Customer not found.');
    if (lead.status !== 'WON' && lead.status !== 'LOST') return toCustomerLead(lead);

    const now = this.now();
    const updated = await this.leads.update(lead.id, {
      status: 'NEW',
      statusChangedAt: now,
      lostReason: null,
      newProjectRequested: true,
      // A Sales person who starts it owns it; an Admin's start keeps the current owner.
      assignedToId: lead.assignedToId ?? (actor.role === 'SALES' ? actor.id : null),
    });
    if (!updated) throw AppError.notFound('Customer not found.');
    await this.activities.add({
      leadId: lead.id,
      type: 'STATUS_CHANGED',
      byUserId: actor.id,
      at: now,
      data: { from: lead.status, to: 'NEW', note: 'New project started' },
    });
    return toCustomerLead(updated);
  }
}
